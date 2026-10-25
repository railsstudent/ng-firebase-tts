import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './bundle-utils.mjs';

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

function getGlobalClassNames(allCodeFiles) {
  const globalPath = path.join('src', 'styles.css');
  const globalFile = allCodeFiles.find((f) => path.relative(rootDir, f.file) === globalPath);
  if (!globalFile) {
    return new Set();
  }
  const clean = globalFile.content.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const names = new Set();
  for (const match of clean.matchAll(/([^{};]+)\{[^{}]+\}/g)) {
    const selector = match[1].trim();
    if (!selector.startsWith('@') || selector.startsWith('@utility')) {
      for (const cls of extractSelectorClassNames(selector)) {
        names.add(cls);
      }
    }
  }
  return names;
}

function findFileLineRefs(className, files) {
  const wordRegex = new RegExp(`(?<![a-zA-Z0-9_-])${className}(?![a-zA-Z0-9_-])`);
  const refs = [];
  for (const f of files) {
    if (!wordRegex.test(f.content)) {
      continue;
    }
    const lines = [];
    const fileLines = f.content.split('\n');
    for (let i = 0; i < fileLines.length; i = i + 1) {
      if (wordRegex.test(fileLines[i])) {
        lines.push(i + 1);
      }
    }
    if (lines.length > 0) {
      refs.push(`${path.relative(rootDir, f.file)}:${lines.join(',')}`);
    }
  }
  return refs.join(', ');
}

function findDeadClassesInRule({
  classNames,
  bodyLength,
  relPath,
  cssFile,
  isGlobal,
  siblingRuntimeFiles,
  siblingSpecFiles,
  allRuntimeFiles,
  globalClassNames,
}) {
  const dead = [];
  for (const cls of classNames) {
    if (!isGlobal && globalClassNames.has(cls)) {
      continue;
    }
    const wordRegex = new RegExp(`(?<![a-zA-Z0-9_-])${cls}(?![a-zA-Z0-9_-])`);
    const isUsed = isGlobal
      ? allRuntimeFiles.some((f) => f.file !== cssFile && wordRegex.test(f.content))
      : siblingRuntimeFiles.some((f) => wordRegex.test(f.content));
    if (!isUsed) {
      const specRefs = isGlobal ? '' : findFileLineRefs(cls, siblingSpecFiles);
      dead.push({ relPath, selector: `.${cls}`, estBytes: Math.max(80, bodyLength * 2), specRefs });
    }
  }
  return dead;
}

function estimateShortRuleBytes(staticUtils) {
  let estBytes = 45 + staticUtils.length * 32;
  if (staticUtils.includes('animate-spin')) {
    estBytes += 95;
  }
  if (staticUtils.some((u) => u.startsWith('duration-'))) {
    estBytes += 180;
  }
  return estBytes;
}

function classifyStaticApplyRule({ selector, utilities, relPath, state }) {
  const className = selector.slice(1);
  if (!/^\.[a-zA-Z0-9_-]+$/.test(selector) || state.globalClassNames.has(className)) {
    return null;
  }
  const cssVarUtils = utilities.filter((u) => u.includes('--'));
  const staticUtils = utilities.filter((u) => !u.includes('--'));
  if (staticUtils.length === 0 || staticUtils.length > 3) {
    return null;
  }
  const base = {
    relPath,
    selector,
    className,
    htmlLocations: findFileLineRefs(className, state.siblingHtmlFiles),
    specRefs: findFileLineRefs(className, state.siblingSpecFiles),
  };
  if (cssVarUtils.length === 0 && !state.multiRuleClasses.has(className)) {
    return {
      kind: 'short',
      rule: {
        ...base,
        utilities: staticUtils.join(' '),
        count: staticUtils.length,
        estBytes: estimateShortRuleBytes(staticUtils),
      },
    };
  }
  return {
    kind: 'partial',
    rule: {
      ...base,
      moveToHtml: staticUtils.join(' '),
      keepInCss: cssVarUtils.length > 0 ? cssVarUtils.join(' ') : '(shared rule in CSS)',
      estBytes: staticUtils.length * 28,
    },
  };
}

function buildDuplicatePairEntry({ a, b, state }) {
  const shared = a.utilities.filter((u) => b.utilities.includes(u));
  if (shared.length < 5 || shared.length < Math.min(a.utilities.length, b.utilities.length) - 1) {
    return null;
  }
  const aCls = a.selector.slice(1);
  const bCls = b.selector.slice(1);
  const onlyInA = a.utilities.filter((u) => !b.utilities.includes(u));
  const onlyInB = b.utilities.filter((u) => !a.utilities.includes(u));
  const hints = [
    ...(onlyInA.length > 0 ? [`add "${onlyInA.join(' ')}" to "${aCls}" in HTML`] : []),
    `replace "${bCls}" with "${aCls}${onlyInB.length > 0 ? ` ${onlyInB.join(' ')}` : ''}" in HTML & delete ${b.selector} from CSS`,
  ];
  return {
    relPath: a.loc,
    selectors: `${a.selector}, ${b.selector}`,
    sharedCount: shared.length,
    fixCss: `${a.selector} { @apply ${shared.join(' ')}; }`,
    unsharedHint: hints.join('; '),
    htmlLocations: [aCls, bCls].map((c) => findFileLineRefs(c, state.siblingHtmlFiles)).filter(Boolean).join(', '),
    specRefs: [aCls, bCls].map((c) => findFileLineRefs(c, state.siblingSpecFiles)).filter(Boolean).join(', '),
    estBytes: shared.length * 180,
  };
}

