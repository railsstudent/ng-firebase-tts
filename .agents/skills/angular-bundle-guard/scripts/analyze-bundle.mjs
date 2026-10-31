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
import { getCssAnalysis } from './css-audit.mjs';
import { loadSourceFilesWithContent, resolveBrowserDir } from './fs-utils.mjs';
import { computeProjectHash, readCachedReport, writeHtmlReport } from './html-report.mjs';
import { getLazyVectorAudit } from './lazy-vector-audit.mjs';
import { getVectorAudit } from './vector-audit.mjs';

function formatChunkLine(name, bytes) {
  const sizeStr = formatBytes(bytes).padStart(10);
  const rawStr = `(${bytes.toLocaleString()} bytes)`.padStart(18);
  return `  ${sizeStr}  ${rawStr}  ${name}`;
}

function formatTopInputs(inputs = {}) {
  return Object.entries(inputs)
    .reduce((acc, [filePath, { bytesInOutput }]) => {
      if (bytesInOutput <= 0 || (acc.length === 3 && bytesInOutput <= acc[2].bytesInOutput)) {
        return acc;
      }
      const entry = { filePath, bytesInOutput };
      if (acc.length < 3) {
        acc.push(entry);
      } else {
        acc[2] = entry;
      }
      return acc.sort((a, b) => b.bytesInOutput - a.bytesInOutput);
    }, [])
    .map(({ filePath, bytesInOutput }) => `${path.basename(filePath)} (${formatBytes(bytesInOutput)})`)
    .join(', ');
}

function buildChunkRows(outputEntries, statsFile) {
  const browserDir = resolveBrowserDir(statsFile);
  return outputEntries
    .reduce((rows, [name, data]) => {
      const isJs = name.endsWith('.js');
      if (isJs || name.endsWith('.css')) {
        rows.push({
          name,
          bytes: data.bytes,
          topInputs: isJs ? formatTopInputs(data.inputs) : '',
          stylesSummary: isJs ? getEmbeddedStylesSummary(path.join(browserDir, name), data.bytes) : null,
        });
      }
      return rows;
    }, [])
    .sort((a, b) => b.bytes - a.bytes);
}

function formatJsChunkRow(chunk) {
  const lines = [formatChunkLine(chunk.name, chunk.bytes)];
  if (!chunk.name.startsWith('main-') && chunk.topInputs) {
    lines.push(`                                  Inputs: ${chunk.topInputs}`);
  }
  if (chunk.stylesSummary) {
    lines.push(`                                  Styles: ${chunk.stylesSummary}`);
  }
  return lines.join('\n');
}

function printOutputChunks(chunkRows) {
  console.log('\n======================================================');
  console.log('               BUNDLE ANALYSIS REPORT                 ');
  console.log('======================================================\n');
  console.log('--- Output Chunks (Sorted by Size) ---');

  printLimitedList({
    items: chunkRows.filter((c) => c.name.endsWith('.js')),
    label: 'JavaScript Chunks',
    getBytes: (c) => c.bytes,
    formatRow: (c) => formatJsChunkRow(c),
  });

  printLimitedList({
    items: chunkRows.filter((c) => c.name.endsWith('.css')),
    label: 'CSS Chunks',
    getBytes: (c) => c.bytes,
    formatRow: (c) => formatChunkLine(c.name, c.bytes),
  });
}

function printMainBreakdown(mainEntry, inputEntries, relSourceRoot = 'src') {
  if (!mainEntry) {
    console.log('\n[analyze-bundle] Notice: No main-*.js bundle found in outputs.');
    return;
  }
  const [mainName, { bytes: mainBytes }] = mainEntry;
  const { inputs, groups } = inputEntries.reduce(
    (acc, entry) => {
      const [inputPath, { bytesInOutput }] = entry;
      if (bytesInOutput > 0) {
        acc.inputs.push(entry);
        const groupName = categorizeInput(inputPath, relSourceRoot);
        acc.groups.set(groupName, (acc.groups.get(groupName) || 0) + bytesInOutput);
      }
      return acc;
    },
    { inputs: [], groups: new Map() },
  );
  console.log('\n------------------------------------------------------');
  console.log(`Main Bundle Breakdown: ${mainName} (${formatBytes(mainBytes)} / ${mainBytes.toLocaleString()} bytes)`);
  console.log('------------------------------------------------------');

  printLimitedList({
    items: inputs.sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput),
    label: 'Top Input Contributors in Main',
    unitName: 'inputs',
    formatRow: formatPercentageRow,
  });

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

function runCssOptimizationAudit({ projectConfig, allCodeFiles, outputEntries, statsFile, reportPath }) {
  console.log('\n------------------------------------------------------');
  console.log('Component CSS & Dead Class Optimization Summary');
  console.log(`(Full itemized tables in ${reportPath})`);
  console.log('------------------------------------------------------');

  const cssAnalysis = getCssAnalysis({ allCodeFiles, outputEntries, statsFile, projectConfig });
  if (cssAnalysis.postcssRecommendation) {
    console.log(`  💡 ${cssAnalysis.postcssRecommendation}`);
  }
  printConciseCssCategory('1. Dead / Unused CSS & Vanilla Rules', cssAnalysis.deadClasses);
  printConciseCssCategory('2. Short Static @apply Classes (<= 3 utilities)', cssAnalysis.shortStaticRules);
  printConciseCssCategory('3. Partial Static Splits', cssAnalysis.partialStaticRules);
  printConciseCssCategory('4. Duplicate @apply & @keyframes Rules', cssAnalysis.duplicateRules);
  return cssAnalysis;
}

function runAuditsAndCollectData({ allCodeFiles, outputEntries, inputEntries, statsFile, projectConfig, reportPath }) {
  const vectorAudit = getVectorAudit(allCodeFiles, inputEntries, projectConfig);
  printVectorAuditSummary(vectorAudit, reportPath);
  const lazyVectorAudit = getLazyVectorAudit({
    allCodeFiles,
    outputEntries,
    mainInputs: inputEntries,
    projectConfig,
  });
  printLazyVectorAuditSummary(lazyVectorAudit, reportPath);
  const cssAnalysis = runCssOptimizationAudit({ projectConfig, allCodeFiles, outputEntries, statsFile, reportPath });
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
  const chunkRows = buildChunkRows(outputEntries, statsFile);
  printOutputChunks(chunkRows);

  const mainEntry = outputEntries.find(([name]) => name.startsWith('main-') && name.endsWith('.js'));
  const allCodeFiles = loadSourceFilesWithContent(projectConfig.sourceRoot, ['.html', '.ts', '.css']);
  const inputEntries = mainEntry ? Object.entries(mainEntry[1].inputs || {}) : [];
  printMainBreakdown(mainEntry, inputEntries, projectConfig.relSourceRoot);

  const auditResults = runAuditsAndCollectData({
    allCodeFiles,
    outputEntries,
    inputEntries,
    statsFile,
    projectConfig,
    reportPath,
  });
  console.log = origLog;
  const { componentCss } = auditResults.cssAnalysis;
  const componentCssNames = new Set((componentCss?.files || []).map((f) => f.outputName));
  const chunks = chunkRows.filter((c) => !componentCssNames.has(c.name));
  writeHtmlReport({
    reportPath,
    hash,
    projectConfig,
    summaryText: logLines.join('\n'),
    auditData: { chunks, componentCss, ...auditResults },
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
