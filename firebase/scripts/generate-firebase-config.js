const fs = require('fs');
const path = require('path');

try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
    console.log('Success: load .env file');
  } else {
    console.log('Warning: .env file does not exist. Use process.env fallback');
  }

  const app = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  };

  // Basic validation to check if all keys are filled
  const missing = Object.entries(app)
    .filter((data) => !data[1] || data[1].startsWith('<'))
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(`Warning: The following keys are missing or contain placeholder values: ${missing.join(', ')}`);
  }

  // Check if recaptcha enterprise key is missing
  if (!process.env.FIREBASE_RECAPTCHA_ENTERPRISE_KEY) {
    console.warn('Warning: Recaptcha Enterprise key is missing');
  }

  const config = {
    app,
    recaptchaEnterpriseKey: process.env.FIREBASE_RECAPTCHA_ENTERPRISE_KEY,
    appCheckDebugToken: process.env.FIREBASE_APPCHECK_DEBUG_TOKEN || '',
  };

  const outputPath = path.resolve(__dirname, '../../public/firebase.config.json');
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`Successfully generated ${outputPath} from .env`);
} catch (error) {
  console.error('Error generating firebase.config.json:', error.message);
  process.exit(1);
}
