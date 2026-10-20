import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@vue-flow/core';
import { FlowHistory, flowSnapshot, type FlowState } from './history';

/**
 * FlowHistory against a stand-in for a Vue Flow store: nodes, edges, a
 * viewport and a selection, the first two of which make a state.
 */
class FakeFlow implements FlowState {
  nodes: Node[] = [
    { id: 'a', position: { x: 0, y: 0 }, data: {} },
    { id: 'b', position: { x: 200, y: 0 }, data: {} },
  ];
  edges: Edge[] = [];
  viewport = { x: 0, y: 0, zoom: 1 };
  selected = new Set<string>();
  busy = false;

  toObject() {
    // As Vue Flow's: a JSON copy, the selection left out.
    return JSON.parse(
      JSON.stringify({ nodes: this.nodes, edges: this.edges, viewport: this.viewport })
    );
  }
  setNodes(nodes: Node[]) {
    this.nodes = nodes;
  }
  setEdges(edges: Edge[]) {
    this.edges = edges;
  }
  isBusy() {
    return this.busy;
  }

  connect(id: string) {
    this.edges = [...this.edges, { id, source: 'a', target: 'b' }];
  }
  move(id: string, x: number) {
    this.nodes = this.nodes.map((n) => (n.id === id ? { ...n, position: { x, y: 0 } } : n));
  }
}

function setup() {
  const flow = new FakeFlow();
  const history = new FlowHistory(flow);
  history.start();
  return { flow, history };
}

const tick = () => Promise.resolve();

describe('FlowHistory', () => {
  it('starts with nothing to undo or redo', () => {
    const { history } = setup();
    expect([history.canUndo.value, history.canRedo.value]).toEqual([false, false]);
    expect(history.undo()).toBe(false);
    expect(history.commit()).toBe(false);
  });

  it('undoes and redoes a recorded change', () => {
    const { flow, history } = setup();
    flow.connect('e1');
    expect(history.commit()).toBe(true);
    expect(history.canUndo.value).toBe(true);

    expect(history.undo()).toBe(true);
    expect(flow.edges).toEqual([]);
    expect([history.canUndo.value, history.canRedo.value]).toEqual([false, true]);

    expect(history.redo()).toBe(true);
    expect(flow.edges.map((e) => e.id)).toEqual(['e1']);
  });

  it('leaves the viewport and the selection out', () => {
    const { flow, history } = setup();
    flow.viewport = { x: 300, y: -40, zoom: 2 };
    flow.selected.add('a');
    expect(history.commit()).toBe(false);

    flow.move('a', 50);
    history.commit();
    history.undo();
    expect(flow.viewport).toEqual({ x: 300, y: -40, zoom: 2 });
  });

  it('makes one step of the changes recorded in the same task', async () => {
    const { flow, history } = setup();
    flow.connect('e1');
    history.record();
    flow.move('b', 400);
    history.record();
    await tick();

    history.undo();
    expect(flow.edges).toEqual([]);
    expect(flow.nodes[1]!.position.x).toBe(200);
    expect(history.canUndo.value).toBe(false);
  });

  it('undoes a change not recorded yet before anything else', () => {
    const { flow, history } = setup();
    flow.connect('e1');
    history.commit();
    flow.move('a', 80); // the app forgot to commit

    history.undo();
    expect(flow.nodes[0]!.position.x).toBe(0);
    expect(flow.edges.map((e) => e.id)).toEqual(['e1']);
  });

  it('drops the steps undone once a new one is recorded', () => {
    const { flow, history } = setup();
    flow.connect('e1');
    history.commit();
    history.undo();
    flow.connect('e2');
    history.commit();

    expect(history.canRedo.value).toBe(false);
    expect(history.redo()).toBe(false);
  });

  it('folds a batch into one step', () => {
    const { flow, history } = setup();
    history.batch(() => {
      flow.connect('e1');
      history.commit();
      flow.move('a', 30);
    });

    history.undo();
    expect(flow.edges).toEqual([]);
    expect(flow.nodes[0]!.position.x).toBe(0);
  });

  it('refuses to undo or redo while a gesture is in progress', () => {
    const { flow, history } = setup();
    flow.connect('e1');
    history.commit();
    flow.busy = true;
    expect(history.undo()).toBe(false);
    flow.busy = false;
    expect(history.undo()).toBe(true);
  });

  it('keeps at most `limit` steps', () => {
    const flow = new FakeFlow();
    const history = new FlowHistory(flow, { limit: 2 });
    history.start();
    for (const x of [10, 20, 30]) {
      flow.move('a', x);
      history.commit();
    }
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(false);
    expect(flow.nodes[0]!.position.x).toBe(10);
  });

  it('puts back fresh copies: changing the graph later changes no step', () => {
    const { flow, history } = setup();
    flow.move('a', 10);
    history.commit();
    history.undo();
    flow.nodes[0]!.position.x = 999; // mutated in place
    history.redo();
    history.undo();
    expect(flow.nodes[0]!.position.x).toBe(0);
  });

  it('takes the first state on its first commit if never started', () => {
    const flow = new FakeFlow();
    const history = new FlowHistory(flow);
    expect(history.started).toBe(false);
    history.commit();
    expect(history.started).toBe(true);
    expect(history.canUndo.value).toBe(false);
  });
});

describe('flowSnapshot', () => {
  it("drops the edges' end points Vue Flow works out after every render", () => {
    const edge = {
      id: 'e',
      source: 'a',
      target: 'b',
      sourceX: 1,
      sourceY: 2,
      targetX: 3,
      targetY: 4,
    };
    const snapshot = flowSnapshot({ nodes: [], edges: [edge as Edge] });
    expect(snapshot.edges).toEqual([{ id: 'e', source: 'a', target: 'b' }]);
    expect(edge.sourceX).toBe(1); // the original is left alone
  });
});
