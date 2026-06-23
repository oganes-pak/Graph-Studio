# 🧩 Graph Studio v8: полный справочник модулей

Документ объясняет ответственность каждого файла, его зависимости и публичные символы. Главный принцип: один модуль отвечает за одну область и не перескакивает через архитектурные слои.

## Схема зависимостей

```text
core / math / animation / render
              ↓
layouts / interaction
              ↓
engine
              ↓
ui / embed / model
              ↓
optional MCP transport
```

## Краткая таблица

| Файл | Строк | Назначение |
|---|---:|---|
| `index.html` | 313 | Полная административная страница: формы, вкладки, Canvas, всплывающие окна и загрузка editor.js. |
| `styles.css` | 240 | Все стили редактора, сцены, адаптивности, карточек и легенды. |
| `editor.js` | 3 | Минимальная точка входа, импортирующая app-controller.js. |
| `config.js` | 203 | Корневой совместимый экспорт конфигурации по умолчанию. |
| `3d-graph-engine.js` | 14 | Публичный facade: экспортирует движок и чистые функции одним модулем. |
| `graph-widget.js` | 5 | Публичный facade Web Component и mount-функции. |
| `embed.html` | 13 | Минимальная страница для iframe-встраивания. |
| `examples/embed-example.html` | 32 | Рабочий пример использования Web Component. |
| `src/core/default-config.js` | 204 | Единый источник всех стандартных параметров. |
| `src/core/graph-schema.js` | 125 | Валидация данных, канонический ключ связи, уровни и дерево графа. |
| `src/core/utils.js` | 62 | Общие чистые функции: clamp, deepMerge, seeded random, clone, перенос текста. |
| `src/math/projection.js` | 33 | Поворот 3D-точек, обратный поворот вектора и перспективная проекция. |
| `src/layouts/layouts.js` | 146 | Планетарная и hex-раскладки, а также устранение столкновений. |
| `src/animation/heart-pulse.js` | 44 | Форма двойного сердечного удара и задержка волны по уровням. |
| `src/render/organic-shapes.js` | 64 | Построение органического контура и каплевидных фигур Canvas. |
| `src/render/link-ribbon.js` | 132 | Геометрия сужающейся связи и потоковые штрихи. |
| `src/interaction/hit-test.js` | 28 | Расстояние до отрезка и поиск связи под указателем. |
| `src/engine/Graph3DEngine.js` | 1396 | Состояние сцены, камера, физика, события, интеракция и Canvas-рендеринг. |
| `src/ui/app-controller.js` | 899 | Главный контроллер UI: формы, вкладки, сохранение, импорт, консоль и режимы. |
| `src/ui/live-preview-controller.js` | 72 | Черновой предпросмотр, commit и rollback настроек. |
| `src/ui/link-editor-controller.js` | 197 | Контекстное редактирование связи при наведении. |
| `src/ui/node-info-controller.js` | 104 | DOM-карточка информации об узле. |
| `src/ui/overlay-manager.js` | 116 | Разводит всплывающие окна и исключает их пересечение. |
| `src/ui/legend-controller.js` | 95 | Рендерит и изменяет легенду. |
| `src/model/access-policy.js` | 26 | Определяет, какие команды разрешены в admin/viewer. |
| `src/model/ai-plan.js` | 122 | Нормализует, применяет и экспортирует декларативный JSON-план. |
| `src/model/tool-registry.js` | 149 | Описание и выполнение 13 атомарных команд. |
| `src/embed/graph-widget.js` | 210 | Custom Element graph-studio-widget с Shadow DOM и viewer/admin API. |
| `src/embed/mount.js` | 21 | Создаёт Web Component программно в указанном контейнере. |
| `model/graph-tools.json` | 351 | Машинное описание 13 команд и их JSON Schema. |
| `model/ai-plan-schema.json` | 56 | JSON Schema формата graph-studio/1. |
| `model/config-schema.json` | 237 | JSON Schema конфигурации. |
| `model/graph-prompts.json` | 14 | Шаблоны prompt-сценариев. |
| `model/graph-resources.json` | 10 | URI ресурсов Graph Studio для MCP. |
| `mcp/server.mjs` | 50 | MCP-sidecar на stdio: tools, resources и prompts. |
| `mcp/project-store.mjs` | 116 | Читает, проверяет и атомарно записывает JSON-проект. |
| `mcp/graph-project.json` | 93 | Демонстрационный/рабочий файл проекта MCP. |
| `mcp/package.json` | 16 | Зависимости и команды MCP-sidecar. |
| `scripts/check-project.mjs` | 108 | Статическая проверка файлов, импортов, JSON и синтаксиса. |
| `scripts/runtime-engine-check.mjs` | 52 | Запуск движка с поддельным Canvas для runtime-проверки. |
| `tests.html` | 31 | Страница запуска браузерных тестов. |
| `tests.js` | 296 | Набор браузерных DDT-тестов. |
| `package.json` | 10 | Метаданные основного статического проекта и команда проверки. |

