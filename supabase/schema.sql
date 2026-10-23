-- =====================================================================
-- Портал достижений лицея — схема базы данных (Supabase / PostgreSQL)
--
-- Запуск: Supabase → SQL Editor → вставить файл целиком → Run.
-- Скрипт идемпотентный: его можно запускать повторно после правок.
--
-- Принципы:
--  * Аутентификация и хранение паролей (bcrypt) — Supabase Auth.
--  * Права доступа — Row Level Security на каждой таблице.
--  * Всё, что меняет баллы, делает учитель через SECURITY DEFINER-функции
--    (RPC), которые проверяют роль и пишут историю в award_log.
--  * Ученик не может задать себе баллы: триггер пересчитывает их сам.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Таблицы
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text not null,
  last_name               text not null default '',
  first_name              text not null default '',
  middle_name             text not null default '',
  class_name              text,
  role                    text check (role in ('student', 'teacher')),
  status                  text not null default 'pending'
                          check (status in ('pending', 'approved', 'rejected')),
  registration_completed  boolean not null default false,
  rejection_reason        text,
  decided_by              uuid references public.profiles(id),
  decided_at              timestamptz,
  telegram_chat_id        bigint unique,
  telegram_link_code      text unique,
  created_at              timestamptz not null default now()
);

-- Главный администратор (учитель с правом создавать аккаунты и назначать админов).
alter table public.profiles add column if not exists is_admin boolean not null default false;

create table if not exists public.contests (
  id           bigint generated always as identity primary key,
  title        text not null,
  description  text not null default '',
  category     text not null check (category in ('olympiad', 'project')),
  subject      text check (subject in ('physics', 'math', 'cs')),
  level        text not null,
  period       text not null default '',
  start_date   date,
  end_date     date,
  status       text not null default 'upcoming'
               check (status in ('upcoming', 'active', 'finished')),
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

create table if not exists public.achievements (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  category          text not null check (category in ('academic', 'olympiad', 'project', 'volunteer')),
  subject           text check (subject in ('physics', 'math', 'cs')),
  title             text not null,
  description       text not null default '',
  level             text,
  place             text check (place in ('participant', '3', '2', '1')),
  hours             int check (hours is null or hours >= 0),
  period            text not null default '',
  date              date not null default current_date,
  proof_url         text,
  points            int not null default 0 check (points >= 0),
  status            text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected', 'revoked')),
  teacher_comment   text not null default '',
  verified_by       uuid references public.profiles(id),
  verified_at       timestamptz,
  source            text not null default 'student'
                    check (source in ('student', 'teacher', 'contest', 'telegram')),
  participation_id  bigint,
  notified_status   text,
  created_at        timestamptz not null default now()
);

create table if not exists public.participations (
  id              bigint generated always as identity primary key,
  contest_id      bigint not null references public.contests(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  result          text not null default 'registered'
                  check (result in ('registered', 'participant', '3', '2', '1', 'absent')),
  achievement_id  bigint references public.achievements(id) on delete set null,
  status_reason   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (contest_id, user_id)
);

-- Журнал всех начислений, подтверждений и отмен: кто, когда, почему.
create table if not exists public.award_log (
  id              bigint generated always as identity primary key,
  achievement_id  bigint not null references public.achievements(id) on delete cascade,
  action          text not null check (action in ('awarded', 'approved', 'rejected', 'revoked')),
  points_before   int,
  points_after    int,
  reason          text,
  actor           uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

create index if not exists achievements_user_idx   on public.achievements(user_id);
create index if not exists achievements_status_idx on public.achievements(status);
create index if not exists participations_contest_idx on public.participations(contest_id);
create index if not exists profiles_status_idx     on public.profiles(status);

-- ---------------------------------------------------------------------
-- Система баллов (единственный источник правды; js/points.js — копия
-- для мгновенного предпросмотра в форме)
-- ---------------------------------------------------------------------

create or replace function public.calc_points(p_category text, p_level text, p_place text, p_hours int)
returns int language sql immutable as $$
  select case p_category
    when 'academic'  then 5
    when 'volunteer' then least(10, greatest(0, coalesce(p_hours, 0)) / 2)
    when 'olympiad'  then case p_level
      when 'school'        then case coalesce(p_place, 'participant') when '1' then 8   when '2' then 6  when '3' then 5  else 2  end
      when 'municipal'     then case coalesce(p_place, 'participant') when '1' then 15  when '2' then 12 when '3' then 10 else 5  end
      when 'regional'      then case coalesce(p_place, 'participant') when '1' then 30  when '2' then 25 when '3' then 20 else 10 end
      when 'national'      then case coalesce(p_place, 'participant') when '1' then 60  when '2' then 50 when '3' then 40 else 20 end
      when 'international' then case coalesce(p_place, 'participant') when '1' then 100 when '2' then 80 when '3' then 60 else 30 end
      else 0 end
    when 'project' then case p_level
      when 'school'   then case coalesce(p_place, 'participant') when '1' then 12 when '2' then 10 when '3' then 8  else 5  end
      when 'city'     then case coalesce(p_place, 'participant') when '1' then 20 when '2' then 16 when '3' then 14 else 10 end
      when 'regional' then case coalesce(p_place, 'participant') when '1' then 30 when '2' then 25 when '3' then 20 else 15 end
      else 0 end
    else 0 end;
$$;

-- ---------------------------------------------------------------------
-- Вспомогательные функции ролей
-- ---------------------------------------------------------------------

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'approved';
$$;

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'teacher', false);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles
                    where id = auth.uid() and status = 'approved' and role = 'teacher'), false);
