import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import { BUILD_CONFIG_FILES, formatBytes, getConfigSearchDirs, rootDir } from './bundle-utils.mjs';
import { renderComponentCssSection, renderCssSections } from './component-css-report.mjs';
import { getSourceFiles, readTextFile, setActiveProjectHash, writeTextFile } from './fs-utils.mjs';

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
  hasher.update(`root:${path.resolve(projectConfig.projectRoot || rootDir)}\nproject:${projectConfig.projectName}\n`);

  for (const dir of getConfigSearchDirs(projectConfig.projectRoot)) {
    for (const cfgName of BUILD_CONFIG_FILES) {
      const cfgPath = path.join(dir, cfgName);
      const cfgContent = readTextFile(cfgPath);
      if (cfgContent !== null) {
        hasher.update(`${path.relative(rootDir, cfgPath)}:${cfgContent}\n`);
      }
    }
  }

  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  for (const scriptFile of getSourceFiles(scriptDir, ['.mjs', '.css']).sort()) {
    hasher.update(`script:${path.basename(scriptFile)}:${readTextFile(scriptFile) ?? ''}\n`);
  }

  const files = getSourceFiles(projectConfig.sourceRoot, ['.ts', '.html', '.css']).sort();
  for (const file of files) {
    const rel = path.relative(rootDir, file);
    hasher.update(`${rel}:${readTextFile(file) ?? ''}\n`);
  }

  const hash = hasher.digest('hex').slice(0, 8);
  setActiveProjectHash(hash);
  const reportPath = path.join(os.tmpdir(), `bundle-audit-report-${hash}.html`);
  return { hash, reportPath };
}

export function readCachedReport(reportPath) {
  const content = readTextFile(reportPath);
  if (content === null) {
    return null;
  }
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
      <td>${escapeHtml(c.stylesSummary || '—')}</td>
      <td>${escapeHtml(c.topInputs || '—')}</td>
    </tr>`,
    )
    .join('\n');
  return `<table><thead><tr><th>Chunk</th><th>Raw Size</th><th>Embedded Styles &amp; Tailwind @property Overhead</th><th>Top Inputs</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderReportStyles() {
  const cssPath = new URL('./report.css', import.meta.url);
  const cssContent = readTextFile(cssPath) ?? '';
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

function renderVectorAuditSection(vectorAudit = [], title = '8 Initial Bundle Vectors Audit') {
  const issueCount = vectorAudit.reduce((sum, v) => sum + v.findings.length, 0);
  const rows = vectorAudit.map(renderVectorRow).join('\n');
  return `<details open>
      <summary>${escapeHtml(title)} (${issueCount} issue(s) across ${vectorAudit.length} vectors)</summary>
      <table>
        <thead><tr><th>Vector</th><th>Status</th><th>Location</th><th>Finding &amp; Recommended Fix</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>`;
}

export function writeHtmlReport({ reportPath, hash, projectConfig, summaryText, auditData }) {
  const { chunks = [], componentCss = {}, vectorAudit = [], lazyVectorAudit = [], cssAnalysis = {} } = auditData;
  const htmlHelpers = { escapeHtml, formatFileLinks, formatTestBadge };
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
      <summary>1. Output Chunks &amp; Embedded Styles (${chunks.length})</summary>
      ${renderChunkTable(chunks)}
    </details>
    ${renderComponentCssSection(componentCss, htmlHelpers)}
    ${renderVectorAuditSection(vectorAudit, '8 Initial Bundle Vectors Audit')}
    ${renderVectorAuditSection(lazyVectorAudit, '3 Lazy Chunk Vectors Audit')}
    ${renderCssSections(cssAnalysis, htmlHelpers)}
    <details>
      <summary>Raw CLI Summary</summary>
      <pre>${escapeHtml(summaryText)}</pre>
    </details>
  </div>
</body>
</html>`;

  writeTextFile(reportPath, html);
}
