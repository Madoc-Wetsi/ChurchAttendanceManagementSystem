/* ===============================================================
   ChurchStore — front-end data layer
   ---------------------------------------------------------------
   Everything is persisted in localStorage so the whole flow
   (add member -> take attendance -> export) works with no backend.

   When PHP/MySQL is ready, replace the read/write functions below
   with fetch() calls. The public API must stay the same and every
   page will keep working untouched.
   =============================================================== */
window.ChurchStore = (function () {
  const K = {
    members: "flc_members",
    attendance: "flc_attendance",
    session: "flc_session",
  };

  /* A church runs two kinds of service, and both need their own
     attendance sheet. Every record is stored per date AND per type. */
  const SERVICE_TYPES = {
    sunday: { id: "sunday", label: "Sunday Service", short: "Sunday" },
    midweek: { id: "midweek", label: "Midweek Service", short: "Midweek" },
  };

  const MINISTRIES = [
    "Choir",
    "Ushering",
    "Sunday School",
    "Youth",
    "Media / Technical",
    "Protocol",
    "Prayer Warriors",
    "Finance",
    "Children's Ministry",
    "Evangelism",
    "None",
  ];

  /* ---------- storage helpers ---------- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function uid() {
    return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function key(d) {
    const dt = d ? new Date(d) : new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function prettyDate(k) {
    if (!k) return "";
    const parts = k.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  /* Compact date for tables: "25 Oct 2026" */
  function shortDate(k) {
    if (!k) return "";
    const parts = k.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (c) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c];
      }
    );
  }

  /* Most recent Sunday (today, if today is Sunday) — the sensible
     default when taking Sunday attendance. */
  function defaultDateFor(type) {
    const now = new Date();
    if (type === "sunday") {
      const d = new Date(now);
      d.setDate(now.getDate() - now.getDay());
      return key(d);
    }
    return key();
  }

  /* ---------- one-off migration ----------
     Records written before service types existed look like
       { "2026-10-25": { memberId: "present" } }
     and need wrapping into the Sunday sheet:
       { "2026-10-25": { sunday: { memberId: "present" } } }       */
  function migrate() {
    const att = read(K.attendance, {});
    let attChanged = false;

    Object.keys(att).forEach(function (date) {
      const day = att[date] || {};
      const ids = Object.keys(day);
      if (!ids.length) return;
      if (day[ids[0]] === "present" || day[ids[0]] === "absent") {
        att[date] = { sunday: day };
        attChanged = true;
      }
    });

    if (attChanged) write(K.attendance, att);

    // Members gained ministry + date of birth; backfill empty values.
    const members = read(K.members, []);
    let memChanged = false;
    members.forEach(function (m) {
      if (m.ministry === undefined) {
        m.ministry = "";
        memChanged = true;
      }
      if (m.dob === undefined) {
        m.dob = "";
        memChanged = true;
      }
    });
    if (memChanged) write(K.members, members);
  }

  try {
    migrate();
  } catch (e) {
    /* never let migration block the app */
  }

  /* ---------- members ---------- */
  function getMembers() {
    return read(K.members, []);
  }

  function getMember(id) {
    return getMembers().find(function (m) {
      return m.id === id;
    });
  }

  function addMember(data) {
    const members = getMembers();
    const member = {
      id: uid(),
      first: String(data.first || "").trim(),
      last: String(data.last || "").trim(),
      email: String(data.email || "").trim(),
      phone: String(data.phone || "").trim(),
      ministry: String(data.ministry || "").trim(),
      dob: String(data.dob || "").trim(),
      photo: data.photo || "",
      joined: key(),
    };
    members.push(member);
    write(K.members, members);
    return member;
  }

  /* Updates only the fields passed in; everything else is preserved. */
  function updateMember(id, patch) {
    const members = getMembers();
    const idx = members.findIndex(function (m) {
      return m.id === id;
    });
    if (idx === -1) return null;

    const current = members[idx];
    const next = {
      id: current.id,
      joined: current.joined,
      photo: current.photo,
      first: String(patch.first !== undefined ? patch.first : current.first).trim(),
      last: String(patch.last !== undefined ? patch.last : current.last).trim(),
      email: String(patch.email !== undefined ? patch.email : current.email).trim(),
      phone: String(patch.phone !== undefined ? patch.phone : current.phone).trim(),
      ministry: String(
        patch.ministry !== undefined ? patch.ministry : current.ministry || ""
      ).trim(),
      dob: String(patch.dob !== undefined ? patch.dob : current.dob || "").trim(),
    };
    if (patch.photo !== undefined) next.photo = patch.photo;

    members[idx] = next;
    write(K.members, members);
    return next;
  }

  function deleteMember(id) {
    const members = getMembers().filter(function (m) {
      return m.id !== id;
    });
    write(K.members, members);

    // scrub the member out of every service record
    const att = getAttendance();
    Object.keys(att).forEach(function (date) {
      Object.keys(att[date]).forEach(function (type) {
        if (att[date][type][id]) delete att[date][type][id];
        if (!Object.keys(att[date][type]).length) delete att[date][type];
      });
      if (!Object.keys(att[date]).length) delete att[date];
    });
    write(K.attendance, att);
    return members;
  }

  function searchMembers(term) {
    const q = String(term || "").trim().toLowerCase();
    const members = getMembers();
    if (!q) return members;
    return members.filter(function (m) {
      return (
        (m.first + " " + m.last).toLowerCase().indexOf(q) > -1 ||
        (m.email || "").toLowerCase().indexOf(q) > -1 ||
        (m.phone || "").toLowerCase().indexOf(q) > -1 ||
        (m.ministry || "").toLowerCase().indexOf(q) > -1
      );
    });
  }

  /* ---------- attendance ----------
     Shape: att[date][type][memberId] = "present" | "absent"       */
  function getAttendance() {
    return read(K.attendance, {});
  }

  function getRecord(date, type) {
    type = type || "sunday";
    const day = getAttendance()[date];
    return (day && day[type]) || {};
  }

  function setStatus(date, type, memberId, status) {
    type = type || "sunday";
    const att = getAttendance();
    if (!att[date]) att[date] = {};
    if (!att[date][type]) att[date][type] = {};

    if (status) {
      att[date][type][memberId] = status;
    } else {
      delete att[date][type][memberId];
      if (!Object.keys(att[date][type]).length) delete att[date][type];
      if (!Object.keys(att[date]).length) delete att[date];
    }
    write(K.attendance, att);
  }

  function markAll(date, type, status) {
    type = type || "sunday";
    const att = getAttendance();
    const rec = {};
    getMembers().forEach(function (m) {
      rec[m.id] = status;
    });
    if (!att[date]) att[date] = {};
    att[date][type] = rec;
    write(K.attendance, att);
  }

  function clearRecord(date, type) {
    type = type || "sunday";
    const att = getAttendance();
    if (att[date]) {
      delete att[date][type];
      if (!Object.keys(att[date]).length) delete att[date];
    }
    write(K.attendance, att);
  }

  function hasRecord(date, type) {
    const rec = getRecord(date, type);
    return Object.keys(rec).length > 0;
  }

  /* Every service ever taken, newest first:
     [{ date: "2026-10-25", type: "sunday" }, ...] */
  function listServices() {
    const att = getAttendance();
    const out = [];
    Object.keys(att).forEach(function (date) {
      Object.keys(att[date]).forEach(function (type) {
        if (Object.keys(att[date][type]).length) {
          out.push({ date: date, type: type });
        }
      });
    });
    out.sort(function (a, b) {
      if (a.date === b.date) return a.type < b.type ? 1 : -1;
      return a.date < b.date ? 1 : -1;
    });
    return out;
  }

  function countServices(type) {
    return listServices().filter(function (s) {
      return !type || s.type === type;
    }).length;
  }

  function statsFor(date, type) {
    const members = getMembers();
    const rec = getRecord(date, type);
    let present = 0;
    let absent = 0;
    members.forEach(function (m) {
      if (rec[m.id] === "present") present++;
      else if (rec[m.id] === "absent") absent++;
    });
    return {
      total: members.length,
      present: present,
      absent: absent,
      unmarked: members.length - present - absent,
      rate: members.length ? Math.round((present / members.length) * 100) : 0,
    };
  }

  function overallStats() {
    const today = key();
    const services = listServices();
    return {
      totalMembers: getMembers().length,
      services: services.length,
      sundayServices: services.filter(function (s) {
        return s.type === "sunday";
      }).length,
      midweekServices: services.filter(function (s) {
        return s.type === "midweek";
      }).length,
      todayKey: today,
      todayLabel: prettyDate(today),
      today: {
        sunday: statsFor(today, "sunday"),
        midweek: statsFor(today, "midweek"),
      },
    };
  }

  function typeLabel(type) {
    return (SERVICE_TYPES[type] || SERVICE_TYPES.sunday).label;
  }

  function typeShort(type) {
    return (SERVICE_TYPES[type] || SERVICE_TYPES.sunday).short;
  }

  /* ---------- history ---------- */

  /* Full roster for one service, split by status.
     Unmarked members are the ones on the register who were never
     ticked that day — useful for spotting records left incomplete. */
  function serviceDetail(date, type) {
    type = type || "sunday";
    const rec = getRecord(date, type);
    const present = [];
    const absent = [];
    const unmarked = [];

    getMembers().forEach(function (m) {
      const status = rec[m.id];
      if (status === "present") present.push(m);
      else if (status === "absent") absent.push(m);
      else unmarked.push(m);
    });

    const s = statsFor(date, type);
    return {
      date: date,
      type: type,
      label: typeLabel(type),
      present: present,
      absent: absent,
      unmarked: unmarked,
      stats: s,
    };
  }

  /* Every service detail, newest first, optionally one type only. */
  function serviceHistory(type) {
    return listServices()
      .filter(function (svc) {
        return !type || svc.type === type;
      })
      .map(function (svc) {
        return serviceDetail(svc.date, svc.type);
      });
  }

  /* One member's attendance across every service ever taken. */
  function memberHistory(memberId) {
    const att = getAttendance();
    const rows = [];

    Object.keys(att)
      .sort()
      .reverse()
      .forEach(function (date) {
        Object.keys(att[date]).forEach(function (type) {
          const status = att[date][type][memberId];
          if (!status) return;
          rows.push({
            date: date,
            type: type,
            label: typeLabel(type),
            status: status,
          });
        });
      });

    const attended = rows.filter(function (r) {
      return r.status === "present";
    }).length;

    // Consecutive attended services ending with the most recent one.
    const chronological = rows.slice().reverse();
    let streak = 0;
    for (let i = chronological.length - 1; i >= 0; i--) {
      if (chronological[i].status === "present") streak++;
      else break;
    }

    return {
      rows: rows,
      attended: attended,
      missed: rows.length - attended,
      total: rows.length,
      rate: rows.length ? Math.round((attended / rows.length) * 100) : 0,
      streak: streak,
    };
  }

  /* Every member's headline attendance number, best rate first.
     Powers the "who attends regularly" leaderboard on History. */
  function attendanceLeaderboard() {
    const all = listServices();

    return getMembers()
      .map(function (m) {
        const h = memberHistory(m.id);
        return {
          member: m,
          attended: h.attended,
          missed: h.missed,
          total: h.total,
          rate: h.total ? Math.round((h.attended / h.total) * 100) : 0,
          streak: h.streak,
          last: h.rows.length ? h.rows[0].date : "",
        };
      })
      .sort(function (a, b) {
        if (b.rate !== a.rate) return b.rate - a.rate;
        if (b.attended !== a.attended) return b.attended - a.attended;
        return a.member.last.localeCompare(b.member.last);
      });
  }

  /* ---------- session (demo auth) ---------- */
  function getUser() {
    return read(K.session, null);
  }

  function login(name, email) {
    const user = {
      name: name || "Church Admin",
      email: email || "",
      since: key(),
    };
    write(K.session, user);
    return user;
  }

  function logout() {
    localStorage.removeItem(K.session);
  }

  /* ---------- export ---------- */
  function toCSV(date, type) {
    type = type || "sunday";
    const rows = [
      ["Date", "Service", "First Name", "Last Name", "Email", "Phone", "Ministry", "Date of Birth", "Status"],
    ];
    const rec = getRecord(date, type);
    getMembers().forEach(function (m) {
      const status = rec[m.id] || "unmarked";
      rows.push([
        date,
        typeLabel(type),
        m.first,
        m.last,
        m.email,
        m.phone,
        m.ministry || "",
        m.dob || "",
        status,
      ]);
    });
    return rows
      .map(function (r) {
        return r
          .map(function (cell) {
            const v = String(cell == null ? "" : cell);
            return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
          })
          .join(",");
      })
      .join("\r\n");
  }

  function download(filename, text) {
    const blob = new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  return {
    SERVICE_TYPES: SERVICE_TYPES,
    MINISTRIES: MINISTRIES,
    key: key,
    prettyDate: prettyDate,
    shortDate: shortDate,
    esc: esc,
    defaultDateFor: defaultDateFor,
    getMembers: getMembers,
    getMember: getMember,
    addMember: addMember,
    updateMember: updateMember,
    deleteMember: deleteMember,
    searchMembers: searchMembers,
    getAttendance: getAttendance,
    getRecord: getRecord,
    setStatus: setStatus,
    markAll: markAll,
    clearRecord: clearRecord,
    hasRecord: hasRecord,
    listServices: listServices,
    countServices: countServices,
    statsFor: statsFor,
    overallStats: overallStats,
    serviceDetail: serviceDetail,
    serviceHistory: serviceHistory,
    memberHistory: memberHistory,
    attendanceLeaderboard: attendanceLeaderboard,
    typeLabel: typeLabel,
    typeShort: typeShort,
    getUser: getUser,
    login: login,
    logout: logout,
    toCSV: toCSV,
    download: download,
  };
})();
