/*
 * Thunder Elite League - Auth hotfix v2.0
 * Unifica el registro/login local y evita que los controladores antiguos
 * devuelvan al usuario al login después de iniciar sesión.
 */
(() => {
  'use strict';

  if (window.__TEL_AUTH_FIX_V2__) return;
  window.__TEL_AUTH_FIX_V2__ = true;

  const KEYS = Object.freeze({
    accounts: 'tel_accounts',
    logged: 'tel_logged_in',
    email: 'tel_current_email',
    username: 'tel_username',
    session: 'tel_session_v2'
  });

  const PROTECTED = new Set([
    '#inicio', '#partidos', '#partidos-resultados', '#partidos-calendario',
    '#resultados', '#calendario', '#clasificacion', '#equipos', '#jugadores',
    '#reglamento', '#noticias', '#contacto', '#cuenta', '#mi-cuenta'
  ]);

  let mode = 'login';
  let explicitLogout = false;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn(`[TEL auth] No se pudo leer ${key}:`, error);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function accounts() {
    const value = readJSON(KEYS.accounts, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function currentUser() {
    const email = normalizeEmail(localStorage.getItem(KEYS.email));
    const all = accounts();
    if (!email || !all[email]) return null;
    return { ...all[email], email };
  }

  function loggedIn() {
    return localStorage.getItem(KEYS.logged) === '1' && Boolean(currentUser());
  }

  function authMessage(text) {
    const el = document.querySelector('#authMessage');
    if (el) el.textContent = text || '';
  }

  function updateUserUI() {
    const user = currentUser();
    const name = user?.name || 'Invitado';
    const email = user?.email || '';

    document.querySelectorAll('#userDisplayName,.account-name,.account-fullname,#accountName,#accountFullName')
      .forEach((el) => { el.textContent = name; });
    document.querySelectorAll('.account-email,#accountEmail,#accountEmail2')
      .forEach((el) => { el.textContent = email || 'usuario@thunderleague.com'; });

    const id = document.querySelector('#accountUserId,#accountId');
    if (id && email) {
      let hash = 0;
      for (const char of email) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
      const code = Math.abs(hash).toString(16).toUpperCase().padEnd(8, '0').slice(0, 8);
      id.textContent = `TEL-${code.slice(0, 4)}-${code.slice(4, 8)}`;
    }
  }

  function activate(hash) {
    const safeHash = hash || '#inicio';
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));

    let target = document.querySelector(safeHash);
    if (!target && safeHash === '#mi-cuenta') target = document.querySelector('#cuenta');
    if (!target && safeHash === '#cuenta') target = document.querySelector('#mi-cuenta');
    if (!target) target = document.querySelector('#inicio');
    target?.classList.add('active');

    document.querySelectorAll('.main-nav a,.side-nav a,.side-menu a,nav a')
      .forEach((link) => link.classList.toggle('active', link.getAttribute('href') === safeHash));
  }

  function showLoggedArea(hash = '#inicio') {
    document.body.classList.remove('auth-locked');
    updateUserUI();

    const destination = PROTECTED.has(hash) ? hash : '#inicio';
    if (location.hash !== destination) history.replaceState(null, '', destination);

    if (typeof window.fromHash === 'function') {
      try { window.fromHash(); } catch (error) { activate(destination); }
    } else {
      activate(destination);
    }
  }

  function showLogin() {
    document.body.classList.add('auth-locked');
    history.replaceState(null, '', '#login');
    activate('#login');
  }

  function saveSession(email) {
    localStorage.setItem(KEYS.logged, '1');
    localStorage.setItem(KEYS.email, email);
    writeJSON(KEYS.session, { email, createdAt: new Date().toISOString() });
    explicitLogout = false;
  }

  function finishLogin(email) {
    saveSession(email);
    authMessage('');
    showLoggedArea('#inicio');
    if (typeof window.showToast === 'function') {
      window.showToast('Sesión iniciada correctamente');
    }
  }

  function setMode(nextMode) {
    mode = nextMode === 'register' ? 'register' : 'login';
    const registering = mode === 'register';

    document.querySelector('.login-card')?.classList.toggle('auth-register', registering);
    const title = document.querySelector('#loginTitle');
    const subtitle = document.querySelector('#loginSubtitle');
    const submit = document.querySelector('#loginSubmit');
    const switchText = document.querySelector('#switchText');
    const switchButton = document.querySelector('#registerSwitch');
    const nameInput = document.querySelector('#loginName');

    if (title) title.textContent = registering ? 'Crea tu cuenta' : 'Inicia sesión en tu cuenta';
    if (subtitle) subtitle.innerHTML = registering
      ? 'Regístrate en <b>Thunder Elite League</b>'
      : 'Bienvenido de vuelta a <b>Thunder Elite League</b>';
    if (submit) submit.innerHTML = registering
      ? 'Crear cuenta <span>→</span>'
      : 'Iniciar sesión <span>→</span>';
    if (switchText) switchText.textContent = registering ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
    if (switchButton) switchButton.textContent = registering ? 'Inicia sesión →' : 'Regístrate →';
    if (nameInput) nameInput.required = registering;
    authMessage('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const email = normalizeEmail(document.querySelector('#loginEmail')?.value);
    const password = String(document.querySelector('#loginPassword')?.value || '').trim();
    const name = String(document.querySelector('#loginName')?.value || '').trim();
    const all = accounts();

    if (!email || !password) {
      authMessage('Completa correo y contraseña.');
      return;
    }

    if (mode === 'register') {
      if (!name) {
        authMessage('Elige un nombre de usuario.');
        return;
      }
      if (all[email]) {
        authMessage('Ese correo ya está registrado. Inicia sesión con esa cuenta.');
        return;
      }
      all[email] = {
        name,
        password,
        createdAt: new Date().toISOString()
      };
      writeJSON(KEYS.accounts, all);
      localStorage.setItem(KEYS.username, name);
      finishLogin(email);
      return;
    }

    const user = all[email];
    if (!user) {
      authMessage('Este correo no está registrado. Pulsa “Regístrate”.');
      return;
    }
    if (String(user.password || '') !== password) {
      authMessage('Contraseña incorrecta.');
      return;
    }

    localStorage.setItem(KEYS.username, user.name || 'ThunderUser');
    finishLogin(email);
  }

  function logout(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    explicitLogout = true;
    localStorage.removeItem(KEYS.logged);
    localStorage.removeItem(KEYS.email);
    localStorage.removeItem(KEYS.session);
    document.querySelector('#userMenu')?.classList.remove('open');
    setMode('login');
    showLogin();
    if (typeof window.showToast === 'function') window.showToast('Sesión cerrada');
  }

  // Expone una única fuente de verdad para los bloques que consulten window.*.
  window.getCurrentUser = currentUser;
  window.isLoggedIn = loggedIn;
  window.applyAuthState = () => loggedIn() ? showLoggedArea(location.hash || '#inicio') : showLogin();
  window.telLogout = logout;

  // Captura antes que los listeners antiguos y evita que se ejecuten dos sistemas de login.
  document.addEventListener('submit', (event) => {
    if (event.target?.matches('#loginForm')) handleSubmit(event);
  }, true);

  document.addEventListener('click', (event) => {
    const switchButton = event.target.closest('#registerSwitch');
    if (switchButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setMode(mode === 'login' ? 'register' : 'login');
      return;
    }

    const logoutButton = event.target.closest('#logoutBtn,.account-logout,#accountLogout');
    if (logoutButton) {
      logout(event);
      return;
    }

    const passwordButton = event.target.closest('.password-toggle');
    if (passwordButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const input = document.querySelector('#loginPassword');
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
      return;
    }

    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href');
    if (!loggedIn() && PROTECTED.has(hash)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showLogin();
      authMessage('Inicia sesión para acceder.');
    }
  }, true);

  window.addEventListener('hashchange', () => {
    const hash = location.hash || '#inicio';
    if (!loggedIn() && PROTECTED.has(hash)) {
      showLogin();
      return;
    }
    if (loggedIn() && hash !== '#login') updateUserUI();
  });

  // Si otro bloque antiguo intenta mandar al login unos segundos después,
  // restaura la vista siempre que la sesión siga siendo válida.
  window.setInterval(() => {
    if (explicitLogout || !loggedIn()) return;
    if (location.hash === '#login' || document.body.classList.contains('auth-locked')) {
      showLoggedArea('#inicio');
    }
  }, 750);

  function start() {
    setMode('login');
    if (loggedIn()) showLoggedArea(location.hash === '#login' ? '#inicio' : (location.hash || '#inicio'));
    else showLogin();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
