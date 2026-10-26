import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  categorizeInput,
  detectLeakedDependencies,
  ensureFreshStats,
  formatBytes,
  formatPercentageRow,
  getEmbeddedStylesSummary,
  loadStats,
  printLimitedList,
  resolveProjectConfig,
} from './bundle-utils.mjs';
import { getCssAnalysis, getSourceFiles } from './css-audit.mjs';
import { computeProjectHash, readCachedReport, writeHtmlReport } from './html-report.mjs';
import { getLazyVectorAudit } from './lazy-vector-audit.mjs';
import { getVectorAudit } from './vector-audit.mjs';

function formatChunkLine(name, bytes) {
  const sizeStr = formatBytes(bytes).padStart(10);
  const rawStr = `(${bytes.toLocaleString()} bytes)`.padStart(18);
  return `  ${sizeStr}  ${rawStr}  ${name}`;
}

function formatJsChunkRow([name, data], bytes, browserDir) {
  const lines = [formatChunkLine(name, bytes)];

  if (!name.startsWith('main-')) {
    const topInputs = Object.entries(data.inputs || {})
      .filter(([, v]) => v.bytesInOutput > 0)
      .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput)
      .slice(0, 3)
      .map(([p, v]) => `${path.basename(p)} (${formatBytes(v.bytesInOutput)})`)
      .join(', ');
    if (topInputs) {
      lines.push(`                                  Inputs: ${topInputs}`);
    }
  }

  const stylesSummary = getEmbeddedStylesSummary(path.join(browserDir, name), bytes);
  if (stylesSummary) {
    lines.push(`                                  Styles: ${stylesSummary}`);
  }
  return lines.join('\n');
}

function printOutputChunks(outputEntries, statsFile) {
  console.log('\n======================================================');
  console.log('               BUNDLE ANALYSIS REPORT                 ');
  console.log('======================================================\n');
  console.log('--- Output Chunks (Sorted by Size) ---');

  const statsDir = path.dirname(statsFile);
  const browserDir = fs.existsSync(path.join(statsDir, 'browser')) ? path.join(statsDir, 'browser') : statsDir;
  const sortedOutputs = [...outputEntries].sort((a, b) => b[1].bytes - a[1].bytes);

  printLimitedList({
    items: sortedOutputs.filter(([name]) => name.endsWith('.js')),
    label: 'JavaScript Chunks',
    formatRow: (item, bytes) => formatJsChunkRow(item, bytes, browserDir),
  });

  printLimitedList({
    items: sortedOutputs.filter(([name]) => name.endsWith('.css')),
    label: 'CSS Chunks',
    formatRow: ([name], bytes) => formatChunkLine(name, bytes),
  });
}

function printMainBreakdown([mainName, mainData], sortedInputs, relSourceRoot = 'src') {
  const mainBytes = mainData.bytes;
  console.log('\n------------------------------------------------------');
  console.log(`Main Bundle Breakdown: ${mainName} (${formatBytes(mainBytes)} / ${mainBytes.toLocaleString()} bytes)`);
  console.log('------------------------------------------------------');

  printLimitedList({
    items: sortedInputs,
    label: 'Top Input Contributors in Main',
    unitName: 'inputs',
    formatRow: formatPercentageRow,
  });

  const groups = new Map();
  for (const [inputPath, val] of sortedInputs) {
    const groupName = categorizeInput(inputPath, relSourceRoot);
    groups.set(groupName, (groups.get(groupName) || 0) + val.bytesInOutput);
  }

  printLimitedList({
    items: [...groups.entries()].sort((a, b) => b[1] - a[1]),
    label: 'Grouped Package Breakdown in Main',
    unitName: 'packages',
    formatRow: formatPercentageRow,
  });
}

function printLeakAudit(inputEntries, relSourceRoot = 'src') {
  console.log('\n------------------------------------------------------');
  console.log('Leak Detection Audit (Informative)');
  console.log('------------------------------------------------------');

  const leakedDependencies = detectLeakedDependencies(inputEntries, relSourceRoot);

  if (leakedDependencies.length === 0) {
    console.log('  No non-baseline packages or eager feature components detected in main chunk.');
  } else {
    console.log('  [i] Eager components & non-baseline packages in main bundle (Developer review):');
    for (const leak of leakedDependencies) {
      console.log(`\n  * ${leak.type}:`);
      console.log(`    File:   ${leak.path} (${formatBytes(leak.bytes)})`);
      console.log(`    Advice: ${leak.advice}`);
    }
    console.log('\n  Note: These items are informative alerts and do not fail the build.');
  }

  console.log('\n======================================================\n');
}

function printConciseCssCategory(title, items) {
  const totalSaved = items.reduce((sum, item) => sum + (item.estBytes || 0), 0);
  const testWarnings = items.filter((item) => Boolean(item.specRefs)).length;
  const warnText = testWarnings > 0 ? `, ⚠️ ${testWarnings} with unit test refs` : '';
  console.log(`  * ${title}: ${items.length} item(s), Est. ~${formatBytes(totalSaved)} saved${warnText}`);
}

function printVectorAuditSummary(vectorAudit, reportPath) {
  console.log('\n------------------------------------------------------');
  console.log('8 Initial Bundle Vectors Audit Summary');
  console.log(`(Full details in ${reportPath})`);
  console.log('------------------------------------------------------');
  for (const v of vectorAudit) {
    const badge = v.findings.length > 0 ? `⚠️ ${v.findings.length} issue(s)` : '✅ Pass';
    console.log(`  * Vector ${v.id} (${v.name}): ${badge}`);
    for (const f of v.findings) {
      console.log(`      -> ${f.location} — ${f.detail}`);
    }
  }
}

