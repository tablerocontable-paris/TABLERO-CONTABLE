declare const contract: {
  percentile(values: number[], p: number): number | null;
  evaluateBenchmark(input: { samples: number[]; pageErrors?: string[]; apiCalls?: string[]; provenanceError?: string | null }): { passed: boolean; p95Ms: number | null; reasons: string[] };
  validateFixture(state: unknown): { passed: boolean; errors: string[] };
  evaluateIsolatedRun(input: { processStatus: number | null; report: any; expectedPattern: string }): { passed: boolean; counts: { executed: number; passed: number; skipped: number; failed: number }; matched: Array<{ name: string; status: string }>; reasons: string[] };
  effectiveTreeHash(root: string, excludedPrefixes?: string[]): { sha256: string; fileCount: number; algorithm: string };
};
export = contract;
