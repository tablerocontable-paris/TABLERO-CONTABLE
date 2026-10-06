import { describe, expect, it } from 'vitest';
import { explore, orderedTrace, type Lock } from './helpers/coordination-lock-model';

// Independent feasibility evidence for the contract; no claims about engine011.
describe('011 abstract concurrency protocol', () => {
  it('reproduces the proposed late-expansion owner inversion', () => {
    const result = explore([[[3, 1], [3, 2]], [[3, 2], [3, 1]]]);
    expect(result.deadlock).toEqual([1, 1]);
  });
  it('removes that cycle when both routes acquire the full ordered footprint', () => {
    const result = explore([orderedTrace([[3, 1], [3, 2]]), orderedTrace([[3, 2], [3, 1]])]);
    expect(result.deadlock).toBeNull();
    expect(result.states).toBeGreaterThan(5);
  });
  it('orders by signed physical advisory key, deduplicating collisions', () => {
    expect(orderedTrace([[3, 7], [3, -4], [3, 7], [2, 7], [3, 0]]))
      .toEqual([[2, 7], [3, -4], [3, 0], [3, 7]]);
    const traces = [orderedTrace([[3, 7], [3, -4]]), orderedTrace([[3, -4], [3, 7]])];
    expect(explore(traces).deadlock).toBeNull();
  });
  it('handles opposite timer switches, completion and closure under one tier order', () => {
    const shared: Lock[] = [[2, 1], [2, 2], [3, 1], [3, 2], [4, 1], [4, 2], [5, 10], [5, 20], [6, 10], [6, 20]];
    const a = orderedTrace([[1, 101], ...shared]);
    const b = orderedTrace([[1, 202], ...[...shared].reverse()]);
    const closure = orderedTrace(shared.filter(([tier]) => tier !== 1));
    expect(explore([a, b, closure]).deadlock).toBeNull();
  });
  it('allows disjoint personal tasks to advance without a shared organization lock', () => {
    const a = orderedTrace([[2, 1], [3, 1], [4, 1], [5, 1]]);
    const b = orderedTrace([[2, 2], [3, 2], [4, 2], [5, 2]]);
    const result = explore([a, b]);
    expect(result).toEqual({ states: 36, deadlock: null });
  });
  it('demonstrates why taking actor locks after owner locks is forbidden', () => {
    expect(explore([[[2, 1], [3, 1]], [[3, 1], [2, 1]]]).deadlock).not.toBeNull();
  });
  it('checks every pair of nonempty footprints over signed keys and tiers', () => {
    const domain: Lock[] = [[2, -1], [2, 2], [3, -1], [3, 2]];
    for (let a = 1; a < 16; a++) for (let b = 1; b < 16; b++) {
      const footprint = (mask: number) => orderedTrace(domain.filter((_, i) => mask & (1 << i)));
      expect(explore([footprint(a), footprint(b)]).deadlock).toBeNull();
    }
  });
});
