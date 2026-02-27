import type {QuarantineAdminErrorPayload} from './quarantineAdminErrors';
import {
  routeQuarantineAdminRequest,
  type QuarantineRouterDeps,
  type RouterRequest,
  type RouterResponse,
} from './quarantineAdminRouter';

export type RuntimeHttpRequest = {
  method: string;
  path: string;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, string | undefined>;
  auth?: {
    actorId?: string;
    roles?: string[];
  };
};

export type RuntimeHttpResponse = {
  status: number;
  body: unknown;
};

export type RuntimeRouteAdapter = {
  handle: (req: RuntimeHttpRequest) => Promise<RuntimeHttpResponse>;
};

const normalizeMethod = (method: string): RouterRequest['method'] =>
  method.toUpperCase() === 'POST' ? 'POST' : 'GET';

export const createQuarantineAdminRuntimeAdapter = (deps: QuarantineRouterDeps): RuntimeRouteAdapter => ({
  handle: async (req: RuntimeHttpRequest): Promise<RuntimeHttpResponse> => {
    const response: RouterResponse = await routeQuarantineAdminRequest(
      {
        method: normalizeMethod(req.method),
        path: req.path,
        params: req.params,
        query: req.query,
        body: req.body,
        headers: req.headers,
        context: {
          actorId: req.auth?.actorId,
          roles: req.auth?.roles,
        },
      },
      deps,
    );

    return {
      status: response.status,
      body: response.data,
    };
  },
});

/**
 * Sample runtime wiring (framework-agnostic pattern):
 *
 * const adapter = createQuarantineAdminRuntimeAdapter({readModel, repository});
 *
 * app.all('/admin/ops/reliability/quarantine*', async (req, res) => {
 *   const out = await adapter.handle({
 *     method: req.method,
 *     path: req.path,
 *     params: req.params,
 *     query: req.query,
 *     body: req.body,
 *     headers: req.headers as Record<string, string | undefined>,
 *     auth: {
 *       actorId: req.user?.id,
 *       roles: req.user?.roles,
 *     },
 *   });
 *
 *   res.status(out.status).json(out.body as QuarantineAdminErrorPayload | Record<string, unknown>);
 * });
 */
export type _SampleResponseType = QuarantineAdminErrorPayload | Record<string, unknown>;
