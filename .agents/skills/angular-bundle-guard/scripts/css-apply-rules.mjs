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

function inspectLineClassUsage(line, { className, isFullMove, moveCount }) {
  let matched = false;
  let fits = false;
  let maxClasses = 0;
  for (const match of line.matchAll(/(?<!\[)\bclass\s*=\s*"([^"]*)"/g)) {
    const classes = match[1].trim().split(/\s+/);
    if (classes.includes(className)) {
      matched = true;
      maxClasses = Math.max(maxClasses, classes.length);
      const countAfterMove = (isFullMove ? classes.length - 1 : classes.length) + moveCount;
      if (countAfterMove <= 3) {
        fits = true;
      }
    }
  }
  return { matched, fits, maxClasses };
}

function scanHtmlFileForClass(fileObj, options) {
  const fileLines = fileObj.content.split('\n');
  const fitLines = [];
  const matchedLines = [];
  let maxClasses = 0;
  let hasExceeding = false;
  for (let idx = 0; idx < fileLines.length; idx = idx + 1) {
    const res = inspectLineClassUsage(fileLines[idx], options);
    if (res.matched) {
      matchedLines.push(idx + 1);
      maxClasses = Math.max(maxClasses, res.maxClasses);
      if (res.fits) {
        fitLines.push(idx + 1);
      } else {
        hasExceeding = true;
      }
    }
  }
  const relFile = path.relative(rootDir, fileObj.file);
  return {
    fitRef: fitLines.length > 0 ? `${relFile}:${fitLines.join(',')}` : '',
    allRef: matchedLines.length > 0 ? `${relFile}:${matchedLines.join(',')}` : '',
    maxClasses,
    hasExceeding,
  };
}

function evaluateHtmlClassCounts({ className, isFullMove, moveCount, htmlFiles }) {
  const inlineableRefs = [];
  const allRefs = [];
  let hasExceedingUsage = false;
  let maxExistingClasses = 0;

  for (const f of htmlFiles) {
    const res = scanHtmlFileForClass(f, { className, isFullMove, moveCount });
    if (res.fitRef) {
      inlineableRefs.push(res.fitRef);
    }
    if (res.allRef) {
      allRefs.push(res.allRef);
    }
    maxExistingClasses = Math.max(maxExistingClasses, res.maxClasses);
    hasExceedingUsage = hasExceedingUsage || res.hasExceeding;
  }
  const freeHtmlSlots = maxExistingClasses > 0 ? Math.max(0, 3 - maxExistingClasses) : 0;
  return {
    inlineableHtmlLocations: inlineableRefs.join(', '),
    allHtmlLocations: allRefs.join(', '),
    hasExceedingUsage,
    freeHtmlSlots,
  };
}

function estimateShortRuleBytes(cssClassesToMoveToHtml) {
  return (
    45 +
    cssClassesToMoveToHtml.length * 32 +
    (cssClassesToMoveToHtml.includes('animate-spin') ? 95 : 0) +
    (cssClassesToMoveToHtml.some((u) => u.startsWith('duration-')) ? 180 : 0)
  );
}

function buildClassifiedResult({ base, isFullMove, utilities, hasNonApplyCss }) {
  const moveToHtml = utilities.join(' ');
  if (isFullMove) {
    return {
      kind: 'short',
      rule: {
        ...base,
        utilities: moveToHtml,
        count: utilities.length,
        estBytes: estimateShortRuleBytes(utilities),
      },
    };
  }
  return {
    kind: 'partial',
    rule: {
      ...base,
      moveToHtml,
      keepInCss: hasNonApplyCss ? '(raw CSS declarations in rule)' : '(shared rule in CSS)',
      estBytes: utilities.length * 28,
    },
  };
}

function buildEngineerChoiceSplit({ base, utilities, freeHtmlSlots, moveCount }) {
  if (!base.htmlLocations || freeHtmlSlots <= 0 || moveCount <= freeHtmlSlots) {
    return null;
  }
  return {
    kind: 'partial',
    rule: {
      ...base,
      moveToHtml: `(engineer choice: any ${freeHtmlSlots} utilities)`,
      keepInCss: utilities.join(' '),
      estBytes: freeHtmlSlots * 28,
    },
  };
}

function canClassifyStaticApplyRule({ className, utilities, state, isFullMove }) {
  return (
    isEligibleForHtmlMove({ className, utilities, state }) && utilities.length > 0 && (!state.isGlobal || isFullMove)
  );
}

export function classifyStaticApplyRule({ selector, utilities, relPath, state, hasNonApplyCss = false }) {
  const className = extractApplyClassName(selector, state.isGlobal);
  const isFullMove = !state.multiRuleClasses.has(className) && !hasNonApplyCss;
  if (!canClassifyStaticApplyRule({ className, utilities, state, isFullMove })) {
    return null;
  }
  const { htmlFiles, specFiles } = getRuleTargetFiles(state);
  const htmlEval = evaluateHtmlClassCounts({
    className,
    isFullMove,
    moveCount: utilities.length,
    htmlFiles,
  });
  const specRefs = state.findFileLineRefs(className, specFiles);
  if (!htmlEval.inlineableHtmlLocations || (!state.isGlobal && htmlEval.hasExceedingUsage)) {
    return state.isGlobal
      ? null
      : buildEngineerChoiceSplit({
          base: { relPath, selector, className, htmlLocations: htmlEval.allHtmlLocations, specRefs },
          utilities,
          freeHtmlSlots: htmlEval.freeHtmlSlots,
          moveCount: utilities.length,
        });
  }
  const base = { relPath, selector, className, htmlLocations: htmlEval.inlineableHtmlLocations, specRefs };
  return buildClassifiedResult({ base, isFullMove, utilities, hasNonApplyCss });
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
  if (selector.includes(':host') || (state.isGlobal && !selector.startsWith('@utility '))) {
    return;
  }
  const applyMatches = [...body.matchAll(/@apply\s+([^;]+);/g)];
  if (applyMatches.length === 0) {
    return;
  }
  const utilities = applyMatches.flatMap((m) => m[1].trim().split(/\s+/));
  const hasNonApplyCss = body.replace(/@apply\s+[^;]+;/g, '').trim().length > 0;
  if (!state.isGlobal) {
    state.fileApplyBlocks.push({ selector, utilities, loc: relPath });
  }
  const classified = classifyStaticApplyRule({ selector, utilities, relPath, state, hasNonApplyCss });
  if (classified?.kind === 'short') {
    state.shortStaticRules.push(classified.rule);
    return;
  }
  if (classified?.kind === 'partial') {
    state.partialStaticRules.push(classified.rule);
  }
  recordRemainingComponentRule({ selector, utilities, relPath, state });
}
