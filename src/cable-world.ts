import {
  RENDER_BEZIER,
  World,
  forEachWireRender,
  initWasm,
  svgPathData,
  type Node,
  type Wire,
} from 'cavijs/core';

/** How a cable looks and how long it is — see CableWorld.createCable. */
export interface CableStyle {
  /** Rest distance between neighbouring nodes, in flow units (default 20). */
  linkDistance?: number;
  /** Collision radius of the cable in the simulation (default 5). */
  radius?: number;
  /** RENDER_BEZIER (default) or RENDER_SEGMENTS. */
  renderType?: number;
  /**
   * How much rope a cable has to hang with (default 1.15): its rest length
   * stretches the horizontal gap between its ends by this much, and not
   * the vertical one, where spare rope can't hang (see Cable.restLength).
   * 1 pulls it taut.
   */
  slack?: number;
  /** Fewest and most nodes a cable has (default 4 and 80). */
  minNodes?: number;
  maxNodes?: number;
  /**
   * How much the cable resists bending, 0 to 1 (default 0.3; see cavijs's
   * Wire.setBendStiffness): 0 is a chain that hangs straight down from a
   * handle and folds; stiffer, it curves smoothly and, with followHandles,
   * leaves each handle along the handle's side (see Cable.setEnds).
   */
  bendStiffness?: number;
  /**
   * Whether each end leaves its handle along the handle's side (default
   * false: the ends are free points, and a stiff cable curves away from
   * them whichever way it hangs). True: the cable comes out of each handle
   * along `sourcePosition`/`targetPosition` and curves away gradually.
   */
  followHandles?: boolean;
}

/** A unit vector an end leaves its handle along — see directionOf. */
export interface Direction {
  x: number;
  y: number;
}

const DIRECTIONS: Record<string, Direction> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** The way out of a handle at Vue Flow's `Position` ('top', 'bottom', ...); null for none. */
export function directionOf(position: string | null | undefined): Direction | null {
  return (position && DIRECTIONS[position]) || null;
}

export interface CableWorldOptions {
  /** Gravity, in flow units (default { x: 0, y: 5 }, as <cavi-world>). */
  gravity?: { x: number; y: number };
  /** Physics steps per second (default 60). */
  stepRate?: number;
  /**
   * Link relaxation passes per sub-step (default 4, cavijs's own is 1):
   * more stretch the cables less under their own weight, so an edge hangs
   * close to its rest length instead of sagging under its nodes.
   */
  stiffness?: number;
  /**
   * The share of its velocity a node keeps at every sub-step, 0 to 1
   * (engine default 0.95; see cavijs's World.setFriction). Despite the name,
   * lower means more friction: around 0.85–0.9 cables stop swinging much
   * sooner. It applies once per sub-step, so small changes show.
   */
  friction?: number;
  /** Radius within which the pointer pushes cables away (engine default if unset). */
  pointerRadius?: number;
  /** Defaults for every cable this world creates. */
  cableStyle?: CableStyle;
}

/** A frame scheduler: requestAnimationFrame, or a stand-in for tests. */
export interface FrameScheduler {
  request(callback: (now: number) => void): number;
  cancel(handle: number): void;
}

const ANIMATION_FRAMES: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

/**
 * How long a released connection line waits for the edge that takes it
 * over (see CableWorld.park): Vue Flow mounts the new edge a render or two
 * after the line goes away.
 */
const ADOPT_WINDOW_MS = 150;
/** How far an adopted cable's start may be from the new edge's end (flow units). */
const ADOPT_START_TOLERANCE = 4;
/** ...and its free end from the other one: the line may have stopped short of a handle. */
const ADOPT_END_TOLERANCE = 80;
/** Nodes a cable keeps beyond what its distance needs before it is shortened. */
const SHRINK_HYSTERESIS = 4;

/**
 * One cable of a CableWorld: a cavijs wire with its two ends pinned where
 * it is told (setEnds) — the only nodes held, everything between hangs
 * free — its node count following the distance between them, and its
 * shape handed out as SVG path data every frame it changes.
 */
export class Cable {
  readonly wire: Wire;
  /** The latest SVG path data (flow coordinates). */
  path: string;
  /** Called with the new path whenever the cable's shape changed. */
  onPath: ((path: string) => void) | null = null;

  private readonly owner: CableWorld;
  private readonly style: Required<CableStyle>;
  /** Handles of the two terminals — they follow their nodes as nodes are inserted. */
  private readonly ends: [Node, Node];
  /** Ends are swapped: setEnds' source goes to the wire's last node (see CableWorld.adopt). */
  private reversed = false;
  /** The directions last given to the wire's first and last node (see setEnds). */
  private directions: [Direction | null, Direction | null] = [null, null];
  /** @internal — the render record last turned into `path` (see CableWorld.tick). */
  drawn: Float32Array = new Float32Array(0);
  private disposed = false;

