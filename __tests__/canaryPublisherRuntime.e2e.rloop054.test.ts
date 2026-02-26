import {readFileSync} from 'fs';

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
    });

    if (config.mode === 'dry') {
      expect(result.checkAction).toBe('dry_run');
      expect(github.createCheckRun).not.toHaveBeenCalled();
      expect(await artifactStore.exists({key: 'canary/nonprod/latest.json'})).toBe(false);
      return;
    }

    expect(result.checkAction === 'create' || result.checkAction === 'update').toBe(true);
    expect(github.createCheckRun.mock.calls.length + github.updateCheckRun.mock.calls.length).toBeGreaterThan(0);
  });
});
