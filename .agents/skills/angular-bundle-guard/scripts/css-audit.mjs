import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './bundle-utils.mjs';
import { findDuplicatesInSameFile, findIdenticalRulesAcrossFiles } from './css-duplicates.mjs';

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

function getGlobalCssMeta(allCodeFiles) {
  const globalPath = path.join('src', 'styles.css');
  const globalFile = allCodeFiles.find((f) => path.relative(rootDir, f.file) === globalPath);
  if (!globalFile) {
    return { globalClassNames: new Set(), themeTokenRegex: null };
  }
  const clean = globalFile.content.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const globalClassNames = new Set();
  for (const match of clean.matchAll(/([^{};]+)\{[^{}]+\}/g)) {
    const selector = match[1].trim();
    if (!selector.startsWith('@') || selector.startsWith('@utility')) {
      extractSelectorClassNames(selector).forEach((cls) => globalClassNames.add(cls));
    }
  }
  const tokens = [...clean.matchAll(/--(?:text-)?color-([a-zA-Z0-9_-]+)\s*:/g)].map((m) => m[1]);
  const themeTokenRegex = tokens.length
    ? new RegExp(`(?:^|:)(?:bg|text|border|ring|fill|stroke|outline)-(?:${tokens.join('|')})(?:/|$)`)
    : null;
  return { globalClassNames, themeTokenRegex };
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

function findDeadClassesInRule({ classNames, bodyLength, relPath, cssFile, state }) {
  const dead = [];
  for (const cls of classNames) {
    if (!state.isGlobal && state.globalClassNames.has(cls)) {
      continue;
    }
    const wordRegex = new RegExp(`(?<![a-zA-Z0-9_-])${cls}(?![a-zA-Z0-9_-])`);
    const isUsed = state.isGlobal
      ? state.allRuntimeFiles.some((f) => f.file !== cssFile && wordRegex.test(f.content))
      : state.siblingRuntimeFiles.some((f) => wordRegex.test(f.content));
    if (!isUsed) {
      const specRefs = state.isGlobal ? '' : findFileLineRefs(cls, state.siblingSpecFiles);
      dead.push({ relPath, selector: `.${cls}`, estBytes: Math.max(80, bodyLength * 2), specRefs });
    }
  }
  return dead;
}

function estimateShortRuleBytes(cssClassesToMoveToHtml) {
  return (
    45 +
    cssClassesToMoveToHtml.length * 32 +
    (cssClassesToMoveToHtml.includes('animate-spin') ? 95 : 0) +
    (cssClassesToMoveToHtml.some((u) => u.startsWith('duration-')) ? 180 : 0)
  );
}

function getCurrentHtmlClassCount(className, htmlFiles) {
  let maxCount = 1;
  for (const f of htmlFiles) {
    for (const match of f.content.matchAll(/\bclass\s*=\s*"([^"]*)"/g)) {
      const classes = match[1].trim().split(/\s+/).filter(Boolean);
      if (classes.includes(className) && classes.length > maxCount) {
        maxCount = classes.length;
      }
    }
  }
  return maxCount;
}

function isEligibleForHtmlMove({ selector, className, utilities, state }) {
  return (
    /^\.[a-zA-Z0-9_-]+$/.test(selector) &&
    !state.globalClassNames.has(className) &&
    !utilities.some((u) => /(?:^|:)list-(?!item$)/.test(u)) &&
    !findFileLineRefs(className, state.siblingTsFiles)
  );
}

