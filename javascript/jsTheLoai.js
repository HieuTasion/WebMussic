const API_URL = "https://68ef6d3fb06cc802829d58ca.mockapi.io/songs";
let genresData = [];

function normalizeGenre(raw) {
  if (!raw) return "Khác";

  let name = raw.trim().toLowerCase();

  if (name.includes("hip")) return "Hip Hop";
  if (name.includes("v-pop") || name.includes("vpop") || name.includes("v pop"))
    return "V-Pop";
  if (name.includes("pop")) return "Pop";
  if (name.includes("rock")) return "Rock";
  if (name.includes("edm") || name.includes("dance")) return "EDM";
  if (name.includes("lofi")) return "Lofi";
  if (name.includes("jazz")) return "Jazz";

  return raw.trim();
}

async function fetchSongsAndProcessGenres() {
  const grid = document.getElementById("genresGrid");
  if (!grid) return;

  grid.innerHTML =
    '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: white;">\u0110ang tải dữ liệu âm nhạc...</div>';

  try {
    const res = await fetch(API_URL);
    const songs = await res.json();
    const genreMap = new Map();

    songs.forEach((song) => {
      let genreName = normalizeGenre(song.Genre);

      if (!genreMap.has(genreName)) {
        genreMap.set(genreName, {
          name: genreName,
          songs: [],
          totalLikes: 0,
          songCount: 0,
          mood: detectMoodByGenre(genreName),
        });
      }

      const genre = genreMap.get(genreName);
      genre.songs.push(song);
      genre.totalLikes += Number(song.Likes || 0);
      genre.songCount += 1;
    });

    genresData = Array.from(genreMap.values()).map((genre) => ({
      ...genre,
      desc: `Khám phá những giai điệu ${genre.name} tuyển chọn`,
      icon: getIconByGenre(genre.name),
      bg: getGradientByGenre(genre.name),
    }));

    updateGenreHeaderStats(songs, genresData);
    renderGenres("all");

    const selectedGenreName = localStorage.getItem("selectedGenreName");
    if (selectedGenreName) {
      localStorage.removeItem("selectedGenreName");
      const matchedGenre = genresData.find(
        (genre) => genre.name === selectedGenreName,
      );

      if (matchedGenre) {
        renderSongsByGenre(matchedGenre.name);
      }
    }
  } catch (error) {
    console.error("Loi API:", error);
    grid.innerHTML =
      '<p style="color: red; text-align: center;">Không thể tải dữ liệu!</p>';
  }
}

