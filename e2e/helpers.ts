import { expect, type Page } from '@playwright/test';

export interface Point {
  x: number;
  y: number;
}

/** Every console error, uncaught exception and failed request of `page`, collected from now on. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    // Reported with its URL by the 'response' handler below.
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`${res.status()} ${res.url()}`);
  });
  return errors;
}

/** Opens a route and waits until every edge is drawn as a cable (a curve, not the straight stand-in). */
export async function openFlow(page: Page, route: string, edges: number): Promise<void> {
  await page.goto(route);
  await expect.poll(() => cableCount(page), { timeout: 15_000 }).toBe(edges);
}

/** Edges drawn as cables: their path is a curve (CaviEdge's straight stand-in is `M … L …`). */
export function cableCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('.vue-flow__edge .vue-flow__edge-path')].filter((p) =>
        p.getAttribute('d')?.includes('C')
      ).length
  );
}

export function edgeCount(page: Page): Promise<number> {
  return page.locator('.vue-flow__edge').count();
}

/** Where a handle's center is on screen. */
export async function handleAt(page: Page, node: string, handle: string): Promise<Point> {
  const box = await page
    .locator(`.vue-flow__node[data-id="${node}"] .vue-flow__handle[data-handleid="${handle}"]`)
    .boundingBox();
  expect(box, `handle ${node}.${handle} is on screen`).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/** Center of an element, on screen. */
export async function centerOf(page: Page, selector: string): Promise<Point> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} is on screen`).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/** One edge as drawn: its id, Vue Flow's label, its path's ends and middle on screen, its stroke width. */
export interface DrawnCable {
  id: string;
  label: string;
  start: Point;
  end: Point;
  middle: Point;
  /** Stroke width in flow units. */
  width: number;
}

export function cables(page: Page): Promise<DrawnCable[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.vue-flow__edge')].map((g) => {
      const path = g.querySelector('.vue-flow__edge-path') as SVGPathElement;
      const m = path.getScreenCTM()!;
      const toScreen = (p: DOMPoint) => ({ x: p.x * m.a + m.e, y: p.y * m.d + m.f });
      const length = path.getTotalLength();
      return {
        id: g.getAttribute('data-id')!,
        label: g.getAttribute('aria-label')!,
        start: toScreen(path.getPointAtLength(0)),
        end: toScreen(path.getPointAtLength(length)),
        middle: toScreen(path.getPointAtLength(length / 2)),
        width: parseFloat(getComputedStyle(path).strokeWidth),
      };
    })
  );
}

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Waits for `n` animation frames inside the page. */
export async function frames(page: Page, n = 2): Promise<void> {
  await page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) await new Promise((r) => requestAnimationFrame(r));
  }, n);
}

/**
 * Presses at `from`, drags to `to` in small steps and lets go there, with
 * the real mouse — after a last nudge and a couple of frames on `to`, so
 * Vue Flow has seen the handle under the pointer even on a busy machine.
 */
export async function drag(page: Page, from: Point, to: Point, steps = 20): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x + 1, to.y + 1, { steps });
  await page.mouse.move(to.x, to.y);
  await frames(page);
  await page.mouse.up();
}
