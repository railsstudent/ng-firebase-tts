import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export const rootDir = process.cwd();
export const DIST_DIR = path.join(rootDir, 'dist');
export const SRC_DIR = path.join(rootDir, 'src');
export const CHUNK_DISPLAY_LIMIT = 8;

const ALLOWED_MAIN_PACKAGES = new Set([
  '@angular/core',
  '@angular/common',
  '@angular/platform-browser',
  '@angular/router',
  '@angular/service-worker',
  'rxjs',
  'tslib',
]);

export const POSTCSS_CONFIG_FILES = ['postcss.config.json', '.postcssrc.json'];
export const BUILD_CONFIG_FILES = ['angular.json', 'package.json', ...POSTCSS_CONFIG_FILES];

export function getConfigSearchDirs(projectRoot = rootDir) {
  return [...new Set([path.resolve(projectRoot), rootDir])];
}

/**
 * Resolves the target Angular application project from angular.json.
 */
function getApplicationProjects() {
  const angularJsonPath = path.join(rootDir, 'angular.json');
  if (!fs.existsSync(angularJsonPath)) {
    return new Map();
  }
  const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
  const entries = Object.entries(angularJson.projects || {}).filter(
    ([, proj]) => proj.projectType === 'application' || Boolean(proj.architect?.build),
  );
  return new Map(entries);
}

function selectTargetProjectName(appProjects, projectArg) {
  const appNames = [...appProjects.keys()];
  if (projectArg) {
    if (!appProjects.has(projectArg)) {
      console.error(`\n[analyze-bundle] Error: Invalid application project "${projectArg}". Available: ${appNames.join(', ')}`);
      process.exit(1);
    }
    return projectArg;
  }
  if (appNames.length > 1) {
    console.error(`\n[analyze-bundle] Error: Multiple application projects in angular.json. Specify one: ${appNames.join(', ')}`);
    process.exit(1);
  }
  return appNames[0];
}

function extractGlobalStyleEntries(proj, relSourceRoot) {
  const rawStyles = proj.architect?.build?.options?.styles || [];
  const cssEntries = rawStyles
    .map((entry) => (typeof entry === 'string' ? entry : entry?.input))
    .filter((entry) => typeof entry === 'string' && entry.endsWith('.css'))
    .map((entry) => path.normalize(entry));
  return cssEntries.length > 0 ? cssEntries : [path.join(relSourceRoot, 'styles.css')];
}

export function resolveProjectConfig(projectArg) {
  const appProjects = getApplicationProjects();
  if (appProjects.size === 0) {
    return {
      projectName: 'default',
      projectRoot: rootDir,
      relSourceRoot: 'src',
      sourceRoot: SRC_DIR,
      distDir: DIST_DIR,
      globalStyles: [path.join('src', 'styles.css')],
    };
  }
  const projectName = selectTargetProjectName(appProjects, projectArg);
  const proj = appProjects.get(projectName);
  const relSourceRoot = proj.sourceRoot || 'src';
  const outOpt = proj.architect?.build?.options?.outputPath;
  const relDist = (typeof outOpt === 'string' ? outOpt : outOpt?.base) || path.join('dist', projectName);
  return {
    projectName,
    projectRoot: path.join(rootDir, proj.root || ''),
    relSourceRoot,
    sourceRoot: path.join(rootDir, relSourceRoot),
    distDir: path.join(rootDir, relDist),
    globalStyles: extractGlobalStyleEntries(proj, relSourceRoot),
  };
}

/**
 * Dynamically locates browser-stats.json or stats.json inside dist/.
 */
export function findStatsFile(distDir = DIST_DIR) {
  const searchDir = fs.existsSync(distDir) ? distDir : DIST_DIR;
  if (!fs.existsSync(searchDir)) {
    return null;
  }
  const entries = fs.readdirSync(searchDir, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && (entry.name === 'browser-stats.json' || entry.name === 'stats.json')) {
      const parent = entry.parentPath || entry.path;
      return path.join(parent, entry.name);
    }
  }
  return null;
}