function classifyStaticApplyRule({ selector, utilities, relPath, state }) {
  const className = selector.slice(1);
  if (!isEligibleForHtmlMove({ selector, className, utilities, state })) {
    return null;
  }
  const isThemeToken = (u) => u.includes('--') || Boolean(state.themeTokenRegex?.test(u));
  const cssClassesToKeepInCss = utilities.filter((u) => isThemeToken(u));
  const cssClassesToMoveToHtml = utilities.filter((u) => !isThemeToken(u));
  const currentHtmlClassCount = getCurrentHtmlClassCount(className, state.siblingHtmlFiles);
  const isFullMove = cssClassesToKeepInCss.length === 0 && !state.multiRuleClasses.has(className);
  const htmlClassCountAfterMove =
    (isFullMove ? currentHtmlClassCount - 1 : currentHtmlClassCount) + cssClassesToMoveToHtml.length;
  if (cssClassesToMoveToHtml.length === 0 || htmlClassCountAfterMove > 3) {
    return null;
  }
  const base = {
    relPath,
    selector,
    className,
    htmlLocations: findFileLineRefs(className, state.siblingHtmlFiles),
    specRefs: findFileLineRefs(className, state.siblingSpecFiles),
  };
  const moveToHtml = cssClassesToMoveToHtml.join(' ');
  return isFullMove
    ? {
        kind: 'short',
        rule: { ...base, utilities: moveToHtml, count: cssClassesToMoveToHtml.length, estBytes: estimateShortRuleBytes(cssClassesToMoveToHtml) },
      }
    : {
        kind: 'partial',
        rule: { ...base, moveToHtml, keepInCss: cssClassesToKeepInCss.join(' ') || '(shared rule in CSS)', estBytes: cssClassesToMoveToHtml.length * 28 },
      };
}

function processComponentApplyRule({ selector, body, relPath, state }) {
  if (state.isGlobal || selector.includes(':host')) {
    return;
  }
  const applyMatch = body.match(/@apply\s+([^;]+);/);
  if (!applyMatch) {
    return;
  }
  const utilities = applyMatch[1].trim().split(/\s+/).filter(Boolean);
  state.fileApplyBlocks.push({ selector, utilities, loc: relPath });

  const classified = classifyStaticApplyRule({ selector, utilities, relPath, state });
  if (classified?.kind === 'short') {
    state.shortStaticRules.push(classified.rule);
  } else if (classified?.kind === 'partial') {
    state.partialStaticRules.push(classified.rule);
  } else {
    const className = selector.slice(1);
    if (isEligibleForHtmlMove({ selector, className, utilities, state }) && !state.multiRuleClasses.has(className)) {
      state.remainingApplyRules.push({
        relPath,
        selector,
        className,
        utilities,
        htmlLocations: findFileLineRefs(className, state.siblingHtmlFiles),
        specRefs: findFileLineRefs(className, state.siblingSpecFiles),
      });
    }
  }
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

function createScanState({ cssFile, relPath, clean, allCodeFiles, allRuntimeFiles, globalCssMeta }) {
  const dir = path.dirname(cssFile);
  return {
    isGlobal: relPath === path.join('src', 'styles.css'),
    globalClassNames: globalCssMeta.globalClassNames,
    themeTokenRegex: globalCssMeta.themeTokenRegex,
    multiRuleClasses: findMultiRuleClasses(clean),
    allRuntimeFiles,
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

function scanCssFile({ cssFile, allCodeFiles, allRuntimeFiles, globalCssMeta }) {
  const relPath = path.relative(rootDir, cssFile);
  const clean = fs.readFileSync(cssFile, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const state = createScanState({ cssFile, relPath, clean, allCodeFiles, allRuntimeFiles, globalCssMeta });

  for (const match of clean.matchAll(/([^{};]+)\{([^{}]+)\}/g)) {
    const selector = match[1].trim();
    const body = match[2].trim();
    if (selector.startsWith('@') && !selector.startsWith('@utility')) {
      continue;
    }
    const line = clean.slice(0, match.index + match[1].search(/\S/)).split('\n').length;
    const loc = `${relPath}:${line}`;
    const deadInRule = findDeadClassesInRule({
      classNames: extractSelectorClassNames(selector),
      bodyLength: body.length,
      relPath: loc,
      cssFile,
      state,
    });
    state.deadClasses.push(...deadInRule);
    if (deadInRule.length === 0) {
      processComponentApplyRule({ selector, body, relPath: loc, state });
    }
  }

  return {
    deadClasses: state.deadClasses,
    shortStaticRules: state.shortStaticRules,
    partialStaticRules: state.partialStaticRules,
    remainingApplyRules: state.remainingApplyRules,
    duplicateRules: findDuplicatesInSameFile(state),
  };
}

export function getCssAnalysis(cssFiles, allCodeFiles) {
  const globalCssMeta = getGlobalCssMeta(allCodeFiles);
  const allRuntimeFiles = allCodeFiles.filter((f) => !f.file.endsWith('.spec.ts'));
  const result = { deadClasses: [], shortStaticRules: [], partialStaticRules: [], duplicateRules: [] };
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
