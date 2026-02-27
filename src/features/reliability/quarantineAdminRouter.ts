import {
  dropQuarantinedHandler,
  getQuarantinedDetailHandler,
  listQuarantinedHandler,
  redriveQuarantinedHandler,
  type QuarantineAdminRepository,
  type QuarantineControlPlaneReadModel,
} from './quarantineControlPlane';

export type RouterHttpMethod = 'GET' | 'POST';

export type RouterRequest = {
  method: RouterHttpMethod;
  path: string;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, string | undefined>;
  context?: {
    actorId?: string;
    roles?: string[];
  };
};

export type RouterResponse = {
  status: number;
  data: unknown;
};

export type QuarantineRouterDeps = {
  readModel: QuarantineControlPlaneReadModel;
  repository: QuarantineAdminRepository;
};

const normalizePath = (path: string): string => path.replace(/\/+$/, '') || '/';

const pathToReplayId = (path: string): string | undefined => {
  const normalized = normalizePath(path);
  const detail = normalized.match(/^\/admin\/ops\/reliability\/quarantine\/([^/]+)$/);
  if (detail?.[1]) {
    return decodeURIComponent(detail[1]);
  }

  const action = normalized.match(/^\/admin\/ops\/reliability\/quarantine\/([^/]+)\/(redrive|drop)$/);
  if (action?.[1]) {
    return decodeURIComponent(action[1]);
  }

  return undefined;
};

const readRequestId = (req: RouterRequest): string | undefined => {
  const fromBody = typeof req.body?.requestId === 'string' ? req.body.requestId.trim() : '';
  if (fromBody.length > 0) {
    return fromBody;
  }

  const fromIdempotency = req.headers?.['idempotency-key']?.trim();
  if (fromIdempotency) {
    return fromIdempotency;
  }

  const fromRequestId = req.headers?.['x-request-id']?.trim();
  return fromRequestId && fromRequestId.length > 0 ? fromRequestId : undefined;
};

export const routeQuarantineAdminRequest = async (
  req: RouterRequest,
  deps: QuarantineRouterDeps,
): Promise<RouterResponse> => {
  const path = normalizePath(req.path);

  if (req.method === 'GET' && path === '/admin/ops/reliability/quarantine') {
    return listQuarantinedHandler(
      {
        query: req.query,
        context: req.context,
      },
      {readModel: deps.readModel},
    );
  }

  if (req.method === 'GET' && /^\/admin\/ops\/reliability\/quarantine\/[^/]+$/.test(path)) {
    return getQuarantinedDetailHandler(
      {
        params: {replayId: req.params?.replayId ?? pathToReplayId(path) ?? ''},
        context: req.context,
      },
      {readModel: deps.readModel},
    );
  }

  if (req.method === 'POST' && /^\/admin\/ops\/reliability\/quarantine\/[^/]+\/redrive$/.test(path)) {
    return redriveQuarantinedHandler(
      {
        params: {replayId: req.params?.replayId ?? pathToReplayId(path) ?? ''},
        body: {
          ...req.body,
          requestId: readRequestId(req),
        },
        context: req.context,
      },
      {repository: deps.repository},
    );
  }

  if (req.method === 'POST' && /^\/admin\/ops\/reliability\/quarantine\/[^/]+\/drop$/.test(path)) {
    return dropQuarantinedHandler(
      {
        params: {replayId: req.params?.replayId ?? pathToReplayId(path) ?? ''},
        body: {
          ...req.body,
          requestId: readRequestId(req),
        },
        context: req.context,
      },
      {repository: deps.repository},
    );
  }

  return {
    status: 404,
    data: {error: 'Route not found'},
  };
};
