// Abstract design model. This does not run SQL or prove PostgreSQL/MVCC behavior.
export type Lock = readonly [tier: number, key: number];
const name = ([tier, key]: Lock) => `${tier}:${key}`;

export function orderedTrace(locks: Lock[]): Lock[] {
  return [...new Map(locks.map((lock) => [name(lock), lock])).values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// Explore every enabled acquisition/commit interleaving; commits release all locks.
// A state with unfinished transactions and no enabled step is a wait cycle.
export function explore(traces: Lock[][]) {
  const visited = new Set<string>();
  let deadlock: number[] | null = null;
  function visit(pc: number[]) {
    const state = pc.join(',');
    if (visited.has(state)) return;
    visited.add(state);
    const owners = new Map<string, number>();
    for (let i = 0; i < traces.length; i++) {
      if (pc[i] > traces[i].length) continue;
      for (const lock of traces[i].slice(0, pc[i])) {
        const key = name(lock), owner = owners.get(key);
        if (owner !== undefined && owner !== i) throw new Error('Invalid simultaneous ownership');
        owners.set(key, i);
      }
    }
    let enabled = false, unfinished = false;
    for (let i = 0; i < traces.length; i++) {
      if (pc[i] > traces[i].length) continue;
      unfinished = true;
      if (pc[i] < traces[i].length) {
        const owner = owners.get(name(traces[i][pc[i]]));
        if (owner !== undefined && owner !== i) continue;
      }
      enabled = true;
      const next = [...pc]; next[i]++;
      visit(next);
    }
    if (unfinished && !enabled) deadlock ??= [...pc];
  }
  visit(traces.map(() => 0));
  return { states: visited.size, deadlock };
}
