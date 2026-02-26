import {
  runAlertDispatcherTick,
  runConnectorRuntime,
  type AlertDispatchEvent,
  type AlertDispatchTickResult,
  type WatermarkStateStore,
} from '../src/features/reliability';

describe('RLOOP-041 integration hardening', () => {
  it('advances connector cursor and persists watermark once source watermark moves', async () => {
    const state: Record<string, {cursor?: string; updatedAt: string}> = {
      'connector/orders': {
        cursor: '2026-02-25T10:00:00.000Z',
        updatedAt: '2026-02-25T10:00:00.000Z',
      },
    };

    const stateStore: WatermarkStateStore = {
      get: jest.fn(async key => {
        const record = state[key];
        return record ? {key, ...record} : null;
      }),
      set: jest.fn(async record => {
        state[record.key] = {cursor: record.cursor, updatedAt: record.updatedAt};
      }),
    };

    const result = await runConnectorRuntime(
      'connector/orders',
      {
        connectorType: 'db-view',
        sourceUri: 'postgres://analytics/read-model',
        watermarkField: 'updated_at',
        readSince: async cursor => ({
          rows: [{id: 'r-1', cursorSeen: cursor}],
          sourceWatermark: '2026-02-25T11:00:00.000Z',
        }),
      },
      stateStore,
      new Date('2026-02-25T11:00:01.000Z'),
    );

    expect(result.cursorPrevious).toBe('2026-02-25T10:00:00.000Z');
    expect(result.cursorCurrent).toBe('2026-02-25T11:00:00.000Z');
    expect(result.persisted).toBe(true);
    expect(stateStore.set).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'connector/orders',
        cursor: '2026-02-25T11:00:00.000Z',
      }),
    );
  });

  it('suppresses duplicate alert inside suppression window', async () => {
    const event: AlertDispatchEvent = {
      eventId: 'evt-1',
      dedupKey: 'dedup-1',
      route: 'slack://reliability-warn',
      severity: 'warn',
      occurredAt: '2026-02-26T10:30:00.000Z',
      suppressionWindowMinutes: 60,
      payload: {message: 'same issue'},
    };

    const slackDispatch = jest.fn().mockResolvedValue({success: true});

    const result: AlertDispatchTickResult = await runAlertDispatcherTick(event, {
      dispatchers: {
        slack: {channel: 'slack', dispatch: slackDispatch},
        webhook: {channel: 'webhook', dispatch: jest.fn()},
      },
      suppressionStore: {
        getLastSentAt: jest.fn().mockResolvedValue('2026-02-26T10:00:00.000Z'),
        setLastSentAt: jest.fn(),
      },
      deadLetterQueue: {enqueue: jest.fn()},
      policy: {
        maxAttempts: 3,
        baseBackoffMs: 100,
        maxBackoffMs: 500,
      },
    });

    expect(result.suppressed).toBe(true);
    expect(result.dispatched).toBe(false);
    expect(result.metrics.dispatchSuppressionHitCount).toBe(1);
    expect(result.attemptTelemetry).toEqual([]);
    expect(slackDispatch).not.toHaveBeenCalled();
  });

  it('retries with backoff and falls back to DLQ when delivery keeps failing', async () => {
    const event: AlertDispatchEvent = {
      eventId: 'evt-2',
      dedupKey: 'dedup-2',
      route: 'webhook://ops-alerts',
      severity: 'critical',
      occurredAt: '2026-02-26T11:00:00.000Z',
      suppressionWindowMinutes: 0,
      payload: {message: 'critical issue'},
    };

    const sleepCalls: number[] = [];
    const enqueue = jest.fn();
    const webhookDispatch = jest
      .fn()
      .mockResolvedValueOnce({success: false, statusCode: 503, errorMessage: 'temporary outage'})
      .mockResolvedValueOnce({success: false, statusCode: 429, errorMessage: 'rate limited'})
      .mockResolvedValueOnce({success: false, statusCode: 503, errorMessage: 'still failing'});

    const result = await runAlertDispatcherTick(event, {
      dispatchers: {
        slack: {channel: 'slack', dispatch: jest.fn()},
        webhook: {channel: 'webhook', dispatch: webhookDispatch},
      },
      suppressionStore: {
        getLastSentAt: jest.fn().mockResolvedValue(null),
        setLastSentAt: jest.fn(),
      },
      deadLetterQueue: {enqueue},
      policy: {
        maxAttempts: 3,
        baseBackoffMs: 100,
        maxBackoffMs: 1_000,
      },
      sleep: async ms => {
        sleepCalls.push(ms);
      },
    });

    expect(result.dispatched).toBe(false);
    expect(result.suppressed).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.metrics.dispatchRetryCount).toBe(2);
    expect(result.attemptTelemetry.map(item => item.failureClassification)).toEqual([
      'retryable',
      'retryable',
      'retryable',
    ]);
    expect(sleepCalls).toEqual([100, 200]);

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-2',
        reason: 'dispatch_failed_max_retries_exhausted',
        lastErrorClassification: 'retryable',
      }),
    );
  });
});
