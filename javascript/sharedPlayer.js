const SHARED_PLAYER_KEY = "harmonix_shared_player_state";

let sharedAudio = null;
let sharedBar = null;
let sharedPlayPauseBtn = null;
let sharedCloseBtn = null;

document.addEventListener("DOMContentLoaded", () => {
  initSharedPlayer();
});

function initSharedPlayer() {
  const state = readSharedPlayerState();
  if (!state?.url) return;

  renderSharedPlayer(state);
}

function renderSharedPlayer(state) {
  if (sharedBar) {
    sharedBar.remove();
  }

  sharedBar = document.createElement("div");
  sharedBar.className = "shared-player-bar";
  sharedBar.innerHTML = `
    <div class="shared-player-inner">
      <div class="shared-player-info">
        <img class="shared-player-img" src="${escapeHtmlAttr(state.img || "https://via.placeholder.com/70")}" alt="Album art" />
        <div class="shared-player-copy">
          <span class="shared-player-label">Dang phat</span>
          <h4 id="shared-player-title">${escapeHtml(state.name || "Bai hat")}</h4>
          <p id="shared-player-artist">${escapeHtml(state.artist || "Nghe si")}</p>
        </div>
      </div>
      <div class="shared-player-actions">
        <button id="sharedPlayPauseBtn" class="shared-player-btn" type="button" aria-label="Phat hoac tam dung">
          <i class="bi ${state.isPlaying ? "bi-pause-fill" : "bi-play-fill"}"></i>
        </button>
        <button id="sharedCloseBtn" class="shared-player-btn danger" type="button" aria-label="Dong player">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <audio id="sharedAudio" preload="auto"></audio>
    </div>
  `;

  document.body.appendChild(sharedBar);

  sharedAudio = document.getElementById("sharedAudio");
  sharedPlayPauseBtn = document.getElementById("sharedPlayPauseBtn");
  sharedCloseBtn = document.getElementById("sharedCloseBtn");

  sharedAudio.src = state.url;
  sharedAudio.load();

  sharedAudio.addEventListener("loadedmetadata", () => {
    const latestState = readSharedPlayerState();
    if (!latestState) return;

    if (Number.isFinite(latestState.currentTime) && latestState.currentTime > 0) {
      const maxSeekTime = Math.max((sharedAudio.duration || 0) - 0.25, 0);
      sharedAudio.currentTime = Math.min(
        latestState.currentTime,
        maxSeekTime || latestState.currentTime,
      );
    }
  });

  sharedAudio.addEventListener("play", () => {
    updateSharedPlayPause(true);
    persistSharedPlayerState(true);
  });

  sharedAudio.addEventListener("pause", () => {
    updateSharedPlayPause(false);
    persistSharedPlayerState(false);
  });

  sharedAudio.addEventListener("timeupdate", () => {
    persistSharedPlayerState(!sharedAudio.paused);
  });

  sharedPlayPauseBtn.addEventListener("click", () => {
    if (sharedAudio.paused) {
      sharedAudio.play().catch((error) => {
        console.error("Khong the tu dong phat tiep:", error);
      });
      return;
    }

    sharedAudio.pause();
  });

  sharedCloseBtn.addEventListener("click", () => {
    sharedAudio.pause();
    clearSharedPlayerState();
    sharedBar.remove();
    sharedBar = null;
  });

  window.addEventListener("pagehide", handleSharedPageHide);
  document.addEventListener("visibilitychange", handleSharedVisibilityChange);

  if (state.isPlaying) {
    sharedAudio.play().catch(() => {
      updateSharedPlayPause(false);
      persistSharedPlayerState(false);
    });
  }
}

function handleSharedPageHide() {
  persistSharedPlayerState(!!sharedAudio && !sharedAudio.paused);
}

function handleSharedVisibilityChange() {
  if (document.visibilityState === "hidden") {
    persistSharedPlayerState(!!sharedAudio && !sharedAudio.paused);
  }
}

function updateSharedPlayPause(isPlaying) {
  if (!sharedPlayPauseBtn) return;
  sharedPlayPauseBtn.innerHTML = isPlaying
    ? '<i class="bi bi-pause-fill"></i>'
    : '<i class="bi bi-play-fill"></i>';
}

function persistSharedPlayerState(forcePlaying) {
  if (!sharedAudio) return;

  const title = document.getElementById("shared-player-title")?.textContent || "";
  const artist =
    document.getElementById("shared-player-artist")?.textContent || "";
  const img =
    document.querySelector(".shared-player-img")?.getAttribute("src") || "";

  const state = {
    url: sharedAudio.currentSrc || sharedAudio.src || "",
    name: title,
    artist,
    img,
    currentTime: Number(sharedAudio.currentTime || 0),
    isPlaying:
      typeof forcePlaying === "boolean" ? forcePlaying : !sharedAudio.paused,
    updatedAt: Date.now(),
  };

  if (!state.url) return;
  localStorage.setItem(SHARED_PLAYER_KEY, JSON.stringify(state));
}

function clearSharedPlayerState() {
  localStorage.removeItem(SHARED_PLAYER_KEY);
}

function readSharedPlayerState() {
  try {
    const raw = localStorage.getItem(SHARED_PLAYER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value);
}
