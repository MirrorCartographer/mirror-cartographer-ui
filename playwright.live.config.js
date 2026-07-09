import { defineConfig } from '@playwright/test';

const DEFAULT_SITE_URL = 'https://mirror-cartographer-ui.vercel.app';
const baseURL = process.env.SITE_URL || DEFAULT_SITE_URL;

export default defineConfig({
  testDir: './tests',
  testMatch: /live-hosting\.spec\.js/,
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'live-phone-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
