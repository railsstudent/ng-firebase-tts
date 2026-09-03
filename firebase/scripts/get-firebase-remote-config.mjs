import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseDir = path.resolve(__dirname, '..');

try {
  // Fetch remote config asynchronously
  const { stdout } = await execAsync('npx firebase remoteconfig:get --json --project default', {
    cwd: firebaseDir,
  });
  const config = JSON.parse(stdout);
  const parameters = config?.result?.parameters;

  // Extract default values from parameters
  const defaults = {};
  if (parameters) {
    for (const [key, paramObj] of Object.entries(parameters)) {
      if (paramObj.defaultValue && paramObj.defaultValue.value !== undefined) {
        defaults[key] = paramObj.defaultValue.value;
      }
    }
  }

  // Write to JSON file
  const outputPath = path.join(firebaseDir, '..', 'public', 'remote-config-defaults.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(defaults, null, 2)}\n`, 'utf-8');
  console.log(`Successfully wrote ${outputPath}`);
} catch (error) {
  console.error('Error fetching or parsing remote config:', error.message);
  process.exit(1);
}
