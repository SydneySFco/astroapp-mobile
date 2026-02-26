import type {SupabaseClient} from '@supabase/supabase-js';

import {QuarantineAdminApiError} from '../src/features/reliability/quarantineAdminErrors';
import {createSupabaseQuarantineAdminRepository} from '../src/features/reliability/supabaseQuarantineControlPlane';

type RpcResult = {
  data: unknown;
  error: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null;
};

const createRpcClient = (impl: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>): SupabaseClient =>
  ({
    rpc: jest.fn(impl),
  } as unknown as SupabaseClient);

describe('RLOOP-047 RPC integration + failure-injection matrix', () => {
  const audit = {
    actorId: 'ops-1',
    reason: 'manual_review',
    approvalRef: 'APR-47',
    requestId: 'req-47-1',
  };

  it('handles first request as accepted and emits accepted metric', async () => {
    const emitted: Array<{outcome: string}> = [];
    const client = createRpcClient(async () => ({
      data: {
        replay_id: 'r-1',
        final_status: 'redriven',
        processed_at: '2026-02-26T15:00:00.000Z',
        deduped: false,
      },
      error: null,
    }));

    const repository = createSupabaseQuarantineAdminRepository(client, {
      metrics: {
        emit: event => emitted.push({outcome: event.dimensions.outcome}),
      },
    });

    const result = await repository.redrive({
      replayId: 'r-1',
      audit,
      note: 'first execution',
    });

    expect(result.status).toBe('redriven');
    expect(emitted).toEqual([{outcome: 'accepted'}]);
  });

  it('handles duplicate request as idempotent_duplicate and emits deduped metric', async () => {
    const emitted: Array<{outcome: string}> = [];
    const client = createRpcClient(async () => ({
      data: {
        replay_id: 'r-1',
        final_status: 'redriven',
        processed_at: '2026-02-26T15:01:00.000Z',
        deduped: true,
      },
      error: null,
    }));

    const repository = createSupabaseQuarantineAdminRepository(client, {
      metrics: {
        emit: event => emitted.push({outcome: event.dimensions.outcome}),
      },
    });

    await expect(
      repository.redrive({
        replayId: 'r-1',
        audit,
      }),
    ).rejects.toMatchObject<Partial<QuarantineAdminApiError>>({
      code: 'idempotent_duplicate',
      status: 409,
    });

    expect(emitted).toEqual([{outcome: 'deduped'}]);
  });

  it('maps stale and not_found database responses from RPC path', async () => {
    const staleClient = createRpcClient(async () => ({
      data: null,
      error: {
        code: 'P0001',
        message: 'stale transition',
      },
    }));
    const staleRepository = createSupabaseQuarantineAdminRepository(staleClient);

    await expect(
      staleRepository.forceDrop({
        replayId: 'r-stale',
        audit,
      }),
    ).rejects.toMatchObject<Partial<QuarantineAdminApiError>>({
      code: 'stale',
      status: 409,
    });

    const notFoundClient = createRpcClient(async () => ({
      data: null,
      error: {
        code: 'P0002',
        message: 'missing record',
      },
    }));
    const notFoundRepository = createSupabaseQuarantineAdminRepository(notFoundClient);

    await expect(
      notFoundRepository.redrive({
        replayId: 'r-missing',
        audit,
      }),
    ).rejects.toMatchObject<Partial<QuarantineAdminApiError>>({
      code: 'not_found',
      status: 404,
    });
  });

  it('failure injection: audit insert fail / state update fail map to internal_error and rejected metric', async () => {
    const emitted: string[] = [];
    const cases = [
      {code: 'XX001', message: 'audit insert failed: fk violation'},
      {code: 'XX002', message: 'state update failed: stale lock lease'},
    ];

    for (const entry of cases) {
      const client = createRpcClient(async () => ({
        data: null,
        error: {
          code: entry.code,
          message: entry.message,
          details: 'failure injection',
        },
      }));

      const repository = createSupabaseQuarantineAdminRepository(client, {
        metrics: {
          emit: event => emitted.push(event.dimensions.outcome),
        },
      });

      await expect(
        repository.forceDrop({
          replayId: `r-fail-${entry.code}`,
          audit,
        }),
      ).rejects.toMatchObject<Partial<QuarantineAdminApiError>>({
        code: 'internal_error',
        status: 500,
        details: expect.objectContaining({
          dbMessage: entry.message,
          sqlstate: entry.code,
        }),
      });
    }

    expect(emitted).toEqual(['rejected', 'rejected']);
  });

  it('metrics contract outcomes are emitted as accepted/deduped/stale_conflict/rejected', async () => {
    const emitted: string[] = [];
    const rpcQueue: RpcResult[] = [
      {
        data: {
          replay_id: 'r-acc',
          final_status: 'redriven',
          processed_at: '2026-02-26T15:02:00.000Z',
          deduped: false,
        },
        error: null,
      },
      {
        data: {
          replay_id: 'r-dedupe',
          final_status: 'redriven',
          processed_at: '2026-02-26T15:03:00.000Z',
          deduped: true,
        },
        error: null,
      },
      {
        data: null,
        error: {
          code: 'P0001',
          message: 'stale',
        },
      },
      {
        data: null,
        error: {
          code: 'P0002',
          message: 'not found',
        },
      },
    ];

    const client = createRpcClient(async () => rpcQueue.shift() ?? {data: null, error: {code: 'XX999', message: 'empty'}});
    const repository = createSupabaseQuarantineAdminRepository(client, {
      metrics: {
        emit: event => emitted.push(event.dimensions.outcome),
      },
    });

    await repository.redrive({replayId: 'r-acc', audit});
    await expect(repository.redrive({replayId: 'r-dedupe', audit})).rejects.toMatchObject({code: 'idempotent_duplicate'});
    await expect(repository.redrive({replayId: 'r-stale', audit})).rejects.toMatchObject({code: 'stale'});
    await expect(repository.redrive({replayId: 'r-reject', audit})).rejects.toMatchObject({code: 'not_found'});

    expect(emitted).toEqual(['accepted', 'deduped', 'stale_conflict', 'rejected']);
  });
});
