let albumData = [];
let currentIndex = 0;
let slideInterval = null;
let isPlaying = false;
window.isShuffleEnabled = false;

let songLibraryCache = [];
let songLibraryPromise = null;
let currentQueue = [];
let currentQueueIndex = -1;
let currentSongMeta = null;
let dashboardSearchSelectedSong = null;
let playerAutoAdvanceLock = false;
let favoriteSongs = loadFavoriteSongs();
const CURRENT_USER_KEY = "harmonix_current_user";
const SETTINGS_KEY = "harmonix_ui_settings";
const RECENTLY_PLAYED_LIMIT = 25;
const LYRICS_SNAPSHOT_KEY = "harmonix_lyrics_snapshot";
const LYRICS_FIELD_CANDIDATES = [
  "Lyrics",
  "lyrics",
  "Lyric",
  "lyric",
  "Loi",
  "loi",
  "LoiBaiHat",
  "loiBaiHat",
  "Loi_bai_hat",
  "loi_bai_hat",
];

let audio;
let playPauseBtn;
let playPauseIcon;
let shuffleBtn;
let prevBtn;
let nextBtn;
let favoriteBtn;
let progressBar;
let volumeBar;
let volumeIcon;

document.addEventListener("DOMContentLoaded", () => {
  tidyDashboardSystemMenu();
  syncProtectedLibraryMenuState();
  initPlayerControls();
  bindDashboardSettingsSync();
  loadPage("Home.html");

  // Mobile sidebar toggle
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".sidebar-overlay");

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      overlay.classList.toggle("show");
    });
  }

  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
    });
  }
});

window.openSongDetail = function (song) {
  if (!song) return;
  localStorage.setItem("selectedSongDetail", JSON.stringify(song));
  loadPage("SongDetail.html");
};

window.openSongDetailFromQueue = function (queueName, index) {
  let song;
  if (queueName === "hot") song = window.__hotSongsQueue[index];
  if (queueName === "album") song = window.__albumSongsQueue[index];
  window.openSongDetail(song);
};

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function requireLoggedInAccess() {
  const user = getCurrentUser();
  if (user) return true;

  alert("Bạn cần đăng nhập để xem Nghe gần đây và Nhạc yêu thích.");
  window.location.href = "login.html";
  return false;
}

function syncProtectedLibraryMenuState() {
  const hasUser = Boolean(getCurrentUser());
  document.querySelectorAll("[data-requires-login='true']").forEach((item) => {
    item.classList.toggle("disabled", !hasUser);
    item.setAttribute("title", hasUser ? "" : "Đăng nhập để mở mục này");
    item.setAttribute("aria-disabled", hasUser ? "false" : "true");
  });
}

window.openLyricsPage = function () {
  document.body.classList.add("lyrics-overlay-open");
  const snapshot = persistCurrentSongMetaFromPlayer();
  if (snapshot) {
    localStorage.setItem(LYRICS_SNAPSHOT_KEY, JSON.stringify(snapshot));
  }
  loadPage("lyrics.html");
  queueLyricsInit();
};

window.closeLyricsPage = function () {
  document.body.classList.remove("lyrics-overlay-open");
  const contentArea = document.getElementById("main-content");
  if (contentArea && contentArea.classList.contains("page-lyrics")) {
    const fallbackView = contentArea.dataset.previousView || "src/Home.html";
    loadPage(fallbackView.replace("src/", ""));
  }
};

function queueLyricsInit() {
  [60, 180, 360].forEach((delay) => {
    window.setTimeout(() => {
      const contentArea = document.getElementById("main-content");
      if (
        contentArea &&
        contentArea.classList.contains("page-lyrics") &&
        typeof window.initLyricsPage === "function"
      ) {
        window.initLyricsPage();
      }
    }, delay);
  });
}

window.toggleMenu = function (menuId, element) {
  const menu = document.getElementById(menuId);
  if (!menu) return;

  // BĂ¡ÂºÂ­t/tĂ¡ÂºÂ¯t menu
  menu.classList.toggle("collapsed");

  // Xoay mĂ…Â©i tÄ‚Âªn trÄ‚Âªn tiÄ‚Âªu Ă„â€˜Ă¡Â»Â
  if (element) {
    element.classList.toggle("closed");
  }
};