function printLazyVectorAuditSummary(lazyVectorAudit, reportPath) {
  console.log('\n------------------------------------------------------');
  console.log('3 Lazy Chunk Vectors Audit Summary');
  console.log(`(Full details in ${reportPath})`);
  console.log('------------------------------------------------------');
  for (const v of lazyVectorAudit) {
    const badge = v.findings.length > 0 ? `⚠️ ${v.findings.length} issue(s)` : '✅ Pass';
    console.log(`  * ${v.name}: ${badge}`);
    for (const f of v.findings) {
      console.log(`      -> ${f.location} — ${f.detail}`);
    }
  }
}

function runCssOptimizationAudit(projectConfig, allCodeFiles, reportPath) {
  console.log('\n------------------------------------------------------');
  console.log('Component CSS & Dead Class Optimization Summary');
  console.log(`(Full itemized tables in ${reportPath})`);
  console.log('------------------------------------------------------');

  const cssFiles = getSourceFiles(projectConfig.sourceRoot, ['.css']);
  const cssAnalysis = getCssAnalysis(cssFiles, allCodeFiles, projectConfig);
  if (cssAnalysis.postcssRecommendation) {
    console.log(`  💡 ${cssAnalysis.postcssRecommendation}`);
  }
  printConciseCssCategory('1. Dead / Unused CSS Classes', cssAnalysis.deadClasses);
  printConciseCssCategory('2. Short Static @apply Classes (<= 3 utilities)', cssAnalysis.shortStaticRules);
  printConciseCssCategory('3. Partial Static Splits', cssAnalysis.partialStaticRules);
  printConciseCssCategory('4. Duplicate @apply Rules', cssAnalysis.duplicateRules);
  return cssAnalysis;
}

function buildHtmlChunkRows(outputEntries, statsFile) {
  const statsDir = path.dirname(statsFile);
  const browserDir = fs.existsSync(path.join(statsDir, 'browser')) ? path.join(statsDir, 'browser') : statsDir;
  return [...outputEntries]
    .filter(([name]) => name.endsWith('.js') || name.endsWith('.css'))
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .map(([name, data]) => {
      const topInputs = Object.entries(data.inputs || {})
        .filter(([, v]) => v.bytesInOutput > 0)
        .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput)
        .slice(0, 3)
        .map(([p, v]) => `${path.basename(p)} (${formatBytes(v.bytesInOutput)})`)
        .join(', ');
      return {
        name,
        bytes: data.bytes,
        topInputs,
        stylesSummary: name.endsWith('.js') ? getEmbeddedStylesSummary(path.join(browserDir, name), data.bytes) : null,
      };
    });
}

function runAuditsAndCollectData({ allCodeFiles, outputEntries, inputEntries, projectConfig, reportPath }) {
  const vectorAudit = getVectorAudit(allCodeFiles, inputEntries, projectConfig);
  printVectorAuditSummary(vectorAudit, reportPath);
  const lazyVectorAudit = getLazyVectorAudit({
    allCodeFiles,
    outputEntries,
    mainInputs: inputEntries,
    projectConfig,
  });
  printLazyVectorAuditSummary(lazyVectorAudit, reportPath);
  const cssAnalysis = runCssOptimizationAudit(projectConfig, allCodeFiles, reportPath);
  printLeakAudit(inputEntries, projectConfig.relSourceRoot);
  return { vectorAudit, lazyVectorAudit, cssAnalysis };
}

function executeFullAudit(projectConfig, hash, reportPath) {
  const logLines = [];
  const origLog = console.log;
  console.log = (...msgs) => {
    const line = msgs.join(' ');
    logLines.push(line);
    origLog(line);
  };

  const { stats, statsFile } = loadStats(projectConfig.distDir);
  const outputEntries = Object.entries(stats.outputs || {});
  printOutputChunks(outputEntries, statsFile);

  const mainEntry = outputEntries.find(([name]) => name.startsWith('main-') && name.endsWith('.js'));
  const allCodeFiles = getSourceFiles(projectConfig.sourceRoot, ['.html', '.ts', '.css']).map((f) => ({
    file: f,
    content: fs.readFileSync(f, 'utf8'),
  }));
  const inputEntries = mainEntry ? Object.entries(mainEntry[1].inputs || {}) : [];
  if (!mainEntry) {
    console.log('\n[analyze-bundle] Notice: No main-*.js bundle found in outputs.');
  } else {
    const sortedInputs = inputEntries
      .filter(([, val]) => val.bytesInOutput > 0)
      .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput);
    printMainBreakdown(mainEntry, sortedInputs, projectConfig.relSourceRoot);
  }

  const auditResults = runAuditsAndCollectData({ allCodeFiles, outputEntries, inputEntries, projectConfig, reportPath });
  console.log = origLog;
  const summaryText = logLines.join('\n');
  const chunks = buildHtmlChunkRows(outputEntries, statsFile);
  writeHtmlReport({
    reportPath,
    hash,
    projectConfig,
    summaryText,
    auditData: { chunks, ...auditResults },
  });
  console.log(`[HTML Report] Generated: ${reportPath}\n`);
}

const args = process.argv.slice(2);
const forceRebuild = args.includes('--rebuild') || args.includes('-r');
const projectArg = args.find((arg) => !arg.startsWith('-'));

const projectConfig = resolveProjectConfig(projectArg);
const { hash, reportPath } = computeProjectHash(projectConfig);
const cachedSummary = !forceRebuild ? readCachedReport(reportPath) : null;

if (cachedSummary) {
  console.log(cachedSummary);
  console.log(`[HTML Report] Cached (no changes detected): ${reportPath}\n`);
} else {
  ensureFreshStats(forceRebuild, projectConfig);
  executeFullAudit(projectConfig, hash, reportPath);
}

