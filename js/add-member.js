/* Add member — validates, saves, shows a live photo preview */
(function () {
  const S = window.ChurchStore;
  const form = document.getElementById("member-form");
  if (!form) return;

  const err = document.getElementById("member-err");
  const photoInput = document.getElementById("photo");
  const preview = document.getElementById("photo-preview");
  let photoData = "";

  const MAX_PHOTO = 2 * 1024 * 1024; // 2 MB

  function showErr(msg) {
    err.textContent = msg || "";
  }

  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function initialsFrom(first, last) {
    return ((first || "").charAt(0) + (last || "").charAt(0)).toUpperCase() || "+";
  }

  // Live initials preview as the names are typed
  function updatePreview() {
    if (photoData) return;
    preview.textContent = initialsFrom(form.first.value.trim(), form.last.value.trim()) || "+";
  }

  form.first.addEventListener("input", updatePreview);
  form.last.addEventListener("input", updatePreview);

  photoInput.addEventListener("change", function () {
    const file = photoInput.files && photoInput.files[0];
    if (!file) {
      photoData = "";
      updatePreview();
      return;
    }

    if (!file.type.startsWith("image/")) {
      showErr("Please choose an image file.");
      photoInput.value = "";
      return;
    }

    if (file.size > MAX_PHOTO) {
      showErr("Photo must be smaller than 2 MB.");
      photoInput.value = "";
      return;
    }

    showErr("");
    const reader = new FileReader();
    reader.onload = function (ev) {
      photoData = ev.target.result;
      preview.innerHTML = '<img class="avatar" src="' + photoData + '" alt="">';
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const first = form.first.value.trim();
    const last = form.last.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();

    if (!first) return showErr("First name is required.");
    if (!last) return showErr("Last name is required.");
    if (email && !isEmail(email)) return showErr("That email address doesn't look right.");

    const dupe = S.getMembers().some(function (m) {
      return email && (m.email || "").toLowerCase() === email.toLowerCase();
    });
    if (dupe) return showErr("A member with that email is already registered.");

    showErr("");

    S.addMember({
      first: first,
      last: last,
      email: email,
      phone: phone,
      photo: photoData,
    });

    window.location.href = "../pages/members.html?added=" + encodeURIComponent(first + " " + last);
  });

  updatePreview();
})();
