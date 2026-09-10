import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseDir = path.resolve(__dirname, '..');
const envPath = path.resolve(firebaseDir, '.env');
const outputPath = path.resolve(__dirname, '../../public/firebase.config.json');

/**
 * Fetches Firebase Web App SDK configuration dynamically using Firebase CLI.
 */
async function fetchSdkConfigViaCli(webAppName) {
  console.log(`Querying Firebase CLI for web app: "${webAppName}"...`);

  // List web apps to locate matching appId
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

  return {
    apiKey: sdkConfig.apiKey,
    authDomain: sdkConfig.authDomain,
    projectId: sdkConfig.projectId,
    storageBucket: sdkConfig.storageBucket,
    messagingSenderId: sdkConfig.messagingSenderId,
    appId: sdkConfig.appId,
  };
}

try {
  let app;
  let recaptchaEnterpriseKey;
  let appCheckDebugToken = '';

  if (fs.existsSync(envPath)) {
    // 1. If .env exists: load it and use Firebase CLI
    process.loadEnvFile(envPath);
    console.log('Success: Loaded .env file');

    const webAppName = process.env.APP_FIREBASE_WEB_APP_NAME;
    if (!webAppName || webAppName.trim() === '' || webAppName.startsWith('<')) {
      throw new Error('Missing or placeholder value for APP_FIREBASE_WEB_APP_NAME in .env');
    }

    recaptchaEnterpriseKey = process.env.APP_FIREBASE_RECAPTCHA_ENTERPRISE_KEY;
    if (!recaptchaEnterpriseKey || recaptchaEnterpriseKey.trim() === '' || recaptchaEnterpriseKey.startsWith('<')) {
      throw new Error('Missing or placeholder value for APP_FIREBASE_RECAPTCHA_ENTERPRISE_KEY in .env');
    }

    appCheckDebugToken = process.env.APP_FIREBASE_APPCHECK_DEBUG_TOKEN || '';
    app = await fetchSdkConfigViaCli(webAppName);
  } else {
    // 2. Otherwise: use process.env directly to construct the object
    console.log('Warning: .env file does not exist. Using process.env to construct config object');

    app = {
      apiKey: process.env.APP_FIREBASE_API_KEY,
      authDomain: process.env.APP_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.APP_FIREBASE_PROJECT_ID,
      storageBucket: process.env.APP_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.APP_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.APP_FIREBASE_APP_ID,
    };

    recaptchaEnterpriseKey = process.env.APP_FIREBASE_RECAPTCHA_ENTERPRISE_KEY;
    appCheckDebugToken = process.env.APP_FIREBASE_APPCHECK_DEBUG_TOKEN || '';

    // Validate that required keys are present
    const missing = Object.entries(app)
      .filter(([, value]) => !value || value.startsWith('<'))
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`The following process.env keys are missing or invalid: ${missing.join(', ')}`);
    }

    if (!recaptchaEnterpriseKey || recaptchaEnterpriseKey.startsWith('<')) {
      throw new Error('APP_FIREBASE_RECAPTCHA_ENTERPRISE_KEY is missing or invalid in process.env');
    }
  }

  const config = {
    app,
    recaptchaEnterpriseKey,
    appCheckDebugToken,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  console.log(`Successfully generated ${outputPath}`);
} catch (error) {
  console.error('❌ Error generating firebase.config.json:', error.message);
  process.exit(1);
}
