# Graph3DEngine v9

## Назначение

`src/engine/Graph3DEngine.js` хранит состояние сцены, камеру, физику, hit-test и Canvas-отрисовку.
Он не отвечает за формы редактора, MCP или хранение файла.

## Основные методы

```js
engine.setData({ nodes, links, chart });
engine.setConfig(config);
engine.updateConfig(patch);
engine.setDiagramType('fishbone');
engine.setChartData(chart);
engine.setLayout('hex');
engine.addNode(node);
engine.addLink(link);
engine.updateNode(id, patch);
engine.updateLink(from, to, patch);
engine.removeNode(id);
engine.removeLink(from, to);
engine.exportData();
engine.destroy();
```

## Типы диаграмм

Выбор выполняет реестр `src/diagrams/registry.js`. Раскладки находятся в `src/layouts/strategies`, специализированная отрисовка в `src/render/diagrams`.

## Строгая и мягкая проверка

`Graph3DEngine.setData()` использует строгую `validateGraphData()` и отклоняет дубль связи. Импорт обязан сначала вызвать `normalizeProjectImport()`.
