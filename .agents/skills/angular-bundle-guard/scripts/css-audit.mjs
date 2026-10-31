import path from 'node:path';
import { rootDir } from './bundle-utils.mjs';
import { processApplyRule } from './css-apply-rules.mjs';
import {
  extractAndAuditKeyframes,
  findDuplicateKeyframesAcrossFiles,
  findDuplicatesInSameFile,
  findIdenticalRulesAcrossFiles,
} from './css-duplicates.mjs';
import { auditThemeTokensAndVars, getPostcssBaseRecommendation, stripKeyframesBlocks } from './css-theme-audit.mjs';
import { buildComponentCssRows } from './component-css-calc.mjs';

function extractSelectorClassNames(selector) {
  if (selector.startsWith('@utility ')) {
    const utilName = selector.replace('@utility', '').trim();
    return utilName ? [utilName] : [];
  }
  const withoutHost = selector.replace(/:host(?:-context)?\([^)]*\)/g, ' ');
  return [...new Set([...withoutHost.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]))];
}

function seedGlobalCssSet(cssByRelPath, projectConfig = {}) {
  const configured = (projectConfig.globalStyles || [])
    .map((s) => path.normalize(s))
    .filter((s) => cssByRelPath.has(s));
  if (configured.length > 0) {
    return new Set(configured);
  }
  const appPrefix = `${path.join(projectConfig.relSourceRoot || 'src', 'app')}${path.sep}`;
  return new Set([...cssByRelPath.keys()].filter((rel) => !rel.startsWith(appPrefix)));
}

