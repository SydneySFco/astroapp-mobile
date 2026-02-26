import type {CanaryPolicyMode} from './canaryCheckPublisher';

export type CanaryCheckPublisherRuntimeConfig = {
  policy: CanaryPolicyMode;
  checkName: string;
  stickyCommentEnabled: boolean;
};

export const DEFAULT_CANARY_CHECK_NAME = 'nonprod-db-canary / drift';

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }

  return fallback;
};

export const resolveCanaryCheckPublisherRuntimeConfig = (
  env: Record<string, string | undefined>,
): CanaryCheckPublisherRuntimeConfig => {
  const policy = env.CANARY_DRIFT_POLICY === 'fail' ? 'fail' : 'warn';
  const checkName = env.CANARY_CHECK_NAME?.trim() || DEFAULT_CANARY_CHECK_NAME;

  return {
    policy,
    checkName,
    stickyCommentEnabled: parseBoolean(env.CANARY_STICKY_COMMENT_ENABLED, true),
  };
};
