/**
 * login.js — вход и регистрация в три шага: e-mail → код из письма →
 * пароль и ФИО. Код отправляет и проверяет Supabase Auth; после третьего
 * шага профиль ждёт решения учителя (status = pending).
 */

let REG_EMAIL = '';
let RESEND_TIMER = null;
const STEPS = ['panel-register-1', 'panel-register-2', 'panel-register-3', 'panel-register-done'];

function showTab(tab) {
  document.getElementById('tab-login-btn').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register-btn').classList.toggle('active', tab === 'register');
  document.getElementById('panel-login').classList.toggle('active', tab === 'login');
  STEPS.forEach((id, i) => document.getElementById(id).classList.toggle('active', tab === 'register' && i === 0));
}
function showStep(i) {
  document.getElementById('panel-login').classList.remove('active');
  STEPS.forEach((id, idx) => document.getElementById(id).classList.toggle('active', idx === i));
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
  document.getElementById('tab-register-btn').classList.add('active');
  document.getElementById('tab-login-btn').classList.remove('active');
  showStep(2);
  document.getElementById('reg-lastname').focus();
}

(async function init() {
  const profile = await api.auth.sessionProfile().catch(() => null);
  if (profile && profile.status === 'approved' && profile.registrationCompleted) {
    window.location.href = profile.role === 'teacher' ? 'teacher.html' : 'student.html';
    return;
  }
  if (profile) {
    // вернулись по ссылке из письма — e-mail подтверждён, продолжаем регистрацию
    await continueAfterConfirm(profile);
    history.replaceState(null, '', 'login.html');
    return;
  }
  showTab(new URLSearchParams(location.search).get('tab') === 'register' ? 'register' : 'login');
})();

document.getElementById('tab-login-btn').addEventListener('click', () => showTab('login'));
document.getElementById('tab-register-btn').addEventListener('click', () => showTab('register'));
document.getElementById('to-register').addEventListener('click', () => showTab('register'));

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
