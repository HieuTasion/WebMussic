let albumData = [];
let currentIndex = 0;
let slideInterval = null;
let isPlaying = false;
let isShuffleEnabled = false;

let songLibraryCache = [];
let songLibraryPromise = null;
let currentQueue = [];
let currentQueueIndex = -1;
let currentSongMeta = null;
let favoriteSongs = loadFavoriteSongs();
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
  initPlayerControls();
  loadPage("Home.html");
});

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
    const fallbackView = contentArea.dataset.previousView || "Home.html";
    loadPage(fallbackView);
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

  // Bật/tắt menu
  menu.classList.toggle("collapsed");

  // Xoay mũi tên trên tiêu đề
  if (element) {
    element.classList.toggle("closed");
  }
};

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
      isShuffleEnabled = !isShuffleEnabled;
      shuffleBtn.classList.toggle("text-teal", isShuffleEnabled);
      shuffleBtn.classList.toggle("text-secondary", !isShuffleEnabled);
    };
  }

  if (prevBtn) {
    prevBtn.onclick = () => playPreviousSong();
  }

  if (nextBtn) {
    nextBtn.onclick = () => playNextSong();
  }

  if (favoriteBtn) {
    favoriteBtn.onclick = () => toggleFavoriteCurrentSong();
  }

  audio.ontimeupdate = () => {
    const current = document.getElementById("current-time");
    const total = document.getElementById("total-duration");
    const progress = document.getElementById("progress-bar");

    if (!audio.duration) return;

    if (progress) {
      progress.value = (audio.currentTime / audio.duration) * 100;
    }

    if (current) current.innerText = formatTime(audio.currentTime);
    if (total) total.innerText = formatTime(audio.duration);
  };

  audio.onloadedmetadata = () => {
    const total = document.getElementById("total-duration");
    if (total) total.innerText = formatTime(audio.duration);
  };

  audio.onended = () => {
    playNextSong();
  };

  if (progressBar) {
    progressBar.oninput = () => {
      if (!audio.duration) return;
      audio.currentTime = (progressBar.value / 100) * audio.duration;
    };
  }

  if (volumeBar) {
    volumeBar.oninput = () => {
      audio.volume = volumeBar.value / 100;

      if (!volumeIcon) return;
      volumeIcon.innerHTML =
        audio.volume > 0.05
          ? '<i class="bi bi-volume-up-fill"></i>'
          : '<i class="bi bi-volume-mute-fill"></i>';
    };
  }
}

function persistCurrentSongMetaFromPlayer() {
  const playerAudio = document.getElementById("main-audio");
  const title = document.getElementById("player-title")?.innerText?.trim();
  const artist = document.getElementById("player-artist")?.innerText?.trim();
  const img = document.getElementById("player-img")?.getAttribute("src") || "";
  const url = playerAudio?.currentSrc || playerAudio?.src || "";

  const hasPlayableSong =
    !!url &&
    !!title &&
    !/NVNP Music/i.test(title) &&
    !/Chon bai hat de phat/i.test(artist || "");

  const queueSong =
    Array.isArray(currentQueue) && currentQueueIndex >= 0
      ? currentQueue[currentQueueIndex]
      : null;

  const fallbackSong = queueSong || currentSongMeta;

  const snapshot = hasPlayableSong
    ? getSongMetaFromSources(
        url,
        title,
        artist || "Dang cap nhat nghe si",
        img,
        currentQueue,
        currentQueueIndex,
      )
    : fallbackSong;

  if (!snapshot) {
    return currentSongMeta;
  }

  currentSongMeta = getSongLyrics(snapshot) ? snapshot : mergeSongMeta(snapshot, fallbackSong);

  window.currentSongMeta = currentSongMeta;
  localStorage.setItem("currentSongMeta", JSON.stringify(currentSongMeta));
  localStorage.setItem(LYRICS_SNAPSHOT_KEY, JSON.stringify(currentSongMeta));
  return currentSongMeta;
}

