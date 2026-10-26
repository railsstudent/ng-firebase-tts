import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './bundle-utils.mjs';
import { processApplyRule } from './css-apply-rules.mjs';
import { findDuplicatesInSameFile, findIdenticalRulesAcrossFiles } from './css-duplicates.mjs';
import { auditThemeTokensAndVars, getPostcssBaseRecommendation } from './css-theme-audit.mjs';

export function getSourceFiles(dir, extList) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && extList.some((ext) => e.name.endsWith(ext)))
    .map((e) => path.join(e.parentPath || e.path, e.name));
}

function extractSelectorClassNames(selector) {
  if (selector.startsWith('@utility ')) {
    const utilName = selector.replace('@utility', '').trim();
    return utilName ? [utilName] : [];
  }
  return [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
}

function seedGlobalCssSet(cssByRelPath, projectConfig = {}) {
  const configured = (projectConfig.globalStyles || [])
    .map((s) => path.normalize(s))
    .filter((s) => cssByRelPath.has(s));
  if (configured.length > 0) {
    return new Set(configured);
  }
  const relSourceRoot = projectConfig.relSourceRoot || 'src';
  const appPrefix = `${path.join(relSourceRoot, 'app')}${path.sep}`;
  return new Set([...cssByRelPath.keys()].filter((rel) => !rel.startsWith(appPrefix)));
}

function collectGlobalCssFiles(allCodeFiles, projectConfig = {}) {
  const cssByRelPath = new Map(
    allCodeFiles
      .filter((f) => f.file.endsWith('.css'))
      .map((f) => [path.relative(rootDir, f.file), f]),
  );
  const globalFiles = seedGlobalCssSet(cssByRelPath, projectConfig);
  const queue = [...globalFiles];
  while (queue.length > 0) {
    const currentRel = queue.shift();
    const fileObj = cssByRelPath.get(currentRel);
    if (!fileObj) {
      continue;
    }
    for (const match of fileObj.content.matchAll(/@import\s+['"](\.[^'"]+)['"]/g)) {
      const resolvedRel = path.normalize(path.join(path.dirname(currentRel), match[1]));
      const withExt = resolvedRel.endsWith('.css') ? resolvedRel : `${resolvedRel}.css`;
      if (cssByRelPath.has(withExt) && !globalFiles.has(withExt)) {
        globalFiles.add(withExt);
        queue.push(withExt);
      }
    }
  }
  return { globalFiles, cssByRelPath };
}

function getGlobalCssMeta(allCodeFiles, projectConfig = {}) {
  const { globalFiles, cssByRelPath } = collectGlobalCssFiles(allCodeFiles, projectConfig);
  const globalClassNames = new Set();
  for (const relPath of globalFiles) {
    const globalFile = cssByRelPath.get(relPath);
    if (!globalFile) {
      continue;
    }
    const clean = globalFile.content.replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const match of clean.matchAll(/([^{};]+)\{[^{}]+\}/g)) {
      const selector = match[1].trim();
      if (!selector.startsWith('@') || selector.startsWith('@utility')) {
        extractSelectorClassNames(selector).forEach((cls) => globalClassNames.add(cls));
      }
    }
  }
  return { globalFiles, cssByRelPath, globalClassNames };
}

function findFileLineRefs(className, files) {
  const wordRegex = new RegExp(`(?<![a-zA-Z0-9_-])${className}(?![a-zA-Z0-9_-])`);
  const refs = [];
  for (const f of files) {
    const lines = wordRegex.test(f.content)
      ? f.content.split('\n').map((line, idx) => (wordRegex.test(line) ? idx + 1 : 0)).filter(Boolean)
      : [];
    if (lines.length > 0) {
      refs.push(`${path.relative(rootDir, f.file)}:${lines.join(',')}`);
    }
  }
  return refs.join(', ');
}

