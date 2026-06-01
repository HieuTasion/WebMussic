const API_URL = "https://68ef6d3fb06cc802829d58ca.mockapi.io/songs";
let genresData = [];

function normalizeGenre(raw) {
  if (!raw) return "Khác";

  let name = raw.trim().toLowerCase();

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

  // Tắt chế độ Grid của danh mục để hiển thị danh sách bài hát theo hàng dọc
  grid.classList.remove("genres-grid");
  grid.style.display = "block";
  grid.style.gap = "0";

  // Tạo khung tiêu đề kèm ô tìm kiếm
  grid.innerHTML = `
    <div style="margin-bottom: 25px; padding-top: 35px; animation: fadeIn 0.5s ease;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
        <button onclick="renderGenres('all')" style="background: #ffffff22; color: white; border: 1px solid white; padding: 10px 25px; border-radius: 30px; cursor: pointer;">
          <i class="fas fa-arrow-left"></i> Quay lại thể loại
        </button>
        
        <!-- Thanh tìm kiếm trong thể loại -->
        <div class="genre-search-wrap" style="flex: 1; max-width: 400px; position: relative;">
          <input type="text" id="genre-song-search" placeholder="Tìm bài hát trong ${genre.name}..." 
                 style="width: 100%; padding: 10px 15px 10px 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white; outline: none;">
          <i class="fas fa-search" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.5);"></i>
        </div>
      </div>
      <h2 style="color: white; font-size: 2.2rem; margin-top: 20px;">Dòng nhạc: ${genre.name}</h2>
    </div>
    <div id="genreSongsListContainer" style="display: flex; flex-direction: column; gap: 15px;"></div>
  `;

  const searchInput = document.getElementById("genre-song-search");
  const listContainer = document.getElementById("genreSongsListContainer");

  // Hàm cập nhật danh sách bài hát dựa trên từ khóa
  const updateList = (keyword = "") => {
    const filtered = genre.songs.filter((song) => {
      const name = (song.Name || "").toLowerCase();
      const artist = (song.Artist || "").toLowerCase();
      const key = keyword.toLowerCase();
      return name.includes(key) || artist.includes(key);
    });

    // Cập nhật hàng chờ phát nhạc để đồng bộ với kết quả tìm kiếm
    window.__genreSongsQueue = filtered;

    if (filtered.length === 0) {
      listContainer.innerHTML = `<div style="text-align: center; color: #888; padding: 40px;">Không tìm thấy bài hát nào phù hợp.</div>`;
      return;
    }

    listContainer.innerHTML = filtered
      .map((song, index) => {
        const name = song.Name || "Không tên";
        const artist = song.Artist || "Nghe si";
        const img = song.Img || "https://via.placeholder.com/50";
        const likes = song.Likes || 0;
        const plays = song.Count || 0;

        return `
        <div class="song-item-row" 
             onclick="playThisSong('${escapeJsString(song.Url)}', '${escapeJsString(song.Name)}', '${escapeJsString(song.Artist)}', '${escapeJsString(song.Img)}', window.__genreSongsQueue, ${index})">
          <div class="d-flex align-items-center gap-3">
            <span class="text-secondary fw-bold" style="width: 25px;">${index + 1}</span>
            <img src="${img}" class="rounded shadow" style="width: 55px; height: 55px; object-fit: cover;">
            <div class="text-start">
              <h4 class="genre-song-title h6 mb-0 fw-bold">${name}</h4>
              <p class="small mb-0">${artist}</p>
            </div>
          </div>
          <div class="d-flex gap-4 small">
            <span><i class="fas fa-heart" style="color: #ff4757;"></i> ${likes}</span>
            <span><i class="fas fa-play"></i> ${plays}</span>
          </div>
        </div>
      `;
      })
      .join("");
  };

  // Gán sự kiện cho ô tìm kiếm
  searchInput.oninput = (e) => updateList(e.target.value);

  // Hiển thị danh sách ban đầu
  updateList();
}

function renderGenres(filterValue = "all") {
  const grid = document.getElementById("genresGrid");
  if (!grid) return;

  // Khôi phục layout Grid từ CSS
  grid.classList.add("genres-grid");
  grid.style.display = ""; // Để CSS (.genres-grid) tự điều khiển

  let list = genresData;
  if (filterValue !== "all") {
    list = list.filter((genre) => genre.mood === filterValue);
  }

  if (list.length === 0) {
    grid.innerHTML =
      '<div class="col-12 text-center text-muted py-5">Không tìm thấy thể loại nào phù hợp.</div>';
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
              Khám phá →
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
    "K-Pop": "fas fa-star",
  };

  return map[name] || "fas fa-music";
}

function getGradientByGenre(name) {
  const map = {
    Pop: "linear-gradient(135deg, #00d4aa 0%, #0072FF 100%)",
    Rock: "linear-gradient(135deg, #232526 0%, #414345 100%)",
    EDM: "linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)",
    "Hip Hop": "linear-gradient(135deg, #00b38f 0%, #162a44 100%)",
    "K-Pop": "linear-gradient(135deg, #00f5c4 0%, #0072FF 100%)",
  };

  return map[name] || "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)";
}

window.renderGenres = renderGenres;
window.renderSongsByGenre = renderSongsByGenre;
window.initGenreFilters = initGenreFilters;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGenreFilters, {
    once: true,
  });
}