## Подробное описание

### `index.html`

Полная административная страница: формы, вкладки, Canvas, всплывающие окна и загрузка editor.js.

- **Размер:** 313 строк.

### `styles.css`

Все стили редактора, сцены, адаптивности, карточек и легенды.

- **Размер:** 240 строк.

### `editor.js`

Минимальная точка входа, импортирующая app-controller.js.

- **Размер:** 3 строк.
- **Импорты:** `./src/ui/app-controller.js`.

### `config.js`

Корневой совместимый экспорт конфигурации по умолчанию.

- **Размер:** 203 строк.
- **Экспортируемые константы:** `DEFAULT_GRAPH_CONFIG`.

### `3d-graph-engine.js`

Публичный facade: экспортирует движок и чистые функции одним модулем.

- **Размер:** 14 строк.

### `graph-widget.js`

Публичный facade Web Component и mount-функции.

- **Размер:** 5 строк.

### `embed.html`

Минимальная страница для iframe-встраивания.

- **Размер:** 13 строк.
- **Импорты:** `./src/embed/graph-widget.js`.

### `examples/embed-example.html`

Рабочий пример использования Web Component.

- **Размер:** 32 строк.

### `src/core/default-config.js`

Единый источник всех стандартных параметров.

- **Размер:** 204 строк.
- **Экспортируемые константы:** `DEFAULT_GRAPH_CONFIG`.

### `src/core/graph-schema.js`

Валидация данных, канонический ключ связи, уровни и дерево графа.

- **Размер:** 125 строк.
- **Импорты:** `./utils.js`.
- **Функции:** `canonicalLinkKey()`, `validateGraphData()`, `getCoreId()`, `buildAdjacency()`, `buildLevels()`, `buildTree()`, `normalizeNodeType()`.

**Архитектурные правила:**
- Единое место правил ID, петель и дублей связей.
- A→B и B→A сводятся к одному canonical key.

### `src/core/utils.js`

Общие чистые функции: clamp, deepMerge, seeded random, clone, перенос текста.

- **Размер:** 62 строк.
- **Экспортируемые константы:** `TWO_PI`, `SQRT_3`.
- **Функции:** `clamp()`, `createSeededRandom()`, `isPlainObject()`, `cloneValue()`, `deepMerge()`, `pairKey()`, `wrapText()`.

### `src/math/projection.js`

Поворот 3D-точек, обратный поворот вектора и перспективная проекция.

- **Размер:** 33 строк.
- **Функции:** `rotatePoint3D()`, `inverseRotateVector()`, `projectPoint3D()`.

### `src/layouts/layouts.js`

Планетарная и hex-раскладки, а также устранение столкновений.

- **Размер:** 146 строк.
- **Импорты:** `../core/utils.js`, `../core/graph-schema.js`.
- **Функции:** `pointOnRing()`, `planetaryLayout()`, `axialSpiral()`, `hexLayout()`, `layoutGraph()`, `resolveCollisions()`.

### `src/animation/heart-pulse.js`

Форма двойного сердечного удара и задержка волны по уровням.

- **Размер:** 44 строк.
- **Импорты:** `../core/utils.js`.
- **Функции:** `gaussian()`, `normalizePhase()`, `heartBeat()`, `nodeHeartWave()`, `linkHeartWave()`.

### `src/render/organic-shapes.js`

Построение органического контура и каплевидных фигур Canvas.

- **Размер:** 64 строк.
- **Функции:** `buildOrganicBlobPath()`, `drawOrganicDrop()`, `midpoint()`.

### `src/render/link-ribbon.js`

Геометрия сужающейся связи и потоковые штрихи.

- **Размер:** 132 строк.
- **Импорты:** `../core/utils.js`.
- **Функции:** `buildLinkRibbonGeometry()`, `drawTaperedRibbon()`, `drawFlowStreak()`.

