/**
 * DOM-рендерер информационных блоков Graph Studio v13.
 * Использует textContent и безопасные URL, поэтому входной JSON не исполняется как HTML.
 */
export function renderInfoDocument(root, documentData = {}, config = {}) {
  if (!root) return;
  root.replaceChildren();
  const theme = documentData.theme ?? {};
  root.style.setProperty('--info-accent', theme.accent ?? '#3d5c95');
  root.style.setProperty('--info-surface', theme.surface ?? 'rgba(255,255,255,0.94)');
  root.style.setProperty('--info-text', theme.text ?? '#17232d');
  root.style.setProperty('--info-muted', theme.muted ?? '#607080');

  const header = element('header', 'info-document-header');
  header.append(textElement('h1', documentData.title ?? 'Информационная панель'));
  if (documentData.subtitle) header.append(textElement('p', documentData.subtitle));
  root.append(header);

  const sections = Array.isArray(documentData.sections) ? documentData.sections : [];
  const deck = element('div', 'info-section-deck');
  sections.forEach((section, index) => deck.append(renderSection(section, index)));
  if (!sections.length) {
    const empty = element('div', 'info-empty-state');
    empty.textContent = 'Добавьте sections в поле document. Даже красивые пустые карточки всё ещё пустые.';
    deck.append(empty);
  }
  root.append(deck);
}

function renderSection(section = {}, index = 0) {
  const type = String(section.type ?? section.layout ?? inferType(section)).toLowerCase();
  const card = element('section', `info-section info-section-${type}`);
  card.dataset.sectionType = type;
  card.style.setProperty('--section-color', section.color ?? section.accent ?? autoColor(index));
  card.append(renderHeading(section, index));

  if (type === 'summary') card.append(renderSummary(section));
  else if (type === 'timeline') card.append(renderTimeline(section.events ?? section.items ?? []));
  else if (type === 'alerts') card.append(renderAlerts(section.items ?? []));
  else if (type === 'checklist') card.append(renderChecklist(section.items ?? []));
  else if (type === 'comparison') card.append(renderComparison(section.columns ?? []));
  else if (type === 'progress') card.append(renderProgress(section.items ?? []));
  else if (type === 'matrix') card.append(renderMatrix(section.cells ?? []));
  else if (type === 'pros_cons') card.append(renderProsCons(section));
  else if (type === 'glossary') card.append(renderGlossary(section.items ?? []));
  else if (type === 'recommendations') card.append(renderRecommendations(section.items ?? []));
  else if (type === 'sources') card.append(renderSources(section.items ?? []));
  else if (type === 'quote') card.append(renderQuote(section));
  else renderGenericContent(card, section);

  if (section.table && Array.isArray(section.table.columns) && !card.querySelector('.info-table-wrap')) {
    card.append(renderTable(section.table, section.color));
  }
  return card;
}

function renderHeading(section, index) {
  const head = element('header', 'info-section-heading');
  const indexBadge = textElement('span', String(section.index ?? index + 1), 'info-section-index');
  const titleWrap = element('div', 'info-section-title-wrap');
  titleWrap.append(textElement('h2', section.title ?? `Раздел ${index + 1}`));
  if (section.description) titleWrap.append(textElement('p', section.description));
  head.append(indexBadge, titleWrap);
  return head;
}

function renderGenericContent(card, section) {
  if (Array.isArray(section.items) && section.items.length) {
    const list = element('div', 'info-ranked-list');
    section.items.forEach((item, itemIndex) => list.append(renderItem(item, itemIndex, section.color)));
    card.append(list);
  }
  if (Array.isArray(section.blocks) && section.blocks.length) card.append(renderBlocks(section.blocks));
}

function renderSummary(section) {
  const box = element('div', 'info-summary');
  if (section.summary ?? section.text) box.append(textElement('p', section.summary ?? section.text, 'info-summary-text'));
  const facts = Array.isArray(section.facts) ? section.facts : [];
  if (facts.length) {
    const grid = element('div', 'info-fact-grid');
    facts.forEach((fact, index) => {
      const item = element('div', 'info-fact');
      item.style.setProperty('--item-color', fact.color ?? autoColor(index));
      item.append(textElement('span', fact.label ?? `Факт ${index + 1}`), textElement('strong', fact.value ?? ''));
      grid.append(item);
    });
    box.append(grid);
  }
  return box;
}

