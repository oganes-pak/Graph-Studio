# Graph Studio v8: инструкция для ИИ

## Рекомендуемый способ без MCP

Вернуть один JSON-объект формата `graph-studio/1`:

```json
{
  "format": "graph-studio/1",
  "title": "Структура проекта",
  "nodes": [
    { "id": "core", "name": "Проект", "type": "core" },
    { "id": "goals", "name": "Цели", "type": "group" },
    { "id": "goal_1", "name": "Первая цель", "type": "node" }
  ],
  "connections": [
    { "from": "core", "to": "goals", "label": "содержит" },
    { "from": "goals", "to": "goal_1" }
  ],
  "view": {
    "layout": "planetary",
    "mode": "admin"
  }
}
```

## Правила построения

1. Использовать одно ядро `type: "core"`.
2. Использовать короткие стабильные `id` без пробелов.
3. Сначала перечислить все узлы, затем связи.
4. Каждая связь ссылается только на существующие `id`.
5. Не придумывать положительную или отрицательную оценку.
6. Название узла должно быть коротким, подробности помещаются в `description`.
7. Для иерархии использовать `core → group → node`.
8. Для сетевой структуры допускаются дополнительные связи между узлами.

## Атомарные команды

Они доступны без MCP:

```js
graph.run('get_project')
graph.run('add_node', { id: 'n1', name: 'Узел 1', type: 'node' })
graph.run('change_node', { id: 'n1', changes: { name: 'Новое имя' } })
graph.run('delete_node', { id: 'n1' })
graph.run('add_connection', { from: 'core', to: 'n1' })
graph.run('change_connection', { from: 'core', to: 'n1', changes: { label: 'включает' } })
graph.run('delete_connection', { from: 'core', to: 'n1' })
graph.run('set_layout', { layout: 'hex' })
graph.run('change_view', { changes: { particles: { enabled: false } } })
graph.run('set_read_only', { enabled: true })
```

Пакет команд:

```js
graph.runBatch([
  { "tool": "add_node", "input": { "id": "core", "name": "Тема", "type": "core" } },
  { "tool": "add_node", "input": { "id": "a", "name": "Раздел A", "type": "group" } },
  { "tool": "add_connection", "input": { "from": "core", "to": "a" } }
])
```

## Выбор подхода

- Полная новая структура: JSON-план.
- Одно точечное изменение: атомарная команда.
- MCP доступен: использовать те же имена команд через sidecar.
- MCP недоступен: использовать `graph.run()` или импорт JSON-плана.

## Правило уникальности связи v8

Перед `add_connection` проверьте, нет ли уже связи между этой парой узлов.
`A → B` и `B → A` считаются одной связью. Для изменения существующей пары
используйте `change_connection`, а не второй вызов `add_connection`.
