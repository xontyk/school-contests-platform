/**
 * login.js — вход и регистрация в три шага (email → код → пароль/ФИО).
 */

let REG_EMAIL = '';

function showAuthTab(tab) {
  document.getElementById('tab-login-btn').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register-btn').classList.toggle('active', tab === 'register');
  document.getElementById('panel-login').classList.toggle('active', tab === 'login');
  const regSteps = ['panel-register-1', 'panel-register-2', 'panel-register-3', 'panel-register-done'];
  regSteps.forEach((id, idx) => {
    document.getElementById(id).classList.toggle('active', tab === 'register' && idx === 0);
  });
}

function showRegisterStep(step) {
  ['panel-register-1', 'panel-register-2', 'panel-register-3', 'panel-register-done'].forEach((id, idx) => {
    document.getElementById(id).classList.toggle('active', idx === step);
  });
}

(async function init() {
  const existing = await api.auth.currentUser();
  if (existing) {
    window.location.href = existing.role === 'teacher' ? 'teacher.html' : 'student.html';
    return;
  }
  const params = new URLSearchParams(window.location.search);
  showAuthTab(params.get('tab') === 'register' ? 'register' : 'login');
})();

document.getElementById('tab-login-btn').addEventListener('click', () => showAuthTab('login'));
document.getElementById('tab-register-btn').addEventListener('click', () => showAuthTab('register'));

// ---------------- вход ----------------
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorBox = document.getElementById('login-error');
  errorBox.textContent = '';
  try {
    const user = await api.auth.login(email, password);
    window.location.href = user.role === 'teacher' ? 'teacher.html' : 'student.html';
  } catch (err) {
    errorBox.textContent = err.message;
  }
});

// ---------------- регистрация: шаг 1 — email ----------------
document.getElementById('register-email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('reg-email').value.trim();
  const errorBox = document.getElementById('reg-email-error');
  errorBox.textContent = '';
  try {
    const { code } = await api.auth.requestCode(email);
    REG_EMAIL = email;
    document.getElementById('demo-code-value').textContent = code;
    document.getElementById('demo-code-email').textContent = email;
    document.getElementById('reg-code').value = '';
    document.getElementById('reg-code-error').textContent = '';
    showRegisterStep(1);
  } catch (err) {
    errorBox.textContent = err.message;
  }
});

// ---------------- регистрация: шаг 2 — код ----------------
document.getElementById('back-to-step1').addEventListener('click', () => showRegisterStep(0));

document.getElementById('register-code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('reg-code').value.trim();
  const errorBox = document.getElementById('reg-code-error');
  errorBox.textContent = '';
  try {
    await api.auth.verifyCode(REG_EMAIL, code);
    showRegisterStep(2);
  } catch (err) {
    errorBox.textContent = err.message;
  }
});

// ---------------- регистрация: шаг 3 — пароль + ФИО ----------------
document.getElementById('register-details-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('reg-details-error');
  errorBox.textContent = '';
  try {
    await api.auth.submitRegistration({
      email: REG_EMAIL,
      password: document.getElementById('reg-password').value,
      lastName: document.getElementById('reg-lastname').value.trim(),
      firstName: document.getElementById('reg-firstname').value.trim(),
      middleName: document.getElementById('reg-middlename').value.trim(),
      className: document.getElementById('reg-class').value.trim(),
    });
    showRegisterStep(3);
  } catch (err) {
    errorBox.textContent = err.message;
  }
});

document.getElementById('register-done-back').addEventListener('click', () => {
  showAuthTab('login');
});
