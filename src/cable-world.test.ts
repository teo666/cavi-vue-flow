/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initWasm } from 'cavijs/core';
import { CableWorld, type FrameScheduler } from './cable-world';

/**
 * CableWorld against the real cavi engine, in plain Node: cables pinned to
 * their ends, sized by distance, handed over from the connection line to
 * the edge, dropped when nobody takes them.
 */
beforeAll(async () => {
  // The .wasm of the `cavi` that the linked cavijs resolves.
  await initWasm(readFileSync('node_modules/cavijs/node_modules/cavi/cavi_bg.wasm'));
});

afterEach(() => {
  vi.useRealTimers();
});

/** Runs `n` frames of 1/60 s. */
function frames(world: CableWorld, n: number): void {
  for (let i = 0; i < n; i++) world.tick(1000 / 60);
}

describe('Cable', () => {
  it('starts straight, pinned at both ends, sized by distance with some slack', () => {
    const world = new CableWorld();
    const cable = world.createCable(0, 0, 160, 0);

    expect(cable.path).toBe('M 0 0 L 160 0');
    // Horizontal: 160 × 1.15 slack = 184 of rest length, 9 links of 20.
    expect(cable.wire.getNodeCount()).toBe(10);
    // Vertical: no slack, 160 = 8 links.
    expect(world.createCable(0, 0, 0, 160).wire.getNodeCount()).toBe(9);
    const last = cable.wire.getNodeCount() - 1;
    expect(cable.wire.getNode(0)!.fixed && cable.wire.getNode(last)!.fixed).toBe(true);
    world.destroy();
  });

  it('hands out its shape as SVG path data, only when it changed', () => {
    const world = new CableWorld();
    const cable = world.createCable(0, 0, 200, 0);
    const onPath = vi.fn();
    cable.onPath = onPath;

    frames(world, 1);
    expect(onPath).toHaveBeenCalledTimes(1);
    expect(cable.path).toMatch(/^M 0 0 C /);

    frames(world, 600); // swings, then settles and sleeps
    onPath.mockClear();
    frames(world, 5);
    expect(onPath).not.toHaveBeenCalled();
    world.destroy();
  });

  it('follows its ends, growing as they part and shortening once well too long', () => {
    const world = new CableWorld();
    const cable = world.createCable(0, 0, 100, 0);
    const before = cable.wire.getNodeCount();

    cable.setEnds(0, 0, 400, 0);
    const grown = cable.wire.getNodeCount();
    expect(grown).toBeGreaterThan(before);
    const last = cable.wire.getNode(grown - 1)!;
    expect([last.x, last.y, last.fixed]).toEqual([400, 0, true]);

    cable.setEnds(0, 0, 380, 0); // a little closer: kept as it is
    expect(cable.wire.getNodeCount()).toBe(grown);

    cable.setEnds(0, 0, 100, 0); // much closer: shortened
    expect(cable.wire.getNodeCount()).toBe(before);
    expect(cable.wire.getNode(before - 1)).toBe(last);
    world.destroy();
  });

  it("leaves its ends free by default, giving them the handles' directions when told to", () => {
    const world = new CableWorld();
    const free = world.createCable(0, 0, 100, 0);
    const following = world.createCable(0, 0, 100, 0, { followHandles: true });
    for (const cable of [following, free]) {
      cable.setEnds(0, 0, 100, 0, { x: 1, y: 0 }, { x: 0, y: -1 });
    }

    expect(following.wire.getEndDirection(0)).toEqual({ x: 1, y: 0 });
    expect(following.wire.getEndDirection(1)).toEqual({ x: 0, y: -1 });
    expect(free.wire.getEndDirection(0)).toBe(null);
    expect(free.wire.getEndDirection(1)).toBe(null);
    expect(free.wire.getBendStiffness()).toBeCloseTo(0.3); // still stiff
    world.destroy();
  });

  it('is deleted from the simulation, leaving the other cables drawn', () => {
    const world = new CableWorld();
    const a = world.createCable(0, 0, 100, 0);
    const b = world.createCable(0, 50, 100, 50);
    a.dispose();
    a.dispose();

    expect(world.world.getWireCount()).toBe(1);
    const onPath = vi.fn();
    b.onPath = onPath;
    frames(world, 1);
    expect(onPath.mock.calls[0]![0]).toMatch(/^M 0 50 /);
    world.destroy();
  });
});

