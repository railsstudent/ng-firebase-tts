import fs from 'node:fs';
import path from 'node:path';
import { getConfigSearchDirs, POSTCSS_CONFIG_FILES, rootDir } from './bundle-utils.mjs';

const COLOR_PREFIXES = 'bg|text|border|ring|fill|stroke|from|via|to|outline|accent|caret|divide|placeholder';

function findPostcssConfigFile(projectRoot = rootDir) {
  for (const dir of getConfigSearchDirs(projectRoot)) {
    for (const name of POSTCSS_CONFIG_FILES) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) {
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
    return Array.isArray(entry) ? (entry[1] ?? {}) : entry ? {} : undefined;
  }
  return plugins[tailwindCssKey];
}

export function getPostcssBaseRecommendation(projectConfig = {}) {
  const configPath = findPostcssConfigFile(projectConfig.projectRoot || rootDir);
  if (!configPath) {
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const twOpts = extractTailwindPostcssOptions(raw.plugins);
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
    ['--radius-', (s) => `rounded-${s}`],
    ['--shadow-', (s) => `shadow-${s}`],
  ];
  const matched = rules.find(([prefix]) => tokenName.startsWith(prefix));
  const utilPattern = matched ? matched[1](tokenName.slice(matched[0].length)) : tokenName.replace(/^--/, '');
  return new RegExp(`(?:(?<![a-zA-Z0-9_-])|:)(?:${utilPattern}|${tokenName})(?![a-zA-Z0-9_-])`);
}

function getSuggestedThemeUtility(utilPrefix, varName, themeTokens) {
  if (!themeTokens.has(varName)) {
    return null;
  }
  const stripPrefixes = ['--text-color-', '--background-color-', '--border-color-', '--ring-color-', '--color-', '--font-'];
  const matched = stripPrefixes.find((p) => varName.startsWith(p));
  if (!matched) {
    return null;
  }
  return `${utilPrefix}-${varName.slice(matched.length)}`;
}

function extractThemeTokensFromGlobalFiles(globalFiles, cssByRelPath) {
  const themeTokens = new Map();
  for (const relPath of globalFiles) {
    const fileObj = cssByRelPath.get(relPath);
    if (!fileObj) {
      continue;
    }
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
      f.content.split('\n').some((line, idx) => !(f.file === meta.file && idx + 1 === meta.line) && usageRegex.test(line)),
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
  const fullUtil = match[0];
  const utilPrefix = match[1];
  const varName = match[2];
  const suggested = getSuggestedThemeUtility(utilPrefix, varName, themeTokens);
  if (suggested) {
    return {
      relPath: loc,
      selector: fullUtil,
      className: fullUtil,
      estBytes: 30,
      specRefs: '',
      cssApplyRefs: '',
      themeIssueAction: `Replace <code>${fullUtil}</code> with native <code>@theme</code> utility <code>${suggested}</code>.`,
    };
  }
  if (!definedVars.has(varName)) {
    return {
      relPath: loc,
      selector: fullUtil,
      className: fullUtil,
      estBytes: 30,
      specRefs: '',
      cssApplyRefs: '',
      themeIssueAction: `Broken CSS variable: <code>${varName}</code> in <code>${fullUtil}</code> is not defined in any CSS file.`,
    };
  }
  return null;
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

export function auditThemeTokensAndVars({ globalFiles, cssByRelPath, activeFiles }) {
  const themeTokens = extractThemeTokensFromGlobalFiles(globalFiles, cssByRelPath);
  const definedVars = collectDefinedCssVariables(activeFiles);
  return [
    ...findUnusedThemeTokens(themeTokens, activeFiles),
    ...findParenthesizedVarIssues(activeFiles, themeTokens, definedVars),
  ];
}
