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

  /* No demo data is seeded — the register starts empty and is filled
     in through the Add Member screen. */

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
      photo: data.photo || "",
      joined: key(),
    };
    members.push(member);
    write(K.members, members);
    return member;
  }

  function deleteMember(id) {
    const members = getMembers().filter(function (m) {
      return m.id !== id;
    });
    write(K.members, members);

    // scrub the member out of every service record
    const att = getAttendance();
    Object.keys(att).forEach(function (date) {
      if (att[date][id]) delete att[date][id];
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
        (m.phone || "").toLowerCase().indexOf(q) > -1
      );
    });
  }

  /* ---------- attendance ---------- */
  function getAttendance() {
    return read(K.attendance, {});
  }

  function getRecord(date) {
    return getAttendance()[date] || {};
  }

  function setStatus(date, memberId, status) {
    const att = getAttendance();
    if (!att[date]) att[date] = {};
    if (status) {
      att[date][memberId] = status;
    } else {
      delete att[date][memberId];
      if (!Object.keys(att[date]).length) delete att[date];
    }
    write(K.attendance, att);
  }

  function markAll(date, status) {
    const att = getAttendance();
    const rec = {};
    getMembers().forEach(function (m) {
      rec[m.id] = status;
    });
    att[date] = rec;
    write(K.attendance, att);
  }

  function clearRecord(date) {
    const att = getAttendance();
    delete att[date];
    write(K.attendance, att);
  }

  function listServiceDates() {
    return Object.keys(getAttendance())
      .filter(function (d) {
        return Object.keys(getAttendance()[d]).length > 0;
      })
      .sort()
      .reverse();
  }

  function statsFor(date) {
    const members = getMembers();
    const rec = getRecord(date);
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
    const s = statsFor(today);
    return {
      totalMembers: getMembers().length,
      services: listServiceDates().length,
      presentToday: s.present,
      absentToday: s.absent,
      unmarkedToday: s.unmarked,
      todayKey: today,
      todayLabel: prettyDate(today),
    };
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
  function toCSV(date) {
    const rows = [["Date", "First Name", "Last Name", "Email", "Phone", "Status"]];
    const rec = getRecord(date);
    getMembers().forEach(function (m) {
      const status = rec[m.id] || "unmarked";
      rows.push([date, m.first, m.last, m.email, m.phone, status]);
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
    key: key,
    prettyDate: prettyDate,
    esc: esc,
    getMembers: getMembers,
    getMember: getMember,
    addMember: addMember,
    deleteMember: deleteMember,
    searchMembers: searchMembers,
    getAttendance: getAttendance,
    getRecord: getRecord,
    setStatus: setStatus,
    markAll: markAll,
    clearRecord: clearRecord,
    listServiceDates: listServiceDates,
    statsFor: statsFor,
    overallStats: overallStats,
    getUser: getUser,
    login: login,
    logout: logout,
    toCSV: toCSV,
    download: download,
  };
})();
