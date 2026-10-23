import { defineConfig } from 'cypress';

export default defineConfig({
  video: false,
  // Long forms keep many DOM snapshots. Allow Chromium to collect snapshots
  // during a test instead of exhausting the runner before an assertion completes.
  experimentalMemoryManagement: true,
  allowCypressEnv: false,
  expose: {
    runMarker: process.env.E2E_RUN_MARKER,
    hasOtherUser: !!process.env.E2E_OTHER_SESSION_TOKEN,
  },
  screenshotOnRunFailure: true,
  viewportWidth: 1280,
  viewportHeight: 900,
  defaultCommandTimeout: 10000,
  e2e: {
    baseUrl: process.env.E2E_BASE_URL || 'http://localhost:5173',
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.js',
    setupNodeEvents(on) {
      on('task', {
        resizeDiagnostic(trace) {
          console.info('Method resize diagnostic: ' + trace);
          return null;
        },
        checkpoint(label) {
          if (!/^gear:[a-z-]+$/.test(label)) throw Error('Invalid checkpoint.');
          console.info('E2E checkpoint: ' + label);
          return null;
        },
        session(role) {
          const token =
            role === 'other'
              ? process.env.E2E_OTHER_SESSION_TOKEN
              : process.env.E2E_SESSION_TOKEN;
          if (!/^[a-f0-9]{64}$/.test(token || ''))
            throw Error('Run E2E through the authenticated test runner.');
          return token;
        },
      });
    },
  },
});
