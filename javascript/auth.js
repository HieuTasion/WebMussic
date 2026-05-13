const API_USERS_URL = "https://68ef6d3fb06cc802829d58ca.mockapi.io/User";
const CURRENT_USER_KEY = "harmonix_current_user";
const LAST_REGISTERED_IDENTIFIER_KEY = "harmonix_last_registered_identifier";

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.getAttribute("data-page");
  await renderUserCount();

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

function setMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.classList.remove("is-error", "is-success");
  if (type) {
    element.classList.add(type);
  }
}

function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function getUserKeys(user) {
  const keys = [];
  const name = normalizeIdentifier(user?.name);
  const email = normalizeIdentifier(user?.email);

  if (name) keys.push(name);
  if (email) keys.push(email);

  return keys;
}

function buildUserPayload(identifier, password) {
  const raw = String(identifier || "").trim();

  return {
    name: looksLikeEmail(raw) ? "" : raw,
    email: looksLikeEmail(raw) ? normalizeIdentifier(raw) : "",
    password,
    createdAt: new Date().toISOString(),
  };
}

function getUserDisplayLabel(user) {
  return user?.name || user?.email || "tài khoản của bạn";
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

async function fetchUsers() {
  const response = await fetch(API_USERS_URL);
  if (!response.ok) {
    throw new Error("Không thể tải danh sách tài khoản.");
  }

  const users = await response.json();
  return Array.isArray(users) ? users : [];
}

async function findUserByIdentifier(identifier) {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const users = await fetchUsers();

  return (
    users.find((item) => getUserKeys(item).includes(normalizedIdentifier)) ||
    null
  );
}

async function createUser(user) {
  const response = await fetch(API_USERS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(user),
  });

  if (!response.ok) {
    throw new Error("Không thể tạo tài khoản mới.");
  }

  return response.json();
}

