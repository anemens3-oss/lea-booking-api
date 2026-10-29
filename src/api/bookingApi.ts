import { buildApiUrl } from '../config';

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

export async function fetchActiveServices(): Promise<ApiServiceItem[]> {
  const response = await fetch(buildApiUrl('/api/services'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const data = (await response.json()) as {
    ok: boolean;
    services?: ApiServiceItem[];
    error?: string;
    code?: string;
  };
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
  const data = (await response.json()) as AvailabilityResponse;
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

  const data = (await response.json()) as CreateBookingResponse;
  if (!response.ok || !data.ok) {
    throw new ApiHttpError(
      data.error || 'Не удалось оформить запись. Пожалуйста, проверьте данные.',
      response.status,
      data.code
    );
  }
  return data;
}
