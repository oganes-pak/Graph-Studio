/**
 * Показательные демонстрации Graph Studio v13.
 * Каждый шаблон использует предметную область, для которой выбранная диаграмма
 * естественна: магазин, учёба, работа, здоровье, личные решения и процессы.
 */
import { cloneValue } from '../core/utils.js';

const C = Object.freeze({
  navy:'#263846', blue:'#3D5C95', green:'#4F8A70', red:'#C55D55', purple:'#8668B0',
  gold:'#D39A36', cyan:'#3990A6', pink:'#B35B83', lime:'#78943F', orange:'#D47736',
  steel:'#5F7890', brown:'#8B684D', teal:'#4D9A8A', violet:'#745FC0', coral:'#E07158',
  sky:'#4B82B5', mint:'#61A680', rose:'#C44F70', olive:'#8B963D', amber:'#E0A02F'
});

const TEMPLATES = {
  info: {
    title: 'Аналитический обзор бизнеса',
    summary: 'Прокручиваемые карточки, рейтинги риска и цветная таблица для отчёта, созданного ИИ.',
    nodes: [], links: [], chart: { metrics: [], series: [] },
    document: {
      title: 'Аналитический обзор',
      subtitle: 'География продаж, системные риски и операционные показатели',
      theme: { accent: C.blue, surface: 'rgba(255,255,255,0.95)', text: '#17232d', muted: '#607080' },
      sections: [
        {
          id: 'geo', title: 'Географический разрез', color: C.blue,
          description: 'Рейтинг регионов по продуктовой эффективности.',
          items: [
            { rank: 1, title: 'Красноярск', text: 'Золото: лидер по выручке', status: 'ЛИДЕР', level: 'good', color: C.gold },
            { rank: 2, title: 'Москва и МО', text: 'Золото: высокий потенциал', status: 'РОСТ', level: 'good', color: C.blue },
            { rank: 3, title: 'Ярославль', text: 'Золото: стабильный спрос', status: 'СТАБИЛЬНО', level: 'normal', color: C.green },
            { rank: 4, title: 'Уфа / Пермь', text: 'Вампиры: низкий оборот', status: 'СЛАБО', level: 'warning', color: C.orange },
            { rank: 5, title: 'Краснодар', text: 'Вампиры: неэффективно', status: 'СТОП', level: 'critical', color: C.red }
          ]
        },
        {
          id: 'risk', title: 'Уровень системного риска', color: C.red,
          description: 'Приоритеты вмешательства по степени угрозы.',
          items: [
            { rank: 1, title: 'Отмены владельца', text: 'Высокая доля ручных отмен', status: 'КРИТИЧЕСКАЯ', level: 'critical', color: C.red },
            { rank: 2, title: 'Рейтинг товаров', text: 'Снижение среднего рейтинга', status: 'ТРЕВОГА', level: 'warning', color: C.orange },
            { rank: 3, title: 'Точность прогноза', text: 'Отклонение выше допустимого', status: 'ТРЕВОГА', level: 'warning', color: C.gold }
          ]
        },
        {
          id: 'kpi', title: 'Ключевые показатели', color: C.green,
          blocks: [
            { title: 'Выручка', value: '12,8 млн ₽', text: '+18% к прошлому периоду', color: C.green },
            { title: 'Маржа', value: '31,4%', text: 'Выше целевого уровня', color: C.blue },
            { title: 'Возвраты', value: '7,2%', text: 'Требуется контроль', color: C.orange },
            { title: 'Прогноз', value: '86%', text: 'Точность модели', color: C.purple }
          ]
        },
        {
          id: 'table', title: 'Товарная матрица', color: C.purple,
          table: {
            title: 'Сводная оценка категорий', color: C.purple,
            columns: [
              { id: 'category', label: 'Категория' },
              { id: 'revenue', label: 'Выручка' },
              { id: 'margin', label: 'Маржа' },
              { id: 'status', label: 'Статус' }
            ],
            rows: [
              { category: 'Электроника', revenue: '4,2 млн ₽', margin: '28%', status: 'Рост', colors: { status: C.green } },
              { category: 'Дом и быт', revenue: '3,1 млн ₽', margin: '35%', status: 'Стабильно', colors: { status: C.blue } },
              { category: 'Аксессуары', revenue: '2,7 млн ₽', margin: '42%', status: 'Лидер', colors: { status: C.gold } },
              { category: 'Сезонные товары', revenue: '0,8 млн ₽', margin: '14%', status: 'Риск', colors: { status: C.red } }
            ]
          }
        },
        {
          id: 'timeline', type: 'timeline', title: 'Хронология изменений', color: C.cyan,
          events: [
            { date: 'Январь', title: 'Запуск аналитики', text: 'Подключены первые источники данных', color: C.blue },
            { date: 'Март', title: 'Оптимизация каталога', text: 'Удалены нерентабельные позиции', color: C.orange },
            { date: 'Июнь', title: 'Масштабирование', text: 'Добавлены новые регионы и категории', color: C.green }
          ]
        },
        {
          id: 'checklist', type: 'checklist', title: 'Контрольный список', color: C.teal,
          items: [
            { title: 'Проверить отмены', done: true, owner: 'Аналитик' },
            { title: 'Пересчитать прогноз', done: false, owner: 'Data team' },
            { title: 'Обновить цены', done: false, owner: 'Категорийный менеджер' }
          ]
        },
        {
          id: 'comparison', type: 'comparison', title: 'Сравнение стратегий', color: C.gold,
          columns: [
            { title: 'Рост оборота', value: '+24%', color: C.blue, items: ['Больше рекламы', 'Расширение ассортимента'], conclusion: 'Быстро, но дороже' },
            { title: 'Рост маржи', value: '+9 п.п.', color: C.green, items: ['Оптимизация цен', 'Снижение возвратов'], conclusion: 'Медленнее, но устойчивее' }
          ]
        },
        {
          id: 'progress', type: 'progress', title: 'Прогресс инициатив', color: C.violet,
          items: [
            { title: 'Очистка каталога', value: 82, max: 100, color: C.green },
            { title: 'Настройка прогнозов', value: 64, max: 100, color: C.blue },
            { title: 'Снижение отмен', value: 38, max: 100, color: C.orange }
          ]
        },
        {
          id: 'matrix', type: 'matrix', title: 'Матрица приоритетов', color: C.rose,
          cells: [
            { quadrant: 'top-left', title: 'Срочно и важно', color: C.red, items: ['Отмены владельца', 'Падение рейтинга'] },
            { quadrant: 'top-right', title: 'Важно, не срочно', color: C.blue, items: ['Новая модель спроса'] },
            { quadrant: 'bottom-left', title: 'Срочно, не важно', color: C.orange, items: ['Ручные выгрузки'] },
            { quadrant: 'bottom-right', title: 'Низкий приоритет', color: C.green, items: ['Косметические правки'] }
          ]
        },
        {
          id: 'recommendations', type: 'recommendations', title: 'Рекомендации', color: C.green,
          items: [
            { priority: 'Высокий', title: 'Снизить отмены', reason: 'Главный источник потерь', effect: '+7% выручки', color: C.red },
            { priority: 'Средний', title: 'Усилить регионы-лидеры', reason: 'Высокая отдача на вложения', effect: '+4% маржи', color: C.blue },
            { priority: 'Низкий', title: 'Обновить оформление карточек', reason: 'Поддерживающий эффект', effect: '+1–2% CTR', color: C.purple }
          ]
        }
      ]
    }
  },

  network: {
    title: 'Жизненная экосистема человека',
    summary: 'Сеть показывает взаимное влияние учёбы, работы, здоровья, денег, семьи и бытовых покупок.',
    nodes: [
      n('life','Моя жизнь','core',C.navy,31,'Центральная карта областей жизни и их взаимного влияния.'),
      n('study','Учёба','group',C.blue,22), n('work','Работа','group',C.orange,22),
      n('health','Здоровье','group',C.green,22), n('finance','Финансы','group',C.gold,22),
      n('family','Семья и общение','group',C.purple,22), n('home','Дом и покупки','group',C.cyan,22),
      n('university','Университет','node',C.sky), n('courses','Онлайн-курсы','node',C.violet),
      n('diploma','Дипломный проект','accent',C.rose), n('english','Английский','node',C.teal),
      n('job','Основная работа','node',C.orange), n('freelance','Фриланс','node',C.coral),
      n('career','Карьерный рост','accent',C.amber), n('team','Команда','node',C.brown),
      n('sleep','Сон','node',C.blue), n('sport','Спорт','node',C.green),
      n('nutrition','Питание','node',C.lime), n('doctor','Врачи и анализы','accent',C.red),
      n('salary','Зарплата','node',C.gold), n('budget','Бюджет','node',C.olive),
      n('savings','Накопления','accent',C.mint), n('parents','Родители','node',C.purple),
      n('friends','Друзья','node',C.pink), n('shopping','Покупки','node',C.cyan),
      n('food_store','Продукты','node',C.lime), n('tech_store','Техника','node',C.steel)
    ],
    links: [
      l('life','study','развитие'), l('life','work','занятость'), l('life','health','состояние'),
      l('life','finance','ресурсы'), l('life','family','поддержка'), l('life','home','быт'),
      l('study','university'), l('study','courses'), l('study','diploma'), l('study','english'),
      l('work','job'), l('work','freelance'), l('work','career'), l('work','team'),
      l('health','sleep'), l('health','sport'), l('health','nutrition'), l('health','doctor'),
      l('finance','salary'), l('finance','budget'), l('finance','savings'),
      l('family','parents'), l('family','friends'), l('home','shopping'), l('home','food_store'), l('home','tech_store'),
      l('university','career','влияет'), l('job','sleep','сокращает'), l('salary','shopping','финансирует'),
      l('nutrition','food_store','зависит'), l('doctor','budget','расходы'), l('friends','sport','мотивация')
    ]
  },

  force: {
    title: 'Команда запуска интернет-магазина',
    summary: 'Силовая диаграмма подчёркивает плотные связи между людьми, сервисами и задачами.',
    nodes: [
      n('launch','Запуск магазина','core',C.navy,28),
      n('manager','Руководитель проекта','group',C.blue,21), n('analyst','Аналитик','group',C.purple,19),
      n('designer','Дизайнер','group',C.pink,19), n('frontend','Frontend','group',C.cyan,19),
      n('backend','Backend','group',C.green,19), n('qa','Тестировщик','group',C.orange,19),
      n('marketing','Маркетолог','group',C.gold,19), n('support','Поддержка','group',C.steel,19),
      n('catalog','Каталог','node',C.teal), n('cart','Корзина','node',C.sky),
      n('payment','Оплата','accent',C.red), n('delivery','Доставка','node',C.brown),
      n('crm','CRM','node',C.violet), n('analytics','Метрики','node',C.olive),
      n('ads','Реклама','node',C.amber), n('reviews','Отзывы','node',C.coral),
      n('security','Безопасность','accent',C.rose)
    ],
    links: [
      l('launch','manager'), l('manager','analyst'), l('manager','designer'), l('manager','frontend'),
      l('manager','backend'), l('manager','qa'), l('manager','marketing'), l('manager','support'),
      l('analyst','catalog'), l('analyst','analytics'), l('designer','catalog'), l('designer','cart'),
      l('frontend','catalog'), l('frontend','cart'), l('frontend','payment'),
      l('backend','catalog'), l('backend','payment'), l('backend','delivery'), l('backend','crm'),
      l('qa','cart'), l('qa','payment'), l('qa','security'), l('marketing','ads'),
      l('marketing','analytics'), l('marketing','reviews'), l('support','crm'), l('support','reviews'),
      l('payment','security'), l('delivery','crm'), l('ads','analytics')
    ]
  },

  tree: {
    title: 'Учебная программа по информационной безопасности',
    summary: 'Дерево показывает строгую иерархию: программа → семестр → дисциплина → тема.',
    nodes: [
      n('program','Информационная безопасность','core',C.navy,30),
      n('sem1','1 семестр','group',C.blue,22), n('sem2','2 семестр','group',C.green,22),
      n('sem3','3 семестр','group',C.orange,22), n('sem4','4 семестр','group',C.purple,22),
      n('math','Математика','node',C.sky), n('programming','Программирование','node',C.cyan),
      n('networks','Компьютерные сети','node',C.teal), n('os','Операционные системы','node',C.steel),
      n('crypto','Криптография','node',C.violet), n('law','Право ИБ','node',C.gold),
      n('risk','Управление рисками','node',C.orange), n('pentest','Анализ защищённости','node',C.red),
      n('diploma','Дипломный проект','accent',C.rose,19), n('practice','Производственная практика','accent',C.mint,19),
      n('linear','Линейная алгебра','node',C.blue), n('python','Python','node',C.cyan),
      n('osi','Модель OSI','node',C.teal), n('linux','Linux','node',C.steel),
      n('aes','AES и RSA','node',C.violet), n('152fz','152-ФЗ','node',C.gold),
      n('threats','Модель угроз','node',C.orange), n('websec','Web-безопасность','node',C.red),
      n('research','Исследование','node',C.pink), n('defense','Защита','node',C.amber)
    ],
    links: [
      l('program','sem1'), l('program','sem2'), l('program','sem3'), l('program','sem4'),
      l('sem1','math'), l('sem1','programming'), l('math','linear'), l('programming','python'),
      l('sem2','networks'), l('sem2','os'), l('networks','osi'), l('os','linux'),
      l('sem3','crypto'), l('sem3','law'), l('sem3','risk'), l('crypto','aes'), l('law','152fz'), l('risk','threats'),
      l('sem4','pentest'), l('sem4','practice'), l('sem4','diploma'), l('pentest','websec'),
      l('diploma','research'), l('diploma','defense')
    ]
  },

  mindmap: {
    title: 'Личный план на год',
    summary: 'Ментальная карта раскрывает идеи по темам без жёсткой процессной последовательности.',
    nodes: [
      n('year','Мой год','core',C.navy,31,'Центральная идея личного плана.'),
      n('study','Учёба','group',C.blue,22), n('work','Работа','group',C.orange,22),
      n('health','Здоровье','group',C.green,22), n('money','Финансы','group',C.gold,22),
      n('home','Дом и покупки','group',C.cyan,22), n('rest','Отдых и люди','group',C.purple,22),
      n('degree','Закончить диплом','node',C.sky), n('english','Английский B2','node',C.violet),
      n('books','12 книг','node',C.pink), n('cert','Сертификат ИБ','accent',C.rose),
      n('promotion','Повышение','accent',C.amber), n('portfolio','Портфолио','node',C.orange),
      n('automation','Автоматизация рутины','node',C.coral), n('networking','Профессиональные связи','node',C.brown),
      n('sleep','Сон 8 часов','node',C.blue), n('gym','Спорт 3 раза','node',C.green),
      n('checkup','Обследование','accent',C.red), n('food','Рацион','node',C.lime),
      n('reserve','Финансовая подушка','accent',C.mint), n('budget','Учёт расходов','node',C.olive),
      n('invest','Инвестиции','node',C.gold), n('laptop','Новый ноутбук','node',C.steel),
      n('repair','Ремонт комнаты','node',C.cyan), n('groceries','План покупок','node',C.teal),
      n('travel','Путешествие','node',C.purple), n('friends','Встречи с друзьями','node',C.pink),
      n('family','Время с семьёй','node',C.violet), n('hobby','Новое хобби','node',C.brown)
    ],
    links: [
      l('year','study'), l('year','work'), l('year','health'), l('year','money'), l('year','home'), l('year','rest'),
      l('study','degree'), l('study','english'), l('study','books'), l('study','cert'),
      l('work','promotion'), l('work','portfolio'), l('work','automation'), l('work','networking'),
      l('health','sleep'), l('health','gym'), l('health','checkup'), l('health','food'),
      l('money','reserve'), l('money','budget'), l('money','invest'),
      l('home','laptop'), l('home','repair'), l('home','groceries'),
      l('rest','travel'), l('rest','friends'), l('rest','family'), l('rest','hobby')
    ]
  },

  fishbone: {
    title: 'Почему ухудшилось здоровье и работоспособность',
    summary: 'Исикава разделяет симптомы и причины по категориям, не притворяясь хронологическим процессом.',
    nodes: [
      n('problem','Усталость, болезни и снижение концентрации','core',C.red,30,'Проблема, причины которой анализируются.'),
      n('sleep','Сон','category',C.blue,21), n('food','Питание','category',C.green,21),
      n('work','Работа','category',C.orange,21), n('study','Учёба','category',C.purple,21),
      n('medicine','Здоровье','category',C.rose,21), n('environment','Среда','category',C.cyan,21),
      n('late','Поздний отход ко сну','cause',C.sky), n('screens','Экран перед сном','cause',C.violet),
      n('noise','Шум ночью','cause',C.steel), n('fastfood','Фастфуд','cause',C.orange),
      n('water','Мало воды','cause',C.cyan), n('vitamins','Дефициты','cause',C.lime),
      n('overtime','Переработки','cause',C.red), n('stress','Стресс и дедлайны','cause',C.coral),
      n('sitting','Мало движения','cause',C.brown), n('exams','Экзамены','cause',C.purple),
      n('multitask','Многозадачность','cause',C.pink), n('no_plan','Нет расписания','cause',C.gold),
      n('chronic','Хроническое заболевание','cause',C.rose), n('doctor','Редкие обследования','cause',C.red),
      n('selfmed','Самолечение','cause',C.amber), n('air','Сухой воздух','cause',C.teal),
      n('light','Недостаток дневного света','cause',C.sky), n('commute','Долгая дорога','cause',C.steel),
      n('phone_late','Уведомления после полуночи','accent',C.rose),
      n('coffee','Кофе вечером','accent',C.brown), n('no_breaks','Нет перерывов','accent',C.orange)
    ],
    links: [
      l('sleep','problem'), l('food','problem'), l('work','problem'), l('study','problem'), l('medicine','problem'), l('environment','problem'),
      l('late','sleep'), l('screens','sleep'), l('noise','sleep'), l('phone_late','screens'), l('coffee','late'),
      l('fastfood','food'), l('water','food'), l('vitamins','food'),
      l('overtime','work'), l('stress','work'), l('sitting','work'), l('no_breaks','overtime'),
      l('exams','study'), l('multitask','study'), l('no_plan','study'),
      l('chronic','medicine'), l('doctor','medicine'), l('selfmed','medicine'),
      l('air','environment'), l('light','environment'), l('commute','environment')
    ]
  },

  flowchart: {
    title: 'Оформление заказа в интернет-магазине',
    summary: 'Блок-схема показывает шаги, условия, возвраты и завершение заказа.',
    nodes: [
      shape('start','Покупатель открыл магазин','start','capsule',C.navy),
      shape('search','Поиск товара','input','parallelogram',C.blue),
      shape('available','Товар найден?','decision','diamond',C.gold),
      shape('notify','Подписаться на поступление','process','rectangle',C.purple),
      shape('cart','Добавить в корзину','process','rectangle',C.cyan),
      shape('auth','Войти или зарегистрироваться','process','rectangle',C.sky),
      shape('address','Указать адрес','input','parallelogram',C.teal),
      shape('delivery','Выбрать доставку','process','rectangle',C.orange),
      shape('stock','Товар ещё в наличии?','decision','diamond',C.gold),
      shape('payment','Оплатить заказ','process','rectangle',C.green),
      shape('paid','Оплата прошла?','decision','diamond',C.gold),
      shape('retry','Повторить оплату','process','rectangle',C.coral),
      shape('pack','Собрать заказ','process','rectangle',C.violet),
      shape('ship','Передать в доставку','output','parallelogram',C.blue),
      shape('receive','Покупатель получил заказ','process','rectangle',C.mint),
      shape('return_q','Нужен возврат?','decision','diamond',C.gold),
      shape('return','Оформить возврат','process','rectangle',C.red),
      shape('review','Оставить отзыв','output','parallelogram',C.pink),
      shape('end','Заказ завершён','end','capsule',C.navy)
    ],
    links: [
      l('start','search'), l('search','available'), l('available','cart','Да'), l('available','notify','Нет'),
      l('notify','end','Ожидание'), l('cart','auth'), l('auth','address'), l('address','delivery'),
      l('delivery','stock'), l('stock','payment','Да'), l('stock','notify','Нет'),
      l('payment','paid'), l('paid','pack','Да'), l('paid','retry','Нет'), l('retry','payment','Снова'),
      l('pack','ship'), l('ship','receive'), l('receive','return_q'), l('return_q','review','Нет'),
      l('return_q','return','Да'), l('return','end'), l('review','end')
    ]
  },

  decision: {
    title: 'Что делать после университета',
    summary: 'Граф решений связывает варианты, неопределённые события и последствия.',
    nodes: [
      n('choice','Выбрать следующий шаг','decision',C.gold,23),
      n('job','Искать работу','chance',C.orange,20), n('master','Поступать в магистратуру','chance',C.blue,20),
      n('startup','Запустить свой проект','chance',C.purple,20), n('health_break','Взять паузу на здоровье','chance',C.green,20),
      n('job_good','Получить сильный оффер','chance',C.amber), n('job_weak','Получить слабый оффер','chance',C.coral),
      n('grant','Получить грант','chance',C.sky), n('no_grant','Учиться за свой счёт','chance',C.steel),
      n('market_fit','Найти спрос','chance',C.violet), n('no_market','Не найти спрос','chance',C.red),
      n('recover','Восстановиться','chance',C.mint), n('delay','Потерять темп','chance',C.brown),
      n('career','Быстрый карьерный рост','outcome',C.orange,18), n('burnout','Риск выгорания','outcome',C.red,18),
      n('science','Научная специализация','outcome',C.blue,18), n('debt','Финансовая нагрузка','outcome',C.steel,18),
      n('business','Собственный бизнес','outcome',C.purple,18), n('loss','Потеря вложений','outcome',C.rose,18),
      n('balance','Здоровье и баланс','outcome',C.green,18), n('late_start','Поздний старт карьеры','outcome',C.brown,18)
    ],
    links: [
      l('choice','job','Работа'), l('choice','master','Магистратура'), l('choice','startup','Стартап'), l('choice','health_break','Пауза'),
      l('job','job_good','0.55',0.55), l('job','job_weak','0.45',0.45),
      l('master','grant','0.35',0.35), l('master','no_grant','0.65',0.65),
      l('startup','market_fit','0.30',0.30), l('startup','no_market','0.70',0.70),
      l('health_break','recover','0.80',0.80), l('health_break','delay','0.20',0.20),
      l('job_good','career'), l('job_weak','burnout'), l('grant','science'), l('no_grant','debt'),
      l('market_fit','business'), l('no_market','loss'), l('recover','balance'), l('delay','late_start')
    ]
  },

  sankey: {
    title: 'Путь покупателей интернет-магазина',
    summary: 'Sankey показывает, сколько посетителей проходит каждый этап и где теряется поток.',
    nodes: [
      sn('search','Поиск',0,C.blue), sn('ads','Реклама',0,C.gold), sn('social','Соцсети',0,C.pink), sn('direct','Прямые заходы',0,C.green),
      sn('landing','Главная страница',1,C.sky), sn('catalog','Каталог',1,C.cyan), sn('article','Статьи и обзоры',1,C.purple),
      sn('product','Карточка товара',2,C.teal), sn('consult','Консультация',2,C.orange), sn('exit1','Ранний уход',2,C.red),
      sn('cart','Корзина',3,C.blue), sn('favorites','Избранное',3,C.violet), sn('exit2','Уход без покупки',3,C.rose),
      sn('payment','Оплата',4,C.green), sn('failed','Ошибка оплаты',4,C.red), sn('abandoned','Брошенная корзина',4,C.brown),
      sn('delivery','Доставка',5,C.cyan), sn('pickup','Самовывоз',5,C.orange),
      sn('complete','Успешный заказ',6,C.mint), sn('return','Возврат',6,C.rose), sn('repeat','Повторная покупка',7,C.gold)
    ],
    links: [
      sl('search','catalog',420), sl('search','landing',180), sl('ads','landing',390), sl('ads','catalog',160),
      sl('social','article',210), sl('social','landing',190), sl('direct','catalog',240), sl('direct','landing',130),
      sl('landing','product',410), sl('landing','exit1',290), sl('catalog','product',650), sl('catalog','exit1',170),
      sl('article','product',170), sl('article','consult',120), sl('article','exit1',110),
      sl('product','cart',690), sl('product','favorites',250), sl('product','exit2',290), sl('consult','cart',90), sl('consult','exit2',30),
      sl('cart','payment',520), sl('cart','abandoned',260), sl('favorites','cart',120), sl('favorites','exit2',130),
      sl('payment','delivery',390), sl('payment','pickup',90), sl('payment','failed',40),
      sl('failed','abandoned',40), sl('delivery','complete',355), sl('delivery','return',35),
      sl('pickup','complete',84), sl('pickup','return',6), sl('complete','repeat',205)
    ]
  },

  bubble: {
    title: 'Ассортимент интернет-магазина',
    summary: 'X = маржинальность, Y = спрос, размер = месячная выручка. Пузыри можно перетаскивать.',
    nodes: [
      bubble('phone','Смартфон',38,92,95,C.blue,'Маржа 38%, высокий спрос, выручка 95 усл. ед.'),
      bubble('laptop','Ноутбук',24,74,88,C.steel), bubble('headphones','Наушники',57,82,66,C.purple),
      bubble('watch','Умные часы',49,68,58,C.cyan), bubble('charger','Зарядное устройство',72,86,44,C.green),
      bubble('case','Чехол',84,78,40,C.lime), bubble('keyboard','Клавиатура',46,55,51,C.orange),
      bubble('mouse','Мышь',61,64,49,C.gold), bubble('monitor','Монитор',31,49,63,C.sky),
      bubble('chair','Кресло',35,37,72,C.brown), bubble('camera','Камера',42,29,46,C.pink),
      bubble('router','Роутер',55,44,35,C.teal), bubble('printer','Принтер',27,22,29,C.red),
      bubble('speaker','Колонка',64,51,37,C.violet), bubble('ssd','SSD',68,71,54,C.mint),
      bubble('cable','Кабель',90,60,24,C.amber), bubble('tablet','Планшет',33,58,60,C.coral),
      bubble('powerbank','Пауэрбанк',76,73,47,C.rose)
    ],
    links: []
  },

  radar: {
    title: 'Баланс жизни: сейчас, цель и перегрузка',
    summary: 'Radar сравнивает несколько состояний по одинаковым шкалам.',
    nodes: [], links: [],
    chart: {
      maxValue: 100,
      metrics: [
        {id:'study',label:'Учёба'}, {id:'work',label:'Работа'}, {id:'health',label:'Здоровье'},
        {id:'sleep',label:'Сон'}, {id:'finance',label:'Финансы'}, {id:'relationships',label:'Отношения'},
        {id:'rest',label:'Отдых'}, {id:'discipline',label:'Дисциплина'}
      ],
      series: [
        series('now','Сейчас',C.blue,{study:78,work:86,health:48,sleep:42,finance:62,relationships:58,rest:35,discipline:74}),
        series('target','Желаемый баланс',C.green,{study:82,work:75,health:85,sleep:82,finance:78,relationships:80,rest:72,discipline:84}),
        series('overload','Неделя перегрузки',C.red,{study:92,work:96,health:28,sleep:20,finance:66,relationships:30,rest:12,discipline:88}),
        series('vacation','Неделя отдыха',C.purple,{study:32,work:20,health:78,sleep:92,finance:58,relationships:86,rest:96,discipline:48})
      ]
    }
  }
};