async function deleteUserById(id) {
  const response = await fetch(`${API_USERS_URL}/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Không thể xóa tài khoản.");
  }

  return response.json();
}

async function renderUserCount() {
  try {
    const users = await fetchUsers();
    document.querySelectorAll("#registered-count").forEach((el) => {
      el.textContent = String(users.length);
    });
  } catch (error) {
    document.querySelectorAll("#registered-count").forEach((el) => {
      el.textContent = "--";
    });
  }
}

function initLoginPage() {
  const form = document.getElementById("login-form");
  const message = document.getElementById("login-message");
  const identifierInput = document.getElementById("login-email");

  if (identifierInput) {
    const lastIdentifier = localStorage.getItem(LAST_REGISTERED_IDENTIFIER_KEY);
    if (lastIdentifier) {
      identifierInput.value = lastIdentifier;
      localStorage.removeItem(LAST_REGISTERED_IDENTIFIER_KEY);
    }
  }

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const identifier = String(
      document.getElementById("login-email")?.value || "",
    ).trim();
    const password = String(
      document.getElementById("login-password")?.value || "",
    );

    if (!identifier || !password) {
      setMessage(message, "Hãy nhập tên hoặc email và mật khẩu.", "is-error");
      return;
    }

    try {
      const user = await findUserByIdentifier(identifier);

      if (!user) {
        setMessage(
          message,
          "Tên hoặc email chưa được đăng ký. Đang chuyển sang trang đăng ký.",
          "is-error",
        );
        setTimeout(() => {
          window.location.href = "register.html";
        }, 900);
        return;
      }

      if (String(user.password || "") !== password) {
        setMessage(message, "Mật khẩu không đúng.", "is-error");
        return;
      }

      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      setMessage(
        message,
        `Đăng nhập thành công với ${getUserDisplayLabel(user)}.`,
        "is-success",
      );

      setTimeout(() => {
        window.location.href = "DashBoard.html";
      }, 700);
    } catch (error) {
      setMessage(
        message,
        error.message || "Không thể đăng nhập lúc này.",
        "is-error",
      );
    }
  });
}

function initRegisterPage() {
  const form = document.getElementById("register-form");
  const message = document.getElementById("register-message");

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const identifier = String(
      document.getElementById("register-email")?.value || "",
    ).trim();
    const password = String(
      document.getElementById("register-password")?.value || "",
    );

    if (!identifier || !password) {
      setMessage(
        message,
        "Tên hoặc email và mật khẩu không được để trống.",
        "is-error",
      );
      return;
    }

    if (password.length < 6) {
      setMessage(message, "Mật khẩu phải có ít nhất 6 ký tự.", "is-error");
      return;
    }

    try {
      const existedUser = await findUserByIdentifier(identifier);
      if (existedUser) {
        setMessage(
          message,
          "Tên hoặc email này đã tồn tại. Hãy đăng nhập hoặc dùng thông tin khác.",
          "is-error",
        );
        return;
      }

      const createdUser = await createUser(buildUserPayload(identifier, password));

      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(createdUser));
      localStorage.setItem(LAST_REGISTERED_IDENTIFIER_KEY, identifier);

      await renderUserCount();
      setMessage(
        message,
        "Đăng ký thành công. Đang chuyển về trang đăng nhập.",
        "is-success",
      );

      setTimeout(() => {
        window.location.href = "login.html";
      }, 900);
    } catch (error) {
      setMessage(
        message,
        error.message || "Không thể tạo tài khoản lúc này.",
        "is-error",
      );
    }
  });
}

async function initUsersPage() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  const list = document.getElementById("users-list");
  const empty = document.getElementById("users-empty");
  const lastUpdated = document.getElementById("last-updated");
  const actionBtn = document.getElementById("clear-users");

  if (actionBtn) {
    actionBtn.textContent = "Tải lại";
    actionBtn.onclick = () => {
      window.location.reload();
    };
  }

  try {
    const users = await fetchUsers();

    if (lastUpdated) {
      const dates = users
        .map((user) => user.createdAt)
        .filter(Boolean)
        .sort()
        .reverse();

      lastUpdated.textContent = dates.length
        ? formatDate(dates[0], true)
        : "--";
    }

    if (!list || !empty) return;

    if (!users.length) {
      empty.style.display = "block";
      list.innerHTML = "";
      return;
    }

    empty.style.display = "none";
    list.innerHTML = users
      .map(
        (user, index) => `
          <article class="user-card">
            <h3>${escapeHtml(user.name || user.email || "Người dùng")}</h3>
            <p>${escapeHtml(user.email || "Không có email")}</p>
            <div class="meta">
              <span>#${index + 1}</span>
              <span>${formatDate(user.createdAt, false)}</span>
            </div>
            <button
              class="user-delete-btn"
              type="button"
              data-user-id="${escapeHtml(String(user.id || ""))}"
              data-user-label="${escapeHtml(user.name || user.email || "tài khoản này")}"
            >
              Xóa tài khoản
            </button>
          </article>
        `,
      )
      .join("");

    list.querySelectorAll(".user-delete-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const userId = button.getAttribute("data-user-id");
        const userLabel =
          button.getAttribute("data-user-label") || "tài khoản này";

        if (!userId) return;
        if (!window.confirm(`Xóa ${userLabel}?`)) return;

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Đang xóa...";

        try {
          await deleteUserById(userId);
          await renderUserCount();
          await initUsersPage();
        } catch (error) {
          alert(error.message || "Không thể xóa tài khoản.");
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    });
  } catch (error) {
    if (empty) {
      empty.style.display = "block";
      empty.textContent = error.message || "Không thể tải danh sách đăng ký.";
    }
    if (list) {
      list.innerHTML = "";
    }
  }
}

function formatDate(value, dateOnly = false) {
  if (!value) return "--";

  try {
    return new Date(value).toLocaleString(
      "vi-VN",
      dateOnly
        ? {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }
        : {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          },
    );
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
