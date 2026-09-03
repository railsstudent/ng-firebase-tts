import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseDir = path.resolve(__dirname, '..');
const templatePath = path.join(firebaseDir, 'remote-config-template.json');

/**
 * PULL: Fetches the live Remote Config from Firebase Cloud
 * and saves it directly to firebase/remote-config-template.json
 */
async function pullRemoteConfigTemplate() {
  console.log('📥 Pulling active Remote Config template from Firebase Cloud...');

  const { stdout } = await execAsync('npx firebase remoteconfig:get --json --project default', {
    cwd: firebaseDir,
  });
  const response = JSON.parse(stdout);
  const liveTemplate = response.result || response;

  fs.writeFileSync(templatePath, `${JSON.stringify(liveTemplate, null, 2)}\n`, 'utf-8');
  console.log(`✅ Successfully saved live template to: ${templatePath}`);
}

/**
 * PUSH: Synchronizes version/etag metadata to prevent 409 conflicts,
 * updates the local template file, and deploys via Firebase CLI.
 */
async function pushRemoteConfigTemplate() {
  console.log('🔄 Preparing to push Remote Config template to Firebase Cloud...');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found at ${templatePath}. Run 'pull' first.`);
  }
  const localTemplate = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

  // 1. Fetch current live config to get up-to-date version metadata
  console.log('🔍 Fetching latest version metadata to avoid 409 conflicts...');
  const { stdout: liveJson } = await execAsync('npx firebase remoteconfig:get --json --project default', {
    cwd: firebaseDir,
  });
  const response = JSON.parse(liveJson);
  const liveTemplate = response.result || response;

  // 2. Sync latest version metadata into our local template
  if (liveTemplate.version) {
    localTemplate.version = liveTemplate.version;
  }
  if (liveTemplate.etag) {
    localTemplate.etag = liveTemplate.etag;
  }
  fs.writeFileSync(templatePath, `${JSON.stringify(localTemplate, null, 2)}\n`, 'utf-8');

  // 3. Deploy the template directly
  console.log('🚀 Deploying template via Firebase CLI...');
  const { stdout: deployOutput } = await execAsync('npx firebase deploy --only remoteconfig --project default', {
    cwd: firebaseDir,
  });
  console.log(deployOutput);
  console.log('🎉 Remote Config deployment successfully completed!');
}

// === Direct CLI Dispatcher ===
const [command] = process.argv.slice(2);

try {
  if (command === 'pull') {
    await pullRemoteConfigTemplate();
  } else if (command === 'push') {
    await pushRemoteConfigTemplate();
  } else {
    console.error(`❌ Unknown command: "${command || ''}"`);
    console.log('Usage: node firebase/scripts/deploy-remote-config.mjs [pull|push]');
    process.exit(1);
  }
} catch (error) {
  console.error(`❌ Execution failed for '${command}':`, error.message);
  process.exit(1);
}
