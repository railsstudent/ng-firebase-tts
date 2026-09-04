import { exec, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseDir = path.resolve(__dirname, '..');
const envPath = path.join(firebaseDir, '.env');
const backendId = 'ng-firebase-tts';

const SECRET_MAPPINGS = [
  { envVar: 'APP_FIREBASE_API_KEY', secretName: 'firebase_api_key' },
  { envVar: 'APP_FIREBASE_AUTH_DOMAIN', secretName: 'firebase_auth_domain' },
  { envVar: 'APP_FIREBASE_PROJECT_ID', secretName: 'firebase_project_id' },
  { envVar: 'APP_FIREBASE_STORAGE_BUCKET', secretName: 'firebase_storage_bucket' },
  { envVar: 'APP_FIREBASE_MESSAGING_SENDER_ID', secretName: 'firebase_messaging_sender_id' },
  { envVar: 'APP_FIREBASE_APP_ID', secretName: 'firebase_app_id' },
  { envVar: 'APP_FIREBASE_RECAPTCHA_ENTERPRISE_KEY', secretName: 'firebase_recaptcha_enterprise_key' },
];

/**
 * Loads .env and validates all required environment variables upfront.
 */
function loadAndValidateEnv(targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`.env file not found at: ${targetPath}`);
  }

  process.loadEnvFile(targetPath);

  const missingOrInvalid = SECRET_MAPPINGS.filter(({ envVar }) => {
    const val = process.env[envVar];
    return !val || val.trim() === '' || val.startsWith('<');
  }).map(({ envVar }) => envVar);

  if (missingOrInvalid.length > 0) {
    throw new Error(`Missing or placeholder values for: ${missingOrInvalid.join(', ')} in ${targetPath}`);
  }
}

/**
 * Runs the Firebase CLI spawn process once to set a secret value.
 */
function runSpawnCommand(secretName, secretValue, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['firebase', 'apphosting:secrets:set', secretName, '--data-file', '-', '--force', '--project', 'default'],
      { cwd, stdio: ['pipe', 'inherit', 'inherit'] },
    );

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to set secret "${secretName}" (exit code ${code})`));
      }
    });

    child.stdin.write(secretValue);
    child.stdin.end();
  });
}

/**
 * Sets a secret with automatic retry if Google Cloud returns a 503/transient error.
 */
async function setSecretValue(secretName, secretValue, cwd, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt = attempt + 1) {
    try {
      await runSpawnCommand(secretName, secretValue, cwd);
      break;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.warn(`⚠️ Retrying secret "${secretName}" (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
    }
  }
}

/**
 * Grants the App Hosting backend access to provisioned secrets.
 */
async function grantSecretAccess(secretNames, targetBackend, cwd) {
  const secretList = secretNames.join(',');
  console.log(`🔑 Granting "${targetBackend}" access to secrets: ${secretList}`);
  await execAsync(`npx firebase apphosting:secrets:grantaccess ${secretList} -b ${targetBackend} --project default`, {
    cwd,
  });
}

/**
 * Synchronizes all mapped secrets concurrently in parallel via Promise.all.
 */
async function syncAllSecrets(mappings, targetBackend, cwd) {
  console.log('🚀 Starting parallel App Hosting secrets synchronization...');

  await Promise.all(
    mappings.map(({ envVar, secretName }) => {
      const value = process.env[envVar];
      console.log(`🔒 Setting secret "${secretName}" from ${envVar}...`);
      return setSecretValue(secretName, value, cwd);
    }),
  );

  const allSecretNames = mappings.map((m) => m.secretName);
  await grantSecretAccess(allSecretNames, targetBackend, cwd);
  console.log('🎉 All App Hosting secrets successfully synced and granted in parallel!');
}

// === Top-Level Execution ===
try {
  loadAndValidateEnv(envPath);
  await syncAllSecrets(SECRET_MAPPINGS, backendId, firebaseDir);
} catch (error) {
  console.error('❌ Secrets synchronization failed:', error.message);
  process.exit(1);
}
