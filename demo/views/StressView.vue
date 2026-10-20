<script setup lang="ts">
import { markRaw, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { Position, VueFlow, useVueFlow, type Edge, type Node } from '@vue-flow/core';
import { CaviConnectionLine, CaviEdge, CaviPointer, provideCables } from '../../src';

/**
 * A stress test: boxes in a grid (100 at first, 10 × 10), each with an
 * input and an output, chained to the box beside it — a cable fewer than
 * boxes, all simulated and drawn at once. The chain snakes through the grid
 * (left to right, then right to left on the row below), so every cable
 * joins two neighbors: the boxes of the rows run right to left have their
 * input on the right.
 */
const cables = provideCables({ friction: 0.9 });

/** A box's size, as Vue Flow's default node draws it. */
const BOX_W = 150;
const BOX_H = 30;
const COLORS = ['#3fc6d8', '#e8834a', '#8ed65a', '#d86fd0', '#f2c94c', '#ef5b5b'];

/** Cables over the nodes (nodes sit at z-index 0, or 1000 while selected). */
const CABLE_Z = 1001;

/** How many boxes (the count slider, applied once released). */
const count = ref(100);
const countDraft = ref(count.value);
/** The space between neighboring boxes in the grid (the spacing slider), in px. */
const gap = ref(80);
const stepX = () => BOX_W + gap.value;
const stepY = () => BOX_H + gap.value;

/** The grid's size for `n` boxes: as square as it gets. */
function gridSize(n: number): { columns: number; rows: number } {
  const columns = Math.ceil(Math.sqrt(n));
  return { columns, rows: Math.ceil(n / columns) };
}

/** Every box's cell in the grid, by id: what grid() puts back. */
const cells = new Map<string, { column: number; row: number }>();

/** `n` boxes in their cells, in chain order: row by row, every other row right to left. */
function makeBoxes(n: number): Node[] {
  const { columns } = gridSize(n);
  cells.clear();
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / columns);
    const leftward = row % 2 === 1;
    const column = leftward ? columns - 1 - (i % columns) : i % columns;
    const id = `box-${i + 1}`;
    cells.set(id, { column, row });
    return {
      id,
      position: { x: column * stepX(), y: row * stepY() },
      data: { label: `Box ${i + 1}` },
      targetPosition: leftward ? Position.Right : Position.Left,
      sourcePosition: leftward ? Position.Left : Position.Right,
    };
  });
}

const cable = (source: string, target: string, n: number): Edge => ({
  id: `cable-${source}-${target}`,
  source,
  target,
  type: 'cavi',
  zIndex: CABLE_Z,
  data: { color: COLORS[n % COLORS.length] },
});

/** Each box's output into the next one's input. */
const chain = (boxes: Node[]): Edge[] =>
  boxes.slice(1).map((box, i) => cable(boxes[i]!.id, box.id, i));

const nodes = ref<Node[]>(makeBoxes(count.value));
const edges = ref<Edge[]>(chain(nodes.value));

const { onConnect, addEdges, fitView, onNodesInitialized } = useVueFlow();

let created = 0;
onConnect((c) => addEdges(cable(c.source, c.target, created++)));

// Another number of boxes: a new grid and chain, every box and cable kept
// by id (the first ones keep their cables), all of it brought into view
// once the new boxes are measured.
let refit = false;
watch(count, (n) => {
  const boxes = makeBoxes(n);
  nodes.value = boxes;
  edges.value = chain(boxes);
  refit = true;
});
onNodesInitialized(() => {
  if (!refit) return;
  refit = false;
  void fitView();
});

/** Every box moved where `place` says: the cables follow. */
function moveBoxes(place: (box: Node) => { x: number; y: number }): void {
  nodes.value = nodes.value.map((box) => ({ ...box, position: place(box) }));
}

/** Every box somewhere at random, within the grid's area. */
function shuffle(): void {
  const { columns, rows } = gridSize(nodes.value.length);
  moveBoxes(() => ({
    x: Math.round(Math.random() * (columns - 1) * stepX()),
    y: Math.round(Math.random() * (rows - 1) * stepY()),
  }));
}

