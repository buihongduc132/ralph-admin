export interface FleetInput {
  name: string;
  status: string;
  restarts: number;
  iteration: number;
  noProgress: number;
  progressPct: number;
  elapsedHours: number;
}

export interface DiagnosisEntry {
  name: string;
  reason: string;
}

export interface DiagnosisResult {
  crashLooping: DiagnosisEntry[];
  completedRunning: DiagnosisEntry[];
  stuck: DiagnosisEntry[];
  healthy: DiagnosisEntry[];
  stopped: DiagnosisEntry[];
}

export class Doctor {
  /** Pure logic: classify fleet inputs into diagnosis categories. */
  diagnose(inputs: FleetInput[]): DiagnosisResult {
    const result: DiagnosisResult = {
      crashLooping: [],
      completedRunning: [],
      stuck: [],
      healthy: [],
      stopped: [],
    };

    for (const proc of inputs) {
      // Stopped processes
      if (proc.status !== "online") {
        result.stopped.push({ name: proc.name, reason: `status=${proc.status}` });
        continue;
      }

      // Crash-looping: high restarts relative to elapsed time
      if (proc.restarts > 100 && proc.elapsedHours > 0) {
        const restartsPerHour = proc.restarts / proc.elapsedHours;
        if (restartsPerHour > 50) {
          result.crashLooping.push({
            name: proc.name,
            reason: `${proc.restarts} restarts in ${proc.elapsedHours.toFixed(1)}h`,
          });
          continue;
        }
      }

      // Completed-but-running: 100% progress + still iterating
      if (proc.progressPct >= 100) {
        result.completedRunning.push({
          name: proc.name,
          reason: `all tasks done, still iterating (i${proc.iteration})`,
        });
        continue;
      }

      // Stuck: high noProgress count
      if (proc.noProgress > 100) {
        result.stuck.push({
          name: proc.name,
          reason: `noProgress=${proc.noProgress} over ${proc.iteration} iterations`,
        });
        continue;
      }

      // Otherwise healthy
      result.healthy.push({
        name: proc.name,
        reason: `${proc.iteration} iterations, 0 restarts`,
      });
    }

    return result;
  }
}
