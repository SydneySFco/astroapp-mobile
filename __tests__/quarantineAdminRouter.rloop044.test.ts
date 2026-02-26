import {routeQuarantineAdminRequest} from '../src/features/reliability/quarantineAdminRouter';

describe('RLOOP-044 quarantine admin router draft', () => {
  it('routes list endpoint', async () => {
    const response = await routeQuarantineAdminRequest(
      {
        method: 'GET',
        path: '/admin/ops/reliability/quarantine',
        query: {status: 'pending_review'},
        context: {roles: ['admin_ops']},
      },
      {
        readModel: {
          listQuarantined: jest.fn(async () => []),
          getQuarantinedDetail: jest.fn(),
        },
        repository: {
          redrive: jest.fn(),
          forceDrop: jest.fn(),
        },
      },
    );

    expect(response.status).toBe(200);
  });

  it('injects requestId from idempotency-key header for redrive/drop actions', async () => {
    const redrive = jest.fn(async input => ({
      replayId: input.replayId,
      status: 'redriven' as const,
      processedAt: '2026-02-26T14:45:00.000Z',
    }));

    await routeQuarantineAdminRequest(
      {
        method: 'POST',
        path: '/admin/ops/reliability/quarantine/r-1/redrive',
        headers: {'idempotency-key': 'idem-123'},
        body: {reason: 'manual', approvalRef: 'APR-44'},
        context: {roles: ['admin_approver'], actorId: 'ops-1'},
      },
      {
        readModel: {
          listQuarantined: jest.fn(),
          getQuarantinedDetail: jest.fn(),
        },
        repository: {
          redrive,
          forceDrop: jest.fn(),
        },
      },
    );

    expect(redrive).toHaveBeenCalledWith(
      expect.objectContaining({
        replayId: 'r-1',
        audit: expect.objectContaining({
          requestId: 'idem-123',
          actorId: 'ops-1',
        }),
      }),
    );
  });
});
