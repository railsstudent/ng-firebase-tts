import fs from 'node:fs';
import path from 'node:path';
import { detectLeakedDependencies, formatBytes, rootDir } from './bundle-utils.mjs';

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function resolveImportToRelPath(specifier, fromFile) {
  if (specifier.startsWith('@/')) {
    return path.join('src', 'app', specifier.slice(2));
  }
  if (specifier.startsWith('.')) {
    return path.relative(rootDir, path.resolve(path.dirname(fromFile), specifier));
  }
  return null;
}

function collectInjectAsyncCalls(tsFiles) {
  const calls = [];
  const regex = /injectAsync\s*\([\s\S]*?import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const f of tsFiles) {
    for (const match of f.content.matchAll(regex)) {
      const specifier = match[1];
      const resolvedRel = resolveImportToRelPath(specifier, f.file);
      if (resolvedRel) {
        calls.push({
          callerRel: path.relative(rootDir, f.file),
          line: getLineNumber(f.content, match.index),
          specifier,
          resolvedRel,
        });
      }
    }
  }
  return calls;
}

function checkBarrelReExport(call, tsFiles) {
  const targetDir = path.dirname(call.resolvedRel);
  const targetBase = path.basename(call.resolvedRel);
  const barrelRel = path.join(targetDir, 'index.ts');
  const barrelFile = tsFiles.find((f) => path.relative(rootDir, f.file) === barrelRel);
  if (!barrelFile) {
    return null;
  }
  const reExportRegex = new RegExp(`export\\s+\\*\\s+from\\s+['"]\\./${targetBase}['"]`);
  const match = reExportRegex.exec(barrelFile.content);
  if (!match) {
    return null;
  }
  const barrelLine = getLineNumber(barrelFile.content, match.index);
  return {
    location: `${barrelRel}:${barrelLine}`,
    detail: `Barrel re-exports "./${targetBase}" while ${call.callerRel}:${call.line} loads it via injectAsync(). Static imports from this barrel hoist the service and reduce injectAsync() to a tiny wrapper chunk.`,
    fix: `Remove "export * from './${targetBase}'" from ${barrelRel} and import the service directly where needed.`,
  };
}

function auditVector1MixedBarrels(injectCalls, tsFiles) {
  const findings = [];
  const seen = new Set();
  for (const call of injectCalls) {
    const asIndexAbs = path.join(rootDir, call.resolvedRel, 'index.ts');
    if (fs.existsSync(asIndexAbs)) {
      findings.push({
        location: `${call.callerRel}:${call.line}`,
        detail: `injectAsync() imports barrel "${call.specifier}" (${path.join(call.resolvedRel, 'index.ts')}) instead of a direct service file, emitting an extra barrel wrapper chunk.`,
        fix: `Import the concrete service file directly (e.g., "${call.specifier}/<name>.service").`,
      });
      continue;
    }
    const barrelIssue = checkBarrelReExport(call, tsFiles);
    if (barrelIssue && !seen.has(barrelIssue.location)) {
      seen.add(barrelIssue.location);
      findings.push(barrelIssue);
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
      const symbols = match[1].split(',').map((s) => s.trim()).filter(Boolean);
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

function auditVector3HeavySdkInMain(mainInputs) {
  const leaks = detectLeakedDependencies(mainInputs).filter((l) => l.type.startsWith('Non-Baseline Package'));
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

function auditVector5NestedInjectAsync(injectCalls) {
  const targetRelSet = new Set(injectCalls.map((c) => `${c.resolvedRel}.ts`));
  const findings = [];
  for (const call of injectCalls) {
    if (targetRelSet.has(call.callerRel)) {
      findings.push({
        location: `${call.callerRel}:${call.line}`,
        detail: `"${path.basename(call.callerRel)}" is already lazy-loaded via injectAsync(), and calls injectAsync() again for "${call.specifier}", creating a sequential network waterfall hop.`,
        fix: `Use synchronous inject() inside "${path.basename(call.callerRel)}" and keep both services out of barrel index.ts files.`,
      });
    }
  }
  return findings;
}

function auditVector6EagerRoutes(tsFiles) {
  const routesFile = tsFiles.find((f) => f.file.endsWith('app.routes.ts'));
  if (!routesFile) {
    return [];
  }
  const findings = [];
  const rel = path.relative(rootDir, routesFile.file);
  const regex = /path:\s*['"]([^'"]+)['"][^}]*?component:\s*([A-Z][a-zA-Z0-9_]*)/g;
  for (const match of routesFile.content.matchAll(regex)) {
    findings.push({
      location: `${rel}:${getLineNumber(routesFile.content, match.index)}`,
      detail: `Non-default route "${match[1]}" uses eager "component: ${match[2]}" instead of lazy loadComponent.`,
      fix: `Convert route "${match[1]}" to use loadComponent: () => import(...).`,
    });
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
  const regex = /import\s+[^;]+from\s+['"](@\/(?:features|core)\/[^'"]+)['"]/g;
  for (const match of cfgFile.content.matchAll(regex)) {
    findings.push({
      location: `${rel}:${getLineNumber(cfgFile.content, match.index)}`,
      detail: `app.config.ts statically imports "${match[1]}", hoisting it into main.js at startup.`,
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

export function getVectorAudit(allCodeFiles, mainInputs = []) {
  const tsFiles = allCodeFiles.filter((f) => f.file.endsWith('.ts') && !f.file.endsWith('.spec.ts'));
  const injectCalls = collectInjectAsyncCalls(tsFiles);

  return [
    { id: 1, name: '1. Mixed Barrel File (index.ts)', findings: auditVector1MixedBarrels(injectCalls, tsFiles) },
    { id: 2, name: '2. Value Import Instead of Type Import', findings: auditVector2ValueImports(tsFiles) },
    { id: 3, name: '3. Top-Level Heavy SDK Import in Main', findings: auditVector3HeavySdkInMain(mainInputs) },
    { id: 4, name: '4. Broken @defer Boundary (viewChild by Value)', findings: auditVector4BrokenDefer(tsFiles) },
    { id: 5, name: '5. Redundant Nested injectAsync() Hops', findings: auditVector5NestedInjectAsync(injectCalls) },
    { id: 6, name: '6. Non-Home Eager Route component:', findings: auditVector6EagerRoutes(tsFiles) },
    { id: 7, name: '7. app.config.ts Eager Feature/Core Imports', findings: auditVector7AppConfig(tsFiles) },
    { id: 8, name: '8. Static JSON Assets in Main Bundle', findings: auditVector8StaticJsonInMain(mainInputs) },
  ];
}
