/**
 * config.js — подключение к общей базе Supabase.
 *
 * anon-ключ публичный по замыслу Supabase: он даёт ровно те права,
 * которые разрешают политики Row Level Security в supabase/schema.sql.
 * Секретный service_role-ключ здесь не используется никогда — он живёт
 * только в bot/.env на компьютере, где запущен бот.
 *
 * ПОДСКАЗКА: перенести сайт на другую базу = поменять две строки ниже
 * (Supabase → Project Settings → API). Поменяешь TELEGRAM_BOT_USERNAME —
 * кнопки «Подключить Telegram» и ссылки на бота поведут на другого бота.
 */

// адрес проекта Supabase — сюда ходят все запросы сайта
const SUPABASE_URL = 'https://kwjxtncwikdjkhgkskfz.supabase.co';
// публичный ключ: права ограничены политиками RLS в базе
const SUPABASE_ANON_KEY ='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3anh0bmN3aWtkamtoZ2tza2Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3Nzg4NzMsImV4cCI6MjEwODM1NDg3M30.DymTpQsu00ohV_lGKANv4j1uoVTUC4sm-B-c-vWaZfc';
const TELEGRAM_BOT_USERNAME = 'achievementsportal_bot';

// sb — единый клиент базы; им пользуется только js/api.js.
// persistSession: вход запоминается в браузере, autoRefreshToken: сессия продлевается сама.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
