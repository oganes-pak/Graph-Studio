/**
 * Машиночитаемый каталог информационных блоков Graph Studio v13.
 *
 * Каждый тип имеет короткое имя, назначение и минимальный пример. ИИ может
 * сначала запросить каталог, затем сформировать document.sections без MCP.
 */
export const INFO_BLOCK_TEMPLATES = Object.freeze([
  template('summary', 'Краткое резюме', 'Главный вывод, контекст и ключевые факты.', ['title', 'summary', 'facts']),
  template('ranking', 'Рейтинг', 'Упорядоченный список регионов, товаров, рисков или приоритетов.', ['items']),
  template('kpi', 'KPI-карточки', 'Набор показателей со значением, изменением и цветом.', ['blocks']),
  template('table', 'Цветная таблица', 'Структурированные строки и колонки с цветовой индикацией.', ['table']),
  template('timeline', 'Хронология', 'События, даты, этапы и последовательность изменений.', ['events']),
  template('alerts', 'Риски и сигналы', 'Список предупреждений с уровнем critical, warning, info или good.', ['items']),
  template('checklist', 'Чек-лист', 'Задачи с состоянием выполнения и ответственным.', ['items']),
  template('comparison', 'Сравнение вариантов', 'Колонки с плюсами, минусами, характеристиками и итогом.', ['columns']),
  template('progress', 'Прогресс', 'Показатели выполнения с текущим и максимальным значением.', ['items']),
  template('matrix', 'Матрица 2×2', 'Четыре квадранта для приоритетов, рисков или стратегий.', ['cells']),
  template('steps', 'Пошаговый план', 'Нумерованная последовательность действий.', ['items']),
  template('pros_cons', 'Плюсы и минусы', 'Две группы аргументов за и против.', ['positive', 'negative']),
  template('glossary', 'Словарь', 'Термины, определения и короткие пояснения.', ['items']),
  template('recommendations', 'Рекомендации', 'Действия с приоритетом, причиной и ожидаемым эффектом.', ['items']),
  template('sources', 'Источники и доказательства', 'Список документов, ссылок и подтверждающих фактов.', ['items']),
  template('quote', 'Цитата или инсайт', 'Один выделенный вывод с автором или источником.', ['quote']),
  template('cards', 'Карточки сущностей', 'Произвольные цветные карточки людей, проектов, товаров или объектов.', ['blocks'])
]);

export function getInfoBlockTemplates() {
  return structuredClone(INFO_BLOCK_TEMPLATES);
}

export function getInfoBlockTemplate(type) {
  return getInfoBlockTemplates().find((item) => item.type === type) ?? null;
}

function template(type, title, purpose, fields) {
  return {
    type,
    title,
    purpose,
    fields,
    example: exampleFor(type)
  };
}

function exampleFor(type) {
  const examples = {
    summary: { type, title: 'Резюме', summary: 'Ключевой вывод отчёта.', facts: [{ label: 'Период', value: 'Q2' }] },
    ranking: { type, title: 'Приоритеты', items: [{ rank: 1, title: 'Первый пункт', text: 'Описание', status: 'ВЫСОКИЙ' }] },
    kpi: { type, title: 'Показатели', blocks: [{ title: 'Выручка', value: '4,8 млн ₽', text: '+12%', color: '#22c55e' }] },
    table: { type, title: 'Таблица', table: { columns: [{ id: 'name', label: 'Название' }], rows: [{ name: 'Пример' }] } },
    timeline: { type, title: 'Хронология', events: [{ date: 'Июнь', title: 'Запуск', text: 'Начало этапа' }] },
    alerts: { type, title: 'Сигналы', items: [{ title: 'Риск', text: 'Описание', level: 'critical' }] },
    checklist: { type, title: 'Проверка', items: [{ title: 'Задача', done: true, owner: 'Команда' }] },
    comparison: { type, title: 'Сравнение', columns: [{ title: 'Вариант A', items: ['Плюс', 'Минус'], color: '#3d5c95' }] },
    progress: { type, title: 'Выполнение', items: [{ title: 'Этап', value: 65, max: 100, color: '#3b82f6' }] },
    matrix: { type, title: 'Матрица', cells: [{ quadrant: 'top-left', title: 'Важно', items: ['Пункт'] }] },
    steps: { type, title: 'План', items: [{ rank: 1, title: 'Шаг', text: 'Действие' }] },
    pros_cons: { type, title: 'Аргументы', positive: ['Преимущество'], negative: ['Ограничение'] },
    glossary: { type, title: 'Термины', items: [{ term: 'Узел', definition: 'Элемент диаграммы' }] },
    recommendations: { type, title: 'Рекомендации', items: [{ title: 'Действие', priority: 'Высокий', reason: 'Причина' }] },
    sources: { type, title: 'Источники', items: [{ title: 'Отчёт', note: 'Подтверждение вывода', url: 'https://example.com' }] },
    quote: { type, title: 'Инсайт', quote: 'Короткий главный вывод.', author: 'Источник' },
    cards: { type, title: 'Карточки', blocks: [{ title: 'Объект', value: '42', text: 'Описание' }] }
  };
  return examples[type];
}
