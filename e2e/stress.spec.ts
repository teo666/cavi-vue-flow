import { expect, test, type Page } from '@playwright/test';
import { cables, collectErrors, edgeCount, openFlow } from './helpers';

/**
 * The stress route: boxes chained by cables, and the cables' frame loop,
 * which rests once every cable is asleep and wakes when something changes
 * — read from the page's own stats line.
 */

let errors: string[];

test.beforeEach(async ({ page }) => {
  errors = collectErrors(page);
  await openFlow(page, '/stress', 99);
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

const stats = (page: Page) => page.locator('.controls .stats');
const RESTING = /0 awake · loop resting/;
const RUNNING = /[1-9]\d* awake · loop running/;

test('the loop rests once the cables have settled', async ({ page }) => {
  await expect(stats(page)).toHaveText(RESTING, { timeout: 15_000 });
});

test('dragging a box wakes the loop, which rests again once its cables settle', async ({
  page,
}) => {
  await expect(stats(page)).toHaveText(RESTING, { timeout: 15_000 });
  const box = (await page.locator('.vue-flow__node[data-id="box-45"]').boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 60, at.y + 90, { steps: 30 });
  await expect(stats(page)).toHaveText(RUNNING);
  await page.mouse.up();
  await page.mouse.move(5, 5); // out of the cables' way

  await expect(stats(page)).toHaveText(RESTING, { timeout: 15_000 });
});

test('the pointer on a cable wakes that cable alone', async ({ page }) => {
  await expect(stats(page)).toHaveText(RESTING, { timeout: 15_000 });
  const { middle } = (await cables(page))[40]!;

  await page.mouse.move(middle.x - 30, middle.y - 30);
  await page.mouse.move(middle.x, middle.y, { steps: 10 });

  await expect(stats(page)).toHaveText(/\b[1-3] awake · loop running/);
  await page.mouse.move(5, 5);
  await expect(stats(page)).toHaveText(RESTING, { timeout: 15_000 });
});

test('shuffles the boxes and puts them back, the cables following', async ({ page }) => {
  const before = (await cables(page)).map((c) => Math.round(c.start.x));
  await page.getByRole('button', { name: 'Shuffle' }).click();
  await expect
    .poll(async () => (await cables(page)).map((c) => Math.round(c.start.x)))
    .not.toEqual(before);

  await page.getByRole('button', { name: 'Grid' }).click();
  await expect
    .poll(async () => (await cables(page)).map((c) => Math.round(c.start.x)))
    .toEqual(before);
});

test('builds another number of boxes, a cable fewer than boxes', async ({ page }) => {
  const count = page.locator('.controls input[type="range"]').first();
  await count.fill('200');
  await count.dispatchEvent('change');

  await expect(page.getByText('200 boxes, 199 cables')).toBeVisible();
  await expect.poll(() => edgeCount(page)).toBe(199);
});