  /** @internal — use CableWorld.createCable. */
  constructor(
    owner: CableWorld,
    style: Required<CableStyle>,
    sx: number,
    sy: number,
    tx: number,
    ty: number
  ) {
    this.owner = owner;
    this.style = style;
    const count = this.nodesFor(sx, sy, tx, ty);
    this.wire = owner.world.addWire(
      sx,
      sy,
      tx,
      ty,
      count,
      style.linkDistance,
      style.radius,
      style.renderType
    );
    this.ends = [this.wire.getNode(0)!, this.wire.getNode(count - 1)!];
    for (const end of this.ends) end.fixed = true;
    this.wire.setBendStiffness(style.bendStiffness);
    this.path = `M ${sx} ${sy} L ${tx} ${ty}`;
  }

  /**
   * Pins the ends at (sx, sy) and (tx, ty) — the edge's source and target —
   * and grows or shortens the cable to the distance between them; nodes
   * already there keep their physics state. The directions (see
   * directionOf; null: none) are the sides the ends leave their handles
   * by: with followHandles and a bend stiffness, the cable comes out of
   * each handle along it; otherwise they are ignored.
   */
  setEnds(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    sourceDirection: Direction | null = null,
    targetDirection: Direction | null = null
  ): void {
    if (this.disposed) return;
    const desired = this.nodesFor(sx, sy, tx, ty);
    const count = this.wire.getNodeCount();
    if (desired > count) this.wire.growTo(desired);
    else if (count - desired > SHRINK_HYSTERESIS) this.wire.shrinkTo(desired);
    // In the wire's own order: its first node is the source unless reversed.
    const [first, last] = this.reversed ? [this.ends[1], this.ends[0]] : this.ends;
    this.pin(first, sx, sy);
    this.pin(last, tx, ty);
    const [d0, d1] = this.reversed
      ? [targetDirection, sourceDirection]
      : [sourceDirection, targetDirection];
    this.direct(0, d0);
    this.direct(1, d1);
  }

  /** Whether the end at (x, y) is this cable's first node — see CableWorld.adopt. */
  startsAt(x: number, y: number, tolerance: number): boolean {
    return Math.hypot(this.ends[0].x - x, this.ends[0].y - y) <= tolerance;
  }

  endsAt(x: number, y: number, tolerance: number): boolean {
    return Math.hypot(this.ends[1].x - x, this.ends[1].y - y) <= tolerance;
  }

  /** @internal — see CableWorld.adopt. */
  setReversed(reversed: boolean): void {
    this.reversed = reversed;
  }

  /**
   * Marks the cable as held — its free end follows the pointer, so the
   * pointer no longer pushes the cable's own nodes away. See World.holdWire.
   */
  hold(held: boolean): void {
    if (this.disposed) return;
    if (held) this.owner.world.holdWire(this.wire);
    else this.owner.world.releaseHeldWire(this.wire);
  }

  /** Deletes the cable from the simulation. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.onPath = null;
    this.owner.remove(this);
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Gives the wire's end `end` its direction, if it changed (changing it wakes the cable). */
  private direct(end: 0 | 1, given: Direction | null): void {
    const direction = this.style.followHandles ? given : null;
    if (this.directions[end] === direction) return;
    this.directions[end] = direction;
    this.wire.setEndDirection(end, direction);
  }

  private pin(node: Node, x: number, y: number): void {
    if (node.x !== x || node.y !== y) node.setPosition(x, y);
    if (!node.fixed) node.fixed = true;
  }

  /**
   * Nodes for the cable's rest length: the gap between its ends with the
   * horizontal stretched by `slack` — rope to spare only where it can hang.
   * Across a vertical gap, extra rope has nowhere to go and buckles the
   * cable sideways. Not cavijs's nodeCountForDistance either: the jack rule
   * starts from 4 nodes whatever the distance, the same extra rope.
   */
  private nodesFor(sx: number, sy: number, tx: number, ty: number): number {
    const { linkDistance, slack, minNodes, maxNodes } = this.style;
    const links = Math.round(Math.hypot(ty - sy, (tx - sx) * slack) / linkDistance);
    return Math.min(maxNodes, Math.max(minNodes, links + 1));
  }
}

/**
 * One cavijs World for a whole Vue Flow graph: owns the simulation and its
 * frame loop, the cables of the edges and of the connection line, and hands
 * each cable its SVG path whenever its shape changes. Flow coordinates are
 * world coordinates — edges are drawn inside Vue Flow's own transformed
 * SVG, so there is no transform to keep in step. Plain TypeScript: the Vue
 * side (provideCables/useCables, CaviEdge, CaviConnectionLine) is a thin
 * layer over it.
 */
export class CableWorld {
  readonly world: World;
  private readonly cables = new Map<Wire, Cable>();
  private readonly style: Required<CableStyle>;
  /** Connection-line cables waiting for their edge (see park/adopt). */
  private parked: { cable: Cable; timer: ReturnType<typeof setTimeout> }[] = [];
  private scheduler: FrameScheduler | null = null;
  private frameHandle = 0;
  private lastFrame: number | null = null;
  private destroyed = false;

  /** Loads the cavi WASM module (once per page) and creates a world. */
  static async create(options: CableWorldOptions = {}): Promise<CableWorld> {
    await initWasm();
    return new CableWorld(options);
  }