function loadFavoriteSongs() {
  try {
    const raw = localStorage.getItem("favoriteSongs");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveFavoriteSongs() {
  localStorage.setItem("favoriteSongs", JSON.stringify(favoriteSongs));
}

function loadRecentlyPlayedSongs() {
  try {
    const raw = localStorage.getItem("recentlyPlayedSongs");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveRecentlyPlayedSongs(songs) {
  localStorage.setItem("recentlyPlayedSongs", JSON.stringify(songs));
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
  if (!value) return "Vua nghe xong";

  const playedDate = new Date(value);
  if (Number.isNaN(playedDate.getTime())) return "Vua nghe xong";

  const diffMinutes = Math.max(
    0,
    Math.round((Date.now() - playedDate.getTime()) / 60000),
  );

  if (diffMinutes < 1) return "Vua nghe xong";
  if (diffMinutes < 60) return `${diffMinutes} phut truoc`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} gio truoc`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} ngay truoc`;
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

function isSongFavorite(song) {
  return getFavoriteSongIndex(song) !== -1;
}

function setFavoriteButtonState(song) {
  if (!favoriteBtn) return;

  const favorite = isSongFavorite(song);
  favoriteBtn.classList.toggle("text-danger", favorite);
  favoriteBtn.classList.toggle("text-secondary", !favorite);
  favoriteBtn.innerHTML = favorite
    ? '<i class="bi bi-heart-fill"></i>'
    : '<i class="bi bi-heart"></i>';
  favoriteBtn.title = favorite ? "Bo khoi yeu thich" : "Them vao yeu thich";
}

function toggleFavoriteCurrentSong() {
  if (!currentSongMeta) return;

  const existingIndex = getFavoriteSongIndex(currentSongMeta);
  if (existingIndex !== -1) {
    favoriteSongs.splice(existingIndex, 1);
  } else {
    favoriteSongs.unshift({ ...currentSongMeta });
  }

  saveFavoriteSongs();
  setFavoriteButtonState(currentSongMeta);
}

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

function playNextSong() {
  if (!currentQueue.length) return;

  if (isShuffleEnabled && currentQueue.length > 1) {
    let randomIndex = currentQueueIndex;
    while (randomIndex === currentQueueIndex) {
      randomIndex = Math.floor(Math.random() * currentQueue.length);
    }
    playSongFromQueue(randomIndex);
    return;
  }

  playSongFromQueue(currentQueueIndex + 1);
}

function playPreviousSong() {
  if (!currentQueue.length) return;
  playSongFromQueue(currentQueueIndex - 1);
}

async function getAllSongs() {
  if (songLibraryCache.length) return songLibraryCache;
  if (songLibraryPromise) return songLibraryPromise;

  songLibraryPromise = fetch(
    "https://68ef6d3fb06cc802829d58ca.mockapi.io/songs",
  )
    .then((res) => res.json())
    .then((songs) => {
      songLibraryCache = Array.isArray(songs) ? songs : [];
      return songLibraryCache;
    })
    .catch((error) => {
      console.error("Loi tai danh sach nhac:", error);
      return [];
    })
    .finally(() => {
      songLibraryPromise = null;
    });

  return songLibraryPromise;
}

function updatePlayPauseIcon(playing) {
  if (!playPauseIcon) return;
  playPauseIcon.className = playing
    ? "bi bi-pause-fill fs-3 text-dark"
    : "bi bi-play-fill fs-3 text-dark";
}

function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00";

  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, "0")}:${sec
    .toString()
    .padStart(2, "0")}`;
}

function repairMojibake(value) {
  const input = String(value || "");
  if (!input) return "";

  const looksBroken = /[ĂƒĂ†Ă„Ă…Ă¡ÂºĂ¡Â»]/.test(input);
  if (!looksBroken || typeof TextDecoder === "undefined") {
    return input;
  }

  try {
    const bytes = Uint8Array.from(
      Array.from(input).map((char) => char.charCodeAt(0)),
    );
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch (error) {
    return input;
  }
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ä‘/g, "d")
    .replace(/Ä/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeJsString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function normalizeGenre(raw) {
  if (!raw) return "Khac";

  const name = String(raw).trim().toLowerCase();
  if (name.includes("hip")) return "Hip Hop";
  if (name.includes("v-pop") || name.includes("vpop") || name.includes("v pop"))
    return "V-Pop";
  if (name.includes("pop")) return "Pop";
  if (name.includes("rock")) return "Rock";
  if (name.includes("edm") || name.includes("dance")) return "EDM";
  if (name.includes("lofi")) return "Lofi";
  if (name.includes("jazz")) return "Jazz";
  if (name.includes("ballad")) return "Ballad";

  return String(raw).trim();
}

function getSongLyrics(song) {
  if (!song || typeof song !== "object") return "";

  for (const field of LYRICS_FIELD_CANDIDATES) {
    const value = song[field];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  const dynamicField = Object.keys(song).find((key) => /lyric|loi/i.test(key));
  if (dynamicField && typeof song[dynamicField] === "string") {
    return song[dynamicField];
  }

  return "";
}

function getSongMetaFromSources(url, name, artist, img, playlist = null, index = 0) {
  const playlistSong =
    Array.isArray(playlist) && typeof index === "number" ? playlist[index] : null;

  const baseSong =
    playlistSong && typeof playlistSong === "object"
      ? {
          ...playlistSong,
          Url: playlistSong.Url || url,
          Name: playlistSong.Name || name,
          Artist: playlistSong.Artist || artist,
          Img: playlistSong.Img || img,
        }
      : { Url: url, Name: name, Artist: artist, Img: img };

  const matchedSong = songLibraryCache.find(
    (song) =>
      song.Url === url ||
      (normalizeText(song.Name) === normalizeText(name) &&
        normalizeText(song.Artist) === normalizeText(artist)),
  );

  if (matchedSong) {
    return mergeSongMeta(matchedSong, baseSong);
  }

  return baseSong;
}

function mergeSongMeta(primarySong, secondarySong) {
  const merged = {
    ...(secondarySong || {}),
    ...(primarySong || {}),
  };

  const primaryLyrics = getSongLyrics(primarySong);
  const secondaryLyrics = getSongLyrics(secondarySong);
  const resolvedLyrics = primaryLyrics || secondaryLyrics;

  if (resolvedLyrics) {
    merged.Lyrics = resolvedLyrics;
  }

  return merged;
}

function getLyricsPreview(song, maxLength = 90) {
  const lyrics = getSongLyrics(song).replace(/\s+/g, " ").trim();
  if (!lyrics) return "Chua co lyric";
  if (lyrics.length <= maxLength) return lyrics;
  return `${lyrics.slice(0, maxLength).trimEnd()}...`;
}

function detectMoodByGenre(name) {
  const normalized = String(name || "").toLowerCase();
  if (normalized.includes("pop")) return "vui-tuoi";
  if (
    normalized.includes("rock") ||
    normalized.includes("rap") ||
    normalized.includes("hip hop")
  ) {
    return "manh-me";
  }
  if (
    normalized.includes("ballad") ||
    normalized.includes("jazz") ||
    normalized.includes("lofi")
  ) {
    return "sau-lang";
  }
  if (normalized.includes("edm") || normalized.includes("dance")) {
    return "nang-luong";
  }
  return "nang-luong";
}

function getSongsByAlbum(album, allSongs) {
  if (!album || !Array.isArray(allSongs)) return [];

  const albumArtist = normalizeText(repairMojibake(album.artist));
  const songsByKey = new Map();

  allSongs.forEach((song) => {
    const artistKey = normalizeText(repairMojibake(song.Artist));
    const nameKey = normalizeText(repairMojibake(song.Name));
    const songKey = `${artistKey}__${nameKey}`;

    if (!songsByKey.has(songKey)) {
      songsByKey.set(songKey, song);
    }
  });

  return (album.songs || [])
    .map((songName) => {
      const nameKey = normalizeText(repairMojibake(songName));
      const exactKey = `${albumArtist}__${nameKey}`;

      if (songsByKey.has(exactKey)) {
        return songsByKey.get(exactKey);
      }

      return allSongs.find(
        (song) => normalizeText(repairMojibake(song.Name)) === nameKey,
      );
    })
    .filter(Boolean);
}

window.playThisSong = function (
  url,
  name,
  artist,
  img,
  playlist = null,
  index = 0,
) {
  const allAudio = document.querySelectorAll("#main-audio");
  const allTitles = document.querySelectorAll("#player-title");
  const allArtists = document.querySelectorAll("#player-artist");
  const allImgs = document.querySelectorAll("#player-img");
  const allTotalTimes = document.querySelectorAll("#total-duration");

  if (allAudio.length === 0) {
    alert("Khong tim thay thanh player de phat nhac!");
    return;
  }

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

  currentSongMeta = getSongMetaFromSources(url, name, artist, img, playlist, index);
  if (!getSongLyrics(currentSongMeta)) {
    const playlistSong =
      Array.isArray(playlist) && typeof index === "number" ? playlist[index] : null;
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
        song.Url === url || normalizeSongKey(song) === normalizeSongKey(currentSongMeta),
    );

    if (matchedIndex !== -1) {
      setCurrentQueue(songLibraryCache, matchedIndex);
    } else {
      setCurrentQueue([currentSongMeta], 0);
    }
  }

  const playerAudio = allAudio[0];
  playerAudio.src = url;

  playerAudio.ontimeupdate = () => {
    const currentTxt = document.getElementById("current-time");
    const progBar = document.getElementById("progress-bar");

    if (!playerAudio.duration) return;

    if (currentTxt) {
      currentTxt.innerText = formatTime(playerAudio.currentTime);
    }
    if (progBar) {
      progBar.value = (playerAudio.currentTime / playerAudio.duration) * 100;
    }
  };

  playerAudio.onloadedmetadata = () => {
    allTotalTimes.forEach((el) => {
      el.innerText = formatTime(playerAudio.duration);
    });
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
      console.error("Loi phat nhac:", error);
    });
};

async function loadHotSongs() {
  const container = document.getElementById("hot-songs-list");
  if (!container) return;

  try {
    const songs = await getAllSongs();
    const hotSongs = [...songs].sort((a, b) => Number(b.Likes || 0) - Number(a.Likes || 0));
    window.__hotSongsQueue = hotSongs;

    container.innerHTML = hotSongs
      .map(
        (song, index) => `
          <div class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between px-0 py-3"
               style="cursor:pointer"
               onclick="playThisSong('${escapeJsString(song.Url)}', '${escapeJsString(song.Name)}', '${escapeJsString(song.Artist)}', '${escapeJsString(song.Img)}', window.__hotSongsQueue, ${index})">
            <div class="d-flex align-items-center">
              <span class="me-3 fw-bold ${index < 3 ? "text-teal" : "text-secondary"}">${String(
                index + 1,
              ).padStart(2, "0")}</span>
              <img src="${song.Img}" class="rounded me-3"
                   style="width:50px;height:50px;object-fit:cover"
                   onerror="this.src='https://picsum.photos/50/50'">
              <div>
                <p class="mb-0 fw-bold">${song.Name}</p>
                <small class="text-secondary">${song.Artist}</small>
              </div>
            </div>
            <div class="text-secondary small">${song.Times || ""}</div>
          </div>
        `,
      )
      .join("");
  } catch (error) {
    console.error("Loi API:", error);
  }
}

async function loadTopGenres() {
  const container = document.getElementById("top-genres-grid");
  if (!container) return;

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
      .slice(0, 6);

    container.innerHTML = topGenres
      .map(
        (genre, index) => `
          <div class="trend-card" role="button" tabindex="0" style="cursor:pointer" onclick="openGenre('${escapeJsString(genre.name)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); openGenre('${escapeJsString(genre.name)}');}">
            <div class="trend-number">${String(index + 1).padStart(2, "0")}</div>
            <div class="trend-info">
              <h4>${genre.name}</h4>
              <p>${genre.songCount} bai hat - ${genre.likes} luot thich</p>
            </div>
            <div class="trend-icon"><i class="bi bi-music-note-list"></i></div>
          </div>
        `,
      )
      .join("");
  } catch (error) {
    console.error("Loi load top genres:", error);
  }
}

window.openGenre = function (genreName) {
  localStorage.setItem("selectedGenreName", genreName);
  loadPage("TheLoai.html");
};

function clearInjectedPageStyles() {
  document
    .querySelectorAll("[data-page-inline-style='true']")
    .forEach((node) => node.remove());
}

function applyPageStyles(doc) {
  clearInjectedPageStyles();

  doc.querySelectorAll("style").forEach((styleNode) => {
    const clonedStyle = document.createElement("style");
    clonedStyle.setAttribute("data-page-inline-style", "true");
    clonedStyle.textContent = styleNode.textContent;
    document.head.appendChild(clonedStyle);
  });
}

function renderFavoritesPage() {
  const contentArea = document.getElementById("main-content");
  if (!contentArea) return;

  contentArea.dataset.view = "favorites";
  contentArea.classList.remove("page-genre", "page-player");
  contentArea.classList.add("page-home");

  const favorites = loadFavoriteSongs();
  window.__favoriteSongsQueue = favorites;

  contentArea.innerHTML = `
    <div class="container-fluid py-4 px-4">
      <div class="hero-section mb-5 shadow-lg">
        <div class="row align-items-center">
          <div class="col-lg-8">
            <span class="badge bg-teal mb-3 text-dark">THU VIEN RIENG</span>
            <h1 class="display-5 fw-bold mb-2 text-white">Nhac yeu thich</h1>
            <p class="lead mb-0 text-secondary">Tat ca bai hat ban da bam tim se nam o day.</p>
          </div>
          <div class="col-lg-4 text-lg-end mt-4 mt-lg-0">
            <div class="text-white fs-1 fw-bold">${favorites.length}</div>
            <div class="text-secondary">Bai hat da luu</div>
          </div>
        </div>
      </div>
      <div class="list-group list-group-flush bg-transparent">
        ${
          favorites.length
            ? favorites
                .map(
                  (song, index) => `
                    <div class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between px-0 py-3" style="cursor:pointer" onclick="playThisSong('${escapeJsString(song.Url)}', '${escapeJsString(song.Name)}', '${escapeJsString(song.Artist)}', '${escapeJsString(song.Img)}', window.__favoriteSongsQueue, ${index})">
                      <div class="d-flex align-items-center">
                        <span class="me-3 fw-bold text-teal">${String(index + 1).padStart(2, "0")}</span>
                        <img src="${song.Img}" class="rounded me-3" style="width:50px;height:50px;object-fit:cover" onerror="this.src='https://picsum.photos/50/50'">
                        <div>
                          <p class="mb-0 fw-bold">${song.Name}</p>
                          <small class="text-secondary">${song.Artist}</small>
                        </div>
                      </div>
                      <button class="btn btn-link text-danger p-0" onclick="event.stopPropagation(); toggleFavoriteSongByKey('${escapeJsString(song.Url)}', '${escapeJsString(song.Name)}', '${escapeJsString(song.Artist)}', '${escapeJsString(song.Img)}')">
                        <i class="bi bi-heart-fill"></i>
                      </button>
                    </div>
                  `,
                )
                .join("")
            : '<div class="text-secondary">Chua co bai hat nao trong danh sach yeu thich.</div>'
        }
      </div>
    </div>
  `;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderRecentlyPlayedPage() {
  const contentArea = document.getElementById("main-content");
  if (!contentArea) return;

  const recentlyPlayed = loadRecentlyPlayedSongs();
  const latestSong = recentlyPlayed[0] || null;
  window.__recentlyPlayedQueue = recentlyPlayed;

  contentArea.dataset.view = "recently-played";
  contentArea.classList.remove("page-genre", "page-player");
  contentArea.classList.add("page-home");

  contentArea.innerHTML = `
    <div class="container-fluid py-4 px-4">
      <section class="recent-page-hero mb-4">
        <div class="recent-hero-copy">
          <span class="recent-badge">THU VIEN CUA BAN</span>
          <h1>Nghe gan day</h1>
          <p>Danh sach bai hat ban vua nghe, tap trung vao track va sap xep tu moi nhat den cu hon.</p>
        </div>
        <div class="recent-hero-meta">
          <div class="recent-count">${recentlyPlayed.length}</div>
          <div class="recent-count-label">Bai hat da ghi nho</div>
          <div class="recent-last-song">${
            latestSong
              ? `Gan nhat: <strong>${latestSong.Name}</strong>`
              : "Chua co bai hat nao duoc phat"
          }</div>
        </div>
      </section>

      <section class="recent-list-shell">
        <div class="recent-list-header">
          <div>Bai hat</div>
          <div>Nghe luc</div>
        </div>
        <div class="recent-list-body">
          ${
            recentlyPlayed.length
              ? recentlyPlayed
                  .map(
                    (song, index) => `
                      <article class="recent-song-row" onclick="playThisSong('${escapeJsString(song.Url)}', '${escapeJsString(song.Name)}', '${escapeJsString(song.Artist)}', '${escapeJsString(song.Img)}', window.__recentlyPlayedQueue, ${index})">
                        <div class="recent-song-main">
                          <div class="recent-song-index">${String(index + 1).padStart(2, "0")}</div>
                          <img src="${song.Img}" alt="${song.Name}" class="recent-song-thumb" onerror="this.src='https://picsum.photos/80/80'">
                          <div class="recent-song-info">
                            <h3>${song.Name}</h3>
                            <p>${song.Artist || "Dang cap nhat nghe si"}</p>
                          </div>
                        </div>
                        <div class="recent-song-meta">
                          <span class="recent-played-time">${formatPlayedTime(song.LastPlayedAt)}</span>
                          <button class="recent-play-btn" onclick="event.stopPropagation(); playThisSong('${escapeJsString(song.Url)}', '${escapeJsString(song.Name)}', '${escapeJsString(song.Artist)}', '${escapeJsString(song.Img)}', window.__recentlyPlayedQueue, ${index})">
                            <i class="bi bi-play-fill"></i>
                          </button>
                        </div>
                      </article>
                    `,
                  )
                  .join("")
              : `
                <div class="recent-empty-state">
                  <i class="bi bi-clock-history"></i>
                  <h3>Chua co bai hat nao</h3>
                  <p>Mo mot bai hat bat ky, lich su nghe gan day se hien o day.</p>
                </div>
              `
          }
        </div>
      </section>
    </div>
  `;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.toggleFavoriteSongByKey = function (url, name, artist, img) {
  const song = { Url: url, Name: name, Artist: artist, Img: img };
  const index = getFavoriteSongIndex(song);

  if (index !== -1) {
    favoriteSongs.splice(index, 1);
  } else {
    favoriteSongs.unshift(song);
  }

  saveFavoriteSongs();

  if (currentSongMeta) {
    setFavoriteButtonState(currentSongMeta);
  }

  const contentArea = document.getElementById("main-content");
  if (contentArea && contentArea.innerText.includes("Nhac yeu thich")) {
    renderFavoritesPage();
  }
};

window.openAlbum = function (id) {
  localStorage.setItem("selectedAlbumId", id);
  loadPage("player-page.html");
};


// Phần nhạc yêu thích
window.loadPage = function (pageUrl) {
  const contentArea = document.getElementById("main-content");
  if (!contentArea) return;

  const currentView = contentArea.dataset.currentView || "Home.html";
  if (pageUrl === "lyrics.html") {
    contentArea.dataset.previousView = currentView;
  } else {
    document.body.classList.remove("lyrics-overlay-open");
  }

  contentArea.dataset.currentView = pageUrl;
  contentArea.dataset.view = "";

  if (slideInterval) {
    clearInterval(slideInterval);
    slideInterval = null;
  }

  if (pageUrl === "recently-played") {
    document.querySelectorAll(".menu-item").forEach((item) => {
      item.classList.remove("active");
      const clickAttr = item.getAttribute("onclick");
      if (clickAttr && clickAttr.includes("recently-played")) {
        item.classList.add("active");
      }
    });
    renderRecentlyPlayedPage();
    return;
  }

  if (pageUrl === "favorites") {
    document.querySelectorAll(".menu-item").forEach((item) => {
      item.classList.remove("active");
      const clickAttr = item.getAttribute("onclick");
      if (clickAttr && clickAttr.includes("favorites")) {
        item.classList.add("active");
      }
    });
    renderFavoritesPage();
    return;
  }

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.classList.remove("active");
    const clickAttr = item.getAttribute("onclick");
    if (clickAttr && clickAttr.includes(pageUrl)) {
      item.classList.add("active");
    }
  });

  fetch(pageUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Khong tim thay trang: " + pageUrl);
      }
      return response.text();
    })
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      doc.querySelectorAll("script").forEach((script) => script.remove());
      applyPageStyles(doc);

      contentArea.innerHTML = doc.body ? doc.body.innerHTML : html;

      const normalizedPage = pageUrl.split("/").pop();
      contentArea.classList.remove(
        "page-home",
        "page-genre",
        "page-player",
        "page-lyrics",
      );

      if (normalizedPage === "Home.html") {
        contentArea.classList.add("page-home");
        initAlbumSlider();
        loadHotSongs();
        loadTopGenres();
      }

      if (
        normalizedPage === "TheLoai.html" &&
        typeof window.initGenreFilters === "function"
      ) {
        contentArea.classList.add("page-genre");
        window.initGenreFilters();
      }

      if (normalizedPage === "player-page.html") {
        contentArea.classList.add("page-player");
        initPlayerPage();
      }

      if (normalizedPage === "lyrics.html") {
        contentArea.classList.add("page-lyrics");
        if (typeof window.initLyricsPage === "function") {
          window.initLyricsPage();
        }
        queueLyricsInit();
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    })
    .catch((error) => {
      contentArea.innerHTML = `<div class="p-4 text-danger">Loi he thong: ${error.message}</div>`;
    });
};

async function initAlbumSlider() {
  try {
    const res = await fetch("albums.json");
    albumData = await res.json();

    if (!albumData.length) return;

    renderSlide();
    slideInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % albumData.length;
      renderSlide();
    }, 5000);
  } catch (error) {
    console.error("Loi slider:", error);
  }
}

async function initPlayerPage() {
  const albumId = localStorage.getItem("selectedAlbumId");
  if (!albumId) {
    alert("Khong tim thay album!");
    loadPage("Home.html");
    return;
  }

  try {
    await getAllSongs();

    const resAlbum = await fetch("albums.json");
    const albums = await resAlbum.json();
    const album = albums.find((item) => String(item.id) === String(albumId));

    if (!album) {
      alert("Album khong ton tai!");
      loadPage("Home.html");
      return;
    }

    const albumImg = document.getElementById("album-img");
    const albumTitle = document.getElementById("album-title");
    const albumArtist = document.getElementById("album-artist");
    const songList = document.getElementById("song-list");
    const playAllBtn = document.getElementById("play-all-btn");

    if (!albumImg || !albumTitle || !albumArtist || !songList || !playAllBtn) {
      return;
    }

    albumImg.src = `https://picsum.photos/300/300?random=${album.id}`;
    albumTitle.innerText = repairMojibake(album.albumName);
    albumArtist.innerText = repairMojibake(album.artist);

    const allSongs = await getAllSongs();
    const filteredSongs = getSongsByAlbum(album, allSongs);

    if (!filteredSongs.length) {
      songList.innerHTML = `
        <div class="text-secondary text-center py-5">
          Khong tim thay bai hat nao khop voi album nay trong API.
        </div>
      `;
      playAllBtn.onclick = null;
      return;
    }

    window.__albumSongsQueue = filteredSongs;

    songList.innerHTML = filteredSongs
      .map(
        (song, index) => `
          <div class="song-item" onclick="playThisSong('${escapeJsString(song.Url)}', '${escapeJsString(song.Name)}', '${escapeJsString(song.Artist)}', '${escapeJsString(song.Img)}', window.__albumSongsQueue, ${index})">
            <div class="song-number">${index + 1}</div>
            <img src="${song.Img}" alt="${song.Name}" class="song-img" />
            <div class="song-info">
              <p class="song-title">${song.Name}</p>
              <p class="song-artist">${song.Artist}</p>
              <p class="song-lyrics">${escapeHtml(getLyricsPreview(song))}</p>
            </div>
            <div class="song-duration">${song.Times || "3:45"}</div>
          </div>
        `,
      )
      .join("");

    playAllBtn.onclick = () => {
      if (!filteredSongs.length) return;
      const firstSong = filteredSongs[0];
      playThisSong(
        firstSong.Url,
        firstSong.Name,
        firstSong.Artist,
        firstSong.Img,
        window.__albumSongsQueue,
        0,
      );
    };
  } catch (error) {
    console.error("Loi load player page:", error);
    alert("Loi tai du lieu!");
  }
}

function renderSlide() {
  const slider = document.getElementById("hero-slider");
  const content = document.getElementById("hero-content");
  const current = albumData[currentIndex];

  if (!slider || !content || !current) return;

  content.style.opacity = 0;
  setTimeout(() => {
    slider.style.background = current.bg;
    content.innerHTML = `
      <div class="row align-items-center animate__animated animate__fadeIn">
        <div class="col-md-8">
          <span class="badge bg-teal mb-3 text-dark">NOI BAT</span>
          <h1 class="display-4 fw-bold mb-2 text-white">${current.albumName}</h1>
          <h3 class="h5 text-teal mb-3">${current.artist}</h3>
          <p class="lead mb-4 text-light">${current.description}</p>
          <button class="btn btn-teal text-dark btn-lg px-5 rounded-pill fw-bold" onclick="openAlbum(${current.id})">
            Nghe ngay
          </button>
        </div>
        <div class="col-md-4 d-none d-md-block text-end">
          <img src="https://picsum.photos/400/400?random=${current.id}" class="img-fluid rounded-4 shadow-lg" style="max-height: 280px; object-fit: cover;">
        </div>
      </div>
    `;
    content.style.opacity = 1;
  }, 400);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
