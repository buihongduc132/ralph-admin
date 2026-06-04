export type TaskStatus = "pending" | "in_progress" | "tested" | "fully_works";

export interface InventoryTask {
  status: TaskStatus;
  description?: string;
  problem_notes?: string;
}

export interface InventoryPhase {
  status?: string;
  gate?: string;
  tasks: Record<string, InventoryTask>;
}

export interface Inventory {
  lastUpdated: string;
  currentPhase: string;
  phases: Record<string, InventoryPhase>;
}