**Архитектурные правила:**
- Функции чистые относительно данных; рисование зависит только от переданного Canvas context.
- Геометрия отдельно от движка упрощает DDT-тесты.

### `src/interaction/hit-test.js`

Расстояние до отрезка и поиск связи под указателем.

- **Размер:** 28 строк.
- **Функции:** `pointToSegmentDistance()`, `findLinkAtPoint()`.

### `src/engine/Graph3DEngine.js`

Состояние сцены, камера, физика, события, интеракция и Canvas-рендеринг.

- **Размер:** 1396 строк.
- **Импорты:** `../core/default-config.js`, `../core/utils.js`, `../core/graph-schema.js`, `../layouts/layouts.js`, `../math/projection.js`, `../animation/heart-pulse.js`, `../interaction/hit-test.js`, `../render/organic-shapes.js`, `../render/link-ribbon.js`.
- **Классы:** `Graph3DEngine`.
- **Методы класса/контроллера:** `constructor()`, `setData()`, `setConfig()`, `updateConfig()`, `assertEditable()`, `setEditingLocked()`, `isEditingLocked()`, `setCameraAngles()`, `getState()`, `setLayout()`, `addNode()`, `updateNode()`, `removeNode()`, `addLink()`, `updateLink()`, `removeLink()`, `rebuildScene()`, `buildSpringPairs()`, `createParticles()`, `bindEvents()`, `normalizedLayoutType()`, `screenDeltaToWorld()`, `propagateImpulse()`, `impulseNeighbors()`, `shakeNode()`, `updateHover()`, `resize()`, `start()`, `pause()`, `resume()`, `togglePause()`, `resetCamera()`, `frame()`, `update()`, `updateCamera()`, `updatePhysics()`, `updateProjection()`, `renderOnce()`, `drawBackground()`, `drawParticles()`, `getActiveIds()`, `drawLinks()`, `drawNodes()`, `drawNodeLabel()`, `drawTooltip()`, `serializeNode()`, `serializeLink()`, `exportData()`, `dispatch()`, `destroy()`.

**Архитектурные правила:**
- Не должен искать элементы формы по ID.
- Общается с UI через публичные методы и CustomEvent.
- Внутренние nodes/links являются сценой, а data хранит сериализуемый проект.

### `src/ui/app-controller.js`

Главный контроллер UI: формы, вкладки, сохранение, импорт, консоль и режимы.

- **Размер:** 899 строк.
- **Импорты:** `../core/default-config.js`, `../core/utils.js`, `../engine/Graph3DEngine.js`, `./legend-controller.js`, `./link-editor-controller.js`, `./node-info-controller.js`, `./overlay-manager.js`, `./live-preview-controller.js`, `../model/tool-registry.js`, `../model/ai-plan.js`, `../model/access-policy.js`.
- **Функции:** `setStatus()`, `guard()`, `syncOutput()`, `syncOutputs()`, `fillForms()`, `motionPatch()`, `visualPatch()`, `refreshEditor()`, `connectionExists()`, `updateLinkFormAvailability()`, `fillLinkSelects()`, `renderLists()`, `renderEntityList()`, `renderLegendList()`, `updateLockUi()`, `setAppMode()`, `assertViewerToolAllowed()`, `assertAdminMode()`, `refreshConfigJson()`, `refreshAiPlan()`, `saveLocalProject()`, `loadLocalProject()`, `downloadJson()`, `outputConsole()`, `loadProjectSource()`, `scheduleMotionPreview()`, `scheduleVisualPreview()`, `toggleLock()`, `updateTelemetry()`, `boot()`.
- **Методы класса/контроллера:** `onStateChange()`, `run()`, `runBatch()`, `applyPlan()`, `setMode()`, `addNode()`, `addConnection()`, `updateConfig()`.

**Архитектурные правила:**
- Это самый крупный UI-модуль. Он собирает DOM, создаёт движок и связывает формы с API.
- Физические формулы в этот файл добавлять нельзя.

### `src/ui/live-preview-controller.js`

Черновой предпросмотр, commit и rollback настроек.

- **Размер:** 72 строк.
- **Импорты:** `../core/utils.js`.
- **Классы:** `LivePreviewController`.
- **Методы класса/контроллера:** `preview()`, `commit()`, `rollback()`, `syncCommitted()`, `isDirty()`, `emit()`.

