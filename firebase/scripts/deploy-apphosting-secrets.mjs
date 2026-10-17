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
 *   - variable: APP_FIREBASE_CONFIG
 *     secret: app_firebase_config
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
 * Reads the active secret value from App Hosting / Secret Manager via Firebase CLI.
 * Returns null if the secret does not exist yet or throws an error.
 */
async function getActiveSecretValue(secretName, cwd) {
  try {
    const { stdout } = await execAsync(`npx firebase apphosting:secrets:access ${secretName} --project default`, {
      cwd,
    });
    return stdout;
  } catch {
    return null;
  }
}

/**
 * Checks whether the cloud secret value matches the local payload.
 */
function isSecretUpToDate(activeValue, newValue) {
  if (activeValue === null || activeValue === undefined) {
    return false;
  }
  if (activeValue.trim() === newValue.trim()) {
    return true;
  }
  try {
    const activeObj = JSON.parse(activeValue.trim());
    const newObj = JSON.parse(newValue.trim());
    return JSON.stringify(activeObj) === JSON.stringify(newObj);
  } catch {
    return false;
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
 * Prunes older versions of the secret so that only <= 1 active version remains.
 */
async function pruneSecretVersions(secretName, projectId, cwd) {
  try {
    console.log(`🧹 Pruning older versions of secret "${secretName}"...`);
    const { stdout } = await execAsync(
      `gcloud secrets versions list ${secretName} --project ${projectId} --format="value(name,state)"`,
      { cwd },
    );

    const lines = stdout.trim().split('\n').filter(Boolean);
    const versions = lines
      .map((line) => {
        const [name, state] = line.trim().split(/\s+/);
        const versionId = name ? name.split('/').pop() : '';
        const versionNumber = Number.parseInt(versionId, 10);
        return { versionNumber, versionId, state: state ? state.toUpperCase() : '' };
      })
      .filter((v) => !Number.isNaN(v.versionNumber));

    // Sort descending so the latest version is first
    versions.sort((a, b) => b.versionNumber - a.versionNumber);

    // Keep the latest version (versions[0]), destroy older active versions
    const olderVersionsToDestroy = versions.slice(1).filter((v) => v.state !== 'DESTROYED');

    for (const v of olderVersionsToDestroy) {
      console.log(`🗑️ Destroying old version ${v.versionId} of secret "${secretName}"...`);
      await execAsync(
        `gcloud secrets versions destroy ${v.versionId} --secret ${secretName} --project ${projectId} --quiet`,
        { cwd },
      );
    }
    console.log(`✅ Version pruning complete for secret "${secretName}".`);
  } catch (error) {
    console.warn(`⚠️ Warning: Failed to prune secret versions for "${secretName}":`, error.message);
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

// === Top-Level Execution ===
try {
  loadAndValidateEnv(envPath);

  const backendId = resolveBackendId(projectRootDir);
  const declaredSecrets = parseAppHostingSecrets(appHostingYamlPath);
  const secretEntry = declaredSecrets.find((s) => s.variableName === 'APP_FIREBASE_CONFIG');
  const secretName = secretEntry ? secretEntry.secretName : 'app_firebase_config';

  const webAppName = process.env.APP_FIREBASE_WEB_APP_NAME;
  const sdkConfig = await fetchSdkConfigViaCli(webAppName);
  const projectId = sdkConfig.projectId || 'vertexai-tts';

  const bundle = {
    app: {
      apiKey: sdkConfig.apiKey,
      authDomain: sdkConfig.authDomain,
      projectId: sdkConfig.projectId,
      storageBucket: sdkConfig.storageBucket,
      messagingSenderId: sdkConfig.messagingSenderId,
      appId: sdkConfig.appId,
    },
    recaptchaEnterpriseKey: process.env.APP_FIREBASE_RECAPTCHA_ENTERPRISE_KEY,
  };
  const secretValue = JSON.stringify(bundle);

  console.log(`🔍 Checking current cloud value for secret "${secretName}"...`);
  const activeValue = await getActiveSecretValue(secretName, firebaseDir);

  if (isSecretUpToDate(activeValue, secretValue)) {
    console.log(`⚡ Secret "${secretName}" is already up to date. Skipping creation.`);
  } else {
    console.log(`🔒 Setting secret "${secretName}"...`);
    await setSecretValue(secretName, secretValue, firebaseDir);
    await pruneSecretVersions(secretName, projectId, firebaseDir);
  }

  await grantSecretAccess([secretName], backendId, firebaseDir);
  console.log('🎉 App Hosting secret successfully synced and granted!');
} catch (error) {
  console.error('❌ Secrets synchronization failed:', error.message);
  process.exit(1);
}
