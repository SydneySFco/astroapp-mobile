import {
  computeQuarantineRates,
  createQuarantineAdminMetricEvent,
  dropQuarantinedHandler,
  getQuarantinedDetailHandler,
  listQuarantinedHandler,
  mapActionErrorToMetricOutcome,
  redriveQuarantinedHandler,
} from '../src/features/reliability/quarantineControlPlane';
import {QuarantineAdminApiError} from '../src/features/reliability/quarantineAdminErrors';

describe('RLOOP-043 quarantine control plane skeleton', () => {
  it('lists quarantined records for admin roles', async () => {
    const response = await listQuarantinedHandler(
      {
        query: {status: 'pending_review', limit: 20, offset: 0},
        context: {roles: ['admin_ops']},
      },
      {
        readModel: {
          listQuarantined: jest.fn(async () => [
            {
              replayId: 'r-1',
              eventId: 'evt-1',
              route: 'webhook://ops',
              status: 'pending_review',
              quarantineReason: 'max_replay_cap_reached',
              replayCount: 5,
              failedAt: '2026-02-26T11:00:00.000Z',
              quarantinedAt: '2026-02-26T12:00:00.000Z',
              lastErrorClassification: 'retryable',
              lastErrorMessage: 'temp 503',
              reviewedAt: null,
              reviewedBy: null,
            },
          ]),
          getQuarantinedDetail: jest.fn(),
        },
      },
    );

    expect(response.status).toBe(200);
    if ('items' in response.data) {
      expect(response.data.items[0]?.replayId).toBe('r-1');
    }
  });

  it('returns quarantine detail by replayId', async () => {
    const response = await getQuarantinedDetailHandler(
      {
        params: {replayId: 'r-1'},
        context: {roles: ['admin_approver']},
      },
      {
        readModel: {
          listQuarantined: jest.fn(),
          getQuarantinedDetail: jest.fn(async () => ({
            replayId: 'r-1',
            eventId: 'evt-1',
            route: 'webhook://ops',
            status: 'pending_review',
            quarantineReason: 'poison_message_fatal_error',
            replayCount: 3,
            failedAt: '2026-02-26T11:10:00.000Z',
            quarantinedAt: '2026-02-26T12:00:00.000Z',
            lastErrorClassification: 'fatal',
            lastErrorMessage: 'bad payload',
            reviewedAt: null,
            reviewedBy: null,
            dedupKey: 'dedup-1',
            payload: {message: 'x'},
            headers: {'x-correlation-id': 'corr-1'},
            originalDeadLetter: {attempts: 3},
            auditTrail: [],
          })),
        },
      },
    );

    expect(response.status).toBe(200);
    if ('item' in response.data) {
      expect(response.data.item.status).toBe('pending_review');
    }
  });

  it('requires audit fields for redrive/drop actions', async () => {
    const redrive = await redriveQuarantinedHandler(
      {
        params: {replayId: 'r-2'},
        body: {reason: 'manual review'},
        context: {roles: ['admin_approver'], actorId: 'ops-1'},
      },
      {
        repository: {
          redrive: jest.fn(),
          forceDrop: jest.fn(),
        },
      },
    );

    expect(redrive.status).toBe(400);
    if ('error' in redrive.data) {
      expect(redrive.data.error.code).toBe('bad_request');
    }

    const drop = await dropQuarantinedHandler(
      {
        params: {replayId: 'r-2'},
        body: {reason: 'irrelevant', approvalRef: 'APR-42'},
        context: {roles: ['admin_approver'], actorId: 'ops-1'},
      },
      {
        repository: {
          redrive: jest.fn(),
          forceDrop: jest.fn(async () => ({
            replayId: 'r-2',
            status: 'dropped',
            processedAt: '2026-02-26T12:40:00.000Z',
          })),
        },
      },
    );

    expect(drop.status).toBe(202);
    if ('status' in drop.data) {
      expect(drop.data.status).toBe('dropped');
    }
  });

  it('maps stale/not_found/idempotent_duplicate repository errors to final HTTP status', async () => {
    const stale = await redriveQuarantinedHandler(
      {
        params: {replayId: 'r-stale'},
        body: {reason: 'manual', approvalRef: 'APR-1'},
        context: {roles: ['admin_approver'], actorId: 'ops-1'},
      },
      {
        repository: {
          redrive: jest.fn(async () => {
            throw new QuarantineAdminApiError({
              code: 'stale',
              status: 409,
              message: 'stale',
            });
          }),
          forceDrop: jest.fn(),
        },
      },
    );

    expect(stale.status).toBe(409);

    const notFound = await dropQuarantinedHandler(
      {
        params: {replayId: 'r-missing'},
        body: {reason: 'manual', approvalRef: 'APR-2'},
        context: {roles: ['admin_approver'], actorId: 'ops-1'},
      },
      {
        repository: {
          redrive: jest.fn(),
          forceDrop: jest.fn(async () => {
            throw new QuarantineAdminApiError({
              code: 'not_found',
              status: 404,
              message: 'missing',
            });
          }),
        },
      },
    );

    expect(notFound.status).toBe(404);

    const dedup = await redriveQuarantinedHandler(
      {
        params: {replayId: 'r-dupe'},
        body: {reason: 'manual', approvalRef: 'APR-3', requestId: 'idem-1'},
        context: {roles: ['admin_approver'], actorId: 'ops-1'},
      },
      {
        repository: {
          redrive: jest.fn(async () => {
            throw new QuarantineAdminApiError({
              code: 'idempotent_duplicate',
              status: 409,
              message: 'duplicate',
            });
          }),
          forceDrop: jest.fn(),
        },
      },
    );

    expect(dedup.status).toBe(409);
    if ('error' in dedup.data) {
      expect(dedup.data.error.code).toBe('idempotent_duplicate');
    }
  });

  it('computes redrive/drop rates for observability', () => {
    const rates = computeQuarantineRates({
      quarantinedCount: 20,
      redrivenCount: 12,
      droppedCount: 3,
    });

    expect(rates.redriveSuccessRate).toBeCloseTo(0.6);
    expect(rates.dropRate).toBeCloseTo(0.15);
  });

  it('builds admin action metric payload with action/outcome/reason dimensions', () => {
    const metric = createQuarantineAdminMetricEvent({
      action: 'redrive',
      outcome: 'accepted',
      reason: 'approved_by_oncall',
      replayId: 'r-5',
      requestId: 'req-1',
      observedAt: '2026-02-26T14:40:00.000Z',
    });

    expect(metric.metric).toBe('replay_quarantine_admin_action_total');
    expect(metric.dimensions).toEqual({
      action: 'redrive',
      outcome: 'accepted',
      reason: 'approved_by_oncall',
    });
    expect(metric.requestId).toBe('req-1');
  });

  it('maps error code to observability outcomes', () => {
    expect(mapActionErrorToMetricOutcome('idempotent_duplicate')).toBe('deduped');
    expect(mapActionErrorToMetricOutcome('stale')).toBe('stale_conflict');
    expect(mapActionErrorToMetricOutcome('unauthorized')).toBe('rejected');
  });
});
