# 🧰 Graph Studio v8: API-справочник

## 1. Импорт

```js
import {
  Graph3DEngine,
  DEFAULT_GRAPH_CONFIG,
  validateGraphData,
  layoutGraph,
  projectPoint3D
} from './3d-graph-engine.js';
```

## 2. Создание `Graph3DEngine`

```js
const engine = new Graph3DEngine({
  canvas,
  config,
  data
});
```

| Параметр | Тип | Обязательный | Назначение |
|---|---|---:|---|
| `canvas` | `HTMLCanvasElement` | да | Поверхность Canvas 2D |
| `config` | object | нет | Частичная конфигурация поверх `DEFAULT_GRAPH_CONFIG` |
| `data` | object | нет | `{ nodes, links }` |

Конструктор:

1. проверяет Canvas;
2. получает контекст 2D;
3. объединяет конфигурацию;
4. создаёт состояние камеры;
5. создаёт состояние указателя;
6. подключает `ResizeObserver`;
7. подключает события;
8. при наличии данных вызывает `setData()`.

---

## 3. Методы данных

### `setData(data, options?)`

Полностью заменяет узлы и связи.

```js
engine.setData(
  { nodes, links },
  {
    force: false,
    transient: false
  }
);
```

- `force` обходит блокировку редактирования. Используется внутренними административными или embed-механизмами.
- `transient` помечает изменение как черновой предпросмотр.
- Перед записью вызывается `validateGraphData()`.
- После записи вызывается `rebuildScene(true)`.
- Затем отправляется `graph:datachange`.

### `addNode(node, parentId?)`

```js
engine.addNode({
  id: 'node_1',
  name: 'Новый узел',
  type: 'node'
});
```

Если передать `parentId`, метод одновременно создаст связь с родителем.

### `updateNode(id, patch)`

```js
engine.updateNode('node_1', {
  name: 'Изменённое название',
  color: '#556677'
});
```

ID сохраняется неизменным.

### `removeNode(id)`

Удаляет узел и все связи, в которых он является `source` или `target`.

---

## 4. Методы связей

### `addLink(link, options?)`

```js
engine.addLink({
  source: 'core',
  target: 'node_1',
  label: 'содержит',
  width: 4
});
```

Метод запрещает:

- связь с самим собой;
- отсутствующие узлы;
- повтор пары;
- обратный дубль.

### `updateLink(source, target, patch, options?)`

```js
engine.updateLink('core', 'node_1', {
  label: 'включает',
  color: '#778899',
  width: 6
});
```

Поиск выполняется независимо от направления пары.

### `removeLink(source, target, options?)`

```js
engine.removeLink('core', 'node_1');
```

---

## 5. Конфигурация

### `setConfig(config, options?)`

Полностью формирует конфигурацию заново поверх значений по умолчанию.

```js
engine.setConfig(config, {
  preserveCamera: true,
  force: false,
  transient: false
});
```

### `updateConfig(patch, options?)`

Частично обновляет конфигурацию.

```js
engine.updateConfig({
  particles: { enabled: false },
  camera: { autoRotate: true }
}, {
  rebuild: 'auto',
  force: false,
  transient: false
});
```

`rebuild`:

- `true` — всегда перестраивать сцену;
- `false` — не перестраивать;
- `'auto'` — перестраивать при изменении `layout`, `physics`, `node`, `colors`.

### `setLayout(type)`

```js
engine.setLayout('planetary');
engine.setLayout('hex');
```

Legacy-значение `grid` нормализуется в `hex`.

---

## 6. Блокировка

### `setEditingLocked(locked)`

```js
engine.setEditingLocked(true);
```

При блокировке:

- методы изменения выбрасывают ошибку;
- перетаскивание узла прекращается;
- камера может продолжить работать в зависимости от конфигурации.

### `isEditingLocked()`

```js
const locked = engine.isEditingLocked();
```

---

## 7. Камера

### `setCameraAngles(angleX, angleY, options?)`

Углы передаются в радианах.

```js
engine.setCameraAngles(0.15, 0.5, {
  immediate: false
});
```

- X ограничивается безопасным диапазоном.
- Y может свободно накапливаться.
- При `immediate: true` текущие и целевые углы меняются одновременно.

### `resetCamera()`

Возвращает камеру к значениям из конфигурации.

### `getState()`

```js
const state = engine.getState();
```

Возвращает:

```js
{
  paused,
  layout,
  nodeCount,
  linkCount,
  editingLocked,
  hoveredNodeId,
  hoveredLinkId,
  camera: {
    angleX,
    angleY,
    targetAngleX,
    targetAngleY,
    velocityX,
    velocityY,
    zoom,
    targetZoom,
    autoRotate,
    autoRotateSpeed
  },
  fps
}
```

