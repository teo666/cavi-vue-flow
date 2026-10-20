import { expect, test } from '@playwright/test';
import {
  cables,
  collectErrors,
  distance,
  drag,
  edgeCount,
  handleAt,
  openFlow,
  type DrawnCable,
} from './helpers';

/**
 * The patchbay route: jacks inside the modules, cables plugged into their
 * sockets, the patchbay rules (type, size, one cable per input), plugs
 * moved and pulled out, undo and redo.
 */

let errors: string[];

test.beforeEach(async ({ page }) => {
  errors = collectErrors(page);
  await openFlow(page, '/patchbay', 5);
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

/** The cable of edge `id`, as drawn now. */
async function cable(page: import('@playwright/test').Page, id: string): Promise<DrawnCable> {
  const found = (await cables(page)).find((c) => c.id === id);
  expect(found, `edge ${id} is drawn`).toBeDefined();
  return found!;
}

test('draws every patch as a cable plugged into its two sockets, hanging', async ({ page }) => {
  const vcoOut = await handleAt(page, 'vco', 'out');
  const vcfIn = await handleAt(page, 'vcf', 'in');
  await expect
    .poll(async () => {
      const c = (await cables(page)).find((c) => c.label === 'Edge from vco to vcf')!;
      return [distance(c.start, vcoOut) < 2, distance(c.end, vcfIn) < 2];
    })
    .toEqual([true, true]);

  // Hanging: its middle sags below the straight line between its ends.
  await expect
    .poll(async () => {
      const c = (await cables(page)).find((c) => c.label === 'Edge from vco to vcf')!;
      return c.middle.y - (c.start.y + c.end.y) / 2;
    })
    .toBeGreaterThan(10);
});

test('cables are as thick as the jack they come out of', async ({ page }) => {
  const widths = Object.fromEntries((await cables(page)).map((c) => [c.label, c.width]));
  expect(widths['Edge from vco to vcf']).toBe(12); // large audio jacks
  expect(widths['Edge from lfo to vcf']).toBe(6); // mini CV jacks
});

test('patches two free jacks of the same type and size', async ({ page }) => {
  const from = await handleAt(page, 'lfo', 'square');
  const to = await handleAt(page, 'vca', 'cv');
  await drag(page, from, to);

  await expect.poll(() => edgeCount(page)).toBe(6);
  const added = (await cables(page)).find((c) => c.label === 'Edge from lfo to vca')!;
  expect(added.width).toBe(6);
  await expect.poll(async () => distance((await cable(page, added.id)).end, to)).toBeLessThan(2);
});

test('refuses jacks of different sizes, and of different types', async ({ page }) => {
  // Large audio (Output right, free) onto mini audio (VCO sub).
  await drag(page, await handleAt(page, 'out', 'right'), await handleAt(page, 'vco', 'sub'));
  // Mini CV (LFO saw) onto large audio (Output right).
  await drag(page, await handleAt(page, 'lfo', 'saw'), await handleAt(page, 'out', 'right'));

  expect(await edgeCount(page)).toBe(5);
});

test('moves a plug to another jack, keeping the cable', async ({ page }) => {
  const before = (await cables(page)).find((c) => c.label === 'Edge from lfo to vcf')!;
  const cutoff = await handleAt(page, 'vcf', 'cutoff');
  const vcaCv = await handleAt(page, 'vca', 'cv');

  await drag(page, cutoff, vcaCv);

  await expect.poll(() => edgeCount(page)).toBe(5);
  const after = await cable(page, before.id); // the same edge, same id
  expect(after.label).toBe('Edge from lfo to vca');
  await expect
    .poll(async () => distance((await cable(page, before.id)).end, vcaCv))
    .toBeLessThan(2);
});

test('unplugs a cable whose plug is dropped on no jack', async ({ page }) => {
  const cutoff = await handleAt(page, 'vcf', 'cutoff');
  await drag(page, cutoff, { x: cutoff.x + 40, y: cutoff.y + 260 });

  await expect.poll(() => edgeCount(page)).toBe(4);
  expect((await cables(page)).map((c) => c.label)).not.toContain('Edge from lfo to vcf');
});

test('undoes and redoes a patch, with the buttons and the keys', async ({ page }) => {
  const undo = page.getByRole('button', { name: 'Undo' });
  const redo = page.getByRole('button', { name: 'Redo' });
  await expect(undo).toBeDisabled();

  await drag(page, await handleAt(page, 'lfo', 'square'), await handleAt(page, 'vca', 'cv'));
  await expect.poll(() => edgeCount(page)).toBe(6);

  await undo.click();
  await expect.poll(() => edgeCount(page)).toBe(5);
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect.poll(() => edgeCount(page)).toBe(6);

  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => edgeCount(page)).toBe(5);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect.poll(() => edgeCount(page)).toBe(6);
});

test('undoes moving a module, its cables following it back', async ({ page }) => {
  const title = page.locator('.vue-flow__node[data-id="vca"] .module-title');
  const box = (await title.boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const vcaIn = await handleAt(page, 'vca', 'in');

  await drag(page, at, { x: at.x + 120, y: at.y + 80 });
  await expect
    .poll(async () => (await handleAt(page, 'vca', 'in')).x)
    .toBeGreaterThan(vcaIn.x + 100);

  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => distance(await handleAt(page, 'vca', 'in'), vcaIn)).toBeLessThan(1);
  const patched = (await cables(page)).find((c) => c.label === 'Edge from vcf to vca')!;
  await expect
    .poll(async () => distance((await cable(page, patched.id)).end, vcaIn))
    .toBeLessThan(2);
});
