# Graph Studio v8: карта модулей

## Разрешённое направление зависимостей

```text
core, math, animation, render
              ↓
      layouts, interaction
              ↓
            engine
              ↓
       ui, embed, model
              ↓
        optional mcp sidecar
```

## Основные модули

| Модуль | Ответственность | Не должен знать |
|---|---|---|
| `src/core/default-config.js` | Значения по умолчанию | DOM, Canvas, MCP |
| `src/core/graph-schema.js` | Проверка узлов и связей | UI |
| `src/layouts/layouts.js` | Паутина и соты | Формы и легенда |
| `src/animation/heart-pulse.js` | Фазы сердечного импульса | Цвета и DOM |
| `src/render/organic-shapes.js` | Органические Canvas-пути | Данные графа |
| `src/engine/Graph3DEngine.js` | Сцена, физика, камера, рендер | Формы, MCP |
| `src/ui/overlay-manager.js` | Разведение всплывающих окон | Данные графа |
| `src/ui/node-info-controller.js` | Информационная карточка | Редактирование |
| `src/ui/link-editor-controller.js` | Редактирование одной связи | Внутренние массивы движка |
| `src/model/ai-plan.js` | Формат `graph-studio/1` | Canvas |
| `src/model/tool-registry.js` | Простые атомарные команды | Конкретный транспорт |
| `src/embed/graph-widget.js` | Web Component | Административная панель |
| `mcp/server.mjs` | Необязательный MCP transport | Canvas и DOM |

## Правило изменений

Новая функция сначала получает отдельный чистый модуль или публичный метод.
Только затем для неё добавляется UI. Формы не должны содержать физику, а
движок не должен искать HTML-элементы по id.

## Дополнения v8

### `src/render/link-ribbon.js`

Чистая геометрия сужающейся связи и потоковых штрихов. Не зависит от DOM,
движка или интерфейса и тестируется числовыми входами.

### `src/ui/live-preview-controller.js`

Разделяет временный предпросмотр и фиксацию конфигурации. В каждый момент
активен только один черновой раздел, чтобы применение одного набора настроек
не сохранило случайно другой незавершённый набор.
