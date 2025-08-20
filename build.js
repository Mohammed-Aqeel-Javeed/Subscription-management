const { execSync } = require('child_process');
const path = require('path');

// Install dependencies for both client and server
console.log('Installing dependencies...');
execSync('npm install', { stdio: 'inherit' });
execSync('cd client && npm install', { stdio: 'inherit' });

// Build client
console.log('Building client...');
execSync('cd client && npm run build', { stdio: 'inherit' });

console.log('Build completed successfully!');
