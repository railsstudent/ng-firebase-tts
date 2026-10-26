import path from 'node:path';
import { extractNodeModuleName, formatBytes, rootDir } from './bundle-utils.mjs';
import {
  collectInjectAsyncCalls,
  findChainedInjectAsyncCalls,
  findMultiInjectAsyncPerCaller,
  findSequentialAwaitImports,
  findUnusedBarrelExportsInChunk,
  getLineNumber,
  loadTsConfigPathAliases,
  resolveImportToRelPath,
} from './ts-import-utils.mjs';

const BASELINE_LAZY_PACKAGES = new Set(['rxjs', 'tslib']);
const DEFER_HEAVY_PKG_BYTES = 50 * 1024;

function isBaselineLazyPackage(pkgName) {
  return !pkgName || pkgName.startsWith('@angular/') || BASELINE_LAZY_PACKAGES.has(pkgName);
}

function collectChunkComponentAndPackages(inputs, tsByRel, appPrefix) {
  const components = [];
  const packages = new Map();
  for (const [inputPath, val] of Object.entries(inputs || {})) {
    if (val.bytesInOutput <= 0) {
      continue;
    }
    const norm = path.normalize(inputPath);
    if (norm.startsWith(appPrefix) && tsByRel.get(norm)?.content.includes('@Component(')) {
      components.push(norm);
    } else if (norm.startsWith('node_modules/')) {
      const pkg = extractNodeModuleName(norm);
      if (!isBaselineLazyPackage(pkg)) {
        packages.set(pkg, (packages.get(pkg) || 0) + val.bytesInOutput);
      }
    }
  }
  return { components, packages };
}

function auditL1SdkInLazyComponentChunks({ outputEntries, tsFiles, deferredPaths, relSourceRoot }) {
  const appPrefix = path.normalize(`${relSourceRoot}/app/`);
  const tsByRel = new Map(tsFiles.map((f) => [path.relative(rootDir, f.file), f]));
  const findings = [];

  for (const [chunkName, data] of outputEntries) {
    if (!chunkName.endsWith('.js') || chunkName.startsWith('main-') || chunkName.startsWith('polyfills-')) {
      continue;
    }
    const { components, packages } = collectChunkComponentAndPackages(data.inputs, tsByRel, appPrefix);
    if (components.length === 0 || packages.size === 0) {
      continue;
    }
    const primaryComp = components[0];
    const minBytes = deferredPaths.has(primaryComp) ? DEFER_HEAVY_PKG_BYTES : 1;
    for (const [pkg, bytes] of packages.entries()) {
      if (bytes >= minBytes) {
        findings.push({
          location: primaryComp,
          detail: `Lazy component chunk ${chunkName} bundles external package "${pkg}" (${formatBytes(bytes)}) directly alongside ${path.basename(primaryComp)}.`,
          fix: `Load "${pkg}" on demand via injectAsync() or await import() when triggered by user interaction.`,
        });
      }
    }
  }
  return findings;
}

function buildFeatureSelectorMap(tsFiles, relSourceRoot) {
  const featuresPrefix = path.normalize(`${relSourceRoot}/app/features/`);
  const map = new Map();
  const selRegex = /selector:\s*['"](app-[a-z0-9-]+)['"]/;
  for (const f of tsFiles) {
    const rel = path.relative(rootDir, f.file);
    if (!rel.startsWith(featuresPrefix)) {
      continue;
    }
    const match = selRegex.exec(f.content);
    if (match) {
      map.set(match[1], rel);
    }
  }
  return map;
}

function collectLazyRouteComponentPaths(tsFiles, aliasConfig) {
  const routesFile = tsFiles.find((f) => f.file.endsWith('app.routes.ts'));
  if (!routesFile) {
    return new Set();
  }
  const paths = new Set();
  const regex = /loadComponent:\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of routesFile.content.matchAll(regex)) {
    const resolved = resolveImportToRelPath(m[1], routesFile.file, aliasConfig);
    if (resolved) {
      paths.add(resolved.endsWith('.ts') ? resolved : `${resolved}.ts`);
    }
  }
  return paths;
}

