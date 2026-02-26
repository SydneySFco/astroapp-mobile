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
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function normalize(value) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function inferOwnerRepo(explicitOwner, explicitRepo) {
  if (explicitOwner && explicitRepo) return { owner: explicitOwner, repo: explicitRepo };

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
    // ignore and fall back to env/explicit values
  }

  return {
    owner: explicitOwner || envOwner || remoteOwner,
    repo: explicitRepo || envRepo || remoteRepo,
  };
}

async function githubGetJson(url, token) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'astroapp-rloop058-context-guard',
    },
  });

  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : {};

  if (!response.ok) {
    const message = body && body.message ? body.message : response.statusText;
    const error = new Error(`GitHub API ${response.status} ${response.statusText}: ${message}`);
    error.status = response.status;
    throw error;
  }

  return body;
}

async function fetchRequiredContexts({ owner, repo, branch, token }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`;
  const payload = await githubGetJson(url, token);

  const checks = payload?.required_status_checks?.checks;
  if (Array.isArray(checks) && checks.length > 0) {
    return checks.map((check) => check.context).filter(Boolean);
  }

  const contexts = payload?.required_status_checks?.contexts;
  if (Array.isArray(contexts)) return contexts;

  return [];
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

    for (const ctx of parseWorkflowContextsFromFile(fileContent)) {
      contexts.add(ctx);
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

function printSummary(report) {
  console.log('=== Required-check Context Drift Guard (RLOOP-058) ===');
  console.log(`Branch: ${report.branch}`);
  console.log(`Required contexts (${report.requiredContexts.length})`);
  report.requiredContexts.forEach((ctx) => console.log(`  - ${ctx}`));

  console.log(`\nWorkflow/job contexts (${report.workflowContexts.length})`);
  report.workflowContexts.forEach((ctx) => console.log(`  - ${ctx}`));

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

  console.log('\nSuggested fixes:');
  if (report.missingInWorkflows.length > 0) {
    console.log('  1) Update workflow/job name(s) OR replace stale required context(s) in branch protection.');
  }
  if (report.extraNotRequired.length > 0) {
    console.log('  2) Add newly introduced critical context(s) to branch protection if they must gate merges.');
  }
  if (report.missingInWorkflows.length === 0 && report.extraNotRequired.length === 0) {
    console.log('  - No action needed. Contexts are aligned.');
  }
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

  if (!['warn', 'fail'].includes(policy)) {
    throw new Error(`Invalid --policy '${policy}'. Use warn|fail.`);
  }

  if (!['warn', 'fail'].includes(onApiError)) {
    throw new Error(`Invalid --on-api-error '${onApiError}'. Use warn|fail.`);
  }

  const { owner, repo } = inferOwnerRepo(args.owner, args.repo);
  const token = args.token || process.env.GITHUB_TOKEN;

  if (!owner || !repo) {
    throw new Error('Unable to infer owner/repo. Pass --owner and --repo or set GITHUB_REPOSITORY.');
  }

  if (!token) {
    const code = failOrWarn('Missing GitHub token. Set GITHUB_TOKEN or pass --token.', onApiError);
    process.exit(code);
  }

  let requiredContexts = [];
  try {
    requiredContexts = await fetchRequiredContexts({ owner, repo, branch, token });
  } catch (error) {
    const code = failOrWarn(
      `Could not read branch protection for ${owner}/${repo}@${branch}: ${error.message}`,
      onApiError,
    );
    process.exit(code);
  }

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

  const report = {
    owner,
    repo,
    branch,
    requiredContexts,
    workflowContexts,
    missingInWorkflows,
    extraNotRequired,
    renameSuggestions,
  };

  printSummary(report);

  const hasDrift = missingInWorkflows.length > 0 || extraNotRequired.length > 0;
  if (!hasDrift) {
    console.log('\nResult: PASS (no drift detected).');
    process.exit(0);
  }

  const message = `Drift detected: missing=${missingInWorkflows.length}, extra=${extraNotRequired.length}.`;
  const code = failOrWarn(message, policy);
  process.exit(code);
}

main().catch((error) => {
  console.error(`::error::Unexpected failure in RLOOP-058 guard: ${error.message}`);
  process.exit(1);
});