function tidyDashboardSystemMenu() {
  const settingsMenu = document.getElementById("menu-caidat");
  if (!settingsMenu) return;

  const items = Array.from(settingsMenu.querySelectorAll(".menu-item"));
  const legacyItem = items.find(
    (item) =>
      !item.getAttribute("onclick") &&
      normalizeText(repairMojibake(item.textContent || "")).includes("cai dat"),
  );

  if (legacyItem) {
    legacyItem.remove();
  }
}

function initPlayerControls() {
  audio = document.getElementById("main-audio");
  playPauseBtn = document.getElementById("play-pause-btn");
  playPauseIcon = document.querySelector("#play-pause-btn i");
  shuffleBtn = document.getElementById("shuffle-btn");
  prevBtn = document.getElementById("prev-btn");
  nextBtn = document.getElementById("next-btn");
  favoriteBtn = document.getElementById("favorite-btn");
  progressBar = document.getElementById("progress-bar");
  volumeBar = document.getElementById("volume-bar");
  volumeIcon = document.getElementById("volume-icon");

  if (!audio || !playPauseBtn) return;

  applySavedVolumeToPlayer();

  audio.addEventListener("play", () => {
    persistCurrentSongMetaFromPlayer();
  });

  audio.addEventListener("loadedmetadata", () => {
    persistCurrentSongMetaFromPlayer();
  });

  playPauseBtn.onclick = () => {
    if (!audio.src || audio.src.includes("undefined")) return;

    if (audio.paused) {
      audio.play();
      updatePlayPauseIcon(true);
    } else {
      audio.pause();
      updatePlayPauseIcon(false);
    }
  };

  if (shuffleBtn) {
    shuffleBtn.onclick = () => {
      window.isShuffleEnabled = !window.isShuffleEnabled;
      shuffleBtn.classList.toggle("text-teal", window.isShuffleEnabled);
      shuffleBtn.classList.toggle("text-secondary", !window.isShuffleEnabled);
    };
  }

  if (prevBtn) {
    prevBtn.onclick = () => window.playPreviousSong();
  }

  if (nextBtn) {
    nextBtn.onclick = () => window.playNextSong();
  }

  if (favoriteBtn) {
    favoriteBtn.onclick = () => window.toggleFavoriteCurrentSong();
  }

  audio.ontimeupdate = () => {
    syncPlayerDurationUI(audio);
    maybeAdvanceSongAtExpectedEnd(audio);
  };

  audio.onloadedmetadata = () => {
    playerAutoAdvanceLock = false;
    syncPlayerDurationUI(audio);
  };

  audio.onended = () => {
    if (!playerAutoAdvanceLock) {
      playerAutoAdvanceLock = true;
      window.playNextSong();
    }
  };

  if (progressBar) {
    progressBar.oninput = () => {
      const effectiveDuration = getPreferredSongDuration(
        currentSongMeta,
        audio,
      );
      if (!effectiveDuration) return;
      audio.currentTime = (progressBar.value / 100) * effectiveDuration;
    };
  }

  if (volumeBar) {
    volumeBar.oninput = () => {
      const nextVolume = clampVolumeLevel(Number(volumeBar.value));
      applyVolumeToDashboardPlayer(nextVolume, true);

      if (!volumeIcon) return;
      volumeIcon.innerHTML =
        audio.volume > 0.05
          ? '<i class="bi bi-volume-up-fill"></i>'
          : '<i class="bi bi-volume-mute-fill"></i>';
    };
  }
}

function getStoredUiSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function clampVolumeLevel(value) {
  if (!Number.isFinite(value)) return 80;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function syncDashboardVolumeIcon(volume = audio?.volume || 0) {
  if (!volumeIcon) return;
  volumeIcon.innerHTML =
    volume > 0.05
      ? '<i class="bi bi-volume-up-fill"></i>'
      : '<i class="bi bi-volume-mute-fill"></i>';
}

function applyVolumeToDashboardPlayer(volumePercent, shouldPersist = false) {
  const nextVolume = clampVolumeLevel(volumePercent);

  if (audio) {
    audio.volume = nextVolume / 100;
  }

  if (volumeBar) {
    volumeBar.value = String(nextVolume);
  }

  syncDashboardVolumeIcon(audio?.volume ?? nextVolume / 100);

  if (!shouldPersist) return;

  const currentSettings = getStoredUiSettings();
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...currentSettings,
      volume: nextVolume,
    }),
  );
}

function applySavedVolumeToPlayer() {
  const settings = getStoredUiSettings();
  applyVolumeToDashboardPlayer(
    clampVolumeLevel(Number(settings.volume ?? 80)),
    false,
  );
}

