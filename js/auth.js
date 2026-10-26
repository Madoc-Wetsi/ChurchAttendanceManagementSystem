/* Login / Register — demo auth backed by localStorage.
   When PHP is ready, swap the success branches for fetch() calls. */
(function () {
  const S = window.ChurchStore;
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  function showErr(el, msg) {
    if (el) el.textContent = msg || "";
  }

  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  /* ---------------- Login ---------------- */
  if (loginForm) {
    const err = document.getElementById("login-err");

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      if (!email) return showErr(err, "Please enter your email.");
      if (!isEmail(email)) return showErr(err, "That email address doesn't look right.");
      if (!password) return showErr(err, "Please enter your password.");

      showErr(err, "");

      // Derive a display name from the email so the dashboard feels personal.
      const guessed = email.split("@")[0].replace(/[._-]+/g, " ");
      const name = guessed.replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });

      S.login(name, email);
      window.location.href = "../pages/dashboard.html";
    });
  }

  /* ---------------- Register ---------------- */
  if (registerForm) {
    const err = document.getElementById("register-err");

    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
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
      S.login(name, email);
      window.location.href = "../pages/dashboard.html";
    });
  }
})();
