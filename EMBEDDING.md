# Встраивание Graph Studio v8

## Web Component, режим просмотра по умолчанию

```html
<script type="module" src="/graph-studio/graph-widget.js"></script>

<graph-studio-widget
  src="/data/project.json"
  height="620px"
  mode="viewer"
  controls>
</graph-studio-widget>
```

## JavaScript

```html
<div id="graph"></div>
<script type="module">
  import { mountGraphStudio } from '/graph-studio/graph-widget.js';

  const widget = mountGraphStudio('#graph', {
    src: '/data/project.json',
    height: '620px',
    mode: 'viewer',
    controls: true
  });
</script>
```

## iframe

```html
<iframe
  src="/graph-studio/embed.html?src=/data/project.json&controls=true"
  title="Граф связей"
  style="width:100%;height:620px;border:0">
</iframe>
```

## Обновление данных владельцем сайта

```js
const widget = document.querySelector('graph-studio-widget');
widget.setData({ nodes, links });
widget.updateConfig({ legend: { enabled: false } });
```

Посетитель viewer-компонента не получает административную панель. Владелец
страницы может обновлять данные через публичный API компонента.

## v8: просмотр является модулем

Не требуется формировать URL отдельной viewer-темы. Для сайта используйте
`<graph-studio-widget mode="viewer">`; для CMS без поддержки Web Components
используйте `embed.html?src=...` внутри iframe.
