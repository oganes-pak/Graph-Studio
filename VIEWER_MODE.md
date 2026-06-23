# Просмотр как встраиваемый модуль

Graph Studio v8 не требует отдельной «страницы просмотра». Администратор
настраивает граф в редакторе, а посетитель получает встроенный модуль.

## Предпросмотр администратора

Кнопка **«Предпросмотр»** временно скрывает редактор в текущей вкладке.
Она не создаёт отдельную ссылку и не меняет архитектуру сайта.

## Web Component

```html
<script type="module" src="/graph-studio/graph-widget.js"></script>

<graph-studio-widget
  src="/data/project.json"
  mode="viewer"
  height="620px"
  controls>
</graph-studio-widget>
```

В `mode="viewer"` посетитель может вращать, масштабировать, ставить анимацию
на паузу и читать карточки. Формы редактирования и команды записи отключены.

## iframe для CMS

```html
<iframe
  src="/graph-studio/embed.html?src=/data/project.json"
  title="Граф связей"
  style="width:100%;height:620px;border:0">
</iframe>
```

Клиентский viewer не заменяет серверную авторизацию. JSON для публичного сайта
следует отдавать только на чтение, а административную запись защищать backend.
