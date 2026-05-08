const CURRENT_USER_KEY = "harmonix_current_user";
const USERS_KEY = "harmonix_registered_users";

document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  const allUsers = getUsers();

  fillCounts(allUsers);

  if (!user) {
    renderGuestState();
    return;
  }

  renderProfile(user, allUsers);
});

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const users = raw ? JSON.parse(raw) : [];
    return Array.isArray(users) ? users : [];
  } catch (error) {
    return [];
  }
}

function fillCounts(users) {
  const count = users.length;
  const savedSongsCount = safeJsonLength(localStorage.getItem("favoriteSongs"));

  const totalUsers = document.getElementById("total-users-count");
  const savedSongs = document.getElementById("saved-songs-count");

  if (totalUsers) totalUsers.textContent = String(count);
  if (savedSongs) savedSongs.textContent = String(savedSongsCount);
}

function renderProfile(user, users) {
  const displayName = getDisplayName(user);

  setText("profile-name", displayName);
  setText("profile-email", user.email || "email@example.com");
  setText("detail-name", displayName);
  setText("detail-email", user.email || "-");
  setText("detail-id", user.id ? `#${user.id}` : "-");
  setText("detail-createdAt", formatDateTime(user.createdAt));
  setText("profile-status", "Dang hoat dong");
  setText("activity-text", `Tai khoan duoc dang nhap tu ${users.length} nguoi dung da luu trong he thong.`);

  const avatar = document.getElementById("profile-avatar");
  if (avatar) {
    avatar.textContent = getInitials(displayName || user.email || "U");
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem(CURRENT_USER_KEY);
      window.location.href = "login.html";
    });
  }

  const copyBtn = document.getElementById("copy-email");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const email = String(user.email || "");
      try {
        await navigator.clipboard.writeText(email);
        copyBtn.innerHTML = '<i class="bi bi-check2"></i>';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="bi bi-copy"></i>';
        }, 1200);
      } catch (error) {
        console.error("Khong the copy email:", error);
      }
    });
  }
}

function renderGuestState() {
  setText("profile-name", "Ban chua dang nhap");
  setText("profile-email", "Hay dang nhap de xem ho so.");
  setText("detail-name", "-");
  setText("detail-email", "-");
  setText("detail-id", "-");
  setText("detail-createdAt", "-");
  setText("profile-status", "Chua xac thuc");
  setText("activity-text", "Dang nhap de xem thong tin ho so va trang thai tai khoan.");

  const avatar = document.getElementById("profile-avatar");
  if (avatar) avatar.textContent = "?";

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.textContent = "Ve dang nhap";
    logoutBtn.addEventListener("click", () => {
      window.location.href = "login.html";
    });
  }

  const copyBtn = document.getElementById("copy-email");
  if (copyBtn) {
    copyBtn.disabled = true;
    copyBtn.style.opacity = "0.5";
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getDisplayName(user) {
  const explicitName = String(user?.name || "").trim();
  if (explicitName) return explicitName;

  const email = String(user?.email || "").trim();
  if (!email) return "Nguoi dung";

  return email.split("@")[0];
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return "-";
  }
}

function getInitials(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function safeJsonLength(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch (error) {
    return 0;
  }
}
