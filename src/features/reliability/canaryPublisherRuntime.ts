import {
  buildCanaryCheckRunPayload,
  buildStickyCommentBody,
  buildCanaryCheckExternalId,
  type CanaryPolicyMode,
  type CanarySummarySignal,
  type StickyCommentUpsertPlan,
  CANARY_CHECK_NAME,
  upsertCanaryStickyComment,
} from './canaryCheckPublisher';
import type {ArtifactStore, ArtifactWriteInput} from './artifactStore';
import type {GitHubApiClient, GitHubApiTelemetryEvent} from './githubApi';

export const publisherMetricNames = {
  githubApiAttemptCount: 'github_api_attempt_count',
  githubApiRateLimitHits: 'github_api_rate_limit_hits',
  publisherIdempotentDedupeCount: 'publisher_idempotent_dedupe_count',
} as const;

export type PublisherMetricEvent = {
  metric:
    | typeof publisherMetricNames.githubApiAttemptCount
    | typeof publisherMetricNames.githubApiRateLimitHits
    | typeof publisherMetricNames.publisherIdempotentDedupeCount;
  value: number;
  dimensions: {
    action: 'check_run' | 'sticky_comment' | 'artifact_sync' | 'github_api' | 'runtime';
    outcome: 'success' | 'failure' | 'dry_run' | 'deduped' | 'attempt' | 'rate_limited';
    endpoint: string;
  };
  observedAt: string;
};

export type PublisherMetricEmitter = {
  emit: (event: PublisherMetricEvent) => Promise<void> | void;
};

export const createGitHubTelemetryMetricBridge = (
  emitter: PublisherMetricEmitter | undefined,
): ((event: GitHubApiTelemetryEvent) => Promise<void>) => {
  return async event => {
    if (!emitter) {
      return;
    }

    await emitter.emit({
      metric: publisherMetricNames.githubApiAttemptCount,
      value: 1,
      dimensions: {
        action: 'github_api',
        outcome: 'attempt',
        endpoint: event.endpoint,
      },
      observedAt: new Date().toISOString(),
    });

    if (event.outcome === 'rate_limited') {
      await emitter.emit({
        metric: publisherMetricNames.githubApiRateLimitHits,
        value: 1,
        dimensions: {
          action: 'github_api',
          outcome: 'rate_limited',
          endpoint: event.endpoint,
        },
        observedAt: new Date().toISOString(),
      });
    }
  };
};

export type CanaryPublisherRuntimeConfig = {
  mode: 'dry' | 'live';
  policy: CanaryPolicyMode;
  checkName: string;
  stickyCommentEnabled: boolean;
  artifactSyncEnabled: boolean;
};

export type CanaryPublisherRuntimeInput = {
  github: GitHubApiClient;
  signal: CanarySummarySignal;
  headSha: string;
  issueNumber: number;
  botLogin: string;
  existingCheckRunId?: number;
  artifactStore?: ArtifactStore;
  artifactPointerKey?: string;
  artifactMetadata?: Record<string, string>;
  metricEmitter?: PublisherMetricEmitter;
  idempotencySet?: Set<string>;
};

export type CanaryPublisherRuntimeResult = {
  mode: 'dry' | 'live';
  checkAction: 'create' | 'update' | 'dry_run' | 'deduped';
  stickyCommentPlan?: StickyCommentUpsertPlan | {action: 'dry_run'; body: string};
  artifactAction: 'synced' | 'skipped' | 'dry_run';
  deduped: boolean;
};

const emitMetric = async (
  emitter: PublisherMetricEmitter | undefined,
  event: Omit<PublisherMetricEvent, 'observedAt'>,
): Promise<void> => {
  if (!emitter) {
    return;
  }

  await emitter.emit({...event, observedAt: new Date().toISOString()});
};

const buildArtifactPayload = (
  signal: CanarySummarySignal,
  policy: CanaryPolicyMode,
): ArtifactWriteInput['content'] =>
  JSON.stringify(
    {
      version: 1,
      kind: 'canary-check-summary',
      policy,
      status: signal.status,
      runId: signal.runId,
      runUrl: signal.runUrl,
      details: signal.details ?? [],
      generatedAt: signal.generatedAt ?? new Date().toISOString(),
    },
    null,
    2,
  );

