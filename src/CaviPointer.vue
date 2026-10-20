<script setup lang="ts">
import { useVueFlow } from '@vue-flow/core';
import { onBeforeUnmount, watch } from 'vue';
import { useCables } from './composables';

/**
 * Lets the pointer push cables aside as it moves over the graph, as in
 * cavijs's own worlds. Renderless: put it inside <VueFlow> (its default
 * slot), under a provideCables().
 */
const cables = useCables();
const { vueFlowRef, screenToFlowCoordinate } = useVueFlow();

function onMove(event: PointerEvent): void {
  const { x, y } = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });
  cables.value?.setPointer(x, y);
}

function onLeave(): void {
  cables.value?.releasePointer();
}

watch(
  vueFlowRef,
  (el, previous) => {
    previous?.removeEventListener('pointermove', onMove);
    previous?.removeEventListener('pointerleave', onLeave);
    el?.addEventListener('pointermove', onMove);
    el?.addEventListener('pointerleave', onLeave);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  vueFlowRef.value?.removeEventListener('pointermove', onMove);
  vueFlowRef.value?.removeEventListener('pointerleave', onLeave);
  onLeave();
});
</script>

<template>
  <slot />
</template>
