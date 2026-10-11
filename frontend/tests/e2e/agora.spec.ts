import { test, expect } from '@playwright/test';

test('agent, room, conversation and persistence form a complete local workflow', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/fr');
  await expect(page.getByRole('heading', { name: /Bonjour/ })).toBeVisible();
  await page.goto('/fr/agents/new');
  await page.getByLabel('Nom *', { exact: true }).fill('Ariane');
  await page.getByLabel('Rôle & expertise *').fill('Urbaniste');
  await page.getByLabel('Description', { exact: true }).fill('Une urbaniste attentive aux usages.');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('button', { name: 'Appliquer ce profil' }).click();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page
    .getByLabel('Instructions système *')
    .fill('Tu es une urbaniste. Explore les usages et les limites des propositions.');
  await page.getByLabel('Recherche web', { exact: true }).check();
  await page.getByRole('button', { name: 'Enregistrer l’agent' }).click();
  await expect(page).toHaveURL('/fr/agents');
  await expect(page.getByRole('heading', { name: 'Ariane', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ariane', exact: true })).toBeVisible();
  await page.goto('/fr/rooms/new');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.locator('.form-error')).toContainText('Donnez un nom');
  await page.getByLabel('Nom de la salle *').fill('Atelier de test');
  await page.getByLabel('Sujet & objectif *').fill('Comment améliorer les mobilités de quartier ?');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByLabel('Ariane', { exact: true }).check();
  await page.getByLabel('Loki', { exact: true }).check();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page
    .getByLabel('Règles de la conversation', { exact: true })
    .fill('Respecter les autres points de vue.');
  await page.getByLabel('Recherche web', { exact: true }).check();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('radio', { name: /En arrière-plan/ }).check();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('radio', { name: /Partagée sur invitation/ }).check();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByLabel('Budget cloud maximal').fill('1');
  await page.getByLabel('Nombre maximal de réponses IA').fill('2');
  await page.getByRole('button', { name: 'Créer en pause' }).click();
  await expect(
    page.getByRole('heading', { name: 'Atelier de test', exact: true, level: 1 }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: /Partagez une idée/ })
    .fill('@Ariane Bonjour **à toutes et tous**');
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page.locator('.message-text strong')).toHaveText('à toutes et tous');
  await page.getByRole('button', { name: 'Réagir au message 👍', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Réagir au message 👍', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await page.getByRole('button', { name: 'Simuler une réponse' }).click();
  await expect(page.locator('.message')).toHaveCount(2);
  await page.getByRole('button', { name: 'Mettre en pause', exact: true }).click();
  await page.reload();
  await expect(page.locator('.message')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Reprendre', exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter la conversation', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^agora-.*\.json$/);
  expect(errors).toEqual([]);
});

test('filters, global search and provider configuration respond to input', async ({ page }) => {
  await page.goto('/fr/agents');
  await page.getByRole('textbox', { name: /Rechercher par nom/ }).fill('Orion');
  await expect(page.locator('.agent-card')).toHaveCount(1);
  await page.getByRole('button', { name: /Rechercher un agent/ }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Nova');
  await page.getByRole('dialog').getByRole('link', { name: /Nova/ }).click();
  await expect(page.getByRole('heading', { name: 'Configurer votre agent' })).toBeVisible();
  await page.goto('/fr/providers');
  await page.getByRole('button', { name: 'Configurer Ollama' }).click();
  await page.getByLabel('Adresse du serveur').fill('not-a-url');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('.form-error')).toContainText('URL HTTP');
  await page.getByLabel('Adresse du serveur').fill('http://localhost:11435');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.reload();
  await expect(page.locator('code')).toHaveText('http://localhost:11435');
});

test('all pages render without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    '/fr',
    '/fr/agents',
    '/fr/agents/new',
    '/fr/rooms/new',
    '/fr/providers',
    '/fr/analytics',
    '/fr/rooms/ethique-ia',
  ]) {
    await page.goto(path);
    await expect(page.locator('.loading')).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      path,
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click();
  await page.locator('.sidebar').getByRole('link', { name: 'Mes agents', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bibliothèque des Agents' })).toBeVisible();
});
