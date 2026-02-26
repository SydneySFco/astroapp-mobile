export type GitHubRetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
};

export const DEFAULT_GITHUB_RETRY_POLICY: GitHubRetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
  jitterRatio: 0.2,
};

export type GitHubApiClientConfig = {
  owner: string;
  repo: string;
  token: string;
  baseUrl?: string;
  retryPolicy?: Partial<GitHubRetryPolicy>;
  fetchImpl?: typeof fetch;
};

export type GitHubIssueComment = {
  id: number;
  body: string;
  user?: {
    login?: string;
  };
};

export type GitHubCheckRun = {
  id: number;
  external_id?: string;
};

type GitHubRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT';
  body?: unknown;
  idempotencyKey?: string;
};

const mergeRetryPolicy = (policy: Partial<GitHubRetryPolicy> | undefined): GitHubRetryPolicy => ({
  ...DEFAULT_GITHUB_RETRY_POLICY,
  ...(policy ?? {}),
});

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), ms);
  });
};

const computeBackoffMs = (
  attempt: number,
  policy: GitHubRetryPolicy,
  retryAfterMs?: number,
  randomRatio = Math.random(),
): number => {
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(retryAfterMs, policy.maxDelayMs);
  }

  const base = Math.min(policy.baseDelayMs * 2 ** Math.max(0, attempt - 1), policy.maxDelayMs);
  const jitter = base * policy.jitterRatio * randomRatio;
  return Math.round(base + jitter);
};

const parseRetryAfterMs = (response: Response): number | undefined => {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const asSeconds = Number(retryAfter);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
      return Math.round(asSeconds * 1000);
    }

    const asDateMs = Date.parse(retryAfter);
    if (!Number.isNaN(asDateMs)) {
      return Math.max(0, asDateMs - Date.now());
    }
  }

  const rateResetSeconds = response.headers.get('x-ratelimit-reset');
  if (rateResetSeconds) {
    const value = Number(rateResetSeconds);
    if (Number.isFinite(value) && value > 0) {
      return Math.max(0, value * 1000 - Date.now());
    }
  }

  return undefined;
};

const isSecondaryRateLimit = async (response: Response): Promise<boolean> => {
  if (response.status !== 403) {
    return false;
  }

  const bodyText = await response.text();
  return bodyText.toLowerCase().includes('secondary rate limit');
};

const shouldRetryStatus = (status: number): boolean => status === 429 || status >= 500;

const resolveBuffer = (): {from: (input: string, encoding?: string) => {toString: (encoding?: string) => string}} | null => {
  const maybeBuffer = (globalThis as unknown as {Buffer?: {from: (input: string, encoding?: string) => {toString: (encoding?: string) => string}}}).Buffer;
  return maybeBuffer ?? null;
};

const encodeBase64 = (value: string): string => {
  const buffer = resolveBuffer();
  if (buffer) {
    return buffer.from(value, 'utf8').toString('base64');
  }

  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(value);
  }

  throw new Error('base64_encode_unsupported_runtime');
};

const decodeBase64 = (value: string): string => {
  const buffer = resolveBuffer();
  if (buffer) {
    return buffer.from(value, 'base64').toString('utf8');
  }

  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(value);
  }

  throw new Error('base64_decode_unsupported_runtime');
};

export class GitHubApiClient {
  private readonly baseUrl: string;
  private readonly retryPolicy: GitHubRetryPolicy;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: GitHubApiClientConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.github.com';
    this.retryPolicy = mergeRetryPolicy(config.retryPolicy);
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private buildRepoPath(path: string): string {
    return `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}${path}`;
  }

  private encodeContentPath(path: string): string {
    return path
      .split('/')
      .filter(Boolean)
      .map(segment => encodeURIComponent(segment))
      .join('/');
  }

  private async request<T>(path: string, options: GitHubRequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';

    for (let attempt = 1; attempt <= this.retryPolicy.maxAttempts; attempt += 1) {
      const response = await this.fetchImpl(this.buildRepoPath(path), {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.config.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(options.body !== undefined ? {'Content-Type': 'application/json'} : {}),
          ...(options.idempotencyKey ? {'X-Idempotency-Key': options.idempotencyKey} : {}),
        },
        ...(options.body !== undefined ? {body: JSON.stringify(options.body)} : {}),
      });

      if (response.ok) {
        if (response.status === 204) {
          return undefined as T;
        }
        return (await response.json()) as T;
      }

      const retryAfterMs = parseRetryAfterMs(response);
      const retryableByStatus = shouldRetryStatus(response.status);
      const secondaryLimit = await isSecondaryRateLimit(response.clone());
      const shouldRetry = retryableByStatus || secondaryLimit;

      if (!shouldRetry || attempt >= this.retryPolicy.maxAttempts) {
        throw new Error(`github_api_error:${response.status}:${method}:${path}`);
      }

      await sleep(computeBackoffMs(attempt, this.retryPolicy, retryAfterMs));
    }

    throw new Error(`github_api_error:max_attempts_exhausted:${method}:${path}`);
  }

  public async createCheckRun(payload: {
    name: string;
    head_sha: string;
    status: 'completed';
    conclusion: 'success' | 'neutral' | 'failure';
    completed_at: string;
    output: {
      title: string;
      summary: string;
      text?: string;
    };
    details_url?: string;
    external_id?: string;
  }): Promise<GitHubCheckRun> {
    return this.request<GitHubCheckRun>('/check-runs', {
      method: 'POST',
      body: payload,
      idempotencyKey: payload.external_id,
    });
  }

  public async updateCheckRun(
    checkRunId: number,
    payload: {
      conclusion: 'success' | 'neutral' | 'failure';
      completed_at: string;
      output: {
        title: string;
        summary: string;
        text?: string;
      };
      details_url?: string;
    },
  ): Promise<GitHubCheckRun> {
    return this.request<GitHubCheckRun>(`/check-runs/${checkRunId}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  public async listPullRequestComments(issueNumber: number): Promise<GitHubIssueComment[]> {
    return this.request<GitHubIssueComment[]>(`/issues/${issueNumber}/comments`);
  }

  public async createPullRequestComment(
    issueNumber: number,
    body: string,
    marker: string,
  ): Promise<GitHubIssueComment> {
    return this.request<GitHubIssueComment>(`/issues/${issueNumber}/comments`, {
      method: 'POST',
      body: {body},
      idempotencyKey: `comment:${issueNumber}:${marker}`,
    });
  }

  public async updatePullRequestComment(commentId: number, body: string): Promise<GitHubIssueComment> {
    return this.request<GitHubIssueComment>(`/issues/comments/${commentId}`, {
      method: 'PATCH',
      body: {body},
    });
  }

  public async getRepoContent(path: string, ref?: string): Promise<{content: string; sha: string} | null> {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    try {
      const response = await this.request<{content: string; sha: string}>(
        `/contents/${this.encodeContentPath(path)}${query}`,
      );
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes(':404:')) {
        return null;
      }
      throw error;
    }
  }

  public async putRepoContent(input: {
    path: string;
    message: string;
    content: string;
    sha?: string;
    branch?: string;
  }): Promise<void> {
    await this.request(`/contents/${this.encodeContentPath(input.path)}`, {
      method: 'PUT',
      body: {
        message: input.message,
        content: encodeBase64(input.content),
        sha: input.sha,
        branch: input.branch,
      },
      idempotencyKey: `artifact:${input.path}:${input.sha ?? 'create'}`,
    });
  }

  public decodeContent(content: string): string {
    const normalized = content.replace(/\n/g, '');
    return decodeBase64(normalized);
  }
}
