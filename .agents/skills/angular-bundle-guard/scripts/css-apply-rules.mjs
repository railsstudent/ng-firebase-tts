import path from 'node:path';
import { rootDir } from './bundle-utils.mjs';

export function isDynamicallyBoundInHtml(className, htmlFiles) {
  const dynamicRegex = new RegExp(
    `\\[class\\.${className}\\]|(?:\\[class\\]|\\[ngClass\\])\\s*=\\s*"[^"]*(?<![a-zA-Z0-9_-])${className}(?![a-zA-Z0-9_-])`,
  );
  return htmlFiles.some((f) => dynamicRegex.test(f.content));
}

function extractApplyClassName(selector, isGlobal) {
  if (isGlobal) {
    if (!selector.startsWith('@utility ')) {
      return null;
    }
    return selector.replace('@utility', '').trim() || null;
  }
  return /^\.[a-zA-Z0-9_-]+$/.test(selector) ? selector.slice(1) : null;
}

function getRuleTargetFiles(state) {
  return {
    htmlFiles: state.isGlobal ? state.allHtmlFiles : state.siblingHtmlFiles,
    tsFiles: state.isGlobal ? state.allTsFiles : state.siblingTsFiles,
    specFiles: state.isGlobal ? state.allSpecFiles : state.siblingSpecFiles,
  };
}

export function isEligibleForHtmlMove({ className, utilities, state }) {
  if (!className) {
    return false;
  }
  if (!state.isGlobal && state.globalClassNames.has(className)) {
    return false;
  }
  if (utilities.some((u) => /(?:^|:)list-(?!item$)/.test(u))) {
    return false;
  }
  const { htmlFiles, tsFiles } = getRuleTargetFiles(state);
  return !state.findFileLineRefs(className, tsFiles) && !isDynamicallyBoundInHtml(className, htmlFiles);
}

function evaluateHtmlClassCounts({ className, isFullMove, moveCount, htmlFiles }) {
  const inlineableRefs = [];
  let hasExceedingUsage = false;

  for (const f of htmlFiles) {
    const fileLines = f.content.split('\n');
    const matchedLines = [];
    for (let idx = 0; idx < fileLines.length; idx = idx + 1) {
      const line = fileLines[idx];
      for (const match of line.matchAll(/(?<!\[)\bclass\s*=\s*"([^"]*)"/g)) {
        const classes = match[1].trim().split(/\s+/).filter(Boolean);
        if (classes.includes(className)) {
          const countAfterMove = (isFullMove ? classes.length - 1 : classes.length) + moveCount;
          if (countAfterMove <= 3) {
            matchedLines.push(idx + 1);
          } else {
            hasExceedingUsage = true;
          }
        }
      }
    }
    if (matchedLines.length > 0) {
      inlineableRefs.push(`${path.relative(rootDir, f.file)}:${matchedLines.join(',')}`);
    }
  }
  return { inlineableHtmlLocations: inlineableRefs.join(', '), hasExceedingUsage };
}

function estimateShortRuleBytes(cssClassesToMoveToHtml) {
  return (
    45 +
    cssClassesToMoveToHtml.length * 32 +
    (cssClassesToMoveToHtml.includes('animate-spin') ? 95 : 0) +
    (cssClassesToMoveToHtml.some((u) => u.startsWith('duration-')) ? 180 : 0)
  );
}

function buildClassifiedResult({ base, isFullMove, cssClassesToMoveToHtml, cssClassesToKeepInCss }) {
  const moveToHtml = cssClassesToMoveToHtml.join(' ');
  if (isFullMove) {
    return {
      kind: 'short',
      rule: {
        ...base,
        utilities: moveToHtml,
        count: cssClassesToMoveToHtml.length,
        estBytes: estimateShortRuleBytes(cssClassesToMoveToHtml),
      },
    };
  }
  return {
    kind: 'partial',
    rule: {
      ...base,
      moveToHtml,
      keepInCss: cssClassesToKeepInCss.join(' ') || '(shared rule in CSS)',
      estBytes: cssClassesToMoveToHtml.length * 28,
    },
  };
}

export function classifyStaticApplyRule({ selector, utilities, relPath, state }) {
  const className = extractApplyClassName(selector, state.isGlobal);
  const cssClassesToKeepInCss = utilities.filter((u) => u.includes('--'));
  const cssClassesToMoveToHtml = utilities.filter((u) => !u.includes('--'));
  const isFullMove = cssClassesToKeepInCss.length === 0 && !state.multiRuleClasses.has(className);
  const canProcess =
    isEligibleForHtmlMove({ className, utilities, state }) &&
    cssClassesToMoveToHtml.length > 0 &&
    (!state.isGlobal || isFullMove);
  if (!canProcess) {
    return null;
  }
  const { htmlFiles, specFiles } = getRuleTargetFiles(state);
  const { inlineableHtmlLocations, hasExceedingUsage } = evaluateHtmlClassCounts({
    className,
    isFullMove,
    moveCount: cssClassesToMoveToHtml.length,
    htmlFiles,
  });
  if (!inlineableHtmlLocations || (!state.isGlobal && hasExceedingUsage)) {
    return null;
  }
  const base = {
    relPath,
    selector,
    className,
    htmlLocations: inlineableHtmlLocations,
    specRefs: state.findFileLineRefs(className, specFiles),
  };
  return buildClassifiedResult({ base, isFullMove, cssClassesToMoveToHtml, cssClassesToKeepInCss });
}

function recordRemainingComponentRule({ selector, utilities, relPath, state }) {
  if (state.isGlobal) {
    return;
  }
  const className = extractApplyClassName(selector, false);
  if (isEligibleForHtmlMove({ className, utilities, state }) && !state.multiRuleClasses.has(className)) {
    state.remainingApplyRules.push({
      relPath,
      selector,
      className,
      utilities,
      htmlLocations: state.findFileLineRefs(className, state.siblingHtmlFiles),
      specRefs: state.findFileLineRefs(className, state.siblingSpecFiles),
    });
  }
}

export function processApplyRule({ selector, body, relPath, state }) {
  const applyMatch = !selector.includes(':host') && body.match(/@apply\s+([^;]+);/);
  if (!applyMatch || (state.isGlobal && !selector.startsWith('@utility '))) {
    return;
  }
  const utilities = applyMatch[1].trim().split(/\s+/).filter(Boolean);
  if (!state.isGlobal) {
    state.fileApplyBlocks.push({ selector, utilities, loc: relPath });
  }
  const classified = classifyStaticApplyRule({ selector, utilities, relPath, state });
  if (classified?.kind === 'short') {
    state.shortStaticRules.push(classified.rule);
  } else if (classified?.kind === 'partial') {
    state.partialStaticRules.push(classified.rule);
  } else {
    recordRemainingComponentRule({ selector, utilities, relPath, state });
  }
}