$$;

create or replace function public.is_privileged()
returns boolean language sql stable as $$
  select current_user in ('service_role', 'postgres', 'supabase_admin');
$$;

-- ---------------------------------------------------------------------
-- Триггеры
-- ---------------------------------------------------------------------

-- Новый пользователь Auth → профиль в статусе «ожидает одобрения».
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Пользователь сам может менять только ФИО и класс; роль, статус и
-- привязку Telegram меняют учитель, RPC-функции или бот. Флаг администратора
-- и профиль самого администратора меняет только администратор.
create or replace function public.protect_profile()
returns trigger language plpgsql as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if not public.is_admin() then
    new.is_admin := old.is_admin;
    if old.is_admin then
      new.role := old.role;
      new.status := old.status;
    end if;
  end if;
  if public.is_teacher() then
    return new;
  end if;
  new.id := old.id;
  new.email := old.email;
  new.role := old.role;
  new.status := old.status;
  new.rejection_reason := old.rejection_reason;
  new.decided_by := old.decided_by;
  new.decided_at := old.decided_at;
  new.telegram_chat_id := old.telegram_chat_id;
  new.telegram_link_code := old.telegram_link_code;
  -- после одобрения класс фиксируется, дальше его меняет только учитель
  if old.status = 'approved' then
    new.class_name := old.class_name;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile();

-- Защита от накрутки: баллы ученика всегда пересчитываются по таблице,
-- статус всегда «на проверке», чужое достижение добавить нельзя.
create or replace function public.prepare_achievement()
returns trigger language plpgsql as $$
begin
  if public.is_privileged() then
    if new.source = 'telegram' then
      new.points := public.calc_points(new.category, new.level, new.place, new.hours);
      new.status := 'pending';
      new.verified_by := null;
      new.verified_at := null;
    end if;
    return new;
  end if;

  if new.user_id is distinct from auth.uid() then
    raise exception 'Нельзя добавить достижение другому пользователю';
  end if;
  new.points := public.calc_points(new.category, new.level, new.place, new.hours);
  new.status := 'pending';
  new.teacher_comment := '';
  new.verified_by := null;
  new.verified_at := null;
  new.source := 'student';
  new.participation_id := null;
  new.notified_status := null;
  return new;
end $$;

