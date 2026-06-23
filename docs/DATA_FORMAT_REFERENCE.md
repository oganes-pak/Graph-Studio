# 🧠 Graph Studio v8: форматы данных

## 1. Внутренний формат движка

```json
{
  "nodes": [],
  "links": []
}
```

### Узел

```json
{
  "id": "core",
  "name": "Главная тема",
  "type": "core",
  "description": "Подробности",
  "color": "#263846",
  "size": 25
}
```

#### Ограничения

- `id` обязателен;
- `id` должен быть строкой;
- `id` не должен быть пустым;
- `id` должен быть уникальным;
- рекомендованный шаблон ID: `[A-Za-zА-Яа-яЁё0-9_-]+`;
- `size` рекомендуется держать в диапазоне 3–100;
- `color` для машинного ввода ожидается как `#RRGGBB`.

### Связь

```json
{
  "source": "core",
  "target": "branch",
  "label": "содержит",
  "description": "Связь главной темы с разделом",
  "color": "#8699a7",
  "width": 3
}
```

#### Ограничения

- `source` и `target` обязательны;
- оба ID должны существовать;
- `source` не может равняться `target`;
- пара узлов должна быть уникальной;
- направление не создаёт новую пару;
- ширина рекомендуется в диапазоне 0.5–20.

---

## 2. Полный экспорт редактора

```json
{
  "nodes": [],
  "links": [],
  "config": {}
}
```

Это результат `engine.exportData()`.

---

## 3. Файловый проект MCP

```json
{
  "version": "8.0.0",
  "data": {
    "nodes": [],
    "links": []
  },
  "config": {}
}
```

Файл хранится по умолчанию в:

```text
mcp/graph-project.json
```

Путь можно заменить переменной окружения `GRAPH_PROJECT_FILE`.

---

## 4. JSON-план для ИИ

Формат:

```text
graph-studio/1
```

Пример:

```json
{
  "format": "graph-studio/1",
  "title": "Карта проекта",
  "nodes": [
    {
      "id": "core",
      "name": "Проект",
      "type": "core"
    },
    {
      "id": "scope",
      "name": "Содержание",
      "type": "group"
    }
  ],
  "connections": [
    {
      "from": "core",
      "to": "scope",
      "label": "включает"
    }
  ],
  "view": {
    "layout": "planetary",
    "mode": "admin",
    "legend": {
      "enabled": true,
      "title": "Обозначения",
      "items": []
    },
    "appearance": {}
  }
}
```

### Отличия от внутреннего формата

| JSON-план | Внутренний формат |
|---|---|
| `connections` | `links` |
| `from` | `source` |
| `to` | `target` |
| `view.layout` | `config.layout.type` |
| `view.mode` | `config.editor.mode` |

`normalizeAiPlan()` преобразует один формат в другой.

---

## 5. Легенда

```json
{
  "enabled": true,
  "title": "Легенда",
  "position": "top-right",
  "items": [
    {
      "id": "core",
      "label": "Ядро",
      "color": "#263846",
      "shape": "circle"
    }
  ]
}
```

Допустимые формы:

```text
circle
square
diamond
```

Допустимые позиции:

```text
top-right
top-left
bottom-right
bottom-left
```

---

## 6. Атомарная команда

Логическая структура вызова:

```json
{
  "tool": "add_node",
  "input": {
    "id": "n1",
    "name": "Узел 1",
    "type": "node"
  }
}
```

В браузере:

```js
graph.run('add_node', {
  id: 'n1',
  name: 'Узел 1',
  type: 'node'
});
```

Пакет:

```json
[
  {
    "tool": "add_node",
    "input": {
      "id": "core",
      "name": "Тема",
      "type": "core"
    }
  },
  {
    "tool": "add_node",
    "input": {
      "id": "a",
      "name": "Ветка A",
      "type": "group"
    }
  },
  {
    "tool": "add_connection",
    "input": {
      "from": "core",
      "to": "a"
    }
  }
]
```

---

## 7. postMessage

Запрос:

```json
{
  "channel": "graph-studio",
  "widgetId": "my-graph",
  "requestId": "req-1",
  "tool": "get_project",
  "arguments": {}
}
```

Ответ:

```json
{
  "channel": "graph-studio",
  "widgetId": "my-graph",
  "requestId": "req-1",
  "ok": true,
  "result": {}
}
```

Ошибка:

```json
{
  "channel": "graph-studio",
  "widgetId": "my-graph",
  "requestId": "req-1",
  "ok": false,
  "error": "Описание ошибки"
}
```

Для приёма сообщений Web Component требует явный `allowed-origin`.

---

## 8. Схемы

| Файл | Назначение |
|---|---|
| `model/ai-plan-schema.json` | Проверка JSON-плана |
| `model/config-schema.json` | Проверка конфигурации |
| `model/graph-tools.json` | Описание инструментов |
| `model/graph-resources.json` | URI ресурсов MCP |
| `model/graph-prompts.json` | Prompt-шаблоны |

---

## 9. Рекомендуемый порядок для ИИ

```text
1. Определить центральное понятие.
2. Создать один core.
3. Выделить крупные группы.
4. Создать дочерние узлы.
5. Проверить уникальность ID.
6. Добавить связи только между существующими ID.
7. Проверить отсутствие обратных дублей.
8. Выбрать раскладку.
9. Вернуть JSON без комментариев вне объекта.
```
