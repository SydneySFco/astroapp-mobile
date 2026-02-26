export type FaultHarnessExpectation = {
  scenario: string;
  stateAfter?: string;
  deduped?: boolean;
  gateRows?: number;
};

export type FaultHarnessParseResult = {
  ok: boolean;
  failures: string[];
};

const tryJson = (line: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const parseFaultHarnessOutput = (
  raw: string,
  expectations: FaultHarnessExpectation[],
): FaultHarnessParseResult => {
  const lines = raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const rows = lines.map(tryJson).filter((row): row is Record<string, unknown> => row !== null);
  const failures: string[] = [];

  for (const exp of expectations) {
    const match = rows.find(row => row.scenario === exp.scenario);
    if (!match) {
      failures.push(`missing scenario output: ${exp.scenario}`);
      continue;
    }

    if (exp.stateAfter !== undefined && match.state_after !== exp.stateAfter) {
      failures.push(
        `scenario ${exp.scenario}: expected state_after=${exp.stateAfter}, got=${String(match.state_after)}`,
      );
    }

    if (exp.gateRows !== undefined && Number(match.gate_rows) !== exp.gateRows) {
      failures.push(
        `scenario ${exp.scenario}: expected gate_rows=${exp.gateRows}, got=${String(match.gate_rows)}`,
      );
    }

    if (exp.deduped !== undefined) {
      const result = match.result as Record<string, unknown> | undefined;
      const deduped = result?.deduped;
      if (Boolean(deduped) !== exp.deduped) {
        failures.push(
          `scenario ${exp.scenario}: expected deduped=${String(exp.deduped)}, got=${String(deduped)}`,
        );
      }
    }
  }

  return {
    ok: failures.length === 0,
    failures,
  };
};
