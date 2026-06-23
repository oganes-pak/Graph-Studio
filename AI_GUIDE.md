# Graph Studio v9: инструкция для ИИ

## Предпочтительный ответ без MCP

Верните один JSON-объект формата `graph-studio/3`:

```json
{
  "format": "graph-studio/3",
  "title": "Название",
  "diagramType": "mindmap",
  "nodes": [
    { "id": "core", "name": "Главная идея", "type": "core" },
    { "id": "branch", "name": "Ветвь", "type": "group" }
  ],
  "connections": [
    { "from": "core", "to": "branch", "label": "содержит" }
  ],
  "chart": { "metrics": [], "series": [] }
}
```

## Допустимые `diagramType`

```text
fishbone
flowchart
tree
force
sankey
network
radar
bubble
mindmap
decision
```

## Правила

1. `id` должен быть коротким и стабильным.
2. Сначала создайте все узлы, затем связи.
3. Между одной парой узлов создавайте только одну связь.
4. Для Sankey задавайте `value` связи и при необходимости `column` узла.
5. Для Bubble задавайте `x`, `y` и `value` узла.
6. Для Radar используйте `chart.metrics` и `chart.series`; узлы не обязательны.
7. Не придумывайте смысловые оценки, которых нет в исходных данных.

## Атомарные команды

```text
get_project
replace_graph
set_diagram_type
set_chart_data
add_node
change_node
delete_node
add_connection
change_connection
delete_connection
set_layout
change_view
set_read_only
add_legend_item
delete_legend_item
```

Пример:

```js
graph.run('set_diagram_type', { diagramType: 'fishbone' });
```

## Импорт с дублями

`replace_graph` и загрузка JSON используют мягкую нормализацию. Дубликаты связей объединяются. Ручной `add_connection` остаётся строгим и отклоняет повтор пары.

## Совместимость выбранного представления

ИИ может запросить любой тип диаграммы, но должен учитывать предметный смысл:

- `bubble` желательно передавать с `x`, `y`, `value`;
- `radar` желательно передавать с общими метриками;
- `sankey` желательно передавать с направлением и числовым `value`;
- `tree` желательно передавать с одним корнем;
- `fishbone` желательно передавать с проблемой, категориями и причинами.

Если этих данных нет, Graph Studio всё равно выполнит преобразование и создаст синтетические поля. После построения пользователь должен проверить, соответствует ли визуальная интерпретация исходному смыслу.

## Цвета

Поле `color` необязательно. Если оно отсутствует, Graph Studio назначит следующий цвет из автоматической контрастной палитры. Явно переданный цвет всегда имеет приоритет.

## Информационные блоки v13

Для отчётов, рейтингов и таблиц используйте `diagramType: "info"` и поле `document`.

```json
{
  "format": "graph-studio/3",
  "diagramType": "info",
  "document": {
    "title": "Отчёт",
    "subtitle": "Краткие выводы",
    "sections": [
      {
        "id": "risk",
        "title": "Уровень риска",
        "color": "#c55d55",
        "items": [
          { "rank": 1, "title": "Отмены", "status": "КРИТИЧЕСКАЯ", "color": "#c55d55" }
        ]
      }
    ]
  }
}
```

Атомарная команда: `set_document_data`. Она доступна через браузерный API и MCP.

## Каталог информационных блоков v13

Перед созданием `document.sections` модель может запросить доступные шаблоны:

```js
graph.run('get_info_templates')
```

Ответ содержит тип, назначение, основные поля и короткий пример. Рекомендуемый порядок:

1. вызвать `get_info_templates`;
2. выбрать один или несколько подходящих типов;
3. сформировать `document.sections`;
4. вызвать `set_document_data`;
5. прочитать проект через `get_project` и проверить результат.

Поддерживаются: `summary`, `ranking`, `kpi`, `table`, `timeline`, `alerts`, `checklist`, `comparison`, `progress`, `matrix`, `steps`, `pros_cons`, `glossary`, `recommendations`, `sources`, `quote`, `cards`.
