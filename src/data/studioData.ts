export type ServiceCategory = 'all' | 'manicure' | 'brows' | 'facial';

export interface ServiceItem {
  id: string;
  category: Exclude<ServiceCategory, 'all'>;
  categoryLabel: string;
  title: string;
  description: string;
  duration: string;
  price: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  caption: string;
  src: string;
  alt: string;
  aspectClass: string;
}

export interface MasterItem {
  id: string;
  name: string;
  role: string;
  approach: string;
  defaultCategory: Exclude<ServiceCategory, 'all'>;
  src: string;
  alt: string;
}

export interface ReviewItem {
  id: string;
  author: string;
  serviceNote: string;
  text: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const SERVICE_CATEGORIES: { id: ServiceCategory; label: string }[] = [
  { id: 'all', label: 'Все услуги' },
  { id: 'manicure', label: 'Маникюр' },
  { id: 'brows', label: 'Брови и ресницы' },
  { id: 'facial', label: 'Уход за лицом' },
];

export const SERVICES: ServiceItem[] = [
  // Маникюр
  {
    id: 'manicure-clean',
    category: 'manicure',
    categoryLabel: 'Маникюр',
    title: 'Маникюр без покрытия',
    description: 'Бережная обработка кутикулы, придание естественной формы ногтям и лёгкий питательный уход маслом.',
    duration: '40 минут',
    price: '900 ₽',
  },
  {
    id: 'manicure-gel',
    category: 'manicure',
    categoryLabel: 'Маникюр',
    title: 'Маникюр с гель-лаком',
    description: 'Аккуратная обработка, выравнивание ногтевой пластины и тонкое покрытие в молочных, нюдовых или классических оттенках.',
    duration: '90 минут',
    price: '1 700 ₽',
  },
  {
    id: 'manicure-removal',
    category: 'manicure',
    categoryLabel: 'Маникюр',
    title: 'Снятие покрытия',
    description: 'Деликатное снятие предыдущего материала без перегрева и повреждения натуральной пластины.',
    duration: '20 минут',
    price: '300 ₽',
  },
  {
    id: 'manicure-strength',
    category: 'manicure',
    categoryLabel: 'Маникюр',
    title: 'Укрепление ногтей',
    description: 'Дополнительная защита тонких и ломких ногтей пластичным гелем или пудрой с сохранением естественной толщины.',
    duration: '30 минут',
    price: '500 ₽',
  },

  // Брови и ресницы
  {
    id: 'brows-shaping',
    category: 'brows',
    categoryLabel: 'Брови и ресницы',
    title: 'Коррекция бровей',
    description: 'Подбор мягкой формы с учётом черт лица, бережное удаление лишних волосков пинцетом или воском.',
    duration: '30 минут',
    price: '700 ₽',
  },
  {
    id: 'brows-tint',
    category: 'brows',
    categoryLabel: 'Брови и ресницы',
    title: 'Коррекция и окрашивание',
    description: 'Создание гармоничной формы и мягкого оттенка без чётких графичных границ и перетемнения.',
    duration: '45 минут',
    price: '1 200 ₽',
  },
  {
    id: 'brows-lamination',
    category: 'brows',
    categoryLabel: 'Брови и ресницы',
    title: 'Ламинирование бровей',
    description: 'Деликатная укладка непослушных волосков с питательным составом для аккуратной формы на каждый день.',
    duration: '60 минут',
    price: '1 800 ₽',
  },
  {
    id: 'lashes-lamination',
    category: 'brows',
    categoryLabel: 'Брови и ресницы',
    title: 'Ламинирование ресниц',
    description: 'Естественный изгиб, визуальное удлинение и окрашивание натуральных ресниц с уходовым комплексом.',
    duration: '60 минут',
    price: '2 000 ₽',
  },

  // Уход за лицом
  {
    id: 'facial-hydrating',
    category: 'facial',
    categoryLabel: 'Уход за лицом',
    title: 'Увлажняющий уход',
    description: 'Мягкое очищение, тонизирование и глубокое увлажнение сывороткой и альгинатной маской для свежести кожи.',
    duration: '45 минут',
    price: '2 000 ₽',
  },
  {
    id: 'facial-delicate',
    category: 'facial',
    categoryLabel: 'Уход за лицом',
    title: 'Деликатный уход',
    description: 'Расслабляющий ритуал для чувствительной кожи с мягким лимфодренажным массажем и восстанавливающим кремом.',
    duration: '60 минут',
    price: '2 500 ₽',
  },
];

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'work-milky-nails',
    title: 'Маникюр в молочных оттенках',
    category: 'Маникюр',
    caption: 'Полупрозрачное молочное покрытие на короткой естественной длине.',
    src: '/assets/gallery-milky-nails.svg',
    alt: 'Крупный план аккуратного маникюра в молочном оттенке на фоне светлой керамической чашки',
    aspectClass: 'aspect-[3/4]',
  },
  {
    id: 'work-natural-brows',
    title: 'Естественные брови',
    category: 'Брови и ресницы',
    caption: 'Мягкая коррекция и воздушная укладка с сохранением природной текстуры.',
    src: '/assets/gallery-natural-brows.svg',
    alt: 'Естественное оформление бровей с мягкой текстурой волосков при дневном освещении',
    aspectClass: 'aspect-[4/3]',
  },
  {
    id: 'work-interior-details',
    title: 'Детали интерьера',
    category: 'Пространство студии',
    caption: 'Светлое дерево, травертин, керамика и рассеянный утренний свет.',
    src: '/assets/studio-interior.svg',
    alt: 'Светлый интерьер студии красоты с деревянным столом, сухоцветами в керамической вазе и мягким дневным светом',
    aspectClass: 'aspect-[4/3]',
  },
  {
    id: 'work-minimal-design',
    title: 'Аккуратные ногти с минималистичным дизайном',
    category: 'Маникюр',
    caption: 'Тонкий микро-френч оттенка тёплой слоновой кости на полупрозрачной базе.',
    src: '/assets/gallery-minimal-nails.svg',
    alt: 'Короткие ногти с минималистичным тонким френчем на светлой керамической тарелке',
    aspectClass: 'aspect-square',
  },
  {
    id: 'work-facial-care',
    title: 'Уход за лицом',
    category: 'Уходовые процедуры',
    caption: 'Спокойный ритуал увлажнения и восстановления тонуса кожи.',
    src: '/assets/gallery-facial-care.svg',
    alt: 'Керамическая чаша с увлажняющей маской, флакон сыворотки и хлопковое полотенце для ухода за лицом',
    aspectClass: 'aspect-[4/3]',
  },
  {
    id: 'work-master-process',
    title: 'Рабочий процесс мастера',
    category: 'Маникюр',
    caption: 'Подбор полупрозрачных оттенков на каменной палитре и подготовка инструментов.',
    src: '/assets/gallery-workspace-process.svg',
    alt: 'Рабочий стол мастера с палитрой молочных оттенков гель-лака и стерильным крафт-пакетом',
    aspectClass: 'aspect-[4/3]',
  },
];