function collectGlobalCssFiles(allCodeFiles, projectConfig = {}) {
  const cssByRelPath = new Map(
    allCodeFiles.filter((f) => f.file.endsWith('.css')).map((f) => [path.relative(rootDir, f.file), f]),
  );
  const globalFiles = seedGlobalCssSet(cssByRelPath, projectConfig);
  const queue = [...globalFiles];
  while (queue.length > 0) {
    const currentRel = queue.shift();
    const fileObj = cssByRelPath.get(currentRel);
    if (fileObj) {
      for (const match of fileObj.content.matchAll(/@import\s+['"](\.[^'"]+)['"]/g)) {
        const resolvedRel = path.normalize(path.join(path.dirname(currentRel), match[1]));
        const withExt = resolvedRel.endsWith('.css') ? resolvedRel : `${resolvedRel}.css`;
        if (cssByRelPath.has(withExt) && !globalFiles.has(withExt)) {
          globalFiles.add(withExt);
          queue.push(withExt);
        }
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
    if (globalFile) {
      const clean = stripKeyframesBlocks(globalFile.content.replace(/\/\*[\s\S]*?\*\//g, ' '));
      for (const match of clean.matchAll(/([^{};]+)\{[^{}]+\}/g)) {
        const selector = match[1].trim();
        if (!selector.startsWith('@') || selector.startsWith('@utility')) {
          extractSelectorClassNames(selector).forEach((cls) => globalClassNames.add(cls));
        }
      }
    }
  }
  return { globalFiles, cssByRelPath, globalClassNames };
}

function matchLineRefs(regex, files) {
  return files
    .flatMap((f) => {
      if (!regex.test(f.content)) {
        return [];
      }
      const lines = f.content
        .split('\n')
        .map((line, idx) => (regex.test(line) ? idx + 1 : 0))
        .filter(Boolean);
      return lines.length > 0 ? [`${path.relative(rootDir, f.file)}:${lines.join(',')}`] : [];
    })
    .join(', ');
}

function buildClassTokenRegex(className) {
  return new RegExp(
    `(?<![a-zA-Z0-9_/-])${className}(?![a-zA-Z0-9_-]|\\.(?:component|directive|pipe|service|module|html|css|scss|ts|spec)\\b)`,
  );
}

function findFileLineRefs(className, files) {
  return matchLineRefs(buildClassTokenRegex(className), files);
}

function findCssApplyRefs(className, cssFiles) {
  return matchLineRefs(new RegExp(`@apply\\b[^;]*(?<![a-zA-Z0-9_-])${className}(?![a-zA-Z0-9_-])`), cssFiles);
}

function isClassUsedByPrefix(cls, files) {
  const dashIdx = cls.lastIndexOf('-');
  if (dashIdx <= 0) {
    return false;
  }
  const escapedPrefix = cls.slice(0, dashIdx + 1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefixRegex = new RegExp(`(?<![a-zA-Z0-9_-])${escapedPrefix}(?:\\$\\{|['"]\\s*\\+)`);
  return files.some((f) => prefixRegex.test(f.content));
}

function isClassUsedInState(cls, isUtility, state) {
  const wordRegex = buildClassTokenRegex(cls);
  const sameFileApplyRegex = new RegExp(`@apply\\b[^;]*(?<![a-zA-Z0-9_-])${cls}(?![a-zA-Z0-9_-])`);
  return (
    state.siblingRuntimeFiles.some((f) => wordRegex.test(f.content)) ||
    state.allRuntimeFiles.some((f) => wordRegex.test(f.content)) ||
    isClassUsedByPrefix(cls, state.siblingRuntimeFiles) ||
    isClassUsedByPrefix(cls, state.allRuntimeFiles) ||
    (!isUtility && sameFileApplyRegex.test(state.cleanCss || ''))
  );
}

function findDeadClassesInRule({ selector, classNames, bodyLength, relPath, state }) {
  const isUtility = selector.startsWith('@utility ');
  return classNames
    .filter((cls) => (state.isGlobal || !state.globalClassNames.has(cls)) && !isClassUsedInState(cls, isUtility, state))
    .map((cls) => ({
      relPath,
      selector: isUtility ? selector : `.${cls}`,
      className: cls,
      estBytes: Math.max(80, bodyLength * 2),
      specRefs: findFileLineRefs(cls, state.isGlobal ? state.allSpecFiles : state.siblingSpecFiles),
      cssApplyRefs: state.isGlobal ? findCssApplyRefs(cls, state.allCssFiles) : '',
    }));
}

function findMultiRuleClasses(clean) {
  const counts = new Map();
  for (const match of stripKeyframesBlocks(clean).matchAll(/([^{};]+)\{[^{}]+\}/g)) {
    const selector = match[1].trim();
    if (!selector.startsWith('@') || selector.startsWith('@utility')) {
      for (const cls of new Set(extractSelectorClassNames(selector))) {
        counts.set(cls, (counts.get(cls) || 0) + 1);
      }
    }
  }
  return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([cls]) => cls));
}

function getComponentDirsForCss(cssFile, allCodeFiles) {
  const normalizedCss = path.normalize(cssFile);
  const dir = path.dirname(normalizedCss);
  const base = path.basename(normalizedCss);
  const dirs = new Set();
  for (const f of allCodeFiles) {
    if (f.file.endsWith('.ts') && !f.file.endsWith('.spec.ts') && f.content.includes(base)) {
      const tsDir = path.dirname(f.file);
      const hasRelRef = [...f.content.matchAll(/['"]([^'"]+\.css)['"]/g)].some(
        (m) => path.resolve(tsDir, m[1]) === normalizedCss,
      );
      if (tsDir === dir || hasRelRef) {
        dirs.add(tsDir);
      }
    }
  }
  return dirs;
}

function isActiveCssFile(cssFile, allCodeFiles, globalFiles) {
  return globalFiles.has(path.relative(rootDir, cssFile)) || getComponentDirsForCss(cssFile, allCodeFiles).size > 0;
}

function createScanState({ cssFile, relPath, clean, allCodeFiles, allRuntimeFiles, globalCssMeta }) {
  const componentDirs = getComponentDirsForCss(cssFile, allCodeFiles);
  const activeDirs = componentDirs.size > 0 ? componentDirs : new Set([path.dirname(cssFile)]);
  const inActiveDir = (f) => activeDirs.has(path.dirname(f.file));
  const isTs = (f) => f.file.endsWith('.ts') && !f.file.endsWith('.spec.ts');
  return {
    isGlobal: globalCssMeta.globalFiles.has(relPath),
    hasReferencingComponent: componentDirs.size > 0,
    cleanCss: clean,
    globalClassNames: globalCssMeta.globalClassNames,
    multiRuleClasses: findMultiRuleClasses(clean),
    allRuntimeFiles,
    allHtmlFiles: allCodeFiles.filter((f) => f.file.endsWith('.html')),
    allTsFiles: allCodeFiles.filter(isTs),
    allSpecFiles: allCodeFiles.filter((f) => f.file.endsWith('.spec.ts')),
    allCssFiles: allCodeFiles.filter(
      (f) =>
        f.file.endsWith('.css') &&
        f.file !== cssFile &&
        isActiveCssFile(f.file, allCodeFiles, globalCssMeta.globalFiles),
    ),
    extractSelectorClassNames,
    findFileLineRefs,
    siblingRuntimeFiles: allRuntimeFiles.filter((f) => f.file !== cssFile && inActiveDir(f)),
    siblingHtmlFiles: allCodeFiles.filter((f) => f.file.endsWith('.html') && inActiveDir(f)),
    siblingTsFiles: allCodeFiles.filter((f) => isTs(f) && inActiveDir(f)),
    siblingSpecFiles: allCodeFiles.filter((f) => f.file.endsWith('.spec.ts') && inActiveDir(f)),
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
  const noKeyframes = stripKeyframesBlocks(clean);
  const conditionalOffsets = findConditionalRuleOffsets(noKeyframes);
  for (const match of noKeyframes.matchAll(/([^{};]+)\{([^{}]+)\}/g)) {
    const selector = match[1].trim();
    const body = match[2].trim();
    if (!selector.startsWith('@') || selector.startsWith('@utility')) {
      const line = noKeyframes.slice(0, match.index + match[1].search(/\S/)).split('\n').length;
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
}

function scanCssFile({ cssFile, allCodeFiles, allRuntimeFiles, globalCssMeta }) {
  const relPath = path.relative(rootDir, cssFile);
  const rawCss = globalCssMeta.cssByRelPath.get(relPath)?.content ?? '';
  const clean = rawCss.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const state = createScanState({ cssFile, relPath, clean, allCodeFiles, allRuntimeFiles, globalCssMeta });
  const base = path.basename(cssFile);

  if (!state.isGlobal && !state.hasReferencingComponent) {
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

export function getCssAnalysis({ allCodeFiles, outputEntries = [], statsFile, projectConfig = {} }) {
  const { globalFiles, cssByRelPath, globalClassNames } = getGlobalCssMeta(allCodeFiles, projectConfig);
  const allRuntimeFiles = allCodeFiles.filter((f) => !f.file.endsWith('.spec.ts') && !f.file.endsWith('.css'));
  const activeFiles = allCodeFiles.filter(
    (f) =>
      !f.file.endsWith('.spec.ts') && (!f.file.endsWith('.css') || isActiveCssFile(f.file, allCodeFiles, globalFiles)),
  );
  const { allKeyframes, globalUtilitiesByKeyframe, deadKeyframes, validCustomKeyframes } = extractAndAuditKeyframes(
    activeFiles.filter((f) => f.file.endsWith('.css')),
    globalFiles,
  );
  const themeAuditIssues = auditThemeTokensAndVars({ globalFiles, cssByRelPath, activeFiles, validCustomKeyframes });
  const result = {
    postcssRecommendation: getPostcssBaseRecommendation(projectConfig),
    componentCss: statsFile ? buildComponentCssRows({ outputEntries, statsFile, projectConfig, allCodeFiles }) : null,
    deadClasses: [...themeAuditIssues, ...deadKeyframes],
    shortStaticRules: [],
    partialStaticRules: [],
    duplicateRules: [],
  };
  const allRemainingRules = [];
  for (const cssFile of cssByRelPath.values()) {
    const r = scanCssFile({
      cssFile: cssFile.file,
      allCodeFiles,
      allRuntimeFiles,
      globalCssMeta: { globalFiles, cssByRelPath, globalClassNames },
    });
    result.deadClasses.push(...r.deadClasses);
    result.shortStaticRules.push(...r.shortStaticRules);
    result.partialStaticRules.push(...r.partialStaticRules);
    result.duplicateRules.push(...r.duplicateRules);
    allRemainingRules.push(...r.remainingApplyRules);
  }
  result.duplicateRules.push(
    ...findIdenticalRulesAcrossFiles(allRemainingRules),
    ...findDuplicateKeyframesAcrossFiles(allKeyframes, globalUtilitiesByKeyframe),
  );
  return result;
}
