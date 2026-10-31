/* Authentication forms use the server session when API mode is enabled. */
(function () {
  const S = window.ChurchStore;
  const backend = window.ChurchBackend;
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  function showErr(el, msg) {
    if (el) el.textContent = msg || "";
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  if (backend && backend.enabled) {
    const registerNote = document.getElementById("register-locked");
    const registerLink = document.getElementById("create-account");
    if (registerForm) registerForm.hidden = true;
    if (registerNote) registerNote.hidden = false;
    if (registerLink) registerLink.hidden = true;
  }

  if (loginForm) {
    const err = document.getElementById("login-err");
    const button = loginForm.querySelector('button[type="submit"]');

    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      if (!email) return showErr(err, "Please enter your email.");
      if (!isEmail(email)) return showErr(err, "That email address doesn't look right.");
      if (!password) return showErr(err, "Please enter your password.");
      showErr(err, "");

      if (!backend || !backend.enabled) {
        const guessed = email.split("@")[0].replace(/[._-]+/g, " ");
        const name = guessed.replace(/\b\w/g, function (c) {
          return c.toUpperCase();
        });
        S.login(name, email);
        window.location.href = "../pages/dashboard.html";
        return;
      }

      button.disabled = true;
      backend.login(email, password)
        .then(function () {
          window.location.href = "../pages/dashboard.html";
        })
        .catch(function (error) {
          showErr(err, error.message);
          button.disabled = false;
        });
    });
  }

  if (registerForm && (!backend || !backend.enabled)) {
    const err = document.getElementById("register-err");
    const button = registerForm.querySelector('button[type="submit"]');

    registerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const name = registerForm.name.value.trim();
      const email = registerForm.email.value.trim();
      const password = registerForm.password.value;
      const confirm = registerForm.confirm.value;

      if (!name) return showErr(err, "Please enter your full name.");
      if (!email) return showErr(err, "Please enter your email.");
      if (!isEmail(email)) return showErr(err, "That email address doesn't look right.");
      if (password.length < 6) return showErr(err, "Password must be at least 6 characters.");
      if (password !== confirm) return showErr(err, "Passwords do not match.");

      showErr(err, "");
      button.disabled = true;
      S.login(name, email);
      window.location.href = "../pages/dashboard.html";
    });
  }
})();
