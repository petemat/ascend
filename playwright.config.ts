import { defineConfig, devices } from '@playwright/test';

// Default: run against "internal" URL (override with BASE_URL env)
// Example:
//   BASE_URL=http://100.113.108.21:3001/ascend/ npm test
// NOTE: inside the OpenClaw container, the host gateway is typically 172.18.0.1
// (127.0.0.1 points to the container itself).
// We set baseURL to the server root so tests can hit multiple apps.
const baseURL = process.env.BASE_URL ?? 'http://172.18.0.1:3001';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
});
