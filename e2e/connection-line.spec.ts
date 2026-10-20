import { expect, test, type Page } from '@playwright/test';
import {
  cableCount,
  cables,
  centerOf,
  collectErrors,
  distance,
  edgeCount,
  frames,
  openFlow,
} from './helpers';

/**
 * The connection-line route (Vue Flow's example): the connection line is
 * a cable pulled out of its handle, the very same cable once it becomes an
 * edge; released on no handle, it goes.
 */

let errors: string[];

test.beforeEach(async ({ page }) => {
  errors = collectErrors(page);
  await openFlow(page, '/', 4);
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

const handle = (node: string, type: 'source' | 'target') =>
  `.vue-flow__node[data-id="${node}"] .vue-flow__handle.${type}`;

/** The connection line's path while one is being drawn, null otherwise. */
const connectionPath = (page: Page) =>
  page.evaluate(
    () => document.querySelector('.vue-flow__connection-path')?.getAttribute('d') ?? null
  );

test('pulls a cable out of a connected handle and plugs it into another as an edge', async ({
  page,
}) => {
  // The oscillator's handle has a cable already, drawn over it: pressing
  // the handle still starts a connection (CaviEdge's clearance).
  const from = await centerOf(page, handle('osc', 'source'));
  const to = await centerOf(page, handle('delay', 'target'));

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 15 });
  // While drawn, the line is a cable: a curve, not Vue Flow's own path.
  await expect.poll(async () => (await connectionPath(page))?.includes('C')).toBe(true);
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await frames(page);
  await page.mouse.up();

  await expect.poll(() => edgeCount(page)).toBe(5);
  await expect.poll(() => cableCount(page)).toBe(5);
  const added = (await cables(page)).find((c) => c.label === 'Edge from osc to delay')!;
  // Vue Flow's point on the handle's side, a few pixels from its center.
  expect(distance(added.start, from)).toBeLessThan(10);
  expect(distance(added.end, to)).toBeLessThan(10);
});

test('a connection released on no handle goes away', async ({ page }) => {
  const from = await centerOf(page, handle('osc', 'source'));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y + 200, { steps: 15 });
  await expect.poll(() => connectionPath(page)).not.toBeNull();
  await page.mouse.up();

  await expect.poll(() => connectionPath(page)).toBeNull();
  expect(await edgeCount(page)).toBe(4);
});

test('a cable is still selected by a click anywhere away from its handles', async ({ page }) => {
  const middle = async () =>
    (await cables(page)).find((c) => c.label === 'Edge from osc to filter')!;
  // Settled first: a cable still falling is not where it was read.
  let last = await middle();
  await expect
    .poll(async () => {
      const now = await middle();
      const moved = distance(now.middle, last.middle);
      last = now;
      return moved;
    })
    .toBeLessThan(0.5);

  // What the pointer would hit there is the cable's interaction path (not
  // clipped out away from the handles). Checked without moving the real
  // mouse: CaviPointer pushes cables away from it, so on a slow machine the
  // cable could be gone from under a real click.
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    if (!el?.classList.contains('vue-flow__edge-interaction')) return null;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    return el.closest('.vue-flow__edge')?.getAttribute('data-id') ?? null;
  }, last.middle);
  expect(hit).toBe(last.id);

  await expect(page.locator(`.vue-flow__edge[data-id="${last.id}"]`)).toHaveClass(/selected/);
});
