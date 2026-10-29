# LÉA — Сайт студии красоты с системой онлайн-записи (Cloudflare Workers + D1 + Telegram)

Эстетичный адаптивный сайт камерной студии красоты **«LÉA»** с полноценной серверной системой автоматического бронирования времени, защитой от двойного бронирования (race conditions) в базе данных **Cloudflare D1 (SQLite)** и мгновенными уведомлениями администратора в **Telegram**.

---

## Содержание инструкции

1. [Архитектура проекта](#архитектура-проекта)
2. [Шаг 1. Как создать Telegram-бота через @BotFather](#шаг-1-как-создать-telegram-бота-через-botfather)
3. [Шаг 2. Как получить Chat ID безопасным способом](#шаг-2-как-получить-chat-id-безопасным-способом)
4. [Шаг 3. Как создать и подготовить Cloudflare Worker](#шаг-3-как-создать-и-подготовить-cloudflare-worker)
5. [Шаг 4. Как создать базу данных D1 и подключить binding DB](#шаг-4-как-создать-базу-данных-d1-и-подключить-binding-db)
6. [Шаг 5. Как применить SQL-схему (миграцию)](#шаг-5-как-применить-sql-схему-миграцию)
7. [Шаг 6. Как установить TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID как секреты](#шаг-6-как-установить-telegram_bot_token-и-telegram_chat_id-как-секреты)
8. [Шаг 7. Как настроить ALLOWED_ORIGIN (CORS)](#шаг-7-как-настроить-allowed_origin-cors)
9. [Шаг 8. Как опубликовать Cloudflare Worker](#шаг-8-как-опубликовать-cloudflare-worker)
10. [Шаг 9. Как указать URL Worker во Frontend](#шаг-9-как-указать-url-worker-во-frontend)
11. [Шаг 10. Как опубликовать Frontend на GitHub Pages](#шаг-10-как-опубликовать-frontend-на-github-pages)
12. [Шаг 11. Как протестировать запись и защиту от двойного бронирования](#шаг-11-как-протестировать-запись-и-защиту-от-двойного-бронирования)

---

## Архитектура проекта

- **Frontend (`src/`, `index.html`)**: React + TypeScript + Tailwind CSS + Vite. Статическая сборка полностью готова к размещению на **GitHub Pages**. В коде фронтенда нет ни одного секретного ключа.
- **Backend (`worker/index.ts`, `worker/bookingEngine.ts`, `wrangler.toml`)**: **Cloudflare Workers** + **Cloudflare D1**.
- **База данных (`migrations/0001_init.sql`)**: таблицы `services`, `staff`, `working_hours`, `bookings` и `notification_logs`.
- **Локальная разработка (`server.ts`, `server/d1SqliteAdapter.ts`)**: при запуске `npm run dev` локальный сервер автоматически поднимает SQLite-базу со схемой D1 и выполняет код Worker на `http://localhost:3000/api/*`.

---

## Шаг 1. Как создать Telegram-бота через @BotFather

1. Откройте Telegram и найдите официального бота **[@BotFather](https://t.me/BotFather)** (рядом с именем должна быть синяя галочка верификации).
2. Нажмите **Start** и отправьте команду:
   ```text
   /newbot
   ```
3. Введите отображаемое имя бота, например:
   ```text
   LÉA Studio Booking
   ```
4. Введите уникальный username бота, оканчивающийся на `bot`, например:
   ```text
   lea_studio_booking_bot
   ```
5. `@BotFather` пришлёт вам токен вида `1234567890:AAH...`.
   > **Важно:** никому не пересылайте этот токен и **никогда не вставляйте его в код сайта, `wrangler.toml` или GitHub-репозиторий**.
6. Перейдите по ссылке на вашего нового бота и обязательно нажмите кнопку **Start** (`/start`), чтобы бот получил право отправлять вам сообщения.

---

## Шаг 2. Как получить Chat ID безопасным способом

Не используйте сторонние неизвестные сайты для получения `Chat ID`. Безопасный способ — запросить его напрямую у официального API Telegram:

1. Напишите вашему созданному боту любое сообщение в Telegram (например: `Привет`).
2. Откройте терминал на вашем компьютере и выполните команду (заменив `<ВАШ_ТОКЕН>` на токен от `@BotFather`):
   ```bash
   curl -s "https://api.telegram.org/bot<ВАШ_ТОКЕН>/getUpdates"
   ```
3. В ответе JSON найдите блок `"chat":{"id":123456789,...}`. Число в поле `"id"` (например, `123456789` для личного чата или отрицательное число `-100...` для группы администраторов) — это ваш **`TELEGRAM_CHAT_ID`**.

---

## Шаг 3. Как создать и подготовить Cloudflare Worker

1. Зарегистрируйтесь или войдите в панель [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Убедитесь, что у вас установлен Node.js (версии 20 или 22+).
3. Авторизуйтесь в утилите Cloudflare Wrangler из папки проекта:
   ```bash
   npx wrangler login
   ```
   В браузере откроется страница подтверждения доступа для вашего аккаунта Cloudflare.

---

## Шаг 4. Как создать базу данных D1 и подключить binding DB

1. В терминале в корне проекта выполните команду создания базы данных D1:
   ```bash
   npx wrangler d1 create lea-booking-db
   ```
2. В терминале появится вывод с `database_id`, например:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "lea-booking-db"
   database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   ```
3. Откройте файл `wrangler.toml` в корне проекта и замените `<YOUR_D1_DATABASE_ID>` на полученный `database_id`.

---

## Шаг 5. Как применить SQL-схему (миграцию)

Примените файл `migrations/0001_init.sql` (создаёт таблицы `services`, `staff`, `working_hours`, `bookings`, `notification_logs` и заполняет прайс-лист студии):

- **Для облачной базы Cloudflare D1 (продакшн):**
  ```bash
  npx wrangler d1 execute lea-booking-db --remote --file=./migrations/0001_init.sql
  ```
- **Для локальной базы Wrangler (при тестировании через `wrangler dev`):**
  ```bash
  npx wrangler d1 execute lea-booking-db --local --file=./migrations/0001_init.sql
  ```

---

## Шаг 6. Как установить TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID как секреты

Секреты сохраняются в зашифрованном хранилище Cloudflare Worker Secrets и не попадают в Git:

1. Установите токен бота:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   ```
   Когда терминал попросит ввести значение (`Enter a secret value:`), вставьте ваш токен от `@BotFather` и нажмите `Enter`.

2. Установите ID чата администратора:
   ```bash
   npx wrangler secret put TELEGRAM_CHAT_ID
   ```
   Вставьте ваш цифровой `Chat ID` и нажмите `Enter`.

---

## Шаг 7. Как настроить ALLOWED_ORIGIN (CORS)

Чтобы к вашему API мог обращаться только ваш сайт на GitHub Pages:

1. Откройте файл `wrangler.toml`.
2. В секции `[vars]` укажите точный адрес (origin) вашего сайта без слеша на конце:
   ```toml
   [vars]
   ALLOWED_ORIGIN = "https://<ВАШ_ЛОГИН_GITHUB>.github.io"
   SALON_TIMEZONE = "Europe/Moscow"
   ```
   *(Важно: в `ALLOWED_ORIGIN` указывается только протокол и домен `https://username.github.io`, без имени подпапки репозитория).*

---

## Шаг 8. Как опубликовать Cloudflare Worker

Выполните команду деплоя Worker в облако Cloudflare:

```bash
npx wrangler deploy
```

После успешной публикации Wrangler выведет HTTPS-адрес вашего Worker, например:
`https://lea-booking-worker.<ваш-поддомен>.workers.dev`

Проверьте его работу, открыв в браузере:
`https://lea-booking-worker.<ваш-поддомен>.workers.dev/api/services`

---

## Шаг 9. Как указать URL Worker во Frontend

Перед сборкой сайта для GitHub Pages укажите адрес вашего опубликованного Worker:

- **Способ А (через переменную окружения при сборке):**
  Создайте локальный файл `.env.production.local` (он уже добавлен в `.gitignore`):
  ```env
  VITE_API_BASE_URL="https://lea-booking-worker.<ваш-поддомен>.workers.dev"
  ```
- **Способ Б (напрямую в `src/config.ts`):**
  Откройте `src/config.ts` и укажите URL вашего Worker в константе `FALLBACK_WORKER_URL` (это публичный URL API, он не является секретом).

---

## Шаг 10. Как опубликовать Frontend на GitHub Pages

1. Если ваш сайт публикуется по адресу `https://<username>.github.io/<repo-name>/`, при сборке передайте базовый путь `--base=/<repo-name>/` (или оставьте `/`, если используете основной репозиторий `<username>.github.io`):
   ```bash
   npm run build
   ```
2. Папка `dist/` содержит готовый статический сайт.
3. В настройках вашего репозитория на GitHub перейдите в **Settings → Pages**:
   - В разделе **Build and deployment** выберите **Source: GitHub Actions** (или ветку `gh-pages`).
   - Если используете публикацию папки `dist/`, выполните:
     ```bash
     npx gh-pages -d dist
     ```

---

## Шаг 11. Как протестировать запись и защиту от двойного бронирования

### 1. Запуск автоматических тестов
В проект включён набор из 10 интеграционных тестов (`tests/booking.test.ts`), проверяющих валидацию, пересечение длительных процедур, конкурентные запросы (race condition), идемпотентность, сбой Telegram и отказ БД:

```bash
npm test
```

### 2. Ручная проверка через терминал (`curl`)
Вы можете отправить два одновременных запроса на одно и то же время:

```bash
API_URL="http://localhost:3000" # или URL вашего Cloudflare Worker

curl -X POST "$API_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Анна","lastName":"Смирнова","phone":"+7 900 123-45-67","serviceId":"manicure-gel","date":"2026-11-10","time":"15:00","consentAccepted":true}' & \
curl -X POST "$API_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Мария","lastName":"Орлова","phone":"+7 900 999-88-77","serviceId":"manicure-gel","date":"2026-11-10","time":"15:00","consentAccepted":true}' & \
wait
```

Первый запрос вернёт `HTTP 201 Created`, а второй — `HTTP 409 Conflict` (`SLOT_CONFLICT`), подтверждая атомарную защиту от двойной записи.