function isAnyRootConfigStale(statsMtimeMs) {
  for (const cfgName of BUILD_CONFIG_FILES) {
    const cfgPath = path.join(rootDir, cfgName);
    if (fs.existsSync(cfgPath) && fs.statSync(cfgPath).mtimeMs > statsMtimeMs) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if any file in sourceRoot or root build configs has an mtimeMs greater than the given timestamp.
 */
function isStatsStale(statsMtimeMs, sourceRoot = SRC_DIR) {
  if (isAnyRootConfigStale(statsMtimeMs)) {
    return true;
  }
  if (!fs.existsSync(sourceRoot)) {
    return false;
  }
  const entries = fs.readdirSync(sourceRoot, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      const fullPath = path.join(entry.parentPath || entry.path, entry.name);
      try {
        if (fs.statSync(fullPath).mtimeMs > statsMtimeMs) {
          return true;
        }
      } catch {
        // Ignore unreadable or transient files
      }
    }
  }
  return false;
}

function getBuildReason(forceRebuild, distDir, sourceRoot) {
  if (forceRebuild) {
    return 'Forced rebuild requested (--rebuild).';
  }
  const existingStats = findStatsFile(distDir);
  if (!existingStats) {
    return 'browser-stats.json is missing.';
  }
  if (isStatsStale(fs.statSync(existingStats).mtimeMs, sourceRoot)) {
    return `Source files in ${path.relative(rootDir, sourceRoot) || 'src'} are newer than browser-stats.json.`;
  }
  return null;
}

/**
 * Ensures browser-stats.json is available and fresh.
 * Triggers npx ng build [project] --stats-json if missing, stale, or forced via --rebuild.
 */
export function ensureFreshStats(forceRebuild, projectConfig = {}) {
  const { projectName = 'default', sourceRoot = SRC_DIR, distDir = DIST_DIR } = projectConfig;
  const reason = getBuildReason(forceRebuild, distDir, sourceRoot);
  if (!reason) {
    return;
  }

  const buildCmd = projectName !== 'default' ? `npx ng build ${projectName} --stats-json` : 'npx ng build --stats-json';
  console.log(`\n[analyze-bundle] ${reason}\n[analyze-bundle] Executing "${buildCmd}" to generate fresh stats...\n`);
  try {
    execSync(buildCmd, { cwd: rootDir, stdio: 'inherit', env: process.env });
  } catch (error) {
    console.error('\n[analyze-bundle] Build failed:', error.message);
    process.exit(1);
  }
}

export function loadStats(distDir = DIST_DIR) {
  const statsFile = findStatsFile(distDir);
  if (!statsFile || !fs.existsSync(statsFile)) {
    console.error(`\n[analyze-bundle] Error: Stats file not found inside ${distDir}`);
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(statsFile, 'utf8');
    return { stats: JSON.parse(raw), statsFile };
  } catch (error) {
    console.error('\n[analyze-bundle] Error parsing stats JSON:', error.message);
    process.exit(1);
  }
}

export function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(2)} KB`;
}

export function formatPercentageRow([name], bytes, total) {
  const sizeStr = formatBytes(bytes).padStart(10);
  const pct = ((bytes / total) * 100).toFixed(1).padStart(5);
  return `  ${sizeStr}  (${pct}%)  ${name}`;
}

const defaultGetBytes = ([, val]) => (typeof val === 'number' ? val : (val.bytes ?? val.bytesInOutput));

/**
 * Generic helper to print top items with a remainder summary.
 */
export function printLimitedList({ items, label, getBytes = defaultGetBytes, formatRow, unitName = 'chunks' }) {
  if (items.length === 0) {
    return;
  }

  if (label) {
    console.log(`\n[${label}]`);
  }

  const totalBytes = items.reduce((sum, item) => sum + getBytes(item), 0);
  const topItems = items.slice(0, CHUNK_DISPLAY_LIMIT);

  for (const item of topItems) {
    const bytes = getBytes(item);
    console.log(formatRow(item, bytes, totalBytes));
  }

  if (items.length > CHUNK_DISPLAY_LIMIT) {
    const remaining = items.slice(CHUNK_DISPLAY_LIMIT);
    const remBytes = remaining.reduce((sum, item) => sum + getBytes(item), 0);
    console.log(`  ... and ${remaining.length} smaller ${unitName} (${formatBytes(remBytes)} total)`);
  }
}

export function extractNodeModuleName(inputPath) {
  const match = inputPath.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  return match ? match[1] : null;
}

export function categorizeInput(inputPath, relSourceRoot = 'src') {
  if (inputPath.startsWith('node_modules/')) {
    return extractNodeModuleName(inputPath) || 'other/node_modules';
  }
  const normalizedRoot = relSourceRoot.replaceAll('\\', '/').replace(/\/+$/, '');
  const appPrefix = `${normalizedRoot}/app/`;
  if (inputPath.startsWith(appPrefix)) {
    const rest = inputPath.slice(appPrefix.length);
    const slashIdx = rest.indexOf('/');
    return slashIdx !== -1 ? `app/${rest.slice(0, slashIdx)}` : 'app/root';
  }
  return 'app/main';
}

export function getEmbeddedStylesSummary(chunkPath, chunkBytes) {
  if (!fs.existsSync(chunkPath) || chunkBytes <= 0) {
    return null;
  }
  const matches = fs.readFileSync(chunkPath, 'utf8').match(/styles:\s*\[`[^`]+`\]/g) || [];
  let stylesTotal = 0;
  let rulesBytes = 0;
  let propertyBytes = 0;

  for (const m of matches) {
    stylesTotal += m.length;
    const propIdx = m.indexOf('@property');
    if (propIdx !== -1) {
      rulesBytes += propIdx;
      propertyBytes += m.length - propIdx;
    } else {
      rulesBytes += m.length;
    }
  }

  if (stylesTotal === 0) {
    return null;
  }
  const pct = ((stylesTotal / chunkBytes) * 100).toFixed(1);
  return `${formatBytes(stylesTotal)} (${pct}% of chunk) [Rules: ${formatBytes(rulesBytes)}, Tailwind @property: ${formatBytes(propertyBytes)}]`;
}

