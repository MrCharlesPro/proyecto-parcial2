const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    command: 'node app/server.js',
    url: 'http://localhost:3100/health',
    env: { PORT: '3100', JWT_SECRET: 'test-secret' },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
