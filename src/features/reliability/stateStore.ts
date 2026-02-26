export type WatermarkStateRecord = {
  key: string;
  cursor?: string;
  updatedAt: string;
};

export type WatermarkStateStore = {
  get: (key: string) => Promise<WatermarkStateRecord | null>;
  set: (record: WatermarkStateRecord) => Promise<void>;
};

export type WatermarkStateDbRow = {
  key: string;
  cursor: string | null;
  updated_at: string;
};

const toRecord = (row: WatermarkStateDbRow): WatermarkStateRecord => ({
  key: row.key,
  cursor: row.cursor ?? undefined,
  updatedAt: row.updated_at,
});

const toRow = (record: WatermarkStateRecord): WatermarkStateDbRow => ({
  key: record.key,
  cursor: record.cursor ?? null,
  updated_at: record.updatedAt,
});

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

/**
 * Supabase/Postgres-friendly adapter skeleton.
 *
 * Infra layer can bind this to Supabase JS or pg driver with the same callbacks.
 */
export class SqlWatermarkStateStoreAdapter implements WatermarkStateStore {
  public constructor(
    private readonly deps: {
      fetchByKey: (key: string) => Promise<WatermarkStateDbRow | null>;
      upsertRow: (row: WatermarkStateDbRow) => Promise<void>;
    },
  ) {}

  public async get(key: string): Promise<WatermarkStateRecord | null> {
    const row = await this.deps.fetchByKey(key);
    return row ? toRecord(row) : null;
  }

  public async set(record: WatermarkStateRecord): Promise<void> {
    await this.deps.upsertRow(toRow(record));
  }
}

export const createSupabaseWatermarkStateStore = (
  deps: {
    fetchByKey: (key: string) => Promise<WatermarkStateDbRow | null>;
    upsertRow: (row: WatermarkStateDbRow) => Promise<void>;
  },
): WatermarkStateStore => new SqlWatermarkStateStoreAdapter(deps);

export const createPostgresWatermarkStateStore = (
  deps: {
    fetchByKey: (key: string) => Promise<WatermarkStateDbRow | null>;
    upsertRow: (row: WatermarkStateDbRow) => Promise<void>;
  },
): WatermarkStateStore => new SqlWatermarkStateStoreAdapter(deps);
