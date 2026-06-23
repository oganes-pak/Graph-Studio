GRAPH STUDIO v8
===============

КАК ИСПОЛЬЗОВАТЬ
----------------
1. Редактор администратора: http://localhost:8080/
2. Локальный предпросмотр модуля: кнопка «Предпросмотр» внутри редактора.
3. Встраивание на сайт: graph-widget.js + <graph-studio-widget>.
4. iframe-обёртка для простых CMS: embed.html?src=/data/project.json

ПРИМЕР МОДУЛЯ
-------------
<script type="module" src="/graph-studio/graph-widget.js"></script>
<graph-studio-widget
  src="/data/project.json"
  mode="viewer"
  height="620px"
  controls>
</graph-studio-widget>

DOCKER
------
docker build --no-cache -t graph-manual:v8 .
docker run --rm --name graph-manual-v8 -p 8080:80 graph-manual:v8

ВАЖНО В v8
-----------
- связь между одной парой узлов создаётся только один раз;
- настройки показываются сразу, но сохраняются только после «Применить»;
- поток по ветвям рисуется штрихами с хвостом, а не мини-узлами;
- толщина связи сужается у маленького узла;
- режим просмотра предназначен для Web Component/iframe, а не для отдельной темы сайта.
