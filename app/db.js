const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { trace, SpanStatusCode } = require('@opentelemetry/api');
const tracer = trace.getTracer('users-app-db');

const db = new Database(process.env.DB_PATH || ':memory:');
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

if (!db.prepare('SELECT 1 FROM users WHERE email = ?').get('admin@demo.com')) {
  db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)')
    .run('Administrador', 'admin@demo.com', bcrypt.hashSync('Admin123!', 10), 'admin');
}

// Span manual por cada consulta SQL (traza de base de datos)
function query(op, sql, fn) {
  return tracer.startActiveSpan(`db.${op}`, { attributes: { 'db.system': 'sqlite', 'db.statement': sql } }, (span) => {
    try { return fn(db.prepare(sql)); }
    catch (e) { span.recordException(e); span.setStatus({ code: SpanStatusCode.ERROR }); throw e; }
    finally { span.end(); }
  });
}
module.exports = { query };
