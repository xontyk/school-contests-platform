/**
 * api.js — API-слой поверх Supabase (PostgreSQL + Auth).
 *
 * Страницы (login.js, student.js, teacher.js) работают только через
 * объект `api` и ничего не знают о Supabase напрямую. Всё, что меняет
 * баллы, вызывает RPC-функции из supabase/schema.sql: они проверяют
 * роль учителя на стороне базы и пишут историю в award_log, поэтому
 * обойти правила из браузера нельзя.
 *
 * Разделы: auth, registrations, users, contests, participations,
 * achievements, rating, stats, telegram. Выгрузка в Excel — js/rating-export.js.
 *
 * ПОДСКАЗКА: как читать запрос к базе
 *   sb.from('contests').select('*').order('start_date')  — «дай все конкурсы по дате»
 *   sb.from('profiles').update({...}).eq('id', id)        — «измени профиль с этим id»
 *   sb.rpc('verify_achievement', {...})                    — вызвать функцию из schema.sql
 * Если база откажет (нет прав, неверные данные), unwrap() бросит ошибку,
 * а страница покажет её красным сообщением. Тексты ошибок входа — в AUTH_ERRORS.
 * Новое поле в таблице: добавь его в schema.sql и в toProfile/toAchievement/toContest ниже.
 */

