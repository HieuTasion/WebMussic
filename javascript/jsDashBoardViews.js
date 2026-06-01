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
            <span class="badge bg-teal mb-3 text-dark">THƯ VIỆN RIÊNG</span>
            <h1 class="display-5 fw-bold mb-2 text-white">Nhạc yêu thích</h1>
            <p class="lead mb-0 text-secondary">Tất cả bài hát bạn đã bấm tim sẽ nằm ở đây.</p>
          </div>
          <div class="col-lg-4 text-lg-end mt-4 mt-lg-0">
            <div class="text-white fs-1 fw-bold">${favorites.length}</div>
            <div class="text-secondary">Bài hát đã lưu</div>
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
                        <span class="me-3 fw-bold text-danger">${String(index + 1).padStart(2, "0")}</span>
                        <img src="${song.Img}" class="rounded me-3" style="width:50px;height:50px;object-fit:cover" onerror="this.src='https://picsum.photos/50/50'">
                        <div>
                          <p class="mb-0 fw-bold" style="font-size: 1.2rem; text-shadow: 0 2px 4px rgba(0,0,0,0.5);" onclick="event.stopPropagation(); window.openSongDetail(window.__favoriteSongsQueue[${index}])">${repairMojibake(song.Name)}</p>
                          <small style="color: rgba(255,255,255,0.8) !important;">${repairMojibake(song.Artist)}</small>
                        </div>
                      </div>
                      <button class="btn btn-link text-danger p-0" onclick="event.stopPropagation(); toggleFavoriteSongByKey('${escapeJsString(song.Url)}', '${escapeJsString(song.Name)}', '${escapeJsString(song.Artist)}', '${escapeJsString(song.Img)}')">
                        <i class="bi bi-heart-fill"></i>
                      </button>
                    </div>
                  `,
                )
                .join("")
            : '<div class="text-secondary">Chưa có bài hát nào trong danh sách yêu thích.</div>'
        }
      </div>
    </div>
  `;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildForYouInsights(library, favorites, recent) {
  const interacted = [...favorites, ...recent];
  const genreWeights = new Map();
  const artistWeights = new Map();
  const seenKeys = new Set(interacted.map((song) => normalizeSongKey(song)));

  interacted.forEach((song, index) => {
    const boost = index < favorites.length ? 3 : 2;
    const genre = normalizeGenre(song?.Genre || "");
    const artist = repairMojibake(song?.Artist || "").trim();

    if (genre) {
      genreWeights.set(genre, (genreWeights.get(genre) || 0) + boost);
    }

    if (artist) {
      artistWeights.set(artist, (artistWeights.get(artist) || 0) + boost);
    }
  });

  const topGenre =
    [...genreWeights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Pop";
  const topArtist =
    [...artistWeights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "Nghệ sĩ gợi ý";

  const scored = library
    .map((song) => {
      const genre = normalizeGenre(song?.Genre || "");
      const artist = repairMojibake(song?.Artist || "").trim();
      const key = normalizeSongKey(song);
      let score = 0;

      if (genreWeights.has(genre)) score += genreWeights.get(genre) * 10;
      if (artistWeights.has(artist)) score += artistWeights.get(artist) * 12;
      if (!seenKeys.has(key)) score += 8;
      score += Math.min(Number(song?.Likes || 0) / 50, 25);
      score += Math.min(Number(song?.Count || 0) / 120, 25);

      return { song, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.song);

  const mainPicks = scored.slice(0, 6);
  const genreMix = scored
    .filter((song) => normalizeGenre(song?.Genre || "") === topGenre)
    .slice(0, 2);
  const artistMix = scored
    .filter((song) => repairMojibake(song?.Artist || "").trim() === topArtist)
    .slice(0, 2);

  return {
    topGenre,
    topArtist,
    mainPicks,
    mixes: [
      {
        title: `Mix ${topGenre} cho bạn`,
        description:
          "Những bài cùng mood và dễ vào tai nhất từ gu nghe hiện tại.",
        songs: genreMix.length ? genreMix : mainPicks.slice(0, 2),
      },
      {
        title: `Giữ nhịp cùng ${topArtist}`,
        description: "Một cụm bài theo nghệ sĩ bạn có xu hướng quay lại nhiều.",
        songs: artistMix.length ? artistMix : mainPicks.slice(2, 4),
      },
    ],
  };
}

function renderForYouSongCards(songs, queueName) {
  if (!songs.length) {
    return `
      <div class="for-you-empty">
        Mở thêm vài bài hát, thích vài bài nữa rồi quay lại đây, gợi ý sẽ đầy đặn và hợp gu hơn.
      </div>
    `;
  }

  window[queueName] = songs;

  return songs
    .map(
      (song, index) => `
        <article class="for-you-song-card">
          <img class="for-you-song-cover" src="${escapeHtml(song.Img || "https://picsum.photos/240/240")}" alt="${escapeHtml(song.Name || "Bai hat")}" />
          <div>
            <h3>${escapeHtml(repairMojibake(song.Name || "Chưa có tên"))}</h3>
            <p class="for-you-meta">${escapeHtml(repairMojibake(song.Artist || "Đang cập nhật nghệ sĩ"))}</p>
            <p class="for-you-meta">${escapeHtml(normalizeGenre(song.Genre || "Khác"))} • ${escapeHtml(song.Times || "Đang cập nhật")}</p>
          </div>
          <div class="for-you-song-actions">
            <button class="for-you-btn primary" type="button" onclick="playThisSong('${escapeJsString(song.Url)}', '${escapeJsString(song.Name)}', '${escapeJsString(song.Artist)}', '${escapeJsString(song.Img)}', window.${queueName}, ${index})">
              <i class="bi bi-play-fill"></i> Phát
            </button>
            <button class="for-you-btn" type="button" onclick="window.openSongDetail(window.${queueName}[${index}])">
              Chi tiết
            </button>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderForYouMixCards(mixes) {
  return mixes
    .map((mix, index) => {
      const firstSong = mix.songs[0];
      const secondSong = mix.songs[1] || mix.songs[0];
      const queueName = `__forYouMixQueue${index}`;
      window[queueName] = mix.songs;

      if (!firstSong) {
        return `<div class="for-you-empty">Chưa đủ dữ liệu để tạo mix này.</div>`;
      }

      return `
        <article class="for-you-mix-card">
          <img class="for-you-mix-cover" src="${escapeHtml(firstSong.Img || "https://picsum.photos/220/220")}" alt="${escapeHtml(firstSong.Name || "Mix")}">
          <div>
            <h3>${escapeHtml(mix.title)}</h3>
            <p class="for-you-meta">${escapeHtml(mix.description)}</p>
            <p class="for-you-meta">${escapeHtml(repairMojibake(firstSong.Name || ""))}${secondSong ? ` • ${escapeHtml(repairMojibake(secondSong.Name || ""))}` : ""}</p>
            <div class="for-you-song-actions">
              <button class="for-you-btn primary" type="button" onclick="playThisSong('${escapeJsString(firstSong.Url)}', '${escapeJsString(firstSong.Name)}', '${escapeJsString(firstSong.Artist)}', '${escapeJsString(firstSong.Img)}', window.${queueName}, 0)">
                <i class="bi bi-play-circle-fill"></i> Bắt đầu mix
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function initForYouPage() {
  const contentArea = document.getElementById("main-content");
  if (!contentArea) return;

  contentArea.dataset.view = "for-you";
  contentArea.classList.remove("page-genre", "page-player", "page-lyrics");
  contentArea.classList.add("page-home");

  const library = await getAllSongs();
  const favorites = loadFavoriteSongs();
  const recent = loadRecentlyPlayedSongs();
  const insights = buildForYouInsights(library, favorites, recent);

  const topGenre = document.getElementById("for-you-top-genre");
  const topArtist = document.getElementById("for-you-top-artist");
  const count = document.getElementById("for-you-count");
  const note = document.getElementById("for-you-note");
  const title = document.getElementById("for-you-title");
  const desc = document.getElementById("for-you-description");
  const mainGrid = document.getElementById("for-you-main-grid");
  const mixGrid = document.getElementById("for-you-mix-grid");

  if (topGenre) topGenre.textContent = insights.topGenre;
  if (topArtist) topArtist.textContent = insights.topArtist;
  if (count) count.textContent = String(insights.mainPicks.length);

  if (title) {
    title.textContent =
      favorites.length || recent.length
        ? `Hôm nay nghe thử vài bài hợp gu ${insights.topGenre.toLowerCase()} của bạn`
        : "Chưa có dữ liệu cá nhân? Đây là mix để bắt đầu";
  }

  if (desc) {
    desc.textContent =
      favorites.length || recent.length
        ? "Những gợi ý này được lấy từ bài bạn đã lưu, đã nghe và từ gu thể loại xuất hiện nhiều nhất."
        : "Bạn chưa nghe nhiều nên mình tạm gợi ý các bài dễ vào tai và dễ bắt đầu xây gu.";
  }

  if (note) {
    note.textContent =
      favorites.length || recent.length
        ? `Thể loại nổi lên nhiều nhất hiện tại là ${insights.topGenre}, nên mình đẩy ưu tiên những bài cùng mood.`
        : "Thêm bài vào yêu thích hoặc nghe thêm để trang này cá nhân hóa mạnh hơn.";
  }

  if (mainGrid) {
    mainGrid.innerHTML = renderForYouSongCards(
      insights.mainPicks,
      "__forYouMainQueue",
    );
  }

  if (mixGrid) {
    mixGrid.innerHTML = renderForYouMixCards(insights.mixes);
  }

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
          <span class="recent-badge">THƯ VIỆN CỦA BẠN</span>
          <h1>Nghe gần đây</h1>
          <p>Danh sách bài hát bạn vừa nghe, tập trung vào track và sắp xếp từ mới nhất đến cũ hơn.</p>
        </div>
        <div class="recent-hero-meta">
          <div class="recent-count">${recentlyPlayed.length}</div>
          <div class="recent-count-label">Bài hát đã ghi nhớ</div>
          <div class="recent-last-song">${
            latestSong
              ? `Gần nhất: <strong>${latestSong.Name}</strong>`
              : "Chưa có bài hát nào được phát"
          }</div>
        </div>
      </section>

      <section class="recent-list-shell">
        <div class="recent-list-header">
          <div>Bài hát</div>
          <div>Nghe lúc</div>
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
                            <h3 class="fw-bold" style="font-size: 1.25rem; margin-bottom: 4px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);" onclick="event.stopPropagation(); window.openSongDetail(window.__recentlyPlayedQueue[${index}])">${repairMojibake(song.Name)}</h3>
                            <p class="mb-0" style="color: rgba(255,255,255,0.8) !important;">${repairMojibake(song.Artist || "Đang cập nhật nghệ sĩ")}</p>
                          </div>
                        </div>
                        <div class="recent-song-meta">
                          <span class="recent-played-time">${formatPlayedTime(song.LastPlayedAt)}</span>
                          <button class="recent-play-btn" onclick="event.stopPropagation(); window.openSongDetail(window.__recentlyPlayedQueue[${index}])">
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
                  <h3>Chưa có bài hát nào</h3>
                  <p>Mở một bài hát bất kỳ, lịch sử nghe gần đây sẽ hiển thị ở đây.</p>
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
  if (contentArea && contentArea.innerText.includes("Nhạc yêu thích")) {
    renderFavoritesPage();
  }
};

window.openAlbum = function (id) {
  localStorage.setItem("selectedAlbumId", id);
  loadPage("player-page.html");
};

window.loadPage = function (pageUrl) {
  const contentArea = document.getElementById("main-content");
  if (!contentArea) return;

  if (
    (pageUrl === "recently-played" || pageUrl === "favorites") &&
    !requireLoggedInAccess()
  ) {
    return;
  }

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
        throw new Error("Không tìm thấy trang: " + pageUrl);
      }
      return response.text();
    })
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      doc.querySelectorAll("script").forEach((script) => script.remove());

      doc
        .querySelectorAll("audio, #musicPlayerBar, .music-player-bar")
        .forEach((el) => el.remove());

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
        initDashboardSongSearch();
      }

      if (normalizedPage === "ForYou.html") {
        contentArea.classList.add("page-home");
        initForYouPage();
      }

      if (normalizedPage === "SongDetail.html") {
        initSongDetailPage();
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
      contentArea.innerHTML = `<div class="p-4 text-danger">Lỗi hệ thống: ${error.message}</div>`;
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
    console.error("Lỗi trượt:", error);
  }
}

async function initPlayerPage() {
  const albumId = localStorage.getItem("selectedAlbumId");
  if (!albumId) {
    alert("Không tìm thấy album!");
    loadPage("Home.html");
    return;
  }

  try {
    await getAllSongs();

    const resAlbum = await fetch("albums.json");
    const albums = await resAlbum.json();
    const album = albums.find((item) => String(item.id) === String(albumId));

    if (!album) {
      alert("Album không tồn tại!");
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
          Không tìm thấy bài hát nào khớp với album này trong API.
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
              <p class="song-title" onclick="event.stopPropagation(); window.openSongDetailFromQueue('album', ${index})">${song.Name}</p>
              <p class="song-artist">${song.Artist}</p>
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
    alert("Lỗi tải dữ liệu!");
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

function initSongDetailPage() {
  const songRaw = localStorage.getItem("selectedSongDetail");
  if (!songRaw) return;
  const song = JSON.parse(songRaw);

  const img = document.getElementById("detail-song-img");
  const name = document.getElementById("detail-song-name");
  const artist = document.getElementById("detail-song-artist");
  const playBtn = document.getElementById("detail-play-main");
  const likeBtn = document.getElementById("detail-like-main");

  if (img) img.src = song.Img || "https://picsum.photos/600/600";
  if (name) name.innerText = repairMojibake(song.Name);
  if (artist) artist.innerText = repairMojibake(song.Artist);

  if (playBtn) {
    playBtn.onclick = () => {
      playThisSong(song.Url, song.Name, song.Artist, song.Img, [song], 0);
    };
  }

  if (likeBtn) {
    const updateLikeUI = () => {
      const isFav = window.isSongFavorite(song);
      likeBtn.innerHTML = isFav
        ? '<i class="bi bi-heart-fill"></i>'
        : '<i class="bi bi-heart"></i>';
      likeBtn.classList.toggle("active", isFav);
    };
    updateLikeUI();

    likeBtn.onclick = () => {
      const existingIndex = getFavoriteSongIndex(song);
      if (existingIndex !== -1) favoriteSongs.splice(existingIndex, 1);
      else favoriteSongs.unshift({ ...song });
      saveFavoriteSongs();
      updateLikeUI();
      if (
        currentSongMeta &&
        normalizeSongKey(currentSongMeta) === normalizeSongKey(song)
      ) {
        setFavoriteButtonState(currentSongMeta);
      }
    };
  }
}
