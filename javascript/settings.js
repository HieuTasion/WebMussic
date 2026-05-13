const CURRENT_USER_KEY = "harmonix_current_user";
const SETTINGS_KEY = "harmonix_ui_settings";

document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  const settings = getStoredSettings();

  hydrateUser(user, settings);
  bindSettingsForm(user, settings);
  applySettingsState(settings);
});

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function getStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch (error) {
    return {};
  }
}

function hydrateUser(user, settings) {
  const email = user?.email || "Chưa đăng nhập";
  const displayName = settings.displayName || user?.name || getNameFromEmail(email);

  setValue(
    "settings-display-name",
    displayName === "Chưa đăng nhập" ? "" : displayName,
  );
  setValue("settings-email", user?.email || "");
  setChecked("settings-neon", settings.neon !== false);
  setChecked("settings-compact", settings.compact === true);
  setValue("settings-volume", String(settings.volume ?? 80));
  setChecked("settings-auto-lyrics", settings.autoLyrics === true);
  setChecked("settings-notify", settings.notify !== false);
  setChecked("settings-remember-view", settings.rememberView !== false);

  const summary = user
    ? `Tài khoản hiện tại: ${email}`
    : "Chưa đăng nhập, đang dùng bộ cài đặt mặc định trên trình duyệt này.";

  setText("settings-user-email", summary);
  updateVolumeLabel(Number(settings.volume ?? 80));
}

function bindSettingsForm(user, settings) {
  const volumeInput = document.getElementById("settings-volume");
  if (volumeInput) {
    volumeInput.addEventListener("input", () => {
      updateVolumeLabel(Number(volumeInput.value));
    });
  }

  const compactInput = document.getElementById("settings-compact");
  const neonInput = document.getElementById("settings-neon");

  if (compactInput) {
    compactInput.addEventListener("change", () => {
      document.body.classList.toggle("compact-mode", compactInput.checked);
    });
  }

  if (neonInput) {
    neonInput.addEventListener("change", () => {
      document.body.classList.toggle("neon-off", !neonInput.checked);
    });
  }

  const saveButton = document.getElementById("settings-save");
  if (!saveButton) return;

  saveButton.addEventListener("click", () => {
    const nextSettings = {
      ...settings,
      displayName: getValue("settings-display-name").trim(),
      neon: isChecked("settings-neon"),
      compact: isChecked("settings-compact"),
      volume: clampVolume(Number(getValue("settings-volume"))),
      autoLyrics: isChecked("settings-auto-lyrics"),
      notify: isChecked("settings-notify"),
      rememberView: isChecked("settings-remember-view"),
    };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));

    if (user) {
      const updatedUser = { ...user };
      if (nextSettings.displayName) {
        updatedUser.name = nextSettings.displayName;
      }
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
    }

    applySettingsState(nextSettings);
    setText(
      "settings-user-email",
      user ? `Tài khoản hiện tại: ${user.email}` : "Đã lưu bộ cài đặt local.",
    );

    const feedback = document.getElementById("settings-feedback");
    if (feedback) {
      feedback.textContent = "Đã lưu cài đặt thành công.";
      feedback.classList.add("is-success");
    }
  });
}

function applySettingsState(settings) {
  document.body.classList.toggle("compact-mode", settings.compact === true);
  document.body.classList.toggle("neon-off", settings.neon === false);
  updateVolumeLabel(Number(settings.volume ?? 80));
}

function updateVolumeLabel(value) {
  setText("settings-volume-label", `${clampVolume(value)}%`);
}

function clampVolume(value) {
  if (!Number.isFinite(value)) return 80;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function getNameFromEmail(email) {
  const value = String(email || "").trim();
  if (!value || value === "Chưa đăng nhập") return "Chưa đăng nhập";
  return value.split("@")[0];
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || "") : "";
}

function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(value);
}

function isChecked(id) {
  const el = document.getElementById(id);
  return Boolean(el?.checked);
}
