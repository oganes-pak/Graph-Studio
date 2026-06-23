# Graph Studio v8 MCP sidecar

MCP необязателен. Без него используются `graph.run()` и JSON-план.

## Запуск

```powershell
cd mcp
npm install
npm start
```

Другой файл проекта:

```powershell
$env:GRAPH_PROJECT_FILE = "D:\graphs\project.json"
npm start
```

Sidecar публикует те же короткие команды, что браузерный API. Логи идут только
в stderr, чтобы не повредить stdio JSON-RPC.
