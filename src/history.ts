import { useVueFlow, type Edge, type Node } from '@vue-flow/core';
import { computed, getCurrentScope, onScopeDispose, shallowRef, type ComputedRef } from 'vue';

/** The part of a Vue Flow store FlowHistory reads and writes. */
export interface FlowState {
  /** Nodes and edges without their internals and selection — Vue Flow's toObject. */
  toObject(): { nodes: Node[]; edges: Edge[] };
  setNodes(nodes: Node[]): void;
  setEdges(edges: Edge[]): void;
  /** Whether a gesture is in progress (a node dragged, a connection being drawn). */
  isBusy(): boolean;
}

/**
 * The state of a graph as FlowHistory keeps it: Vue Flow's toObject without
 * the viewport, and without what Vue Flow works out by itself — the edges'
 * end points (sourceX/Y, targetX/Y, which toObject keeps). Those are
 * recomputed after every render: kept, a state just put back would differ
 * from itself a frame later, and look like a new step.
 */
export function flowSnapshot(object: { nodes: Node[]; edges: Edge[] }): {
  nodes: Node[];
  edges: Edge[];
} {
  const edges = object.edges.map((edge) => {
    const copy: Record<string, unknown> = { ...edge };
    for (const key of ['sourceX', 'sourceY', 'targetX', 'targetY']) delete copy[key];
    return copy as unknown as Edge;
  });
  return { nodes: object.nodes, edges };
}

export interface FlowHistoryOptions {
  /** Most undo steps kept (default 100); the oldest go first. */
  limit?: number;
}

const DEFAULT_LIMIT = 100;

/**
 * Undo/redo for a Vue Flow graph: a list of states, each its nodes and
 * edges as toObject gives them — positions, handles, `data` — without the
 * selection or the viewport, so neither selecting nor panning is a step.
 *
 * A step is recorded when told (record, from the end of every gesture —
 * see useFlowHistory — or commit, after a change of the app's own), never
 * twice the same state. Undo and redo put a state back with setNodes and
 * setEdges: Vue Flow keeps its components by id, so an element that
 * didn't change is left alone (an edge's cable keeps its motion).
 */
export class FlowHistory {
  /** Whether undo() has a state to go back to. */
  readonly canUndo: ComputedRef<boolean>;
  /** Whether redo() has a state to go forward to. */
  readonly canRedo: ComputedRef<boolean>;

  private readonly flow: FlowState;
  private readonly limit: number;
  /** Every state as JSON: compared as is, parsed into a fresh copy when put back. */
  private entries: string[] = [];
  /** The state the graph is in; reactive copies for canUndo/canRedo. */
  private index = 0;
  private readonly indexRef = shallowRef(0);
  private readonly sizeRef = shallowRef(0);
  private batchDepth = 0;
  private scheduled = false;

  constructor(flow: FlowState, options: FlowHistoryOptions = {}) {
    this.flow = flow;
    this.limit = Math.max(1, Math.round(options.limit ?? DEFAULT_LIMIT));
    this.canUndo = computed(() => this.indexRef.value > 0);
    this.canRedo = computed(() => this.indexRef.value < this.sizeRef.value - 1);
  }

  /** Whether start() took the first state. */
  get started(): boolean {
    return this.entries.length > 0;
  }

  /**
   * Takes the graph as it is as the first state — once it has its nodes
   * (useFlowHistory calls it on Vue Flow's init). Forgets every step.
   */
  start(): void {
    this.entries = [this.read()];
    this.index = 0;
    this.sync();
  }

