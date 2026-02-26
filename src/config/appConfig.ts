export const appConfig = {
  appName: 'AstroApp',
  version: '0.1.0',
  build: 'RLOOP-008',
  releaseChannel: 'internal',
} as const;

export const appBuildLabel = `${appConfig.version} (${appConfig.build})`;
