import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createInitializedD1Database } from '../server/d1SqliteAdapter';
import { handleWorkerRequest } from '../worker/index';
import { resetRateLimiterForTests } from '../worker/bookingEngine';
import { WorkerEnv, D1Database } from '../worker/types';

const FIXED_NOW_ISO = '2026-11-04T09:00:00.000Z'; // 12:00 по Москве (UTC+3) 4 ноября 2026
const FUTURE_DATE = '2026-11-05';
const PAST_DATE = '2026-11-01';

function createTestEnv(overrides: Partial<WorkerEnv> = {}): {
  env: WorkerEnv;
  telegramMessages: Array<{ url: string; body: { chat_id: string; text: string } }>;
} {
  const db = createInitializedD1Database(':memory:');
  const telegramMessages: Array<{ url: string; body: { chat_id: string; text: string } }> = [];

  const env: WorkerEnv = {
    DB: db,
    TELEGRAM_BOT_TOKEN: 'TEST_SECRET_BOT_TOKEN_123456',
    TELEGRAM_CHAT_ID: '987654321',
    ALLOWED_ORIGIN: 'https://example.github.io',
    SALON_TIMEZONE: 'Europe/Moscow',
    currentTimeOverride: FIXED_NOW_ISO,
    customFetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      telegramMessages.push({ url, body });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    ...overrides,
  };

  return { env, telegramMessages };
}

