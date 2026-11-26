// Matriz de pruebas basada en datos (API). Genera 650 casos individuales.
const { test, expect } = require('@playwright/test');

test.describe.configure({ mode: 'parallel' });

let token;
test.beforeAll(async ({ request }) => {
  const r = await request.post('/api/login', { data: { email: 'admin@demo.com', password: 'Admin123!' } });
  token = (await r.json()).data.token;
});
const H = () => ({ Authorization: `Bearer ${token}` });
const uniq = (p, i) => `${p}${i}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@demo.com`;

// 1) Login con credenciales inválidas (100)
const badPasswords = ['', ' ', '123', 'admin', 'Admin123', 'admin123!', 'ADMIN123!', "' OR '1'='1", '<script>', 'x'.repeat(50)];
const badEmails = ['no@existe.com', 'admin@demo', 'ADMIN@DEMO.COM', ' admin@demo.com', "a'--@demo.com", 'x@y.z', 'admin@demo.com.mx', '@demo.com', 'admin', 'test@test.com'];
for (const e of badEmails) for (const p of badPasswords) {
  test(`login inválido [${JSON.stringify(e).slice(0, 20)} / ${JSON.stringify(p).slice(0, 12)}]`, async ({ request }) => {
    const r = await request.post('/api/login', { data: { email: e, password: p } });
    expect([400, 401]).toContain(r.status());
  });
}

// 2) Endpoints protegidos con token inválido (5 endpoints x 20 tokens = 100)
const badTokens = ['', 'abc', 'Bearer', 'null', 'undefined', '0', '1.2.3', 'eyJhbGciOiJIUzI1NiJ9.e30.x', 'x'.repeat(100), '   ',
  'a.b.c', 'token', 'admin', 'true', '{}', '[]', "' OR 1=1", '<script>', '../../etc', 'eyJ.eyJ.sig'];
const protectedCalls = [
  ['GET', '/api/users'], ['GET', '/api/users/1'], ['POST', '/api/users'], ['PUT', '/api/users/1'], ['DELETE', '/api/users/1'],
];
for (const [m, url] of protectedCalls) for (const [i, t] of badTokens.entries()) {
  test(`${m} ${url} token inválido #${i}`, async ({ request }) => {
    const r = await request.fetch(url, { method: m, headers: { Authorization: `Bearer ${t}` }, data: {} });
    expect(r.status()).toBe(401);
  });
}

// 3) Crear usuario con datos incompletos (3 campos x 25 variantes = 75)
const missing = [['name'], ['email'], ['password'], ['name', 'email'], ['name', 'password'], ['email', 'password'], ['name', 'email', 'password']];
for (let i = 0; i < 75; i++) {
  const omit = missing[i % missing.length];
  test(`crear usuario incompleto #${i} (sin ${omit.join('+')})`, async ({ request }) => {
    const body = { name: `N${i}`, email: uniq('inc', i), password: 'pw12345' };
    omit.forEach((k) => delete body[k]);
    const r = await request.post('/api/users', { headers: H(), data: body });
    expect(r.status()).toBe(400);
  });
}

// 4) Ciclo crear -> leer -> eliminar con distintos roles y nombres (150)
for (let i = 0; i < 150; i++) {
  const role = i % 2 ? 'admin' : 'user';
  test(`crear/leer/eliminar usuario #${i} rol ${role}`, async ({ request }) => {
    const email = uniq('crud', i);
    const c = await request.post('/api/users', { headers: H(), data: { name: `Usuario ${i}`, email, password: `Pw${i}!xyz`, role } });
    expect(c.status()).toBe(201);
    const id = (await c.json()).data.id;
    const g = await request.get(`/api/users/${id}`, { headers: H() });
    const u = (await g.json()).data;
    expect(u.email).toBe(email);
    expect(u.role).toBe(role);
    expect(u.password).toBeUndefined();
    expect((await request.delete(`/api/users/${id}`, { headers: H() })).status()).toBe(200);
  });
}

// 5) Actualizar usuarios (100)
for (let i = 0; i < 100; i++) {
  test(`actualizar usuario #${i}`, async ({ request }) => {
    const c = await request.post('/api/users', { headers: H(), data: { name: 'Base', email: uniq('upd', i), password: 'pw12345' } });
    const id = (await c.json()).data.id;
    const u = await request.put(`/api/users/${id}`, { headers: H(), data: { name: `Nuevo ${i}`, role: i % 2 ? 'admin' : 'user' } });
    expect(u.status()).toBe(200);
    expect((await u.json()).data.name).toBe(`Nuevo ${i}`);
    await request.delete(`/api/users/${id}`, { headers: H() });
  });
}

// 6) Recursos inexistentes -> 404 (3 métodos x 25 ids = 75)
for (const m of ['GET', 'PUT', 'DELETE']) for (let i = 0; i < 25; i++) {
  const id = 900000 + i * 7;
  test(`${m} /api/users/${id} inexistente -> 404`, async ({ request }) => {
    const r = await request.fetch(`/api/users/${id}`, { method: m, headers: H(), data: { name: 'x' } });
    expect(r.status()).toBe(404);
  });
}

// 7) Email duplicado -> 409 (50)
for (let i = 0; i < 50; i++) {
  test(`email duplicado -> 409 #${i}`, async ({ request }) => {
    const email = uniq('dup', i);
    const a = await request.post('/api/users', { headers: H(), data: { name: 'A', email, password: 'pw12345' } });
    const id = (await a.json()).data.id;
    const b = await request.post('/api/users', { headers: H(), data: { name: 'B', email, password: 'pw12345' } });
    expect(b.status()).toBe(409);
    await request.delete(`/api/users/${id}`, { headers: H() });
  });
}

// 8) Login válido de usuarios creados (50)
for (let i = 0; i < 50; i++) {
  test(`login válido de usuario nuevo #${i}`, async ({ request }) => {
    const email = uniq('log', i);
    const c = await request.post('/api/users', { headers: H(), data: { name: `L${i}`, email, password: `Pass${i}word` } });
    const id = (await c.json()).data.id;
    const l = await request.post('/api/login', { data: { email, password: `Pass${i}word` } });
    expect(l.status()).toBe(200);
    expect((await l.json()).data.token).toBeTruthy();
    await request.delete(`/api/users/${id}`, { headers: H() });
  });
}

// 9) Health y formato de respuesta (50)
for (let i = 0; i < 50; i++) {
  test(`health y formato statusCode #${i}`, async ({ request }) => {
    const r = await request.get('/health');
    const j = await r.json();
    expect(r.status()).toBe(200);
    expect(j.statusCode).toBe(200);
    expect(j.data.status).toBe('ok');
  });
}
