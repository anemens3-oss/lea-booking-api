-- ============================================================================
-- LÉA Beauty Studio — Схема базы данных Cloudflare D1 (SQLite)
-- Файл миграции: migrations/0001_init.sql
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Таблица услуг (services)
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('manicure', 'brows', 'facial')),
  category_label TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_rub INTEGER NOT NULL CHECK (price_rub >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 360),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 2. Таблица мастеров (staff) — поддержка одного или нескольких специалистов
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  default_category TEXT NOT NULL CHECK (default_category IN ('manicure', 'brows', 'facial')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 3. Таблица расписания и перерывов салона (working_hours)
-- day_of_week: 0 = Воскресенье, 1 = Понедельник, ..., 6 = Суббота
CREATE TABLE IF NOT EXISTS working_hours (
  day_of_week INTEGER PRIMARY KEY CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TEXT NOT NULL,
  close_time TEXT NOT NULL,
  break_start TEXT,
  break_end TEXT,
  is_closed INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1))
);

-- 4. Таблица бронирований (bookings)
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service_id TEXT NOT NULL,
  staff_id TEXT NOT NULL DEFAULT 'any',
  booking_date TEXT NOT NULL, -- Формат YYYY-MM-DD
  start_time TEXT NOT NULL,   -- Формат HH:MM
  end_time TEXT NOT NULL,     -- Формат HH:MM
  start_minutes INTEGER NOT NULL CHECK (start_minutes >= 0 AND start_minutes < 1440),
  end_minutes INTEGER NOT NULL CHECK (end_minutes > start_minutes AND end_minutes <= 1440),
  price_rub INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  consent_accepted INTEGER NOT NULL DEFAULT 1 CHECK (consent_accepted = 1),
  telegram_status TEXT NOT NULL DEFAULT 'pending' CHECK (telegram_status IN ('pending', 'sent', 'failed', 'skipped')),
  telegram_attempts INTEGER NOT NULL DEFAULT 0,
  telegram_last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

-- Индексы для быстрой проверки пересечений интервалов и защиты от гонок
CREATE INDEX IF NOT EXISTS idx_bookings_date_status_staff
  ON bookings (booking_date, status, staff_id, start_minutes, end_minutes);

CREATE INDEX IF NOT EXISTS idx_bookings_telegram_status
  ON bookings (telegram_status, created_at);

-- 5. Журнал отправки уведомлений в Telegram (notification_logs)
CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,
  attempted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

-- ============================================================================
-- Начальные данные (Seed)
-- ============================================================================

INSERT OR IGNORE INTO services (id, category, category_label, title, description, price_rub, duration_minutes, is_active, sort_order) VALUES
  ('manicure-clean', 'manicure', 'Маникюр', 'Маникюр без покрытия', 'Бережная обработка кутикулы, придание естественной формы ногтям и лёгкий питательный уход маслом.', 900, 40, 1, 1),
  ('manicure-gel', 'manicure', 'Маникюр', 'Маникюр с гель-лаком', 'Аккуратная обработка, выравнивание ногтевой пластины и тонкое покрытие в молочных, нюдовых или классических оттенках.', 1700, 90, 1, 2),
  ('manicure-removal', 'manicure', 'Маникюр', 'Снятие покрытия', 'Деликатное снятие предыдущего материала без перегрева и повреждения натуральной пластины.', 300, 20, 1, 3),
  ('manicure-strength', 'manicure', 'Маникюр', 'Укрепление ногтей', 'Дополнительная защита тонких и ломких ногтей пластичным гелем или пудрой с сохранением естественной толщины.', 500, 30, 1, 4),
  ('brows-shaping', 'brows', 'Брови и ресницы', 'Коррекция бровей', 'Подбор мягкой формы с учётом черт лица, бережное удаление лишних волосков пинцетом или воском.', 700, 30, 1, 5),
  ('brows-tint', 'brows', 'Брови и ресницы', 'Коррекция и окрашивание', 'Создание гармоничной формы и мягкого оттенка без чётких графичных границ и перетемнения.', 1200, 45, 1, 6),
  ('brows-lamination', 'brows', 'Брови и ресницы', 'Ламинирование бровей', 'Деликатная укладка непослушных волосков с питательным составом для аккуратной формы на каждый день.', 1800, 60, 1, 7),
  ('lashes-lamination', 'brows', 'Брови и ресницы', 'Ламинирование ресниц', 'Естественный изгиб, визуальное удлинение и окрашивание натуральных ресниц с уходовым комплексом.', 2000, 60, 1, 8),
  ('facial-hydrating', 'facial', 'Уход за лицом', 'Увлажняющий уход', 'Мягкое очищение, тонизирование и глубокое увлажнение сывороткой и альгинатной маской для свежести кожи.', 2000, 45, 1, 9),
  ('facial-delicate', 'facial', 'Уход за лицом', 'Деликатный уход', 'Расслабляющий ритуал для чувствительной кожи с мягким лимфодренажным массажем и восстанавливающим кремом.', 2500, 60, 1, 10);

INSERT OR IGNORE INTO staff (id, name, role, default_category, is_active) VALUES
  ('master-anna', 'Анна', 'Мастер маникюра', 'manicure', 1),
  ('master-maria', 'Мария', 'Мастер оформления бровей', 'brows', 1),
  ('master-elena', 'Елена', 'Специалист по уходовым процедурам', 'facial', 1);

-- Расписание салона: ежедневно с 10:00 до 21:00, перерыв на проветривание и обработку с 14:30 до 15:00
INSERT OR IGNORE INTO working_hours (day_of_week, open_time, close_time, break_start, break_end, is_closed) VALUES
  (0, '10:00', '21:00', '14:30', '15:00', 0),
  (1, '10:00', '21:00', '14:30', '15:00', 0),
  (2, '10:00', '21:00', '14:30', '15:00', 0),
  (3, '10:00', '21:00', '14:30', '15:00', 0),
  (4, '10:00', '21:00', '14:30', '15:00', 0),
  (5, '10:00', '21:00', '14:30', '15:00', 0),
  (6, '10:00', '21:00', '14:30', '15:00', 0);
