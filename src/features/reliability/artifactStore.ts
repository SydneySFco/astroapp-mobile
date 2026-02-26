import {GitHubApiClient, type GitHubApiClientConfig} from './githubApi';

export type ArtifactPointer = {
  key: string;
  runId?: string;
};

export type ArtifactReadResult = {
  pointer: ArtifactPointer;
  content: string;
  contentType?: string;
  fetchedAt: string;
};

export type ArtifactWriteInput = {
  pointer: ArtifactPointer;
  content: string;
  contentType?: string;
  metadata?: Record<string, string>;
};

export interface ArtifactStore {
  read(pointer: ArtifactPointer): Promise<ArtifactReadResult | null>;
  write(input: ArtifactWriteInput): Promise<void>;
  exists(pointer: ArtifactPointer): Promise<boolean>;
}

export type GitHubArtifactStoreConfig = GitHubApiClientConfig & {
  artifactNamePrefix: string;
  branch?: string;
};

const buildArtifactPath = (prefix: string, pointer: ArtifactPointer): string => {
  const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const normalizedKey = pointer.key.replace(/^\/+/, '');
  return `${normalizedPrefix}/${normalizedKey}`;
};

export class GitHubArtifactStore implements ArtifactStore {
  private readonly client: GitHubApiClient;

  constructor(private readonly config: GitHubArtifactStoreConfig) {
    this.client = new GitHubApiClient(config);
  }

  public async read(pointer: ArtifactPointer): Promise<ArtifactReadResult | null> {
    if (!this.config.token || !pointer.key) {
      return null;
    }

    const path = buildArtifactPath(this.config.artifactNamePrefix, pointer);
    const file = await this.client.getRepoContent(path, this.config.branch);
    if (!file) {
      return null;
    }

    return {
      pointer,
      content: this.client.decodeContent(file.content),
      contentType: 'application/json',
      fetchedAt: new Date().toISOString(),
    };
  }

  public async write(input: ArtifactWriteInput): Promise<void> {
    if (!this.config.token || !input.pointer.key) {
      throw new Error('GitHubArtifactStore.write requires token and pointer.key');
    }

    const path = buildArtifactPath(this.config.artifactNamePrefix, input.pointer);
    const existing = await this.client.getRepoContent(path, this.config.branch);

    await this.client.putRepoContent({
      path,
      message: `[canary-artifact] upsert ${input.pointer.key}`,
      content: input.content,
      sha: existing?.sha,
      branch: this.config.branch,
    });
  }

  public async exists(pointer: ArtifactPointer): Promise<boolean> {
    const result = await this.read(pointer);
    return result !== null;
  }
}
