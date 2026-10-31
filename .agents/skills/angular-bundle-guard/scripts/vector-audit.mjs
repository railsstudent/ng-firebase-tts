import path from 'node:path';
import { detectLeakedDependencies, formatBytes, rootDir } from './bundle-utils.mjs';
import { fileExists } from './fs-utils.mjs';
import {
  collectInjectAsyncCalls,
  findChainedInjectAsyncCalls,
  findMultiInjectAsyncPerCaller,
  findSequentialAwaitImports,
  findUnusedBarrelExportsInChunk,
  getLineNumber,
  loadTsConfigPathAliases,
} from './ts-import-utils.mjs';

function checkBarrelReExport(call, tsFiles) {
  const targetDir = path.dirname(call.resolvedRel);
  const targetBase = path.basename(call.resolvedRel);
  const barrelRel = path.join(targetDir, 'index.ts');
  const barrelFile = tsFiles.find((f) => path.relative(rootDir, f.file) === barrelRel);
  if (!barrelFile) {
    return null;
  }
  const reExportRegex = new RegExp(`export\\s+(?!type\\b)(?:\\*|\\{[^}]*\\})\\s+from\\s+['"]\\./${targetBase}['"]`);
  const match = reExportRegex.exec(barrelFile.content);
  if (!match) {
    return null;
  }
  const barrelLine = getLineNumber(barrelFile.content, match.index);
  return {
    location: `${barrelRel}:${barrelLine}`,
    detail: `Barrel re-exports "./${targetBase}" while ${call.callerRel}:${call.line} loads it via injectAsync(). Static imports from this barrel pull the module into the initial bundle and reduce injectAsync() to a tiny wrapper chunk.`,
    fix: `Remove "export * from './${targetBase}'" from ${barrelRel} and import "./${targetBase}" directly where needed.`,
  };
}

function auditVector1MixedBarrels({ injectCalls, tsFiles, mainInputs, aliasConfig }) {
  const findings = [];
  const seen = new Set();
  for (const call of injectCalls) {
    const asIndexAbs = path.join(rootDir, call.resolvedRel, 'index.ts');
    if (fileExists(asIndexAbs)) {
      findings.push({
        location: `${call.callerRel}:${call.line}`,
        detail: `injectAsync() imports barrel "${call.specifier}" (${path.join(call.resolvedRel, 'index.ts')}) instead of a direct file path, emitting an extra barrel wrapper chunk.`,
        fix: `Import the concrete file directly instead of the barrel index.ts.`,
      });
    } else {
      const barrelIssue = checkBarrelReExport(call, tsFiles);
      if (barrelIssue && !seen.has(barrelIssue.location)) {
        seen.add(barrelIssue.location);
        findings.push(barrelIssue);
      }
    }
  }
  for (const unusedIssue of findUnusedBarrelExportsInChunk({
    chunkInputs: mainInputs,
    tsFiles,
    aliasConfig,
    chunkLabel: 'main.js',
  })) {
    if (!seen.has(unusedIssue.location)) {
      seen.add(unusedIssue.location);
      findings.push(unusedIssue);
    }
  }
  return findings;
}

