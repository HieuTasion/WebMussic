const LYRICS_API_URL = "https://68ef6d3fb06cc802829d58ca.mockapi.io/songs";
// const LYRICS_SNAPSHOT_KEY = "harmonix_lyrics_snapshot";
// const USER_LYRIC_TUNING_KEY = "harmonix_lyrics_user_tuning";
// const LYRICS_FIELD_CANDIDATES = [
//   "Lyrics",
//   "lyrics",
//   "Lyric",
//   "lyric",
//   "Loi",
//   "loi",
//   "LoiBaiHat",
//   "loiBaiHat",
//   "Loi_bai_hat",
//   "loi_bai_hat",
// ];

const SONG_LYRIC_TUNING = {
  1: { leadIn: 4.2, tailOut: 3.6, shift: -0.18, lineScale: 1.04 },
  2: { leadIn: 3.6, tailOut: 3.3, shift: -0.12, lineScale: 1.02 },
  3: { leadIn: 5.2, tailOut: 3.8, shift: -0.16, lineScale: 1.05 },
  4: { leadIn: 4.0, tailOut: 4.0, shift: -0.22, lineScale: 1.08 },
  5: { leadIn: 3.2, tailOut: 3.6, shift: -0.1, lineScale: 1.02 },
  6: { leadIn: 5.0, tailOut: 4.2, shift: -0.16, lineScale: 1.06 },
  7: { leadIn: 1.8, tailOut: 2.4, shift: -0.05, lineScale: 0.98 },
  8: { leadIn: 4.6, tailOut: 3.6, shift: -0.15, lineScale: 1.03 },
  9: { leadIn: 3.8, tailOut: 3.4, shift: -0.12, lineScale: 1.02 },
  10: { leadIn: 3.6, tailOut: 2.8, shift: -0.12, lineScale: 1.04 },
  11: { leadIn: 3.0, tailOut: 3.0, shift: -0.08, lineScale: 1.0 },
  12: { leadIn: 3.8, tailOut: 2.6, shift: -0.06, lineScale: 0.96 },
  13: { leadIn: 2.2, tailOut: 3.2, shift: -0.08, lineScale: 1.0 },
  14: { leadIn: 2.8, tailOut: 3.2, shift: -0.12, lineScale: 1.04 },
  15: { leadIn: 1.8, tailOut: 2.6, shift: -0.04, lineScale: 0.96 },
  16: { leadIn: 3.4, tailOut: 3.4, shift: -0.18, lineScale: 1.05 },
  antihero: { leadIn: 3.4, tailOut: 3.4, shift: -0.18, lineScale: 1.05 },
  haytraochoanh: { leadIn: 4.0, tailOut: 4.0, shift: -0.22, lineScale: 1.08 },
  chayngaydi: { leadIn: 3.2, tailOut: 3.6, shift: -0.1, lineScale: 1.02 },
  somethingjustlikethis: {
    leadIn: 2.8,
    tailOut: 3.2,
    shift: -0.12,
    lineScale: 1.04,
  },
  alone: { leadIn: 3.8, tailOut: 2.6, shift: -0.06, lineScale: 0.96 },
  beautyandabeat: { leadIn: 3.6, tailOut: 2.8, shift: -0.12, lineScale: 1.04 },
  dontstopmenow: { leadIn: 1.8, tailOut: 2.6, shift: -0.04, lineScale: 0.96 },
};

let lyricsSyncState = {
  audio: null,
  lines: [],
  timeline: [],
  cleanup: null,
  currentKey: "",
  tuning: null,
  activeIndex: -1,
  song: null,
};

function getCurrentSongMeta() {
  try {
    const raw = localStorage.getItem("currentSongMeta");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.Name) return parsed;
    }
  } catch (error) {
    // ignore
  }

  try {
    const rawSnapshot = localStorage.getItem(LYRICS_SNAPSHOT_KEY);
    if (rawSnapshot) {
      const parsedSnapshot = JSON.parse(rawSnapshot);
      if (parsedSnapshot && parsedSnapshot.Name) return parsedSnapshot;
    }
  } catch (error) {
    // ignore
  }

  try {
    const recentRaw = localStorage.getItem("recentlyPlayedSongs");
    if (recentRaw) {
      const recentSongs = JSON.parse(recentRaw);
      if (Array.isArray(recentSongs) && recentSongs[0] && recentSongs[0].Name) {
        return recentSongs[0];
      }
    }
  } catch (error) {
    // ignore
  }

  return window.currentSongMeta || null;
}

