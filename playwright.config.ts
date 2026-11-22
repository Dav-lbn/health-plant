import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4173/health-plant/', serviceWorkers: 'block' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/health-plant/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'fold-ferme', use: { viewport: { width: 374, height: 832 }, hasTouch: true } },
    { name: 'fold-deplie', use: { viewport: { width: 690, height: 740 }, hasTouch: true } },
  ],
});
