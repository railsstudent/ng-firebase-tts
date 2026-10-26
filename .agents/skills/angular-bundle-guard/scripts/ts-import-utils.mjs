import fs from 'node:fs';
import path from 'node:path';
import { formatBytes, rootDir } from './bundle-utils.mjs';

export function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

export function loadTsConfigPathAliases() {
  const tsconfigPath = path.join(rootDir, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    return { baseUrl: '.', paths: {} };
  }
  try {
    const cleaned = fs.readFileSync(tsconfigPath, 'utf8').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
    const parsed = JSON.parse(cleaned);
    const co = parsed.compilerOptions || {};
    return { baseUrl: co.baseUrl || '.', paths: co.paths || {} };
  } catch {
    return { baseUrl: '.', paths: {} };
  }
}

function resolveAliasFromPaths(specifier, aliasConfig) {
  for (const [pattern, targets] of Object.entries(aliasConfig.paths)) {
    if (!Array.isArray(targets) || targets.length === 0) {
      continue;
    }
    const prefix = pattern.replace(/\*$/, '');
    if (specifier.startsWith(prefix)) {
      const rest = specifier.slice(prefix.length);
      const target = targets[0].replace(/\*$/, '');
      return path.normalize(path.join(aliasConfig.baseUrl, target, rest));
    }
  }
  return null;
}

export function resolveImportToRelPath(specifier, fromFile, aliasConfig) {
  const aliased = resolveAliasFromPaths(specifier, aliasConfig);
  if (aliased) {
    return aliased;
  }
  if (specifier.startsWith('@/')) {
    return path.join(aliasConfig.relSourceRoot || 'src', 'app', specifier.slice(2));
  }
  if (specifier.startsWith('.')) {
    return path.relative(rootDir, path.resolve(path.dirname(fromFile), specifier));
  }
  return null;
}

