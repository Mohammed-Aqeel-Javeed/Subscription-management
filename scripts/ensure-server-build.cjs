#!/usr/bin/env node
// Ensures dist/server/index.js exists in deployment environments even if build cache lost.
const fs = require('fs');
const { execSync } = require('child_process');

const serverIndex = 'dist/server/index.js';
if (!fs.existsSync(serverIndex)) {
  console.log('[ensure-server-build] server build missing – running tsc');
  try {
    execSync('npm run build:server', { stdio: 'inherit' });
  } catch (e) {
    console.error('[ensure-server-build] Failed to build server:', e.message);
    process.exit(1);
  }
} else {
  console.log('[ensure-server-build] server build present');
}