export const runCanaryPublisherRuntime = async (
  config: CanaryPublisherRuntimeConfig,
  input: CanaryPublisherRuntimeInput,
): Promise<CanaryPublisherRuntimeResult> => {
  const externalId = buildCanaryCheckExternalId(input.signal, config.policy);
  const idempotencySet = input.idempotencySet;

  if (idempotencySet?.has(externalId)) {
    await emitMetric(input.metricEmitter, {
      metric: publisherMetricNames.publisherIdempotentDedupeCount,
      value: 1,
      dimensions: {
        action: 'runtime',
        outcome: 'deduped',
        endpoint: 'publisher.run',
      },
    });

    return {
      mode: config.mode,
      checkAction: 'deduped',
      artifactAction: config.artifactSyncEnabled ? 'skipped' : 'skipped',
      deduped: true,
    };
  }

  idempotencySet?.add(externalId);

  const checkPayload = buildCanaryCheckRunPayload(
    input.signal,
    config.policy,
    new Date(),
    config.checkName || CANARY_CHECK_NAME,
  );

  if (config.mode === 'dry') {
    const stickyBody = buildStickyCommentBody(input.signal, config.policy);
    return {
      mode: config.mode,
      checkAction: 'dry_run',
      stickyCommentPlan: config.stickyCommentEnabled ? {action: 'dry_run', body: stickyBody} : undefined,
      artifactAction: config.artifactSyncEnabled ? 'dry_run' : 'skipped',
      deduped: false,
    };
  }

  if (input.existingCheckRunId) {
    await input.github.updateCheckRun(input.existingCheckRunId, {
      conclusion: checkPayload.conclusion,
      completed_at: checkPayload.completed_at,
      output: checkPayload.output,
      details_url: checkPayload.details_url,
    });
  } else {
    await input.github.createCheckRun({...checkPayload, head_sha: input.headSha});
  }

  await emitMetric(input.metricEmitter, {
    metric: publisherMetricNames.githubApiAttemptCount,
    value: 1,
    dimensions: {
      action: 'check_run',
      outcome: 'success',
      endpoint: input.existingCheckRunId ? 'checks.update' : 'checks.create',
    },
  });

  let stickyCommentPlan: CanaryPublisherRuntimeResult['stickyCommentPlan'];
  if (config.stickyCommentEnabled) {
    stickyCommentPlan = await upsertCanaryStickyComment(input.github, {
      issueNumber: input.issueNumber,
      botLogin: input.botLogin,
      signal: input.signal,
      policy: config.policy,
    });

    await emitMetric(input.metricEmitter, {
      metric: publisherMetricNames.githubApiAttemptCount,
      value: 1,
      dimensions: {
        action: 'sticky_comment',
        outcome: 'success',
        endpoint: stickyCommentPlan.action === 'create' ? 'issues.comments.create' : 'issues.comments.update',
      },
    });
  }

  let artifactAction: CanaryPublisherRuntimeResult['artifactAction'] = 'skipped';
  if (config.artifactSyncEnabled && input.artifactStore && input.artifactPointerKey) {
    await input.artifactStore.write({
      pointer: {
        key: input.artifactPointerKey,
        runId: input.signal.runId,
      },
      content: buildArtifactPayload(input.signal, config.policy),
      contentType: 'application/json',
      metadata: input.artifactMetadata,
    });
    artifactAction = 'synced';

    await emitMetric(input.metricEmitter, {
      metric: publisherMetricNames.githubApiAttemptCount,
      value: 1,
      dimensions: {
        action: 'artifact_sync',
        outcome: 'success',
        endpoint: 'contents.put',
      },
    });
  }

  return {
    mode: config.mode,
    checkAction: input.existingCheckRunId ? 'update' : 'create',
    stickyCommentPlan,
    artifactAction,
    deduped: false,
  };
};
