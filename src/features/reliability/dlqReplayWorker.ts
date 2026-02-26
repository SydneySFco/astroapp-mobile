import type {
  AlertChannelDispatcher,
  AlertChannelType,
  AlertDispatchEvent,
  DeadLetterQueueRecord,
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
  reschedule: (replayId: string, reason: string) => Promise<void>;
};

export type DlqReplayTelemetry = {
  replayTickAt: string;
  pulledCount: number;
  ackedCount: number;
  rescheduledCount: number;
  replaySuccessCount: number;
  replayFailureCount: number;
};

export const runDlqReplayTick = async (
  deps: {
    replayQueue: ReplayQueue;
    dispatchers: Record<AlertChannelType, AlertChannelDispatcher>;
    suppressionStore: SuppressionStore;
    deadLetterQueue: {enqueue: (record: DeadLetterQueueRecord) => Promise<void>};
    policy: DispatchWorkerPolicy;
    batchSize: number;
  },
): Promise<DlqReplayTelemetry> => {
  const items = await deps.replayQueue.pullBatch(Math.max(1, deps.batchSize));
  let ackedCount = 0;
  let rescheduledCount = 0;
  let replaySuccessCount = 0;
  let replayFailureCount = 0;

  for (const item of items) {
    const result = await runAlertDispatcherTick(item.event, {
      dispatchers: deps.dispatchers,
      suppressionStore: deps.suppressionStore,
      deadLetterQueue: deps.deadLetterQueue,
      policy: deps.policy,
    });

    if (result.dispatched || result.suppressed) {
      await deps.replayQueue.ack(item.replayId);
      ackedCount += 1;
      replaySuccessCount += 1;
      continue;
    }

    await deps.replayQueue.reschedule(item.replayId, 'replay_dispatch_failed');
    rescheduledCount += 1;
    replayFailureCount += 1;
  }

  return {
    replayTickAt: new Date().toISOString(),
    pulledCount: items.length,
    ackedCount,
    rescheduledCount,
    replaySuccessCount,
    replayFailureCount,
  };
};