function auditL1UnwrappedIfChildrenInLazyRoutes({ allCodeFiles, tsFiles, aliasConfig }) {
  const lazyRoutePaths = collectLazyRouteComponentPaths(tsFiles, aliasConfig);
  if (lazyRoutePaths.size === 0) {
    return [];
  }
  const featureSelectors = buildFeatureSelectorMap(tsFiles, aliasConfig.relSourceRoot);
  const htmlByRel = new Map(
    allCodeFiles.filter((f) => f.file.endsWith('.html')).map((f) => [path.relative(rootDir, f.file), f]),
  );
  const findings = [];
  const ifBlockRegex = /@if\s*\([^)]+\)\s*\{([\s\S]*?)\}/g;

  for (const compRel of lazyRoutePaths) {
    const htmlRel = compRel.replace(/\.ts$/, '.html');
    const htmlFile = htmlByRel.get(htmlRel);
    if (!htmlFile) {
      continue;
    }
    const withoutDefer = htmlFile.content.replace(/@defer\b[\s\S]*?\{[\s\S]*?\}/g, '');
    for (const match of withoutDefer.matchAll(ifBlockRegex)) {
      for (const [selector] of featureSelectors.entries()) {
        if (match[1].includes(`<${selector}`)) {
          findings.push({
            location: `${htmlRel}:${getLineNumber(htmlFile.content, match.index)}`,
            detail: `Lazy route template renders feature component <${selector}> inside @if without @defer, bundling <${selector}> eagerly into the route chunk.`,
            fix: `Wrap <${selector}> in @defer so its code is downloaded only when the condition is met.`,
          });
        }
      }
    }
  }
  return findings;
}