function isAngularComponentFile(inputPath, relSourceRoot = 'src') {
  const normalizedRoot = relSourceRoot.replaceAll('\\', '/').replace(/\/+$/, '');
  const appPrefix = `${normalizedRoot}/app/`;
  const rootAppFiles = new Set([`${appPrefix}app.ts`, `${appPrefix}app.component.ts`]);
  if (!inputPath.startsWith(appPrefix) || !inputPath.endsWith('.ts') || rootAppFiles.has(inputPath)) {
    return false;
  }
  const fullPath = path.join(rootDir, inputPath);
  return fs.existsSync(fullPath) && fs.readFileSync(fullPath, 'utf8').includes('@Component(');
}

function recordPackageLeak(packageLeaks, inputPath, bytes) {
  const pkgName = extractNodeModuleName(inputPath);
  if (!pkgName || ALLOWED_MAIN_PACKAGES.has(pkgName)) {
    return;
  }
  const existing = packageLeaks.get(pkgName);
  if (existing) {
    existing.bytes += bytes;
    existing.fileCount += 1;
  } else {
    packageLeaks.set(pkgName, {
      type: `Non-Baseline Package in Main (${pkgName})`,
      samplePath: inputPath,
      fileCount: 1,
      bytes,
      advice: `Verify if "${pkgName}" is required at initial startup; if not, move behind lazy-loaded routes, @defer, or injectAsync.`,
    });
  }
}

export function detectLeakedDependencies(inputEntries, relSourceRoot = 'src') {
  const packageLeaks = new Map();
  const eagerComponents = [];

  for (const [inputPath, val] of inputEntries) {
    if (val.bytesInOutput <= 0) {
      continue;
    }

    if (isAngularComponentFile(inputPath, relSourceRoot)) {
      eagerComponents.push({
        type: 'Eager Component in Main',
        path: inputPath,
        bytes: val.bytesInOutput,
        advice: 'Verify this component belongs on the initial startup view; lazy-load secondary routes via loadComponent or @defer.',
      });
    } else if (inputPath.startsWith('node_modules/')) {
      recordPackageLeak(packageLeaks, inputPath, val.bytesInOutput);
    }
  }

  const aggregatedPackageLeaks = [...packageLeaks.values()]
    .sort((a, b) => b.bytes - a.bytes)
    .map((entry) => ({
      type: entry.type,
      path: entry.fileCount > 1 ? `${entry.samplePath} (+${entry.fileCount - 1} more files)` : entry.samplePath,
      bytes: entry.bytes,
      advice: entry.advice,
    }));

  return [...aggregatedPackageLeaks, ...eagerComponents.sort((a, b) => b.bytes - a.bytes)];
}
