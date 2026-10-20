import type { GraphNode, HandleElement } from '@vue-flow/core';

/**
 * Where a cable attaches to a handle: 'side' is Vue Flow's own point, the
 * middle of the handle's side facing `position` (right for an edge between
 * handles on the border of a box); 'center' is the middle of the handle —
 * for jacks inside a box, where the plug sits in the socket.
 */
export type Anchor = 'side' | 'center';

/**
 * The handle `id` of `node` at an edge's `end`, as Vue Flow resolves it in
 * the default loose mode, where a connection can start or end on any
 * handle: by id among the node's handles; with no id, its first handle of
 * that end's type, else of the other.
 */
export function findHandle(
  node: GraphNode,
  id: string | null | undefined,
  end: 'source' | 'target'
): HandleElement | null {
  const { source, target } = node.handleBounds;
  const all =
    end === 'source'
      ? [...(source ?? []), ...(target ?? [])]
      : [...(target ?? []), ...(source ?? [])];
  return (id ? all.find((handle) => handle.id === id) : all[0]) ?? null;
}

/** The middle of `handle` of `node`, in flow coordinates; null for no handle. */
export function handleCenter(
  node: GraphNode,
  handle: HandleElement | null
): { x: number; y: number } | null {
  if (!handle) return null;
  return {
    x: node.computedPosition.x + handle.x + handle.width / 2,
    y: node.computedPosition.y + handle.y + handle.height / 2,
  };
}
