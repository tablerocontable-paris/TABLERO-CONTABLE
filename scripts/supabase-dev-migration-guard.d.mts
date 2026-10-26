export type MigrationPhase = "baseline_001_014" | "apply_015" | "apply_016";
export const MIGRATIONS: ReadonlyArray<readonly [string, string]>;
export const BASELINE_COUNT: number;
export function verifyMigrationFiles(root: string): Promise<void>;
export function createStage(root: string, stageRoot: string, phase: MigrationPhase): Promise<{ stageRoot: string; localVersions: string[] }>;
export function validateHistory(payload: unknown, phase: MigrationPhase, state?: "before" | "after"): { local: number; remote: number };
export function validateDryRun(text: string, phase: MigrationPhase): string[];
export function verifySql015ReviewAcceptance(root: string): Promise<void>;
export function verifySql016ReviewAcceptance(root: string): Promise<void>;
