# ⚙️ Graph Studio v8: полный справочник конфигурации

Этот документ описывает каждый параметр `DEFAULT_GRAPH_CONFIG`. Канонический источник находится в `src/core/default-config.js`.

## Правила изменения

- Для частичного изменения используйте `engine.updateConfig(patch)`.
- Для полной замены используйте `engine.setConfig(config)`.
- Настройки раскладки, физики, размеров и цветов могут вызвать перестройку сцены.
- Настройки камеры, фона и анимации обычно применяются без полной перестройки.

## Таблица параметров

| Путь | Тип | По умолчанию | Назначение |
|---|---|---:|---|
| `layout.type` | string | `planetary` | Активная раскладка: planetary или hex. |
| `layout.seed` | number | `42` | Seed детерминированного генератора случайных чисел. Одинаковое значение даёт одинаковое начальное расположение. |
| `layout.transition` | number | `4.2` | Скорость плавного перехода узлов к новым якорным позициям. |
| `layout.planetary.ringGap` | number | `190` | Расстояние между уровнями планетарной паутины. |
| `layout.planetary.branchSpread` | number | `0.56` | Угловой размах дочерних ветвей. |
| `layout.planetary.depth` | number | `34` | Амплитуда смещения узлов по оси Z. |
| `layout.hex.gap` | number | `112` | Расстояние между центрами соседних сот. |
| `layout.hex.depth` | number | `14` | Чередующееся смещение колец hex-сетки по оси Z. |
| `camera.focalLength` | number | `980` | Фокусное расстояние перспективной камеры. Большое значение делает перспективу слабее. |
| `camera.zoom` | number | `1` | Начальный масштаб. |
| `camera.minZoom` | number | `0.3` | Минимально допустимый масштаб. |
| `camera.maxZoom` | number | `3.2` | Максимально допустимый масштаб. |
| `camera.nearClip` | number | `55` | Минимальный допустимый знаменатель перспективы; защищает от взрыва масштаба у камеры. |
| `camera.rotationX` | number | `0.08` | Начальный угол камеры по оси X в радианах. |
| `camera.rotationY` | number | `0.18` | Начальный угол камеры по оси Y в радианах. |
| `camera.smoothing` | number | `5.2` | Скорость приближения текущих углов к целевым. |
| `camera.inertiaEnabled` | boolean | `true` | Разрешает продолжение вращения после отпускания указателя. |
| `camera.inertiaFriction` | number | `1.35` | Скорость затухания угловой инерции. |
| `camera.maxAngularVelocity` | number | `2.4` | Максимальная угловая скорость камеры. |
| `camera.autoRotate` | boolean | `false` | Включает автоматическое вращение. |
| `camera.autoRotateSpeed` | number | `0.035` | Скорость автоматического вращения в радианах в секунду. |
| `animation.enabled` | boolean | `true` | Главный выключатель анимации. |
| `animation.pulseSpeed` | number | `1` | Общий множитель скорости обычной пульсации. |
| `animation.respectReducedMotion` | boolean | `false` | Учитывать системную настройку prefers-reduced-motion. |
| `interaction.rotationSensitivity` | number | `0.0032` | Чувствительность вращения при перетаскивании фона. |
| `interaction.wheelZoomFactor` | number | `0.00075` | Чувствительность масштабирования колесом. |
| `interaction.zoomSmoothing` | number | `8` | Скорость плавного перехода к целевому zoom. |
| `interaction.keyboardStep` | number | `0.055` | Шаг поворота камеры клавишами. |
| `interaction.hoverRadiusFactor` | number | `1.75` | Множитель радиуса зоны наведения узла. |
| `interaction.linkHoverThreshold` | number | `10` | Максимальное расстояние курсора до связи для её выбора. |
| `interaction.hoverJellyStrength` | number | `1.15` | Сила лёгкого импульса при наведении на узел. |
| `interaction.dragJellyStrength` | number | `1.05` | Сила передачи движения соседям при перетаскивании. |
| `interaction.impulseDepth` | number | `4` | Сколько уровней соседей получает импульс. |
| `interaction.impulseFalloff` | number | `0.52` | Коэффициент уменьшения импульса на каждом следующем уровне. |
| `interaction.nodeDraggingEnabled` | boolean | `true` | Разрешает перетаскивание узлов. |
| `physics.enabled` | boolean | `true` | Включает пружинную физику. |
| `physics.anchorStrength` | number | `4.8` | Сила возврата узла к позиции раскладки. |
| `physics.springStrength` | number | `8.5` | Упругость виртуальных пружин hex-сетки. |
| `physics.linkStrength` | number | `6.5` | Упругость реальных связей графа. |
| `physics.damping` | number | `3.4` | Коэффициент затухания скорости. |
| `physics.repulsionStrength` | number | `720` | Сила взаимного отталкивания узлов. |
| `physics.collisionPadding` | number | `1.45` | Запас расстояния при устранении столкновений. |
| `physics.maxSpeed` | number | `190` | Ограничение линейной скорости узла. |
| `physics.substeps` | number | `3` | Число физических подшагов на кадр. |
| `colors.backgroundCenter` | string | `#fbfdff` | Цвет центра радиального фона. |
| `colors.backgroundEdge` | string | `#e7edf2` | Цвет края радиального фона. |
| `colors.grid` | string | `rgba(47, 69, 86, 0.20)` | Цвет вспомогательной сетки. |
| `colors.core` | string | `#263846` | Стандартный цвет ядра. |
| `colors.group` | string | `#3d5c95` | Стандартный цвет группы. |
| `colors.node` | string | `#6d7b88` | Стандартный цвет обычного узла. |
| `colors.accent` | string | `#9a6b31` | Стандартный цвет акцентного узла. |
| `colors.default` | string | `#59636f` | Цвет резервного типа default. |
| `colors.nodeStroke` | string | `#12202b` | Цвет контура узлов. |
| `colors.linkCore` | string | `#617988` | Цвет связи, относящейся к ядру. |
| `colors.linkDefault` | string | `#8699a7` | Стандартный цвет связи. |
| `colors.tooltipBackground` | string | `#ffffff` | Фон Canvas-tooltip, если используется renderer canvas. |
| `colors.tooltipText` | string | `#111820` | Цвет текста Canvas-tooltip. |
| `colors.particle` | string | `#607d91` | Цвет фоновых частиц. |
| `colors.heartPulse` | string | `#b63a46` | Базовый цвет сердечного импульса. |
| `colors.labelBackground` | string | `rgba(255,255,255,0.88)` | Фон подписи узла. |
| `colors.labelText` | string | `#17232d` | Цвет подписи узла. |
| `background.dotsEnabled` | boolean | `true` | Показывать фоновые точки. |
| `background.dotSpacing` | number | `30` | Шаг фоновой точечной сетки в CSS-пикселях. |
| `background.dotSize` | number | `1.25` | Радиус обычной фоновой точки. |
| `background.dotOpacity` | number | `0.62` | Прозрачность обычных точек. |
| `background.accentEvery` | number | `4` | Каждая N-я точка становится акцентной. |
| `background.accentSize` | number | `1.9` | Размер акцентной точки. |
| `node.sizes.core` | number | `25` | Стандартный размер узла этого типа. |
| `node.sizes.group` | number | `18` | Стандартный размер узла этого типа. |
| `node.sizes.node` | number | `13` | Стандартный размер узла этого типа. |
| `node.sizes.accent` | number | `16` | Стандартный размер узла этого типа. |
| `node.sizes.default` | number | `14` | Стандартный размер узла этого типа. |
| `node.strokeWidth` | number | `1.1` | Базовая толщина контура узла. |
| `node.ringWidth` | number | `1.2` | Толщина кольца при наведении/перетаскивании. |
| `node.pulseAmplitude.core` | number | `0.07` | Амплитуда обычной синусоидальной пульсации этого типа узла. |
| `node.pulseAmplitude.group` | number | `0.02` | Амплитуда обычной синусоидальной пульсации этого типа узла. |
| `node.pulseAmplitude.node` | number | `0.01` | Амплитуда обычной синусоидальной пульсации этого типа узла. |
| `node.pulseAmplitude.accent` | number | `0.025` | Амплитуда обычной синусоидальной пульсации этого типа узла. |
| `node.pulseAmplitude.default` | number | `0.012` | Амплитуда обычной синусоидальной пульсации этого типа узла. |
| `node.corePulse.enabled` | boolean | `true` | Включить локальную пульсацию ядра. |
| `node.corePulse.style` | string | `organic` | Стиль локальной пульсации: organic или glow. |
| `node.corePulse.speed` | number | `1.08` | Скорость локального сердечного цикла ядра. |
| `node.corePulse.amplitude` | number | `0.12` | Изменение размера ядра во время удара. |
| `node.corePulse.deformation` | number | `0.08` | Степень деформации органического контура. |
| `node.corePulse.ringCount` | number | `0` | Количество световых колец для glow-режима. |
| `node.corePulse.ringDistance` | number | `0` | Расстояние между световыми кольцами. |
| `node.corePulse.glowBlur` | number | `0` | Размытие свечения. |
| `node.corePulse.minOpacity` | number | `0` | Минимальная прозрачность светового эффекта. |
| `node.corePulse.maxOpacity` | number | `0` | Максимальная прозрачность светового эффекта. |
| `node.labels.mode` | string | `core` | Показывать подписи: none, core или all. |
| `node.labels.showOnHover` | boolean | `true` | Показывать подпись наведённого узла независимо от mode. |
| `node.labels.fontSize` | number | `14` | Размер шрифта подписи. |
| `node.labels.fontWeight` | number | `800` | Насыщенность шрифта. |
| `node.labels.offsetY` | number | `14` | Вертикальный отступ подписи от узла. |
| `node.labels.paddingX` | number | `8` | Горизонтальный внутренний отступ подложки. |
| `node.labels.paddingY` | number | `4` | Вертикальный внутренний отступ подложки. |
| `node.labels.maxWidth` | number | `220` | Максимальная ширина текста подписи. |
| `node.labels.background` | boolean | `true` | Рисовать фон под подписью. |
| `links.widthCore` | number | `3.2` | Стандартная центральная толщина связи ядра. |
| `links.widthDefault` | number | `1.8` | Стандартная центральная толщина обычной связи. |
| `links.opacity` | number | `0.78` | Прозрачность активной связи. |
| `links.inactiveOpacity` | number | `0.12` | Прозрачность неактивной связи при фокусировке. |
| `links.pulseAmplitude` | number | `0.08` | Амплитуда обычной пульсации толщины. |
| `links.taper.enabled` | boolean | `true` | Включить сужение связи около узлов. |
| `links.taper.endpointRatio` | number | `0.34` | Максимальная ширина конца как доля экранного радиуса узла. |
| `links.taper.minEndpointWidth` | number | `0.55` | Минимальная ширина конца связи. |
| `links.taper.insetRatio` | number | `0.82` | Доля радиуса, на которую линия не доходит до центра узла. |
| `links.flow.enabled` | boolean | `true` | Включить постоянный поток по связям. |
| `links.flow.count` | number | `4` | Количество потоковых штрихов на каждой связи. |
| `links.flow.speed` | number | `0.28` | Скорость движения потоковых штрихов. |
| `links.flow.size` | number | `2.2` | Толщина потокового штриха. |
| `links.flow.opacity` | number | `0.92` | Прозрачность потока. |
| `links.flow.glowBlur` | number | `0` | Размытие свечения потока; 0 отключает свечение. |
| `links.flow.trailLength` | number | `0.085` | Длина хвоста как доля длины связи. |
| `links.flow.shape` | string | `streak` | Форма частицы потока; в v8 используется streak. |
| `networkPulse.enabled` | boolean | `true` | Включить сердечную волну по всей сети. |
| `networkPulse.style` | string | `organic` | Стиль волны: organic или glow. |
| `networkPulse.bpm` | number | `62` | Число сердечных циклов в минуту. |
| `networkPulse.branchDelay` | number | `0.115` | Фазовая задержка на один уровень от ядра. |
| `networkPulse.travelWindow` | number | `0.48` | Часть цикла, в течение которой импульс проходит по связи. |
| `networkPulse.nodeAmplitude` | number | `0.15` | Изменение размера дочерних узлов от волны. |
| `networkPulse.nodeDeformation` | number | `0.06` | Деформация формы дочерних узлов. |
| `networkPulse.linkWidthBoost` | number | `1.35` | Дополнительная толщина связи во время импульса. |
| `networkPulse.glowEnabled` | boolean | `false` | Разрешить световой ореол. |
| `networkPulse.glowBlur` | number | `0` | Размытие ореола. |
| `networkPulse.markerSize` | number | `3.8` | Толщина движущегося импульса. |
| `networkPulse.markerShape` | string | `drop` | Семантическое имя формы импульса. |
| `networkPulse.color` | string | `#b63a46` | Цвет сердечного импульса. |
| `typography.family` | string | `Inter, Roboto, Arial, sans-serif` | Стек шрифтов приложения и Canvas. |
| `typography.tooltipTitleSize` | number | `17` | Размер заголовка Canvas-tooltip. |
| `typography.tooltipTextSize` | number | `13` | Размер обычного текста Canvas-tooltip. |
| `typography.tooltipWidth` | number | `340` | Ширина Canvas-tooltip. |
| `tooltip.enabled` | boolean | `true` | Включить информационную карточку. |
| `tooltip.renderer` | string | `dom` | Способ вывода: dom или canvas. |
| `tooltip.placement` | string | `opposite-side` | Алгоритм размещения карточки. |
| `tooltip.preferredSide` | string | `auto` | Предпочитаемая сторона карточки. |
| `tooltip.width` | number | `340` | Начальная ширина DOM-карточки. |
| `tooltip.minWidth` | number | `220` | Минимальная ширина карточки. |
| `tooltip.maxWidth` | number | `480` | Максимальная ширина карточки. |
| `tooltip.offset` | number | `28` | Отступ карточки от узла. |
| `tooltip.textAlign` | string | `center` | Выравнивание основного текста. |
| `tooltip.titleAlign` | string | `center` | Выравнивание заголовка. |
| `tooltip.resizable` | boolean | `true` | Разрешить пользователю менять размер карточки. |
| `tooltip.maxHeight` | number | `420` | Максимальная высота карточки. |
| `particles.enabled` | boolean | `true` | Включить частицы глубины на фоне. |
| `particles.count` | number | `170` | Количество фоновых частиц. |
| `particles.minSize` | number | `0.55` | Минимальный размер частицы. |
| `particles.maxSize` | number | `1.7` | Максимальный размер частицы. |
| `particles.minSpeed` | number | `5` | Минимальная скорость частицы. |
| `particles.maxSpeed` | number | `15` | Максимальная скорость частицы. |
| `particles.minOpacity` | number | `0.14` | Минимальная прозрачность. |
| `particles.maxOpacity` | number | `0.46` | Максимальная прозрачность. |
| `particles.depth` | number | `1800` | Глубина виртуального объёма частиц. |
| `particles.drift` | number | `7` | Амплитуда бокового дрейфа. |
| `legend.enabled` | boolean | `true` | Показывать легенду. |
| `legend.title` | string | `Легенда` | Заголовок легенды. |
| `legend.position` | string | `top-right` | Положение легенды на сцене. |
| `legend.items` | array | массив, 4 элемента | Массив обозначений легенды. |
| `editor.mode` | string | `admin` | Режим приложения: admin или viewer. |
| `editor.locked` | boolean | `false` | Блокировка операций записи. |
| `editor.uiVisible` | boolean | `true` | Показывать административную панель. |
| `editor.allowCameraWhenLocked` | boolean | `true` | Разрешить камеру при блокировке данных. |
| `editor.allowHoverEditor` | boolean | `true` | Разрешить контекстный редактор связи. |
| `editor.viewerToolbar` | boolean | `true` | Показывать toolbar в viewer. |
| `editor.viewerCanPause` | boolean | `true` | Разрешить viewer ставить анимацию на паузу. |
| `editor.viewerCanChangeLayout` | boolean | `false` | Разрешить viewer менять раскладку. |
| `embed.controls` | boolean | `false` | Показывать встроенные кнопки управления. |
| `embed.transparent` | boolean | `false` | Использовать прозрачный фон виджета. |
| `embed.autoStart` | boolean | `true` | Автоматически запускать render loop. |
| `embed.allowPostMessage` | boolean | `true` | Разрешить мост команд через postMessage. |
| `embed.mode` | string | `viewer` | Режим Web Component по умолчанию. |
| `ai.contractVersion` | string | `graph-studio/1` | Версия декларативного JSON-контракта. |
| `ai.allowLegacyToolNames` | boolean | `true` | Разрешить старые имена MCP-команд как alias. |
| `ai.strictValidation` | boolean | `true` | Включить строгую валидацию машинного ввода. |
| `performance.maxDevicePixelRatio` | number | `2` | Ограничение DPR для снижения нагрузки на Canvas. |

## Примеры

### Минимальный спокойный граф

```js
engine.updateConfig({
  camera: { autoRotate: false, inertiaEnabled: true },
  particles: { enabled: false },
  networkPulse: { enabled: false },
  links: { flow: { enabled: false } }
});
```

### Органический граф без свечения

```js
engine.updateConfig({
  node: { corePulse: { enabled: true, style: 'organic', glowBlur: 0 } },
  networkPulse: { enabled: true, style: 'organic', glowEnabled: false },
  links: { flow: { enabled: true, shape: 'streak', glowBlur: 0 } }
});
```

### Режим публичного просмотра

```js
engine.updateConfig({
  editor: {
    mode: 'viewer',
    locked: true,
    uiVisible: false,
    allowHoverEditor: false
  }
}, { force: true });
```

## Замечание о единицах

- Углы движка хранятся в радианах. UI может показывать градусы.
- Скорости физики рассчитываются относительно секунд.
- Размеры Canvas задаются в CSS-пикселях, а backing store учитывает DPR.
- Цвета узлов и связей ожидаются в формате CSS; машинные схемы обычно ограничивают индивидуальные цвета форматом `#RRGGBB`.
