import {
  WorkerEnv,
  DbServiceRow,
  DbWorkingHoursRow,
  DbBookingRow,
  TimeSlotDto,
  CreateBookingPayload,
} from './types';

// Интервал шага сетки слотов (в минутах)
const SLOT_STEP_MINUTES = 30;
// Максимальный горизонт записи вперёд (в днях)
const MAX_BOOKING_DAYS_AHEAD = 60;

// Очередь сериализации конкурентных запросов в рамках одного процесса/изолята
const dateLocks = new Map<string, Promise<unknown>>();

async function withDateLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = dateLocks.get(lockKey) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = prev.then(() => current);
  dateLocks.set(lockKey, chained);

  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (dateLocks.get(lockKey) === chained) {
      dateLocks.delete(lockKey);
    }
  }
}

// Защита от спама и слишком частых запросов (Rate Limiter по IP)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 минута
const RATE_LIMIT_MAX_POST = 15; // максимум 15 попыток бронирования в минуту с одного IP

export function checkRateLimit(clientKey: string, maxRequests = RATE_LIMIT_MAX_POST): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(clientKey);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

export function resetRateLimiterForTests(): void {
  rateLimitStore.clear();
}

/**
 * Перевод строки "HH:MM" в количество минут от 00:00
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  if (typeof timeStr !== 'string') return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeStr.trim());
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Перевод минут от 00:00 в строку "HH:MM"
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Получение текущей даты (YYYY-MM-DD) и времени (в минутах от 00:00) во временной зоне салона
 */
export function getSalonNow(env: WorkerEnv): { dateStr: string; minutesNow: number; nowDate: Date } {
  const timeZone = env.SALON_TIMEZONE || 'Europe/Moscow';
  const now = env.currentTimeOverride ? new Date(env.currentTimeOverride) : new Date();

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const year = map.year;
  const month = map.month;
  const day = map.day;
  const hour = parseInt(map.hour === '24' ? '00' : map.hour, 10);
  const minute = parseInt(map.minute, 10);

  return {
    dateStr: `${year}-${month}-${day}`,
    minutesNow: hour * 60 + minute,
    nowDate: now,
  };
}

/**
 * Проверка корректности календарной даты YYYY-MM-DD и вычисление дня недели (0..6)
 */
export function parseValidDateString(dateStr: string): { valid: boolean; dayOfWeek: number } {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, dayOfWeek: -1 };
  }
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== m ||
    dt.getUTCDate() !== d
  ) {
    return { valid: false, dayOfWeek: -1 };
  }
  return { valid: true, dayOfWeek: dt.getUTCDay() };
}

/**
 * Нормализация и валидация телефона (поддержка российских и международных номеров)
 */
export function validateAndNormalizePhone(rawPhone: unknown): {
  valid: boolean;
  normalized: string;
  displayPhone: string;
  error?: string;
} {
  if (typeof rawPhone !== 'string' || !rawPhone.trim()) {
    return {
      valid: false,
      normalized: '',
      displayPhone: '',
      error: 'Укажите номер телефона для связи.',
    };
  }

  const trimmed = rawPhone.trim();
  // Разрешаем только цифры, пробелы, +, -, скобки
  if (!/^[+\d\s()-]+$/.test(trimmed)) {
    return {
      valid: false,
      normalized: '',
      displayPhone: '',
      error: 'Номер телефона содержит недопустимые символы.',
    };
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    return {
      valid: false,
      normalized: '',
      displayPhone: '',
      error: 'Введите корректный номер телефона (от 10 до 15 цифр, например +7 900 123-45-67).',
    };
  }

  // Нормализация российских 10/11-значных номеров
  let normalizedDigits = digits;
  if (digits.length === 10 && digits.startsWith('9')) {
    normalizedDigits = '7' + digits;
  } else if (digits.length === 11 && digits.startsWith('8')) {
    normalizedDigits = '7' + digits.slice(1);
  }

  // Проверка российских номеров: после кода 7 должно быть 10 цифр, не все нули
  if (normalizedDigits.startsWith('7') && normalizedDigits.length === 11) {
    const subscriber = normalizedDigits.slice(1);
    if (/^0+$/.test(subscriber)) {
      return {
        valid: false,
        normalized: '',
        displayPhone: '',
        error: 'Указан тестовый номер из нулей. Пожалуйста, введите настоящий номер телефона.',
      };
    }
    const formatted = `+7 ${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)}-${subscriber.slice(6, 8)}-${subscriber.slice(8, 10)}`;
    return {
      valid: true,
      normalized: `+${normalizedDigits}`,
      displayPhone: formatted,
    };
  }

  if (/^0+$/.test(normalizedDigits)) {
    return {
      valid: false,
      normalized: '',
      displayPhone: '',
      error: 'Введите корректный номер телефона.',
    };
  }

  return {
    valid: true,
    normalized: `+${normalizedDigits}`,
    displayPhone: `+${normalizedDigits}`,
  };
}

