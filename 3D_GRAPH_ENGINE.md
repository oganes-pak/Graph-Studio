# Graph3DEngine v8

## Создание

```js
import { Graph3DEngine, DEFAULT_GRAPH_CONFIG } from './3d-graph-engine.js';

const engine = new Graph3DEngine({
  canvas: document.querySelector('canvas'),
  config: DEFAULT_GRAPH_CONFIG,
  data: { nodes: [], links: [] }
});
engine.start();
```

## Данные

```js
{
  nodes: [{ id, name, type, description?, color?, size? }],
  links: [{ source, target, label?, description?, color?, width? }]
}
```

## Публичные методы

- `setData(data, options)`;
- `addNode(node, parentId?)`;
- `updateNode(id, changes)`;
- `removeNode(id)`;
- `addLink(link)`;
- `updateLink(source, target, changes)`;
- `removeLink(source, target)`;
- `setLayout('planetary' | 'hex')`;
- `updateConfig(changes)`;
- `setCameraAngles(x, y)`;
- `setEditingLocked(boolean)`;
- `start()`, `pause()`, `resume()`, `destroy()`.

## События Canvas

- `graph:datachange`;
- `graph:configchange`;
- `graph:hoverchange`;
- `graph:lockchange`.

UI должен подписываться на события, а не читать внутренние массивы сцены.
