/**
 * login.js — логика страницы входа.
 * Если сессия уже есть, сразу перенаправляет на нужную страницу.
 */

(async function init() {
  const existing = await api.auth.currentUser();
  if (existing) {
    window.location.href = existing.role === 'admin' ? 'admin.html' : 'student.html';
  }
})();

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const login = document.getElementById('login').value.trim();
  const password = document.getElementById('password').value;
  const errorBox = document.getElementById('error-text');
  errorBox.textContent = '';

  try {
    const user = await api.auth.login(login, password);
    window.location.href = user.role === 'admin' ? 'admin.html' : 'student.html';
  } catch (err) {
    errorBox.textContent = err.message;
  }
});