function renderTimeline(events) {
  const list = element('div', 'info-timeline');
  events.forEach((event, index) => {
    const item = element('article', 'info-timeline-item');
    item.style.setProperty('--item-color', event.color ?? autoColor(index));
    item.append(textElement('time', event.date ?? event.period ?? String(index + 1)));
    const body = element('div');
    body.append(textElement('h3', event.title ?? `Событие ${index + 1}`));
    if (event.text ?? event.description) body.append(textElement('p', event.text ?? event.description));
    item.append(body);
    list.append(item);
  });
  return list;
}

function renderAlerts(items) {
  const list = element('div', 'info-alert-list');
  items.forEach((item, index) => {
    const alert = element('article', 'info-alert');
    const level = String(item.level ?? item.status ?? 'info').toLowerCase();
    alert.dataset.level = level;
    alert.style.setProperty('--item-color', item.color ?? severityColor(level));
    alert.append(textElement('strong', item.title ?? `Сигнал ${index + 1}`));
    if (item.text ?? item.description) alert.append(textElement('p', item.text ?? item.description));
    if (item.action) alert.append(textElement('small', `Действие: ${item.action}`));
    list.append(alert);
  });
  return list;
}

function renderChecklist(items) {
  const list = element('div', 'info-checklist');
  items.forEach((item) => {
    const row = element('article', 'info-check-item');
    row.dataset.done = item.done ? 'true' : 'false';
    row.append(textElement('span', item.done ? '✓' : '○', 'info-check-mark'));
    const body = element('div');
    body.append(textElement('h3', item.title ?? item.name ?? 'Задача'));
    if (item.text ?? item.description) body.append(textElement('p', item.text ?? item.description));
    row.append(body);
    if (item.owner) row.append(textElement('span', item.owner, 'info-owner'));
    list.append(row);
  });
  return list;
}

function renderComparison(columns) {
  const grid = element('div', 'info-comparison');
  columns.forEach((column, index) => {
    const card = element('article', 'info-compare-column');
    card.style.setProperty('--item-color', column.color ?? autoColor(index));
    card.append(textElement('h3', column.title ?? `Вариант ${index + 1}`));
    if (column.value != null) card.append(textElement('strong', column.value, 'info-compare-value'));
    const list = element('ul');
    for (const item of column.items ?? []) list.append(textElement('li', typeof item === 'string' ? item : item.text ?? item.title ?? ''));
    card.append(list);
    if (column.conclusion) card.append(textElement('p', column.conclusion, 'info-compare-conclusion'));
    grid.append(card);
  });
  return grid;
}

function renderProgress(items) {
  const list = element('div', 'info-progress-list');
  items.forEach((item, index) => {
    const max = Math.max(1, Number(item.max ?? 100));
    const value = Math.max(0, Math.min(max, Number(item.value ?? 0)));
    const row = element('article', 'info-progress-item');
    row.style.setProperty('--item-color', item.color ?? autoColor(index));
    const heading = element('div', 'info-progress-heading');
    heading.append(textElement('span', item.title ?? item.label ?? `Показатель ${index + 1}`), textElement('strong', `${value}/${max}`));
    const track = element('div', 'info-progress-track');
    const fill = element('span', 'info-progress-fill');
    fill.style.width = `${value / max * 100}%`;
    track.append(fill);
    row.append(heading, track);
    list.append(row);
  });
  return list;
}

function renderMatrix(cells) {
  const grid = element('div', 'info-matrix');
  const order = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  [...cells].sort((a, b) => order.indexOf(a.quadrant) - order.indexOf(b.quadrant)).forEach((cell, index) => {
    const box = element('article', 'info-matrix-cell');
    box.dataset.quadrant = cell.quadrant ?? order[index] ?? '';
    box.style.setProperty('--item-color', cell.color ?? autoColor(index));
    box.append(textElement('h3', cell.title ?? `Квадрант ${index + 1}`));
    const list = element('ul');
    for (const item of cell.items ?? []) list.append(textElement('li', typeof item === 'string' ? item : item.title ?? item.text ?? ''));
    box.append(list);
    grid.append(box);
  });
  return grid;
}

function renderProsCons(section) {
  return renderComparison([
    { title: section.positiveTitle ?? 'Плюсы', items: section.positive ?? [], color: section.positiveColor ?? '#22c55e' },
    { title: section.negativeTitle ?? 'Минусы', items: section.negative ?? [], color: section.negativeColor ?? '#ef4444' }
  ]);
}

function renderGlossary(items) {
  const list = element('dl', 'info-glossary');
  items.forEach((item) => {
    list.append(textElement('dt', item.term ?? item.title ?? 'Термин'));
    list.append(textElement('dd', item.definition ?? item.text ?? ''));
  });
  return list;
}

