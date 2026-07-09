import { defineConfig } from '@playwright/test';

const baseURL = process.env.SITE_URL;

if (!baseURL) {
  throw new Error('Set SITE_URL to the deployed Vercel, Cloudflare Pages, Netlify, or GitHub Pages URL before running live smoke tests.');
}

export default defineConfig({
  testDir: './tests',
  testMatch: /live\.spec\.js/,
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
