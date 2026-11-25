require('./tracing');
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./db');
const log = require('./logger');

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ok = (res, data, code = 200) => res.status(code).json({ statusCode: code, data });
const fail = (res, code, message) => { log.warn(message, { statusCode: code }); return res.status(code).json({ statusCode: code, message }); };

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { fail(res, 401, 'Token inválido o ausente'); }
}

app.get('/health', (_req, res) => ok(res, { status: 'ok' }));

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return fail(res, 400, 'Email y contraseña requeridos');
  const u = query('select', 'SELECT * FROM users WHERE email = ?', (s) => s.get(email));
  if (!u || !bcrypt.compareSync(password, u.password)) return fail(res, 401, 'Credenciales inválidas');
  log.info('Login exitoso', { userId: u.id, email });
  ok(res, { token: jwt.sign({ id: u.id, email: u.email, role: u.role }, SECRET, { expiresIn: '2h' }), user: { id: u.id, name: u.name, email: u.email, role: u.role } });
});

app.get('/api/users', auth, (_req, res) =>
  ok(res, query('select', 'SELECT id,name,email,role,created_at FROM users ORDER BY id', (s) => s.all())));

app.get('/api/users/:id', auth, (req, res) => {
  const u = query('select', 'SELECT id,name,email,role,created_at FROM users WHERE id = ?', (s) => s.get(req.params.id));
  return u ? ok(res, u) : fail(res, 404, 'Usuario no encontrado');
});

app.post('/api/users', auth, (req, res) => {
  const { name, email, password, role = 'user' } = req.body || {};
  if (!name || !email || !password) return fail(res, 400, 'name, email y password requeridos');
  try {
    const r = query('insert', 'INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)',
      (s) => s.run(name, email, bcrypt.hashSync(password, 10), role));
    log.info('Usuario creado', { userId: Number(r.lastInsertRowid) });
    ok(res, { id: Number(r.lastInsertRowid), name, email, role }, 201);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return fail(res, 409, 'El email ya existe');
    log.error('Error al crear usuario', { error: e.message });
    fail(res, 500, 'Error interno');
  }
});

app.put('/api/users/:id', auth, (req, res) => {
  const cur = query('select', 'SELECT * FROM users WHERE id = ?', (s) => s.get(req.params.id));
  if (!cur) return fail(res, 404, 'Usuario no encontrado');
  const { name = cur.name, email = cur.email, role = cur.role, password } = req.body || {};
  const hash = password ? bcrypt.hashSync(password, 10) : cur.password;
  try {
    query('update', 'UPDATE users SET name=?, email=?, role=?, password=? WHERE id=?', (s) => s.run(name, email, role, hash, req.params.id));
    log.info('Usuario actualizado', { userId: cur.id });
    ok(res, { id: cur.id, name, email, role });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return fail(res, 409, 'El email ya existe');
    fail(res, 500, 'Error interno');
  }
});

app.delete('/api/users/:id', auth, (req, res) => {
  const r = query('delete', 'DELETE FROM users WHERE id = ?', (s) => s.run(req.params.id));
  if (!r.changes) return fail(res, 404, 'Usuario no encontrado');
  log.info('Usuario eliminado', { userId: req.params.id });
  ok(res, { deleted: true });
});

// Endpoint para generar errores a propósito (demo de alertas/observabilidad)
app.get('/api/boom', (_req, res) => { log.error('Excepción simulada', { endpoint: '/api/boom' }); res.status(500).json({ statusCode: 500, message: 'boom' }); });

app.use((err, _req, res, _next) => { log.error('Excepción no controlada', { error: err.message }); res.status(500).json({ statusCode: 500, message: 'Error interno' }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log.info(`Servidor escuchando en ${PORT}`));