  /** Needs the WASM module loaded — see create. */
  constructor(options: CableWorldOptions = {}) {
    this.world = new World();
    const gravity = options.gravity ?? { x: 0, y: 5 };
    this.world.setAcceleration(gravity.x, gravity.y);
    if (options.stepRate !== undefined) this.world.setStepRate(options.stepRate);
    this.world.setConstraintIterations(options.stiffness ?? 4);
    if (options.friction !== undefined) this.world.setFriction(options.friction);
    if (options.pointerRadius !== undefined) this.world.setMouseRadius(options.pointerRadius);
    this.style = {
      linkDistance: 20,
      radius: 5,
      renderType: RENDER_BEZIER,
      slack: 1.15,
      minNodes: 4,
      maxNodes: 80,
      bendStiffness: 0.3,
      followHandles: false,
      ...options.cableStyle,
    };
  }

  /** A new cable from (sx, sy) to (tx, ty), both ends pinned. */
  createCable(sx: number, sy: number, tx: number, ty: number, style: CableStyle = {}): Cable {
    const cable = new Cable(this, { ...this.style, ...style }, sx, sy, tx, ty);
    this.cables.set(cable.wire, cable);
    return cable;
  }

  /**
   * Keeps a connection line's cable for a moment after the line goes away,
   * for the edge it may have just become to take over (adopt) — so the
   * cable carries on with its shape instead of being replaced. Not taken
   * over in time (the line was released on no handle), it is removed:
   * nothing draws it any more.
   */
  park(cable: Cable): void {
    if (cable.isDisposed) return;
    const timer = setTimeout(() => {
      this.parked = this.parked.filter((p) => p.cable !== cable);
      cable.dispose();
    }, ADOPT_WINDOW_MS);
    this.parked.push({ cable, timer });
  }

  /**
   * The parked cable that started at one end of a new edge from (sx, sy) to
   * (tx, ty) and was released near the other, if any — taken out of the
   * parking. The connection may have been drawn from the edge's target
   * handle: the cable is then turned round, so setEnds keeps working with
   * the edge's source first.
   */
  adopt(sx: number, sy: number, tx: number, ty: number): Cable | null {
    for (let i = this.parked.length - 1; i >= 0; i--) {
      const { cable, timer } = this.parked[i]!;
      const forward =
        cable.startsAt(sx, sy, ADOPT_START_TOLERANCE) && cable.endsAt(tx, ty, ADOPT_END_TOLERANCE);
      const backward =
        cable.startsAt(tx, ty, ADOPT_START_TOLERANCE) && cable.endsAt(sx, sy, ADOPT_END_TOLERANCE);
      if (!forward && !backward) continue;
      clearTimeout(timer);
      this.parked.splice(i, 1);
      cable.hold(false);
      cable.setReversed(backward && !forward);
      return cable;
    }
    return null;
  }

  /** The pointer is at (x, y), in flow coordinates: cables near it are pushed away. */
  setPointer(x: number, y: number): void {
    this.world.setMouse(x, y);
  }

  /** The pointer left: nothing pushes cables any more. */
  releasePointer(): void {
    this.world.releaseMouse();
  }

  /** Starts the frame loop (requestAnimationFrame unless told otherwise). Idempotent. */
  start(scheduler: FrameScheduler = ANIMATION_FRAMES): void {
    if (this.scheduler || this.destroyed) return;
    this.scheduler = scheduler;
    this.lastFrame = null;
    const frame = (now: number): void => {
      const elapsed = this.lastFrame === null ? 0 : now - this.lastFrame;
      this.lastFrame = now;
      this.tick(elapsed);
      this.frameHandle = scheduler.request(frame);
    };
    this.frameHandle = scheduler.request(frame);
  }

  stop(): void {
    this.scheduler?.cancel(this.frameHandle);
    this.scheduler = null;
  }

  /**
   * One frame: advances the simulation by `elapsedMs` and hands every cable
   * whose shape changed its new path. Called by the loop (start); call it
   * yourself to drive the world from a loop of your own.
   */
  tick(elapsedMs: number): void {
    if (this.destroyed) return;
    this.world.advance(elapsedMs);
    forEachWireRender(this.world, ({ wire, path, renderType, record }) => {
      const cable = this.cables.get(wire);
      if (!cable || sameValues(cable.drawn, record)) return;
      cable.drawn = record.slice();
      cable.path = svgPathData(path, renderType);
      cable.onPath?.(cable.path);
    });
  }

  /** Stops the loop and frees the simulation. Idempotent. */
  destroy(): void {
    if (this.destroyed) return;
    this.stop();
    for (const { timer } of this.parked) clearTimeout(timer);
    this.parked = [];
    this.cables.clear();
    this.destroyed = true;
    this.world.destroy();
  }

  /** @internal — see Cable.dispose. */
  remove(cable: Cable): void {
    if (this.cables.get(cable.wire) !== cable) return;
    this.cables.delete(cable.wire);
    if (!this.destroyed) this.world.deleteWire(cable.wire);
  }
}

function sameValues(a: Float32Array, b: Float32Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