  /**
   * Records the state at the end of this task: what the end of a gesture
   * calls. Changes made together — removing a node removes its edges, two
   * change events — make one step.
   */
  record(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.commit();
    });
  }

  /**
   * Records the state now, if it differs from the last one — after a change
   * of the app's own (a node's data, nodes or edges set from code).
   * Discards the steps undo() had walked back from. Returns whether a step
   * was recorded: never inside batch().
   */
  commit(): boolean {
    if (this.batchDepth > 0) return false;
    if (!this.started) {
      this.start();
      return false;
    }
    const entry = this.read();
    if (entry === this.entries[this.index]) return false;
    this.entries.length = this.index + 1;
    this.entries.push(entry);
    if (this.entries.length > this.limit + 1) this.entries.shift();
    this.index = this.entries.length - 1;
    this.sync();
    return true;
  }

  /**
   * Runs `fn` and records what it changed as one step, the steps that
   * would be recorded meanwhile folded in. For an `fn` returning a promise,
   * once it settles.
   */
  batch(fn: () => void): void;
  batch(fn: () => Promise<void>): Promise<void>;
  batch(fn: () => void | Promise<void>): void | Promise<void> {
    this.batchDepth++;
    let result: void | Promise<void>;
    try {
      result = fn();
    } catch (error) {
      this.batchDepth--;
      throw error;
    }
    if (!(result instanceof Promise)) {
      this.endBatch();
      return;
    }
    return result.finally(() => this.endBatch());
  }

  /**
   * Goes back one step: a change not recorded yet is recorded first, so it
   * is what gets undone. Returns false — doing nothing — with nothing to go
   * back to, or while a gesture is in progress.
   */
  undo(): boolean {
    if (this.flow.isBusy() || !this.started) return false;
    this.commit();
    if (this.index === 0) return false;
    this.go(this.index - 1);
    return true;
  }

  /** Goes forward one step undo() went back from. Same rules as undo. */
  redo(): boolean {
    if (this.flow.isBusy() || !this.started) return false;
    // A change since the last undo starts a new branch: nothing to redo.
    this.commit();
    if (this.index >= this.entries.length - 1) return false;
    this.go(this.index + 1);
    return true;
  }

  /** Forgets every step: the graph as it is becomes the only one. */
  clear(): void {
    this.start();
  }

  private endBatch(): void {
    this.batchDepth--;
    if (this.batchDepth === 0) this.commit();
  }

  private go(target: number): void {
    const { nodes, edges } = JSON.parse(this.entries[target]!) as { nodes: Node[]; edges: Edge[] };
    this.flow.setNodes(nodes);
    this.flow.setEdges(edges);
    // The entry becomes what Vue Flow made of it (defaults filled in), so
    // the next commit never takes the difference for a new step.
    this.entries[target] = this.read();
    this.index = target;
    this.sync();
  }

  private read(): string {
    const { nodes, edges } = this.flow.toObject();
    return JSON.stringify({ nodes, edges });
  }

  private sync(): void {
    this.indexRef.value = this.index;
    this.sizeRef.value = this.entries.length;
  }
}

export interface UseFlowHistoryOptions extends FlowHistoryOptions {
  /** The Vue Flow to follow, by id (default: the one of this component, as useVueFlow). */
  id?: string;
  /**
   * Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes (default false) —
   * not while typing in a field.
   */
  keys?: boolean;
}

/**
 * Undo/redo for the Vue Flow of this component (a FlowHistory): call it
 * where you call useVueFlow, before <VueFlow> renders. A step is recorded
 * at the end of every gesture — a node or a selection dropped, an edge's
 * end moved, nodes or edges added or removed (a connection made, Delete
 * pressed) — and on history.commit() after a change of the app's own
 * (node data, say). The viewport and the selection are never steps.
 */
export function useFlowHistory(options: UseFlowHistoryOptions = {}): FlowHistory {
  const flow = options.id === undefined ? useVueFlow() : useVueFlow(options.id);
  const history = new FlowHistory(
    {
      toObject: () => flowSnapshot(flow.toObject()),
      setNodes: (nodes) => flow.setNodes(nodes),
      setEdges: (edges) => flow.setEdges(edges),
      isBusy: () =>
        flow.connectionStartHandle.value !== null || flow.getNodes.value.some((n) => n.dragging),
    },
    options
  );

  flow.onInit(() => history.start());
  flow.onNodeDragStop(() => history.record());
  flow.onSelectionDragStop(() => history.record());
  flow.onEdgeUpdateEnd(() => history.record());
  const addsOrRemoves = (changes: { type: string }[]) =>
    changes.some((change) => change.type === 'add' || change.type === 'remove');
  flow.onNodesChange((changes) => addsOrRemoves(changes) && history.record());
  flow.onEdgesChange((changes) => addsOrRemoves(changes) && history.record());

  if (options.keys && typeof window !== 'undefined') {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) history.undo();
      else if ((key === 'z' && event.shiftKey) || key === 'y') history.redo();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    if (getCurrentScope()) onScopeDispose(() => window.removeEventListener('keydown', onKey));
  }
  return history;
}

/** Whether `target` is somewhere the user types (where Ctrl+Z belongs to the field). */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}
