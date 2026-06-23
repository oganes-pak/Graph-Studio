# Встраивание Graph Studio v9

## Web Component

```html
<script type="module" src="/graph-studio/graph-widget.js"></script>

<graph-studio-widget
  src="/data/project.json"
  diagram-type="mindmap"
  mode="viewer"
  height="620px"
  controls>
</graph-studio-widget>
```

`diagram-type` может принимать любой из десяти ID. Если JSON содержит `diagramType`, импортированный проект переопределяет начальный атрибут.

## Императивный helper

```js
import { mountGraphStudio } from '/graph-studio/graph-widget.js';

const widget = mountGraphStudio('#host', {
  src: '/data/project.json',
  diagramType: 'sankey',
  mode: 'viewer',
  height: '620px',
  controls: true
});
```

## Iframe

```html
<iframe
  src="/graph-studio/embed.html?src=/data/project.json"
  title="Диаграмма"
  style="width:100%;height:620px;border:0">
</iframe>
```

Основной редактор остаётся административным модулем. Публикация выполняется через Web Component или iframe, а не через отдельную тему сайта.

## Встраивание информационной панели v12

```html
<graph-studio-widget
  src="/data/report.json"
  diagram-type="info"
  mode="viewer"
  height="720px">
</graph-studio-widget>
```

В режиме `info` Web Component скрывает Canvas и показывает прокручиваемый DOM-документ внутри Shadow DOM.
