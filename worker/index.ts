import { WorkerEnv, CreateBookingPayload } from './types';
import {
  getActiveServices,
  getAvailableSlots,
  createBooking,
  retryFailedTelegramNotifications,
  checkRateLimit,
  ValidationError,
} from './bookingEngine';

/**
 * Формирование заголовков CORS с проверкой ALLOWED_ORIGIN
 */
export function buildCorsHeaders(request: Request, env: WorkerEnv): Record<string, string> {
  const requestOrigin = request.headers.get('Origin') || '';
  const configuredOrigin = (env.ALLOWED_ORIGIN || '').trim();

  let allowOrigin = '*';
  if (
    configuredOrigin &&
    configuredOrigin !== '*' &&
    !configuredOrigin.includes('<YOUR_GITHUB_USERNAME>')
  ) {
    if (requestOrigin === configuredOrigin) {
      allowOrigin = configuredOrigin;
    } else if (
      requestOrigin.startsWith('http://localhost:') ||
      requestOrigin.startsWith('http://127.0.0.1:')
    ) {
      allowOrigin = requestOrigin;
    } else {
      allowOrigin = configuredOrigin;
    }
  } else if (requestOrigin) {
    allowOrigin = requestOrigin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(
  data: unknown,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders,
    },
  });
}

/**
 * Основной обработчик HTTP-запросов Cloudflare Worker
 */
export async function handleWorkerRequest(request: Request, env: WorkerEnv): Promise<Response> {
  const corsHeaders = buildCorsHeaders(request, env);

  // Preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Строгая проверка Origin, если задан реальный продакшн ALLOWED_ORIGIN
  const configuredOrigin = (env.ALLOWED_ORIGIN || '').trim();
  const requestOrigin = request.headers.get('Origin');
  if (
    configuredOrigin &&
    configuredOrigin !== '*' &&
    !configuredOrigin.includes('<YOUR_GITHUB_USERNAME>') &&
    requestOrigin &&
    requestOrigin !== configuredOrigin &&
    !requestOrigin.startsWith('http://localhost:') &&
    !requestOrigin.startsWith('http://127.0.0.1:')
  ) {
    return jsonResponse(
      {
        ok: false,
        code: 'FORBIDDEN_ORIGIN',
        error: 'Запрос с данного домена запрещён политикой безопасности.',
      },
      403,
      corsHeaders
    );
  }

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  try {
    // 1. GET /api/services
    if (request.method === 'GET' && pathname === '/api/services') {
      const services = await getActiveServices(env);
      return jsonResponse({ ok: true, services }, 200, corsHeaders);
    }

    // 2. GET /api/availability?date=YYYY-MM-DD&service=SERVICE_ID&staff=STAFF_ID
    if (request.method === 'GET' && pathname === '/api/availability') {
      const date = url.searchParams.get('date') || '';
      const service = url.searchParams.get('service') || '';
      const staff = url.searchParams.get('staff') || 'any';

      if (!date || !service) {
        return jsonResponse(
          {
            ok: false,
            code: 'MISSING_PARAMS',
            error: 'Необходимо передать параметры date (YYYY-MM-DD) и service (ID услуги).',
          },
          400,
          corsHeaders
        );
      }

      const availability = await getAvailableSlots(env, date, service, staff);
      return jsonResponse({ ok: true, ...availability }, 200, corsHeaders);
    }

    // 3. POST /api/bookings
    if (request.method === 'POST' && pathname === '/api/bookings') {
      const clientIp =
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For') ||
        'local-client';

      if (!checkRateLimit(clientIp)) {
        return jsonResponse(
          {
            ok: false,
            code: 'RATE_LIMITED',
            error: 'Слишком много запросов. Пожалуйста, подождите минуту и попробуйте снова.',
          },
          429,
          corsHeaders
        );
      }

      let payload: CreateBookingPayload;
      try {
        payload = (await request.json()) as CreateBookingPayload;
      } catch {
        return jsonResponse(
          {
            ok: false,
            code: 'INVALID_JSON',
            error: 'Некорректный формат JSON в теле запроса.',
          },
          400,
          corsHeaders
        );
      }

      // Поддержка заголовка Idempotency-Key
      const headerIdemKey = request.headers.get('Idempotency-Key');
      if (headerIdemKey && !payload.idempotencyKey) {
        payload.idempotencyKey = headerIdemKey;
      }

      const result = await createBooking(env, payload);
      return jsonResponse(result.body, result.statusCode, corsHeaders);
    }

    // 4. POST /api/notifications/retry — Безопасная повторная отправка недоставленных уведомлений
    if (request.method === 'POST' && pathname === '/api/notifications/retry') {
      const stats = await retryFailedTelegramNotifications(env);
      return jsonResponse({ ok: true, ...stats }, 200, corsHeaders);
    }

    return jsonResponse(
      { ok: false, code: 'NOT_FOUND', error: 'Маршрут не найден.' },
      404,
      corsHeaders
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      return jsonResponse(
        {
          ok: false,
          code: err.code,
          error: err.message,
        },
        err.statusCode,
        corsHeaders
      );
    }

    // Никогда не возвращаем клиенту внутренний stack trace или секреты
    return jsonResponse(
      {
        ok: false,
        code: 'SERVICE_UNAVAILABLE',
        error: 'Сервис записи временно недоступен. Пожалуйста, попробуйте чуть позже.',
      },
      503,
      corsHeaders
    );
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleWorkerRequest(request, env);
  },
};