function findCssApplyRefs(className, cssFiles) {
  const applyLineRegex = new RegExp(`@apply\\b[^;]*(?<![a-zA-Z0-9_-])${className}(?![a-zA-Z0-9_-])`);
  const refs = [];
  for (const f of cssFiles) {
    const lines = applyLineRegex.test(f.content)
      ? f.content.split('\n').map((line, idx) => (applyLineRegex.test(line) ? idx + 1 : 0)).filter(Boolean)
      : [];
    if (lines.length > 0) {
      refs.push(`${path.relative(rootDir, f.file)}:${lines.join(',')}`);
    }
  }
  return refs.join(', ');
}

function findDeadClassesInRule({ selector, classNames, bodyLength, relPath, state }) {
  const dead = [];
  const isUtility = selector.startsWith('@utility ');
  for (const cls of classNames) {
    if (!state.isGlobal && state.globalClassNames.has(cls)) {
      continue;
    }
    const wordRegex = new RegExp(`(?<![a-zA-Z0-9_-])${cls}(?![a-zA-Z0-9_-])`);
    const isUsed = state.isGlobal
      ? state.allRuntimeFiles.some((f) => wordRegex.test(f.content))
      : state.siblingRuntimeFiles.some((f) => wordRegex.test(f.content));
    if (!isUsed) {
      const specRefs = findFileLineRefs(cls, state.isGlobal ? state.allSpecFiles : state.siblingSpecFiles);
      const cssApplyRefs = state.isGlobal ? findCssApplyRefs(cls, state.allCssFiles) : '';
      dead.push({
        relPath,
        selector: isUtility ? selector : `.${cls}`,
        className: cls,
        estBytes: Math.max(80, bodyLength * 2),
        specRefs,
        cssApplyRefs,
      });
    }
  }
  return dead;
}

function findMultiRuleClasses(clean) {
  const counts = new Map();
  for (const match of clean.matchAll(/([^{};]+)\{[^{}]+\}/g)) {
    const selector = match[1].trim();
    if (!selector.startsWith('@') || selector.startsWith('@utility')) {
      for (const cls of new Set(extractSelectorClassNames(selector))) {
        counts.set(cls, (counts.get(cls) || 0) + 1);
      }
    }
  }
  return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([cls]) => cls));
}

function isActiveCssFile(cssFile, allCodeFiles, globalFiles) {
  if (globalFiles.has(path.relative(rootDir, cssFile))) {
    return true;
  }
  const dir = path.dirname(cssFile);
  const base = path.basename(cssFile);
  return allCodeFiles.some(
    (f) => f.file.endsWith('.ts') && !f.file.endsWith('.spec.ts') && path.dirname(f.file) === dir && f.content.includes(base),
  );
}

function createScanState({ cssFile, relPath, clean, allCodeFiles, allRuntimeFiles, globalCssMeta }) {
  const dir = path.dirname(cssFile);
  return {
    isGlobal: globalCssMeta.globalFiles.has(relPath),
    globalClassNames: globalCssMeta.globalClassNames,
    multiRuleClasses: findMultiRuleClasses(clean),
    allRuntimeFiles,
    allHtmlFiles: allCodeFiles.filter((f) => f.file.endsWith('.html')),
    allTsFiles: allCodeFiles.filter((f) => f.file.endsWith('.ts') && !f.file.endsWith('.spec.ts')),
    allSpecFiles: allCodeFiles.filter((f) => f.file.endsWith('.spec.ts')),
    allCssFiles: allCodeFiles.filter(
      (f) => f.file.endsWith('.css') && f.file !== cssFile && isActiveCssFile(f.file, allCodeFiles, globalCssMeta.globalFiles),
    ),
    extractSelectorClassNames,
    findFileLineRefs,
    siblingRuntimeFiles: allRuntimeFiles.filter((f) => f.file !== cssFile && path.dirname(f.file) === dir),
    siblingHtmlFiles: allCodeFiles.filter((f) => f.file.endsWith('.html') && path.dirname(f.file) === dir),
    siblingTsFiles: allCodeFiles.filter(
      (f) => f.file.endsWith('.ts') && !f.file.endsWith('.spec.ts') && path.dirname(f.file) === dir,
    ),
    siblingSpecFiles: allCodeFiles.filter((f) => f.file.endsWith('.spec.ts') && path.dirname(f.file) === dir),
    deadClasses: [],
    shortStaticRules: [],
    partialStaticRules: [],
    remainingApplyRules: [],
    fileApplyBlocks: [],
  };
}

