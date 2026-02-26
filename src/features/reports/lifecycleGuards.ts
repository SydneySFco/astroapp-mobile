import {ReportLifecycleStatus} from './reportsApi';

export const lifecycleTransitionMatrix: Record<
  ReportLifecycleStatus,
  ReportLifecycleStatus[]
> = {
  queued: ['queued', 'processing'],
  processing: ['processing', 'ready'],
  ready: ['ready'],
};

export const isValidLifecycleTransition = (
  fromStatus: ReportLifecycleStatus,
  toStatus: ReportLifecycleStatus,
): boolean => lifecycleTransitionMatrix[fromStatus].includes(toStatus);

export type RealtimeEventClock = {
  updatedAt: number | null;
  version: number | null;
};

export type RealtimeEventMeta = {
  updatedAt?: string | null;
  version?: number | null;
};

const toMillis = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const shouldAcceptRealtimeEvent = (
  lastClock: RealtimeEventClock,
  incomingMeta: RealtimeEventMeta,
): boolean => {
  const incomingUpdatedAt = toMillis(incomingMeta.updatedAt);
  const incomingVersion = incomingMeta.version ?? null;

  if (
    incomingVersion !== null &&
    lastClock.version !== null &&
    incomingVersion < lastClock.version
  ) {
    return false;
  }

  if (
    incomingUpdatedAt !== null &&
    lastClock.updatedAt !== null &&
    incomingUpdatedAt < lastClock.updatedAt
  ) {
    return false;
  }

  return true;
};

export const getNextRealtimeClock = (
  previousClock: RealtimeEventClock,
  incomingMeta: RealtimeEventMeta,
): RealtimeEventClock => {
  const incomingUpdatedAt = toMillis(incomingMeta.updatedAt);
  const incomingVersion = incomingMeta.version ?? null;

  return {
    updatedAt:
      incomingUpdatedAt !== null
        ? Math.max(previousClock.updatedAt ?? 0, incomingUpdatedAt)
        : previousClock.updatedAt,
    version:
      incomingVersion !== null
        ? Math.max(previousClock.version ?? 0, incomingVersion)
        : previousClock.version,
  };
};
