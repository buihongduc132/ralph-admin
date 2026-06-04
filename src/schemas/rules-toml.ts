export interface ModuloEntry { at: number; prompt: string; }
export interface ModuloRule { name: string; enabled: boolean; entries: ModuloEntry[]; }
export interface StateInjectionAnchor { max_prev: number; max_next: number; show_status?: boolean; reminder?: string; }
export interface RulesToml {
  rules: Record<string, ModuloRule>;
  state_injection?: { anchors: Record<string, StateInjectionAnchor> };
}