export const MASTERS: MasterItem[] = [
  {
    id: 'master-anna',
    name: 'Анна',
    role: 'Мастер маникюра',
    approach:
      'Любит чистую форму, тонкое покрытие без лишнего объёма и спокойный темп работы. Всегда уточняет желаемую длину и плотность оттенка перед началом процедуры.',
    defaultCategory: 'manicure',
    src: '/assets/master-anna.svg',
    alt: 'Портрет мастера маникюра Анны в светлом льняном фартуке в интерьере студии',
  },
  {
    id: 'master-maria',
    name: 'Мария',
    role: 'Мастер оформления бровей',
    approach:
      'Работает с природной линией бровей, избегая резких графичных контуров. Подбирает мягкие оттенки красителя так, чтобы лицо выглядело свежим и отдохнувшим.',
    defaultCategory: 'brows',
    src: '/assets/master-maria.svg',
    alt: 'Портрет мастера оформления бровей Марии на фоне светлой стены студии',
  },
  {
    id: 'master-elena',
    name: 'Елена',
    role: 'Специалист по уходовым процедурам',
    approach:
      'Внимательно относится к состоянию и чувствительности кожи. Сочетает деликатные очищающие составы, увлажняющие сыворотки и мягкие массажные движения.',
    defaultCategory: 'facial',
    src: '/assets/master-elena.svg',
    alt: 'Портрет специалиста по уходу за лицом Елены в светлой минималистичной форме',
  },
];

export const REVIEWS: ReviewItem[] = [
  {
    id: 'review-alina',
    author: 'Алина',
    serviceNote: 'Маникюр с гель-лаком',
    text: '«Очень спокойная атмосфера, всё аккуратно и без спешки. Маникюр получился именно таким, как я хотела».',
  },
  {
    id: 'review-ksenia',
    author: 'Ксения',
    serviceNote: 'Коррекция и окрашивание бровей',
    text: '«Понравилось, что мастер сначала уточнила, какой результат мне нужен. Получилось естественно и красиво».',
  },
  {
    id: 'review-polina',
    author: 'Полина',
    serviceNote: 'Увлажняющий уход',
    text: '«Уютная студия, приятное общение и внимательное отношение к деталям. Обязательно приду ещё».',
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-advance',
    question: 'Нужно ли записываться заранее?',
    answer:
      'Да, мы работаем по предварительной записи, чтобы уделить каждому гостю достаточно времени без спешки и ожидания. Обычно удобное окно можно подобрать за 2–3 дня до визита, но если освобождается место день в день, мы с радостью примем вас.',
  },
  {
    id: 'faq-master',
    question: 'Можно ли выбрать конкретного мастера?',
    answer:
      'Конечно. При оформлении заявки на сайте или в сообщении вы можете указать имя специалиста. Если вы приходите впервые и не уверены в выборе, мы подскажем мастера под выбранную процедуру.',
  },
  {
    id: 'faq-duration',
    question: 'Сколько длится процедура?',
    answer:
      'Продолжительность зависит от выбранной услуги: например, маникюр без покрытия занимает около 40 минут, маникюр с гель-лаком — около 90 минут, а уходовые процедуры и оформление бровей — от 30 до 60 минут. Точное время указано рядом с каждой позицией в разделе цен.',
  },
  {
    id: 'faq-reschedule',
    question: 'Можно ли перенести запись?',
    answer:
      'Да, запись можно спокойно перенести или отменить. Мы будем признательны, если вы предупредите нас хотя бы за сутки или за несколько часов до визита — мы сразу предложим другое удобное время.',
  },
  {
    id: 'faq-prepare',
    question: 'Как подготовиться к первому посещению?',
    answer:
      'Специальной подготовки не требуется. Перед маникюром лучше не использовать жирный крем непосредственно перед выходом, а перед оформлением бровей или уходом за лицом мы сами бережно очистим кожу в студии.',
  },
];