function bindDashboardSettingsSync() {
  window.addEventListener("storage", (event) => {
    if (event.key === SETTINGS_KEY) {
      applySavedVolumeToPlayer();
    }
  });

  window.addEventListener("harmonix:volume-changed", (event) => {
    applyVolumeToDashboardPlayer(
      clampVolumeLevel(Number(event?.detail?.volume ?? 80)),
      false,
    );
  });
}

function persistCurrentSongMetaFromPlayer() {
  const playerAudio = document.querySelector("#main-audio, #audioPlayer");
  const title = document
    .querySelector("#player-title, #playerTitle")
    ?.innerText?.trim();
  const artist = document
    .querySelector("#player-artist, #playerArtist")
    ?.innerText?.trim();
  const img =
    document.querySelector("#player-img, #playerImg")?.getAttribute("src") ||
    "";
  const url = playerAudio?.currentSrc || playerAudio?.src || "";

  const hasPlayableSong =
    !!url &&
    !!title &&
    !/NVNP Music/i.test(title) &&
    !/ChĂ¡Â»Ân bÄ‚Â i hÄ‚Â¡t Ă„â€˜Ă¡Â»Æ’ phÄ‚Â¡t/i.test(artist || "");

  const queueSong =
    Array.isArray(currentQueue) && currentQueueIndex >= 0
      ? currentQueue[currentQueueIndex]
      : null;

  const fallbackSong = queueSong || currentSongMeta;

  const snapshot = hasPlayableSong
    ? getSongMetaFromSources(
        url,
        title,
        artist || "Ă„Âang cĂ¡ÂºÂ­p nhĂ¡ÂºÂ­t nghĂ¡Â»â€¡ sĂ„Â©",
        img,
        currentQueue,
        currentQueueIndex,
      )
    : fallbackSong;

  if (!snapshot) {
    return currentSongMeta;
  }

  currentSongMeta = getSongLyrics(snapshot)
    ? snapshot
    : mergeSongMeta(snapshot, fallbackSong);

  window.currentSongMeta = currentSongMeta;
  localStorage.setItem("currentSongMeta", JSON.stringify(currentSongMeta));
  localStorage.setItem(LYRICS_SNAPSHOT_KEY, JSON.stringify(currentSongMeta));
  return currentSongMeta;
}

