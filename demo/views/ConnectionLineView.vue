<script setup lang="ts">
import { markRaw, ref } from 'vue';
import { Position, VueFlow, useVueFlow, type Edge, type Node } from '@vue-flow/core';
import { CaviConnectionLine, CaviEdge, CaviPointer, provideCables } from '../../src';

/**
 * Vue Flow's connection-line example, with every edge a cavijs cable: drag
 * from a handle to pull a cable out, drop it on another handle to plug it
 * in, drag a node and its cables follow, swing and settle.
 */
provideCables({ gravity: { x: 0, y: 5 }, friction: 0.9 });

/**
 * Handles on mixed sides — some left/right, some top/bottom — so cables
 * leave and enter boxes both sideways and vertically.
 */
const nodes = ref<Node[]>([
  {
    id: 'osc',
    type: 'input',
    position: { x: 0, y: 60 },
    data: { label: 'Oscillator' },
    sourcePosition: Position.Right,
  },
  {
    id: 'filter',
    position: { x: 300, y: 40 },
    data: { label: 'Filter' },
    targetPosition: Position.Left,
    sourcePosition: Position.Bottom,
  },
  {
    id: 'lfo',
    type: 'input',
    position: { x: 620, y: 20 },
    data: { label: 'LFO' },
    sourcePosition: Position.Bottom,
  },
  {
    id: 'delay',
    position: { x: 620, y: 260 },
    data: { label: 'Delay' },
    targetPosition: Position.Top,
    sourcePosition: Position.Left,
  },
  {
    id: 'out',
    type: 'output',
    position: { x: 320, y: 340 },
    data: { label: 'Output' },
    targetPosition: Position.Top,
  },
]);

/**
 * Cables are drawn over the nodes, so a cable hanging past its target node
 * is seen going into the handle instead of disappearing behind the box.
 * Nodes sit at z-index 0, or 1000 while selected (elevateNodesOnSelect).
 */
const CABLE_Z = 1001;

const cable = (id: string, source: string, target: string, color: string): Edge => ({
  id,
  source,
  target,
  type: 'cavi',
  zIndex: CABLE_Z,
  data: { color },
});

const edges = ref<Edge[]>([
  cable('osc-filter', 'osc', 'filter', '#3fc6d8'),
  cable('filter-out', 'filter', 'out', '#e8834a'),
  cable('lfo-delay', 'lfo', 'delay', '#8ed65a'),
  cable('delay-out', 'delay', 'out', '#d86fd0'),
]);

const COLORS = ['#3fc6d8', '#e8834a', '#8ed65a', '#d86fd0', '#f2c94c'];
let created = 0;

const { onConnect, addEdges } = useVueFlow();
onConnect((connection) => {
  addEdges({
    ...connection,
    id: `cable-${Date.now().toString(36)}-${created}`,
    type: 'cavi',
    zIndex: CABLE_Z,
    data: { color: COLORS[created++ % COLORS.length] },
  });
});

// Components handed to Vue Flow must not be made reactive.
const edgeTypes = { cavi: markRaw(CaviEdge) };
</script>

<template>
  <div class="page">
    <header>
      <h1>cavijs × Vue Flow</h1>
      <p>
        Drag from a handle to pull a cable out and drop it on another handle; drag a node and its
        cables follow. Every edge is a <code>CaviEdge</code>, the connection line a
        <code>CaviConnectionLine</code> — the same cable once connected.
      </p>
    </header>
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :edge-types="edgeTypes"
      class="flow"
      fit-view-on-init
    >
      <template #connection-line="lineProps">
        <CaviConnectionLine v-bind="lineProps" color="#bbb" />
      </template>
      <CaviPointer />
    </VueFlow>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.flow {
  flex: 1;
  min-height: 0;
}
</style>
