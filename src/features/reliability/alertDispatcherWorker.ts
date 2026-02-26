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

export type DispatchErrorClassification = 'retryable' | 'fatal' | 'unknown';

export type DispatchAttemptResult = {
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
  errorClassification?: DispatchErrorClassification;
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
  lastErrorMessage?: string;
  lastErrorClassification?: DispatchErrorClassification;
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
  dispatchRetryCount: number;
};

export type DispatchAttemptTelemetry = {
  attempt: number;
  latencyMs: number;
  success: boolean;
  failureClassification?: DispatchErrorClassification;
};

export type AlertDispatchTickResult = {
  dispatched: boolean;
  suppressed: boolean;
  attempts: number;
  metrics: AlertDispatchMetrics;
  attemptTelemetry: DispatchAttemptTelemetry[];
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

export const classifyDispatchError = (
  result: DispatchAttemptResult,
): DispatchErrorClassification => {
  if (result.errorClassification) {
    return result.errorClassification;
  }

  if (typeof result.statusCode === 'number') {
    if (result.statusCode === 429 || result.statusCode >= 500) {
      return 'retryable';
    }

    if (result.statusCode >= 400) {
      return 'fatal';
    }
  }

  const message = result.errorMessage?.toLowerCase() ?? '';
  if (message.includes('timeout') || message.includes('temporar') || message.includes('network')) {
    return 'retryable';
  }

  return 'unknown';
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
    nowMs?: () => number;
  },
): Promise<AlertDispatchTickResult> => {
  const metrics: AlertDispatchMetrics = {
    dispatchSuccessCount: 0,
    dispatchFailureCount: 0,
    dispatchSuppressionHitCount: 0,
    dispatchRetryCount: 0,
  };
  const attemptTelemetry: DispatchAttemptTelemetry[] = [];
  const nowMs = deps.nowMs ?? Date.now;

  if (await shouldSuppress(event, deps.suppressionStore)) {
    metrics.dispatchSuppressionHitCount += 1;
    return {
      dispatched: false,
      suppressed: true,
      attempts: 0,
      metrics,
      attemptTelemetry,
    };
  }

  const channel = inferChannel(event.route);
  const dispatcher = deps.dispatchers[channel];
  let finalReason = 'dispatch_failed_max_retries_exhausted';
  let lastErrorMessage: string | undefined;
  let lastErrorClassification: DispatchErrorClassification = 'unknown';

  for (let attempt = 1; attempt <= deps.policy.maxAttempts; attempt += 1) {
    const startedAt = nowMs();
    const result = await dispatcher.dispatch(event);
    const latencyMs = Math.max(0, nowMs() - startedAt);

    if (result.success) {
      attemptTelemetry.push({
        attempt,
        latencyMs,
        success: true,
      });
      metrics.dispatchSuccessCount += 1;
      await deps.suppressionStore.setLastSentAt(event.dedupKey, new Date().toISOString());
      return {
        dispatched: true,
        suppressed: false,
        attempts: attempt,
        metrics,
        attemptTelemetry,
      };
    }

    const classification = classifyDispatchError(result);
    attemptTelemetry.push({
      attempt,
      latencyMs,
      success: false,
      failureClassification: classification,
    });

    lastErrorClassification = classification;
    lastErrorMessage = result.errorMessage;

    if (classification === 'fatal') {
      finalReason = 'dispatch_failed_fatal';
      break;
    }

    if (attempt < deps.policy.maxAttempts && deps.sleep) {
      metrics.dispatchRetryCount += 1;
      await deps.sleep(computeDispatchBackoffMs(attempt, deps.policy));
    }
  }

  metrics.dispatchFailureCount += 1;
  await deps.deadLetterQueue.enqueue({
    eventId: event.eventId,
    dedupKey: event.dedupKey,
    route: event.route,
    reason: finalReason,
    attempts: deps.policy.maxAttempts,
    failedAt: new Date().toISOString(),
    lastErrorMessage,
    lastErrorClassification,
  });

  return {
    dispatched: false,
    suppressed: false,
    attempts: deps.policy.maxAttempts,
    metrics,
    attemptTelemetry,
  };
};

export const createSlackTransportDispatcher = (
  dispatch: (event: AlertDispatchEvent) => Promise<DispatchAttemptResult>,
): AlertChannelDispatcher => ({
  channel: 'slack',
  dispatch,
});

export const createWebhookTransportDispatcher = (
  dispatch: (event: AlertDispatchEvent) => Promise<DispatchAttemptResult>,
): AlertChannelDispatcher => ({
  channel: 'webhook',
  dispatch,
});

// Backward-compatible names from RLOOP-040 draft.
export const createSlackDispatcher = createSlackTransportDispatcher;
export const createWebhookDispatcher = createWebhookTransportDispatcher;
