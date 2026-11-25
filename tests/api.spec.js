const { test, expect } = require('@playwright/test');

let token;
test.beforeAll(async ({ request }) => {
  const r = await request.post('/api/login', { data: { email: 'admin@demo.com', password: 'Admin123!' } });
  token = (await r.json()).data.token;
});
const H = () => ({ Authorization: `Bearer ${token}` });

test('GET /health responde ok', async ({ request }) => {
  expect((await request.get('/health')).status()).toBe(200);
});
test('login correcto devuelve token', async () => { expect(token).toBeTruthy(); });
test('login incorrecto -> 401', async ({ request }) => {
  const r = await request.post('/api/login', { data: { email: 'admin@demo.com', password: 'mala' } });
  expect(r.status()).toBe(401);
});
test('login sin datos -> 400', async ({ request }) => {
  expect((await request.post('/api/login', { data: {} })).status()).toBe(400);
});
test('GET /api/users sin token -> 401', async ({ request }) => {
  expect((await request.get('/api/users')).status()).toBe(401);
});
test('CRUD completo de usuarios', async ({ request }) => {
  const email = `t${Date.now()}@demo.com`;
  const c = await request.post('/api/users', { headers: H(), data: { name: 'Test', email, password: '123456' } });
  expect(c.status()).toBe(201);
  const id = (await c.json()).data.id;

  const g = await request.get(`/api/users/${id}`, { headers: H() });
  expect((await g.json()).data.email).toBe(email);

  const u = await request.put(`/api/users/${id}`, { headers: H(), data: { name: 'Editado' } });
  expect((await u.json()).data.name).toBe('Editado');

  const l = await request.get('/api/users', { headers: H() });
  expect((await l.json()).data.some((x) => x.id === id)).toBeTruthy();

  expect((await request.delete(`/api/users/${id}`, { headers: H() })).status()).toBe(200);
  expect((await request.get(`/api/users/${id}`, { headers: H() })).status()).toBe(404);
});
test('crear usuario con email duplicado -> 409', async ({ request }) => {
  const r = await request.post('/api/users', { headers: H(), data: { name: 'X', email: 'admin@demo.com', password: '1' } });
  expect(r.status()).toBe(409);
});
test('crear usuario con datos incompletos -> 400', async ({ request }) => {
  expect((await request.post('/api/users', { headers: H(), data: { name: 'X' } })).status()).toBe(400);
});
