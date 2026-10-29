/**
 * Конфигурация подключения Frontend к Cloudflare Worker API.
 *
 * 1. При локальной разработке и предпросмотре (npm run dev) оставьте VITE_API_BASE_URL пустым —
 *    запросы будут автоматически отправляться на локальный сервер `/api/*` с реальной базой SQLite (D1).
 *
 * 2. Перед публикацией на GitHub Pages укажите URL вашего опубликованного Cloudflare Worker
 *    в переменной окружения `VITE_API_BASE_URL` (или замените значение FALLBACK_WORKER_URL ниже):
 *    Например: "https://lea-booking-worker.<YOUR_SUBDOMAIN>.workers.dev"
 */
const FALLBACK_WORKER_URL = '';

export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || FALLBACK_WORKER_URL
).replace(/\/+$/, '');

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
