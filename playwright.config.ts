import { defineConfig, devices } from '@playwright/test';

const runtimeEnvironment = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer:
    runtimeEnvironment?.PLAYWRIGHT_EXTERNAL_SERVER === '1'
      ? undefined
      : {
          command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173',
          url: 'http://127.0.0.1:4173',
          reuseExistingServer: true,
        },
  projects: [
    { name: 'desktop-720p', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    { name: 'mobile-landscape', use: { ...devices['iPhone 13 landscape'], browserName: 'chromium' } },
    {
      name: 'desktop-1080p',
      testMatch: /milestone-six\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'mobile-portrait',
      testMatch: /milestone-six\.spec\.ts/,
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
});
