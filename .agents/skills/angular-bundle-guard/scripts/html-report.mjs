import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import { BUILD_CONFIG_FILES, formatBytes, getConfigSearchDirs, rootDir } from './bundle-utils.mjs';
import { getSourceFiles } from './css-audit.mjs';

const SUMMARY_START = '<!-- BUNDLE_AUDIT_SUMMARY_START\n';
const SUMMARY_END = '\nBUNDLE_AUDIT_SUMMARY_END -->';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function computeProjectHash(projectConfig) {
  const hasher = crypto.createHash('sha256');
  hasher.update(`project:${projectConfig.projectName}\n`);

  for (const dir of getConfigSearchDirs(projectConfig.projectRoot)) {
    for (const cfgName of BUILD_CONFIG_FILES) {
      const cfgPath = path.join(dir, cfgName);
      if (fs.existsSync(cfgPath)) {
        hasher.update(`${path.relative(rootDir, cfgPath)}:${fs.readFileSync(cfgPath, 'utf8')}\n`);
      }
    }
  }

  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  for (const scriptFile of getSourceFiles(scriptDir, ['.mjs', '.css']).sort()) {
    hasher.update(`script:${ path.basename(scriptFile) }:${ fs.readFileSync(scriptFile, 'utf8') }\n`);
  }

  const files = getSourceFiles(projectConfig.sourceRoot, ['.ts', '.html', '.css']).sort();
  for (const file of files) {
    const rel = path.relative(rootDir, file);
    hasher.update(`${rel}:${fs.readFileSync(file, 'utf8')}\n`);
  }

  const hash = hasher.digest('hex').slice(0, 8);
  const reportPath = path.join(os.tmpdir(), `bundle-audit-report-${hash}.html`);
  return { hash, reportPath };
}

export function readCachedReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return null;
  }
  const content = fs.readFileSync(reportPath, 'utf8');
  const startIdx = content.indexOf(SUMMARY_START);
  const endIdx = content.indexOf(SUMMARY_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }
  return content.slice(startIdx + SUMMARY_START.length, endIdx);
}

function formatFileLinks(refList) {
  if (!refList) {
    return '<span class="muted">—</span>';
  }
  return refList
    .split(', ')
    .map((ref) => {
      const [relFile, linesPart] = ref.split(':');
      const absPath = path.join(rootDir, relFile);
      const fileUrl = pathToFileURL(absPath).href;
      const label = escapeHtml(ref).replaceAll('/', '/<wbr>');
      const lineCount = linesPart ? linesPart.split(',').length : 0;
      const multiBadge = lineCount > 1 ? ` <span class="badge badge-warn">⚠️ ${lineCount}x in file</span>` : '';
      return `<a href="${escapeHtml(fileUrl)}"><code>${label}</code></a>${multiBadge}`;
    })
    .join('<br>');
}

function formatTestBadge(specRefs) {
  if (!specRefs) {
    return '<span class="badge badge-ok">Safe</span>';
  }
  return `<span class="badge badge-warn">⚠️ Test Queries Selector</span><div class="small-ref">${formatFileLinks(specRefs)}</div>`;
}

