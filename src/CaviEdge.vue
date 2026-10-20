<script setup lang="ts">
import { BaseEdge, type EdgeProps } from '@vue-flow/core';
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { findHandle, handleCenter, type Anchor } from './anchor';
import { directionOf, type Cable, type CableStyle } from './cable-world';
import { cableStyleOf, useCables, useHandleCable } from './composables';

/** `data` of an edge drawn by CaviEdge — all optional. */
export interface CaviEdgeData {
  /** The cable's physics and length (see CableStyle); read when the edge is created. */
  cable?: CableStyle;
  /** Stroke color (default: the edge's `style.stroke`, else Vue Flow's edge color). */
  color?: string;
  /**
   * Where the cable attaches to its handles (default 'side', Vue Flow's own
   * point); 'center' for jacks inside a box — see Anchor.
   */
  anchor?: Anchor;
  /**
   * A plug drawn at each end, over the handle: true, or its radius
   * (default: the cable's radius + 4).
   */
  plug?: boolean | number;
}

/**
 * A Vue Flow edge drawn as a cavijs cable: register it as an edge type
 * (`:edge-types="{ cavi: CaviEdge }"`, or a `#edge-cavi` slot) under a
 * provideCables(). Its two ends follow the edge's handles, its length the
 * distance between them, and the cable hangs, swings and settles under the
 * simulation. Drawn with Vue Flow's BaseEdge, so selection, markers,
 * labels and the interaction path work as for any edge — on the cable's
 * real shape.
 *
 * Vue Flow unmounts an edge while one of its ends is being moved to
 * another handle (an `updatable` edge) and shows the connection line
 * instead: the cable is parked then, so a CaviConnectionLine carries it on
 * — the plug pulled out of its jack — and the edge takes it back once
 * moved (CableWorld.park/adopt).
 */
defineOptions({ inheritAttrs: false });
const props = defineProps<EdgeProps<CaviEdgeData>>();

const cables = useCables();
const handleCable = useHandleCable();

/**
 * The cable's style: its source handle's (provideCables' handleCable) —
 * the jack the connection was drawn from always wins — then `data.cable`.
 */
const cableStyle = computed(() =>
  cableStyleOf(handleCable, props.sourceNode, props.sourceHandleId, props.data?.cable)
);

/**
 * Whether Vue Flow has measured both handles: until then its points are
 * the nodes' corners, and a cable started there would begin far too long
 * and in the wrong place — a stiff one can stay caught in the loop.
 */
const measured = computed(
  () =>
    findHandle(props.sourceNode, props.sourceHandleId, 'source') !== null &&
    findHandle(props.targetNode, props.targetHandleId, 'target') !== null
);

/** Where the cable's ends are: Vue Flow's points, or the handles' centers. */
const ends = computed(() => {
  const side = { sx: props.sourceX, sy: props.sourceY, tx: props.targetX, ty: props.targetY };
  if (props.data?.anchor !== 'center') return side;
  const source = handleCenter(
    props.sourceNode,
    findHandle(props.sourceNode, props.sourceHandleId, 'source')
  );
  const target = handleCenter(
    props.targetNode,
    findHandle(props.targetNode, props.targetHandleId, 'target')
  );
  return {
    sx: source?.x ?? side.sx,
    sy: source?.y ?? side.sy,
    tx: target?.x ?? side.tx,
    ty: target?.y ?? side.ty,
  };
});

const path = shallowRef(straight());
let cable: Cable | null = null;

function straight(): string {
  const { sx, sy, tx, ty } = ends.value;
  return `M ${sx} ${sy} L ${tx} ${ty}`;
}

/**
 * Created once mounted, not during setup: when a connection completes, the
 * connection line goes away in the same render, and its cable must be
 * parked (CaviConnectionLine) before this edge looks for it (adopt).
 */
function attach(): void {
  const world = cables.value;
  if (cable || !world || !measured.value) return;
  const { sx, sy, tx, ty } = ends.value;
  const adopted = world.adopt(sx, sy, tx, ty);
  cable = adopted ?? world.createCable(sx, sy, tx, ty, cableStyle.value);
  // Taken over from a connection line, it is this edge's thickness now.
  if (adopted) adopted.setRadius(cableStyle.value.radius ?? 5);
  cable.onPath = (d) => (path.value = d);
  pinEnds();
  path.value = cable.path;
}

function pinEnds(): void {
  const { sx, sy, tx, ty } = ends.value;
  cable?.setEnds(
    sx,
    sy,
    tx,
    ty,
    directionOf(props.sourcePosition),
    directionOf(props.targetPosition)
  );
}

const mounted = shallowRef(false);
onMounted(() => {
  mounted.value = true;
  attach();
});
watch([cables, measured], () => mounted.value && attach());
watch(
  () => [ends.value, props.sourcePosition, props.targetPosition] as const,
  () => {
    if (cable) pinEnds();
    else path.value = straight();
  }
);
onBeforeUnmount(() => {
  if (!cable) return;
  // Unmounted while an end is being moved, or deleted: parked either way —
  // a connection line takes it over, or nobody does and it is removed.
  cable.onPath = null;
  cables.value?.park(cable);
  cable = null;
});

const radius = computed(() => cableStyle.value.radius ?? 5);
// Live, also for a cable taken over from a connection line drawn from the
// other end: thickness is drawn and simulated.
watch(radius, (r) => cable?.setRadius(r));
const plugRadius = computed(() => {
  const plug = props.data?.plug;
  if (!plug) return 0;
  return plug === true ? radius.value + 4 : plug;
});

const style = computed(() => ({
  strokeWidth: radius.value * 2,
  strokeLinecap: 'round' as const,
  ...(props.data?.color ? { stroke: props.data.color } : {}),
  ...props.style,
}));
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path"
    :style="style"
    :marker-start="markerStart"
    :marker-end="markerEnd"
    :interaction-width="interactionWidth"
  />
  <template v-if="plugRadius > 0">
    <circle
      v-for="(end, i) in [
        [ends.sx, ends.sy],
        [ends.tx, ends.ty],
      ]"
      :key="i"
      class="cavi-plug"
      :cx="end[0]"
      :cy="end[1]"
      :r="plugRadius"
      :style="{ fill: style.stroke }"
    />
  </template>
</template>

<style>
.cavi-plug {
  fill: #b1b1b7;
  stroke: #111;
  stroke-width: 2;
  pointer-events: none;
}
</style>
