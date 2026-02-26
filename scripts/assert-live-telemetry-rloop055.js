#!/usr/bin/env node

const fs = require('fs');

const telemetryPath = process.env.RLOOP055_TELEMETRY_PATH;
const policy = (process.env.RLOOP055_TELEMETRY_POLICY || 'fail').toLowerCase() === 'warn' ? 'warn' : 'fail';
const assertionMdPath = process.env.RLOOP055_TELEMETRY_ASSERTION_MD;

if (!telemetryPath) {
  console.error('RLOOP055_TELEMETRY_PATH is required');
  process.exit(1);
}

const requiredMetrics = [
  'github_api_attempt_count',
  'github_api_rate_limit_hits',
  'publisher_idempotent_dedupe_count',
];

const fail = message => {
  console.error(`::error::${message}`);
  process.exit(1);
};

const warn = message => {
  console.warn(`::warning::${message}`);
};

const writeAssertionMd = lines => {
  if (!assertionMdPath) {
    return;
  }
  fs.mkdirSync(require('path').dirname(assertionMdPath), {recursive: true});
  fs.writeFileSync(assertionMdPath, `${lines.join('\n')}\n`, 'utf8');
};

if (!fs.existsSync(telemetryPath)) {
  fail(`Telemetry file not found: ${telemetryPath}`);
}

const payload = JSON.parse(fs.readFileSync(telemetryPath, 'utf8'));
const totals = payload?.totals || {};

const missingKeys = requiredMetrics.filter(metric => !(metric in totals));
const coverage = (requiredMetrics.length - missingKeys.length) / requiredMetrics.length;

const githubAttemptCount = Number(totals.github_api_attempt_count || 0);
const problems = [];

if (missingKeys.length > 0) {
  problems.push(`missing required telemetry metrics: ${missingKeys.join(', ')}`);
}

if (coverage < 1) {
  problems.push(`telemetry coverage below minimum: ${(coverage * 100).toFixed(0)}%`);
}

if (githubAttemptCount <= 0) {
  problems.push('github_api_attempt_count must be > 0 in live mode');
}

const lines = [
  '# Publisher Telemetry Assertion (RLOOP-055)',
  '',
  `- Policy: \`${policy}\``,
  `- Telemetry path: \`${telemetryPath}\``,
  `- Required metrics: ${requiredMetrics.map(metric => `\`${metric}\``).join(', ')}`,
  `- Coverage: ${(coverage * 100).toFixed(0)}%`,
  `- github_api_attempt_count: ${githubAttemptCount}`,
  '',
  '## Totals',
  '```json',
  JSON.stringify(totals, null, 2),
  '```',
];

if (problems.length === 0) {
  lines.push('', 'Result: ✅ PASS');
  writeAssertionMd(lines);
  console.log('Live telemetry assertions passed.');
  process.exit(0);
}

lines.push('', '## Problems', ...problems.map(problem => `- ${problem}`));
lines.push('', `Result: ${policy === 'fail' ? '❌ FAIL' : '⚠️ WARN'}`);
writeAssertionMd(lines);

const message = `Live telemetry assertion issues: ${problems.join(' | ')}`;
if (policy === 'fail') {
  fail(message);
}

warn(message);
console.log('Live telemetry assertions completed with warnings (policy=warn).');
