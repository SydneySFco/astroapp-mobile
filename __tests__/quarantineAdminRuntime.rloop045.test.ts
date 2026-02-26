import {createQuarantineAdminRuntimeAdapter} from '../src/features/reliability/quarantineAdminRuntime';

describe('RLOOP-045 quarantine admin runtime adapter', () => {
  it('binds runtime request to router contract', async () => {
    const adapter = createQuarantineAdminRuntimeAdapter({
      readModel: {
        listQuarantined: jest.fn(async () => []),
        getQuarantinedDetail: jest.fn(),
      },
      repository: {
        redrive: jest.fn(),
        forceDrop: jest.fn(),
      },
    });

    const out = await adapter.handle({
      method: 'GET',
      path: '/admin/ops/reliability/quarantine',
      query: {status: 'pending_review'},
      auth: {actorId: 'ops-1', roles: ['admin_ops']},
    });

    expect(out.status).toBe(200);
  });
});