function inferSongMetaFromPlayer() {
  const audio =
    document.getElementById("main-audio") || document.querySelector("audio");
  const title = document.getElementById("player-title")?.innerText?.trim();
  const artist = document.getElementById("player-artist")?.innerText?.trim();
  const img = document.getElementById("player-img")?.getAttribute("src") || "";
  const url = audio?.currentSrc || audio?.src || "";

  const hasRealSong =
    !!url &&
    !!title &&
    !/NVNP Music/i.test(title) &&
    !/Chọn bài hát để phát/i.test(artist || "");

  if (!hasRealSong) return null;

  return {
    Url: url,
    Name: title,
    Artist: artist || "Đang cập nhật nghệ sĩ",
    Img: img,
  };
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

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeSongToken(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function getSongIdentityKey(song) {
  const id = String(song?.id || "").trim();
  if (id) return `id:${id}`;

  const url = String(song?.Url || "").trim();
  if (url) return `url:${url}`;

  return `name:${normalizeSongToken(song?.Name || "")}`;
}

function getStoredTuningMap() {
  try {
    const raw = localStorage.getItem(USER_LYRIC_TUNING_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveStoredTuningMap(map) {
  localStorage.setItem(USER_LYRIC_TUNING_KEY, JSON.stringify(map));
}

function getSongTuning(song) {
  const songId = String(song?.id || "").trim();
  const token = normalizeSongToken(song?.Name || "");
  const baseTuning = SONG_LYRIC_TUNING[songId] ||
    SONG_LYRIC_TUNING[token] || {
      leadIn: 4.2,
      tailOut: 4.2,
      shift: -0.15,
      lineScale: 1,
    };

  const storedMap = getStoredTuningMap();
  return {
    ...baseTuning,
    ...(storedMap[getSongIdentityKey(song)] || {}),
  };
}

function updateLyricsTuningValue(song) {
  const el = document.getElementById("lyrics-tuning-value");
  if (!el) return;

  el.innerText = `${Number(getSongTuning(song).leadIn || 0).toFixed(1)}s`;
}

function adjustSongIntro(song, delta) {
  if (!song) return;

  const key = getSongIdentityKey(song);
  const tuningMap = getStoredTuningMap();
  const current = getSongTuning(song);
  const nextLeadIn = Math.max(0, Number((current.leadIn + delta).toFixed(2)));

  tuningMap[key] = {
    ...(tuningMap[key] || {}),
    leadIn: nextLeadIn,
  };

  saveStoredTuningMap(tuningMap);
  renderLyrics(song);
}

function resetSongIntro(song) {
  if (!song) return;

  const key = getSongIdentityKey(song);
  const tuningMap = getStoredTuningMap();

  if (tuningMap[key]) {
    delete tuningMap[key].leadIn;
    if (!Object.keys(tuningMap[key]).length) {
      delete tuningMap[key];
    }
  }

  saveStoredTuningMap(tuningMap);
  renderLyrics(song);
}

function bindTuningControls(song) {
  const earlierBtn = document.getElementById("lyrics-intro-earlier");
  const laterBtn = document.getElementById("lyrics-intro-later");
  const resetBtn = document.getElementById("lyrics-intro-reset");

  updateLyricsTuningValue(song);

  if (earlierBtn) {
    earlierBtn.onclick = () => adjustSongIntro(song, -0.5);
  }

  if (laterBtn) {
    laterBtn.onclick = () => adjustSongIntro(song, 0.5);
  }

  if (resetBtn) {
    resetBtn.onclick = () => resetSongIntro(song);
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";

  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

async function hydrateSongWithLibrary(song) {
  if (!song) return null;

  try {
    const response = await fetch(LYRICS_API_URL);
    const songs = await response.json();
    if (!Array.isArray(songs)) return song;

    const matchedSong = songs.find((item) => {
      const sameUrl = song.Url && item.Url && item.Url === song.Url;
      const sameMeta =
        normalizeText(item.Name) === normalizeText(song.Name) &&
        normalizeText(item.Artist) === normalizeText(song.Artist);
      return sameUrl || sameMeta;
    });

    if (!matchedSong) return song;

    const mergedSong = {
      ...matchedSong,
      ...song,
      Lyrics: song.Lyrics || matchedSong.Lyrics,
      lyrics: song.lyrics || matchedSong.lyrics,
      Lyric: song.Lyric || matchedSong.Lyric,
      lyric: song.lyric || matchedSong.lyric,
    };
    window.currentSongMeta = mergedSong;
    localStorage.setItem("currentSongMeta", JSON.stringify(mergedSong));
    return mergedSong;
  } catch (error) {
    console.error("Lỗi tải lyric từ API:", error);
    return song;
  }
}

function parseLrcFormat(lyricsText) {
  const lrcRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*?)$/gm;
  const matches = Array.from(String(lyricsText || "").matchAll(lrcRegex));

  if (matches.length === 0) return null;

  return matches.map((match) => {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const milliseconds = parseInt(match[3].padEnd(3, "0"), 10);
    const text = match[4].trim();
    const timeInSeconds = minutes * 60 + seconds + milliseconds / 1000;

    return {
      time: timeInSeconds,
      text: text,
    };
  });
}

function splitLyricsLines(lyricsText) {
  const lrcData = parseLrcFormat(lyricsText);
  if (lrcData && lrcData.length > 0) {
    return lrcData;
  }

  const rawLines = String(lyricsText || "")
    .replace(/\r/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\s*\/\s*/g, "\n")
    .split("\n")
    .map((line) => line.trim());

  return rawLines.flatMap((line) => splitLongLyricLine(line));
}

function splitLongLyricLine(line, maxLength = 34) {
  const text = String(line || "").trim();
  if (!text) return [""];
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    const slice = remaining.slice(0, maxLength + 10);
    const punctuationBreak = Math.max(
      slice.lastIndexOf(","),
      slice.lastIndexOf("."),
      slice.lastIndexOf("?"),
      slice.lastIndexOf("!"),
      slice.lastIndexOf(";"),
      slice.lastIndexOf(":"),
    );
    const spaceBreak = slice.lastIndexOf(" ");
    const breakIndex =
      punctuationBreak > maxLength * 0.55
        ? punctuationBreak + 1
        : spaceBreak > maxLength * 0.55
          ? spaceBreak
          : maxLength;

    chunks.push(remaining.slice(0, breakIndex).trim());
    remaining = remaining.slice(breakIndex).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks.filter(Boolean);
}

function clearLyricsSync() {
  if (typeof lyricsSyncState.cleanup === "function") {
    lyricsSyncState.cleanup();
  }

  lyricsSyncState = {
    audio: null,
    lines: [],
    timeline: [],
    cleanup: null,
    currentKey: "",
    tuning: null,
    activeIndex: -1,
    song: null,
  };
}

function estimateLineWeight(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return 0.55;

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const charLength = normalized.length;
  const punctuationBonus = (normalized.match(/[,.;:!?]/g) || []).length * 0.45;
  const upperBonus = (normalized.match(/[A-Z]/g) || []).length * 0.02;
  const lengthBonus = Math.min(charLength / 16, 2.8);

  const baseWeight = Math.max(
    0.8,
    wordCount * 0.85 + punctuationBonus + upperBonus + lengthBonus,
  );
  return Math.max(0.9, Math.min(baseWeight, 3.5));
}

function buildLyricsTimeline(song, lineNodes, audio) {
  const playableLines = lineNodes.filter(
    (line) => !line.classList.contains("is-empty"),
  );
  if (!playableLines.length) return [];

  const tuning = getSongTuning(song);
  const duration =
    Number.isFinite(audio?.duration) && audio.duration > 0 ? audio.duration : 0;

  // Check if lines have LRC timing data
  const lrcTimings = playableLines.map((line) => {
    const text = line.innerText || "";
    const lrcMatch = text.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]/);
    if (lrcMatch) {
      const minutes = parseInt(lrcMatch[1], 10);
      const seconds = parseInt(lrcMatch[2], 10);
      const ms = parseInt(lrcMatch[3].padEnd(3, "0"), 10);
      return minutes * 60 + seconds + ms / 1000;
    }
    return null;
  });

  const hasLrcTiming = lrcTimings.some((t) => t !== null);

  if (hasLrcTiming) {
    return playableLines.map((line, index) => {
      let start =
        lrcTimings[index] ??
        (index === 0 ? 0 : (playableLines[index - 1]?.dataset?.endTime ?? 0));
      let end = lrcTimings[index + 1] ?? start + 1.8;

      if (lrcTimings[index] === null && index > 0) {
        const prevTime = lrcTimings[index - 1];
        start = prevTime ? prevTime + 1.8 : 0;
        end = start + 1.8;
      }

      return {
        element: line,
        start: Math.max(0, start + tuning.shift),
        end: Math.max(start + 0.8, end + tuning.shift),
      };
    });
  }

  const usableDuration = Math.max(
    duration - tuning.leadIn - tuning.tailOut,
    playableLines.length * 1.6,
  );

  const weights = playableLines.map((line, index) => {
    const baseWeight = estimateLineWeight(line.innerText) * tuning.lineScale;
    const previousText = playableLines[index - 1]?.innerText || "";
    const transitionBonus = /[,.;:!?]$/.test(previousText) ? 0.32 : 0;
    return baseWeight + transitionBonus;
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = tuning.leadIn;

  return playableLines.map((line, index) => {
    const seconds =
      totalWeight > 0
        ? (weights[index] / totalWeight) * usableDuration
        : usableDuration / playableLines.length;
    const minSeconds = Math.max(
      1.15,
      Math.min(2.2, line.innerText.length / 18),
    );
    const lineDuration = Math.max(seconds, minSeconds);
    const start = cursor;
    cursor += lineDuration;

    return {
      element: line,
      start,
      end: cursor,
    };
  });
}

function updateProgressLabel(audio) {
  const progressLabel = document.getElementById("lyrics-progress-label");
  if (!progressLabel || !audio) return;

  progressLabel.innerText = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
}

function setActiveLine(audio) {
  const timeline = lyricsSyncState.timeline;
  if (!audio || !timeline.length) return;

  const content = document.getElementById("lyrics-content");
  if (!content) return;

  const tuning = lyricsSyncState.tuning || { shift: 0 };
  const adjustedTime = Math.max(0, (audio.currentTime || 0) + tuning.shift);

  let activeIndex = timeline.findIndex(
    (item) => adjustedTime >= item.start && adjustedTime < item.end,
  );

  if (activeIndex === -1) {
    if (adjustedTime < timeline[0].start) {
      activeIndex = -1;
    } else {
      activeIndex = timeline.length - 1;
    }
  }

  const previousIndex = lyricsSyncState.activeIndex;
  if (
    previousIndex !== -1 &&
    activeIndex !== -1 &&
    previousIndex !== activeIndex
  ) {
    const previousLine = timeline[previousIndex];
    const nextLine = timeline[activeIndex];
    const holdWindow = 0.18;

    if (
      previousLine &&
      nextLine &&
      adjustedTime < previousLine.end + holdWindow &&
      adjustedTime < nextLine.start + holdWindow
    ) {
      activeIndex = previousIndex;
    }
  }

  lyricsSyncState.activeIndex = activeIndex;

  timeline.forEach((item, index) => {
    item.element.classList.toggle(
      "is-past",
      activeIndex !== -1 && index < activeIndex,
    );
    item.element.classList.toggle("is-active", index === activeIndex);
    item.element.classList.toggle(
      "is-upcoming",
      activeIndex === -1 || index > activeIndex,
    );
  });

  const activeLine = timeline[activeIndex]?.element;
  if (activeLine) {
    const lineTop =
      activeLine.offsetTop -
      content.clientHeight / 2 +
      activeLine.clientHeight / 2;
    content.scrollTo({ top: Math.max(lineTop, 0), behavior: "smooth" });
  }
}

function bindLyricsToAudio(song) {
  clearLyricsSync();

  const audio =
    document.getElementById("main-audio") ||
    window.audio ||
    document.querySelector("audio");

  const lineNodes = Array.from(document.querySelectorAll(".lyric-line"));
  lyricsSyncState.audio = audio;
  lyricsSyncState.lines = lineNodes;
  lyricsSyncState.tuning = getSongTuning(song);
  lyricsSyncState.timeline = buildLyricsTimeline(song, lineNodes, audio);
  lyricsSyncState.currentKey = `${song.Url || ""}__${song.Name || ""}`;
  lyricsSyncState.song = song;

  if (!audio || !lyricsSyncState.timeline.length) {
    updateProgressLabel(null);
    return;
  }

  const rebuildTimeline = () => {
    lyricsSyncState.timeline = buildLyricsTimeline(song, lineNodes, audio);
  };

  const syncLyrics = () => {
    updateProgressLabel(audio);
    setActiveLine(audio);
  };

  const handleMetadata = () => {
    rebuildTimeline();
    syncLyrics();
  };

  const handleEnded = () => {
    updateProgressLabel(audio);
    setActiveLine(audio);
  };

  audio.addEventListener("timeupdate", syncLyrics);
  audio.addEventListener("loadedmetadata", handleMetadata);
  audio.addEventListener("durationchange", handleMetadata);
  audio.addEventListener("play", syncLyrics);
  audio.addEventListener("seeked", syncLyrics);
  audio.addEventListener("ended", handleEnded);

  lyricsSyncState.cleanup = () => {
    audio.removeEventListener("timeupdate", syncLyrics);
    audio.removeEventListener("loadedmetadata", handleMetadata);
    audio.removeEventListener("durationchange", handleMetadata);
    audio.removeEventListener("play", syncLyrics);
    audio.removeEventListener("seeked", syncLyrics);
    audio.removeEventListener("ended", handleEnded);
  };

  handleMetadata();
}

function renderLyrics(song) {
  const title = document.getElementById("lyrics-title");
  const artist = document.getElementById("lyrics-artist");
  const cover = document.getElementById("lyrics-cover");
  const subline = document.getElementById("lyrics-subline");
  const content = document.getElementById("lyrics-content");
  const source = document.getElementById("lyrics-source");

  if (!title || !artist || !cover || !subline || !content || !source) {
    return;
  }

  title.innerText = song.Name || "Không có tiêu đề";
  artist.innerText = song.Artist || "Không rõ nghệ sĩ";
  cover.src = song.Img || "https://picsum.photos/300/300";
  cover.onerror = () => {
    cover.src = "https://picsum.photos/300/300";
  };
  subline.innerText = song.Times
    ? `Thời lượng ${song.Times}${song.Genre ? ` • ${song.Genre}` : ""}`
    : song.Genre || "Đang đồng bộ lời";

  const lyricsText = getSongLyrics(song);

  if (lyricsText.trim()) {
    const lines = splitLyricsLines(lyricsText);
    const isLrcFormat =
      lines.length > 0 && typeof lines[0] === "object" && lines[0].text;

    content.innerHTML = `
      <div class="lyrics-list">
        ${lines
          .map((line) => {
            const text = isLrcFormat ? line.text : line;
            return text
              ? `<p class="lyric-line is-upcoming">${escapeHtml(text)}</p>`
              : '<p class="lyric-line is-empty">&nbsp;</p>';
          })
          .join("")}
      </div>
    `;
    source.innerText = isLrcFormat ? "LRC Đồng bộ" : "Lời đồng bộ";
  } else {
    content.innerHTML = `
      <div class="empty-state">
        <p>Chưa có dữ liệu lời cho bài hát này.</p>
        <p>Mở bài khác hoặc bổ sung lời trong API để trang micro đồng bộ được.</p>
      </div>
    `;
    source.innerText = "Chưa có lời";
  }

  bindTuningControls(song);
  bindLyricsToAudio(song);
}

function renderNoSongState() {
  clearLyricsSync();

  const title = document.getElementById("lyrics-title");
  const artist = document.getElementById("lyrics-artist");
  const cover = document.getElementById("lyrics-cover");
  const subline = document.getElementById("lyrics-subline");
  const content = document.getElementById("lyrics-content");
  const source = document.getElementById("lyrics-source");
  const progressLabel = document.getElementById("lyrics-progress-label");

  if (title) title.innerText = "Chưa có bài hát nào";
  if (artist) artist.innerText = "Hãy chọn 1 bài hát trên player";
  if (subline) subline.innerText = "Micro sẽ hiển thị thông tin bài đang phát";
  if (cover) {
    cover.src = "https://picsum.photos/300/300?blur=3";
  }

  if (content) {
    content.innerHTML = `
      <div class="empty-state">
        <p>Chưa có bài hát nào đang phát.</p>
        <p>Hãy quay lại player, yêu thích hoặc nghe gần đây để chọn bài trước khi mở micro.</p>
      </div>
    `;
  }

  if (source) source.innerText = "Không có bài";
  if (progressLabel) progressLabel.innerText = "00:00 / 00:00";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.initLyricsPage = async function () {
  const song = getCurrentSongMeta() || inferSongMetaFromPlayer();

  if (!song) {
    renderNoSongState();
    return;
  }

  const hydratedSong = await hydrateSongWithLibrary(song);
  window.currentSongMeta = hydratedSong || song;
  localStorage.setItem(
    "currentSongMeta",
    JSON.stringify(window.currentSongMeta),
  );
  renderLyrics(hydratedSong || song);
};

window.addEventListener("song:changed", async (event) => {
  const detailSong = event?.detail?.song || getCurrentSongMeta();
  const lyricsRoot = document.getElementById("lyrics-content");

  if (!lyricsRoot) return;

  const hydratedSong = await hydrateSongWithLibrary(detailSong);
  renderLyrics(hydratedSong || detailSong);
});
