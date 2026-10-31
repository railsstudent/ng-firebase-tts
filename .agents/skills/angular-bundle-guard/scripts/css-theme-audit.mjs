import path from 'node:path';
import { getConfigSearchDirs, POSTCSS_CONFIG_FILES, rootDir } from './bundle-utils.mjs';
import { fileExists, readJsonFile } from './fs-utils.mjs';

const COLOR_PREFIXES = 'bg|text|border|ring|fill|stroke|from|via|to|outline|accent|caret|divide|placeholder';
const SPACING_PREFIXES =
  'p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|w|min-w|max-w|h|min-h|max-h|size|inset|inset-x|inset-y|top|right|bottom|left|start|end|basis|scroll-m|scroll-mx|scroll-my|scroll-mt|scroll-mr|scroll-mb|scroll-ml|scroll-ms|scroll-me|scroll-p|scroll-px|scroll-py|scroll-pt|scroll-pr|scroll-pb|scroll-pl|scroll-ps|scroll-pe|indent';

function findPostcssConfigFile(projectRoot = rootDir) {
  for (const dir of getConfigSearchDirs(projectRoot)) {
    for (const name of POSTCSS_CONFIG_FILES) {
      const candidate = path.join(dir, name);
      if (fileExists(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function extractTailwindPostcssOptions(plugins) {
  if (!plugins || typeof plugins !== 'object') {
    return undefined;
  }
  const tailwindCssKey = '@tailwindcss/postcss';
  if (Array.isArray(plugins)) {
    const entry = plugins.find((p) => p === tailwindCssKey || (Array.isArray(p) && p[0] === tailwindCssKey));
    if (!entry) {
      return undefined;
    }
    return Array.isArray(entry) ? (entry[1] ?? {}) : {};
  }
  return plugins[tailwindCssKey];
}

export function getPostcssBaseRecommendation(projectConfig = {}) {
  const configPath = findPostcssConfigFile(projectConfig.projectRoot || rootDir);
  if (!configPath) {
    return null;
  }
  try {
    const raw = readJsonFile(configPath);
    const twOpts = extractTailwindPostcssOptions(raw?.plugins);
    if (twOpts && typeof twOpts === 'object' && !twOpts.base) {
      const relConfig = path.relative(rootDir, configPath);
      const targetSrc = projectConfig.sourceRoot || path.join(rootDir, 'src');
      const relBase = `./${path.relative(path.dirname(configPath), targetSrc).replaceAll('\\', '/')}`;
      return `Recommendation: Add "base": "${relBase}" under "@tailwindcss/postcss" in ${relConfig} so Tailwind only scans this app's source files and keeps styles.css smaller.`;
    }
  } catch {
    return null;
  }
  return null;
}

function buildThemeTokenUtilityRegex(tokenName) {
  const rules = [
    ['--font-', (s) => `font-${s}`],
    ['--text-color-', (s) => `text-${s}`],
    ['--background-color-', (s) => `bg-${s}`],
    ['--border-color-', (s) => `border-${s}`],
    ['--ring-color-', (s) => `ring-${s}`],
    ['--color-', (s) => `(?:${COLOR_PREFIXES})-${s}`],
    ['--spacing-', (s) => `-?(?:${SPACING_PREFIXES})-${s}`],
    ['--container-', (s) => `(?:max-w|min-w|w)-${s}`],
    ['--radius-', (s) => `rounded(?:-[a-z]+)?-${s}`],
    ['--shadow-', (s) => `(?:inset-|drop-)?shadow-${s}`],
    ['--default-transition-', () => 'transition(?:-[a-z]+)?'],
  ];
  const matched = rules.find(([prefix]) => tokenName.startsWith(prefix));
  const utilPattern = matched ? matched[1](tokenName.slice(matched[0].length)) : tokenName.replace(/^--/, '');
  return new RegExp(`(?:(?<![a-zA-Z0-9_-])|:)(?:${utilPattern}|${tokenName})(?![a-zA-Z0-9_-])`);
}

const THEME_PREFIX_OVERRIDES = {
  '--tw-ring-color': 'ring',
  'ring-color': 'ring',
  'box-shadow': 'shadow',
};

export function getSuggestedThemeUtility(utilPrefix, varName, themeTokens) {
  if (!themeTokens.has(varName)) {
    return null;
  }
  const stripPrefixes = [
    '--text-color-',
    '--background-color-',
    '--border-color-',
    '--ring-color-',
    '--color-',
    '--font-',
    '--spacing-',
    '--container-',
    '--shadow-',
  ];
  const matched = stripPrefixes.find((p) => varName.startsWith(p));
  if (!matched) {
    return null;
  }
  const normalizedPrefix = THEME_PREFIX_OVERRIDES[utilPrefix] || utilPrefix;
  return `${normalizedPrefix}-${varName.slice(matched.length)}`;
}

function extractThemeTokensFromGlobalFiles(globalFiles, cssByRelPath) {
  const themeTokens = new Map();
  for (const relPath of globalFiles) {
    const fileObj = cssByRelPath.get(relPath);
    if (fileObj) {
      const clean = fileObj.content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
      for (const blockMatch of clean.matchAll(/@theme(?:\s+[a-z-]+)?\s*\{([\s\S]*?)\}/g)) {
        const blockStart = blockMatch.index + blockMatch[0].indexOf('{') + 1;
        const blockBody = blockMatch[1];
        for (const varMatch of blockBody.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) {
          const line = clean.slice(0, blockStart + varMatch.index).split('\n').length;
          themeTokens.set(varMatch[1], { relPath: `${relPath}:${line}`, file: fileObj.file, line });
        }
      }
    }
  }
  return themeTokens;
}

function collectDefinedCssVariables(activeFiles) {
  const defined = new Set();
  for (const f of activeFiles) {
    for (const m of f.content.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) {
      defined.add(m[1]);
    }
    for (const m of f.content.matchAll(/\[style\.(--[a-zA-Z0-9_-]+)\]/g)) {
      defined.add(m[1]);
    }
  }
  return defined;
}

function findUnusedThemeTokens(themeTokens, activeFiles) {
  const findings = [];
  for (const [tokenName, meta] of themeTokens.entries()) {
    const usageRegex = buildThemeTokenUtilityRegex(tokenName);
    const isUsed = activeFiles.some((f) =>
      f.content
        .split('\n')
        .some((line, idx) => !(f.file === meta.file && idx + 1 === meta.line) && usageRegex.test(line)),
    );
    if (!isUsed) {
      findings.push({
        relPath: meta.relPath,
        selector: tokenName,
        className: tokenName,
        estBytes: 45,
        specRefs: '',
        cssApplyRefs: '',
        themeIssueAction: `Delete unused <code>@theme</code> token <code>${tokenName}</code> from CSS (no utility or variable reference uses it).`,
      });
    }
  }
  return findings;
}

function inspectParenthesizedVarMatch({ match, loc, themeTokens, definedVars }) {
  const [fullUtil, utilPrefix, varName] = match;
  const suggested = getSuggestedThemeUtility(utilPrefix, varName, themeTokens);
  if (!suggested && definedVars.has(varName) && !loc.includes('.css:')) {
    return null;
  }
  let themeIssueAction = `Broken CSS variable: <code>${varName}</code> in <code>${fullUtil}</code> is not defined in any CSS file.`;
  if (suggested) {
    themeIssueAction = `Replace <code>${fullUtil}</code> with native <code>@theme</code> utility <code>${suggested}</code>.`;
  } else if (definedVars.has(varName)) {
    themeIssueAction = `Move <code>${varName}</code> into <code>@theme static</code> in <code>styles.css</code> and replace <code>${fullUtil}</code> with a standard Tailwind utility.`;
  }
  return {
    relPath: loc,
    selector: fullUtil,
    className: fullUtil,
    estBytes: 30,
    specRefs: '',
    cssApplyRefs: '',
    themeIssueAction,
  };
}

function findParenthesizedVarIssues(activeFiles, themeTokens, definedVars) {
  const findings = [];
  const parenVarRegex = /((?:[a-zA-Z0-9_-]+:)*[a-zA-Z0-9_-]+)-\((--[a-zA-Z0-9_-]+)\)/g;
  for (const f of activeFiles) {
    const rel = path.relative(rootDir, f.file);
    const lines = f.content.split('\n');
    for (let idx = 0; idx < lines.length; idx = idx + 1) {
      for (const match of lines[idx].matchAll(parenVarRegex)) {
        const issue = inspectParenthesizedVarMatch({
          match,
          loc: `${rel}:${idx + 1}`,
          themeTokens,
          definedVars,
        });
        if (issue) {
          findings.push(issue);
        }
      }
    }
  }
  return findings;
}

const PROP_TO_UTIL_PREFIX = {
  background: 'bg',
  'background-color': 'bg',
  color: 'text',
  'border-color': 'border',
  'box-shadow': 'shadow',
  '--tw-ring-color': 'ring',
  'font-family': 'font',
};

export function stripKeyframesBlocks(clean) {
  return clean.replace(/@keyframes\s+[a-zA-Z0-9_-]+\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, (m) => m.replace(/[^\n]/g, ' '));
}

function isExcludedVanillaRule({ selector, prop, val, validCustomKeyframes }) {
  if (/::-(?:webkit|ms)-|:-(?:webkit|ms)-/.test(selector)) {
    return true;
  }
  if (/^-(?:webkit|ms)-/.test(prop) || prop === 'scrollbar-width') {
    return true;
  }
  if (/(?:radial|linear)-gradient\(/.test(val)) {
    return true;
  }
  if ((prop === 'animation' || prop === 'animation-name') && validCustomKeyframes) {
    return val.split(/[\s,]+/).some((t) => validCustomKeyframes.has(t));
  }
  return false;
}

function buildVanillaDeclarationFinding({ loc, selector, prop, val, themeTokens }) {
  const rawDecl = `${prop}: ${val}`;
  const displaySelector = `${selector} -> ${rawDecl}`;
  const singleVarMatch = val.match(/^var\((--[a-zA-Z0-9_-]+)\)$/);
  const utilPrefix = PROP_TO_UTIL_PREFIX[prop] || prop;
  const suggested = singleVarMatch ? getSuggestedThemeUtility(utilPrefix, singleVarMatch[1], themeTokens) : null;

  let action = 'Convert vanilla CSS to Tailwind utility in .html (or @apply)';
  let estBytes = 40;
  if (suggested) {
    estBytes = 45;
    const baseSelector = selector
      .split(',')
      .map((s) => s.replace(/:host-context\(\.dark\)\s*/g, '').trim())
      .join(', ');
    action = selector.includes(':host-context(.dark)')
      ? `Fold 'dark:${suggested}' into base '${baseSelector}' rule and delete this :host-context(.dark) block`
      : `Replace with '@apply ${suggested}' or move to .html`;
  } else if (prop === 'backdrop-filter' || prop === 'filter') {
    estBytes = 45;
    action =
      'Convert to Tailwind utility in .html (avoid @apply in component .css, which injects ~1.2 KB @property boilerplate)';
  }

  return {
    relPath: loc,
    selector: displaySelector,
    className: rawDecl,
    estBytes,
    specRefs: '',
    cssApplyRefs: '',
    action,
    themeIssueAction: suggested ? `<code>${action}</code>` : action,
  };
}

export function findVanillaCssAndVarIssues({
  activeFiles,
  globalFiles,
  themeTokens,
  validCustomKeyframes = new Set(),
}) {
  const findings = [];
  for (const f of activeFiles) {
    const relPath = path.relative(rootDir, f.file);
    if (f.file.endsWith('.css') && !globalFiles.has(relPath)) {
      const clean = stripKeyframesBlocks(f.content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')));
      for (const ruleMatch of clean.matchAll(/([^{};]+)\{([^{}]+)\}/g)) {
        const selector = ruleMatch[1].trim().replace(/\s+/g, ' ');
        if (!selector.startsWith('@')) {
          const bodyStart = ruleMatch.index + ruleMatch[0].indexOf('{') + 1;
          const bodyNoApply = ruleMatch[2].replace(/@apply\s+[^;{}]+;?/g, (m) => m.replace(/[^\n]/g, ' '));
          for (const declMatch of bodyNoApply.matchAll(/(?:^|[;\n])\s*([a-zA-Z_-]+)\s*:\s*([^;{}]+)/g)) {
            const prop = declMatch[1].trim();
            const val = declMatch[2].trim();
            if (!isExcludedVanillaRule({ selector, prop, val, validCustomKeyframes })) {
              const propOffset = declMatch.index + declMatch[0].indexOf(declMatch[1]);
              const line = clean.slice(0, bodyStart + propOffset).split('\n').length;
              findings.push(
                buildVanillaDeclarationFinding({ loc: `${relPath}:${line}`, selector, prop, val, themeTokens }),
              );
            }
          }
        }
      }
    }
  }
  return findings;
}

export function auditThemeTokensAndVars({ globalFiles, cssByRelPath, activeFiles, validCustomKeyframes = new Set() }) {
  const themeTokens = extractThemeTokensFromGlobalFiles(globalFiles, cssByRelPath);
  const definedVars = collectDefinedCssVariables(activeFiles);
  return [
    ...findUnusedThemeTokens(themeTokens, activeFiles),
    ...findParenthesizedVarIssues(activeFiles, themeTokens, definedVars),
    ...findVanillaCssAndVarIssues({ activeFiles, globalFiles, themeTokens, validCustomKeyframes }),
  ];
}
