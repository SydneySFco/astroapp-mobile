import type {WatermarkStateStore} from './stateStore';

export type RuntimeSourceReadResult<Row extends Record<string, unknown>> = {
  rows: Row[];
  sourceWatermark?: string;
};

export type RuntimeSourceConnector<Row extends Record<string, unknown>> = {
  connectorType: 'db-view' | 'object-store';
  sourceUri: string;
  watermarkField: string;
  readSince: (cursor?: string) => Promise<RuntimeSourceReadResult<Row>>;
};

export type RuntimeConnectorRunResult<Row extends Record<string, unknown>> = {
  rows: Row[];
  cursorPrevious?: string;
  cursorCurrent?: string;
  persisted: boolean;
};

export const runConnectorRuntime = async <Row extends Record<string, unknown>>(
  connectorKey: string,
  connector: RuntimeSourceConnector<Row>,
  stateStore: WatermarkStateStore,
  now = new Date(),
): Promise<RuntimeConnectorRunResult<Row>> => {
  const existing = await stateStore.get(connectorKey);
  const cursorPrevious = existing?.cursor;

  const result = await connector.readSince(cursorPrevious);
  const cursorCurrent = result.sourceWatermark ?? cursorPrevious;

  let persisted = false;
  if (cursorCurrent && cursorCurrent !== cursorPrevious) {
    await stateStore.set({
      key: connectorKey,
      cursor: cursorCurrent,
      updatedAt: now.toISOString(),
    });
    persisted = true;
  }

  return {
    rows: result.rows,
    cursorPrevious,
    cursorCurrent,
    persisted,
  };
};

export const createDbViewConnector = <Row extends Record<string, unknown>>(
  config: {
    sourceUri: string;
    watermarkField: string;
    readSince: (cursor?: string) => Promise<RuntimeSourceReadResult<Row>>;
  },
): RuntimeSourceConnector<Row> => ({
  connectorType: 'db-view',
  sourceUri: config.sourceUri,
  watermarkField: config.watermarkField,
  readSince: config.readSince,
});

export const createObjectStoreConnector = <Row extends Record<string, unknown>>(
  config: {
    sourceUri: string;
    watermarkField: string;
    readSince: (cursor?: string) => Promise<RuntimeSourceReadResult<Row>>;
  },
): RuntimeSourceConnector<Row> => ({
  connectorType: 'object-store',
  sourceUri: config.sourceUri,
  watermarkField: config.watermarkField,
  readSince: config.readSince,
});