**Архитектурные правила:**
- Transient-изменение видно на Canvas, но не считается сохранённым.
- Commit фиксирует патч, rollback возвращает snapshot.

### `src/ui/link-editor-controller.js`

Контекстное редактирование связи при наведении.

- **Размер:** 197 строк.
- **Импорты:** `../core/utils.js`.
- **Классы:** `LinkEditorController`.
- **Функции:** `normalizeColor()`, `samePair()`.
- **Методы класса/контроллера:** `constructor()`, `isAdminMode()`, `handleHover()`, `show()`, `currentPatch()`, `schedulePreview()`, `scheduleHide()`, `hide()`, `restoreOriginal()`, `cancel()`, `save()`, `remove()`, `destroy()`.

### `src/ui/node-info-controller.js`

DOM-карточка информации об узле.

- **Размер:** 104 строк.
- **Классы:** `NodeInfoController`.
- **Функции:** `humanType()`, `clamp()`.
- **Методы класса/контроллера:** `constructor()`, `handleHover()`, `show()`, `scheduleHide()`, `hide()`, `destroy()`.

### `src/ui/overlay-manager.js`

Разводит всплывающие окна и исключает их пересечение.

- **Размер:** 116 строк.
- **Классы:** `OverlayManager`.
- **Функции:** `intersectionArea()`, `clamp()`.
- **Методы класса/контроллера:** `constructor()`, `register()`, `open()`, `close()`, `isOpen()`, `positionAround()`, `getExclusionRects()`.

### `src/ui/legend-controller.js`

Рендерит и изменяет легенду.

- **Размер:** 95 строк.
- **Импорты:** `../core/utils.js`.
- **Классы:** `LegendController`.
- **Методы класса/контроллера:** `constructor()`, `render()`, `setEnabled()`, `setTitle()`, `setPosition()`, `addItem()`, `updateItem()`, `removeItem()`, `destroy()`.

### `src/model/access-policy.js`

Определяет, какие команды разрешены в admin/viewer.

- **Размер:** 26 строк.
- **Экспортируемые константы:** `VIEWER_ALLOWED_TOOLS`.
- **Функции:** `isToolAllowedInMode()`, `assertToolAllowedInMode()`, `assertAdminMode()`.

### `src/model/ai-plan.js`

Нормализует, применяет и экспортирует декларативный JSON-план.

- **Размер:** 122 строк.
- **Импорты:** `../core/utils.js`, `../core/graph-schema.js`.
- **Экспортируемые константы:** `AI_PLAN_FORMAT`, `AI_PLAN_TEMPLATE`.
- **Функции:** `normalizeAiPlan()`, `applyAiPlan()`, `exportAiPlan()`.

### `src/model/tool-registry.js`

Описание и выполнение 13 атомарных команд.

- **Размер:** 149 строк.
- **Импорты:** `../core/utils.js`.
- **Экспортируемые константы:** `GRAPH_TOOL_DEFINITIONS`.
- **Функции:** `executeGraphTool()`, `tool()`, `normalizeConnection()`, `requireLegend()`.

**Архитектурные правила:**
- Имена команд являются стабильным машинным API.
- Новый транспорт должен переиспользовать этот словарь, а не создавать альтернативные имена.

### `src/embed/graph-widget.js`

Custom Element graph-studio-widget с Shadow DOM и viewer/admin API.

- **Размер:** 210 строк.
- **Импорты:** `../engine/Graph3DEngine.js`, `../core/default-config.js`, `../core/utils.js`, `../ui/legend-controller.js`, `../ui/overlay-manager.js`, `../ui/node-info-controller.js`, `../model/tool-registry.js`, `../model/ai-plan.js`, `../model/access-policy.js`.
- **Классы:** `GraphStudioWidget`.
- **Методы класса/контроллера:** `constructor()`, `connectedCallback()`, `disconnectedCallback()`, `attributeChangedCallback()`, `renderShell()`, `bindControls()`, `applyMode()`, `updateControlsVisibility()`, `configureRefreshTimer()`, `loadSource()`, `setData()`, `getData()`, `getProject()`, `updateConfig()`, `setMode()`, `executeTool()`, `listTools()`, `applyPlan()`, `exportPlan()`, `handleMessage()`, `handleAction()`.

### `src/embed/mount.js`

Создаёт Web Component программно в указанном контейнере.

