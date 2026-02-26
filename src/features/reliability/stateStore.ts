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

export type SupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{data: WatermarkStateDbRow | null; error: {message: string} | null}>;
      };
    };
    upsert: (
      row: WatermarkStateDbRow,
      options?: {onConflict?: string},
    ) => Promise<{error: {message: string} | null}>;
  };
};

export const createSupabaseWatermarkBindings = (
  supabase: SupabaseLikeClient,
  table = 'watermark_state',
): {
  fetchByKey: (key: string) => Promise<WatermarkStateDbRow | null>;
  upsertRow: (row: WatermarkStateDbRow) => Promise<void>;
} => ({
  fetchByKey: async key => {
    const {data, error} = await supabase
      .from(table)
      .select('key,cursor,updated_at')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      throw new Error(`watermark_fetch_failed:${error.message}`);
    }

    return data;
  },
  upsertRow: async row => {
    const {error} = await supabase.from(table).upsert(row, {onConflict: 'key'});
    if (error) {
      throw new Error(`watermark_upsert_failed:${error.message}`);
    }
  },
});

export type PostgresLikeClient = {
  query: <Row extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{rows: Row[]}>;
};

export const createPostgresWatermarkBindings = (
  pg: PostgresLikeClient,
  table = 'watermark_state',
): {
  fetchByKey: (key: string) => Promise<WatermarkStateDbRow | null>;
  upsertRow: (row: WatermarkStateDbRow) => Promise<void>;
} => ({
  fetchByKey: async key => {
    const result = await pg.query<WatermarkStateDbRow>(
      `select key, cursor, updated_at from ${table} where key = $1 limit 1`,
      [key],
    );
    return result.rows[0] ?? null;
  },
  upsertRow: async row => {
    await pg.query(
      `insert into ${table} (key, cursor, updated_at)
       values ($1, $2, $3)
       on conflict (key)
       do update set cursor = excluded.cursor, updated_at = excluded.updated_at`,
      [row.key, row.cursor, row.updated_at],
    );
  },
});

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