function auditVector2ValueImports(tsFiles) {
  const findings = [];
  const regex = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+\.(?:interface|type))['"]/gm;
  for (const f of tsFiles) {
    const rel = path.relative(rootDir, f.file);
    for (const match of f.content.matchAll(regex)) {
      const symbols = match[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (symbols.some((s) => !s.startsWith('type '))) {
        findings.push({
          location: `${rel}:${getLineNumber(f.content, match.index)}`,
          detail: `Value import from type-only module "${match[2]}".`,
          fix: `Use "import type { ... } from '${match[2]}'".`,
        });
      }
    }
  }
  return findings;
}

function auditVector3HeavySdkInMain(mainInputs, relSourceRoot = 'src') {
  const leaks = detectLeakedDependencies(mainInputs, relSourceRoot).filter((l) =>
    l.type.startsWith('Non-Baseline Package'),
  );
  return leaks.map((l) => ({
    location: l.path,
    detail: `${l.type} (${formatBytes(l.bytes)}) bundled into main.js.`,
    fix: l.advice,
  }));
}

function auditVector4BrokenDefer(tsFiles) {
  const findings = [];
  const regex = /viewChild(?:\.required)?\s*\(\s*([A-Z][a-zA-Z0-9_]*Component)\b/g;
  for (const f of tsFiles) {
    const rel = path.relative(rootDir, f.file);
    for (const match of f.content.matchAll(regex)) {
      findings.push({
        location: `${rel}:${getLineNumber(f.content, match.index)}`,
        detail: `viewChild(${match[1]}) references component class by value, which breaks @defer code-splitting if ${match[1]} is deferred.`,
        fix: `Use a template reference string: viewChild<${match[1]}>('ref') with import type { ${match[1]} }.`,
      });
    }
  }
  return findings;
}

function auditVector5NestedInjectAsync(injectCalls, tsFiles, mainInputs) {
  const mainRelSet = new Set(mainInputs.filter(([, v]) => v.bytesInOutput > 0).map(([p]) => path.normalize(p)));
  const scopedCalls = mainRelSet.size > 0 ? injectCalls.filter((c) => mainRelSet.has(c.callerRel)) : injectCalls;
  const scopedFiles =
    mainRelSet.size > 0 ? tsFiles.filter((f) => mainRelSet.has(path.relative(rootDir, f.file))) : tsFiles;
  return [
    ...findChainedInjectAsyncCalls(injectCalls, scopedCalls),
    ...findMultiInjectAsyncPerCaller(scopedCalls),
    ...findSequentialAwaitImports(scopedFiles),
  ];
}

function getExemptRouteTargets(routesContent) {
  const exempt = new Set(["''", '""', "'**'", '"**"']);
  const redirectRegex = /path:\s*['"]['"][^}]*?redirectTo:\s*(['"][^'"]+['"]|[A-Za-z0-9_.]+)/g;
  for (const m of routesContent.matchAll(redirectRegex)) {
    exempt.add(m[1].trim());
  }
  return exempt;
}

function auditVector6EagerRoutes(tsFiles) {
  const routesFile = tsFiles.find((f) => f.file.endsWith('app.routes.ts'));
  if (!routesFile) {
    return [];
  }
  const findings = [];
  const rel = path.relative(rootDir, routesFile.file);
  const exemptTargets = getExemptRouteTargets(routesFile.content);
  const regex = /path:\s*(['"][^'"]*['"]|[A-Za-z0-9_.]+)[^}]*?component:\s*([A-Z][a-zA-Z0-9_]*)/g;
  for (const match of routesFile.content.matchAll(regex)) {
    const rawPath = match[1].trim();
    if (!exemptTargets.has(rawPath)) {
      const displayPath = rawPath.replace(/^['"]|['"]$/g, '');
      findings.push({
        location: `${rel}:${getLineNumber(routesFile.content, match.index)}`,
        detail: `Non-default route "${displayPath}" uses eager "component: ${match[2]}" instead of lazy loadComponent.`,
        fix: `Convert route "${displayPath}" to use loadComponent: () => import(...).`,
      });
    }
  }
  return findings;
}

function auditVector7AppConfig(tsFiles) {
  const cfgFile = tsFiles.find((f) => f.file.endsWith('app.config.ts'));
  if (!cfgFile) {
    return [];
  }
  const findings = [];
  const rel = path.relative(rootDir, cfgFile.file);
  const regex = /import\s+[^;]+from\s+['"]((?:@[a-zA-Z0-9_-]*\/|\.\.?\/)(?:features|core)\/[^'"]+)['"]/g;
  for (const match of cfgFile.content.matchAll(regex)) {
    findings.push({
      location: `${rel}:${getLineNumber(cfgFile.content, match.index)}`,
      detail: `app.config.ts statically imports "${match[1]}", pulling it into main.js at startup.`,
      fix: `Lazy-load "${match[1]}" via injectAsync() or await import() inside the initializer/interceptor callback.`,
    });
  }
  return findings;
}

function auditVector8StaticJsonInMain(mainInputs) {
  return mainInputs
    .filter(([inputPath, val]) => inputPath.endsWith('.json') && val.bytesInOutput > 0)
    .map(([inputPath, val]) => ({
      location: inputPath,
      detail: `Static JSON asset (${formatBytes(val.bytesInOutput)}) bundled eagerly into main.js.`,
      fix: `Load the JSON asset lazily inside an on-demand service or @defer boundary if not required on initial paint.`,
    }));
}

export function getVectorAudit(allCodeFiles, mainInputs = [], projectConfig = {}) {
  const relSourceRoot = projectConfig.relSourceRoot || 'src';
  const aliasConfig = { ...loadTsConfigPathAliases(), relSourceRoot };
  const tsFiles = allCodeFiles.filter((f) => f.file.endsWith('.ts') && !f.file.endsWith('.spec.ts'));
  const injectCalls = collectInjectAsyncCalls(tsFiles, aliasConfig);

  return [
    {
      id: 1,
      name: '1. Mixed Barrel File (index.ts)',
      findings: auditVector1MixedBarrels({ injectCalls, tsFiles, mainInputs, aliasConfig }),
    },
    { id: 2, name: '2. Value Import Instead of Type Import', findings: auditVector2ValueImports(tsFiles) },
    {
      id: 3,
      name: '3. Top-Level Heavy SDK Import in Main',
      findings: auditVector3HeavySdkInMain(mainInputs, relSourceRoot),
    },
    { id: 4, name: '4. Broken @defer Boundary (viewChild by Value)', findings: auditVector4BrokenDefer(tsFiles) },
    {
      id: 5,
      name: '5. Redundant Nested injectAsync() & Sequential await import()',
      findings: auditVector5NestedInjectAsync(injectCalls, tsFiles, mainInputs),
    },
    { id: 6, name: '6. Non-Home Eager Route component:', findings: auditVector6EagerRoutes(tsFiles) },
    { id: 7, name: '7. app.config.ts Eager Feature/Core Imports', findings: auditVector7AppConfig(tsFiles) },
    { id: 8, name: '8. Static JSON Assets in Main Bundle', findings: auditVector8StaticJsonInMain(mainInputs) },
  ];
}
