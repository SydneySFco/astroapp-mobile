export type AlertChannelType = 'slack' | 'webhook';

export type AlertDispatchEvent = {
  eventId: string;
  dedupKey: string;
  route: string;
  severity: 'warn' | 'critical';
  occurredAt: string;
  suppressionWindowMinutes: number;
  payload: Record<string, unknown>;
};

export type DispatchAttemptResult = {
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
};

export type AlertChannelDispatcher = {
  channel: AlertChannelType;
  dispatch: (event: AlertDispatchEvent) => Promise<DispatchAttemptResult>;
};

export type DeadLetterQueueRecord = {
  eventId: string;
  dedupKey: string;
  route: string;
  reason: string;
  attempts: number;
  failedAt: string;
};

export type DeadLetterQueue = {
  enqueue: (record: DeadLetterQueueRecord) => Promise<void>;
};

export type SuppressionStore = {
  getLastSentAt: (dedupKey: string) => Promise<string | null>;
  setLastSentAt: (dedupKey: string, sentAt: string) => Promise<void>;
};

export type DispatchWorkerPolicy = {
  maxAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
};

export type AlertDispatchMetrics = {
  dispatchSuccessCount: number;
  dispatchFailureCount: number;
  dispatchSuppressionHitCount: number;
};

export type AlertDispatchTickResult = {
  dispatched: boolean;
  suppressed: boolean;
  attempts: number;
  metrics: AlertDispatchMetrics;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const computeDispatchBackoffMs = (
  attempt: number,
  policy: DispatchWorkerPolicy,
): number => {
  const safeAttempt = Math.max(1, attempt);
  const exponential = policy.baseBackoffMs * 2 ** (safeAttempt - 1);
  return clamp(exponential, policy.baseBackoffMs, policy.maxBackoffMs);
};

const shouldSuppress = async (
  event: AlertDispatchEvent,
  suppressionStore: SuppressionStore,
): Promise<boolean> => {
  const lastSentAt = await suppressionStore.getLastSentAt(event.dedupKey);
  if (!lastSentAt) {
    return false;
  }

  const previous = new Date(lastSentAt).getTime();
  const current = new Date(event.occurredAt).getTime();
  if (Number.isNaN(previous) || Number.isNaN(current)) {
    return false;
  }

  const windowMs = Math.max(0, event.suppressionWindowMinutes) * 60_000;
  return current - previous < windowMs;
};

const inferChannel = (route: string): AlertChannelType =>
  route.startsWith('webhook://') ? 'webhook' : 'slack';

export const runAlertDispatcherTick = async (
  event: AlertDispatchEvent,
  deps: {
    dispatchers: Record<AlertChannelType, AlertChannelDispatcher>;
    suppressionStore: SuppressionStore;
    deadLetterQueue: DeadLetterQueue;
    policy: DispatchWorkerPolicy;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<AlertDispatchTickResult> => {
  const metrics: AlertDispatchMetrics = {
    dispatchSuccessCount: 0,
    dispatchFailureCount: 0,
    dispatchSuppressionHitCount: 0,
  };

  if (await shouldSuppress(event, deps.suppressionStore)) {
    metrics.dispatchSuppressionHitCount += 1;
    return {
      dispatched: false,
      suppressed: true,
      attempts: 0,
      metrics,
    };
  }

  const channel = inferChannel(event.route);
  const dispatcher = deps.dispatchers[channel];

  for (let attempt = 1; attempt <= deps.policy.maxAttempts; attempt += 1) {
    const result = await dispatcher.dispatch(event);
    if (result.success) {
      metrics.dispatchSuccessCount += 1;
      await deps.suppressionStore.setLastSentAt(event.dedupKey, new Date().toISOString());
      return {
        dispatched: true,
        suppressed: false,
        attempts: attempt,
        metrics,
      };
    }

    if (attempt < deps.policy.maxAttempts && deps.sleep) {
      await deps.sleep(computeDispatchBackoffMs(attempt, deps.policy));
    }
  }

  metrics.dispatchFailureCount += 1;
  await deps.deadLetterQueue.enqueue({
    eventId: event.eventId,
    dedupKey: event.dedupKey,
    route: event.route,
    reason: 'dispatch_failed_max_retries_exhausted',
    attempts: deps.policy.maxAttempts,
    failedAt: new Date().toISOString(),
  });

  return {
    dispatched: false,
    suppressed: false,
    attempts: deps.policy.maxAttempts,
    metrics,
  };
};

export const createSlackDispatcher = (
  dispatch: (event: AlertDispatchEvent) => Promise<DispatchAttemptResult>,
): AlertChannelDispatcher => ({
  channel: 'slack',
  dispatch,
});

export const createWebhookDispatcher = (
  dispatch: (event: AlertDispatchEvent) => Promise<DispatchAttemptResult>,
): AlertChannelDispatcher => ({
  channel: 'webhook',
  dispatch,
});
