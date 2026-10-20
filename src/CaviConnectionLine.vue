<script setup lang="ts">
import type { ConnectionLineProps } from '@vue-flow/core';
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { handleCenter, type Anchor } from './anchor';
import { directionOf, type Cable, type CableStyle } from './cable-world';
import { cableStyleOf, useCables, useHandleCable } from './composables';

/**
 * Vue Flow's connection line as a cavijs cable being pulled out of its
 * handle: put it in the `#connection-line` slot, under a provideCables().
 * When the connection becomes an edge drawn by CaviEdge, that edge takes
 * this very cable over, shape and motion included; released on no handle,
 * it is removed. When it is an edge's end being moved to another handle,
 * it carries on that edge's own cable.
 */
const props = defineProps<
  ConnectionLineProps & {
    /** The cable's physics and length (see CableStyle). */
    cable?: CableStyle;
    /** Stroke color (default: Vue Flow's connection line color). */
    color?: string;
    /** Where the cable attaches to the handle it comes out of — see CaviEdgeData.anchor. */
    anchor?: Anchor;
    /** Plugs drawn at both ends — see CaviEdgeData.plug. */
    plug?: boolean | number;
  }
>();

const cables = useCables();
const handleCable = useHandleCable();

/** The cable's style: the handle's it comes out of (provideCables' handleCable), then `cable`. */
const cableStyle = computed(() =>
  cableStyleOf(handleCable, props.sourceNode, props.sourceHandle?.id, props.cable)
);

/** The handle end (Vue Flow's point or the handle's center) and the free one. */
const ends = computed(() => {
  let sx = props.sourceX;
  let sy = props.sourceY;
  let tx = props.targetX;
  let ty = props.targetY;
  if (props.anchor === 'center') {
    const source = handleCenter(props.sourceNode, props.sourceHandle);
    if (source) ({ x: sx, y: sy } = source);
    // Snapped onto a handle (connectionRadius): into its socket too.
    const target = props.targetNode && handleCenter(props.targetNode, props.targetHandle);
    if (target) ({ x: tx, y: ty } = target);
  }
  return { sx, sy, tx, ty };
});

const path = shallowRef(straight());
let cable: Cable | null = null;

function straight(): string {
  const { sx, sy, tx, ty } = ends.value;
  return `M ${sx} ${sy} L ${tx} ${ty}`;
}

/**
 * Created once mounted: an edge whose end is being moved is unmounted in
 * the same render, and parks its cable (CaviEdge) before this looks for it.
 */
function attach(): void {
  const world = cables.value;
  if (cable || !world) return;
  const { sx, sy, tx, ty } = ends.value;
  const adopted = world.adopt(sx, sy, tx, ty);
  cable = adopted ?? world.createCable(sx, sy, tx, ty, cableStyle.value);
  // An edge's cable carried on: the thickness of the handle it now comes out of.
  if (adopted) adopted.wire.setRadius(cableStyle.value.radius ?? 5);
  cable.onPath = (d) => (path.value = d);
  // Its free end sits under the pointer: see Cable.hold.
  cable.hold(true);
  pinEnds();
  path.value = cable.path;
}

function pinEnds(): void {
  const { sx, sy, tx, ty } = ends.value;
  // Out of its handle along the handle's side; the free end follows the pointer.
  cable?.setEnds(sx, sy, tx, ty, directionOf(props.sourcePosition));
}

const mounted = shallowRef(false);
onMounted(() => {
  mounted.value = true;
  attach();
});
watch(cables, () => mounted.value && attach());
watch(
  () => [ends.value, props.sourcePosition] as const,
  () => {
    if (cable) pinEnds();
    else path.value = straight();
  }
);

onBeforeUnmount(() => {
  if (!cable) return;
  cable.onPath = null;
  cables.value?.park(cable);
  cable = null;
});

const radius = computed(() => cableStyle.value.radius ?? 5);
// An edge's cable carried on keeps being drawn and simulated at this thickness.
watch(radius, (r) => cable?.wire.setRadius(r));
const plugRadius = computed(() => {
  if (!props.plug) return 0;
  return props.plug === true ? radius.value + 4 : props.plug;
});

const style = computed(() => ({
  strokeWidth: radius.value * 2,
  strokeLinecap: 'round' as const,
  fill: 'none',
  ...(props.color ? { stroke: props.color } : {}),
}));
</script>

<template>
  <g>
    <path class="vue-flow__connection-path" :d="path" :style="style" />
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
        :style="color ? { fill: color } : {}"
      />
    </template>
  </g>
</template>
