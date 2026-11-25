const { logs, SeverityNumber } = require('@opentelemetry/api-logs');
const otel = logs.getLogger('users-app');
const LEVELS = { INFO: SeverityNumber.INFO, WARN: SeverityNumber.WARN, ERROR: SeverityNumber.ERROR };

function log(level, message, attributes = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...attributes }));
  otel.emit({ severityNumber: LEVELS[level], severityText: level, body: message, attributes });
}
module.exports = {
  info: (m, a) => log('INFO', m, a),
  warn: (m, a) => log('WARN', m, a),
  error: (m, a) => log('ERROR', m, a),
};
