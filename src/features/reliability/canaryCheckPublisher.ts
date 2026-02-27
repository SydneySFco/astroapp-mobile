import type {GitHubApiClient} from './githubApi';

export type CanaryPolicyMode = 'warn' | 'fail';
export type CanarySignalStatus = 'success' | 'warn' | 'fail';

export type CanarySummarySignal = {
  status: CanarySignalStatus;
  runId: string;
  runUrl?: string;
  details?: string[];
  generatedAt?: string;
};

export type GitHubCheckConclusion = 'success' | 'neutral' | 'failure';

export type GitHubCheckRunPayload = {
  name: string;
  status: 'completed';
  conclusion: GitHubCheckConclusion;
  completed_at: string;
  output: {
    title: string;
    summary: string;
    text?: string;
  };
  details_url?: string;
  external_id?: string;
};

export const CANARY_CHECK_NAME = 'nonprod-db-canary / drift';
export const CANARY_STICKY_COMMENT_MARKER = '<!-- canary-check:nonprod-db-canary-drift -->';

export const mapCanaryStatusToCheckConclusion = (
  status: CanarySignalStatus,
  policy: CanaryPolicyMode,
): GitHubCheckConclusion => {
  if (status === 'success') {
    return 'success';
  }

  if (status === 'warn') {
    return policy === 'fail' ? 'failure' : 'neutral';
  }

  return 'failure';
};

const buildCheckSummary = (signal: CanarySummarySignal, policy: CanaryPolicyMode): string => {
  const base = [`- Policy: \`${policy}\``, `- Status: \`${signal.status}\``, `- Run ID: \`${signal.runId}\``];

  if (signal.runUrl) {
    base.push(`- Run URL: ${signal.runUrl}`);
  }

  return base.join('\n');
};

const buildCheckDetails = (signal: CanarySummarySignal): string | undefined => {
  if (!signal.details || signal.details.length === 0) {
    return undefined;
  }

  return ['### Findings', '', ...signal.details.map(item => `- ${item}`)].join('\n');
};

export const buildCanaryCheckExternalId = (signal: CanarySummarySignal, policy: CanaryPolicyMode): string =>
  `canary-check:${policy}:${signal.runId}:${signal.status}`;

export const buildCanaryCheckRunPayload = (
  signal: CanarySummarySignal,
  policy: CanaryPolicyMode,
  now = new Date(),
  checkName = CANARY_CHECK_NAME,
): GitHubCheckRunPayload => ({
  name: checkName,
  status: 'completed',
  conclusion: mapCanaryStatusToCheckConclusion(signal.status, policy),
  completed_at: now.toISOString(),
  output: {
    title: `Canary drift: ${signal.status.toUpperCase()}`,
    summary: buildCheckSummary(signal, policy),
    text: buildCheckDetails(signal),
  },
  details_url: signal.runUrl,
  external_id: buildCanaryCheckExternalId(signal, policy),
});

export type PullRequestComment = {
  id: number;
  body: string;
  authorLogin: string;
};

export type StickyCommentUpsertPlan =
  | {action: 'create'; body: string}
  | {action: 'update'; commentId: number; body: string};

export const buildStickyCommentBody = (
  signal: CanarySummarySignal,
  policy: CanaryPolicyMode,
): string => {
  const lines = [
    CANARY_STICKY_COMMENT_MARKER,
    '## Non-prod DB Canary / Drift',
    '',
    `- Policy: \`${policy}\``,
    `- Status: **${signal.status.toUpperCase()}**`,
    `- Run ID: \`${signal.runId}\``,
  ];

  if (signal.runUrl) {
    lines.push(`- Run URL: ${signal.runUrl}`);
  }

  if (signal.details && signal.details.length > 0) {
    lines.push('', '### Findings');
    signal.details.forEach(item => lines.push(`- ${item}`));
  }

  return `${lines.join('\n')}\n`;
};

export const planStickyCommentUpsert = (
  existingComments: PullRequestComment[],
  body: string,
  botLogin: string,
): StickyCommentUpsertPlan => {
  const sticky = existingComments.find(
    comment =>
      comment.authorLogin.toLowerCase() === botLogin.toLowerCase() &&
      comment.body.includes(CANARY_STICKY_COMMENT_MARKER),
  );

  if (!sticky) {
    return {
      action: 'create',
      body,
    };
  }

  return {
    action: 'update',
    commentId: sticky.id,
    body,
  };
};

export const upsertCanaryStickyComment = async (
  github: GitHubApiClient,
  input: {
    issueNumber: number;
    botLogin: string;
    signal: CanarySummarySignal;
    policy: CanaryPolicyMode;
  },
): Promise<StickyCommentUpsertPlan> => {
  const comments = await github.listPullRequestComments(input.issueNumber);
  const plan = planStickyCommentUpsert(
    comments.map(comment => ({
      id: comment.id,
      body: comment.body,
      authorLogin: comment.user?.login ?? '',
    })),
    buildStickyCommentBody(input.signal, input.policy),
    input.botLogin,
  );

  if (plan.action === 'create') {
    await github.createPullRequestComment(input.issueNumber, plan.body, CANARY_STICKY_COMMENT_MARKER);
    return plan;
  }

  await github.updatePullRequestComment(plan.commentId, plan.body);
  return plan;
};
