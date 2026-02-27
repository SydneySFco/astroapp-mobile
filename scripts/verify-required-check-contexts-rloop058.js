#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    if (args[key] === undefined) {
      args[key] = next;
    } else if (Array.isArray(args[key])) {
      args[key].push(next);
    } else {
      args[key] = [args[key], next];
    }
    i += 1;
  }

  return args;
}

function normalize(value) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function toList(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferOwnerRepo(explicitRepo, explicitOwner, explicitRepoName) {
  if (explicitRepo && explicitRepo.includes('/')) {
    const [owner, repo] = explicitRepo.split('/');
    if (owner && repo) return { owner, repo };
  }

  if (explicitOwner && explicitRepoName) {
    return { owner: explicitOwner, repo: explicitRepoName };
  }

  const repository = process.env.GITHUB_REPOSITORY || '';
  const [envOwner, envRepo] = repository.split('/');

  let remoteOwner = '';
  let remoteRepo = '';
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i);
    if (match) {
      remoteOwner = match[1];
      remoteRepo = match[2];
    }
  } catch (_error) {
    // ignore and fall back
  }

  return {
    owner: explicitOwner || envOwner || remoteOwner,
    repo: explicitRepoName || envRepo || remoteRepo,
  };
}

async function githubRequestJson(url, method, token, body) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'astroapp-rloop060-required-check-governance-audit',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const bodyText = await response.text();
  const payload = bodyText ? JSON.parse(bodyText) : {};

  if (!response.ok) {
    const message = payload && payload.message ? payload.message : response.statusText;
    const error = new Error(`GitHub API ${response.status} ${response.statusText}: ${message}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function fetchBranchProtection({ owner, repo, branch, token }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`;
  return githubRequestJson(url, 'GET', token);
}

function extractRequiredContexts(protection) {
  const checks = protection?.required_status_checks?.checks;
  if (Array.isArray(checks) && checks.length > 0) {
    return checks.map((check) => check.context).filter(Boolean);
  }

  const contexts = protection?.required_status_checks?.contexts;
  if (Array.isArray(contexts)) return contexts;

  return [];
}

async function patchRequiredContexts({ owner, repo, branch, token, contexts, strict }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection/required_status_checks`;
  return githubRequestJson(url, 'PATCH', token, {
    strict,
    contexts,
  });
}

function parseWorkflowContextsFromFile(fileContent) {
  const lines = fileContent.split(/\r?\n/);

  let workflowName = null;
  let jobsStarted = false;
  let currentJobId = null;
  let currentJobName = null;
  let currentJobIndent = null;
  const jobs = [];

  const flushJob = () => {
    if (!currentJobId) return;
    jobs.push({ id: currentJobId, name: currentJobName || currentJobId });
    currentJobId = null;
    currentJobName = null;
    currentJobIndent = null;
  };

  for (const line of lines) {
    if (!workflowName) {
      const workflowMatch = line.match(/^name:\s*(.+)\s*$/);
      if (workflowMatch) workflowName = normalize(workflowMatch[1]);
    }

    if (!jobsStarted) {
      if (/^jobs:\s*$/.test(line)) jobsStarted = true;
      continue;
    }

    const jobMatch = line.match(/^(\s{2})([A-Za-z0-9_-]+):\s*$/);
    if (jobMatch) {
      flushJob();
      currentJobIndent = jobMatch[1].length;
      currentJobId = jobMatch[2];
      continue;
    }

    if (!currentJobId) continue;

    const indent = (line.match(/^(\s*)/) || [''])[0].length;
    if (indent <= currentJobIndent && line.trim() !== '') {
      flushJob();
      const fallbackJobMatch = line.match(/^(\s{2})([A-Za-z0-9_-]+):\s*$/);
      if (fallbackJobMatch) {
        currentJobIndent = fallbackJobMatch[1].length;
        currentJobId = fallbackJobMatch[2];
      }
      continue;
    }

    const nameMatch = line.match(/^\s{4}name:\s*(.+)\s*$/);
    if (nameMatch) currentJobName = normalize(nameMatch[1]);
  }

  flushJob();

  if (!workflowName) return [];
  return jobs.map((job) => `${workflowName} / ${job.name}`);
}

function collectWorkflowContexts(workflowsDir) {
  const entries = fs.readdirSync(workflowsDir, { withFileTypes: true });
  const contexts = new Set();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.ya?ml$/i.test(entry.name)) continue;

    const fullPath = path.join(workflowsDir, entry.name);
    const fileContent = fs.readFileSync(fullPath, 'utf8');

    for (const context of parseWorkflowContextsFromFile(fileContent)) {
      contexts.add(context);
    }
  }

  return Array.from(contexts).sort((a, b) => a.localeCompare(b));
}

function tokenizeContext(value) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function similarityScore(a, b) {
  const ta = tokenizeContext(a);
  const tb = tokenizeContext(b);
  if (ta.size === 0 && tb.size === 0) return 1;

  let overlap = 0;
  for (const token of ta) {
    if (tb.has(token)) overlap += 1;
  }

  return (2 * overlap) / (ta.size + tb.size);
}

function buildRenameSuggestions(missingInWorkflows, extraNotRequired) {
  const suggestions = [];

  for (const missing of missingInWorkflows) {
    let best = null;
    let bestScore = 0;
    for (const extra of extraNotRequired) {
      const score = similarityScore(missing, extra);
      if (score > bestScore) {
        best = extra;
        bestScore = score;
      }
    }

    if (best && bestScore >= 0.55) {
      suggestions.push({
        requiredContext: missing,
        candidateContext: best,
        similarity: Number(bestScore.toFixed(2)),
      });
    }
  }

  return suggestions;
}

function dedupe(list) {
  return Array.from(new Set(list));
}

function asSortedUnique(list) {
  return dedupe(list).sort((a, b) => a.localeCompare(b));
}

function arraysEqualAsSet(a, b) {
  const left = asSortedUnique(a);
  const right = asSortedUnique(b);
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function buildPlannedContexts({ requiredContexts, workflowContexts, renameSuggestions, canonicalOnly }) {
  if (canonicalOnly) {
    return workflowContexts.filter((ctx) => ctx.includes(' / required-check / '));
  }

  const replaceMap = new Map(renameSuggestions.map((item) => [item.requiredContext, item.candidateContext]));

  const replaced = requiredContexts.map((ctx) => replaceMap.get(ctx) || ctx);
  return dedupe(replaced);
}

function applyPolicyFilters({ plannedContexts, allowlist, denylist }) {
  const denied = plannedContexts.filter((ctx) => denylist.has(ctx));

  if (allowlist.size === 0) {
    return {
      effectiveContexts: plannedContexts,
      blockedByAllowlist: [],
      blockedByDenylist: denied,
    };
  }

  const blockedByAllowlist = plannedContexts.filter((ctx) => !allowlist.has(ctx));
  const effectiveContexts = plannedContexts.filter((ctx) => allowlist.has(ctx));

  return {
    effectiveContexts,
    blockedByAllowlist,
    blockedByDenylist: denied,
  };
}

function ensureDirFor(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function writeAuditArtifact(filePath, payload) {
  ensureDirFor(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function printSummary(report) {
  console.log('=== Required-check Context Drift Governance Guard (RLOOP-060) ===');
  console.log(`Repo: ${report.owner}/${report.repo}`);
  console.log(`Branch: ${report.branch}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Canonical only: ${report.canonicalOnly ? 'yes' : 'no'}`);
  console.log(`Audit file: ${report.auditFile}`);

  console.log(`\nRequired contexts (${report.requiredContexts.length})`);
  report.requiredContexts.forEach((ctx) => console.log(`  - ${ctx}`));

  console.log(`\nWorkflow/job contexts (${report.workflowContexts.length})`);
  report.workflowContexts.forEach((ctx) => console.log(`  - ${ctx}`));

  if (report.allowlist.length > 0) {
    console.log(`\nAllowlist (${report.allowlist.length})`);
    report.allowlist.forEach((ctx) => console.log(`  - ${ctx}`));
  }

  if (report.denylist.length > 0) {
    console.log(`\nDenylist (${report.denylist.length})`);
    report.denylist.forEach((ctx) => console.log(`  - ${ctx}`));
  }

  console.log('\n--- Drift Summary ---');
  if (report.missingInWorkflows.length === 0) {
    console.log('✓ No missing required contexts.');
  } else {
    console.log('✗ Missing in workflows (required by branch protection, not found in workflow/job names):');
    report.missingInWorkflows.forEach((ctx) => console.log(`  - ${ctx}`));
  }

  if (report.extraNotRequired.length === 0) {
    console.log('✓ No extra workflow contexts outside branch protection list.');
  } else {
    console.log('! Extra workflow contexts (exist in workflows, not in required list):');
    report.extraNotRequired.forEach((ctx) => console.log(`  - ${ctx}`));
  }

  if (report.renameSuggestions.length > 0) {
    console.log('\nPotential rename drift candidates:');
    report.renameSuggestions.forEach((item) => {
      console.log(
        `  - Required '${item.requiredContext}' ≈ Workflow '${item.candidateContext}' (similarity=${item.similarity})`,
      );
    });
  }

  if (report.planChanged) {
    console.log('\nPlanned required contexts after remediation plan:');
    report.plannedContexts.forEach((ctx) => console.log(`  - ${ctx}`));
  } else {
    console.log('\nPlanned required contexts: no change needed.');
  }

  if (report.blockedByAllowlist.length > 0) {
    console.log('\nBlocked by allowlist (removed from effective apply set):');
    report.blockedByAllowlist.forEach((ctx) => console.log(`  - ${ctx}`));
  }

  if (report.blockedByDenylist.length > 0) {
    console.log('\nBlocked by denylist (unsafe for apply):');
    report.blockedByDenylist.forEach((ctx) => console.log(`  - ${ctx}`));
  }

  if (report.mode === 'apply') {
    console.log('\nRead-after-write verification:');
    console.log(`  - attempted: yes`);
    console.log(`  - verified: ${report.verified ? 'yes' : 'no'}`);
    if (!report.verified) {
      if (report.verificationMissing.length > 0) {
        console.log('  - missing after apply:');
        report.verificationMissing.forEach((ctx) => console.log(`      - ${ctx}`));
      }
      if (report.verificationUnexpected.length > 0) {
        console.log('  - unexpected after apply:');
        report.verificationUnexpected.forEach((ctx) => console.log(`      - ${ctx}`));
      }
    }
  }

  console.log('\nExecution summary:');
  console.log(`  - dry-run: ${report.mode === 'dry-run' ? 'yes' : 'no'}`);
  console.log(`  - apply: ${report.mode === 'apply' ? 'yes' : 'no'}`);
  console.log(`  - planned changes: ${report.planChanged ? 'yes' : 'no'}`);
  console.log(`  - applied changes: ${report.applied ? 'yes' : 'no'}`);
}

function failOrWarn(message, mode) {
  if (mode === 'warn') {
    console.warn(`::warning::${message}`);
    return 0;
  }
  console.error(`::error::${message}`);
  return 1;
}

async function main() {
  const args = parseArgs(process.argv);

  const branch = args.branch || 'master';
  const policy = (args.policy || 'fail').toLowerCase();
  const onApiError = (args['on-api-error'] || policy).toLowerCase();

  const explicitDryRun = Boolean(args['dry-run']);
  const explicitApply = Boolean(args.apply);
  const canonicalOnly = Boolean(args['canonical-only']);

  if (!['warn', 'fail'].includes(policy)) {
    throw new Error(`Invalid --policy '${policy}'. Use warn|fail.`);
  }

  if (!['warn', 'fail'].includes(onApiError)) {
    throw new Error(`Invalid --on-api-error '${onApiError}'. Use warn|fail.`);
  }

  if (explicitDryRun && explicitApply) {
    throw new Error('Use either --dry-run or --apply (not both).');
  }

  const mode = explicitApply ? 'apply' : 'dry-run';

  const { owner, repo } = inferOwnerRepo(args.repo, args.owner, args['repo-name']);
  if (!owner || !repo) {
    throw new Error('Unable to infer owner/repo. Pass --repo owner/name or set GITHUB_REPOSITORY.');
  }

  const token = args.token || process.env.GITHUB_TOKEN;
  if (!token) {
    const code = failOrWarn('Missing GitHub token. Set GITHUB_TOKEN or pass --token.', onApiError);
    process.exit(code);
  }

  let protection;
  try {
    protection = await fetchBranchProtection({ owner, repo, branch, token });
  } catch (error) {
    const code = failOrWarn(
      `Could not read branch protection for ${owner}/${repo}@${branch}: ${error.message}`,
      onApiError,
    );
    process.exit(code);
  }

  const requiredContexts = extractRequiredContexts(protection);
  const strict = Boolean(protection?.required_status_checks?.strict);

  const workflowsDir = path.resolve('.github/workflows');
  if (!fs.existsSync(workflowsDir)) {
    throw new Error(`Workflows directory not found: ${workflowsDir}`);
  }

  const workflowContexts = collectWorkflowContexts(workflowsDir);

  const requiredSet = new Set(requiredContexts);
  const workflowSet = new Set(workflowContexts);

  const missingInWorkflows = requiredContexts.filter((ctx) => !workflowSet.has(ctx));
  const extraNotRequired = workflowContexts.filter((ctx) => !requiredSet.has(ctx));
  const renameSuggestions = buildRenameSuggestions(missingInWorkflows, extraNotRequired);

  const plannedContexts = buildPlannedContexts({
    requiredContexts,
    workflowContexts,
    renameSuggestions,
    canonicalOnly,
  });

  const allowlist = new Set(toList(args.allowlist));
  const denylist = new Set(toList(args.denylist));

  const { effectiveContexts, blockedByAllowlist, blockedByDenylist } = applyPolicyFilters({
    plannedContexts,
    allowlist,
    denylist,
  });

  const planChanged = !arraysEqualAsSet(requiredContexts, effectiveContexts);

  const actor = process.env.GITHUB_ACTOR || process.env.USER || 'unknown';
  const auditFile = args['audit-file'] || 'artifacts/required-check-drift-audit.json';

  let applied = false;
  let verified = mode !== 'apply';
  let verifiedContexts = requiredContexts;
  let verificationMissing = [];
  let verificationUnexpected = [];

  if (mode === 'apply' && blockedByDenylist.length > 0) {
    throw new Error(
      `Apply blocked: ${blockedByDenylist.length} planned context(s) are denylisted. Remove from plan or adjust denylist.`,
    );
  }

  if (mode === 'apply' && planChanged) {
    try {
      await patchRequiredContexts({
        owner,
        repo,
        branch,
        token,
        contexts: effectiveContexts,
        strict,
      });
      applied = true;
    } catch (error) {
      throw new Error(`Failed to patch required contexts: ${error.message}`);
    }

    const verifiedProtection = await fetchBranchProtection({ owner, repo, branch, token });
    verifiedContexts = extractRequiredContexts(verifiedProtection);

    const expected = asSortedUnique(effectiveContexts);
    const actual = asSortedUnique(verifiedContexts);
    verificationMissing = expected.filter((ctx) => !actual.includes(ctx));
    verificationUnexpected = actual.filter((ctx) => !expected.includes(ctx));
    verified = verificationMissing.length === 0 && verificationUnexpected.length === 0;
  }

  const report = {
    schemaVersion: 'rloop060.required-check-governance.v1',
    timestamp: new Date().toISOString(),
    actor,
    mode,
    owner,
    repo,
    branch,
    canonicalOnly,
    auditFile,
    requiredContexts,
    workflowContexts,
    missingInWorkflows,
    extraNotRequired,
    renameSuggestions,
    allowlist: Array.from(allowlist),
    denylist: Array.from(denylist),
    plannedContexts,
    blockedByAllowlist,
    blockedByDenylist,
    effectiveContexts,
    planChanged,
    applied,
    verified,
    verificationMissing,
    verificationUnexpected,
    before: {
      requiredContexts: requiredContexts,
    },
    after: {
      requiredContexts: mode === 'apply' ? verifiedContexts : requiredContexts,
    },
  };

  writeAuditArtifact(auditFile, report);
  printSummary(report);

  const hasDrift = missingInWorkflows.length > 0 || extraNotRequired.length > 0;

  if (mode === 'apply') {
    if (!verified) {
      console.error('::error::Read-after-write verification failed.');
      console.error('::error::Action: rerun in --dry-run to inspect plan, then retry apply; check branch protection admin restrictions and token scopes.');
      process.exit(1);
    }

    if (planChanged && applied) {
      console.log('\nResult: APPLIED + VERIFIED (required contexts patched and verified).');
      process.exit(0);
    }

    if (!planChanged) {
      console.log('\nResult: NOOP (already aligned with remediation plan).');
      process.exit(0);
    }

    process.exit(1);
  }

  if (!hasDrift) {
    console.log('\nResult: PASS (no drift detected).');
    process.exit(0);
  }

  const message = `Drift detected: missing=${missingInWorkflows.length}, extra=${extraNotRequired.length}.`;
  const code = failOrWarn(message, policy);
  process.exit(code);
}

main().catch((error) => {
  console.error(`::error::Unexpected failure in RLOOP-060 guard: ${error.message}`);
  process.exit(1);
});
