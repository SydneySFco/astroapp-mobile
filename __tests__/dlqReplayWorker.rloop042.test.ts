import {runDlqReplayTick, type ReplayQueueItem} from '../src/features/reliability/dlqReplayWorker';
import type {AlertDispatchEvent, DeadLetterQueueRecord} from '../src/features/reliability';

const makeEvent = (id: string): AlertDispatchEvent => ({
  eventId: id,
  dedupKey: `dedup-${id}`,
  route: 'webhook://ops-alerts',
  severity: 'critical',
  occurredAt: '2026-02-26T11:00:00.000Z',
  suppressionWindowMinutes: 0,
  payload: {message: 'critical issue'},
});

const makeOriginal = (): DeadLetterQueueRecord => ({
  eventId: 'evt-orig',
  dedupKey: 'dedup-orig',
  route: 'webhook://ops-alerts',
  reason: 'dispatch_failed_max_retries_exhausted',
  attempts: 3,
  failedAt: '2026-02-26T11:00:00.000Z',
  lastErrorClassification: 'retryable',
});

describe('RLOOP-042 replay policy hardening', () => {
  it('reschedules retryable replay with jittered backoff delay', async () => {
    const items: ReplayQueueItem[] = [
      {
        replayId: 'r-1',
        event: makeEvent('evt-1'),
        original: makeOriginal(),
        replayCount: 2,
        enqueuedAt: '2026-02-26T12:00:00.000Z',
      },
    ];

    const reschedule = jest.fn();
    const telemetry = await runDlqReplayTick({
      replayQueue: {
        pullBatch: jest.fn(async () => items),
        ack: jest.fn(),
        reschedule,
      },
      dispatchers: {
        slack: {channel: 'slack', dispatch: jest.fn()},
        webhook: {
          channel: 'webhook',
          dispatch: jest
            .fn()
            .mockResolvedValueOnce({success: false, statusCode: 503, errorMessage: 'temp'})
            .mockResolvedValueOnce({success: false, statusCode: 503, errorMessage: 'temp'})
            .mockResolvedValueOnce({success: false, statusCode: 503, errorMessage: 'temp'}),
        },
      },
      suppressionStore: {
        getLastSentAt: jest.fn(async () => null),
        setLastSentAt: jest.fn(),
      },
      deadLetterQueue: {enqueue: jest.fn()},
      quarantineStore: {quarantine: jest.fn()},
      policy: {
        maxAttempts: 3,
        baseBackoffMs: 10,
        maxBackoffMs: 100,
      },
      replayPolicy: {
        maxReplayCount: 5,
        baseReplayBackoffMs: 1_000,
        maxReplayBackoffMs: 10_000,
        jitterFactor: 0.2,
      },
      batchSize: 10,
      random: () => 0.75,
    });

    expect(reschedule).toHaveBeenCalledWith(
      'r-1',
      'replay_dispatch_failed_retryable',
      expect.any(Number),
    );
    const delay = reschedule.mock.calls[0][2] as number;
    expect(delay).toBeGreaterThanOrEqual(3200);
    expect(delay).toBeLessThanOrEqual(4800);
    expect(telemetry.failureClassificationTags).toContain('retryable');
  });

  it('quarantines poison messages when max replay cap is reached', async () => {
    const quarantine = jest.fn();
    const ack = jest.fn();

    await runDlqReplayTick({
      replayQueue: {
        pullBatch: jest.fn(async () => [
          {
            replayId: 'r-2',
            event: makeEvent('evt-2'),
            original: makeOriginal(),
            replayCount: 5,
            enqueuedAt: '2026-02-26T12:00:00.000Z',
          },
        ]),
        ack,
        reschedule: jest.fn(),
      },
      dispatchers: {
        slack: {channel: 'slack', dispatch: jest.fn()},
        webhook: {channel: 'webhook', dispatch: jest.fn()},
      },
      suppressionStore: {
        getLastSentAt: jest.fn(async () => null),
        setLastSentAt: jest.fn(),
      },
      deadLetterQueue: {enqueue: jest.fn()},
      quarantineStore: {quarantine},
      policy: {
        maxAttempts: 3,
        baseBackoffMs: 10,
        maxBackoffMs: 100,
      },
      replayPolicy: {
        maxReplayCount: 5,
        baseReplayBackoffMs: 1_000,
        maxReplayBackoffMs: 10_000,
        jitterFactor: 0.2,
      },
      batchSize: 10,
    });

    expect(quarantine).toHaveBeenCalledWith(
      expect.objectContaining({
        replayId: 'r-2',
        quarantineReason: 'max_replay_cap_reached',
      }),
    );
    expect(ack).toHaveBeenCalledWith('r-2');
  });
});