/** Every box back in its cell of the grid. */
function grid(): void {
  moveBoxes((box) => {
    const cell = cells.get(box.id);
    return cell ? { x: cell.column * stepX(), y: cell.row * stepY() } : box.position;
  });
}

// Spreading the boxes out or drawing them together: every position scaled
// by the change of the grid's step, so a grid stays a grid, a shuffle the
// same shuffle and a box dragged by hand where it was relative to the rest.
watch(gap, (now, before) => {
  const sx = (BOX_W + now) / (BOX_W + before);
  const sy = (BOX_H + now) / (BOX_H + before);
  moveBoxes(({ position: { x, y } }) => ({ x: Math.round(x * sx), y: Math.round(y * sy) }));
});

/**
 * Every half second: the display's frames per second, the cables' frame
 * loop — the time it spends a frame (simulation and paths, CableWorld.
 * lastTickMs, before Vue and the browser draw them), how many cables are
 * awake, and whether it runs at all: it rests once every cable is asleep.
 */
const stats = shallowRef({ fps: 0, tickMs: 0, awake: 0, running: false });
let frames = 0;
let ticks = 0;
let tickTotal = 0;
let since = performance.now();
let frame = requestAnimationFrame(function count(now) {
  frames++;
  const world = cables.value;
  if (world?.running) {
    ticks++;
    tickTotal += world.lastTickMs;
  }
  if (now - since >= 500) {
    stats.value = {
      fps: Math.round((frames * 1000) / (now - since)),
      tickMs: ticks ? tickTotal / ticks : 0,
      awake: world?.awakeCount ?? 0,
      running: world?.running ?? false,
    };
    frames = ticks = tickTotal = 0;
    since = now;
  }
  frame = requestAnimationFrame(count);
});
onBeforeUnmount(() => cancelAnimationFrame(frame));

// Components handed to Vue Flow must not be made reactive.
const edgeTypes = { cavi: markRaw(CaviEdge) };
</script>

<template>
  <div class="page">
    <header>
      <h1>Stress test</h1>
      <p>
        {{ nodes.length }} boxes, {{ edges.length }} cables, all simulated at once: each box's
        output is plugged into the input of the box beside it. Drag boxes around, or select many
        (Shift+drag) and move them together, shuffle them all at once, spread them out or draw them
        together, and choose how many there are (applied when the slider is released).
      </p>
      <div class="controls">
        <button type="button" @click="shuffle">Shuffle</button>
        <button type="button" @click="grid">Grid</button>
        <label class="slider">
          Boxes
          <input
            v-model.number="countDraft"
            type="range"
            min="10"
            max="1000"
            step="10"
            @change="count = countDraft"
          />
          <span>{{ countDraft }}</span>
        </label>
        <label class="slider">
          Spacing
          <input v-model.number="gap" type="range" min="10" max="400" step="5" />
          <span>{{ gap }} px</span>
        </label>
        <span class="stats">
          {{ stats.fps }} fps · cables {{ stats.tickMs.toFixed(2) }} ms/frame ·
          {{ stats.awake }} awake ·
          {{ stats.running ? 'loop running' : 'loop resting' }}
        </span>
      </div>
    </header>
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :edge-types="edgeTypes"
      :min-zoom="0.1"
      class="flow"
      fit-view-on-init
    >
      <template #connection-line="line">
        <CaviConnectionLine v-bind="line" color="#bbb" />
      </template>
      <CaviPointer />
    </VueFlow>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 0 12px;
  font-size: 12px;
}
.controls button {
  font: inherit;
  color: #ddd;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
}
.slider {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-left: 8px;
  color: #999;
}
.slider span {
  min-width: 44px;
  font-variant-numeric: tabular-nums;
}
.stats {
  margin-left: 4px;
  font-variant-numeric: tabular-nums;
  color: #9fd8e0;
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
