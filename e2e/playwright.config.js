import { defineConfig, devices } from '@playwright/test';
import { loadTestEnvironment, repositoryRoot } from './environment.js';

const environment = loadTestEnvironment();
Object.assign(process.env, environment);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1, // Los casos de QA comparten semilla; no compiten por el mismo anuncio.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup.js',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node backend/src/server.js',
      cwd: repositoryRoot,
      url: 'http://127.0.0.1:4300/api/health',
      env: { ...environment, HOST: '127.0.0.1', PORT: '4300' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm --prefix frontend run dev -- --host 127.0.0.1 --port 4173',
      cwd: repositoryRoot,
      url: 'http://127.0.0.1:4173',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:4300', VITE_USE_POLLING: 'false' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
