export type WatermarkStateRecord = {
  key: string;
  cursor?: string;
  updatedAt: string;
};

export type WatermarkStateStore = {
  get: (key: string) => Promise<WatermarkStateRecord | null>;
  set: (record: WatermarkStateRecord) => Promise<void>;
};

/**
 * File-backed state-store placeholder.
 *
 * Runtime/env layer should provide file IO callbacks.
 */
export class FileWatermarkStateStore implements WatermarkStateStore {
  public constructor(
    private readonly deps: {
      read: () => Promise<WatermarkStateRecord[] | null>;
      write: (records: WatermarkStateRecord[]) => Promise<void>;
    },
  ) {}

  public async get(key: string): Promise<WatermarkStateRecord | null> {
    const records = (await this.deps.read()) ?? [];
    return records.find(record => record.key === key) ?? null;
  }

  public async set(record: WatermarkStateRecord): Promise<void> {
    const records = (await this.deps.read()) ?? [];
    const next = records.filter(item => item.key !== record.key);
    next.push(record);
    await this.deps.write(next);
  }
}

/**
 * DB-backed placeholder.
 *
 * Expected backing table draft:
 * watermark_state(key text primary key, cursor text, updated_at timestamptz)
 */
export class DbWatermarkStateStorePlaceholder implements WatermarkStateStore {
  public constructor(
    private readonly deps: {
      selectByKey: (key: string) => Promise<WatermarkStateRecord | null>;
      upsert: (record: WatermarkStateRecord) => Promise<void>;
    },
  ) {}

  public async get(key: string): Promise<WatermarkStateRecord | null> {
    return this.deps.selectByKey(key);
  }

  public async set(record: WatermarkStateRecord): Promise<void> {
    await this.deps.upsert(record);
  }
}
