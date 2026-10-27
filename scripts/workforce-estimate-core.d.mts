export const SOURCE_HEADERS: Readonly<Record<string, readonly string[]>>;
export const ANONYMIZED_HEADERS: Readonly<Record<string, readonly string[]>>;
export const CONCEPT_CODES: ReadonlySet<string>;
export const UNIT_CODES: ReadonlySet<string>;

export function parseCsv(text: string, file?: string): Record<string, string>[];
export function parseCsvTable(text: string, expectedHeaders: readonly string[], file?: string): Record<string, string>[];
export function serializeCsv(headers: readonly string[], rows: readonly Record<string, string | null | undefined>[]): string;
export function pseudonymizeId(key: Buffer, namespace: string, value: string): string;
export function anonymizeWorkforceTables(tables: Record<string, string>, key: Buffer): Record<string, string>;
export function calculateWorkforceEstimate(
  tables: Record<string, string>,
  options: { cutoff: string; timezone: string },
): {
  cutoff: string;
  timezone: string;
  localDate: string;
  activePeople: number;
  taskCount: number;
  taskAssignmentCount: number;
  tasksByStatus: Record<string, number>;
  today: {
    completedTasksStillCompletedAtCutoff: number;
    completionEvents: number;
    distinctTasksWithCompletionEvent: number;
    reopenEvents: number;
    distinctTasksReopened: number;
    operationalMovementCount: number;
    operationalQuantityByUnit: { unit: string; quantity: string }[];
  };
};
