import {
  inject,
  markRaw,
  onBeforeUnmount,
  provide,
  shallowRef,
  type InjectionKey,
  type ShallowRef,
} from 'vue';
import type { GraphNode } from '@vue-flow/core';
import { CableWorld, type CableStyle, type CableWorldOptions } from './cable-world';

const CABLES: InjectionKey<ShallowRef<CableWorld | null>> = Symbol('cavi-vue-flow');
const HANDLE_CABLE: InjectionKey<HandleCable | null> = Symbol('cavi-vue-flow-handle-cable');

/**
 * The style of the cables plugged into handle `handleId` of `node` — its
 * thickness, say — or undefined for the defaults. Handles carry no data of
 * their own in Vue Flow: describe them in the node's data and read it here.
 */
export type HandleCable = (node: GraphNode, handleId: string | null) => CableStyle | undefined;

export interface ProvideCablesOptions extends CableWorldOptions {
  /**
   * Gives each cable the style of the handle it starts from (see
   * HandleCable): an edge's source handle — where the connection was drawn
   * from — and the connection line's. An edge's own `data.cable` comes on
   * top of it.
   */
  handleCable?: HandleCable;
}

/**
 * A cable's style: the one of the handle it starts from (`resolver`), then
 * `own` on top of it — what CaviEdge and CaviConnectionLine use.
 */
export function cableStyleOf(
  resolver: HandleCable | null,
  node: GraphNode,
  handleId: string | null | undefined,
  own?: CableStyle
): CableStyle {
  return { ...resolver?.(node, handleId ?? null), ...own };
}

/**
 * Creates the CableWorld of a graph and provides it to the components below
 * — call it in the component that renders <VueFlow>. The ref is null until
 * the WASM module has loaded (a few ms, once per page); CaviEdge and
 * CaviConnectionLine wait for it on their own. The world is destroyed with
 * the component.
 */
export function provideCables(options: ProvideCablesOptions = {}): ShallowRef<CableWorld | null> {
  const { handleCable, ...worldOptions } = options;
  const world = shallowRef<CableWorld | null>(null);
  provide(CABLES, world);
  provide(HANDLE_CABLE, handleCable ?? null);
  let unmounted = false;
  CableWorld.create(worldOptions).then(
    (created) => {
      if (unmounted) {
        created.destroy();
        return;
      }
      created.start();
      // Its internals are not reactive state: Vue must not proxy them.
      world.value = markRaw(created);
    },
    (error: unknown) =>
      console.error('cavi-vue-flow: the cavi WASM module failed to load.', error)
  );
  onBeforeUnmount(() => {
    unmounted = true;
    world.value?.destroy();
    world.value = null;
  });
  return world;
}

/** The CableWorld provided above (null until it is ready). */
export function useCables(): ShallowRef<CableWorld | null> {
  const world = inject(CABLES, null);
  if (!world) {
    throw new Error('cavi-vue-flow: call provideCables() in a component above this one.');
  }
  return world;
}

/** The handle style resolver given to provideCables, if any. */
export function useHandleCable(): HandleCable | null {
  return inject(HANDLE_CABLE, null);
}