drop trigger if exists prepare_achievement on public.achievements;
create trigger prepare_achievement
  before insert on public.achievements
  for each row execute function public.prepare_achievement();

-- ---------------------------------------------------------------------
-- RPC: решения учителя (каждое проверяет роль и пишет историю)
-- ---------------------------------------------------------------------

create or replace function public.approve_registration(p_user uuid, p_role text, p_class text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then
    raise exception 'Одобрять заявки может только учитель';
  end if;
  if p_role not in ('student', 'teacher') then
    raise exception 'Неизвестная роль: %', p_role;
  end if;
  update public.profiles
     set role = p_role,
         status = 'approved',
         decided_by = auth.uid(),
         decided_at = now(),
         rejection_reason = null,
         class_name = case when p_role = 'student' then coalesce(nullif(trim(p_class), ''), class_name) else null end
   where id = p_user and status = 'pending' and registration_completed;
  if not found then
    raise exception 'Заявка уже рассмотрена или не найдена';
  end if;
end $$;

create or replace function public.reject_registration(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then
    raise exception 'Отклонять заявки может только учитель';
  end if;
  update public.profiles
     set status = 'rejected',
         decided_by = auth.uid(),
         decided_at = now(),
         rejection_reason = coalesce(nullif(trim(p_reason), ''), 'Без указания причины')
   where id = p_user and status = 'pending';
  if not found then
    raise exception 'Заявка уже рассмотрена или не найдена';
  end if;
end $$;

-- Подтверждение/отклонение заявленного достижения. Условие
-- «status = 'pending'» делает решение атомарным: если два учителя
-- нажмут одновременно, второй получит ошибку, а не двойное начисление.
create or replace function public.verify_achievement(p_id bigint, p_status text, p_points int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old int;
begin
  if not public.is_teacher() then
    raise exception 'Проверять достижения может только учитель';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'Недопустимый статус: %', p_status;
  end if;
  if p_status = 'rejected' and coalesce(trim(p_comment), '') = '' then
    raise exception 'Укажите причину отклонения';
  end if;
  if p_points is not null and p_points < 0 then
    raise exception 'Баллы не могут быть отрицательными';
  end if;

  select points into v_old from public.achievements where id = p_id and status = 'pending' for update;
  if not found then
    raise exception 'Достижение уже проверено другим учителем или не найдено';
  end if;

  update public.achievements
     set status = p_status,
         points = coalesce(p_points, points),
         teacher_comment = coalesce(p_comment, ''),
         verified_by = auth.uid(),
         verified_at = now()
   where id = p_id;

  insert into public.award_log (achievement_id, action, points_before, points_after, reason, actor)
  values (p_id, p_status, v_old, coalesce(p_points, v_old), p_comment, auth.uid());
end $$;

-- Отмена уже начисленной награды (например, если учитель ошибся).
-- Запись не удаляется: статус «отозвано», причина и автор — в журнале.
create or replace function public.revoke_achievement(p_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_points int;
  v_participation bigint;
begin
  if not public.is_teacher() then
    raise exception 'Отзывать награды может только учитель';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Укажите причину отмены';
  end if;

  update public.achievements
     set status = 'revoked',
         teacher_comment = p_reason,
         verified_by = auth.uid(),
         verified_at = now()
   where id = p_id and status = 'approved'
  returning points, participation_id into v_points, v_participation;
  if not found then
    raise exception 'Награда уже отозвана или не была начислена';
  end if;

  insert into public.award_log (achievement_id, action, points_before, points_after, reason, actor)
  values (p_id, 'revoked', v_points, 0, p_reason, auth.uid());

  -- если награда была за конкурс — возвращаем участие в исходное состояние
  if v_participation is not null then
    update public.participations
       set result = 'registered', achievement_id = null, status_reason = p_reason, updated_at = now()
     where id = v_participation;
  end if;
end $$;

-- Учитель добавляет достижение ученику напрямую — сразу подтверждено.
create or replace function public.teacher_add_achievement(
  p_user uuid, p_category text, p_subject text, p_title text,
  p_level text, p_place text, p_hours int, p_period text, p_date date
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_points int := public.calc_points(p_category, p_level, p_place, p_hours);
begin
  if not public.is_teacher() then
    raise exception 'Добавлять достижения ученикам может только учитель';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and role = 'student' and status = 'approved') then
    raise exception 'Ученик не найден';
  end if;
  insert into public.achievements (user_id, category, subject, title, level, place, hours, period, date,
                                   points, status, teacher_comment, verified_by, verified_at, source)
  values (p_user, p_category, nullif(p_subject, ''), p_title, nullif(p_level, ''), nullif(p_place, ''), p_hours,
          coalesce(p_period, ''), coalesce(p_date, current_date),
          v_points, 'approved', 'Добавлено учителем', auth.uid(), now(), 'teacher')
  returning id into v_id;

  insert into public.award_log (achievement_id, action, points_before, points_after, reason, actor)
  values (v_id, 'awarded', 0, v_points, 'Добавлено учителем', auth.uid());
  return v_id;
end $$;

-- Смена статуса участника конкурса. Призовой результат начисляет
-- награду; смена результата отзывает прежнюю награду (с причиной)
-- и начисляет новую — история сохраняется полностью.
create or replace function public.set_participation_result(p_participation bigint, p_result text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_part    public.participations;
  v_contest public.contests;
  v_old_pts int;
  v_ach     bigint;
  v_points  int;
begin
  if not public.is_teacher() then
    raise exception 'Менять статусы участников может только учитель';
  end if;
  if p_result not in ('registered', 'participant', '3', '2', '1', 'absent') then
    raise exception 'Недопустимый результат: %', p_result;
  end if;

  select * into v_part from public.participations where id = p_participation for update;
  if not found then
    raise exception 'Участие не найдено';
  end if;
  if v_part.result = p_result then
    return;
  end if;
  select * into v_contest from public.contests where id = v_part.contest_id;

  if v_part.achievement_id is not null then
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'Укажите причину: прежняя награда за этот конкурс будет отозвана';
    end if;
    update public.achievements
       set status = 'revoked', teacher_comment = p_reason, verified_by = auth.uid(), verified_at = now()
     where id = v_part.achievement_id and status = 'approved'
    returning points into v_old_pts;
    if found then
      insert into public.award_log (achievement_id, action, points_before, points_after, reason, actor)
      values (v_part.achievement_id, 'revoked', v_old_pts, 0, p_reason, auth.uid());
    end if;
  end if;

  v_ach := null;
  if p_result in ('participant', '3', '2', '1') then
    v_points := public.calc_points(v_contest.category, v_contest.level, p_result, null);
    insert into public.achievements (user_id, category, subject, title, level, place, period, date,
                                     points, status, teacher_comment, verified_by, verified_at,
                                     source, participation_id)
    values (v_part.user_id, v_contest.category, v_contest.subject, v_contest.title, v_contest.level, p_result,
            v_contest.period, coalesce(v_contest.end_date, current_date),
            v_points, 'approved', 'Результат конкурса', auth.uid(), now(), 'contest', v_part.id)
    returning id into v_ach;
    insert into public.award_log (achievement_id, action, points_before, points_after, reason, actor)
    values (v_ach, 'awarded', 0, v_points, coalesce(nullif(trim(p_reason), ''), 'Результат конкурса'), auth.uid());
  end if;

  update public.participations
     set result = p_result, achievement_id = v_ach, status_reason = p_reason, updated_at = now()
   where id = p_participation;
end $$;

-- ---------------------------------------------------------------------
-- RPC: чтение
-- ---------------------------------------------------------------------

-- Рейтинг: только подтверждённые достижения одобренных учеников.
-- Отдаёт агрегаты, а не чужие записи целиком.
create or replace function public.get_rating(p_class text default null, p_subject text default null, p_period text default null)
returns table (user_id uuid, full_name text, class_name text,
               physics int, math int, cs int, total int, achievements_count int)
language sql stable security definer set search_path = public as $$
  select p.id,
         trim(p.last_name || ' ' || p.first_name || ' ' || p.middle_name),
         p.class_name,
         coalesce(sum(a.points) filter (where a.subject = 'physics'), 0)::int,
         coalesce(sum(a.points) filter (where a.subject = 'math'), 0)::int,
         coalesce(sum(a.points) filter (where a.subject = 'cs'), 0)::int,
         coalesce(sum(a.points), 0)::int,
         count(a.id)::int
    from public.profiles p
    left join public.achievements a
      on a.user_id = p.id
     and a.status = 'approved'
     and (p_subject is null or a.subject = p_subject)
     and (p_period is null or a.period like p_period || '%')
   where p.role = 'student' and p.status = 'approved'
     and (p_class is null or p.class_name = p_class)
   group by p.id
   order by 7 desc, 2;
$$;

-- Публичная статистика для лендинга: только числа, без имён.
create or replace function public.get_public_stats()
returns table (students int, achievements int, points int, contests int)
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.profiles where role = 'student' and status = 'approved')::int,
         (select count(*) from public.achievements where status = 'approved')::int,
         (select coalesce(sum(points), 0) from public.achievements where status = 'approved')::int,
         (select count(*) from public.contests where status <> 'finished')::int;
$$;

-- Одноразовый код для привязки Telegram (t.me/<бот>?start=<код>).
create or replace function public.create_telegram_link_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
begin
  if public.my_role() is null then
    raise exception 'Привязать Telegram можно после одобрения заявки';
  end if;
  update public.profiles set telegram_link_code = v_code where id = auth.uid();
  return v_code;
end $$;

-- ---------------------------------------------------------------------
-- Администратор: создание аккаунта без письма
-- ---------------------------------------------------------------------

-- Создаёт пользователя Supabase Auth с паролем (bcrypt) и подтверждённым
-- e-mail, сразу с ФИО, ролью и статусом. pending — человек попадёт в «Заявки»,
-- approved — сразу может войти. Служебный ключ на сайте для этого не нужен.
create or replace function public.admin_create_user(
  p_email text, p_password text,
  p_last_name text, p_first_name text, p_middle_name text, p_class text,
  p_role text, p_status text, p_admin boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_admin() then
    raise exception 'Создавать пользователей может только администратор';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Некорректный e-mail';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Пароль должен быть не короче 6 символов';
  end if;
  if trim(coalesce(p_last_name, '')) = '' or trim(coalesce(p_first_name, '')) = '' then
    raise exception 'Укажите фамилию и имя';
  end if;
  if p_role not in ('student', 'teacher') then
    raise exception 'Неизвестная роль: %', p_role;
  end if;
  if p_status not in ('approved', 'pending') then
    raise exception 'Неизвестный статус: %', p_status;
  end if;
  if p_admin and p_role <> 'teacher' then
    raise exception 'Администратором может быть только учитель';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Пользователь с таким e-mail уже есть';
  end if;

  -- пустые строки вместо NULL: Supabase Auth не умеет читать NULL в этих колонках
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change,
                          email_change_token_current, reauthentication_token, phone_change, phone_change_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
          '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());

  -- профиль уже создал триггер on_auth_user_created
  update public.profiles
     set last_name = trim(p_last_name), first_name = trim(p_first_name),
         middle_name = trim(coalesce(p_middle_name, '')),
         class_name = case when p_role = 'student' then nullif(upper(trim(coalesce(p_class, ''))), '') end,
         role = p_role, status = p_status, is_admin = p_admin, registration_completed = true,
         decided_by = case when p_status = 'approved' then auth.uid() end,
         decided_at = case when p_status = 'approved' then now() end
   where id = v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.contests       enable row level security;
alter table public.achievements   enable row level security;
alter table public.participations enable row level security;
alter table public.award_log      enable row level security;

drop policy if exists "profiles: read own or teacher"   on public.profiles;
drop policy if exists "profiles: update own or teacher" on public.profiles;
create policy "profiles: read own or teacher" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_teacher());
create policy "profiles: update own or teacher" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_teacher())
  with check (id = auth.uid() or public.is_teacher());

drop policy if exists "contests: public read"   on public.contests;
drop policy if exists "contests: teacher write" on public.contests;
create policy "contests: public read" on public.contests
  for select to anon, authenticated using (true);
create policy "contests: teacher write" on public.contests
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "achievements: read own or teacher" on public.achievements;
drop policy if exists "achievements: student submits own"  on public.achievements;
create policy "achievements: read own or teacher" on public.achievements
  for select to authenticated using (user_id = auth.uid() or public.is_teacher());
create policy "achievements: student submits own" on public.achievements
  for insert to authenticated with check (user_id = auth.uid() and public.my_role() = 'student');

drop policy if exists "participations: read own or teacher" on public.participations;
drop policy if exists "participations: student joins"       on public.participations;
drop policy if exists "participations: student leaves"      on public.participations;
create policy "participations: read own or teacher" on public.participations
  for select to authenticated using (user_id = auth.uid() or public.is_teacher());
create policy "participations: student joins" on public.participations
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.my_role() = 'student'
    and result = 'registered'
    and achievement_id is null
    and exists (select 1 from public.contests c where c.id = contest_id and c.status <> 'finished')
  );
create policy "participations: student leaves" on public.participations
  for delete to authenticated using (user_id = auth.uid() and result = 'registered');

drop policy if exists "award_log: read own or teacher" on public.award_log;
create policy "award_log: read own or teacher" on public.award_log
  for select to authenticated using (
    public.is_teacher()
    or exists (select 1 from public.achievements a where a.id = achievement_id and a.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Права на объекты
-- ---------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on public.contests to anon;
grant select, insert, update, delete on public.profiles, public.contests,
  public.achievements, public.participations to authenticated;
grant select on public.award_log to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke execute on function public.approve_registration(uuid, text, text)      from public, anon;
revoke execute on function public.reject_registration(uuid, text)             from public, anon;
revoke execute on function public.verify_achievement(bigint, text, int, text) from public, anon;
revoke execute on function public.revoke_achievement(bigint, text)            from public, anon;
revoke execute on function public.teacher_add_achievement(uuid, text, text, text, text, text, int, text, date) from public, anon;
revoke execute on function public.set_participation_result(bigint, text, text) from public, anon;
revoke execute on function public.get_rating(text, text, text)                from public, anon;
revoke execute on function public.create_telegram_link_code()                 from public, anon;
revoke execute on function public.admin_create_user(text, text, text, text, text, text, text, text, boolean) from public, anon;

grant execute on function public.approve_registration(uuid, text, text)      to authenticated;
grant execute on function public.reject_registration(uuid, text)             to authenticated;
grant execute on function public.verify_achievement(bigint, text, int, text) to authenticated;
grant execute on function public.revoke_achievement(bigint, text)            to authenticated;
grant execute on function public.teacher_add_achievement(uuid, text, text, text, text, text, int, text, date) to authenticated;
grant execute on function public.set_participation_result(bigint, text, text) to authenticated;
grant execute on function public.get_rating(text, text, text)                to authenticated;
grant execute on function public.create_telegram_link_code()                 to authenticated;
grant execute on function public.admin_create_user(text, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.get_public_stats()                          to anon, authenticated;
grant execute on function public.calc_points(text, text, text, int)          to anon, authenticated;

-- Telegram-бот работает с ключом service_role: рейтинг он читает той же функцией.
grant execute on function public.get_rating(text, text, text)                to service_role;
grant execute on function public.get_public_stats()                          to service_role;
grant execute on function public.calc_points(text, text, text, int)          to service_role;

notify pgrst, 'reload schema';
