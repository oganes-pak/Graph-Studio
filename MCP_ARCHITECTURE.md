# Graph Studio v8 и MCP

MCP является необязательным транспортом. Браузерная версия не зависит от MCP.

## Один словарь операций

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

Те же имена доступны:

- `window.graph.run(name, input)`;
- Web Component `executeTool(name, input)`;
- postMessage bridge;
- MCP-sidecar.

## Resources

- `graphstudio://project/current`;
- `graphstudio://contracts/tools`;
- `graphstudio://contracts/ai-plan`;
- `graphstudio://modules/map`.

## Рекомендуемый цикл слабой модели

```text
get_project → проверить id и read-only → одна команда → get_project → проверить результат
```

Для полной новой структуры предпочтителен JSON-план `graph-studio/1`, а не
серия десятков вызовов.
