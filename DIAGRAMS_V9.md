# Диаграммы Graph Studio v9

## Единый проект

```json
{
  "format": "graph-studio/2",
  "diagramType": "network",
  "nodes": [],
  "connections": [],
  "chart": { "metrics": [], "series": [] },
  "config": {}
}
```

`diagramType` определяет стратегию раскладки и рендерер. Данные узлов и связей сохраняются в одном контракте, а Radar использует дополнительный объект `chart`.

## 1. Fishbone

Используется для анализа причин. Корневая проблема располагается у головы, категории подключаются к хребту, причины отходят от категорий.

Рекомендуемые типы узлов:

```text
core, category, cause
```

## 2. Flowchart

Последовательность действий и условий. Поддерживаются формы:

```text
capsule, rectangle, diamond, parallelogram, circle, square
```

## 3. Tree

Строгая иерархия по уровням. Ориентация задаётся через:

```js
config.diagram.tree.orientation
```

## 4. Force

Динамическая раскладка на пружинах. Основные параметры:

```js
config.diagram.force.linkDistance
config.diagram.force.repulsionFactor
config.diagram.force.anchorFactor
```

## 5. Sankey

Потоки между колонками. У узла можно указать `column`, у связи обязательно желательно указывать `value`.

```json
{
  "from": "source",
  "to": "result",
  "value": 120
}
```

## 6. Network

Исходный универсальный граф. Поддерживает две раскладки:

```text
planetary
hex
```

## 7. Radar

Использует `chart.metrics` и `chart.series`, а не узлы и связи.

```json
{
  "chart": {
    "maxValue": 100,
    "metrics": [{ "id": "speed", "label": "Скорость" }],
    "series": [{ "name": "Вариант A", "values": { "speed": 75 } }]
  }
}
```

Для корректного многоугольника нужно минимум три метрики.

## 8. Bubble

Каждый узел является точкой:

```json
{
  "id": "p1",
  "name": "Проект A",
  "x": 25,
  "y": 70,
  "value": 40
}
```

`value` управляет размером пузыря.

## 9. Mind Map

Центральная идея и свободные ветви в обе стороны. Использует кривые связи и допускает псевдо-3D-взаимодействие.

## 10. Decision

Решения, случайные события и исходы. Рекомендуемые типы:

```text
decision, chance, outcome
```

## Переключение через API

```js
graph.run('set_diagram_type', { diagramType: 'fishbone' });
```

Загрузка примера выполняется кнопкой «Загрузить пример этого типа».