---

## 8. Анимационный цикл

### `start()`

Запускает render loop и снимает паузу.

### `pause()`

Останавливает запрос новых кадров, сохраняя сцену.

### `resume()`

Продолжает цикл.

### `togglePause()`

Меняет состояние паузы.

### `renderOnce()`

Рисует один кадр. Используется при изменениях в остановленном состоянии.

### `destroy()`

Обязательно вызывать при удалении виджета.

Метод:

- останавливает цикл;
- отменяет обработчики через `AbortController`;
- отключает `ResizeObserver`;
- очищает массивы и Map.

---

## 9. Интеракция и физика

### `shakeNode(id, strength?)`

```js
engine.shakeNode('node_1', 80);
```

Создаёт импульс узлу и его соседям.

### `resize()`

Синхронизирует CSS-размер Canvas, backing store и DPR.

### Внутренние методы

Следующие методы являются реализацией движка, а не стабильным публичным API:

- `rebuildScene()`;
- `buildSpringPairs()`;
- `createParticles()`;
- `bindEvents()`;
- `updatePhysics()`;
- `updateProjection()`;
- `drawBackground()`;
- `drawLinks()`;
- `drawNodes()`;
- `drawNodeLabel()`.

Использовать их напрямую снаружи не рекомендуется.

---

## 10. Экспорт

### `exportData()`

```js
const project = engine.exportData();
```

Возвращает сериализуемый объект:

```js
{
  nodes,
  links,
  config
}
```

---

## 11. События Canvas

```js
canvas.addEventListener('graph:datachange', handler);
```

| Событие | `detail` | Назначение |
|---|---|---|
| `graph:datachange` | экспорт проекта + transient | Изменены узлы или связи |
| `graph:configchange` | конфигурация + transient | Изменены настройки |
| `graph:hoverchange` | `{ node, link, x, y }` | Изменился объект наведения |
| `graph:linkactivate` | `{ link }` | Пользователь активировал связь |
| `graph:lockchange` | `{ locked }` | Изменилась блокировка |
| `graph:statechange` | `{ paused }` и состояние | Изменилась пауза/состояние |

---

## 12. Web Component

### Подключение

```html
<script type="module" src="/graph-studio/graph-widget.js"></script>
<graph-studio-widget id="graph"></graph-studio-widget>
```

### Атрибуты

| Атрибут | Назначение |
|---|---|
| `src` | URL JSON-проекта |
| `height` | Высота компонента |
| `mode` | `viewer` или `admin` |
| `locked` | Принудительная блокировка |
| `layout` | `planetary` или `hex` |
| `controls` | Показывать toolbar |
| `refresh-interval` | Период повторной загрузки `src`, минимум 1000 мс |
| `allowed-origin` | Разрешённый origin для `postMessage` |

### Методы Web Component

```js
widget.setData(data);
widget.getData();
widget.getProject();
widget.updateConfig(patch);
widget.setMode('viewer');
widget.executeTool(name, args);
widget.listTools();
widget.applyPlan(plan);
widget.exportPlan(title);
```

### События Web Component

| Событие | Назначение |
|---|---|
| `graph-ready` | Компонент создан и движок запущен |
| `graph-load` | JSON из `src` успешно загружен |
| `graph-error` | Ошибка загрузки или обработки |

---

## 13. `mountGraphStudio()`

```js
import { mountGraphStudio } from './graph-widget.js';

const widget = mountGraphStudio('#host', {
  id: 'project-map',
  src: '/data/project.json',
  height: '620px',
  layout: 'planetary',
  mode: 'viewer',
  locked: true,
  controls: true,
  allowedOrigin: 'https://example.com',
  refreshInterval: 5000,
  data: null
});
```

Функция создаёт `<graph-studio-widget>`, заполняет атрибуты, добавляет его в контейнер и возвращает элемент.

---

## 14. Атомарные команды

```js
executeGraphTool(engine, name, args, context);
```

В приложении доступна обёртка:

```js
graph.run(name, input);
```

Полный список:

```text
get_project
replace_graph
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

---

## 15. Чистые функции facade

`3d-graph-engine.js` дополнительно экспортирует:

```js
clamp
createSeededRandom
cloneValue
deepMerge
validateGraphData
buildLevels
canonicalLinkKey
layoutGraph
resolveCollisions
planetaryLayout
hexLayout
rotatePoint3D
projectPoint3D
heartBeat
nodeHeartWave
linkHeartWave
pointToSegmentDistance
findLinkAtPoint
buildLinkRibbonGeometry
drawTaperedRibbon
drawFlowStreak
```

Их можно тестировать без создания полного UI.