function buildRedundantMultiSelectorEntry({ block, state }) {
  const parts = block.selector.split(',').map((s) => s.trim());
  if (parts.length < 2 || !parts.every((p) => /^\.[a-zA-Z0-9_-]+$/.test(p))) {
    return null;
  }
  const classes = parts.map((p) => p.slice(1));
  const hasNonShortOtherRule = classes.some((cls) =>
    state.fileApplyBlocks.some(
      (other) =>
        other !== block &&
        extractSelectorClassNames(other.selector).includes(cls) &&
        (other.selector !== `.${cls}` || other.utilities.length > 3 || other.utilities.some((u) => u.includes('--'))),
    ),
  );
  if (hasNonShortOtherRule) {
    return null;
  }
  const [keepCls, ...dropClasses] = classes;
  return {
    relPath: block.loc,
    selectors: block.selector,
    sharedCount: block.utilities.length,
    fixCss: `.${keepCls} { @apply ${block.utilities.join(' ')}; }`,
    unsharedHint: `replace ${dropClasses.map((c) => `"${c}"`).join(', ')} with "${keepCls}" in HTML (single shared class; extra class names not needed)`,
    htmlLocations: classes.map((c) => findFileLineRefs(c, state.siblingHtmlFiles)).filter(Boolean).join(', '),
    specRefs: classes.map((c) => findFileLineRefs(c, state.siblingSpecFiles)).filter(Boolean).join(', '),
    estBytes: dropClasses.length * 45,
  };
}

function findDuplicateApplyRules(state) {
  const duplicates = [];
  const blocks = state.fileApplyBlocks;
  for (let i = 0; i < blocks.length; i = i + 1) {
    const multiEntry = buildRedundantMultiSelectorEntry({ block: blocks[i], state });
    if (multiEntry) {
      duplicates.push(multiEntry);
    }
    for (let j = i + 1; j < blocks.length; j = j + 1) {
      if (blocks[i].utilities.length >= 5 && blocks[j].utilities.length >= 5) {
        const pairEntry = buildDuplicatePairEntry({ a: blocks[i], b: blocks[j], state });
        if (pairEntry) {
          duplicates.push(pairEntry);
        }
      }
    }
  }
  return duplicates;
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

function createScanState({ cssFile, relPath, clean, allCodeFiles, allRuntimeFiles, globalClassNames }) {
  const dir = path.dirname(cssFile);
  return {
    isGlobal: relPath === path.join('src', 'styles.css'),
    globalClassNames,
    multiRuleClasses: findMultiRuleClasses(clean),
    allRuntimeFiles,
    siblingRuntimeFiles: allRuntimeFiles.filter((f) => f.file !== cssFile && path.dirname(f.file) === dir),
    siblingHtmlFiles: allCodeFiles.filter((f) => f.file.endsWith('.html') && path.dirname(f.file) === dir),
    siblingSpecFiles: allCodeFiles.filter((f) => f.file.endsWith('.spec.ts') && path.dirname(f.file) === dir),
    deadClasses: [],
    shortStaticRules: [],
    partialStaticRules: [],
    fileApplyBlocks: [],
  };
}

function scanCssFile({ cssFile, allCodeFiles, allRuntimeFiles, globalClassNames }) {
  const relPath = path.relative(rootDir, cssFile);
  const clean = fs.readFileSync(cssFile, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const state = createScanState({ cssFile, relPath, clean, allCodeFiles, allRuntimeFiles, globalClassNames });

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
      isGlobal: state.isGlobal,
      siblingRuntimeFiles: state.siblingRuntimeFiles,
      siblingSpecFiles: state.siblingSpecFiles,
      allRuntimeFiles: state.allRuntimeFiles,
      globalClassNames: state.globalClassNames,
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
    duplicateRules: findDuplicateApplyRules(state),
  };
}

export function getCssAnalysis(cssFiles, allCodeFiles) {
  const globalClassNames = getGlobalClassNames(allCodeFiles);
  const allRuntimeFiles = allCodeFiles.filter((f) => !f.file.endsWith('.spec.ts'));
  const deadClasses = [];
  const shortStaticRules = [];
  const partialStaticRules = [];
  const duplicateRules = [];

  for (const cssFile of cssFiles) {
    const r = scanCssFile({ cssFile, allCodeFiles, allRuntimeFiles, globalClassNames });
    deadClasses.push(...r.deadClasses);
    shortStaticRules.push(...r.shortStaticRules);
    partialStaticRules.push(...r.partialStaticRules);
    duplicateRules.push(...r.duplicateRules);
  }

  return { deadClasses, shortStaticRules, partialStaticRules, duplicateRules };
}
