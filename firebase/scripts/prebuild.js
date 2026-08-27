const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Starting prebuild pipeline...');

  // 1. Run the first program
  console.log('Fetching Remote Config...');
  const remoteConfigScriptPath = path.resolve(__dirname, './get-firebase-remote-config.js');
  execSync(`node ${remoteConfigScriptPath}`, { stdio: 'inherit' });

  // 2. Run the second program
  console.log('Generating Firebase App Config...');
  const genFirebaseConfigScriptPath = path.resolve(__dirname, './generate-firebase-config.js');
  execSync(`node ${genFirebaseConfigScriptPath}`, { stdio: 'inherit' });

  console.log('All prebuild tasks completed.');
} catch (error) {
  console.error('Prebuild failed during execution.', error);
  // Exit with status 1 to tell Firebase App Hosting that the build failed
  process.exit(1);
}