async function postBooking(
  env: WorkerEnv,
  payload: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  const req = new Request('https://worker.example.com/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://example.github.io',
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  const res = await handleWorkerRequest(req, env);
  const data = (await res.json()) as Record<string, unknown>;
  return { status: res.status, data };
}

describe('Система онлайн-записи салона красоты LÉA (Cloudflare Worker + D1)', () => {
  beforeEach(() => {
    resetRateLimiterForTests();
  });

  it('1. Корректная запись: сохраняет бронь в БД, отправляет уведомление в Telegram и занимает слот', async () => {
    const { env, telegramMessages } = createTestEnv();

    // Проверяем список услуг
    const servicesRes = await handleWorkerRequest(
      new Request('https://worker.example.com/api/services'),
      env
    );
    assert.equal(servicesRes.status, 200);
    const servicesJson = (await servicesRes.json()) as {
      ok: boolean;
      services: Array<{ id: string }>;
    };
    assert.equal(servicesJson.ok, true);
    assert.ok(servicesJson.services.length >= 10);

    // Оформляем корректную запись на Маникюр с гель-лаком (90 минут) в 15:00
    const { status, data } = await postBooking(env, {
      firstName: 'Анна',
      lastName: 'Смирнова',
      phone: '+7 (900) 123-45-67',
      serviceId: 'manicure-gel',
      date: FUTURE_DATE,
      time: '15:00',
      consentAccepted: true,
      idempotencyKey: 'test-valid-booking-001',
    });

    assert.equal(status, 201);
    assert.equal(data.ok, true);
    const booking = data.booking as Record<string, unknown>;
    assert.equal(booking.firstName, 'Анна');
    assert.equal(booking.lastName, 'Смирнова');
    assert.equal(booking.startTime, '15:00');
    assert.equal(booking.endTime, '16:30');
    assert.equal(booking.priceRub, 1700);
    assert.equal(booking.durationMinutes, 90);
    assert.equal(booking.telegramNotification, 'sent');

    // Проверяем отправку сообщения в Telegram
    assert.equal(telegramMessages.length, 1);
    assert.ok(telegramMessages[0].body.text.includes('НОВАЯ ЗАПИСЬ — LÉA'));
    assert.ok(telegramMessages[0].body.text.includes('Клиент: Анна Смирнова'));
    assert.ok(telegramMessages[0].body.text.includes('Телефон: +7 900 123-45-67'));
    assert.ok(telegramMessages[0].body.text.includes('Дата: 5 ноября 2026'));
    assert.ok(telegramMessages[0].body.text.includes('Время: 15:00–16:30'));

    // Проверяем, что слоты 15:00, 15:30 и 16:00 исчезли из /api/availability
    const availRes = await handleWorkerRequest(
      new Request(
        `https://worker.example.com/api/availability?date=${FUTURE_DATE}&service=manicure-clean`
      ),
      env
    );
    const availData = (await availRes.json()) as {
      slots: Array<{ startTime: string }>;
    };
    const availableTimes = availData.slots.map((s) => s.startTime);
    assert.ok(!availableTimes.includes('15:00'));
    assert.ok(!availableTimes.includes('15:30'));
    assert.ok(!availableTimes.includes('16:00'));
    assert.ok(availableTimes.includes('16:30'));
  });

  it('2. Неправильный телефон: отклоняет короткие, нечисловые и нулевые номера с кодом 400', async () => {
    const { env, telegramMessages } = createTestEnv();

    for (const invalidPhone of ['12345', 'abcdef', '+7 (000) 000-00-00', '80000000000', '']) {
      const { status, data } = await postBooking(env, {
        firstName: 'Мария',
        lastName: 'Иванова',
        phone: invalidPhone,
        serviceId: 'manicure-clean',
        date: FUTURE_DATE,
        time: '10:00',
        consentAccepted: true,
      });
      assert.equal(status, 400, `Phone "${invalidPhone}" should fail with 400`);
      assert.equal(data.ok, false);
    }

    assert.equal(telegramMessages.length, 0);
  });

  it('3. Пустые поля и отсутствие согласия на обработку ПДн: возвращает 400', async () => {
    const { env } = createTestEnv();

    // Пустое имя
    const resNoFirst = await postBooking(env, {
      firstName: ' ',
      lastName: 'Петрова',
      phone: '+7 916 555-44-33',
      serviceId: 'manicure-clean',
      date: FUTURE_DATE,
      time: '10:00',
      consentAccepted: true,
    });
    assert.equal(resNoFirst.status, 400);

    // Пустая фамилия
    const resNoLast = await postBooking(env, {
      firstName: 'Елена',
      lastName: '',
      phone: '+7 916 555-44-33',
      serviceId: 'manicure-clean',
      date: FUTURE_DATE,
      time: '10:00',
      consentAccepted: true,
    });
    assert.equal(resNoLast.status, 400);

    // Без согласия на обработку персональных данных
    const resNoConsent = await postBooking(env, {
      firstName: 'Елена',
      lastName: 'Петрова',
      phone: '+7 916 555-44-33',
      serviceId: 'manicure-clean',
      date: FUTURE_DATE,
      time: '10:00',
      consentAccepted: false,
    });
    assert.equal(resNoConsent.status, 400);
  });

  it('4. Прошедшая дата и прошедшее время текущего дня во временной зоне салона: возвращает 400', async () => {
    const { env } = createTestEnv();

    // Прошедшая дата (1 ноября 2026 при текущем 4 ноября 2026)
    const pastDateRes = await postBooking(env, {
      firstName: 'Ольга',
      lastName: 'Соколова',
      phone: '+7 916 111-22-33',
      serviceId: 'manicure-clean',
      date: PAST_DATE,
      time: '12:00',
      consentAccepted: true,
    });
    assert.equal(pastDateRes.status, 400);

    // Сегодняшняя дата (2026-11-04), но время 11:00 уже прошло (сейчас 12:00 по Москве)
    const pastTimeTodayRes = await postBooking(env, {
      firstName: 'Ольга',
      lastName: 'Соколова',
      phone: '+7 916 111-22-33',
      serviceId: 'manicure-clean',
      date: '2026-11-04',
      time: '11:00',
      consentAccepted: true,
    });
    assert.equal(pastTimeTodayRes.status, 400);
  });

  it('5. Недоступное время: отклоняет запись вне рабочих часов и во время перерыва (14:30–15:00)', async () => {
    const { env } = createTestEnv();

    // До открытия студии (09:00)
    const beforeOpen = await postBooking(env, {
      firstName: 'Дарья',
      lastName: 'Морозова',
      phone: '+7 916 222-33-44',
      serviceId: 'manicure-clean',
      date: FUTURE_DATE,
      time: '09:00',
      consentAccepted: true,
    });
    assert.equal(beforeOpen.status, 400);

    // Запись на 90-минутную услугу в 20:00 (закончится в 21:30 после закрытия в 21:00)
    const afterClose = await postBooking(env, {
      firstName: 'Дарья',
      lastName: 'Морозова',
      phone: '+7 916 222-33-44',
      serviceId: 'manicure-gel',
      date: FUTURE_DATE,
      time: '20:00',
      consentAccepted: true,
    });
    assert.equal(afterClose.status, 400);

    // Запись на 90-минутную услугу в 13:30 (13:30–15:00 пересекает перерыв 14:30–15:00)
    const overlapsBreak = await postBooking(env, {
      firstName: 'Дарья',
      lastName: 'Морозова',
      phone: '+7 916 222-33-44',
      serviceId: 'manicure-gel',
      date: FUTURE_DATE,
      time: '13:30',
      consentAccepted: true,
    });
    assert.equal(overlapsBreak.status, 400);
  });

  it('6. Пересечение длительных услуг: блокирует частичное наложение интервалов (409 Conflict)', async () => {
    const { env } = createTestEnv();

    // Клиент 1 бронирует 90-минутный маникюр с 10:00 до 11:30
    const first = await postBooking(env, {
      firstName: 'Алина',
      lastName: 'Волкова',
      phone: '+7 900 111-11-11',
      serviceId: 'manicure-gel',
      date: FUTURE_DATE,
      time: '10:00',
      consentAccepted: true,
    });
    assert.equal(first.status, 201);

    // Клиент 2 пытается записаться на 11:00 (пересечение 11:00–11:30)
    const overlappingAfter = await postBooking(env, {
      firstName: 'Ксения',
      lastName: 'Лебедева',
      phone: '+7 900 222-22-22',
      serviceId: 'manicure-clean',
      date: FUTURE_DATE,
      time: '11:00',
      consentAccepted: true,
    });
    assert.equal(overlappingAfter.status, 409);
    assert.equal(overlappingAfter.data.code, 'SLOT_CONFLICT');

    // А запись ровно в 11:30 (сразу после завершения первой) проходит успешно!
    const adjacentValid = await postBooking(env, {
      firstName: 'Ксения',
      lastName: 'Лебедева',
      phone: '+7 900 222-22-22',
      serviceId: 'manicure-clean',
      date: FUTURE_DATE,
      time: '11:30',
      consentAccepted: true,
    });
    assert.equal(adjacentValid.status, 201);
  });

  it('7. Два конкурентных запроса на один слот: ровно один создаёт запись (201), второй получает 409 Conflict', async () => {
    const { env, telegramMessages } = createTestEnv();

    const [res1, res2] = await Promise.all([
      postBooking(env, {
        firstName: 'Полина',
        lastName: 'Орлова',
        phone: '+7 901 111-22-33',
        serviceId: 'facial-delicate',
        date: FUTURE_DATE,
        time: '16:00',
        consentAccepted: true,
        idempotencyKey: 'concurrent-client-1',
      }),
      postBooking(env, {
        firstName: 'Вероника',
        lastName: 'Козлова',
        phone: '+7 902 444-55-66',
        serviceId: 'facial-delicate',
        date: FUTURE_DATE,
        time: '16:00',
        consentAccepted: true,
        idempotencyKey: 'concurrent-client-2',
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [201, 409]);
    // Уведомление в Telegram отправлено ровно 1 раз
    assert.equal(telegramMessages.length, 1);
  });

  it('8. Повторный запрос (идемпотентность): не создаёт дубликат записи и не шлёт повторное сообщение в Telegram', async () => {
    const { env, telegramMessages } = createTestEnv();

    const payload = {
      firstName: 'Светлана',
      lastName: 'Новикова',
      phone: '+7 905 777-88-99',
      serviceId: 'brows-lamination',
      date: FUTURE_DATE,
      time: '12:00',
      consentAccepted: true,
      idempotencyKey: 'idem-key-svetlana-1200',
    };

    const firstAttempt = await postBooking(env, payload);
    assert.equal(firstAttempt.status, 201);
    assert.equal(firstAttempt.data.idempotent, false);

    // Повторная отправка того же запроса
    const secondAttempt = await postBooking(env, payload);
    assert.equal(secondAttempt.status, 200);
    assert.equal(secondAttempt.data.idempotent, true);

    const firstBooking = firstAttempt.data.booking as { id: string };
    const secondBooking = secondAttempt.data.booking as { id: string };
    assert.equal(firstBooking.id, secondBooking.id);
    assert.equal(telegramMessages.length, 1);
  });

  it('9. Ошибка Telegram: запись сохраняется в БД (201), токен не утекает, возможна безопасная повторная отправка', async () => {
    let shouldFailTelegram = true;
    const { env } = createTestEnv({
      customFetch: async () => {
        if (shouldFailTelegram) {
          return new Response('Bad Gateway from Telegram', { status: 502 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    const res = await postBooking(env, {
      firstName: 'Екатерина',
      lastName: 'Миронова',
      phone: '+7 999 888-77-66',
      serviceId: 'facial-hydrating',
      date: FUTURE_DATE,
      time: '17:00',
      consentAccepted: true,
    });

    // Клиент получает успешное подтверждение 201, запись НЕ потеряна
    assert.equal(res.status, 201);
    assert.equal(res.data.ok, true);
    const booking = res.data.booking as { id: string; telegramNotification: string };
    assert.equal(booking.telegramNotification, 'failed');

    // Проверяем, что в ответах нет секретного токена
    assert.ok(!JSON.stringify(res.data).includes('TEST_SECRET_BOT_TOKEN_123456'));

    // Теперь Telegram восстановился — вызываем безопасный retry
    shouldFailTelegram = false;
    const retryRes = await handleWorkerRequest(
      new Request('https://worker.example.com/api/notifications/retry', {
        method: 'POST',
        headers: { Origin: 'https://example.github.io' },
      }),
      env
    );
    assert.equal(retryRes.status, 200);
    const retryJson = (await retryRes.json()) as { processed: number; sent: number };
    assert.equal(retryJson.processed, 1);
    assert.equal(retryJson.sent, 1);
  });

  it('10. Недоступность базы данных: возвращает 503 без утечки stack trace и секретов', async () => {
    const brokenDb: D1Database = {
      prepare() {
        throw new Error('D1_INTERNAL_CONNECTION_FAILURE_AT_CLUSTER_NODE_42');
      },
      async batch() {
        throw new Error('D1_INTERNAL_CONNECTION_FAILURE');
      },
      async exec() {
        throw new Error('D1_INTERNAL_CONNECTION_FAILURE');
      },
    };

    const { env } = createTestEnv({ DB: brokenDb });

    const { status, data } = await postBooking(env, {
      firstName: 'Анна',
      lastName: 'Смирнова',
      phone: '+7 900 123-45-67',
      serviceId: 'manicure-clean',
      date: FUTURE_DATE,
      time: '10:00',
      consentAccepted: true,
    });

    assert.equal(status, 503);
    assert.equal(data.ok, false);
    assert.equal(data.code, 'SERVICE_UNAVAILABLE');
    // Внутренние детали ошибки БД не утекли клиенту
    assert.ok(!JSON.stringify(data).includes('CLUSTER_NODE_42'));
  });
});
