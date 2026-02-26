import {
  createGitHubTelemetryMetricBridge,
  publisherMetricNames,
  resolveCanaryCheckPublisherRuntimeConfig,
  runCanaryPublisherRuntime,
  type PublisherMetricEvent,
} from '../src/features/reliability';

describe('RLOOP-053 canary publisher runtime wiring', () => {
  it('uses safe dry mode by default from env config', () => {
    const config = resolveCanaryCheckPublisherRuntimeConfig({});

    expect(config.mode).toBe('dry');
    expect(config.policy).toBe('warn');
    expect(config.stickyCommentEnabled).toBe(true);
    expect(config.artifactSyncEnabled).toBe(true);
  });

  it('returns orchestration plan in dry mode without side effects', async () => {
    const github = {
      createCheckRun: jest.fn(),
      updateCheckRun: jest.fn(),
      listPullRequestComments: jest.fn(),
      createPullRequestComment: jest.fn(),
      updatePullRequestComment: jest.fn(),
    } as any;

    const artifactStore = {
      write: jest.fn(),
    } as any;

    const result = await runCanaryPublisherRuntime(
      {
        mode: 'dry',
        policy: 'warn',
        checkName: 'nonprod-db-canary / drift',
        stickyCommentEnabled: true,
        artifactSyncEnabled: true,
      },
      {
        github,
        signal: {status: 'warn', runId: 'run-53', details: ['schema drift candidate']},
        headSha: 'abc123',
        issueNumber: 53,
        botLogin: 'astro-bot',
        artifactStore,
        artifactPointerKey: 'canary/latest.json',
      },
    );

    expect(result.checkAction).toBe('dry_run');
    expect(result.stickyCommentPlan).toEqual(
      expect.objectContaining({
        action: 'dry_run',
      }),
    );
    expect(result.artifactAction).toBe('dry_run');
    expect(github.createCheckRun).not.toHaveBeenCalled();
    expect(artifactStore.write).not.toHaveBeenCalled();
  });

  it('emits github attempt and rate-limit metrics through telemetry bridge', async () => {
    const events: PublisherMetricEvent[] = [];
    const bridge = createGitHubTelemetryMetricBridge({
      emit: event => {
        events.push(event);
      },
    });

    await bridge({
      endpoint: 'checks.create',
      method: 'POST',
      attempt: 1,
      outcome: 'rate_limited',
      statusCode: 429,
    });

    expect(events.map(item => item.metric)).toEqual([
      publisherMetricNames.githubApiAttemptCount,
      publisherMetricNames.githubApiRateLimitHits,
    ]);
    expect(events[0]?.dimensions).toEqual({
      action: 'github_api',
      outcome: 'attempt',
      endpoint: 'checks.create',
    });
  });

  it('dedupes idempotent publish based on external id', async () => {
    const github = {
      createCheckRun: jest.fn(),
      updateCheckRun: jest.fn(),
      listPullRequestComments: jest.fn(),
      createPullRequestComment: jest.fn(),
      updatePullRequestComment: jest.fn(),
    } as any;

    const idempotencySet = new Set<string>();

    await runCanaryPublisherRuntime(
      {
        mode: 'dry',
        policy: 'warn',
        checkName: 'nonprod-db-canary / drift',
        stickyCommentEnabled: false,
        artifactSyncEnabled: false,
      },
      {
        github,
        signal: {status: 'success', runId: 'run-53'},
        headSha: 'abc123',
        issueNumber: 53,
        botLogin: 'astro-bot',
        idempotencySet,
      },
    );

    const second = await runCanaryPublisherRuntime(
      {
        mode: 'dry',
        policy: 'warn',
        checkName: 'nonprod-db-canary / drift',
        stickyCommentEnabled: false,
        artifactSyncEnabled: false,
      },
      {
        github,
        signal: {status: 'success', runId: 'run-53'},
        headSha: 'abc123',
        issueNumber: 53,
        botLogin: 'astro-bot',
        idempotencySet,
      },
    );

    expect(second.deduped).toBe(true);
    expect(second.checkAction).toBe('deduped');
  });
});
