import fs from 'fs';

// Read the generated worker
const workerPath = '.svelte-kit/cloudflare/_worker.js';
let content = fs.readFileSync(workerPath, 'utf8');

// Add scheduled function import and export
const scheduledCode = `
// Import scheduled function
import { scheduled as scheduledHandler } from '../output/server/chunks/hooks.server.js';

// Modify the worker to include scheduled function
const originalWorker = worker_default;
const workerWithScheduled = {
  ...originalWorker,
  async scheduled(event, env, context) {
    return await scheduledHandler(event, env, context);
  }
};
`;

// Replace the export
content = content.replace(
  'export {\n  worker_default as default\n};',
  scheduledCode + 'export { workerWithScheduled as default };'
);

// Write back
fs.writeFileSync(workerPath, content);
console.log('✅ Added scheduled function to generated worker');