const api = (() => {
  // ---------- перевод ошибок и строк базы в объекты интерфейса ----------

  const AUTH_ERRORS = {
    'Invalid login credentials': 'Неверный e-mail или пароль.',
    'Token has expired or is invalid': 'Неверный или устаревший код. Запросите новый.',
    'Email rate limit exceeded': 'Почтовый лимит исчерпан: сайт может отправить лишь несколько писем в час. Попробуйте через час или попросите учителя.',
    'email rate limit exceeded': 'Почтовый лимит исчерпан: сайт может отправить лишь несколько писем в час. Попробуйте через час или попросите учителя.',
    'Password should be at least 6 characters.': 'Пароль должен быть не короче 6 символов.',
    'New password should be different from the old password.': 'Новый пароль совпадает со старым. Придумайте другой.',
    'Auth session missing!': 'Ссылка из письма устарела, запросите новую.',
  };

  function fail(error) {
    const msg = (error && error.message) || String(error);
    if (/^For security purposes, you can only request this after/.test(msg)) {
      throw new Error('Письмо уже отправлено. Повторить можно через минуту.');
    }
    throw new Error(AUTH_ERRORS[msg] || msg);
  }
  function unwrap({ data, error }) {
    if (error) fail(error);
    return data;
  }

  function fullName(p) {
    return [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(' ');
  }
  function toProfile(r) {
    if (!r) return null;
    return {
      id: r.id, email: r.email, role: r.role, status: r.status,
      lastName: r.last_name, firstName: r.first_name, middleName: r.middle_name,
      fullName: fullName(r), className: r.class_name,
      registrationCompleted: r.registration_completed,
      rejectionReason: r.rejection_reason, createdAt: r.created_at,
      telegramLinked: r.telegram_chat_id != null,
      isAdmin: r.is_admin === true,
    };
  }
  function toAchievement(r) {
    return {
      id: r.id, userId: r.user_id, category: r.category, subject: r.subject,
      title: r.title, description: r.description, level: r.level, place: r.place,
      hours: r.hours, period: r.period, date: r.date, proofUrl: r.proof_url,
      points: r.points, status: r.status, teacherComment: r.teacher_comment,
      source: r.source, participationId: r.participation_id, createdAt: r.created_at,
      student: r.profiles ? toProfile(r.profiles) : null,
    };
  }
  function toContest(r) {
    return {
      id: r.id, title: r.title, description: r.description, category: r.category,
      subject: r.subject, level: r.level, period: r.period,
      startDate: r.start_date, endDate: r.end_date, status: r.status,
    };
  }
  function toParticipation(r) {
    return {
      id: r.id, contestId: r.contest_id, userId: r.user_id, result: r.result,
      achievementId: r.achievement_id, statusReason: r.status_reason, updatedAt: r.updated_at,
      contest: r.contests ? toContest(r.contests) : null,
      student: r.profiles ? toProfile(r.profiles) : null,
    };
  }

  async function myId() {
    const { data } = await sb.auth.getUser();
    return data.user ? data.user.id : null;
  }
  async function myProfile() {
    const id = await myId();
    if (!id) return null;
    return toProfile(unwrap(await sb.from('profiles').select('*').eq('id', id).maybeSingle()));
  }

  // -------------------- auth --------------------------------------------
  const auth = {
    async login(email, password) {
      unwrap(await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }));
      const profile = await myProfile();
      if (!profile || profile.status === 'pending') {
        await sb.auth.signOut();
        throw new Error('Ваша заявка ещё на рассмотрении у учителя.');
      }
      if (profile.status === 'rejected') {
        await sb.auth.signOut();
        throw new Error(`Заявка отклонена: ${profile.rejectionReason || 'без указания причины'}`);
      }
      return profile;
    },
    async logout() {
      await sb.auth.signOut();
    },
    /** Текущий пользователь, только если его заявка одобрена. */
    async currentUser() {
      const profile = await myProfile();
      return profile && profile.status === 'approved' ? profile : null;
    },

    // Регистрация: 1) код на e-mail, 2) проверка кода, 3) пароль + ФИО.
    // Письмо содержит и код (если шаблон с {{ .Token }}), и ссылку: по ссылке
    // человек возвращается на login.html с сессией и сразу попадает на шаг 3.
    async requestCode(email) {
      const normalized = (email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Введите корректный e-mail.');
      const redirect = new URL('login.html?confirmed=1', window.location.href).href;
      unwrap(await sb.auth.signInWithOtp({ email: normalized, options: { shouldCreateUser: true, emailRedirectTo: redirect } }));
      return normalized;
    },
    /** Профиль текущей сессии в любом статусе — для продолжения регистрации. */
    async sessionProfile() {
      const { data } = await sb.auth.getSession();
      return data.session ? myProfile() : null;
    },
    /** Возвращает профиль: по нему видно, не зарегистрирован ли человек уже. */
    async verifyCode(email, code) {
      unwrap(await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: String(code).trim(), type: 'email' }));
      return myProfile();
    },
    /** Письмо со ссылкой на смену пароля; ссылка вернёт на login.html?reset=1 с сессией. */
    async requestPasswordReset(email) {
      const normalized = (email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Введите корректный e-mail.');
      const redirectTo = new URL('login.html?reset=1', window.location.href).href;
      unwrap(await sb.auth.resetPasswordForEmail(normalized, { redirectTo }));
      return normalized;
    },
    /** Код из письма «Сброс пароля» (тот же вход, что и по ссылке): открывает сессию для нового пароля. */
    async verifyResetCode(email, code) {
      unwrap(await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: String(code).trim(), type: 'recovery' }));
      return myProfile();
    },
    /** Новый пароль для сессии, открытой ссылкой из письма; после — выход, вход уже с новым паролем. */
    async setNewPassword(password) {
      if (!password || password.length < 6) throw new Error('Пароль должен быть не короче 6 символов.');
      unwrap(await sb.auth.updateUser({ password }));
      await sb.auth.signOut();
    },
    async submitRegistration({ password, lastName, firstName, middleName, className }) {
      if (!password || password.length < 6) throw new Error('Пароль должен быть не короче 6 символов.');
      if (!lastName || !firstName) throw new Error('Укажите фамилию и имя.');
      const id = await myId();
      if (!id) throw new Error('Сессия истекла. Подтвердите e-mail ещё раз.');
      unwrap(await sb.auth.updateUser({ password }));
      unwrap(await sb.from('profiles').update({
        last_name: lastName, first_name: firstName, middle_name: middleName || '',
        class_name: className || null, registration_completed: true,
      }).eq('id', id));
      await sb.auth.signOut();
    },
  };

  // -------------------- заявки на регистрацию (учитель) ------------------
  const registrations = {
    async listPending() {
      const rows = unwrap(await sb.from('profiles').select('*')
        .eq('status', 'pending').eq('registration_completed', true)
        .order('created_at', { ascending: true }));
      return rows.map(toProfile);
    },
    async approve(userId, role, className) {
      unwrap(await sb.rpc('approve_registration', { p_user: userId, p_role: role, p_class: className || null }));
    },
    async reject(userId, reason) {
      unwrap(await sb.rpc('reject_registration', { p_user: userId, p_reason: reason }));
    },
  };

  // -------------------- пользователи (учитель видит всех) ----------------
  const users = {
    async listStudents() {
      const rows = unwrap(await sb.from('profiles').select('*')
        .eq('role', 'student').eq('status', 'approved').order('last_name'));
      return rows.map(toProfile);
    },
    /** Все, по кому учитель уже принял решение: ученики, учителя и отклонённые. */
    async listAll() {
      const rows = unwrap(await sb.from('profiles').select('*')
        .in('status', ['approved', 'rejected']).order('role').order('last_name'));
      return rows.map(toProfile);
    },
    /** Сменить роль и класс (или вернуть отклонённого). Пускают RLS и триггер protect_profile только учителя. */
    /**
     * Сменить роль и класс (или вернуть отклонённого). role: student | teacher | admin
     * (admin = учитель с флагом is_admin). Пускают RLS и триггер protect_profile:
     * менять чужие профили может учитель, а флаг и профиль администратора — только администратор.
     */
    async setRole(userId, role, className) {
      if (!['student', 'teacher', 'admin'].includes(role)) throw new Error('Неизвестная роль');
      const { data: { user } } = await sb.auth.getUser();
      if (user && user.id === userId) throw new Error('Свою роль поменять нельзя. Попросите об этом другого учителя.');
      const rows = unwrap(await sb.from('profiles').update({
        role: role === 'student' ? 'student' : 'teacher', is_admin: role === 'admin',
        status: 'approved', rejection_reason: null,
        class_name: role === 'student' ? (className || '').trim().toUpperCase() || null : null,
        decided_by: user ? user.id : null, decided_at: new Date().toISOString(),
      }).eq('id', userId).select('id'));
      if (!rows.length) throw new Error('Не удалось изменить: нет прав или пользователь не найден');
    },
    /** Только администратор: аккаунт с паролем без письма (функция admin_create_user в базе). */
    async create({ email, password, lastName, firstName, middleName, className, role, status }) {
      return unwrap(await sb.rpc('admin_create_user', {
        p_email: email, p_password: password,
        p_last_name: lastName, p_first_name: firstName, p_middle_name: middleName || '', p_class: className || '',
        p_role: role === 'student' ? 'student' : 'teacher', p_status: status, p_admin: role === 'admin',
      }));
    },
  };

  // -------------------- конкурсы ------------------------------------------
  const contestCols = (d) => ({
    title: d.title, description: d.description || '', category: d.category,
    subject: d.subject || null, level: d.level, period: d.period || '',
    start_date: d.startDate || null, end_date: d.endDate || null, status: d.status,
  });
  const contests = {
    async list() {
      const rows = unwrap(await sb.from('contests').select('*').order('start_date', { ascending: false, nullsFirst: false }));
      return rows.map(toContest);
    },
    async create(d) {
      if (!d.title) throw new Error('Укажите название конкурса');
      return toContest(unwrap(await sb.from('contests').insert({ ...contestCols(d), created_by: await myId() }).select().single()));
    },
    async update(id, d) {
      return toContest(unwrap(await sb.from('contests').update(contestCols(d)).eq('id', id).select().single()));
    },
    async remove(id) {
      unwrap(await sb.from('contests').delete().eq('id', id));
    },
  };

  // -------------------- участие в конкурсах -------------------------------
  const participations = {
    async listMine() {
      const rows = unwrap(await sb.from('participations').select('*, contests(*)').eq('user_id', await myId()));
      return rows.map(toParticipation);
    },
    async join(contestId) {
      const { error } = await sb.from('participations').insert({ contest_id: contestId, user_id: await myId() });
      if (error && error.code === '23505') throw new Error('Вы уже участвуете в этом конкурсе.');
      if (error) fail(error);
    },
    async leave(id) {
      unwrap(await sb.from('participations').delete().eq('id', id));
    },
    async listForContest(contestId) {
      const rows = unwrap(await sb.from('participations')
        .select('*, profiles!participations_user_id_fkey(*)')
        .eq('contest_id', contestId).order('created_at'));
      return rows.map(toParticipation);
    },
    async countsByContest() {
      const rows = unwrap(await sb.from('participations').select('contest_id'));
      return rows.reduce((acc, r) => ({ ...acc, [r.contest_id]: (acc[r.contest_id] || 0) + 1 }), {});
    },
    /** Начислить/сменить/снять результат; прежняя награда отзывается с причиной. */
    async setResult(id, result, reason) {
      unwrap(await sb.rpc('set_participation_result', { p_participation: id, p_result: result, p_reason: reason || null }));
    },
  };

  // -------------------- достижения ----------------------------------------
  const achievements = {
    async listMine() {
      const rows = unwrap(await sb.from('achievements').select('*').eq('user_id', await myId())
        .order('created_at', { ascending: false }));
      return rows.map(toAchievement);
    },
    async listAll(filter = {}) {
      let q = sb.from('achievements').select('*, profiles!achievements_user_id_fkey(*)').order('created_at', { ascending: false });
      if (filter.status) q = q.eq('status', filter.status);
      if (filter.userId) q = q.eq('user_id', filter.userId);
      return unwrap(await q).map(toAchievement);
    },
    async byIds(ids) {
      if (!ids.length) return [];
      return unwrap(await sb.from('achievements').select('*').in('id', ids)).map(toAchievement);
    },
    /** Ученик подаёт достижение: база сама ставит «на проверке» и считает баллы. */
    async submit(d) {
      const row = unwrap(await sb.from('achievements').insert({
        user_id: await myId(), category: d.category, subject: d.subject || null,
        title: d.title, description: d.description || '', level: d.level || null,
        place: d.place || null, hours: d.hours ? Number(d.hours) : null,
        period: d.period || '', date: d.date, proof_url: d.proofUrl || null,
      }).select().single());
      return toAchievement(row);
    },
    async createByTeacher(d) {
      return unwrap(await sb.rpc('teacher_add_achievement', {
        p_user: d.userId, p_category: d.category, p_subject: d.subject || '',
        p_title: d.title, p_level: d.level || '', p_place: d.place || '',
        p_hours: d.hours ? Number(d.hours) : null, p_period: d.period || '', p_date: d.date || null,
      }));
    },
    async verify(id, { status, points, comment }) {
      unwrap(await sb.rpc('verify_achievement', {
        p_id: id, p_status: status, p_points: points === '' || points == null ? null : Number(points), p_comment: comment || '',
      }));
    },
    async revoke(id, reason) {
      unwrap(await sb.rpc('revoke_achievement', { p_id: id, p_reason: reason }));
    },
    async history(id) {
      return unwrap(await sb.from('award_log').select('*').eq('achievement_id', id).order('created_at'));
    },
  };

  // -------------------- рейтинг и статистика -----------------------------
  const rating = {
    async compute(filter = {}) {
      const rows = unwrap(await sb.rpc('get_rating', {
        p_class: filter.className || null, p_subject: filter.subject || null, p_period: filter.period || null,
      }));
      return rows.map((r, idx) => ({
        rank: idx + 1, userId: r.user_id, name: r.full_name, className: r.class_name,
        physics: r.physics, math: r.math, cs: r.cs,
        // баллы без предмета (проекты, волонтёрство): иначе «Итого» не сходится с колонками
        other: r.total - r.physics - r.math - r.cs,
        total: r.total, achievementsCount: r.achievements_count,
      }));
    },
  };

  const stats = {
    async publicStats() {
      const rows = unwrap(await sb.rpc('get_public_stats'));
      return rows[0] || { students: 0, achievements: 0, points: 0, contests: 0 };
    },
  };

  const telegram = {
    async linkUrl() {
      const code = unwrap(await sb.rpc('create_telegram_link_code'));
      return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${code}`;
    },
  };

  return { auth, registrations, users, contests, participations, achievements, rating, stats, telegram };
})();