describe('CableWorld — from connection line to edge', () => {
  it('hands a parked cable over to the edge it became', () => {
    const world = new CableWorld();
    const line = world.createCable(10, 10, 300, 200);
    world.park(line);

    expect(world.adopt(10, 10, 320, 210)).toBe(line);
    expect(world.adopt(10, 10, 320, 210)).toBe(null); // taken
    world.destroy();
  });

  it('turns a cable drawn from the target handle round', () => {
    const world = new CableWorld();
    const line = world.createCable(300, 200, 12, 14); // pulled from the target side
    world.park(line);

    const cable = world.adopt(10, 10, 300, 200)!;
    expect(cable).toBe(line);
    cable.setEnds(10, 10, 300, 200); // source first, as the edge says
    const last = cable.wire.getNodeCount() - 1;
    expect([cable.wire.getNodeX(0), cable.wire.getNodeY(0)]).toEqual([300, 200]);
    expect([cable.wire.getNodeX(last), cable.wire.getNodeY(last)]).toEqual([10, 10]);
    world.destroy();
  });

  it('adopts nothing from another handle', () => {
    const world = new CableWorld();
    world.park(world.createCable(10, 10, 300, 200));
    expect(world.adopt(50, 10, 300, 200)).toBe(null);
    world.destroy();
  });

  it('removes a cable nobody took over', () => {
    vi.useFakeTimers();
    const world = new CableWorld();
    const line = world.createCable(10, 10, 300, 200);
    world.park(line);

    vi.advanceTimersByTime(100);
    expect(line.isDisposed).toBe(false);
    vi.advanceTimersByTime(100);
    expect(line.isDisposed).toBe(true);
    expect(world.world.getWireCount()).toBe(0);
    expect(world.adopt(10, 10, 300, 200)).toBe(null);
    world.destroy();
  });
});

describe('CableWorld — options', () => {
  it('sets the friction, leaving the engine default otherwise', () => {
    const plain = new CableWorld();
    const damped = new CableWorld({ friction: 0.85 });
    expect(plain.world.getFriction()).toBeCloseTo(0.95);
    expect(damped.world.getFriction()).toBeCloseTo(0.85);
    plain.destroy();
    damped.destroy();
  });

  it('stops a swinging cable sooner with more friction (a lower value)', () => {
    const swing = (friction: number) => {
      const world = new CableWorld({ friction });
      const cable = world.createCable(0, 0, 300, 0);
      let frames = 0;
      let moving = true;
      cable.onPath = () => (moving = true);
      while (moving && frames < 2000) {
        moving = false;
        world.tick(1000 / 60);
        frames++;
      }
      world.destroy();
      return frames;
    };
    expect(swing(0.85)).toBeLessThan(swing(0.95));
  });
});

describe('CableWorld — frame loop', () => {
  it('advances by the time between frames of its scheduler', () => {
    const callbacks: ((now: number) => void)[] = [];
    const scheduler: FrameScheduler = {
      request: (cb) => callbacks.push(cb),
      cancel: vi.fn(),
    };
    const world = new CableWorld();
    const tick = vi.spyOn(world, 'tick');

    world.start(scheduler);
    world.start(scheduler); // idempotent
    callbacks.shift()!(1000);
    callbacks.shift()!(1016);

    expect(tick.mock.calls.map(([elapsed]) => elapsed)).toEqual([0, 16]);
    world.stop();
    expect(scheduler.cancel).toHaveBeenCalled();
    world.destroy();
    world.destroy();
  });
});
