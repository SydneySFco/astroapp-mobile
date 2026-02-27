import {mkdirSync, readFileSync, writeFileSync} from 'fs';
import {dirname} from 'path';

import {
  resolveCanaryCheckPublisherRuntimeConfig,
  runCanaryPublisherRuntime,
  type ArtifactStore,
  type CanarySummarySignal,
  type GitHubApiClient,
} from '../src/features/reliability';

type StoredArtifact = {
  content: string;
  contentType?: string;
  metadata?: Record<string, string>;
};

class InMemoryArtifactStore implements ArtifactStore {
  private readonly data = new Map<string, StoredArtifact>();

  public async read(pointer: {key: string; runId?: string}) {
    const artifact = this.data.get(pointer.key);
    if (!artifact) {
      return null;
    }

    return {
      pointer,
      content: artifact.content,
      contentType: artifact.contentType,
      fetchedAt: new Date().toISOString(),
    };
  }

  public async write(input: {
    pointer: {key: string; runId?: string};
    content: string;
    contentType?: string;
    metadata?: Record<string, string>;
  }) {
    this.data.set(input.pointer.key, {
      content: input.content,
      contentType: input.contentType,
      metadata: input.metadata,
    });
  }

  public async exists(pointer: {key: string; runId?: string}) {
    return this.data.has(pointer.key);
  }
}

const buildMockGithubClient = (): jest.Mocked<GitHubApiClient> => {
  return {
    createCheckRun: jest.fn(async () => ({id: 1001, external_id: 'mock'})),
    updateCheckRun: jest.fn(async () => ({id: 1001, external_id: 'mock'})),
    listPullRequestComments: jest.fn(async () => []),
    createPullRequestComment: jest.fn(async () => ({id: 2001, body: 'created'})),
    updatePullRequestComment: jest.fn(async () => ({id: 2001, body: 'updated'})),
    getRepoContent: jest.fn(async () => null),
    putRepoContent: jest.fn(async () => undefined),
    decodeContent: jest.fn((content: string) => content),
  } as unknown as jest.Mocked<GitHubApiClient>;
};

const loadSignal = (): CanarySummarySignal => {
  const path = process.env.RLOOP054_CANARY_SUMMARY_PATH;
  if (!path) {
    return {
      status: 'warn',
      runId: 'local-rloop054',
      runUrl: 'https://example.local/runs/local-rloop054',
      details: ['summary path not provided; fallback signal used'],
    };
  }

  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as {
    status?: 'success' | 'warn' | 'fail';
    runId?: string;
    runUrl?: string;
    details?: string[];
  };

  return {
    status: parsed.status ?? 'warn',
    runId: parsed.runId ?? 'local-rloop054',
    runUrl: parsed.runUrl,
    details: parsed.details ?? [],
  };
};

describe('RLOOP-054 publisher runtime local e2e skeleton', () => {
  it('calls publisher runtime entrypoint with mock GitHub + artifact store (dry default)', async () => {
    const github = buildMockGithubClient();
    const artifactStore = new InMemoryArtifactStore();
    const config = resolveCanaryCheckPublisherRuntimeConfig(process.env);
    const signal = loadSignal();
    const telemetryEvents: Array<{metric: string; value: number}> = [];

    const result = await runCanaryPublisherRuntime(config, {
      github,
      signal,
      headSha: process.env.RLOOP054_HEAD_SHA ?? '0000000000000000000000000000000000000054',
      issueNumber: Number(process.env.RLOOP054_ISSUE_NUMBER ?? 54),
      botLogin: process.env.RLOOP054_BOT_LOGIN ?? 'github-actions[bot]',
      artifactStore,
      artifactPointerKey: 'canary/nonprod/latest.json',
      artifactMetadata: {
        source: 'rloop-054-e2e-skeleton',
      },
      metricEmitter: {
        emit: async event => {
          telemetryEvents.push({metric: event.metric, value: event.value});
        },
      },
    });

    const totals = telemetryEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.metric] = (acc[event.metric] ?? 0) + event.value;
      return acc;
    }, {});

    const telemetryReport = {
      mode: config.mode,
      eventCount: telemetryEvents.length,
      totals: {
        github_api_attempt_count: totals.github_api_attempt_count ?? 0,
        github_api_rate_limit_hits: totals.github_api_rate_limit_hits ?? 0,
        publisher_idempotent_dedupe_count: totals.publisher_idempotent_dedupe_count ?? 0,
      },
    };

    const telemetryOut = process.env.RLOOP055_TELEMETRY_OUT;
    if (telemetryOut) {
      mkdirSync(dirname(telemetryOut), {recursive: true});
      writeFileSync(telemetryOut, JSON.stringify(telemetryReport, null, 2));
    }

    if (config.mode === 'dry') {
      expect(result.checkAction).toBe('dry_run');
      expect(github.createCheckRun).not.toHaveBeenCalled();
      expect(await artifactStore.exists({key: 'canary/nonprod/latest.json'})).toBe(false);
      return;
    }

    expect(result.checkAction === 'create' || result.checkAction === 'update').toBe(true);
    expect(github.createCheckRun.mock.calls.length + github.updateCheckRun.mock.calls.length).toBeGreaterThan(0);
    expect(telemetryReport.totals.github_api_attempt_count).toBeGreaterThan(0);
  });
});
