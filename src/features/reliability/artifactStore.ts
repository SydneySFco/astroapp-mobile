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

export type GitHubArtifactStoreConfig = {
  owner: string;
  repo: string;
  artifactNamePrefix: string;
  token: string;
};

/**
 * Draft adapter for GitHub-backed artifact persistence.
 *
 * This intentionally ships as a skeleton so we can freeze interfaces and
 * runtime wiring before introducing API-coupled implementation details.
 */
export class GitHubArtifactStore implements ArtifactStore {
  constructor(private readonly config: GitHubArtifactStoreConfig) {}

  public async read(pointer: ArtifactPointer): Promise<ArtifactReadResult | null> {
    if (!this.config.token || !pointer.key) {
      return null;
    }

    return null;
  }

  public async write(input: ArtifactWriteInput): Promise<void> {
    if (!this.config.token || !input.pointer.key) {
      throw new Error('GitHubArtifactStore.write requires token and pointer.key');
    }

    throw new Error('GitHubArtifactStore.write is not implemented yet');
  }

  public async exists(pointer: ArtifactPointer): Promise<boolean> {
    const result = await this.read(pointer);
    return result !== null;
  }
}
