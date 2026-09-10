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

/**
 * Loads .env and validates required environment variables upfront.
 */
function loadAndValidateEnv(targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`.env file not found at: ${targetPath}`);
  }

  process.loadEnvFile(targetPath);

  const required = ['APP_FIREBASE_WEB_APP_NAME', 'APP_FIREBASE_RECAPTCHA_ENTERPRISE_KEY'];
  const missingOrInvalid = required.filter((envVar) => {
    const val = process.env[envVar];
    return !val || val.trim() === '' || val.startsWith('<');
  });

  if (missingOrInvalid.length > 0) {
    throw new Error(`Missing or placeholder values for: ${missingOrInvalid.join(', ')} in ${targetPath}`);
  }
}

/**
 * Fetches Firebase Web App SDK configuration dynamically using Firebase CLI.
 */
async function fetchSdkConfigViaCli(webAppName) {
  console.log(`🔍 Querying Firebase CLI for web app: "${webAppName}"...`);

  const { stdout: listStdout } = await execAsync('npx firebase apps:list WEB --json --project default', {
    cwd: firebaseDir,
  });

  const listResponse = JSON.parse(listStdout);
  const apps = listResponse?.result || [];
  const targetApp = apps.find((app) => app.displayName === webAppName);

  if (!targetApp) {
    const availableNames = apps.map((app) => `"${app.displayName}"`).join(', ');
    throw new Error(
      `Web app with displayName "${webAppName}" not found in project. Available web apps: [${availableNames || 'none'}]`,
    );
  }

  const { appId } = targetApp;
  console.log(`Found Web App "${webAppName}" with appId: ${appId}. Fetching SDK configuration...`);

  const { stdout: sdkStdout } = await execAsync(`npx firebase apps:sdkconfig WEB ${appId} --json --project default`, {
    cwd: firebaseDir,
  });

  const sdkResponse = JSON.parse(sdkStdout);
  const sdkConfig = sdkResponse?.result?.sdkConfig;

  if (!sdkConfig) {
    throw new Error(`Failed to retrieve SDK configuration for appId: ${appId}`);
  }

  return sdkConfig;
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
    mappings.map(({ secretName, secretValue }) => {
      console.log(`🔒 Setting secret "${secretName}"...`);
      return setSecretValue(secretName, secretValue, cwd);
    }),
  );

  const allSecretNames = mappings.map((m) => m.secretName);
  await grantSecretAccess(allSecretNames, targetBackend, cwd);
  console.log('🎉 All App Hosting secrets successfully synced and granted in parallel!');
}

// === Top-Level Execution ===
try {
  loadAndValidateEnv(envPath);

  const webAppName = process.env.APP_FIREBASE_WEB_APP_NAME;
  const sdkConfig = await fetchSdkConfigViaCli(webAppName);

  const mappings = [
    { secretName: 'firebase_api_key', secretValue: sdkConfig.apiKey },
    { secretName: 'firebase_auth_domain', secretValue: sdkConfig.authDomain },
    { secretName: 'firebase_project_id', secretValue: sdkConfig.projectId },
    { secretName: 'firebase_storage_bucket', secretValue: sdkConfig.storageBucket },
    { secretName: 'firebase_messaging_sender_id', secretValue: sdkConfig.messagingSenderId },
    { secretName: 'firebase_app_id', secretValue: sdkConfig.appId },
    {
      secretName: 'firebase_recaptcha_enterprise_key',
      secretValue: process.env.APP_FIREBASE_RECAPTCHA_ENTERPRISE_KEY,
    },
  ];

  await syncAllSecrets(mappings, backendId, firebaseDir);
} catch (error) {
  console.error('❌ Secrets synchronization failed:', error.message);
  process.exit(1);
}
