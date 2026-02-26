import {appConfig} from './appConfig';

export type ApiEnvironment = 'local' | 'staging' | 'production';

type ApiConfig = {
  environment: ApiEnvironment;
  baseUrl: string;
  timeoutMs: number;
  defaultHeaders: Record<string, string>;
};

const DEFAULT_TIMEOUT_MS = 10000;

const apiEnvironmentByReleaseChannel: Record<string, ApiEnvironment> = {
  internal: 'staging',
  beta: 'staging',
  production: 'production',
};

const apiBaseUrls: Record<ApiEnvironment, string> = {
  local: 'http://10.0.2.2:8080',
  staging: 'https://staging.api.astroapp.example.com',
  production: 'https://api.astroapp.example.com',
};

const resolvedEnvironment =
  apiEnvironmentByReleaseChannel[appConfig.releaseChannel] ?? 'staging';

let runtimeBaseUrlOverride: string | null = null;

export const setApiRuntimeBaseUrl = (baseUrl: string | null) => {
  runtimeBaseUrlOverride = baseUrl;
};

export const getApiConfig = (): ApiConfig => ({
  environment: resolvedEnvironment,
  baseUrl: runtimeBaseUrlOverride ?? apiBaseUrls[resolvedEnvironment],
  timeoutMs: DEFAULT_TIMEOUT_MS,
  defaultHeaders: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-App-Version': appConfig.version,
    'X-App-Build': appConfig.build,
  },
});
