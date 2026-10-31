import { formatBytes } from './bundle-utils.mjs';

function formatPropertyOverhead(totalBytes, propBytes, isEstimated) {
  if (propBytes === 0) {
    return '0 B (0%)';
  }
  const propPct = totalBytes > 0 ? ((propBytes / totalBytes) * 100).toFixed(0) : '0';
  const prefix = isEstimated ? '~' : '';
  return `${prefix}${formatBytes(propBytes)} (${propPct}%) — duplicate @property --tw-* boilerplate`;
}

function renderTriggeringUtilitiesCell(triggers, escapeHtml) {
  if (!triggers || triggers.length === 0) {
    return '<span class="muted">None (pure CSS rules)</span>';
  }
  return triggers
    .map(({ util, lines }) => `<code>${escapeHtml(util)}</code> <span class="muted">(L${lines.join(',')})</span>`)
    .join(', ');
}

function renderCssFileRow(f, rowClass, { escapeHtml, formatFileLinks }) {
  const overheadLabel = formatPropertyOverhead(f.bytes, f.propBytes, f.isEstimated);
  return `<tr class="${rowClass}">
      <td class="col-loc">${formatFileLinks(f.linkRef)}</td>
      <td class="num">${escapeHtml(formatBytes(f.bytes))} <span class="muted">(${f.bytes.toLocaleString()} B)</span></td>
      <td>${escapeHtml(overheadLabel)}</td>
      <td class="col-util">${renderTriggeringUtilitiesCell(f.triggers, escapeHtml)}</td>
    </tr>`;
}

export function renderComponentCssSection(componentCss = {}, helpers) {
  const { escapeHtml } = helpers;
  const { files = [], largeCount = 0, smallCount = 0, smallTotalBytes = 0, smallPropBytes = 0 } = componentCss;
  const toggleBar =
    smallCount > 0
      ? `<label class="small-ref toggle-label"><input type="checkbox" class="toggle-small-css"> Show ${smallCount} component CSS file(s) &lt;= 1 KB (${escapeHtml(formatBytes(smallTotalBytes))} total, ${escapeHtml(formatBytes(smallPropBytes))} Tailwind <code>@property</code> overhead)</label>`
      : '';

  if (files.length === 0) {
    return `<details open>
      <summary>2. Component CSS Files &gt; 1 KB (0)</summary>
      <p class="muted">No component CSS files detected.</p>
    </details>`;
  }

  const rows = files
    .map((f) => renderCssFileRow(f, f.isSmall ? 'filter-row small-css-row' : 'filter-row', helpers))
    .join('\n');

  return `<details open>
      <summary>2. Component CSS Files &gt; 1 KB (${largeCount}${smallCount > 0 ? `, +${smallCount} &lt;= 1 KB` : ''})</summary>
      ${toggleBar}<table>
        <thead><tr><th>Source CSS File</th><th>Compiled Size</th><th>Tailwind @property Overhead</th><th>Which @apply classes caused that</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>`;
}