function loadFavoriteSongs() {
  try {
    const user = getCurrentUser();
    const key = user ? `favoriteSongs_${user.id}` : "favoriteSongs";
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveFavoriteSongs() {
  const user = getCurrentUser();
  const key = user ? `favoriteSongs_${user.id}` : "favoriteSongs";
  localStorage.setItem(key, JSON.stringify(favoriteSongs));
}

function loadRecentlyPlayedSongs() {
  try {
    const user = getCurrentUser();
    const key = user ? `recentlyPlayedSongs_${user.id}` : "recentlyPlayedSongs";
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveRecentlyPlayedSongs(songs) {
  const user = getCurrentUser();
  const key = user ? `recentlyPlayedSongs_${user.id}` : "recentlyPlayedSongs";
  localStorage.setItem(key, JSON.stringify(songs));
}

function trackRecentlyPlayedSong(song) {
  if (!song || !song.Url) return;

  const recentlyPlayed = loadRecentlyPlayedSongs();
  const normalizedKey = normalizeSongKey(song);
  const nextSongs = recentlyPlayed.filter(
    (item) => normalizeSongKey(item) !== normalizedKey,
  );

  nextSongs.unshift({
    ...song,
    Url: song.Url,
    Name: song.Name,
    Artist: song.Artist,
    Img: song.Img,
    Times: song.Times || "",
    LastPlayedAt: new Date().toISOString(),
  });

  saveRecentlyPlayedSongs(nextSongs.slice(0, RECENTLY_PLAYED_LIMIT));

  const contentArea = document.getElementById("main-content");
  if (contentArea && contentArea.dataset.view === "recently-played") {
    renderRecentlyPlayedPage();
  }
}

function formatPlayedTime(value) {
  if (!value) return "VĂ¡Â»Â«a nghe xong";

  const playedDate = new Date(value);
  if (Number.isNaN(playedDate.getTime())) return "VĂ¡Â»Â«a nghe xong";

  const diffMinutes = Math.max(
    0,
    Math.round((Date.now() - playedDate.getTime()) / 60000),
  );

  if (diffMinutes < 1) return "VĂ¡Â»Â«a nghe xong";
  if (diffMinutes < 60) return `${diffMinutes} phÄ‚Âºt trĂ†Â°Ă¡Â»â€ºc`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giĂ¡Â»Â trĂ†Â°Ă¡Â»â€ºc`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} ngÄ‚Â y trĂ†Â°Ă¡Â»â€ºc`;
}

function normalizeSongKey(song) {
  if (!song) return "";

  return [
    normalizeText(repairMojibake(song.Name)),
    normalizeText(repairMojibake(song.Artist)),
    String(song.Url || "").trim(),
  ].join("__");
}

function getFavoriteSongIndex(song) {
  const key = normalizeSongKey(song);
  return favoriteSongs.findIndex((item) => normalizeSongKey(item) === key);
}

window.isSongFavorite = function (song) {
  return getFavoriteSongIndex(song) !== -1;
};

function setFavoriteButtonState(song) {
  if (!favoriteBtn) return;

  const favorite = window.isSongFavorite(song);
  favoriteBtn.classList.toggle("text-danger", favorite);
  favoriteBtn.classList.toggle("text-secondary", !favorite);
  favoriteBtn.innerHTML = favorite
    ? '<i class="bi bi-heart-fill"></i>'
    : '<i class="bi bi-heart"></i>';
  favoriteBtn.title = favorite
    ? "BĂ¡Â»Â khĂ¡Â»Âi yÄ‚Âªu thÄ‚Â­ch"
    : "ThÄ‚Âªm vÄ‚Â o yÄ‚Âªu thÄ‚Â­ch";
}

window.toggleFavoriteCurrentSong = function () {
  if (!currentSongMeta) return;

  const existingIndex = getFavoriteSongIndex(currentSongMeta);
  if (existingIndex !== -1) {
    favoriteSongs.splice(existingIndex, 1);
  } else {
    favoriteSongs.unshift({ ...currentSongMeta });
  }

  saveFavoriteSongs();
  setFavoriteButtonState(currentSongMeta);
};

function setCurrentQueue(queue, index) {
  if (!Array.isArray(queue) || queue.length === 0) {
    currentQueue = [];
    currentQueueIndex = -1;
    return;
  }

  currentQueue = queue.slice();
  currentQueueIndex = typeof index === "number" && index >= 0 ? index : 0;
}

function playSongFromQueue(index) {
  if (!currentQueue.length) return;

  const safeIndex = (index + currentQueue.length) % currentQueue.length;
  const song = currentQueue[safeIndex];
  if (!song) return;

  playThisSong(
    song.Url,
    song.Name,
    song.Artist,
    song.Img,
    currentQueue,
    safeIndex,
  );
}

window.playNextSong = function () {
  if (!currentQueue.length) return;

  if (window.isShuffleEnabled && currentQueue.length > 1) {
    let randomIndex = currentQueueIndex;
    while (randomIndex === currentQueueIndex) {
      randomIndex = Math.floor(Math.random() * currentQueue.length);
    }
    playSongFromQueue(randomIndex);
    return;
  }

  playSongFromQueue(currentQueueIndex + 1);
};

window.playPreviousSong = function () {
  if (!currentQueue.length) return;
  playSongFromQueue(currentQueueIndex - 1);
};

function updatePlayPauseIcon(playing) {
  if (!playPauseIcon) return;
  playPauseIcon.className = playing
    ? "bi bi-pause-fill fs-3 text-dark"
    : "bi bi-play-fill fs-3 text-dark";
}

function getPreferredSongDuration(song = currentSongMeta, player = audio) {
  const songDuration = parseSongTimeToSeconds(song?.Times);
  const audioDuration = Number(player?.duration);
  const hasSongDuration = Number.isFinite(songDuration) && songDuration > 0;
  const hasAudioDuration = Number.isFinite(audioDuration) && audioDuration > 0;

  if (hasSongDuration && hasAudioDuration) {
    // Avoid cutting tracks early when API duration is shorter than the real file.
    return Math.max(songDuration, audioDuration);
  }

  if (hasAudioDuration) {
    return audioDuration;
  }

  if (hasSongDuration) {
    return songDuration;
  }

  return 0;
}

function syncPlayerDurationUI(player = audio) {
  const current = document.getElementById("current-time");
  const total = document.getElementById("total-duration");
  const progress = document.getElementById("progress-bar");
  const effectiveDuration = getPreferredSongDuration(currentSongMeta, player);

  if (!player || !effectiveDuration) return;

  const clampedCurrentTime = Math.min(
    player.currentTime || 0,
    effectiveDuration,
  );

  if (progress) {
    progress.value = (clampedCurrentTime / effectiveDuration) * 100;
  }

  if (current) current.innerText = formatTime(clampedCurrentTime);
  if (total) total.innerText = formatTime(effectiveDuration);
}

function maybeAdvanceSongAtExpectedEnd(player = audio) {
  const effectiveDuration = getPreferredSongDuration(currentSongMeta, player);
  if (!player || !effectiveDuration || playerAutoAdvanceLock) return;

  if (player.currentTime >= effectiveDuration - 0.15) {
    playerAutoAdvanceLock = true;
    player.currentTime = effectiveDuration;
    syncPlayerDurationUI(player);
    window.playNextSong();
  }
}

window.playThisSong = function (
  url,
  name,
  artist,
  img,
  playlist = null,
  index = 0,
) {
  const allAudio = document.querySelectorAll("audio");
  const allTitles = document.querySelectorAll("#player-title, #playerTitle");
  const allArtists = document.querySelectorAll("#player-artist, #playerArtist");
  const allImgs = document.querySelectorAll("#player-img, #playerImg");
  const allTotalTimes = document.querySelectorAll("#total-duration");

  if (allAudio.length === 0) {
    alert("Không tìm thấy thanh player để phát nhạc!");
    return;
  }

  // DĂ¡Â»Â«ng tĂ¡ÂºÂ¥t cĂ¡ÂºÂ£ cÄ‚Â¡c trÄ‚Â¬nh phÄ‚Â¡t nhĂ¡ÂºÂ¡c hiĂ¡Â»â€¡n cÄ‚Â³ vÄ‚Â  giĂ¡ÂºÂ£i phÄ‚Â³ng bĂ¡Â»â„¢ nhĂ¡Â»â€º Ă„â€˜Ă¡Â»Æ’ trÄ‚Â¡nh phÄ‚Â¡t chĂ¡Â»â€œng chÄ‚Â©o
  allAudio.forEach((el) => {
    el.pause();
    el.src = "";
    el.removeAttribute("src");
    el.load();
  });

  allTitles.forEach((el) => {
    el.innerText = name;
  });
  allArtists.forEach((el) => {
    el.innerText = artist;
  });
  allImgs.forEach((el) => {
    el.src = img;
    el.onerror = () => {
      el.src = "https://picsum.photos/60/60";
    };
  });

  currentSongMeta = getSongMetaFromSources(
    url,
    name,
    artist,
    img,
    playlist,
    index,
  );
  if (!getSongLyrics(currentSongMeta)) {
    const playlistSong =
      Array.isArray(playlist) && typeof index === "number"
        ? playlist[index]
        : null;
    currentSongMeta = mergeSongMeta(currentSongMeta, playlistSong);
  }
  window.currentSongMeta = currentSongMeta;
  localStorage.setItem("currentSongMeta", JSON.stringify(currentSongMeta));
  localStorage.setItem(LYRICS_SNAPSHOT_KEY, JSON.stringify(currentSongMeta));
  trackRecentlyPlayedSong(currentSongMeta);
  window.dispatchEvent(
    new CustomEvent("song:changed", {
      detail: { song: currentSongMeta },
    }),
  );

  const contentArea = document.getElementById("main-content");
  if (
    contentArea &&
    contentArea.classList.contains("page-lyrics") &&
    typeof window.initLyricsPage === "function"
  ) {
    window.initLyricsPage();
  }

  if (Array.isArray(playlist) && playlist.length) {
    setCurrentQueue(playlist, index);
  } else {
    const matchedIndex = songLibraryCache.findIndex(
      (song) =>
        song.Url === url ||
        normalizeSongKey(song) === normalizeSongKey(currentSongMeta),
    );

    if (matchedIndex !== -1) {
      setCurrentQueue(songLibraryCache, matchedIndex);
    } else {
      setCurrentQueue([currentSongMeta], 0);
    }
  }

  // LuÄ‚Â´n Ă†Â°u tiÄ‚Âªn sĂ¡Â»Â­ dĂ¡Â»Â¥ng trÄ‚Â¬nh phÄ‚Â¡t chÄ‚Â­nh Ă¡Â»Å¸ thanh Ă„â€˜iĂ¡Â»Âu khiĂ¡Â»Æ’n phÄ‚Â­a dĂ†Â°Ă¡Â»â€ºi Dashboard (#main-audio)
  const playerAudio = document.getElementById("main-audio") || allAudio[0];
  playerAutoAdvanceLock = false;
  playerAudio.src = url;
  const preferredDuration = getPreferredSongDuration(
    currentSongMeta,
    playerAudio,
  );
  allTotalTimes.forEach((el) => {
    el.innerText = formatTime(preferredDuration);
  });

  playerAudio.ontimeupdate = () => {
    syncPlayerDurationUI(playerAudio);
    maybeAdvanceSongAtExpectedEnd(playerAudio);
  };

  playerAudio.onloadedmetadata = () => {
    playerAutoAdvanceLock = false;
    const effectiveDuration = getPreferredSongDuration(
      currentSongMeta,
      playerAudio,
    );
    allTotalTimes.forEach((el) => {
      el.innerText = formatTime(effectiveDuration);
    });
  };

  playerAudio.onended = () => {
    if (!playerAutoAdvanceLock) {
      playerAutoAdvanceLock = true;
      window.playNextSong();
    }
  };

  playerAudio.load();
  playerAudio
    .play()
    .then(() => {
      isPlaying = true;
      audio = playerAudio;
      updatePlayPauseIcon(true);
      setFavoriteButtonState(currentSongMeta);
    })
    .catch((error) => {
      console.error("Lỗi phát nhạc:", error);
    });
};

async function loadHotSongs() {
  const container = document.getElementById("hot-songs-list");
  if (!container) return;

  try {
    const songs = await getAllSongs();
    const hotSongs = [...songs].sort(
      (a, b) => Number(b.Likes || 0) - Number(a.Likes || 0),
    );
    window.__hotSongsQueue = hotSongs.slice(0, 10);

    container.innerHTML = window.__hotSongsQueue
      .map(
        (song, index) => `
          <div class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between px-0 py-3" 
               style="cursor:pointer" 
               onclick="playThisSong('${escapeJsString(song.Url)}', '${escapeJsString(song.Name)}', '${escapeJsString(song.Artist)}', '${escapeJsString(song.Img)}', window.__hotSongsQueue, ${index})">
            <div class="d-flex align-items-center">
              <span class="me-3 fw-bold text-danger">${String(
                index + 1,
              ).padStart(2, "0")}</span>
              <img src="${song.Img}" class="rounded me-3"
                   style="width:50px;height:50px;object-fit:cover"
                   onerror="this.src='https://picsum.photos/50/50'">
              <div>
                <p class="mb-0 fw-bold" onclick="event.stopPropagation(); window.openSongDetailFromQueue('hot', ${index})">${repairMojibake(song.Name)}</p>
                <small class="text-secondary">${repairMojibake(song.Artist)}</small>
              </div>
            </div>
            <div class="text-secondary small">${song.Times || ""}</div>
          </div>
        `,
      )
      .join("");
  } catch (error) {
    console.error("LĂ¡Â»â€”i API:", error);
  }
}

async function loadTopGenres() {
  const container = document.getElementById("top-genres-grid");
  if (!container) return;

  // Render static data first so it's not empty
  if (typeof renderStaticHotSongs === "function") {
    renderStaticHotSongs();
  }

  try {
    const songs = await getAllSongs();
    const genreMap = new Map();

    songs.forEach((song) => {
      const genreName = normalizeGenre(song.Genre);
      if (!genreMap.has(genreName)) {
        genreMap.set(genreName, {
          name: genreName,
          songCount: 0,
          likes: 0,
          mood: detectMoodByGenre(genreName),
        });
      }

      const entry = genreMap.get(genreName);
      entry.songCount += 1;
      entry.likes += Number(song.Likes || 0);
    });

    const topGenres = Array.from(genreMap.values())
      .sort((a, b) => b.songCount - a.songCount || b.likes - a.likes)
      .slice(0, 7);

    container.innerHTML = topGenres
      .map(
        (genre, index) => `
          <div class="trend-card" role="button" tabindex="0" style="cursor:pointer" onclick="openGenre('${escapeJsString(genre.name)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); openGenre('${escapeJsString(genre.name)}');}">
            <div class="trend-number">${String(index + 1).padStart(2, "0")}</div>
            <div class="trend-info">
              <h4>${genre.name}</h4>
              <p>${genre.songCount} bài hát - ${genre.likes} lượt thích</p>
            </div>
            <div class="trend-icon"><i class="bi bi-music-note-list"></i></div>
          </div>
        `,
      )
      .join("");
  } catch (error) {
    console.error("Lỗi tải thể loại hàng đầu:", error);
  }
}

window.openGenre = function (genreName) {
  localStorage.setItem("selectedGenreName", genreName);
  loadPage("TheLoai.html");
};
