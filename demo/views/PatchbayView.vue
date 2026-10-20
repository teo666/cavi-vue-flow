<script setup lang="ts">
import { markRaw, ref } from 'vue';
import { VueFlow, useVueFlow, type Connection, type Edge, type Node } from '@vue-flow/core';
import {
  CaviConnectionLine,
  CaviEdge,
  CaviPointer,
  provideCables,
  useFlowHistory,
} from '../../src';
import ModuleNode, {
  type Jack,
  type JackSize,
  type ModuleData,
} from '../components/ModuleNode.vue';

/**
 * A modular-synth patchbay, entirely Vue Flow: modules are custom nodes
 * with their jacks inside the box (ModuleNode), cables are edges drawn by
 * CaviEdge plugging into the jacks' centers, and the patchbay rules are
 * Vue Flow's own — `connectable` for how many cables a jack takes,
 * `isValidConnection` for which jacks fit together, updatable edges for
 * pulling a plug out and moving it, and onEdgeUpdateEnd for dropping it
 * nowhere, which unplugs the cable.
 */
/** How thick the cables of each jack size are (their radius): only the thickness changes. */
const CABLE_RADIUS: Record<JackSize, number> = { mini: 3, large: 6 };

provideCables({
  friction: 0.9,
  // A cable's thickness is the size of the jack it was pulled out of.
  handleCable: (node, handleId) => {
    const size = jackOf(node.id, handleId)?.size;
    return size && { radius: CABLE_RADIUS[size] };
  },
});

// Undo/redo of the patch (cables and module positions; never pan and zoom),
// Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z included. Cables need nothing of their
// own: they follow the edges.
const history = useFlowHistory({ keys: true });

const modules: Record<string, ModuleData> = {
  vco: {
    title: 'VCO',
    jacks: [
      { id: 'pitch', label: 'pitch', type: 'cv', size: 'mini', max: 1 },
      { id: 'fm', label: 'fm', type: 'cv', size: 'mini', max: 1 },
      { id: 'out', label: 'out', type: 'audio', size: 'large' },
      { id: 'sub', label: 'sub', type: 'audio', size: 'mini' },
    ],
  },
  lfo: {
    title: 'LFO',
    jacks: [
      { id: 'sine', label: 'sine', type: 'cv', size: 'mini' },
      { id: 'square', label: 'square', type: 'cv', size: 'mini' },
      { id: 'saw', label: 'saw', type: 'cv', size: 'mini' },
    ],
  },
  vcf: {
    title: 'VCF',
    jacks: [
      { id: 'in', label: 'in', type: 'audio', size: 'large', max: 1 },
      { id: 'cutoff', label: 'cutoff', type: 'cv', size: 'mini', max: 1 },
      { id: 'out', label: 'out', type: 'audio', size: 'large' },
    ],
  },
  vca: {
    title: 'VCA',
    jacks: [
      { id: 'in', label: 'in', type: 'audio', size: 'large', max: 1 },
      { id: 'cv', label: 'cv', type: 'cv', size: 'mini', max: 1 },
      { id: 'out', label: 'out', type: 'audio', size: 'large' },
    ],
  },
  out: {
    title: 'Output',
    jacks: [
      { id: 'left', label: 'left', type: 'audio', size: 'large', max: 1 },
      { id: 'right', label: 'right', type: 'audio', size: 'large', max: 1 },
      { id: 'phones', label: 'phones', type: 'audio', size: 'mini', max: 1 },
    ],
  },
};

const at = (x: number, y: number) => ({ x, y });
const nodes = ref<Node<ModuleData>[]>([
  { id: 'vco', type: 'module', position: at(0, 0), data: modules.vco! },
  { id: 'lfo', type: 'module', position: at(0, 220), data: modules.lfo! },
  { id: 'vcf', type: 'module', position: at(300, 40), data: modules.vcf! },
  { id: 'vca', type: 'module', position: at(560, 200), data: modules.vca! },
  { id: 'out', type: 'module', position: at(820, 60), data: modules.out! },
]);

const COLORS = ['#3fc6d8', '#e8834a', '#8ed65a', '#d86fd0', '#f2c94c', '#ef5b5b'];
let created = 0;

