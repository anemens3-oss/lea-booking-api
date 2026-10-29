/**
 * Типы для Cloudflare Worker, Cloudflare D1 и API системы бронирования LÉA
 */

export interface D1Meta {
  changes: number;
  duration?: number;
  last_row_id?: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface WorkerEnv {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  ALLOWED_ORIGIN?: string;
  SALON_TIMEZONE?: string;
  /** Опциональная функция fetch для тестирования отправки в Telegram */
   customFetch?: typeof fetch;
  /** Опциональное фиксированное время для детерминированных тестов (ISO строка) */
   currentTimeOverride?: string;
}

export interface DbServiceRow {
  id: string;
  category: 'manicure' | 'brows' | 'facial';
  category_label: string;
  title: string;
  description: string;
  price_rub: number;
  duration_minutes: number;
  is_active: number;
  sort_order: number;
}

export interface DbWorkingHoursRow {
  day_of_week: number;
  open_time: string;
  close_time: string;
  break_start: string | null;
  break_end: string | null;
  is_closed: number;
}

export interface DbBookingRow {
  id: string;
  idempotency_key: string;
  first_name: string;
  last_name: string;
  phone: string;
  service_id: string;
  staff_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  start_minutes: number;
  end_minutes: number;
  price_rub: number;
  duration_minutes: number;
  status: 'confirmed' | 'cancelled';
  consent_accepted: number;
  telegram_status: 'pending' | 'sent' | 'failed' | 'skipped';
  telegram_attempts: number;
  telegram_last_error: string | null;
  created_at: string;
}

export interface TimeSlotDto {
  startTime: string;
  endTime: string;
  label: string;
}

export interface CreateBookingPayload {
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  serviceId?: unknown;
  staffId?: unknown;
  date?: unknown;
  time?: unknown;
  consentAccepted?: unknown;
  idempotencyKey?: unknown;
}
