const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/');
  await page.fill('#email', 'admin@demo.com');
  await page.fill('#password', 'Admin123!');
  await page.click('#btn-login');
  await expect(page.locator('#app-view')).toBeVisible();
}

test('login con credenciales inválidas muestra error', async ({ page }) => {
  await page.goto('/');
  await page.fill('#email', 'admin@demo.com');
  await page.fill('#password', 'incorrecta');
  await page.click('#btn-login');
  await expect(page.locator('#login-error')).toHaveText('Credenciales inválidas');
});

test('login correcto muestra la tabla de usuarios', async ({ page }) => {
  await login(page);
  await expect(page.locator('#who')).toHaveText('Administrador');
  await expect(page.locator('#users')).toContainText('admin@demo.com');
});

test('UI: crear, editar y eliminar un usuario', async ({ page }) => {
  await login(page);
  const email = `ui${Date.now()}@demo.com`;
  await page.fill('#u-name', 'Usuario UI');
  await page.fill('#u-email', email);
  await page.fill('#u-password', 'abc123');
  await page.click('#btn-save');
  await expect(page.locator('#users tr', { hasText: email })).toBeVisible();

  await page.locator('#users tr', { hasText: email }).getByRole('button', { name: 'Editar' }).click();
  await page.fill('#u-name', 'Nombre Editado');
  await page.click('#btn-save');
  await expect(page.locator('#users tr', { hasText: email })).toContainText('Nombre Editado');

  await page.locator('#users tr', { hasText: email }).getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.locator('#users tr', { hasText: email })).toHaveCount(0);
});

test('cerrar sesión regresa al login', async ({ page }) => {
  await login(page);
  await page.click('#btn-logout');
  await expect(page.locator('#login-view')).toBeVisible();
});
