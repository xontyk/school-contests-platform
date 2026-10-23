/**
 * login.js — вход, регистрация в три шага (e-mail → код или ссылка из письма →
 * пароль и ФИО) и восстановление пароля по ссылке из письма. Письма отправляет
 * Supabase Auth; после регистрации профиль ждёт решения учителя (status = pending).
 *
 * ПОДСКАЗКА: login.html — это несколько «экранов» (section.auth-step), видим один.
 *   panel-login         — вход               panel-register-1..3 — шаги регистрации
 *   panel-register-done — «Заявка отправлена» panel-reset-*      — восстановление пароля
 * Переключает их showPanel(id). Тексты на экранах — в login.html,
 * тексты ошибок входа — в AUTH_ERRORS (js/api.js). 60 с до повторной отправки
 * письма — в startResendCooldown(), 20 с ожидания сервера — в withBusy().
 */

let REG_EMAIL = '';
let RESEND_TIMER = null;
const STEPS = ['panel-register-1', 'panel-register-2', 'panel-register-3', 'panel-register-done'];

// Supabase кладёт результат перехода по ссылке в hash и сразу его стирает — запоминаем заранее.
const URL_HASH = new URLSearchParams(location.hash.slice(1));
const URL_QUERY = new URLSearchParams(location.search);

// показать один экран формы, остальные скрыть
function showPanel(id) {
  document.querySelectorAll('.auth-step').forEach((s) => s.classList.toggle('active', s.id === id));
}
// подсветить вкладку «Вход» или «Регистрация»
function setTabs(tab) {
  document.getElementById('tab-login-btn').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register-btn').classList.toggle('active', tab === 'register');
}
function showTab(tab) {
  setTabs(tab);
  showPanel(tab === 'login' ? 'panel-login' : STEPS[0]);
}
function showStep(i) {
  showPanel(STEPS[i]);
}
function showDone(title, text) {
  document.getElementById('done-title').textContent = title;
  document.getElementById('done-text').textContent = text;
  showStep(3);
}
/**
 * Блокирует кнопку формы на время запроса и показывает «Подождите…».
 * e.submitter нет в старых Safari, поэтому кнопку ищем в самой форме.
 * Если сервер не ответил за 20 с, кнопка всё равно разблокируется.
 */
async function withBusy(e, fn) {
  const button = e.submitter || e.target.querySelector('[type="submit"]');
  const label = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Подождите…';
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Сервер не отвечает. Проверьте интернет и попробуйте ещё раз.')), 20000);
  });
  try { await Promise.race([fn(), timeout]); }
  catch (ex) { showError(e.target.querySelector('.error-text'), ex.message); }
  finally { clearTimeout(timer); button.disabled = false; button.innerHTML = label; }
}
/** Показывает ошибку заново, даже если текст тот же, — с коротким «встряхиванием». */
function showError(el, message) {
  el.textContent = message;
  el.classList.remove('shake');
  void el.offsetWidth; // перезапуск анимации
  el.classList.add('shake');
}

// кнопка «Отправить ещё раз» блокируется на 60 секунд (защита от лимита писем)
function startResendCooldown() {
  const btn = document.getElementById('resend-code');
  let left = 60;
  btn.disabled = true;
  clearInterval(RESEND_TIMER);
  RESEND_TIMER = setInterval(() => {
    left -= 1;
    btn.textContent = left > 0 ? `Отправить ещё раз через ${left} с` : 'Отправить код ещё раз';
    if (left <= 0) { clearInterval(RESEND_TIMER); btn.disabled = false; }
  }, 1000);
}

/** Решение после подтверждения e-mail (кодом или ссылкой из письма). */
async function continueAfterConfirm(profile) {
  if (profile && profile.registrationCompleted) {
    await api.auth.logout();
    if (profile.status === 'approved') return showDone('Вы уже зарегистрированы', 'Войдите по e-mail и паролю на вкладке «Вход».');
    if (profile.status === 'rejected') return showDone('Заявка отклонена', `Причина: ${profile.rejectionReason || 'не указана'}. Обратитесь к учителю.`);
    return showDone('Заявка уже на рассмотрении', 'Учитель ещё не принял решение. Как только одобрит — войдите по e-mail и паролю.');
  }
  REG_EMAIL = profile ? profile.email : REG_EMAIL;
  setTabs('register');
  showStep(2);
  document.getElementById('reg-lastname').focus();
}

function showResetRequest(email, error) {
  setTabs('login');
  showPanel('panel-reset-1');
  const input = document.getElementById('reset-email');
  if (email) input.value = email;
  const err = document.getElementById('reset-email-error');
  if (error) showError(err, error); else err.textContent = '';
  input.focus();
}

