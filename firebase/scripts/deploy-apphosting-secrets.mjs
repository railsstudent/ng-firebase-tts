import { exec, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseDir = path.resolve(__dirname, '..');
const projectRootDir = path.resolve(firebaseDir, '..');
const envPath = path.join(firebaseDir, '.env');
const appHostingYamlPath = path.join(projectRootDir, 'apphosting.yaml');

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
 * Resolves the App Hosting backend ID dynamically:
 * 1. CLI flag: --backend <name> or -b <name>
 * 2. Environment variable: process.env.APP_FIREBASE_BACKEND_ID
 * 3. package.json "name" field
 */
function resolveBackendId(targetRootDir) {
  const args = process.argv.slice(2);
  const backendArgIndex = args.findIndex((arg) => arg === '--backend' || arg === '-b');
  if (backendArgIndex !== -1 && args[backendArgIndex + 1]) {
    return args[backendArgIndex + 1].trim();
  }

  if (process.env.APP_FIREBASE_BACKEND_ID && process.env.APP_FIREBASE_BACKEND_ID.trim() !== '') {
    return process.env.APP_FIREBASE_BACKEND_ID.trim();
  }

  const pkgPath = path.join(targetRootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.name) {
      return pkg.name;
    }
  }

  throw new Error(
    'Could not resolve backend ID. Pass --backend <name>, set APP_FIREBASE_BACKEND_ID, or ensure package.json has a "name".',
  );
}

/**
 * Dynamically parses secret declarations from apphosting.yaml.
 * Matches:
 *   - variable: APP_FIREBASE_API_KEY
 *     secret: firebase_api_key
 */
function parseAppHostingSecrets(yamlPath) {
  if (!fs.existsSync(yamlPath)) {
    throw new Error(`apphosting.yaml not found at: ${yamlPath}`);
  }

  const content = fs.readFileSync(yamlPath, 'utf8');
  const secretEntries = [];
  const regex = /-\s+variable:\s*([^\s]+)\s+secret:\s*([^\s]+)/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    secretEntries.push({
      variableName: match[1],
      secretName: match[2],
    });
  }

  if (secretEntries.length === 0) {
    throw new Error(`No secret declarations found in ${yamlPath}`);
  }

  return secretEntries;
}

/**
 * Converts 'APP_FIREBASE_MESSAGING_SENDER_ID' -> 'messagingSenderId'
 */
function variableToSdkKey(variableName) {
  return variableName
    .replace(/^APP_FIREBASE_/, '')
    .toLowerCase()
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Resolves secret values dynamically without hardcoded dictionary maps:
 * 1. Derives SDK property from variableName and checks sdkConfig.
 * 2. Fallbacks to process.env (e.g. for reCAPTCHA Enterprise key or custom variables).
 */
function resolveSecretMappings(declaredSecrets, sdkConfig) {
  return declaredSecrets.map(({ variableName, secretName }) => {
    // 1. Try resolving from Firebase SDK configuration
    const sdkKey = variableToSdkKey(variableName);
    if (sdkConfig && sdkConfig[sdkKey]) {
      return { secretName, secretValue: sdkConfig[sdkKey] };
    }

    // 2. Try resolving from process.env (.env file)
    const envValue = process.env[variableName];
    if (envValue && !envValue.startsWith('<')) {
      return { secretName, secretValue: envValue };
    }

    // 3. Fail fast if declared in YAML but missing everywhere
    throw new Error(
      `Variable "${variableName}" (secret: ${secretName}) in apphosting.yaml could not be resolved from Firebase SDK config or .env`,
    );
  });
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

  const backendId = resolveBackendId(projectRootDir);
  const declaredSecrets = parseAppHostingSecrets(appHostingYamlPath);
  const webAppName = process.env.APP_FIREBASE_WEB_APP_NAME;
  const sdkConfig = await fetchSdkConfigViaCli(webAppName);

  const mappings = resolveSecretMappings(declaredSecrets, sdkConfig);

  await syncAllSecrets(mappings, backendId, firebaseDir);
} catch (error) {
  console.error('❌ Secrets synchronization failed:', error.message);
  process.exit(1);
}
