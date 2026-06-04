export interface RalphState {
  version?: number;
  active: boolean;
  iteration: number;
  minIterations: number;
  maxIterations: number;
  model: string;
  pid?: number;
  startedAt: string;
  noProgress?: number;
  completionPromise?: string;
  reviewGate?: {
    enabled: boolean;
    phase: string;
    quorumRequired: number;
    quorumTotal: number;
    votes: Array<{ voter: string; decision: string; reason?: string }>;
    rejectCycleCount: number;
  };
}

const KNOWN_VERSIONS = new Set([1, undefined]);

export function checkStateVersion(state: RalphState): string[] {
  const warnings: string[] = [];
  if (state.version !== undefined && !KNOWN_VERSIONS.has(state.version)) {
    warnings.push(`Unknown state file version: ${state.version}`);
  }
  return warnings;
}
