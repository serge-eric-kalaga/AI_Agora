import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

test('desktop visual inspection and participant changes preserve conversation history', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const folder = path.resolve('../design/preview');
  mkdirSync(folder, { recursive: true });
  for (const [route, name] of [
    ['/fr', 'dashboard'],
    ['/fr/agents', 'agents'],
    ['/fr/agents/nova', 'agent-editor'],
    ['/fr/rooms/new', 'room-wizard'],
    ['/fr/providers', 'providers'],
    ['/fr/rooms/ethique-ia', 'chat'],
  ]) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: path.join(folder, `${name}-desktop.png`), fullPage: true });
  }
  const originalCount = await page.locator('.message').count();
  await page.getByRole('button', { name: 'Retirer de la salle Atlas' }).click();
  await expect(page.locator('.message')).toHaveCount(originalCount);
  await expect(page.locator('.room-inspector .participant')).toHaveCount(3);
  await page.getByRole('button', { name: 'Ajouter un participant', exact: true }).click();
  await page.getByRole('dialog').getByRole('combobox').selectOption('orion');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.locator('.room-inspector .participant')).toHaveCount(4);
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await page.getByRole('button', { name: 'Répondre Nova' }).click();
  await page
    .getByRole('textbox', { name: /Partagez une idée/ })
    .fill('Cette proposition mérite une expérimentation.');
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page.locator('.human-message blockquote')).toContainText('@Atlas');
  await page.reload();
  await expect(page.locator('.human-message blockquote')).toContainText('@Atlas');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/fr');
  await expect(page.locator('h1')).toBeVisible();
  await page.screenshot({ path: path.join(folder, 'dashboard-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});