function formatDeadCssAction(d, { escapeHtml, formatFileLinks }) {
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

function renderCssTable(items, headHtml, renderCells) {
  if (items.length === 0) {
    return '<p class="muted">None detected.</p>';
  }
  const rows = items.map((item) => `<tr class="filter-row">\n${renderCells(item)}\n    </tr>`).join('\n');
  return `<table><thead><tr>${headHtml}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderDeadCssTable(deadClasses, helpers) {
  const { escapeHtml, formatFileLinks, formatTestBadge } = helpers;
  return renderCssTable(
    deadClasses,
    '<th>CSS Location</th><th>Selector</th><th>Est. Saved</th><th>Unit Test Check</th><th>Action</th>',
    (d) => `      <td class="col-loc">${formatFileLinks(d.relPath)}</td>
      <td class="col-sel"><code>${escapeHtml(d.selector)}</code></td>
      <td class="num">~${escapeHtml(formatBytes(d.estBytes))}</td>
      <td class="col-badge">${formatTestBadge(d.specRefs)}</td>
      <td class="col-util">${formatDeadCssAction(d, helpers)}</td>`,
  );
}

function renderShortStaticTable(shortRules, { escapeHtml, formatFileLinks, formatTestBadge }) {
  return renderCssTable(
    shortRules,
    '<th>CSS Location</th><th>HTML Location</th><th>Selector</th><th>Inline Utilities to HTML</th><th>Est. Saved</th><th>Unit Test Check</th>',
    (r) => `      <td class="col-loc">${formatFileLinks(r.relPath)}</td>
      <td class="col-loc">${formatFileLinks(r.htmlLocations)}</td>
      <td class="col-sel"><code>${escapeHtml(r.selector)}</code></td>
      <td class="col-util"><code>${escapeHtml(r.utilities)}</code></td>
      <td class="num">~${escapeHtml(formatBytes(r.estBytes))}</td>
      <td class="col-badge">${formatTestBadge(r.specRefs)}</td>`,
  );
}

function renderPartialStaticTable(partialRules, { escapeHtml, formatFileLinks, formatTestBadge }) {
  const note =
    partialRules.length > 0
      ? '<p class="small-ref"><strong>Note:</strong> When moving classes to <code>.html</code>, move or keep matching <code>x:*</code> pairs together (e.g., <code>grid-cols-*</code> with <code>md:grid-cols-*</code>, <code>border-*</code> with <code>focus:border-*</code>) so <code>.css</code> styles don\'t override <code>.html</code> classes.</p>'
      : '';
  return `${note}${renderCssTable(
    partialRules,
    '<th>CSS Location</th><th>HTML Location</th><th>Selector</th><th>HTML Class Update</th><th>Keep in CSS</th><th>Est. Saved</th><th>Unit Test Check</th>',
    (p) => `      <td class="col-loc">${formatFileLinks(p.relPath)}</td>
      <td class="col-loc">${formatFileLinks(p.htmlLocations)}</td>
      <td class="col-sel"><code>${escapeHtml(p.selector)}</code></td>
      <td class="col-util">Keep <code>${escapeHtml(p.className)}</code> + add <code>${escapeHtml(p.moveToHtml)}</code></td>
      <td class="col-util"><code>${escapeHtml(p.keepInCss)}</code></td>
      <td class="num">~${escapeHtml(formatBytes(p.estBytes))}</td>
      <td class="col-badge">${formatTestBadge(p.specRefs)}</td>`,
  )}`;
}

function renderDuplicateRulesTable(duplicateRules, { escapeHtml, formatFileLinks, formatTestBadge }) {
  return renderCssTable(
    duplicateRules,
    '<th>CSS Location</th><th>HTML Location</th><th>Selectors</th><th>Consolidated CSS &amp; HTML Fix</th><th>Est. Saved</th><th>Unit Test Check</th>',
    (d) => `      <td class="col-loc">${formatFileLinks(d.relPath)}</td>
      <td class="col-loc">${formatFileLinks(d.htmlLocations)}</td>
      <td class="col-sel"><code>${escapeHtml(d.selectors)}</code> (${d.sharedCount} shared)</td>
      <td class="col-util"><code>${escapeHtml(d.fixCss)}</code><div class="small-ref">${escapeHtml(d.unsharedHint)}</div></td>
      <td class="num">~${escapeHtml(formatBytes(d.estBytes))}</td>
      <td class="col-badge">${formatTestBadge(d.specRefs)}</td>`,
  );
}

export function renderCssSections(cssAnalysis = {}, helpers) {
  const {
    postcssRecommendation = null,
    deadClasses = [],
    shortStaticRules = [],
    partialStaticRules = [],
    duplicateRules = [],
  } = cssAnalysis;
  const postcssBanner = postcssRecommendation
    ? `<p>💡 <strong>${helpers.escapeHtml(postcssRecommendation)}</strong></p>`
    : '';
  return `${postcssBanner}<details open>
      <summary>1. Dead / Unused CSS &amp; Vanilla Rules (${deadClasses.length})</summary>
      ${renderDeadCssTable(deadClasses, helpers)}
    </details>
    <details open>
      <summary>2. Short Static @apply Classes &lt;= 3 Utilities (${shortStaticRules.length})</summary>
      ${renderShortStaticTable(shortStaticRules, helpers)}
    </details>
    <details open>
      <summary>3. Partial Static Splits (${partialStaticRules.length})</summary>
      ${renderPartialStaticTable(partialStaticRules, helpers)}
    </details>
    <details open>
      <summary>4. Duplicate @apply &amp; @keyframes Rules (${duplicateRules.length})</summary>
      ${renderDuplicateRulesTable(duplicateRules, helpers)}
    </details>`;
}