function renderChunkTable(chunks) {
  const rows = chunks
    .map(
      (c) => `<tr class="filter-row">
      <td><code>${escapeHtml(c.name)}</code></td>
      <td class="num">${escapeHtml(formatBytes(c.bytes))} <span class="muted">(${c.bytes.toLocaleString()} B)</span></td>
      <td>${escapeHtml(c.topInputs || '—')}</td>
      <td>${escapeHtml(c.stylesSummary || '—')}</td>
    </tr>`,
    )
    .join('\n');
  return `<table><thead><tr><th>Chunk</th><th>Raw Size</th><th>Top Inputs</th><th>Embedded Styles</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function formatDeadCssAction(d) {
  if (d.themeIssueAction) {
    return d.themeIssueAction;
  }
  if (d.isOrphanFile) {
    return 'Delete unused CSS file — no component in this folder loads it via <code>styleUrl</code>.';
  }
  if (d.cssApplyRefs) {
    const cls = escapeHtml(d.className || d.selector.replace(/^(@utility\s+|\.)/, ''));
    return `<div><strong>Only used via <code>@apply</code> in CSS:</strong> ${formatFileLinks(d.cssApplyRefs)} (never in <code>.html</code> or <code>.ts</code>).</div><div class="small-ref">When a component loads that <code>.css</code> file with <code>styleUrl</code>, Angular copies these CSS rules inside <code>main.js</code> and lazy <code>.js</code> chunks. Do not delete this rule while <code>@apply</code> still uses it — instead, replace <code>styleUrl</code> with <code>host: { class: '${cls}' }</code> on the component (or <code>class="${cls}"</code> in HTML) so the style stays in <code>styles.css</code> (<code>0 B</code> in JS chunks).</div>`;
  }
  return `Delete unused <code>${escapeHtml(d.selector)}</code> rule from CSS (not used in any <code>.html</code>, <code>.ts</code>, or <code>.css</code> file).`;
}

function renderDeadCssTable(deadClasses) {
  if (deadClasses.length === 0) {
    return '<p class="muted">None detected.</p>';
  }
  const rows = deadClasses
    .map(
      (d) => `<tr class="filter-row">
      <td class="col-loc">${formatFileLinks(d.relPath)}</td>
      <td class="col-sel"><code>${escapeHtml(d.selector)}</code></td>
      <td class="num">~${escapeHtml(formatBytes(d.estBytes))}</td>
      <td class="col-badge">${formatTestBadge(d.specRefs)}</td>
      <td class="col-util">${formatDeadCssAction(d)}</td>
    </tr>`,
    )
    .join('\n');
  return `<table><thead><tr><th>CSS Location</th><th>Selector</th><th>Est. Saved</th><th>Unit Test Check</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderShortStaticTable(shortRules) {
  if (shortRules.length === 0) {
    return '<p class="muted">None detected.</p>';
  }
  const rows = shortRules
    .map(
      (r) => `<tr class="filter-row">
      <td class="col-loc">${formatFileLinks(r.relPath)}</td>
      <td class="col-loc">${formatFileLinks(r.htmlLocations)}</td>
      <td class="col-sel"><code>${escapeHtml(r.selector)}</code></td>
      <td class="col-util"><code>${escapeHtml(r.utilities)}</code></td>
      <td class="num">~${escapeHtml(formatBytes(r.estBytes))}</td>
      <td class="col-badge">${formatTestBadge(r.specRefs)}</td>
    </tr>`,
    )
    .join('\n');
  return `<table>
    <thead><tr><th>CSS Location</th><th>HTML Location</th><th>Selector</th><th>Inline Utilities to HTML</th><th>Est. Saved</th><th>Unit Test Check</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderPartialStaticTable(partialRules) {
  if (partialRules.length === 0) {
    return '<p class="muted">None detected.</p>';
  }
  const rows = partialRules
    .map(
      (p) => `<tr class="filter-row">
      <td class="col-loc">${formatFileLinks(p.relPath)}</td>
      <td class="col-loc">${formatFileLinks(p.htmlLocations)}</td>
      <td class="col-sel"><code>${escapeHtml(p.selector)}</code></td>
      <td class="col-util">Keep <code>${escapeHtml(p.className)}</code> + add <code>${escapeHtml(p.moveToHtml)}</code></td>
      <td class="col-util"><code>${escapeHtml(p.keepInCss)}</code></td>
      <td class="num">~${escapeHtml(formatBytes(p.estBytes))}</td>
      <td class="col-badge">${formatTestBadge(p.specRefs)}</td>
    </tr>`,
    )
    .join('\n');
  return `<table>
    <thead><tr><th>CSS Location</th><th>HTML Location</th><th>Selector</th><th>HTML Class Update</th><th>Keep in CSS</th><th>Est. Saved</th><th>Unit Test Check</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderDuplicateRulesTable(duplicateRules) {
  if (duplicateRules.length === 0) {
    return '<p class="muted">None detected.</p>';
  }
  const rows = duplicateRules
    .map(
      (d) => `<tr class="filter-row">
      <td class="col-loc">${formatFileLinks(d.relPath)}</td>
      <td class="col-loc">${formatFileLinks(d.htmlLocations)}</td>
      <td class="col-sel"><code>${escapeHtml(d.selectors)}</code> (${d.sharedCount} shared)</td>
      <td class="col-util"><code>${escapeHtml(d.fixCss)}</code><div class="small-ref">${escapeHtml(d.unsharedHint)}</div></td>
      <td class="num">~${escapeHtml(formatBytes(d.estBytes))}</td>
      <td class="col-badge">${formatTestBadge(d.specRefs)}</td>
    </tr>`,
    )
    .join('\n');
  return `<table>
    <thead><tr><th>CSS Location</th><th>HTML Location</th><th>Selectors</th><th>Consolidated CSS &amp; HTML Fix</th><th>Est. Saved</th><th>Unit Test Check</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderReportStyles() {
  const cssPath = new URL('./report.css', import.meta.url);
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  return `<style>\n${cssContent}</style>`;
}

function renderVectorRow(v) {
  if (v.findings.length === 0) {
    return `<tr class="filter-row">
      <td><strong>${escapeHtml(v.name)}</strong></td>
      <td><span class="badge badge-ok">✅ Pass</span></td>
      <td class="col-loc"><span class="muted">—</span></td>
      <td class="muted">No issues detected.</td>
    </tr>`;
  }
  return v.findings
    .map(
      (f) => `<tr class="filter-row">
      <td><strong>${escapeHtml(v.name)}</strong></td>
      <td><span class="badge badge-warn">⚠️ Issue</span></td>
      <td class="col-loc">${formatFileLinks(f.location)}</td>
      <td class="col-util">${escapeHtml(f.detail)}<div class="small-ref"><strong>Fix:</strong> ${escapeHtml(f.fix)}</div></td>
    </tr>`,
    )
    .join('\n');
}

function renderVectorAuditSection(vectorAudit = []) {
  const issueCount = vectorAudit.reduce((sum, v) => sum + v.findings.length, 0);
  const rows = vectorAudit.map(renderVectorRow).join('\n');
  return `<details open>
      <summary>8 Initial Bundle Vectors Audit (${issueCount} issue(s) across ${vectorAudit.length} vectors)</summary>
      <table>
        <thead><tr><th>Vector</th><th>Status</th><th>Location</th><th>Finding &amp; Recommended Fix</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>`;
}

function renderCssSections(cssAnalysis = {}) {
  const {
    postcssRecommendation = null,
    deadClasses = [],
    shortStaticRules = [],
    partialStaticRules = [],
    duplicateRules = [],
  } = cssAnalysis;
  const postcssBanner = postcssRecommendation ? `<p>💡 <strong>${escapeHtml(postcssRecommendation)}</strong></p>` : '';
  return `${postcssBanner}<details open>
      <summary>1. Dead / Unused CSS Classes (${deadClasses.length})</summary>
      ${renderDeadCssTable(deadClasses)}
    </details>
    <details open>
      <summary>2. Short Static @apply Classes &lt;= 3 Utilities (${shortStaticRules.length})</summary>
      ${renderShortStaticTable(shortStaticRules)}
    </details>
    <details open>
      <summary>3. Partial Static Splits (${partialStaticRules.length})</summary>
      ${renderPartialStaticTable(partialStaticRules)}
    </details>
    <details open>
      <summary>4. Duplicate @apply Rules (${duplicateRules.length})</summary>
      ${renderDuplicateRulesTable(duplicateRules)}
    </details>`;
}

export function writeHtmlReport({ reportPath, hash, projectConfig, summaryText, auditData }) {
  const { chunks = [], vectorAudit = [], cssAnalysis = {} } = auditData;
  const html = `<!doctype html>
${SUMMARY_START}${summaryText.replaceAll('-->', '--&gt;')}${SUMMARY_END}
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Angular Bundle Audit — ${escapeHtml(projectConfig.projectName)} (${escapeHtml(hash)})</title>
  ${renderReportStyles()}
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>🛡️ Angular Bundle Guard Audit Report</h1>
        <div class="meta">Project: <strong>${escapeHtml(projectConfig.projectName)}</strong> | Source: <code>${escapeHtml(projectConfig.relSourceRoot)}</code> | Hash: <code>${escapeHtml(hash)}</code></div>
      </div>
    </header>
    <input id="filter" class="filter-bar" type="search" placeholder="Filter findings by file path, selector, chunk, or utility..." oninput="for (const r of document.querySelectorAll('.filter-row')) { r.style.display = r.textContent.toLowerCase().includes(this.value.toLowerCase()) ? '' : 'none'; }">
    <details open>
      <summary>Output Chunks &amp; Embedded Styles (${chunks.length})</summary>
      ${renderChunkTable(chunks)}
    </details>
    ${renderVectorAuditSection(vectorAudit)}
    ${renderCssSections(cssAnalysis)}
    <details>
      <summary>Raw CLI Summary</summary>
      <pre>${escapeHtml(summaryText)}</pre>
    </details>
  </div>
</body>
</html>`;

  fs.writeFileSync(reportPath, html, 'utf8');
}
