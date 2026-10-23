/**
 * config.js — подключение к общей базе Supabase.
 *
 * anon-ключ публичный по замыслу Supabase: он даёт ровно те права,
 * которые разрешают политики Row Level Security в supabase/schema.sql.
 * Секретный service_role-ключ здесь не используется никогда — он живёт
 * только в bot/.env на компьютере, где запущен бот.
 */

const SUPABASE_URL = 'https://kwjxtncwikdjkhgkskfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3anh0bmN3aWtkamtoZ2tza2Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3Nzg4NzMsImV4cCI6MjEwODM1NDg3M30.DymTpQsu00ohV_lGKANv4j1uoVTUC4sm-B-c-vWaZfc';
const TELEGRAM_BOT_USERNAME = 'achievementsportal_bot';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