function renderRecommendations(items) {
  const list = element('div', 'info-recommendations');
  items.forEach((item, index) => {
    const row = element('article', 'info-recommendation');
    row.style.setProperty('--item-color', item.color ?? autoColor(index));
    row.append(textElement('span', item.priority ?? String(index + 1), 'info-recommendation-priority'));
    const body = element('div');
    body.append(textElement('h3', item.title ?? item.action ?? 'Рекомендация'));
    if (item.reason) body.append(textElement('p', item.reason));
    if (item.effect) body.append(textElement('small', `Ожидаемый эффект: ${item.effect}`));
    row.append(body);
    list.append(row);
  });
  return list;
}

function renderSources(items) {
  const list = element('ol', 'info-sources');
  items.forEach((item) => {
    const li = element('li');
    const url = safeUrl(item.url);
    if (url) {
      const link = element('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.title ?? url;
      li.append(link);
    } else li.append(textElement('strong', item.title ?? 'Источник'));
    if (item.note ?? item.text) li.append(textElement('p', item.note ?? item.text));
    list.append(li);
  });
  return list;
}

function renderQuote(section) {
  const quote = element('blockquote', 'info-quote');
  quote.append(textElement('p', section.quote ?? section.text ?? ''));
  if (section.author ?? section.source) quote.append(textElement('footer', section.author ?? section.source));
  return quote;
}

function renderBlocks(blocks) {
  const grid = element('div', 'info-block-grid');
  blocks.forEach((block, blockIndex) => {
    const box = element('article', 'info-mini-card');
    box.style.setProperty('--block-color', block.color ?? autoColor(blockIndex));
    box.append(textElement('h3', block.title ?? `Блок ${blockIndex + 1}`));
    if (block.value != null) box.append(textElement('strong', String(block.value), 'info-mini-value'));
    if (block.text) box.append(textElement('p', block.text));
    grid.append(box);
  });
  return grid;
}

function renderItem(item = {}, index = 0, sectionColor = null) {
  const row = element('article', 'info-ranked-item');
  row.style.setProperty('--item-color', item.color ?? sectionColor ?? autoColor(index));
  row.append(textElement('span', String(item.rank ?? index + 1), 'info-rank'));
  const content = element('div', 'info-ranked-content');
  content.append(textElement('h3', item.title ?? item.name ?? `Пункт ${index + 1}`));
  if (item.text ?? item.description) content.append(textElement('p', item.text ?? item.description));
  row.append(content);
  if (item.status || item.value) {
    const badge = textElement('span', String(item.status ?? item.value), 'info-status');
    badge.dataset.level = String(item.level ?? '').toLowerCase();
    if (item.statusColor) badge.style.background = item.statusColor;
    row.append(badge);
  }
  return row;
}

function renderTable(table, fallbackColor) {
  const wrapper = element('div', 'info-table-wrap');
  const node = element('table', 'info-table');
  node.style.setProperty('--table-color', table.color ?? fallbackColor ?? '#3d5c95');
  if (table.title) node.append(textElement('caption', table.title));
  const thead = element('thead');
  const headerRow = element('tr');
  table.columns.forEach((column) => headerRow.append(textElement('th', typeof column === 'string' ? column : column.label ?? column.id ?? '')));
  thead.append(headerRow);
  node.append(thead);
  const tbody = element('tbody');
  for (const row of Array.isArray(table.rows) ? table.rows : []) {
    const tr = element('tr');
    table.columns.forEach((column, columnIndex) => {
      const key = typeof column === 'string' ? column : column.id;
      const value = Array.isArray(row) ? row[columnIndex] : row?.[key];
      const cell = textElement('td', value == null ? '' : String(value));
      const cellColor = row?.colors?.[key] ?? row?.color;
      if (cellColor) cell.style.setProperty('--cell-color', cellColor);
      tr.append(cell);
    });
    tbody.append(tr);
  }
  node.append(tbody);
  wrapper.append(node);
  return wrapper;
}

function inferType(section) {
  if (section.table) return 'table';
  if (section.blocks) return 'cards';
  if (section.items) return 'ranking';
  return 'summary';
}
function element(tag, className = '') { const node = document.createElement(tag); if (className) node.className = className; return node; }
function textElement(tag, text, className = '') { const node = element(tag, className); node.textContent = text ?? ''; return node; }
function autoColor(index) { const palette = ['#3d5c95','#4f8a70','#c56a5a','#8b6fb3','#d29a3a','#3a8fa6','#a55278','#6a8e3a']; return palette[index % palette.length]; }
function severityColor(level) { return ({ critical: '#b63a46', warning: '#d47736', good: '#4f8a70', info: '#3d5c95' })[level] ?? '#3d5c95'; }
function safeUrl(value) { try { const url = new URL(String(value)); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } }
