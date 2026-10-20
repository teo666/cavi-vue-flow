# cavi-vue-flow

[Vue Flow](https://vueflow.dev) edges drawn as physics cables, simulated by
[cavijs](https://www.npmjs.com/package/cavijs) (`cavijs/core`, the engine without the page). Vue Flow keeps the graph —
nodes, handles, `onConnect`, selection, state — and every edge becomes a cable that hangs, swings
when its nodes move and settles. The connection line is a cable too, pulled out of its handle, and
the very same cable becomes the edge once connected.

```bash
pnpm install
pnpm dev        # the demo: / (Vue Flow's connection-line example), /patchbay, /stress (100 boxes)
pnpm test       # CableWorld against the real WASM engine, in Node
pnpm typecheck
```

It depends on cavijs from npm (`^0.1.0`, with `cavijs/core`), which brings the `cavi` engine
(`^0.3.0`, with bending stiffness). To try changes to either before they are published, link them
instead: `"cavijs": "link:../cavijs"` (its library built there with `pnpm build:lib`), and in
cavijs `"cavi": "link:../cavi/pkg"`.

## Usage

```vue
<script setup lang="ts">
import { markRaw } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { CaviConnectionLine, CaviEdge, CaviPointer, provideCables } from 'cavi-vue-flow';

provideCables({ gravity: { x: 0, y: 5 } }); // one simulation for this graph

const { onConnect, addEdges } = useVueFlow();
onConnect((connection) => addEdges({ ...connection, type: 'cavi', data: { color: '#3fc6d8' } }));

const edgeTypes = { cavi: markRaw(CaviEdge) };
</script>

<template>
  <VueFlow :nodes="nodes" :edges="edges" :edge-types="edgeTypes">
    <template #connection-line="line">
      <CaviConnectionLine v-bind="line" />
    </template>
    <CaviPointer />
  </VueFlow>
</template>
```

- **`provideCables(options?)`** — in the component that renders `<VueFlow>`: loads the WASM
  module (once per page), creates the `CableWorld` and runs its frame loop; destroyed with the
  component. Options: `handleCable` (see below), `gravity`, `stepRate`, `stiffness` (link relaxation passes, default 4: more
  stretch less), `friction` (the share of velocity a node keeps each sub-step, engine default 0.95:
  **lower means more friction**, around 0.85–0.9 cables settle much sooner), `pointerRadius`,
  `cableStyle` (defaults for every cable).
- **`CaviEdge`** — an edge type. Its two ends are pinned on the handles — the only nodes held,
  everything between hangs free — and its node count follows the distance. The cable resists
  bending, so it curves smoothly instead of hanging like a chain; with `followHandles` it also
  leaves each handle along the handle's side (`sourcePosition`/`targetPosition`). Drawn with Vue
  Flow's
  `BaseEdge`: selection, markers and the interaction path work on the cable's real shape.
  `data: { color?, cable?: CableStyle }`.
  To draw cables over the nodes — a cable hanging past its target node then shows going into the
  handle instead of disappearing behind the box — give the edges `zIndex: 1001`: nodes sit at 0,
  or 1000 while selected (the demo does).
  `data.anchor: 'center'` attaches the cable to the middle of the handle instead of Vue Flow's
  point on its side (jacks inside a box), and `data.plug` draws a plug at each end. While one of
  its ends is being moved to another handle (an `updatable` edge), Vue Flow unmounts the edge and
  shows the connection line: the cable is parked and the connection line carries it on, so the
  plug is pulled out of its jack with the cable as it was.
- **`CaviConnectionLine`** — in the `#connection-line` slot (`anchor` and `plug` props too). When the connection becomes a
  `CaviEdge`, the edge takes this cable over (`CableWorld.park`/`adopt`, matched on the handle it
  started from, from either end); released on no handle, it is removed.
- **`CaviPointer`** — optional, inside `<VueFlow>`: the pointer pushes cables aside as it moves.
- **`CableWorld` / `Cable`** — the plain-TypeScript core the components wrap, usable without Vue.

`CableStyle`: `linkDistance` (20), `radius` (5, also half the stroke width), `renderType`, `slack`
(1.15: rest length stretches the horizontal gap between the ends by this much, not the vertical
one, where spare rope can't hang and would buckle the cable sideways), `minNodes`/`maxNodes`
(4/80), `bendStiffness` (0.3: 0 is a chain that hangs straight down from a handle and folds),
`followHandles` (false: the ends are free points and a stiff cable curves away from them whichever
way it hangs; true: each end leaves its handle along the handle's side).

## Cable styles from the handles: `handleCable`

Handles carry no data of their own in Vue Flow, so describe them in the node's data and give
`provideCables` a resolver: `handleCable(node, handleId)` returns the `CableStyle` of the cables
plugged into that handle (or `undefined` for the defaults).

```ts
provideCables({
  handleCable: (node, handleId) => {
    const jack = node.data.jacks.find((j) => j.id === handleId);
    return jack && { radius: jack.size === 'large' ? 6 : 3 };
  },
});
```

A cable takes the style of the handle it starts from — an edge's source handle (where the
connection was drawn from), the connection line's — with the edge's own `data.cable` on top
(`cableStyleOf`). Its thickness is live: a cable whose source changes (a plug moved) or that is
taken over from a connection line drawn from the other end gets the new one, drawn and simulated.
Which handles may be connected stays Vue Flow's business (`isValidConnection`): the patchbay
connects only jacks of the same size, so both ends always agree.

## Undo and redo: `useFlowHistory`

Vue Flow has no history of its own (only `toObject`/`fromObject` and change events). `useFlowHistory()`
adds one, for any Vue Flow graph — it doesn't depend on the cables:

```ts
const history = useFlowHistory({ keys: true, limit: 100 }); // where you call useVueFlow
history.canUndo; history.canRedo;    // refs, for buttons
history.undo(); history.redo();
history.commit();                     // after a change of the app's own (a node's data, say)
history.batch(() => …);               // several changes, one step
history.clear();
```

- **A step** is the graph's nodes and edges as `toObject` gives them, without the selection, the
  viewport (pan and zoom are never steps) or the edges' end points Vue Flow works out after every
  render (`flowSnapshot`). Never twice the same state.
- **Recorded** at the end of every gesture — a node or a selection dropped, an edge's end moved
  (`onEdgeUpdateEnd`, since `updateEdge` emits no change), nodes or edges added or removed
  (connections, Delete) — and on `commit()`. Changes in the same task make one step: removing a
  node removes its edges too.
- **Undo and redo** put a state back with `setNodes`/`setEdges`, and do nothing while a node is
  dragged or a connection drawn. A change not recorded yet is recorded first, so it is what gets
  undone. Vue Flow keeps its components by id, so an edge that didn't change keeps its cable and
  its motion; one that comes back gets a new cable. Keep edge ids stable (`updateEdge(edge,
connection, false)`).
- **`keys: true`**: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y, not while typing in a field.
- `FlowHistory` is the plain class behind it, over any `FlowState` (`toObject`, `setNodes`,
  `setEdges`, `isBusy`).

The patchbay route uses it, with Undo/Redo buttons.

## The patchbay route

`demo/views/PatchbayView.vue` is a modular-synth patchbay made of Vue Flow alone — no cavijs web
component. Modules are custom nodes (`demo/components/ModuleNode.vue`) with their jacks inside the
panel; every jack is a `<Handle>`, and the patchbay rules are Vue Flow's:

| Patchbay                                     | Vue Flow                                                       |
| -------------------------------------------- | -------------------------------------------------------------- |
| Cables without direction                     | the default loose connection mode, every jack a source handle  |
| How many cables a jack takes (`max-plugs`)   | `connectable` on the handle (a number)                         |
| Which jacks fit together (audio, CV)         | `isValidConnection`                                            |
| Pulling a plug out and plugging it elsewhere | updatable edges, `onEdgeUpdate` → `updateEdge(edge, c, false)` |
| Dropping a plug nowhere unplugs the cable    | `onEdgeUpdateEnd` without an update → `removeEdges`            |
| Plugs in the sockets                         | `CaviEdge` with `anchor: 'center'` and `plug`                  |
| Jack sizes (mini, large) and cable thickness | `isValidConnection` (same size), `handleCable` (thickness)     |

Two details make jacks inside a box work with Vue Flow: the handle itself is a 2px point at the
socket's center, with the socket drawn around it as its child (Vue Flow measures only the handle,
so its point for the edge is the socket's center, while pressing anywhere on the socket still
reaches the handle); and the grips Vue Flow draws to pull an edge's end out, pushed off the node by
their radius along the handle's side, are moved back onto the sockets with CSS.

## How it works

Flow coordinates are cavijs world coordinates: edges live inside Vue Flow's transformed SVG, so
pan and zoom need nothing. Each frame `CableWorld.tick` advances the cavijs `World` and walks its
render buffer once (`forEachWireRender`); a cable whose record changed gets new SVG path data
(`svgPathData`) and its edge re-renders — sleeping cables cost nothing. Cables grow and shorten
with `Wire.growTo`/`shrinkTo`, so the nodes already there keep their motion.

## Not done yet

- Several plugs in one jack overlap (cavijs fans them out), and a jack with a plug in it starts a
  new cable only from the edge of its socket: the plug's grip covers the rest.
- A dropped connection line could fall away instead of vanishing: nothing draws it once the line
  unmounts (a layer in the `#zoom-pane` slot could).
- Edge labels (`labelX`/`labelY` on the cable's middle), updatable edges (`onEdgeUpdate`).
- A library build (`dist`, types) and publishing; for now the demo imports `src/` directly.
