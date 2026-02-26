import {parseFaultHarnessOutput} from '../src/features/reliability/faultHarnessOutcomeParser';

describe('RLOOP-048 fault harness output parser', () => {
  it('validates expected outcomes across happy + rollback scenarios', () => {
    const output = [
      JSON.stringify({
        scenario: 'happy_path',
        result: {replay_id: 'r-ok', final_status: 'redriven', deduped: false},
        state_after: 'redriven',
        audit_rows: 2,
      }),
      JSON.stringify({
        scenario: 'audit_insert_fail',
        state_after: 'pending_review',
        gate_rows: 0,
      }),
      JSON.stringify({
        scenario: 'state_transition_fail',
        state_after: 'pending_review',
        gate_rows: 0,
      }),
    ].join('\n');

    const parsed = parseFaultHarnessOutput(output, [
      {scenario: 'happy_path', stateAfter: 'redriven', deduped: false},
      {scenario: 'audit_insert_fail', stateAfter: 'pending_review', gateRows: 0},
      {scenario: 'state_transition_fail', stateAfter: 'pending_review', gateRows: 0},
    ]);

    expect(parsed.ok).toBe(true);
    expect(parsed.failures).toHaveLength(0);
  });
});
