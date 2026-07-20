export type PlanV1 = {
  schemaVersion: "1";
  chain: "anvil" | "solana-local";
  summary: string;
  steps: Array<Record<string, unknown>>;
};

export interface Planner {
  plan(input: { intent: string; policySummary: object; chainHint?: string | null }): Promise<PlanV1>;
}
