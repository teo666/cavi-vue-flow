import { describe, expect, it } from 'vitest';
import type { GraphNode } from '@vue-flow/core';
import { cableStyleOf, type HandleCable } from './composables';

/** A cable's style from its source handle (provideCables' handleCable), the edge's own on top. */
describe('cableStyleOf', () => {
  const node = { id: 'vco' } as GraphNode;
  const handleCable: HandleCable = (n, handleId) =>
    n.id === 'vco' && handleId === 'out' ? { radius: 6 } : undefined;

  it("takes the source handle's style", () => {
    expect(cableStyleOf(handleCable, node, 'out')).toEqual({ radius: 6 });
    expect(cableStyleOf(handleCable, node, 'pitch')).toEqual({});
  });

  it("puts the edge's own style on top", () => {
    expect(cableStyleOf(handleCable, node, 'out', { radius: 2, slack: 1 })).toEqual({
      radius: 2,
      slack: 1,
    });
  });

  it('works without a resolver, or a handle id', () => {
    expect(cableStyleOf(null, node, 'out', { radius: 4 })).toEqual({ radius: 4 });
    expect(cableStyleOf(handleCable, node, undefined)).toEqual({});
  });
});
