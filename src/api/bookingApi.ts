import { buildApiUrl, API_BASE_URL } from '../config';

export interface ApiServiceItem {
  id: string;
  category: 'manicure' | 'brows' | 'facial';
  categoryLabel: string;
  title: string;
  description: string;
  priceRub: number;
  priceFormatted: string;
  durationMinutes: number;
  durationFormatted: string;
}

export interface ApiTimeSlot {
  startTime: string;
  endTime: string;
  label: string;
}

export interface AvailabilityResponse {
  ok: boolean;
  date: string;
  service: {
    id: string;
    title: string;
    priceRub: number;
    durationMinutes: number;
  };
  slots: ApiTimeSlot[];
  isClosedDate: boolean;
  reason?: string;
  error?: string;
  code?: string;
}

export interface CreateBookingRequest {
  firstName: string;
  lastName: string;
  phone: string;
  serviceId: string;
  staffId?: string;
  date: string;
  time: string;
  consentAccepted: boolean;
  idempotencyKey: string;
}

export interface ConfirmedBookingDto {
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
}

export interface CreateBookingResponse {
  ok: boolean;
  idempotent?: boolean;
  booking?: ConfirmedBookingDto;
  message?: string;
  error?: string;
  code?: string;
}

export class ApiHttpError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = 'API_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseJsonSafely<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    const isGitHubPagesWithoutWorker =
      typeof window !== 'undefined' &&
      window.location.hostname.endsWith('github.io') &&
      !API_BASE_URL;

    if (isGitHubPagesWithoutWorker) {
      throw new ApiHttpError(
        'Сервер онлайн-записи (Cloudflare Worker) ещё не подключён в настройках сборки (VITE_API_BASE_URL). Укажите URL вашего Worker и пересоберите проект.',
        503,
        'WORKER_URL_NOT_CONFIGURED'
      );
    }

    throw new ApiHttpError(
      `Сервер вернул некорректный формат ответа (HTTP ${response.status}). Проверьте настройку VITE_API_BASE_URL.`,
      response.status,
      'NON_JSON_RESPONSE'
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiHttpError(
      'Ошибка чтения ответа сервера.',
      response.status,
      'INVALID_JSON_RESPONSE'
    );
  }
}

export async function fetchActiveServices(): Promise<ApiServiceItem[]> {
  const response = await fetch(buildApiUrl('/api/services'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const data = await parseJsonSafely<{
    ok: boolean;
    services?: ApiServiceItem[];
    error?: string;
    code?: string;
  }>(response);

  if (!response.ok || !data.ok || !data.services) {
    throw new ApiHttpError(
      data.error || 'Не удалось загрузить список услуг.',
      response.status,
      data.code
    );
  }
  return data.services;
}

export async function fetchAvailableSlots(
  date: string,
  serviceId: string,
  staffId = 'any'
): Promise<AvailabilityResponse> {
  const params = new URLSearchParams({
    date,
    service: serviceId,
    staff: staffId || 'any',
  });
  const response = await fetch(buildApiUrl(`/api/availability?${params.toString()}`), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const data = await parseJsonSafely<AvailabilityResponse>(response);
  if (!response.ok || !data.ok) {
    throw new ApiHttpError(
      data.error || 'Не удалось загрузить свободные интервалы.',
      response.status,
      data.code
    );
  }
  return data;
}

export async function submitBooking(
  payload: CreateBookingRequest
): Promise<CreateBookingResponse> {
  const response = await fetch(buildApiUrl('/api/bookings'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': payload.idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafely<CreateBookingResponse>(response);
  if (!response.ok || !data.ok) {
    throw new ApiHttpError(
      data.error || 'Не удалось оформить запись. Пожалуйста, проверьте данные.',
      response.status,
      data.code
    );
  }
  return data;
}
