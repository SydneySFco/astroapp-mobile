import type {
  AlertChannelDispatcher,
  AlertChannelType,
  AlertDispatchEvent,
  DeadLetterQueueRecord,
  DispatchErrorClassification,
  DispatchWorkerPolicy,
  SuppressionStore,
} from './alertDispatcherWorker';
import {runAlertDispatcherTick} from './alertDispatcherWorker';

export type ReplayQueueItem = {
  replayId: string;
  event: AlertDispatchEvent;
  original: DeadLetterQueueRecord;
  replayCount: number;
  enqueuedAt: string;
};

export type ReplayQueue = {
  pullBatch: (limit: number) => Promise<ReplayQueueItem[]>;
  ack: (replayId: string) => Promise<void>;
  reschedule: (replayId: string, reason: string, delayMs?: number) => Promise<void>;
};

export type ReplayQuarantineRecord = {
  replayId: string;
  eventId: string;
  route: string;
  quarantineReason: string;
  replayCount: number;
  quarantinedAt: string;
  lastErrorClassification?: DispatchErrorClassification;
};

export type ReplayQuarantineStore = {
  quarantine: (record: ReplayQuarantineRecord) => Promise<void>;
};

export type ReplayPolicy = {
  maxReplayCount: number;
  baseReplayBackoffMs: number;
  maxReplayBackoffMs: number;
  jitterFactor: number;
};

export type DlqReplayTelemetry = {
  replayTickAt: string;
  pulledCount: number;
  ackedCount: number;
  rescheduledCount: number;
  quarantinedCount: number;
  replaySuccessCount: number;
  replayFailureCount: number;
  attemptLatencyMs: number[];
  failureClassificationTags: DispatchErrorClassification[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const computeReplayBackoffMs = (
  replayCount: number,
  policy: ReplayPolicy,
  random: () => number = Math.random,
): number => {
  const safeCount = Math.max(0, replayCount);
  const exponential = policy.baseReplayBackoffMs * 2 ** safeCount;
  const capped = clamp(exponential, policy.baseReplayBackoffMs, policy.maxReplayBackoffMs);

  const safeJitterFactor = clamp(policy.jitterFactor, 0, 1);
  const jitterRatio = 1 + (random() * 2 - 1) * safeJitterFactor;
  return Math.max(policy.baseReplayBackoffMs, Math.round(capped * jitterRatio));
};

export const runDlqReplayTick = async (
  deps: {
    replayQueue: ReplayQueue;
    dispatchers: Record<AlertChannelType, AlertChannelDispatcher>;
    suppressionStore: SuppressionStore;
    deadLetterQueue: {enqueue: (record: DeadLetterQueueRecord) => Promise<void>};
    quarantineStore: ReplayQuarantineStore;
    policy: DispatchWorkerPolicy;
    replayPolicy: ReplayPolicy;
    batchSize: number;
    random?: () => number;
  },
): Promise<DlqReplayTelemetry> => {
  const items = await deps.replayQueue.pullBatch(Math.max(1, deps.batchSize));
  let ackedCount = 0;
  let rescheduledCount = 0;
  let quarantinedCount = 0;
  let replaySuccessCount = 0;
  let replayFailureCount = 0;
  const attemptLatencyMs: number[] = [];
  const failureClassificationTags: DispatchErrorClassification[] = [];

  for (const item of items) {
    if (item.replayCount >= deps.replayPolicy.maxReplayCount) {
      await deps.quarantineStore.quarantine({
        replayId: item.replayId,
        eventId: item.event.eventId,
        route: item.event.route,
        quarantineReason: 'max_replay_cap_reached',
        replayCount: item.replayCount,
        quarantinedAt: new Date().toISOString(),
        lastErrorClassification: item.original.lastErrorClassification,
      });
      await deps.replayQueue.ack(item.replayId);
      ackedCount += 1;
      quarantinedCount += 1;
      replayFailureCount += 1;
      continue;
    }

    const result = await runAlertDispatcherTick(item.event, {
      dispatchers: deps.dispatchers,
      suppressionStore: deps.suppressionStore,
      deadLetterQueue: deps.deadLetterQueue,
      policy: deps.policy,
    });

    for (const attempt of result.attemptTelemetry) {
      attemptLatencyMs.push(attempt.latencyMs);
      if (attempt.failureClassification) {
        failureClassificationTags.push(attempt.failureClassification);
      }
    }

    if (result.dispatched || result.suppressed) {
      await deps.replayQueue.ack(item.replayId);
      ackedCount += 1;
      replaySuccessCount += 1;
      continue;
    }

    const latestClassification =
      result.attemptTelemetry[result.attemptTelemetry.length - 1]?.failureClassification ??
      item.original.lastErrorClassification;

    if (latestClassification === 'fatal') {
      await deps.quarantineStore.quarantine({
        replayId: item.replayId,
        eventId: item.event.eventId,
        route: item.event.route,
        quarantineReason: 'poison_message_fatal_error',
        replayCount: item.replayCount + 1,
        quarantinedAt: new Date().toISOString(),
        lastErrorClassification: latestClassification,
      });
      await deps.replayQueue.ack(item.replayId);
      ackedCount += 1;
      quarantinedCount += 1;
      replayFailureCount += 1;
      continue;
    }

    const delayMs = computeReplayBackoffMs(
      item.replayCount,
      deps.replayPolicy,
      deps.random ?? Math.random,
    );
    await deps.replayQueue.reschedule(item.replayId, 'replay_dispatch_failed_retryable', delayMs);
    rescheduledCount += 1;
    replayFailureCount += 1;
  }

  return {
    replayTickAt: new Date().toISOString(),
    pulledCount: items.length,
    ackedCount,
    rescheduledCount,
    quarantinedCount,
    replaySuccessCount,
    replayFailureCount,
    attemptLatencyMs,
    failureClassificationTags,
  };
};