/** Cables over the modules (nodes sit at z-index 0, or 1000 while selected). */
const CABLE_Z = 1001;

function cable(source: string, sourceHandle: string, target: string, targetHandle: string): Edge {
  return {
    id: `cable-${Date.now().toString(36)}-${created}`,
    source,
    sourceHandle,
    target,
    targetHandle,
    type: 'cavi',
    zIndex: CABLE_Z,
    updatable: true,
    data: { color: COLORS[created++ % COLORS.length], anchor: 'center', plug: true },
  };
}

const edges = ref<Edge[]>([
  cable('vco', 'out', 'vcf', 'in'),
  cable('vcf', 'out', 'vca', 'in'),
  cable('vca', 'out', 'out', 'left'),
  cable('lfo', 'sine', 'vcf', 'cutoff'),
  cable('vco', 'sub', 'out', 'phones'),
]);

/** Jack `handle` of module `node`. */
function jackOf(node: string, handle: string | null | undefined): Jack | undefined {
  return modules[node]?.jacks.find((jack) => jack.id === handle);
}

/** Jacks of the same type and the same size connect, never a jack with itself. */
function isValidConnection(connection: Connection): boolean {
  const { source, sourceHandle, target, targetHandle } = connection;
  if (source === target && sourceHandle === targetHandle) return false;
  const from = jackOf(source, sourceHandle);
  const to = jackOf(target, targetHandle);
  return !!from && !!to && from.type === to.type && from.size === to.size;
}

const {
  onConnect,
  addEdges,
  onEdgeUpdateStart,
  onEdgeUpdate,
  onEdgeUpdateEnd,
  updateEdge,
  removeEdges,
} = useVueFlow();

onConnect((c) => addEdges(cable(c.source, c.sourceHandle!, c.target, c.targetHandle!)));

// Pulling a plug out (an updatable edge's end): plugged in elsewhere, the
// cable moves; dropped on no jack, it is unplugged.
let moved = false;
onEdgeUpdateStart(() => (moved = false));
onEdgeUpdate(({ edge, connection }) => {
  moved = true;
  updateEdge(edge, connection, false); // keeps the edge's id
});
onEdgeUpdateEnd(({ edge }) => {
  if (!moved) removeEdges(edge.id);
});

// Components handed to Vue Flow must not be made reactive.
const nodeTypes = { module: markRaw(ModuleNode) };
const edgeTypes = { cavi: markRaw(CaviEdge) };
</script>

<template>
  <div class="page">
    <header>
      <h1>Patchbay</h1>
      <p>
        Jacks inside the modules, cables plugged into their sockets. Drag from a jack to patch it to
        another of the same color (blue: audio, yellow: CV) and the same size: large jacks take
        thick cables, mini jacks thin ones. Inputs take one cable. Grab a plug to move it to another
        jack, or drop it anywhere else to unplug it.
      </p>
      <div class="history">
        <button type="button" :disabled="!history.canUndo.value" @click="history.undo()">
          Undo
        </button>
        <button type="button" :disabled="!history.canRedo.value" @click="history.redo()">
          Redo
        </button>
        <span>Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z</span>
      </div>
    </header>
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :is-valid-connection="isValidConnection"
      :connection-radius="24"
      class="flow patchbay"
      fit-view-on-init
    >
      <template #connection-line="line">
        <CaviConnectionLine v-bind="line" anchor="center" plug color="#bbb" />
      </template>
      <CaviPointer />
    </VueFlow>
  </div>
</template>

<style>
/*
 * Vue Flow pushes the grips that pull an edge's end out (updatable edges)
 * off the node, by their radius (edge-updater-radius, 10) along the
 * handle's side — every jack here is Position.Top. The jacks are inside the
 * modules: bring the grips back onto the sockets, under the plugs.
 */
.patchbay .vue-flow__edgeupdater {
  transform: translateY(10px);
}
</style>

<style scoped>
.history {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 0 12px;
  font-size: 12px;
  color: #777;
}
.history button {
  font: inherit;
  color: #ddd;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
}
.history button:disabled {
  color: #666;
  cursor: default;
}
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
