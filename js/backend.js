/* ============================================================
   ChurchBackend — transport layer
   ------------------------------------------------------------
   Sits between the front end (js/store.js) and your PHP.

   The app always reads and writes through localStorage, which
   keeps every page fast and lets the whole UI stay synchronous.
   When a backend is configured, this file:

     1. pulls the real data down once at start-up (bootstrap),
        overwriting the local cache so the pages render real
        records, then
     2. pushes each collection back up whenever the store saves,
        so MySQL stays in step.

   If the API is unreachable, it says so in the console and
   quietly keeps running on the browser's own storage — the app
   never breaks just because the server is down.

   Contract with PHP (see api/index.php):
     GET  {apiBase}/index.php?action=bootstrap
          -> { ok: true, data: { members: [], attendance: {}, bacentas: [] } }
     POST {apiBase}/index.php      body: { collection, data }
          -> { ok: true }
   ============================================================ */
window.ChurchBackend = (function () {
  const cfg = window.CHURCH_CONFIG || {};

  /* localStorage key for each logical collection. These must match
     the keys store.js uses. */
  const COLLECTIONS = {
    members: "flc_members",
    attendance: "flc_attendance",
    bacentas: "flc_bacentas",
  };

  /* Work out where the API lives.
     The pages sit in /pages/ and /auth/, so a bare "api" would
     resolve to /pages/api and 404. Anchor relative paths to the
     project root — the folder containing this js/ directory —
     which keeps the config short and makes it work from any page
     and from any install folder. */
  function resolveBase(raw) {
    raw = String(raw || "").trim();
    if (!raw) return "";

    // A full URL is used as-is.
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw.replace(/\/+$/, "");

    // Root-absolute path: keep, but anchor to this origin.
    if (raw.charAt(0) === "/") {
      return location.origin + raw.replace(/\/+$/, "");
    }

    // Otherwise find this script (<root>/js/backend.js) and go up one.
    let root = "";
    const me = document.currentScript;
    if (me && me.src) {
      root = me.src.replace(/js\/backend\.js(?:\?.*)?$/i, "");
    } else {
      for (let i = 0; i < document.scripts.length; i++) {
        const s = document.scripts[i].src || "";
        if (/js\/backend\.js/i.test(s)) {
          root = s.replace(/js\/backend\.js(?:\?.*)?$/i, "");
          break;
        }
      }
    }
    if (!root) root = location.href.replace(/[^/]*$/, ""); // last resort

    return (root + raw).replace(/\/+$/, "");
  }

  let base = resolveBase(cfg.apiBase);
  let enabled = !!base;
  let state = enabled ? "loading" : "ready";
  let csrfToken = "";

  const waiters = []; // callbacks parked until data is ready
  const pending = {}; // collection -> latest value waiting to go up
  let flushTimer = null;

  function endpoint() {
    return base + "/index.php";
  }

  function authEndpoint(action) {
    return base + "/auth.php?action=" + encodeURIComponent(action);
  }

  function isProtectedPage() {
    return /\/pages\/|\/auth\/(add-member|edit-member)\.html$/i.test(
      location.pathname
    );
  }

  function isPublicAuthPage() {
    return /\/auth\/(login|register)\.html$/i.test(location.pathname);
  }

  function loginPageUrl() {
    const match = location.pathname.match(/^(.*)\/(?:pages|auth)\//i);
    return location.origin + (match ? match[1] : "") + "/auth/login.html";
  }

  function showError(message) {
    let banner = document.getElementById("church-api-error");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "church-api-error";
      banner.setAttribute("role", "alert");
      banner.style.cssText =
        "position:fixed;z-index:9999;top:0;left:0;right:0;padding:14px;" +
        "background:#8b1e1e;color:#fff;text-align:center;font:14px sans-serif";
      document.body.insertBefore(banner, document.body.firstChild);
    }
    banner.textContent = message;
  }

  function saveUser(user) {
    if (user) {
      localStorage.setItem("flc_session", JSON.stringify(user));
    } else {
      localStorage.removeItem("flc_session");
      Object.keys(COLLECTIONS).forEach(function (name) {
        localStorage.removeItem(COLLECTIONS[name]);
      });
    }
  }

  function authRequest(action, data) {
    const headers = { "Content-Type": "application/json" };
    if (action === "logout" && csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
    return fetch(authEndpoint(action), {
      method: "POST",
      credentials: "same-origin",
      headers: headers,
      body: JSON.stringify(data || {}),
    }).then(function (res) {
      return res.json().catch(function () {
        throw new Error("The server returned an invalid response.");
      }).then(function (json) {
        if (!res.ok || !json || json.ok !== true) {
          throw new Error(
            json && json.error ? json.error : "Authentication request failed."
          );
        }
        return json;
      });
    });
  }

  function mode() {
    if (!enabled) return "local";
    return state === "ready" ? "api" : "loading";
  }

  /* ---- run callbacks once data is available ---- */
  function whenReady(fn) {
    if (state === "ready") fn();
    else waiters.push(fn);
  }

  function runWaiters() {
    while (waiters.length) {
      try {
        waiters.shift()();
      } catch (e) {
        console.error("[ChurchBackend] page boot failed:", e);
      }
    }
  }

  /* ---- pull everything down once ---- */
  function bootstrap() {
    if (!enabled) return;
    if (isPublicAuthPage()) {
      state = "ready";
      return;
    }

    fetch(endpoint() + "?action=bootstrap", {
      credentials: "same-origin",
    })
      .then(function (res) {
        return res.json().catch(function () {
          throw new Error("The server returned an invalid response.");
        }).then(function (json) {
          if (!res.ok) {
            const error = new Error(
              json && json.error ? json.error : "HTTP " + res.status
            );
            error.status = res.status;
            throw error;
          }
          return json;
        });
      })
      .then(function (json) {
        if (!json || json.ok !== true || !json.data) {
          throw new Error("Unexpected bootstrap payload");
        }
        if (!json.user || !json.csrfToken) {
          throw new Error("The server did not return an authenticated session.");
        }
        csrfToken = json.csrfToken;
        saveUser(json.user);
        Object.keys(COLLECTIONS).forEach(function (name) {
          if (json.data[name] !== undefined) {
            localStorage.setItem(
              COLLECTIONS[name],
              JSON.stringify(json.data[name])
            );
          }
        });
        state = "ready";
        runWaiters();
      })
      .catch(function (err) {
        if (err.status === 401) {
          saveUser(null);
          state = "unauthenticated";
          if (isProtectedPage()) {
            location.replace(loginPageUrl());
          }
          return;
        }

        state = "failed";
        console.error("[ChurchBackend] API bootstrap failed:", err);
        showError(
          "Could not load the database. Check that Apache, MySQL, and the API are available, then reload this page."
        );
      });
  }

  /* ---- push a collection up (debounced, last write wins) ---- */
  function push(key, value) {
    if (!enabled) return;
    pending[key] = value;
    if (flushTimer) return;
    flushTimer = setTimeout(flush, 350);
  }

  function flush() {
    flushTimer = null;
    // Send one collection per tick so a failure only loses that one.
    Object.keys(pending).forEach(function (key) {
      const body = {
        collection: collectionNameFor([key]),
        data: pending[key],
      };
      delete pending[key];

      fetch(endpoint(), {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(body),
      })
        .then(function (res) {
          if (!res.ok) {
            const error = new Error("HTTP " + res.status);
            error.status = res.status;
            throw error;
          }
          return res.json();
        })
        .then(function (json) {
          if (!json || json.ok !== true) {
            console.warn("[ChurchBackend] Save rejected for " + key, json);
          }
        })
        .catch(function (err) {
          console.warn(
            "[ChurchBackend] Could not save " +
              key +
              " — the change is kept in this browser only.",
            err
          );
          if (err.status === 401 || err.status === 403) {
            location.replace(loginPageUrl());
          } else {
            showError(
              "Could not save " +
                key +
                " to the database. Check your connection and reload before continuing."
            );
          }
        });
    });
  }

  function collectionNameFor(keys) {
    const found = Object.keys(COLLECTIONS).filter(function (name) {
      return COLLECTIONS[name] === keys[0];
    })[0];
    return found || keys[0];
  }

  /* Flush anything still queued when the tab closes, so a change
     isn't lost on the way out. */
  window.addEventListener("beforeunload", function () {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flush();
    }
  });

  document.addEventListener("click", function (event) {
    const target = event.target;
    const link = target && target.closest
      ? target.closest("[data-sign-out]")
      : null;
    if (!link || !enabled) return;
    event.preventDefault();
    authRequest("logout", { csrfToken: csrfToken })
      .then(function () {
        csrfToken = "";
        saveUser(null);
        window.location.href = link.href;
      })
      .catch(function (err) {
        window.alert("Could not sign out: " + err.message);
      });
  });

  /* Go. */
  bootstrap();

  return {
    get enabled() {
      return enabled;
    },
    mode: mode,
    whenReady: whenReady,
    push: push,
    login: function (email, password) {
      return authRequest("login", { email: email, password: password }).then(
        function (result) {
          csrfToken = result.csrfToken;
          saveUser(result.user);
          return result;
        }
      );
    },
    logout: function () {
      return authRequest("logout", { csrfToken: csrfToken }).then(function () {
        csrfToken = "";
        saveUser(null);
      });
    },
    config: cfg,
  };
})();