- **Размер:** 21 строк.
- **Импорты:** `./graph-widget.js`.
- **Функции:** `mountGraphStudio()`.

### `model/graph-tools.json`

Машинное описание 13 команд и их JSON Schema.

- **Размер:** 351 строк.

### `model/ai-plan-schema.json`

JSON Schema формата graph-studio/1.

- **Размер:** 56 строк.

### `model/config-schema.json`

JSON Schema конфигурации.

- **Размер:** 237 строк.

### `model/graph-prompts.json`

Шаблоны prompt-сценариев.

- **Размер:** 14 строк.

### `model/graph-resources.json`

URI ресурсов Graph Studio для MCP.

- **Размер:** 10 строк.

### `mcp/server.mjs`

MCP-sidecar на stdio: tools, resources и prompts.

- **Размер:** 50 строк.
- **Импорты:** `node:fs/promises`, `node:path`, `node:url`, `@modelcontextprotocol/sdk/server/mcp.js`, `@modelcontextprotocol/sdk/server/stdio.js`, `zod/v4`, `./project-store.mjs`.
- **Функции:** `register()`, `normalizeConnection()`, `samePair()`, `main()`.

**Архитектурные правила:**
- Пишет служебные сообщения только в stderr, чтобы не ломать stdio transport.
- Не импортирует Canvas или DOM.

### `mcp/project-store.mjs`

Читает, проверяет и атомарно записывает JSON-проект.

- **Размер:** 116 строк.
- **Импорты:** `node:fs/promises`, `node:path`, `node:url`.
- **Классы:** `ProjectStore`.
- **Экспортируемые константы:** `DEFAULT_PROJECT_PATH`.
- **Функции:** `validateProjectShape()`, `mergeObjects()`, `isPlainObject()`, `canonicalPair()`.
- **Методы класса/контроллера:** `constructor()`, `ensure()`, `read()`, `write()`, `mutate()`.

### `mcp/graph-project.json`

Демонстрационный/рабочий файл проекта MCP.

- **Размер:** 93 строк.

### `mcp/package.json`

Зависимости и команды MCP-sidecar.

- **Размер:** 16 строк.

### `scripts/check-project.mjs`

Статическая проверка файлов, импортов, JSON и синтаксиса.

- **Размер:** 108 строк.
- **Импорты:** `node:fs/promises`, `node:fs`, `node:path`, `node:child_process`, `node:url`.
- **Функции:** `walk()`, `fail()`, `relative()`.

### `scripts/runtime-engine-check.mjs`

Запуск движка с поддельным Canvas для runtime-проверки.

- **Размер:** 52 строк.
- **Классы:** `FakeContext`, `FakeCanvas`.
- **Методы класса/контроллера:** `constructor()`, `measureText()`, `createRadialGradient()`, `getContext()`, `getBoundingClientRect()`, `setPointerCapture()`, `releasePointerCapture()`, `focus()`.

### `tests.html`

Страница запуска браузерных тестов.

- **Размер:** 31 строк.

### `tests.js`

Набор браузерных DDT-тестов.

- **Размер:** 296 строк.
- **Импорты:** `./config.js`, `./3d-graph-engine.js`.
- **Функции:** `test()`, `assert()`, `equal()`, `near()`, `throws()`, `run()`.

### `package.json`

Метаданные основного статического проекта и команда проверки.

- **Размер:** 10 строк.

## Что считается публичным API

Публичными являются экспорты из `3d-graph-engine.js`, `graph-widget.js`, методы `Graph3DEngine`, методы Web Component и команды из `GRAPH_TOOL_DEFINITIONS`. Всё остальное следует считать внутренней реализацией, даже если JavaScript технически позволяет до неё добраться.

## Где добавлять новую функцию

| Новая задача | Правильный модуль |
|---|---|
| Новая формула или векторная операция | `src/math/` |
| Новая раскладка | `src/layouts/` |
| Новый визуальный примитив Canvas | `src/render/` |
| Новая анимационная фаза | `src/animation/` |
| Новое правило данных | `src/core/graph-schema.js` |
| Новый метод сцены | `src/engine/Graph3DEngine.js` |
| Новая форма или кнопка | `src/ui/` |
| Новая команда ИИ | `src/model/tool-registry.js` + JSON Schema |
| Новый способ встраивания | `src/embed/` |
| Новый MCP transport/tool mapping | `mcp/` |
