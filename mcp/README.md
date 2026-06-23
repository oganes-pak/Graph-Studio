# Graph Studio v13 MCP sidecar

Необязательный локальный сервер для управления проектом через те же 15 команд, что доступны в браузере.

## Запуск

```powershell
npm install
npm start
```

## Файл проекта

По умолчанию используется `graph-project.json`.

```powershell
$env:GRAPH_PROJECT_FILE = "D:\graphs\project.json"
npm start
```

## Особенности v13

- 11 визуальных режимов;
- команды `set_diagram_type` и `set_chart_data`;
- мягкая нормализация импорта;
- объединение повторных связей при `replace_graph`;
- строгий запрет дублей при `add_connection`;
- формат `graph-studio/3`.