function renderSongsByGenre(genreName) {
  const grid = document.getElementById("genresGrid");
  const genre = genresData.find((item) => item.name === genreName);

  if (!grid || !genre) return;

  window.scrollTo({ top: 350, behavior: "smooth" });
  grid.style.display = "flex";
  grid.style.flexDirection = "column";
  grid.style.gap = "15px";
  window.__genreSongsQueue = genre.songs;

  let html = `
    <div style="margin-bottom: 25px; animation: fadeIn 0.5s ease;">
      <button onclick="renderGenres('all')" style="background: #ffffff22; color: white; border: 1px solid white; padding: 10px 25px; border-radius: 30px; cursor: pointer;">
        <i class="fas fa-arrow-left"></i> Quay lại thể loại
      </button>
      <h2 style="color: white; font-size: 2.2rem; margin-top: 20px;">Dòng nhạc: ${genre.name}</h2>
    </div>
  `;

  genre.songs.forEach((song, index) => {
    const name = song.Name || "Không tên";
    const artist = song.Artist || "Nghe si";
    const img = song.Img || "https://via.placeholder.com/50";
    const likes = song.Likes || 0;
    const plays = song.Count || 0;

    html += `
      <div class="song-item-row" onclick="playThisSong('${song.Url}', '${name.replace(/'/g, "\\'")}', '${artist.replace(/'/g, "\\'")}', '${img}', window.__genreSongsQueue, ${index})" style="background: rgba(255,255,255,0.05); padding: 12px 20px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(255,255,255,0.1); transition: 0.3s; cursor: pointer;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <span style="color: #666; width: 25px; font-weight: bold;">${index + 1}</span>
          <img src="${img}" style="width: 55px; height: 55px; border-radius: 8px; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
          <div>
            <h4 style="margin: 0; color: white; font-size: 1.1rem;">${name}</h4>
            <p style="margin: 4px 0 0 0; color: #aaa; font-size: 0.85rem;">${artist}</p>
          </div>
        </div>
        <div style="display: flex; gap: 30px; color: #ddd; font-size: 0.9rem;">
          <span><i class="fas fa-heart" style="color: #ff4757;"></i> ${likes}</span>
          <span><i class="fas fa-play"></i> ${plays}</span>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

function renderGenres(filterValue = "all") {
  const grid = document.getElementById("genresGrid");
  if (!grid) return;

  grid.style.display = "grid";
  grid.style.flexDirection = "unset";

  let list = genresData;
  if (filterValue !== "all") {
    list = list.filter((genre) => genre.mood === filterValue);
  }

  if (list.length === 0) {
    grid.innerHTML =
      '<div style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px;">Không tìm thấy thể loại nào phù hợp.</div>';
    return;
  }

  grid.innerHTML = list
    .map(
      (genre, index) => `
        <div class="genre-card" style="animation-delay:${index * 0.05}s">
          <div class="card-bg" style="background:${genre.bg}"></div>
          <div class="card-content">
            <i class="${genre.icon}"></i>
            <h3>${genre.name}</h3>
            <p>${genre.desc}</p>
            <div class="genre-stats">
              <span>${genre.songCount} bài hát</span>
              <span>❤ ${genre.totalLikes}</span>
            </div>
            <button class="listen-btn" onclick="renderSongsByGenre('${genre.name.replace(/'/g, "\\'")}')">
              Kham pha →
            </button>
          </div>
        </div>
      `,
    )
    .join("");
}

function updateGenreHeaderStats(songs, genres) {
  const totalSongs = document.getElementById("totalSongs");
  const totalGenres = document.getElementById("totalGenres");
  const totalLikes = document.getElementById("totalLikes");

  if (totalSongs) {
    totalSongs.innerText = String(Array.isArray(songs) ? songs.length : 0);
  }

  if (totalGenres) {
    totalGenres.innerText = String(Array.isArray(genres) ? genres.length : 0);
  }

  if (totalLikes) {
    const likes = Array.isArray(songs)
      ? songs.reduce((sum, song) => sum + Number(song.Likes || 0), 0)
      : 0;
    totalLikes.innerText = String(likes);
  }
}

function initGenreFilters() {
  fetchSongsAndProcessGenres();

  const chips = document.querySelectorAll(".filter-chip");
  chips.forEach((chip) => {
    chip.onclick = () => {
      chips.forEach((item) => item.classList.remove("active"));
      chip.classList.add("active");
      renderGenres(chip.getAttribute("data-filter"));
    };
  });
}

function detectMoodByGenre(name) {
  const normalized = name.toLowerCase();

  if (normalized.includes("pop")) {
    return "vui-tuoi";
  }

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

function getIconByGenre(name) {
  const map = {
    Pop: "fas fa-microphone",
    Rock: "fas fa-guitar",
    EDM: "fas fa-bolt",
    "Hip Hop": "fas fa-headphones",
  };

  return map[name] || "fas fa-music";
}

function getGradientByGenre(name) {
  const map = {
    Pop: "linear-gradient(135deg, #FF9A9E 0%, #FAD0C4 100%)",
    Rock: "linear-gradient(135deg, #232526 0%, #414345 100%)",
    EDM: "linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)",
    "Hip Hop": "linear-gradient(135deg, #F093FB 0%, #F5576C 100%)",
  };

  return map[name] || "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)";
}

window.renderGenres = renderGenres;
window.renderSongsByGenre = renderSongsByGenre;
window.initGenreFilters = initGenreFilters;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGenreFilters, {
    once: true,
  });
}