export function collectInjectAsyncCalls(tsFiles, aliasConfig) {
  const calls = [];
  const regex = /injectAsync\s*\([\s\S]*?import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const f of tsFiles) {
    for (const match of f.content.matchAll(regex)) {
      const specifier = match[1];
      const resolvedRel = resolveImportToRelPath(specifier, f.file, aliasConfig);
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

function extractExportedRuntimeIds(content) {
  const ids = new Set();
  const declRegex = /export\s+(?:default\s+)?(?:abstract\s+)?(?:class|function|const|let|var|enum)\s+([A-Za-z0-9_$]+)/g;
  for (const m of content.matchAll(declRegex)) {
    ids.add(m[1]);
  }
  const namedRegex = /export\s+(?!type\b)\{([^}]+)\}/g;
  for (const m of content.matchAll(namedRegex)) {
    for (const raw of m[1].split(',')) {
      const part = raw.trim();
      if (part && !part.startsWith('type ')) {
        const exportedName = part.split(/\s+as\s+/).pop().trim();
        if (exportedName) {
          ids.add(exportedName);
        }
      }
    }
  }
  return [...ids];
}

function checkBarrelTargetInChunk({ barrelFile, match, tsByRel, chunkBytes, otherChunkFiles, aliasConfig, chunkLabel }) {
  const specifier = match[1];
  const resolved = resolveImportToRelPath(specifier, barrelFile.file, aliasConfig);
  const targetRel = resolved ? (resolved.endsWith('.ts') ? resolved : `${resolved}.ts`) : null;
  const bytes = targetRel ? chunkBytes.get(targetRel) : 0;
  const targetFile = targetRel ? tsByRel.get(targetRel) : null;
  if (!bytes || !targetFile || otherChunkFiles.length <= 1) {
    return null;
  }
  const exportedIds = extractExportedRuntimeIds(targetFile.content);
  if (exportedIds.length === 0) {
    return null;
  }
  const idRegex = new RegExp(`\\b(?:${exportedIds.join('|')})\\b`);
  const isUsed = otherChunkFiles.some((f) => f.rel !== targetRel && idRegex.test(f.content));
  if (isUsed) {
    return null;
  }
  const barrelRel = path.relative(rootDir, barrelFile.file);
  const line = getLineNumber(barrelFile.content, match.index);
  return {
    location: `${barrelRel}:${line}`,
    detail: `Barrel re-exports "${specifier}", pulling ${path.basename(targetRel)} (${formatBytes(bytes)}) into ${chunkLabel} even though no other file in ${chunkLabel} uses its exports (${exportedIds.join(', ')}).`,
    fix: `Remove the "${specifier}" re-export from ${barrelRel} and import "${specifier}" directly by its file path where needed.`,
  };
}

export function findUnusedBarrelExportsInChunk({ chunkInputs, tsFiles, aliasConfig, chunkLabel = 'main.js' }) {
  const chunkBytes = new Map(
    chunkInputs.filter(([, v]) => v.bytesInOutput > 0).map(([p, v]) => [path.normalize(p), v.bytesInOutput]),
  );
  if (chunkBytes.size === 0) {
    return [];
  }
  const tsByRel = new Map(tsFiles.map((f) => [path.relative(rootDir, f.file), f]));
  const otherChunkFiles = [...chunkBytes.keys()]
    .map((rel) => ({ rel, content: tsByRel.get(rel)?.content || '' }))
    .filter((f) => f.content && path.basename(f.rel) !== 'index.ts');

  const findings = [];
  const reExportRegex = /^export\s+(?!type\b)(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/gm;
  for (const barrelFile of tsFiles.filter((f) => path.basename(f.file) === 'index.ts')) {
    for (const match of barrelFile.content.matchAll(reExportRegex)) {
      const issue = checkBarrelTargetInChunk({
        barrelFile,
        match,
        tsByRel,
        chunkBytes,
        otherChunkFiles,
        aliasConfig,
        chunkLabel,
      });
      if (issue) {
        findings.push(issue);
      }
    }
  }
  return findings;
}

export function findMultiInjectAsyncPerCaller(injectCalls) {
  const callsByCaller = new Map();
  for (const call of injectCalls) {
    const list = callsByCaller.get(call.callerRel) || [];
    list.push(call);
    callsByCaller.set(call.callerRel, list);
  }
  const findings = [];
  for (const [callerRel, list] of callsByCaller.entries()) {
    if (list.length > 1) {
      const specs = list.map((c) => c.specifier).join(', ');
      findings.push({
        location: `${callerRel}:${list[0].line}`,
        detail: `"${path.basename(callerRel)}" calls injectAsync() ${list.length} times (${specs}). If already inside @defer, this creates extra sequential downloads.`,
        fix: `Use normal inject() if "${path.basename(callerRel)}" is inside @defer, or run multiple injectAsync() calls in parallel with Promise.all([...]).`,
      });
    }
  }
  return findings;
}

export function findSequentialAwaitImports(tsFiles) {
  const findings = [];
  const blockRegex = /async\s+(?:function\s+)?([a-zA-Z0-9_]+)?\s*\([^)]*\)\s*(?::\s*[^{]+)?\{([\s\S]*?)^\s{2,4}\}/gm;
  const awaitImportRegex = /await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const f of tsFiles) {
    const rel = path.relative(rootDir, f.file);
    for (const match of f.content.matchAll(blockRegex)) {
      const imports = [...match[2].matchAll(awaitImportRegex)];
      if (imports.length > 1) {
        const line = getLineNumber(f.content, match.index);
        const specs = imports.map((m) => m[1]).join(', ');
        findings.push({
          location: `${rel}:${line}`,
          detail: `"${match[1] || 'async function'}()" calls "await import()" ${imports.length} times sequentially (${specs}).`,
          fix: `Run independent dynamic imports concurrently with Promise.all([${imports.map((m) => `import('${m[1]}')`).join(', ')}]).`,
        });
      }
    }
  }
  return findings;
}

export function findChainedInjectAsyncCalls(allInjectCalls, scopedInjectCalls = allInjectCalls) {
  const targetRelSet = new Set(allInjectCalls.map((c) => `${c.resolvedRel}.ts`));
  const findings = [];
  for (const call of scopedInjectCalls) {
    if (targetRelSet.has(call.callerRel)) {
      findings.push({
        location: `${call.callerRel}:${call.line}`,
        detail: `"${path.basename(call.callerRel)}" is already lazy-loaded via injectAsync(), and calls injectAsync() again for "${call.specifier}", causing an extra back-to-back file download.`,
        fix: `Use synchronous inject() inside "${path.basename(call.callerRel)}" and keep both modules out of barrel index.ts files.`,
      });
    }
  }
  return findings;
}
