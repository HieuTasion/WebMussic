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
      console.error("lỗi tải danh sách nhạc:", error);
      return [];
    })
    .finally(() => {
      songLibraryPromise = null;
    });

  return songLibraryPromise;
}

function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00";

  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, "0")}:${sec
    .toString()
    .padStart(2, "0")}`;
}

function parseSongTimeToSeconds(timeText) {
  const value = String(timeText || "").trim();
  if (!value) return null;

  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
}

function repairMojibake(value) {
  const input = String(value || "");
  if (!input) return "";

  const looksBroken = /[Ä‚Æ’Ä‚â€ Ä‚â€Ä‚â€¦Ä‚Â¡Ă‚ÂºÄ‚Â¡Ă‚Â»]/.test(input);
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
    .replace(/Ă„â€˜/g, "d")
    .replace(/Ă„Â/g, "D")
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
  if (!raw) return "Khác";

  const name = String(raw).trim().toLowerCase();
  if (name.includes("hip")) return "Hip Hop";
  if (name.includes("v-pop") || name.includes("vpop") || name.includes("v pop"))
    return "V-Pop";
  if (name.includes("k-pop") || name.includes("kpop") || name.includes("k pop"))
    return "K-Pop";
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

function getSongMetaFromSources(
  url,
  name,
  artist,
  img,
  playlist = null,
  index = 0,
) {
  const playlistSong =
    Array.isArray(playlist) && typeof index === "number"
      ? playlist[index]
      : null;

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
  if (!lyrics) return "Chưa có lời";
  if (lyrics.length <= maxLength) return lyrics;
  return `${lyrics.slice(0, maxLength).trimEnd()}...`;
}

function renderDashboardSearchHint(message) {
  const results = document.getElementById("dashboard-search-results");
  if (!results) return;

  results.innerHTML = `<div class="home-search-hint">${escapeHtml(message)}</div>`;
}

function renderDashboardSelectedSong(song) {
  const card = document.getElementById("dashboard-selected-song");
  if (!card) return;

  if (!song) {
    card.classList.remove("is-visible");
    card.innerHTML = "";
    return;
  }

  card.classList.add("is-visible");
  const isFav = window.isSongFavorite(song);

  card.innerHTML = `
    <img src="${song.Img}" alt="${escapeHtml(song.Name)}" onerror="this.src='https://picsum.photos/200/200'">
    <div class="flex-grow-1 ms-3">
      <h4>${escapeHtml(song.Name || "Chưa có tên bài")}</h4>
      <p class="mb-1">${escapeHtml(song.Artist || "Nghệ sĩ đang cập nhật")}</p>
      <p class="small text-muted">${escapeHtml(song.Times || "Thời lượng đang tính...")}</p>
    </div>
    <div class="d-flex align-items-center gap-2">
      <button type="button" class="btn-heart-song ${isFav ? "active" : ""}" id="dashboard-heart-selected" title="Yêu thích">
        <i class="bi ${isFav ? "bi-heart-fill" : "bi-heart"}"></i>
      </button>
      <button type="button" class="btn-play-song" id="dashboard-play-selected-song">
        <i class="bi bi-play-circle-fill"></i> Phát nhạc
      </button>
    </div>
  `;

  const heartBtn = document.getElementById("dashboard-heart-selected");
  if (heartBtn) {
    heartBtn.onclick = (e) => {
      e.stopPropagation();
      const existingIndex = getFavoriteSongIndex(song);
      if (existingIndex !== -1) {
        favoriteSongs.splice(existingIndex, 1);
      } else {
        favoriteSongs.unshift({ ...song });
      }
      saveFavoriteSongs();
      renderDashboardSelectedSong(song);

      if (
        currentSongMeta &&
        normalizeSongKey(currentSongMeta) === normalizeSongKey(song)
      ) {
        setFavoriteButtonState(currentSongMeta);
      }
    };
  }

  const playBtn = document.getElementById("dashboard-play-selected-song");
  if (playBtn) {
    playBtn.onclick = () => {
      const library = songLibraryCache.length ? songLibraryCache : [song];
      const idx = library.findIndex(
        (s) => normalizeSongKey(s) === normalizeSongKey(song),
      );

      playThisSong(
        song.Url,
        song.Name,
        song.Artist,
        song.Img,
        library,
        idx !== -1 ? idx : 0,
      );
    };
  }
}

function renderDashboardSearchResults(songs, keyword = "") {
  const results = document.getElementById("dashboard-search-results");
  if (!results) return;

  if (!keyword.trim()) {
    renderDashboardSearchHint("Gõ từng ký tự để hiện danh sách bài hát.");
    return;
  }

  if (!songs.length) {
    renderDashboardSearchHint("Không tìm thấy bài hát phù hợp.");
    return;
  }

  results.innerHTML = songs
    .map(
      (song, index) => `
        <button
          type="button"
            class="home-search-item song-row-clickable ${
              dashboardSearchSelectedSong &&
              normalizeSongKey(dashboardSearchSelectedSong) ===
                normalizeSongKey(song)
                ? "active"
                : ""
            }"
          data-search-index="${index}"
          onclick="playThisSong('${escapeJsString(song.Url)}', '${escapeJsString(song.Name)}', '${escapeJsString(song.Artist)}', '${escapeJsString(song.Img)}', null, 0)"
        >
          <img src="${song.Img}" alt="${escapeHtml(song.Name)}" onerror="this.src='https://picsum.photos/80/80'">
          <span>
            <strong onclick="event.stopPropagation(); window.openSongDetail(songLibraryCache.find(s => s.Url === '${escapeJsString(song.Url)}'))">${escapeHtml(song.Name || "Chưa có tên")}</strong>
            <span>${escapeHtml(song.Artist || "Đang cập nhật nghệ sĩ")}</span>
          </span>
          <span>${escapeHtml(song.Times || "")}</span>
        </button>
      `,
    )
    .join("");
}

async function initDashboardSongSearch() {
  const input = document.getElementById("dashboard-song-search");
  if (!input) return;

  await getAllSongs();

  renderDashboardSearchHint("Gõ từng ký tự để hiện danh sách bài hát.");

  input.oninput = () => {
    const keyword = normalizeText(repairMojibake(input.value));

    if (!keyword) {
      renderDashboardSearchResults([], "");
      return;
    }

    const matchedSongs = songLibraryCache
      .filter((song) => {
        const songName = normalizeText(repairMojibake(song.Name));
        const artistName = normalizeText(repairMojibake(song.Artist));
        return songName.includes(keyword) || artistName.includes(keyword);
      })
      .slice(0, 8);

    renderDashboardSearchResults(matchedSongs, input.value);
  };
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
