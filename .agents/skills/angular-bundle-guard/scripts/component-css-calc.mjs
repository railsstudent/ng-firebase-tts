import path from 'node:path';
import { rootDir } from './bundle-utils.mjs';
import { readTextFile, resolveBrowserDir } from './fs-utils.mjs';

const COMPONENT_CSS_THRESHOLD_BYTES = 1024;

const PROPERTY_TRIGGER_PATTERNS = [
  /^(?:[a-z0-9-]+:)*border(?:-[a-z0-9]+)?$/,
  /^(?:[a-z0-9-]+:)*divide-[xy](?:-[a-z0-9]+)?$/,
  /^(?:[a-z0-9-]+:)*outline(?:-[a-z0-9]+)?$/,
  /^(?:[a-z0-9-]+:)*(?:inset-)?(?:ring|shadow)(?:-[a-z0-9/[\]#().%-]+)?$/,
  /^(?:[a-z0-9-]+:)*drop-shadow(?:-[a-z0-9/[\]#().%-]+)?$/,
  /^(?:[a-z0-9-]+:)*(?:bg-(?:linear|radial|conic)|from|via|to)-[a-z0-9/[\]#().%-]+$/,
  /^(?:[a-z0-9-]+:)*(?:translate|scale|rotate|skew)-[a-z0-9/[\]#().%-]+$/,
  /^(?:[a-z0-9-]+:)*animate-[a-z0-9_-]+$/,
  /^(?:[a-z0-9-]+:)*(?:duration|ease|delay)-[a-z0-9[\]().%-]+$/,
  /^(?:[a-z0-9-]+:)*(?:font-(?:sans|serif|mono|thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|tracking-[a-z0-9-]+|leading-[a-z0-9-]+)$/,
  /^(?:[a-z0-9-]+:)*(?:backdrop-)?(?:blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia)(?:-[a-z0-9[\]().%-]+)?$/,
  /^(?:[a-z0-9-]+:)*space-[xy]-[a-z0-9/[\].%-]+$/,
];

function isPropertyTriggerUtility(utility) {
  return PROPERTY_TRIGGER_PATTERNS.some((pattern) => pattern.test(utility));
}

function isComponentCssOutput(name, data, projectConfig = {}) {
  if (!name.endsWith('.css')) {
    return false;
  }
  const globalSet = new Set((projectConfig.globalStyles || ['src/styles.css']).map((s) => path.normalize(s)));
  const inputKeys = Object.keys(data?.inputs || {});
  if (inputKeys.length === 0) {
    return !name.startsWith('styles');
  }
  return !inputKeys.some((k) => globalSet.has(path.normalize(k)) || path.basename(k) === 'styles.css');
}

function resolveComponentCssSourcePath(data) {
  const rawKey = Object.keys(data?.inputs || {})[0] || '';
  if (!rawKey) {
    return null;
  }
  if (rawKey.startsWith('angular:styles/component:')) {
    const parts = rawKey.split(';');
    const absOrRel = parts[parts.length - 1];
    return absOrRel ? path.relative(rootDir, absOrRel) : null;
  }
  return path.normalize(rawKey);
}

function parseStyleBlockEntry(strMatch) {
  const styleBody = strMatch[1] ?? strMatch[2] ?? strMatch[3] ?? '';
  const propIdx = styleBody.indexOf('@property');
  const totalBytes = Buffer.byteLength(styleBody, 'utf8');
  return {
    raw: styleBody,
    totalBytes,
    rulesBytes: propIdx !== -1 ? Buffer.byteLength(styleBody.slice(0, propIdx), 'utf8') : totalBytes,
    propertyBytes: propIdx !== -1 ? Buffer.byteLength(styleBody.slice(propIdx), 'utf8') : 0,
  };
}

function collectEmbeddedStyleBlocks(browserDir, outputEntries) {
  const blocks = [];
  for (const [name] of outputEntries) {
    if (name.endsWith('.js')) {
      const content = readTextFile(path.join(browserDir, name)) || '';
      for (const arrMatch of content.matchAll(/styles:\s*\[((?:`[^`]*`|"[^"]*"|'[^']*'|\s|,)+)\]/g)) {
        for (const strMatch of arrMatch[1].matchAll(/`([^`]*)`|"([^"]*)"|'([^']*)'/g)) {
          blocks.push(parseStyleBlockEntry(strMatch));
        }
      }
    }
  }
  return blocks;
}

function extractFirstSelectorsFromSource(sourceContent) {
  const clean = sourceContent.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const selectors = [];
  for (const m of clean.matchAll(/([^{};]+)\{[^{}]+\}/g)) {
    const sel = m[1].trim();
    const classMatch = sel.match(/\.[a-zA-Z0-9_-]+/);
    if (classMatch) {
      selectors.push(classMatch[0]);
    }
  }
  return selectors;
}

function matchEmbeddedBlockForCss(sourceContent, compiledBytes, embeddedBlocks) {
  const selectors = extractFirstSelectorsFromSource(sourceContent);
  const candidates =
    selectors.length > 0 ? embeddedBlocks.filter((b) => selectors.slice(0, 3).every((sel) => b.raw.includes(sel))) : [];
  const pool = candidates.length > 0 ? candidates : embeddedBlocks;
  let best = null;
  let bestDiff = Infinity;
  for (const block of pool) {
    const diff = Math.abs(block.totalBytes - compiledBytes);
    if (diff < bestDiff && diff <= Math.max(1200, compiledBytes * 0.35)) {
      best = block;
      bestDiff = diff;
    }
  }
  return best;
}

function getPropertyOverheadBytes(totalBytes, matchedBlock, triggeringCount) {
  if (matchedBlock) {
    return matchedBlock.propertyBytes;
  }
  if (triggeringCount === 0 || totalBytes <= COMPONENT_CSS_THRESHOLD_BYTES) {
    return 0;
  }
  return Math.min(totalBytes - 120, 3150);
}

function findTriggeringUtilitiesInSource(sourceContent) {
  if (!sourceContent) {
    return [];
  }
  const lines = sourceContent.split('\n');
  const found = new Map();
  for (let idx = 0; idx < lines.length; idx = idx + 1) {
    const line = lines[idx];
    for (const match of line.matchAll(/@apply\s+([^;]+);/g)) {
      const utils = match[1].trim().split(/\s+/);
      for (const util of utils) {
        if (isPropertyTriggerUtility(util)) {
          const list = found.get(util) || [];
          list.push(idx + 1);
          found.set(util, list);
        }
      }
    }
  }
  return [...found.entries()].map(([util, lineNums]) => ({
    util,
    lines: [...new Set(lineNums)],
  }));
}

function buildComponentCssEntry({ outputName, data, codeByRel, embeddedBlocks }) {
  const relPath = resolveComponentCssSourcePath(data) || outputName;
  const sourceContent = codeByRel.get(relPath) || '';
  const triggers = findTriggeringUtilitiesInSource(sourceContent);
  const firstTriggerLine = triggers[0]?.lines[0] || 1;
  const matchedBlock = matchEmbeddedBlockForCss(sourceContent, data.bytes, embeddedBlocks);
  const compiledBytes = matchedBlock?.totalBytes ?? data.bytes;
  const propBytes = getPropertyOverheadBytes(compiledBytes, matchedBlock, triggers.length);
  return {
    outputName,
    relPath,
    linkRef: `${relPath}:${firstTriggerLine}`,
    bytes: compiledBytes,
    propBytes,
    isEstimated: !matchedBlock,
    isSmall: compiledBytes <= COMPONENT_CSS_THRESHOLD_BYTES,
    triggers,
  };
}

export function buildComponentCssRows({ outputEntries, statsFile, projectConfig, allCodeFiles }) {
  const browserDir = resolveBrowserDir(statsFile);
  const codeByRel = new Map(allCodeFiles.map((f) => [path.relative(rootDir, f.file), f.content]));
  const embeddedBlocks = collectEmbeddedStyleBlocks(browserDir, outputEntries);

  const result = outputEntries.reduce(
    (acc, [outputName, data]) => {
      if (!isComponentCssOutput(outputName, data, projectConfig)) {
        return acc;
      }
      const entry = buildComponentCssEntry({ outputName, data, codeByRel, embeddedBlocks });
      acc.files.push(entry);
      if (entry.isSmall) {
        acc.smallCount += 1;
        acc.smallTotalBytes += entry.bytes;
        acc.smallPropBytes += entry.propBytes;
      } else {
        acc.largeCount += 1;
      }
      return acc;
    },
    { files: [], largeCount: 0, smallCount: 0, smallTotalBytes: 0, smallPropBytes: 0 },
  );

  result.files.sort((a, b) => b.bytes - a.bytes);
  return result;
}
