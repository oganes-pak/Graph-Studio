/**
 * Единый реестр типов диаграмм Graph Studio v14.
 * UI, движок, импорт, ИИ и MCP используют одинаковые идентификаторы.
 */
export const DIAGRAM_TYPES = Object.freeze([
  define('info', 'Информационная панель', 'Инфо-блоки', 'document', false, 'dom', 'info',
    'Прокручиваемые карточки, рейтинги, статусы и таблицы с настраиваемыми цветами.',
    'Отчёты, аналитические выводы, географические срезы, риски и резюме ИИ.',
    'Задачи, где критична геометрия связей между объектами.',
    'Заголовок и массив sections с items, blocks или table.'),
  define('fishbone', 'Диаграмма Исикавы', 'Исикава', 'node-link', true, 'graph', 'fishbone',
    'Причины и подпричины располагаются вдоль хребта, ведущего к проблеме.',
    'Поиск причин проблемы, дефектов, болезней и сбоев.',
    'Временные ряды, сравнение числовых вариантов без причинной структуры.',
    'Одна проблема, категории причин и подпричины.'),
  define('flowchart', 'Блок-схема', 'Блок-схема', 'node-link', true, 'flowchart', 'flowchart',
    'Последовательность действий, условий, входов и выходов.',
    'Алгоритмы, бизнес-процессы, оформление заказа, обработка заявки.',
    'Свободные ассоциативные связи и сравнение метрик.',
    'Начало, шаги, условия, переходы и завершение.'),
  define('tree', 'Древовидная диаграмма', 'Дерево', 'node-link', true, 'graph', 'tree',
    'Строгая иерархия от корневого узла к дочерним уровням.',
    'Оргструктуры, учебные планы, классификации и каталоги.',
    'Сети с большим числом циклов и равноправных перекрёстных связей.',
    'Один корень и отношения родитель → потомок.'),
  define('force', 'Силовая диаграмма', 'Силовой граф', 'node-link', false, 'graph', 'force',
    'Узлы распределяются пружинами и силами отталкивания.',
    'Социальные сети, зависимости, взаимодействия команд и систем.',
    'Строгая последовательность шагов или точное сравнение чисел.',
    'Узлы и произвольные связи; корень необязателен.'),
  define('sankey', 'Диаграмма Санкей', 'Санкей', 'flow', true, 'sankey', 'sankey',
    'Потоки между этапами, ширина ленты определяется значением связи.',
    'Деньги, энергия, клиенты, товары и переходы между этапами.',
    'Связи без направления и без числового объёма.',
    'Направленные связи со значением потока и желательно с колонками.'),
  define('network', 'Сетевая диаграмма', 'Сеть', 'node-link', false, 'graph', 'network',
    'Универсальный граф связей с планетарной или шестигранной раскладкой.',
    'Любые сущности и отношения, когда важна общая карта связей.',
    'Точная последовательность процесса или сравнение по общим шкалам.',
    'Узлы и связи любого уровня сложности.'),
  define('radar', 'Радарная диаграмма', 'Радар', 'chart', false, 'radar', 'radar',
    'Сравнение нескольких объектов по общим радиальным метрикам.',
    'Компетенции, варианты решений, баланс жизни, характеристики товаров.',
    'Иерархии, причинные цепочки и потоки.',
    'Минимум три общие числовые метрики и одна или несколько серий.'),
  define('bubble', 'Пузырьковая диаграмма', 'Пузыри', 'chart', false, 'bubble', 'bubble',
    'Объекты размещаются по X и Y, а размер показывает третью величину.',
    'Товары, проекты и задачи с тремя числовыми показателями.',
    'Процессы, иерархии и причинные цепочки.',
    'Для каждого объекта нужны X, Y и положительный размер.'),
  define('mindmap', 'Ментальная карта', 'Ментальная карта', 'node-link', true, 'mindmap', 'mindmap',
    'Свободные ветви расходятся от центральной идеи в обе стороны.',
    'Планы, идеи, обучение, личные цели и мозговой штурм.',
    'Точные потоки и строгие числовые сравнения.',
    'Центральная идея и тематические ветви нескольких уровней.'),
  define('decision', 'Граф решений', 'Решения', 'node-link', true, 'decision', 'decision',
    'Решения, события и исходы отображаются разными формами.',
    'Выбор работы, учёбы, лечения, покупки или стратегии.',
    'Простые каталоги без вариантов, вероятностей и последствий.',
    'Решение, варианты, события и конечные исходы.')
]);

function define(id, title, shortTitle, family, directed, renderer, layout, description, bestFor, notFor, dataNeeds) {
  return Object.freeze({ id, title, shortTitle, family, directed, renderer, layout, description, bestFor, notFor, dataNeeds });
}

const BY_ID = new Map(DIAGRAM_TYPES.map((item) => [item.id, item]));
const ALIASES = new Map([
  ['planetary', 'network'], ['hex', 'network'], ['grid', 'network'],
  ['hierarchy', 'tree'], ['tree/hierarchy', 'tree'],
  ['force-directed', 'force'], ['force_directed', 'force'],
  ['network-graph', 'network'], ['spider', 'radar'],
  ['spider-chart', 'radar'], ['bubble-chart', 'bubble'],
  ['mind-map', 'mindmap'], ['influence', 'decision'],
  ['decision-graph', 'decision'], ['ishikawa', 'fishbone'],
  ['cards', 'info'], ['report', 'info'], ['dashboard', 'info'], ['information', 'info']
]);

export function normalizeDiagramType(value) {
  const raw = String(value ?? 'network').trim().toLowerCase();
  const normalized = ALIASES.get(raw) ?? raw;
  return BY_ID.has(normalized) ? normalized : 'network';
}
export function getDiagramDefinition(type) { return BY_ID.get(normalizeDiagramType(type)); }
export function isChartDiagram(type) { return getDiagramDefinition(type).family === 'chart'; }
export function isDirectedDiagram(type) { return Boolean(getDiagramDefinition(type).directed); }
export function listDiagramTypes() { return DIAGRAM_TYPES.map((item) => ({ ...item })); }