export function getDiagramTemplate(type) {
  const template = cloneValue(TEMPLATES[type] ?? TEMPLATES.network);
  template.legend = Array.isArray(template.legend) && template.legend.length
    ? template.legend
    : deriveLegend(template, type);
  return template;
}
export function listDiagramTemplateSummaries() {
  return Object.fromEntries(Object.entries(TEMPLATES).map(([id,value]) => [id,{title:value.title,summary:value.summary}]));
}

function n(id,name,type='node',color=null,size=null,description='') {
  return {id,name,type,...(color?{color}:{}),...(size?{size}:{}),...(description?{description}:{})};
}
function l(source,target,label='',value=null) {
  return {source,target,...(label?{label}:{}),...(value!=null?{value}:{})};
}
function shape(id,name,type,nodeShape,color) {
  return {id,name,type,shape:nodeShape,color,description:`Элемент процесса «${name}».`};
}
function sn(id,name,column,color) {
  return {id,name,type:'node',column,color,description:`Этап потока: ${name}.`};
}
function sl(source,target,value) { return {source,target,value,width:2,label:String(value)}; }
function bubble(id,name,x,y,value,color,description='') {
  return {id,name,type:'node',x,y,value,color,description:description||`X=${x}, Y=${y}, размер=${value}.`};
}
function series(id,name,color,values) { return {id,name,color,values}; }