(async function init() {
  const isReset = URL_QUERY.get('reset') === '1' || URL_HASH.get('type') === 'recovery';
  const linkError = URL_HASH.get('error_code') || URL_HASH.get('error');
  const profile = await api.auth.sessionProfile().catch(() => null);
  if (URL_QUERY.toString() || location.hash) history.replaceState(null, '', 'login.html');

  if (isReset) {
    if (!profile) return showResetRequest('', 'Ссылка устарела или уже использована — запросите новое письмо.');
    // по ссылке пришёл человек, не закончивший регистрацию, — у него ещё нет пароля и ФИО
    if (!profile.registrationCompleted) return continueAfterConfirm(profile);
    document.getElementById('reset-account').textContent = profile.email;
    setTabs('login');
    showPanel('panel-reset-2');
    document.getElementById('reset-password').focus();
    return;
  }
  if (profile && profile.status === 'approved' && profile.registrationCompleted) {
    window.location.href = profile.role === 'teacher' ? 'teacher.html' : 'student.html';
    return;
  }
  if (profile) {
    // вернулись по ссылке из письма — e-mail подтверждён, продолжаем регистрацию
    return continueAfterConfirm(profile);
  }
  if (linkError && URL_QUERY.get('confirmed') === '1') {
    showTab('register');
    return showError(document.getElementById('reg-email-error'), 'Ссылка из письма устарела или уже использована — запросите новую.');
  }
  showTab(URL_QUERY.get('tab') === 'register' ? 'register' : 'login');
})();

document.getElementById('tab-login-btn').addEventListener('click', () => showTab('login'));
document.getElementById('tab-register-btn').addEventListener('click', () => showTab('register'));
document.getElementById('to-register').addEventListener('click', () => showTab('register'));
document.getElementById('to-reset').addEventListener('click', () => showResetRequest(document.getElementById('login-email').value.trim()));
document.querySelectorAll('[data-to-login]').forEach((b) => b.addEventListener('click', () => showTab('login')));

// ---------- восстановление пароля ----------
document.getElementById('reset-email-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = document.getElementById('reset-email-error');
  err.textContent = '';
  withBusy(e, async () => {
    try {
      const email = await api.auth.requestPasswordReset(document.getElementById('reset-email').value);
      document.getElementById('reset-sent-email').textContent = email;
      showPanel('panel-reset-sent');
    } catch (ex) { showError(err, ex.message); }
  });
});

document.getElementById('reset-password-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = document.getElementById('reset-password-error');
  err.textContent = '';
  const password = document.getElementById('reset-password').value;
  if (password !== document.getElementById('reset-password-2').value) { showError(err, 'Пароли не совпадают.'); return; }
  withBusy(e, async () => {
    try {
      await api.auth.setNewPassword(password);
      showDone('Пароль изменён', 'Теперь войдите по e-mail и новому паролю на вкладке «Вход».');
    } catch (ex) { showError(err, ex.message); }
  });
});

// ---------- вход ----------
document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = document.getElementById('login-error');
  err.textContent = '';
  withBusy(e, async () => {
    try {
      const user = await api.auth.login(
        document.getElementById('login-email').value,
        document.getElementById('login-password').value,
      );
      window.location.href = user.role === 'teacher' ? 'teacher.html' : 'student.html';
    } catch (ex) { showError(err, ex.message); }
  });
});

// ---------- шаг 1: код на почту ----------
document.getElementById('register-email-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = document.getElementById('reg-email-error');
  err.textContent = '';
  withBusy(e, async () => {
    try {
      REG_EMAIL = await api.auth.requestCode(document.getElementById('reg-email').value);
      document.getElementById('code-email').textContent = REG_EMAIL;
      document.getElementById('reg-code').value = '';
      document.getElementById('reg-code-error').textContent = '';
      showStep(1);
      startResendCooldown();
      document.getElementById('reg-code').focus();
    } catch (ex) { showError(err, ex.message); }
  });
});

document.getElementById('resend-code').addEventListener('click', async () => {
  try {
    await api.auth.requestCode(REG_EMAIL);
    showToast('Новый код отправлен');
    startResendCooldown();
  } catch (ex) { showToast(ex.message, true); }
});
document.getElementById('back-to-step1').addEventListener('click', () => showStep(0));

// ---------- шаг 2: проверка кода ----------
document.getElementById('register-code-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = document.getElementById('reg-code-error');
  err.textContent = '';
  withBusy(e, async () => {
    try {
      // Уже зарегистрированный человек не должен переписать свою заявку.
      await continueAfterConfirm(await api.auth.verifyCode(REG_EMAIL, document.getElementById('reg-code').value));
    } catch (ex) { showError(err, ex.message); }
  });
});

// ---------- шаг 3: пароль + ФИО ----------
document.getElementById('register-details-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = document.getElementById('reg-details-error');
  err.textContent = '';
  withBusy(e, async () => {
    try {
      await api.auth.submitRegistration({
        password: document.getElementById('reg-password').value,
        lastName: document.getElementById('reg-lastname').value.trim(),
        firstName: document.getElementById('reg-firstname').value.trim(),
        middleName: document.getElementById('reg-middlename').value.trim(),
        className: document.getElementById('reg-class').value.trim().toUpperCase(),
      });
      showDone('Заявка отправлена', 'Учитель рассмотрит её и назначит роль — ученик или учитель. После одобрения входите по e-mail и паролю.');
    } catch (ex) { showError(err, ex.message); }
  });
});

document.getElementById('register-done-back').addEventListener('click', () => showTab('login'));