function collectDeferredComponentPaths(allCodeFiles, tsFiles) {
  const selectorToRel = new Map();
  const selRegex = /selector:\s*['"](app-[a-z0-9-]+)['"]/;
  for (const f of tsFiles) {
    const match = selRegex.exec(f.content);
    if (match) {
      selectorToRel.set(match[1], path.relative(rootDir, f.file));
    }
  }
  const deferredPaths = new Set();
  const deferRegex = /@defer\b[^{]*\{([\s\S]*?)\}/g;
  const tagRegex = /<(app-[a-z0-9-]+)\b/g;
  for (const f of allCodeFiles.filter((file) => file.file.endsWith('.html'))) {
    for (const deferMatch of f.content.matchAll(deferRegex)) {
      for (const tagMatch of deferMatch[1].matchAll(tagRegex)) {
        const rel = selectorToRel.get(tagMatch[1]);
        if (rel) {
          deferredPaths.add(rel);
        }
      }
    }
  }
  return deferredPaths;
}

function hasExternalSdkImport(content) {
  const importRegex = /import\s*(?:\(\s*['"]([^'"]+)['"]\s*\)|[^;]+from\s+['"]([^'"]+)['"])/g;
  for (const m of content.matchAll(importRegex)) {
    const spec = m[1] || m[2];
    if (spec && !spec.startsWith('.') && !spec.startsWith('@/') && !isBaselineLazyPackage(spec)) {
      return true;
    }
  }
  return false;
}

function auditL2SequentialDownloads({ allCodeFiles, tsFiles, injectCalls, mainInputs }) {
  const deferredPaths = collectDeferredComponentPaths(allCodeFiles, tsFiles);
  const tsByRel = new Map(tsFiles.map((f) => [path.relative(rootDir, f.file), f]));
  const findings = [];

  for (const call of injectCalls) {
    if (!deferredPaths.has(call.callerRel)) {
      continue;
    }
    const targetFile = tsByRel.get(`${call.resolvedRel}.ts`);
    if (targetFile && !hasExternalSdkImport(targetFile.content)) {
      findings.push({
        location: `${call.callerRel}:${call.line}`,
        detail: `"${path.basename(call.callerRel)}" is already inside a @defer block and calls injectAsync("${call.specifier}") on a lightweight module, causing an extra back-to-back file download.`,
        fix: `Replace injectAsync() with synchronous inject() so the module bundles directly into the @defer chunk.`,
      });
    }
  }

  const mainRelSet = new Set(
    mainInputs.filter(([, v]) => v.bytesInOutput > 0).map(([p]) => path.normalize(p)),
  );
  const lazyCalls = mainRelSet.size > 0 ? injectCalls.filter((c) => !mainRelSet.has(c.callerRel)) : [];
  const lazyFiles =
    mainRelSet.size > 0 ? tsFiles.filter((f) => !mainRelSet.has(path.relative(rootDir, f.file))) : [];

  return [
    ...findings,
    ...findChainedInjectAsyncCalls(injectCalls, lazyCalls),
    ...findMultiInjectAsyncPerCaller(lazyCalls),
    ...findSequentialAwaitImports(lazyFiles),
  ];
}

function auditL3MisplacedBarrels(tsFiles, relSourceRoot) {
  const appPrefix = `${relSourceRoot.replaceAll('\\', '/')}/app/`;
  const allowedCoreBarrelRegex = new RegExp(`^${appPrefix.replaceAll('/', '\\/')}core\\/[a-zA-Z0-9_-]+\\/index\\.ts$`);
  const findings = [];
  for (const f of tsFiles) {
    const rel = path.relative(rootDir, f.file).replaceAll('\\', '/');
    if (rel.startsWith(appPrefix) && path.basename(rel) === 'index.ts' && !allowedCoreBarrelRegex.test(rel)) {
      findings.push({
        location: rel,
        detail: `Barrel file "${rel}" is outside "core/<domain>/index.ts", which can couple lazy chunks together.`,
        fix: `Remove "${rel}" and import files directly by their concrete path.`,
      });
    }
  }
  return findings;
}

function checkCrossFeatureImportsInFile({ fileObj, featureName, featuresPrefix, aliasConfig }) {
  const findings = [];
  const rel = path.relative(rootDir, fileObj.file);
  const importRegex = /^import\s+(?!type\b)[^;]+from\s+['"]([^'"]+)['"]/gm;
  for (const match of fileObj.content.matchAll(importRegex)) {
    const resolved = resolveImportToRelPath(match[1], fileObj.file, aliasConfig);
    if (!resolved || !resolved.startsWith(featuresPrefix)) {
      continue;
    }
    const targetFeature = resolved.slice(featuresPrefix.length).split(path.sep)[0];
    if (targetFeature && targetFeature !== featureName) {
      findings.push({
        location: `${rel}:${getLineNumber(fileObj.content, match.index)}`,
        detail: `Feature "${featureName}" imports runtime code from sibling feature "${targetFeature}" ("${match[1]}"), coupling their lazy chunks together.`,
        fix: `Move shared code to "shared/" or "core/" and import the concrete file directly.`,
      });
    }
  }
  return findings;
}

function auditL3SharedLazyAndBarrelLeaks({ outputEntries, tsFiles, aliasConfig }) {
  const findings = [...auditL3MisplacedBarrels(tsFiles, aliasConfig.relSourceRoot)];
  const seen = new Set(findings.map((f) => f.location));

  for (const [chunkName, data] of outputEntries) {
    if (!chunkName.endsWith('.js') || chunkName.startsWith('main-') || chunkName.startsWith('polyfills-')) {
      continue;
    }
    const unused = findUnusedBarrelExportsInChunk({
      chunkInputs: Object.entries(data.inputs || {}),
      tsFiles,
      aliasConfig,
      chunkLabel: chunkName,
    });
    for (const issue of unused) {
      if (!seen.has(`${issue.location}:${chunkName}`)) {
        seen.add(`${issue.location}:${chunkName}`);
        findings.push(issue);
      }
    }
  }

  const featuresPrefix = path.normalize(`${aliasConfig.relSourceRoot}/app/features/`);
  for (const f of tsFiles) {
    const rel = path.relative(rootDir, f.file);
    if (rel.startsWith(featuresPrefix)) {
      const featureName = rel.slice(featuresPrefix.length).split(path.sep)[0];
      findings.push(...checkCrossFeatureImportsInFile({ fileObj: f, featureName, featuresPrefix, aliasConfig }));
    }
  }
  return findings;
}

export function getLazyVectorAudit({ allCodeFiles, outputEntries = [], mainInputs = [], projectConfig = {} }) {
  const relSourceRoot = projectConfig.relSourceRoot || 'src';
  const aliasConfig = { ...loadTsConfigPathAliases(), relSourceRoot };
  const tsFiles = allCodeFiles.filter((f) => f.file.endsWith('.ts') && !f.file.endsWith('.spec.ts'));
  const injectCalls = collectInjectAsyncCalls(tsFiles, aliasConfig);
  const deferredPaths = collectDeferredComponentPaths(allCodeFiles, tsFiles);

  return [
    {
      id: 'L1',
      name: '1. Bloated Lazy Route / @defer Chunk',
      findings: [
        ...auditL1SdkInLazyComponentChunks({ outputEntries, tsFiles, deferredPaths, relSourceRoot }),
        ...auditL1UnwrappedIfChildrenInLazyRoutes({ allCodeFiles, tsFiles, aliasConfig }),
      ],
    },
    {
      id: 'L2',
      name: '2. Sequential Lazy Chunk Downloads',
      findings: auditL2SequentialDownloads({ allCodeFiles, tsFiles, injectCalls, mainInputs }),
    },
    {
      id: 'L3',
      name: '3. Shared Lazy Chunk & Barrel Leaks',
      findings: auditL3SharedLazyAndBarrelLeaks({ outputEntries, tsFiles, aliasConfig }),
    },
  ];
}