function findConditionalRuleOffsets(clean) {
  const offsets = new Set();
  const condRegex = /@(?:media|supports|container)\b[^{]*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  for (const condMatch of clean.matchAll(condRegex)) {
    const innerStart = condMatch.index + condMatch[0].indexOf('{') + 1;
    for (const innerRule of condMatch[1].matchAll(/([^{};]+)\{([^{}]+)\}/g)) {
      offsets.add(innerStart + innerRule.index);
    }
  }
  return offsets;
}

function scanCssRules(clean, relPath, state) {
  const conditionalOffsets = findConditionalRuleOffsets(clean);
  for (const match of clean.matchAll(/([^{};]+)\{([^{}]+)\}/g)) {
    const selector = match[1].trim();
    const body = match[2].trim();
    if (selector.startsWith('@') && !selector.startsWith('@utility')) {
      continue;
    }
    const line = clean.slice(0, match.index + match[1].search(/\S/)).split('\n').length;
    const loc = `${relPath}:${line}`;
    const deadInRule = findDeadClassesInRule({
      selector,
      classNames: extractSelectorClassNames(selector),
      bodyLength: body.length,
      relPath: loc,
      state,
    });
    state.deadClasses.push(...deadInRule);
    if (deadInRule.length === 0 && !conditionalOffsets.has(match.index)) {
      processApplyRule({ selector, body, relPath: loc, state });
    }
  }
}

function scanCssFile({ cssFile, allCodeFiles, allRuntimeFiles, globalCssMeta }) {
  const relPath = path.relative(rootDir, cssFile);
  const clean = fs.readFileSync(cssFile, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const state = createScanState({ cssFile, relPath, clean, allCodeFiles, allRuntimeFiles, globalCssMeta });
  const base = path.basename(cssFile);

  if (!state.isGlobal && !state.siblingTsFiles.some((f) => f.content.includes(base))) {
    state.deadClasses.push({
      relPath: `${relPath}:1`,
      selector: '(entire file)',
      className: base,
      estBytes: clean.length,
      specRefs: '',
      cssApplyRefs: '',
      isOrphanFile: true,
    });
  } else {
    scanCssRules(clean, relPath, state);
  }

  return {
    deadClasses: state.deadClasses,
    shortStaticRules: state.shortStaticRules,
    partialStaticRules: state.partialStaticRules,
    remainingApplyRules: state.remainingApplyRules,
    duplicateRules: findDuplicatesInSameFile(state),
  };
}

export function getCssAnalysis(cssFiles, allCodeFiles, projectConfig = {}) {
  const globalCssMeta = getGlobalCssMeta(allCodeFiles, projectConfig);
  const allRuntimeFiles = allCodeFiles.filter((f) => !f.file.endsWith('.spec.ts') && !f.file.endsWith('.css'));
  const activeFiles = allCodeFiles.filter(
    (f) => !f.file.endsWith('.spec.ts') && (!f.file.endsWith('.css') || isActiveCssFile(f.file, allCodeFiles, globalCssMeta.globalFiles)),
  );
  const result = {
    postcssRecommendation: getPostcssBaseRecommendation(projectConfig),
    deadClasses: auditThemeTokensAndVars({
      globalFiles: globalCssMeta.globalFiles,
      cssByRelPath: globalCssMeta.cssByRelPath,
      activeFiles,
    }),
    shortStaticRules: [],
    partialStaticRules: [],
    duplicateRules: [],
  };
  const allRemainingRules = [];
  for (const cssFile of cssFiles) {
    const r = scanCssFile({ cssFile, allCodeFiles, allRuntimeFiles, globalCssMeta });
    result.deadClasses.push(...r.deadClasses);
    result.shortStaticRules.push(...r.shortStaticRules);
    result.partialStaticRules.push(...r.partialStaticRules);
    result.duplicateRules.push(...r.duplicateRules);
    allRemainingRules.push(...r.remainingApplyRules);
  }
  result.duplicateRules.push(...findIdenticalRulesAcrossFiles(allRemainingRules));
  return result;
}