function deriveLegend(template, type) {
  if (type === 'radar') {
    return (template.chart?.series ?? []).map((item, index) => ({ id: item.id ?? `series_${index + 1}`, label: item.name ?? `Серия ${index + 1}`, color: item.color ?? C.blue, shape: 'circle' }));
  }
  if (type === 'info') {
    return (template.document?.sections ?? []).map((item, index) => ({ id: item.id ?? `section_${index + 1}`, label: item.title ?? `Раздел ${index + 1}`, color: item.color ?? C.blue, shape: 'square' }));
  }
  const labels = { core:'Ядро', group:'Группа', node:'Узел', accent:'Акцент', category:'Категория', cause:'Причина', process:'Процесс', decision:'Решение', chance:'Событие', outcome:'Исход', start:'Начало', end:'Завершение', input:'Ввод', output:'Вывод' };
  const byType = new Map();
  for (const node of template.nodes ?? []) {
    const key = node.type ?? 'node';
    if (!byType.has(key)) byType.set(key, node);
  }
  let items = [...byType.entries()].slice(0, 8).map(([typeId, node]) => ({ id: typeId, label: labels[typeId] ?? typeId, color: node.color ?? C.blue, shape: node.shape === 'diamond' ? 'diamond' : 'circle' }));
  if (items.length <= 1) {
    items = (template.nodes ?? []).slice(0, 6).map((node, index) => ({ id: node.id ?? `item_${index + 1}`, label: node.name ?? `Элемент ${index + 1}`, color: node.color ?? C.blue, shape: 'circle' }));
  }
  return items;
}
