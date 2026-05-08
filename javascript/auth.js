const USERS_KEY = "harmonix_registered_users";
const CURRENT_USER_KEY = "harmonix_current_user";
const LAST_REGISTERED_EMAIL_KEY = "harmonix_last_registered_email";

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.getAttribute("data-page");
  renderUserCount();

  if (page === "login") {
    initLoginPage();
  }

  if (page === "register") {
    initRegisterPage();
  }

  if (page === "users") {
    initUsersPage();
  }
});

function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const users = raw ? JSON.parse(raw) : [];
    return Array.isArray(users) ? users : [];
  } catch (error) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function setMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.classList.remove("is-error", "is-success");
  if (type) {
    element.classList.add(type);
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function renderUserCount() {
  const count = getUsers().length;
  document.querySelectorAll("#registered-count").forEach((el) => {
    el.textContent = String(count);
  });
}

function initLoginPage() {
  const form = document.getElementById("login-form");
  const message = document.getElementById("login-message");
  const emailInput = document.getElementById("login-email");

  if (emailInput) {
    const lastEmail = localStorage.getItem(LAST_REGISTERED_EMAIL_KEY);
    if (lastEmail) {
      emailInput.value = lastEmail;
      localStorage.removeItem(LAST_REGISTERED_EMAIL_KEY);
    }
  }

  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = normalizeEmail(document.getElementById("login-email")?.value);
    const password = String(document.getElementById("login-password")?.value || "");
    const users = getUsers();
    const user = users.find((item) => normalizeEmail(item.email) === email);

    if (!email || !password) {
      setMessage(message, "Hãy nhập email và mật khẩu.", "is-error");
      return;
    }

    if (!user) {
      setMessage(message, "Email chưa được đăng ký. Đang chuyển sang trang đăng ký.", "is-error");
      setTimeout(() => {
        window.location.href = "register.html";
      }, 900);
      return;
    }

    if (user.password !== password) {
      setMessage(message, "Mật khẩu không đúng.", "is-error");
      return;
    }

    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    setMessage(message, `Đăng nhập thành công với ${user.email}.`, "is-success");

    setTimeout(() => {
      window.location.href = "DashBoard.html";
    }, 700);
  });
}

function initRegisterPage() {
  const form = document.getElementById("register-form");
  const message = document.getElementById("register-message");

  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = normalizeEmail(document.getElementById("register-email")?.value);
    const password = String(document.getElementById("register-password")?.value || "");
    const users = getUsers();

    if (!email || !password) {
      setMessage(message, "Gmail và mật khẩu không được để trống.", "is-error");
      return;
    }

    if (password.length < 6) {
      setMessage(message, "Mật khẩu phải có ít nhất 6 ký tự.", "is-error");
      return;
    }

    const existed = users.some((item) => normalizeEmail(item.email) === email);
    if (existed) {
      setMessage(message, "Email này đã tồn tại. Hãy đăng nhập hoặc dùng email khác.", "is-error");
      return;
    }

    const user = {
      id: Date.now(),
      email,
      password,
      createdAt: new Date().toISOString(),
    };

    users.unshift(user);
    saveUsers(users);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    localStorage.setItem(LAST_REGISTERED_EMAIL_KEY, email);

    renderUserCount();
    setMessage(message, "Đăng ký thành công. Đang chuyển về trang đăng nhập.", "is-success");

    setTimeout(() => {
      window.location.href = "login.html";
    }, 900);
  });
}

function initUsersPage() {
  const list = document.getElementById("users-list");
  const empty = document.getElementById("users-empty");
  const clearBtn = document.getElementById("clear-users");
  const users = getUsers();

  const lastUpdated = document.getElementById("last-updated");
  if (lastUpdated) {
    const dates = users
      .map((user) => user.createdAt)
      .filter(Boolean)
      .sort()
      .reverse();

    lastUpdated.textContent = dates.length ? new Date(dates[0]).toLocaleDateString("vi-VN") : "--";
  }

  if (!list || !empty) return;

  if (!users.length) {
    empty.style.display = "block";
    list.innerHTML = "";
  } else {
    empty.style.display = "none";
    list.innerHTML = users
      .map(
        (user, index) => `
          <article class="user-card">
            <h3>${escapeHtml(user.email)}</h3>
            <p>Tài khoản đăng ký bằng Gmail</p>
            <div class="meta">
              <span>#${index + 1}</span>
              <span>${formatDate(user.createdAt)}</span>
            </div>
          </article>
        `,
      )
      .join("");
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      localStorage.removeItem(USERS_KEY);
      localStorage.removeItem(CURRENT_USER_KEY);
      renderUserCount();
      initUsersPage();
    });
  }
}

function formatDate(value) {
  if (!value) return "--";

  try {
    return new Date(value).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return "--";
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