/**
 * Форматирование даты YYYY-MM-DD на русском языке для Telegram ("5 ноября 2026")
 */
export function formatRussianDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  const months = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ];
  return `${d} ${months[m - 1] || ''} ${y}`;
}

/**
 * Маскирование секретных токенов в текстах ошибок
 */
function sanitizeErrorMessage(err: unknown, secretToken?: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (secretToken && secretToken.length > 4) {
    return raw.split(secretToken).join('[REDACTED_TOKEN]');
  }
  return raw.slice(0, 300);
}

/**
 * Генерация детерминированного ключа идемпотентности при отсутствии клиентского ключа
 */
async function computeFallbackIdempotencyKey(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join('|'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return 'idem_' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * 1. GET /api/services — Получение списка активных услуг из D1
 */
export async function getActiveServices(env: WorkerEnv) {
  if (!env.DB) {
    throw new Error('DB_UNAVAILABLE');
  }

  const { results } = await env.DB.prepare(
    `SELECT id, category, category_label, title, description, price_rub, duration_minutes, is_active, sort_order
     FROM services
     WHERE is_active = 1
     ORDER BY sort_order ASC, title ASC`
  ).all<DbServiceRow>();

  return results.map((row) => ({
    id: row.id,
    category: row.category,
    categoryLabel: row.category_label,
    title: row.title,
    description: row.description,
    priceRub: row.price_rub,
    priceFormatted: `${row.price_rub.toLocaleString('ru-RU')} ₽`,
    durationMinutes: row.duration_minutes,
    durationFormatted: `${row.duration_minutes} минут`,
  }));
}

/**
 * 2. Вычисление реально свободных интервалов на дату для выбранной услуги (и опционально мастера)
 */
export async function getAvailableSlots(
  env: WorkerEnv,
  dateStr: string,
  serviceId: string,
  staffId = 'any'
): Promise<{
  date: string;
  service: {
    id: string;
    title: string;
    priceRub: number;
    durationMinutes: number;
  };
  slots: TimeSlotDto[];
  isClosedDate: boolean;
  reason?: string;
}> {
  if (!env.DB) {
    throw new Error('DB_UNAVAILABLE');
  }

  const parsedDate = parseValidDateString(dateStr);
  if (!parsedDate.valid) {
    throw new ValidationError('Некорректный формат даты. Используйте YYYY-MM-DD.', 400);
  }

  const { dateStr: todaySalon, minutesNow } = getSalonNow(env);
  if (dateStr < todaySalon) {
    throw new ValidationError('Нельзя выбрать прошедшую дату.', 400);
  }

  // Проверка максимального горизонта записи
  const [ty, tm, td] = todaySalon.split('-').map(Number);
  const [ry, rm, rd] = dateStr.split('-').map(Number);
  const diffDays = Math.round(
    (Date.UTC(ry, rm - 1, rd) - Date.UTC(ty, tm - 1, td)) / (1000 * 60 * 60 * 24)
  );
  if (diffDays > MAX_BOOKING_DAYS_AHEAD) {
    throw new ValidationError(`Запись открыта максимум на ${MAX_BOOKING_DAYS_AHEAD} дней вперёд.`, 400);
  }

  // Получаем услугу из БД
  const service = await env.DB.prepare(
    `SELECT id, category, category_label, title, description, price_rub, duration_minutes, is_active, sort_order
     FROM services
     WHERE id = ?1 AND is_active = 1`
  )
    .bind(serviceId)
    .first<DbServiceRow>();

  if (!service) {
    throw new ValidationError('Выбранная услуга не найдена или временно недоступна.', 404);
  }

  // Получаем рабочие часы на день недели
  const schedule = await env.DB.prepare(
    `SELECT day_of_week, open_time, close_time, break_start, break_end, is_closed
     FROM working_hours
     WHERE day_of_week = ?1`
  )
    .bind(parsedDate.dayOfWeek)
    .first<DbWorkingHoursRow>();

  if (!schedule || schedule.is_closed === 1) {
    return {
      date: dateStr,
      service: {
        id: service.id,
        title: service.title,
        priceRub: service.price_rub,
        durationMinutes: service.duration_minutes,
      },
      slots: [],
      isClosedDate: true,
      reason: 'В выбранный день студия не работает.',
    };
  }

  const openMinutes = parseTimeToMinutes(schedule.open_time) ?? 600;
  const closeMinutes = parseTimeToMinutes(schedule.close_time) ?? 1260;
  const breakStart = schedule.break_start ? parseTimeToMinutes(schedule.break_start) : null;
  const breakEnd = schedule.break_end ? parseTimeToMinutes(schedule.break_end) : null;

  // Получаем все подтверждённые записи на эту дату, которые могут пересекаться по мастеру
  const normalizedStaffId = staffId && staffId.trim() ? staffId.trim() : 'any';
  const { results: existingBookings } = await env.DB.prepare(
    `SELECT start_minutes, end_minutes, staff_id
     FROM bookings
     WHERE booking_date = ?1
       AND status = 'confirmed'
       AND (staff_id = 'any' OR ?2 = 'any' OR staff_id = ?2)
     ORDER BY start_minutes ASC`
  )
    .bind(dateStr, normalizedStaffId)
    .all<{ start_minutes: number; end_minutes: number; staff_id: string }>();

  const slots: TimeSlotDto[] = [];
  const duration = service.duration_minutes;

  for (
    let startMin = openMinutes;
    startMin + duration <= closeMinutes;
    startMin += SLOT_STEP_MINUTES
  ) {
    const endMin = startMin + duration;

    // 1. Если выбран сегодняшний день — не отдаём слоты в прошлом
    if (dateStr === todaySalon && startMin <= minutesNow) {
      continue;
    }

    // 2. Проверка пересечения с техническим перерывом студии
    if (
      breakStart !== null &&
      breakEnd !== null &&
      startMin < breakEnd &&
      endMin > breakStart
    ) {
      continue;
    }

    // 3. Проверка пересечения с существующими записями в D1
    const hasOverlap = existingBookings.some(
      (b) => startMin < b.end_minutes && endMin > b.start_minutes
    );
    if (hasOverlap) {
      continue;
    }

    const startTime = formatMinutesToTime(startMin);
    const endTime = formatMinutesToTime(endMin);
    slots.push({
      startTime,
      endTime,
      label: `${startTime}–${endTime}`,
    });
  }

  return {
    date: dateStr,
    service: {
      id: service.id,
      title: service.title,
      priceRub: service.price_rub,
      durationMinutes: service.duration_minutes,
    },
    slots,
    isClosedDate: false,
  };
}

export class ValidationError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = 'VALIDATION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * 3. POST /api/bookings — Валидация, атомарная защита от двойного бронирования, сохранение в D1 и отправка в Telegram
 */
export async function createBooking(
  env: WorkerEnv,
  payload: CreateBookingPayload
): Promise<{
  statusCode: number;
  body: {
    ok: boolean;
    idempotent?: boolean;
    booking: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      serviceId: string;
      serviceTitle: string;
      priceRub: number;
      durationMinutes: number;
      staffId: string;
      date: string;
      startTime: string;
      endTime: string;
      status: string;
      telegramNotification: 'sent' | 'failed' | 'skipped' | 'pending';
    };
    message: string;
  };
}> {
  if (!env.DB) {
    throw new Error('DB_UNAVAILABLE');
  }

  // 1. Валидация имени и фамилии
  const firstName = typeof payload.firstName === 'string' ? payload.firstName.trim() : '';
  const lastName = typeof payload.lastName === 'string' ? payload.lastName.trim() : '';

  if (!firstName || firstName.length < 2 || firstName.length > 60) {
    throw new ValidationError('Укажите корректное имя (от 2 до 60 символов).', 400);
  }
  if (!lastName || lastName.length < 2 || lastName.length > 60) {
    throw new ValidationError('Укажите корректную фамилию (от 2 до 60 символов).', 400);
  }
  if (!/^[a-zA-Zа-яА-ЯёЁ\s-]+$/.test(firstName) || !/^[a-zA-Zа-яА-ЯёЁ\s-]+$/.test(lastName)) {
    throw new ValidationError('Имя и фамилия могут содержать только буквы, пробел и дефис.', 400);
  }

  // 2. Валидация согласия на обработку персональных данных
  if (payload.consentAccepted !== true) {
    throw new ValidationError(
      'Необходимо согласие на обработку персональных данных.',
      400
    );
  }

  // 3. Валидация телефона
  const phoneValidation = validateAndNormalizePhone(payload.phone);
  if (!phoneValidation.valid) {
    throw new ValidationError(phoneValidation.error || 'Некорректный номер телефона.', 400);
  }

  // 4. Валидация ID услуги, даты и времени
  const serviceId = typeof payload.serviceId === 'string' ? payload.serviceId.trim() : '';
  const dateStr = typeof payload.date === 'string' ? payload.date.trim() : '';
  const timeStr = typeof payload.time === 'string' ? payload.time.trim() : '';
  const rawStaffId =
    typeof payload.staffId === 'string' && payload.staffId.trim()
      ? payload.staffId.trim()
      : 'any';

  if (!serviceId) {
    throw new ValidationError('Выберите услугу.', 400);
  }
  const parsedDate = parseValidDateString(dateStr);
  if (!parsedDate.valid) {
    throw new ValidationError('Укажите корректную дату визита (YYYY-MM-DD).', 400);
  }
  const startMinutes = parseTimeToMinutes(timeStr);
  if (startMinutes === null) {
    throw new ValidationError('Укажите корректное время начала визита (HH:MM).', 400);
  }

  // Проверка временной зоны салона: запрет записи в прошлое
  const { dateStr: todaySalon, minutesNow } = getSalonNow(env);
  if (dateStr < todaySalon) {
    throw new ValidationError('Нельзя оформить запись на прошедшую дату.', 400);
  }
  if (dateStr === todaySalon && startMinutes <= minutesNow) {
    throw new ValidationError('Выбранное время уже прошло. Пожалуйста, выберите более поздний слот.', 400);
  }

  // Проверка горизонта записи
  const [ty, tm, td] = todaySalon.split('-').map(Number);
  const [ry, rm, rd] = dateStr.split('-').map(Number);
  const diffDays = Math.round(
    (Date.UTC(ry, rm - 1, rd) - Date.UTC(ty, tm - 1, td)) / (1000 * 60 * 60 * 24)
  );
  if (diffDays > MAX_BOOKING_DAYS_AHEAD) {
    throw new ValidationError(`Запись доступна максимум на ${MAX_BOOKING_DAYS_AHEAD} дней вперёд.`, 400);
  }

  // Проверка мастера, если он указан явно
  if (rawStaffId !== 'any') {
    const staffExists = await env.DB.prepare(
      `SELECT id FROM staff WHERE id = ?1 AND is_active = 1`
    )
      .bind(rawStaffId)
      .first<{ id: string }>();
    if (!staffExists) {
      throw new ValidationError('Выбранный специалист не найден.', 400);
    }
  }

  // 5. Получаем услугу и её реальную длительность и стоимость из базы данных (не доверяем клиенту)
  const service = await env.DB.prepare(
    `SELECT id, category, category_label, title, description, price_rub, duration_minutes, is_active, sort_order
     FROM services
     WHERE id = ?1 AND is_active = 1`
  )
    .bind(serviceId)
    .first<DbServiceRow>();

  if (!service) {
    throw new ValidationError('Выбранная услуга не найдена или более не активна.', 404);
  }

  const endMinutes = startMinutes + service.duration_minutes;
  const endTimeStr = formatMinutesToTime(endMinutes);

  // 6. Проверяем расписание работы студии и перерыв
  const schedule = await env.DB.prepare(
    `SELECT day_of_week, open_time, close_time, break_start, break_end, is_closed
     FROM working_hours
     WHERE day_of_week = ?1`
  )
    .bind(parsedDate.dayOfWeek)
    .first<DbWorkingHoursRow>();

  if (!schedule || schedule.is_closed === 1) {
    throw new ValidationError('В выбранный день студия закрыта.', 400);
  }

  const openMinutes = parseTimeToMinutes(schedule.open_time) ?? 600;
  const closeMinutes = parseTimeToMinutes(schedule.close_time) ?? 1260;
  const breakStart = schedule.break_start ? parseTimeToMinutes(schedule.break_start) : null;
  const breakEnd = schedule.break_end ? parseTimeToMinutes(schedule.break_end) : null;

  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    throw new ValidationError(
      `Услуга длительностью ${service.duration_minutes} мин. выходит за пределы рабочего времени студии (${schedule.open_time}–${schedule.close_time}).`,
      400
    );
  }

  if (
    breakStart !== null &&
    breakEnd !== null &&
    startMinutes < breakEnd &&
    endMinutes > breakStart
  ) {
    throw new ValidationError(
      `Выбранный интервал (${timeStr}–${endTimeStr}) пересекается с техническим перерывом студии (${schedule.break_start}–${schedule.break_end}).`,
      400
    );
  }

  // Проверка кратности шагу сетки (например, каждые 30 минут от открытия)
  if ((startMinutes - openMinutes) % SLOT_STEP_MINUTES !== 0) {
    throw new ValidationError('Недопустимый шаг времени начала записи.', 400);
  }

  // 7. Ключ идемпотентности для защиты от повторной отправки одного и того же запроса
  const clientIdemKey =
    typeof payload.idempotencyKey === 'string' && payload.idempotencyKey.trim().length >= 8
      ? payload.idempotencyKey.trim().slice(0, 100)
      : await computeFallbackIdempotencyKey([
          phoneValidation.normalized,
          service.id,
          rawStaffId,
          dateStr,
          timeStr,
        ]);

  // 8. Сериализация и атомарная запись в базу данных D1 с защитой от гонок (race conditions)
  const bookingResult = await withDateLock(dateStr, async () => {
    // 8a. Проверяем, не был ли этот же запрос уже успешно обработан (идемпотентность)
    const existingByIdem = await env.DB.prepare(
      `SELECT * FROM bookings WHERE idempotency_key = ?1`
    )
      .bind(clientIdemKey)
      .first<DbBookingRow>();

    if (existingByIdem && existingByIdem.status === 'confirmed') {
      return {
        isIdempotentReplay: true,
        bookingRow: existingByIdem,
      };
    }

    const bookingId = `LEA-${dateStr.replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // 8b. Атомарный INSERT ... SELECT ... WHERE NOT EXISTS (...)
    // Гарантирует на уровне движка SQLite / Cloudflare D1, что два конкурентных запроса
    // на пересекающийся интервал не смогут оба вставить строку.
    const insertResult = await env.DB.prepare(
      `INSERT INTO bookings (
        id, idempotency_key, first_name, last_name, phone,
        service_id, staff_id, booking_date, start_time, end_time,
        start_minutes, end_minutes, price_rub, duration_minutes,
        status, consent_accepted, telegram_status
      )
      SELECT
        ?1, ?2, ?3, ?4, ?5,
        ?6, ?7, ?8, ?9, ?10,
        ?11, ?12, ?13, ?14,
        'confirmed', 1, 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM bookings
        WHERE booking_date = ?8
          AND status = 'confirmed'
          AND (staff_id = 'any' OR ?7 = 'any' OR staff_id = ?7)
          AND start_minutes < ?12
          AND end_minutes > ?11
      )`
    )
      .bind(
        bookingId,
        clientIdemKey,
        firstName,
        lastName,
        phoneValidation.displayPhone,
        service.id,
        rawStaffId,
        dateStr,
        timeStr,
        endTimeStr,
        startMinutes,
        endMinutes,
        service.price_rub,
        service.duration_minutes
      )
      .run();

    if (!insertResult.meta || insertResult.meta.changes === 0) {
      // Проверяем ещё раз по idempotency_key на случай параллельного дубля того же запроса
      const replayRow = await env.DB.prepare(
        `SELECT * FROM bookings WHERE idempotency_key = ?1 AND status = 'confirmed'`
      )
        .bind(clientIdemKey)
        .first<DbBookingRow>();

      if (replayRow) {
        return {
          isIdempotentReplay: true,
          bookingRow: replayRow,
        };
      }

      throw new ValidationError(
        'К сожалению, выбранный интервал времени только что был занят другим клиентом. Пожалуйста, выберите другое доступное время.',
        409,
        'SLOT_CONFLICT'
      );
    }

    const insertedRow = await env.DB.prepare(`SELECT * FROM bookings WHERE id = ?1`)
      .bind(bookingId)
      .first<DbBookingRow>();

    if (!insertedRow) {
      throw new Error('DB_READ_AFTER_WRITE_FAILED');
    }

    return {
      isIdempotentReplay: false,
      bookingRow: insertedRow,
    };
  });

  // Если это повторная отправка уже созданной записи — возвращаем её без дублирования Telegram-уведомления
  if (bookingResult.isIdempotentReplay) {
    const row = bookingResult.bookingRow;
    return {
      statusCode: 200,
      body: {
        ok: true,
        idempotent: true,
        booking: {
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          phone: row.phone,
          serviceId: row.service_id,
          serviceTitle: service.title,
          priceRub: row.price_rub,
          durationMinutes: row.duration_minutes,
          staffId: row.staff_id,
          date: row.booking_date,
          startTime: row.start_time,
          endTime: row.end_time,
          status: row.status,
          telegramNotification: row.telegram_status,
        },
        message: 'Запись уже была успешно подтверждена ранее.',
      },
    };
  }

  // 9. Отправка уведомления администратору в Telegram ТОЛЬКО после успешного сохранения в БД
  const row = bookingResult.bookingRow;
  const telegramStatus = await sendTelegramBookingNotification(env, row, service.title);

  return {
    statusCode: 201,
    body: {
      ok: true,
      idempotent: false,
      booking: {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        serviceId: row.service_id,
        serviceTitle: service.title,
        priceRub: row.price_rub,
        durationMinutes: row.duration_minutes,
        staffId: row.staff_id,
        date: row.booking_date,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        telegramNotification: telegramStatus,
      },
      message: 'Ваша запись подтверждена. Ждём вас в студии LÉA!',
    },
  };
}

/**
 * Отправка уведомления в Telegram с безопасным сохранением статуса и журналом ошибок.
 * Никогда не отменяет и не удаляет уже сохранённую запись при сбое Telegram.
 */
export async function sendTelegramBookingNotification(
  env: WorkerEnv,
  booking: DbBookingRow,
  serviceTitle: string
): Promise<'sent' | 'failed' | 'skipped'> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    // Если секреты ещё не заданы (например, локальная разработка), фиксируем статус 'skipped'
    try {
      await env.DB.prepare(
        `UPDATE bookings
         SET telegram_status = 'skipped',
             telegram_attempts = telegram_attempts + 1,
             telegram_last_error = 'TELEGRAM_SECRETS_NOT_CONFIGURED'
         WHERE id = ?1`
      )
        .bind(booking.id)
        .run();

      await env.DB.prepare(
        `INSERT INTO notification_logs (booking_id, status, error_message)
         VALUES (?1, 'skipped', 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured')`
      )
        .bind(booking.id)
        .run();
    } catch {
      // Игнорируем ошибку логирования, чтобы не затронуть ответ клиенту
    }
    return 'skipped';
  }

  const text = [
    'НОВАЯ ЗАПИСЬ — LÉA',
    '',
    `Клиент: ${booking.first_name} ${booking.last_name}`,
    `Телефон: ${booking.phone}`,
    `Услуга: ${serviceTitle}`,
    `Дата: ${formatRussianDate(booking.booking_date)}`,
    `Время: ${booking.start_time}–${booking.end_time}`,
    `ID записи: ${booking.id}`,
  ].join('\n');

  const fetchImpl = env.customFetch || fetch;
  const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await fetchImpl(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`Telegram API HTTP ${response.status}: ${errBody}`);
    }

    await env.DB.prepare(
      `UPDATE bookings
       SET telegram_status = 'sent',
           telegram_attempts = telegram_attempts + 1,
           telegram_last_error = NULL
       WHERE id = ?1`
    )
      .bind(booking.id)
      .run();

    await env.DB.prepare(
      `INSERT INTO notification_logs (booking_id, status, error_message)
       VALUES (?1, 'sent', NULL)`
    )
      .bind(booking.id)
      .run();

    return 'sent';
  } catch (err) {
    const safeError = sanitizeErrorMessage(err, token);
    try {
      await env.DB.prepare(
        `UPDATE bookings
         SET telegram_status = 'failed',
             telegram_attempts = telegram_attempts + 1,
             telegram_last_error = ?2
         WHERE id = ?1`
      )
        .bind(booking.id, safeError)
        .run();

      await env.DB.prepare(
        `INSERT INTO notification_logs (booking_id, status, error_message)
         VALUES (?1, 'failed', ?2)`
      )
        .bind(booking.id, safeError)
        .run();
    } catch {
      // Запись в БД уже сохранена, не прерываем выполнение
    }
    return 'failed';
  }
}

/**
 * Безопасный механизм повторной отправки недоставленных Telegram-уведомлений
 */
export async function retryFailedTelegramNotifications(env: WorkerEnv): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  if (!env.DB) {
    throw new Error('DB_UNAVAILABLE');
  }

  const { results } = await env.DB.prepare(
    `SELECT b.*, s.title as service_title
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     WHERE b.status = 'confirmed'
       AND b.telegram_status = 'failed'
       AND b.telegram_attempts < 5
     ORDER BY b.created_at ASC
     LIMIT 10`
  ).all<DbBookingRow & { service_title: string }>();

  let sent = 0;
  let failed = 0;

  for (const row of results) {
    const status = await sendTelegramBookingNotification(env, row, row.service_title);
    if (status === 'sent') {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return {
    processed: results.length,
    sent,
    failed,
  };
}
