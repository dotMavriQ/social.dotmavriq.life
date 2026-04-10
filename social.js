// ── Theme ──
var html = document.documentElement;
var themeToggle = document.getElementById("theme-toggle");
var STORAGE_KEY = "social-theme";
var saved = localStorage.getItem(STORAGE_KEY);
if (saved === "dark") html.setAttribute("data-theme", "dark");
else if (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches) {
  html.setAttribute("data-theme", "dark");
}
if (themeToggle) {
  themeToggle.addEventListener("click", function() {
    var isDark = html.getAttribute("data-theme") === "dark";
    var next = isDark ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
  });
}

// ── Cloud Marquee ──
var TILE = [
  "|:::|=======|:::|_______|:::|=======|:::|_______|:::|=======|:::|_______|:::|=======|:::|_______|:::|",
  "|   |       |   |       |   |       |   |       |   |       |   |       |   |       |   |       |   |",
  "|___|_______|___|_______|___|_______|___|_______|___|_______|___|_______|___|_______|___|_______|___|",
].join("\n");

(function initMarquee() {
  var border = document.querySelector(".nav-cloud-border");
  var track = document.getElementById("cloud-track");
  if (!border || !track) return;

  var SPEED = 22;
  var tileW = 0, offset = 0, lastTs = null, raf = null;

  var probe = document.createElement("pre");
  probe.style.cssText = "position:fixed;top:-9999px;white-space:pre;font-family:jgs,ui-monospace,monospace;font-size:18px;line-height:18px;padding:0;";
  probe.textContent = TILE;
  document.body.appendChild(probe);
  tileW = probe.getBoundingClientRect().width;
  document.body.removeChild(probe);

  function buildTrack() {
    if (raf) cancelAnimationFrame(raf);
    track.innerHTML = "";
    var count = Math.ceil(border.clientWidth / tileW) + 2;
    for (var i = 0; i < count; i++) {
      var pre = document.createElement("pre");
      pre.className = "cloud-art";
      pre.textContent = TILE;
      track.appendChild(pre);
    }
    offset = 0;
    lastTs = null;
    raf = requestAnimationFrame(tick);
  }

  function tick(ts) {
    if (lastTs === null) lastTs = ts;
    var dt = Math.min(ts - lastTs, 50) / 1000;
    lastTs = ts;
    offset -= SPEED * dt;
    if (offset <= -tileW) offset += tileW;
    track.style.transform = "translateX(" + offset + "px)";
    raf = requestAnimationFrame(tick);
  }

  new ResizeObserver(function() { buildTrack(); }).observe(border);
  buildTrack();
})();

// ── Feed ──
var API = "/api/v1/timelines/public";
var LIMIT = 20;
var maxId = null;
var loading = false;

var feedEl = document.getElementById("feed");
var loadMoreEl = document.getElementById("load-more");
var loadMoreBtn = document.getElementById("load-more-btn");

function formatDate(iso) {
  var d = new Date(iso);
  var months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}

function escAttr(s) {
  return s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// Global gallery registry: flat list of all images across all posts
var galleryImages = [];
// Map from image index to post index for skip-to-next-post
var galleryPostMap = [];
var postCount = 0;

function renderPost(post) {
  var div = document.createElement("article");
  div.className = "post";
  var thisPost = postCount++;

  var date = formatDate(post.created_at);
  var postUrl = post.url || post.uri;

  var mediaHtml = "";
  if (post.media_attachments && post.media_attachments.length > 0) {
    var count = Math.min(post.media_attachments.length, 4);
    var gridClass = "media-" + count;
    var items = post.media_attachments.slice(0, 4).map(function(m, idx) {
      var desc = m.description || "";
      var descAttr = desc ? escAttr(desc) : "attached image";
      if (m.type === "video" || m.type === "gifv") {
        return '<video src="' + escAttr(m.url) + '" controls muted playsinline' +
          (desc ? ' title="' + escAttr(desc) + '"' : '') +
          '></video>';
      }
      var gIdx = galleryImages.length;
      galleryImages.push({
        full: m.url,
        preview: m.preview_url || m.url,
        alt: desc,
        postIndex: thisPost
      });
      galleryPostMap.push(thisPost);
      return '<img src="' + escAttr(m.preview_url || m.url) + '" alt="' + descAttr +
        '" loading="lazy" data-gallery="' + gIdx + '">';
    }).join("");
    mediaHtml = '<div class="post-media ' + gridClass + '">' + items + '</div>';
  }

  div.innerHTML =
    '<div class="post-header">' +
      '<img class="post-avatar" src="' + escAttr(post.account.avatar) + '" alt="">' +
      '<div class="post-meta">' +
        '<span class="post-author">' + escAttr(post.account.display_name || post.account.acct) + '</span>' +
        '<span class="post-date"><a href="' + escAttr(postUrl) + '" target="_blank" rel="noopener">' + date + '</a></span>' +
      '</div>' +
    '</div>' +
    '<div class="post-content">' + post.content + '</div>' +
    mediaHtml;

  return div;
}

function loadPosts() {
  if (loading) return;
  loading = true;
  if (loadMoreBtn) loadMoreBtn.disabled = true;

  var url = API + "?local=true&limit=" + LIMIT;
  if (maxId) url += "&max_id=" + maxId;

  fetch(url).then(function(res) {
    if (!res.ok) throw new Error("API error " + res.status);
    return res.json();
  }).then(function(posts) {
    var filtered = posts.filter(function(p) {
      if (p.reblog) return false;
      if (p.in_reply_to_id) return false;
      // Filter out posts that start with a mention (directed conversations)
      var txt = p.content.replace(/^<p>/, "").trimStart();
      if (txt.match(/^<span class="h-card">/)) return false;
      return true;
    });

    if (posts.length === 0) {
      if (!maxId) feedEl.innerHTML = '<div class="empty">no posts yet.</div>';
      loadMoreEl.style.display = "none";
      loading = false;
      return;
    }

    if (!maxId) feedEl.innerHTML = "";

    filtered.forEach(function(post) {
      feedEl.appendChild(renderPost(post));
    });

    maxId = posts[posts.length - 1].id;

    if (posts.length >= LIMIT) {
      loadMoreEl.style.display = "block";
    } else {
      loadMoreEl.style.display = "none";
    }

    // If all posts were filtered out but there are more pages, auto-fetch next
    if (filtered.length === 0 && posts.length >= LIMIT) {
      loading = false;
      return loadPosts();
    }

    loading = false;
    if (loadMoreBtn) loadMoreBtn.disabled = false;
  }).catch(function(err) {
    if (!maxId) feedEl.innerHTML = '<div class="empty">could not load posts.</div>';
    console.error(err);
    loading = false;
    if (loadMoreBtn) loadMoreBtn.disabled = false;
  });
}

if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", loadPosts);
}

loadPosts();

// ── Follow Button ──
(function initFollow() {
  var PROFILE_URI = "https://social.dotmavriq.life/users/dotmavriq";
  var btn = document.getElementById("follow-btn");
  var overlay = document.getElementById("follow-overlay");
  var closeBtn = document.getElementById("follow-close");
  var input = document.getElementById("follow-handle");
  var submit = document.getElementById("follow-submit");
  var errorEl = document.getElementById("follow-error");

  if (!btn || !overlay) return;

  function open() {
    overlay.classList.add("open");
    input.value = "";
    errorEl.style.display = "none";
    setTimeout(function() { input.focus(); }, 50);
  }

  function close() {
    overlay.classList.remove("open");
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  function doFollow() {
    var handle = (input.value || "").trim();
    if (!handle) { showError("enter your fediverse handle"); return; }

    // Parse handle: accept user@instance or @user@instance
    var match = handle.match(/^@?([^@]+)@([^@/]+)$/);
    if (!match) { showError("format: user@instance.tld"); return; }

    var user = match[1];
    var instance = match[2];
    errorEl.style.display = "none";
    submit.textContent = "...";

    // Look up the remote instance's subscribe template via WebFinger
    var wfUrl = "https://" + instance + "/.well-known/webfinger?resource=acct:" +
      encodeURIComponent(user + "@" + instance);

    fetch(wfUrl).then(function(res) {
      if (!res.ok) throw new Error("instance not found");
      return res.json();
    }).then(function(data) {
      var template = null;
      var links = data.links || [];
      for (var i = 0; i < links.length; i++) {
        if (links[i].template && links[i].rel &&
            links[i].rel.indexOf("subscribe") !== -1) {
          template = links[i].template;
          break;
        }
      }

      if (template) {
        // OStatus subscribe template
        window.location.href = template.replace("{uri}", encodeURIComponent(PROFILE_URI));
      } else {
        // Fallback: try /authorize_interaction (Mastodon 3.x+)
        window.location.href = "https://" + instance +
          "/authorize_interaction?uri=" + encodeURIComponent(PROFILE_URI);
      }
    }).catch(function() {
      // Final fallback: try authorize_interaction anyway
      window.location.href = "https://" + instance +
        "/authorize_interaction?uri=" + encodeURIComponent(PROFILE_URI);
    }).finally(function() {
      submit.textContent = "go";
    });
  }

  btn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) close();
  });
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") doFollow();
  });
  submit.addEventListener("click", doFollow);
})();

// ── Lightbox ──
(function initLightbox() {
  var lightbox = document.getElementById("lightbox");
  var lbImg = document.getElementById("lb-img");
  var lbAlt = document.getElementById("lb-alt");
  var lbCounter = document.getElementById("lb-counter");
  var lbClose = document.getElementById("lb-close");
  var lbPrev = document.getElementById("lb-prev");
  var lbNext = document.getElementById("lb-next");
  var lbSkip = document.getElementById("lb-skip");
  var lbStage = document.getElementById("lb-stage");

  if (!lightbox || !lbImg) return;

  var currentIdx = -1;
  var touchStartX = 0;
  var touchStartY = 0;

  function show(idx) {
    if (idx < 0 || idx >= galleryImages.length) return;
    currentIdx = idx;
    var item = galleryImages[idx];

    lbImg.style.opacity = "0";
    lbImg.src = item.full;
    lbImg.alt = item.alt || "";
    lbImg.onload = function() { lbImg.style.opacity = "1"; };

    // Alt text
    lbAlt.textContent = item.alt || "";

    // Counter: find images in same post
    var postIdx = item.postIndex;
    var postImages = [];
    for (var i = 0; i < galleryImages.length; i++) {
      if (galleryImages[i].postIndex === postIdx) postImages.push(i);
    }
    var posInPost = postImages.indexOf(idx) + 1;
    lbCounter.textContent = posInPost + " / " + postImages.length;

    // Prev/next state
    lbPrev.disabled = (idx <= 0);
    lbNext.disabled = (idx >= galleryImages.length - 1);

    // Skip hint: show if next/prev post has images
    var skipText = "";
    if (idx >= galleryImages.length - 1 || galleryImages[idx + 1].postIndex !== postIdx) {
      // At end of this post's images - check if next post exists
      var nextPostStart = findNextPostStart(idx);
      if (nextPostStart >= 0) skipText = "shift + \u2192 next post";
    }
    if (idx <= 0 || galleryImages[idx - 1].postIndex !== postIdx) {
      var prevPostEnd = findPrevPostEnd(idx);
      if (prevPostEnd >= 0) {
        skipText = skipText ? "shift + \u2190/\u2192 skip post" : "shift + \u2190 prev post";
      }
    }
    lbSkip.textContent = skipText;

    // Preload adjacent
    if (idx + 1 < galleryImages.length) { new Image().src = galleryImages[idx + 1].full; }
    if (idx - 1 >= 0) { new Image().src = galleryImages[idx - 1].full; }

    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function hide() {
    lightbox.classList.remove("open");
    document.body.style.overflow = "";
    currentIdx = -1;
  }

  function prev() {
    if (currentIdx > 0) show(currentIdx - 1);
  }

  function next() {
    if (currentIdx < galleryImages.length - 1) show(currentIdx + 1);
  }

  function findNextPostStart(fromIdx) {
    var currentPost = galleryImages[fromIdx].postIndex;
    for (var i = fromIdx + 1; i < galleryImages.length; i++) {
      if (galleryImages[i].postIndex !== currentPost) return i;
    }
    return -1;
  }

  function findPrevPostEnd(fromIdx) {
    var currentPost = galleryImages[fromIdx].postIndex;
    for (var i = fromIdx - 1; i >= 0; i--) {
      if (galleryImages[i].postIndex !== currentPost) return i;
    }
    return -1;
  }

  function skipNextPost() {
    var target = findNextPostStart(currentIdx);
    if (target >= 0) show(target);
  }

  function skipPrevPost() {
    var target = findPrevPostEnd(currentIdx);
    if (target >= 0) {
      // Jump to first image of that post
      var postIdx = galleryImages[target].postIndex;
      for (var i = 0; i <= target; i++) {
        if (galleryImages[i].postIndex === postIdx) { show(i); return; }
      }
      show(target);
    }
  }

  // Click on feed images
  document.getElementById("feed").addEventListener("click", function(e) {
    var img = e.target.closest("img[data-gallery]");
    if (!img) return;
    e.preventDefault();
    var idx = parseInt(img.getAttribute("data-gallery"), 10);
    if (!isNaN(idx)) show(idx);
  });

  lbClose.addEventListener("click", hide);
  lbPrev.addEventListener("click", function(e) { e.stopPropagation(); prev(); });
  lbNext.addEventListener("click", function(e) { e.stopPropagation(); next(); });

  // Click on image itself does nothing (let prev/next zones handle it)
  lbImg.addEventListener("click", function(e) { e.stopPropagation(); });

  // Click on dark area outside image closes
  lbStage.addEventListener("click", function(e) {
    if (e.target === lbStage) hide();
  });

  // Keyboard
  document.addEventListener("keydown", function(e) {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape") { hide(); return; }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (e.shiftKey) skipPrevPost(); else prev();
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (e.shiftKey) skipNextPost(); else next();
    }
  });

  // Touch/swipe support
  lbStage.addEventListener("touchstart", function(e) {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  lbStage.addEventListener("touchend", function(e) {
    if (e.changedTouches.length === 1) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) next(); else prev();
      }
    }
  }, { passive: true });
})();

// ── ASCII Cityscape Backdrop ──
(function initCityscape() {
  var scene = document.getElementById("ascii-scene");
  var wrapper = scene ? scene.parentElement : null;
  if (!scene || !wrapper) return;

  var skyTile = [
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░/\\░░░░░░░░░░░░░/\\░░░░░░░░░░/\\░░░",
    "░░|  |░░░░░░░░░░░░||░░░░░░░░░░|.|░░",
    "__|__|____________||__________|_|__",
  ];
  var tile2 = [
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░_____░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░|     |░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░| . . |░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░| . . |░░░░░░░░░░░░___░░░░░░░░░░",
    "░░░|_____|░░░░░░░░░░░|   |░░░░░░░░░",
    "___|=|=|=|___________| . |_________",
    "   |=|=|=|           |   |         ",
    "___|=|=|=|___________|___|_________",
  ];
  var tile3 = [
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░_______░░░░░░░░░░░░░░░░░░░",
    "░░░░_░░░|       |░░░░░░░░_____░░░░░",
    "░░░|=|░░| .   . |░░░░░░░|     |░░░░",
    "░░░|=|░░|  ___  |░░░░░░░| . . |░░░░",
    "░░░|=|░░| |   | |░_░░░░░|_____|░░░░",
    "░░░|=|░░| |   | ||=|░░░░|=|=|=|░░░░",
    "░░░|=|░░|_|___|_||=|░░░░|=|=|=|░░░░",
    "___|=|__|=|=|=|=||=|____|=|=|=|____",
    "   |=|  |=|=|=|=||=|    |=|=|=|    ",
    "___|=|__|=|=|=|=||=|___.|=|=|=|____",
  ];
  var tile4 = [
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░░_░░░░░░░░░░░░",
    "░░░░░░░░░░░░░░░░░░░░░|=|░░░░░░░░░░░",
    "░░░_____░░░░░░░░░░░░░|=|░░░░░░░░░░░",
    "░░|     |░░░░░_░░░░░░|=|░░░░░░░░░░░",
    "░░| . . |░░░░|=|░░░░░|=|░░░░░░░░░░░",
    "░░|     |░░░░|=|░_░░░|=|░░░░░░░░░░░",
    "░░|_____|░░░░|=||=|░░|=|░░░░░░░░░░░",
    "__|=|=|=|____|=||=|__|=|_______/\\__",
    "  |=|=|=|    |=||=|  |=|       ||  ",
    "__|=|=|=|____|=||=|__|=|_______||__",
  ];

  var TILE_W = skyTile[0].length;
  var TILE_H = skyTile.length;
  var allTiles = [skyTile, tile2, tile3, tile4];

  var birds = [
    { x: 5, yFrac: 0.55, speed: 0.15, frames: ["~v~", "~^~"] },
    { x: 40, yFrac: 0.45, speed: 0.22, frames: ["-v-", "-^-"] },
    { x: 75, yFrac: 0.65, speed: 0.12, frames: ["~v~", "~^~"] },
    { x: 110, yFrac: 0.50, speed: 0.18, frames: ["-v-", "-^-"] },
  ];

  var cityCloudList = [
    { x: -25, yFrac: 0.08, speed: 0.04, art: [
      "    .-.   .-.",
      " .-'   '-'   '-.",
      "(                )",
      " '-._________.-'"
    ]},
    { x: 40, yFrac: 0.22, speed: 0.025, art: [
      "     .-.",
      "  .-'   '-.",
      " (         )",
      "  '-.___.-'"
    ]},
    { x: 95, yFrac: 0.12, speed: 0.035, art: [
      "   .-.    .-.",
      ".-'   '..'   '-.",
      "(                )",
      " '-.__________.-'"
    ]},
  ];

  var W = 80, H = TILE_H, cityFrame = 0, cityRaf = null;
  var charW = 0, charH = 0;

  function measure() {
    var probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:inherit;";
    probe.textContent = "░\n░";
    wrapper.appendChild(probe);
    var rect = probe.getBoundingClientRect();
    charW = rect.width;
    charH = rect.height / 2;
    wrapper.removeChild(probe);
    if (charW > 0) W = Math.floor(wrapper.clientWidth / charW);
    if (charH > 0 && wrapper.clientHeight > 0) {
      H = Math.max(TILE_H, Math.floor(wrapper.clientHeight / charH));
    } else {
      H = TILE_H;
    }
  }

  function buildRow(row, totalH, w) {
    var skyRows = totalH - TILE_H;
    var tileRow = row - skyRows;
    var out = [];
    for (var col = 0; col < w; col++) {
      if (tileRow < 0) {
        out.push("░");
      } else {
        var tileIndex = Math.floor(col / TILE_W);
        var src = allTiles[tileIndex % allTiles.length];
        var srcRow = tileRow < src.length ? src[tileRow] : null;
        if (srcRow) {
          out.push(srcRow[col % TILE_W] || "░");
        } else {
          out.push("░");
        }
      }
    }
    return out;
  }

  function render() {
    var buffer = [];
    var r;
    for (r = 0; r < H; r++) {
      buffer.push(buildRow(r, H, W));
    }

    var t = cityFrame;
    var skyRows = H - TILE_H;

    // Draw clouds
    for (var ci = 0; ci < cityCloudList.length; ci++) {
      var cloud = cityCloudList[ci];
      var cloudW = 0;
      for (var li = 0; li < cloud.art.length; li++) {
        if (cloud.art[li].length > cloudW) cloudW = cloud.art[li].length;
      }
      var baseY = Math.max(0, Math.floor(skyRows * cloud.yFrac));
      var cx = Math.floor((cloud.x + t * cloud.speed) % (W + cloudW + 30)) - cloudW;
      for (var line = 0; line < cloud.art.length; line++) {
        var cy = baseY + line;
        if (cy >= 0 && cy < skyRows && buffer[cy]) {
          var artLine = cloud.art[line];
          var first = -1, last = -1;
          for (var i = 0; i < artLine.length; i++) {
            if (artLine[i] !== " ") { if (first < 0) first = i; last = i; }
          }
          if (first < 0) continue;
          for (i = first; i <= last; i++) {
            var px = cx + i;
            if (px >= 0 && px < W) {
              buffer[cy][px] = artLine[i] !== " " ? artLine[i] : " ";
            }
          }
        }
      }
    }

    // Draw birds
    for (var bi = 0; bi < birds.length; bi++) {
      var bird = birds[bi];
      var by = skyRows > 2 ? Math.max(0, Math.min(skyRows - 1, Math.floor(skyRows * bird.yFrac))) : 0;
      if (by < H && buffer[by]) {
        var bx = Math.floor((bird.x + t * bird.speed) % (W + 10)) - 5;
        var bf = bird.frames[Math.floor(t / 8) % bird.frames.length];
        for (var j = 0; j < bf.length; j++) {
          var bpx = bx + j;
          if (bpx >= 0 && bpx < W && buffer[by][bpx] === "░") {
            buffer[by][bpx] = bf[j];
          }
        }
      }
    }

    scene.textContent = buffer.map(function(row) { return row.join(""); }).join("\n");
    cityFrame++;
    cityRaf = requestAnimationFrame(render);
  }

  function init() {
    measure();
    if (cityRaf) cancelAnimationFrame(cityRaf);
    cityFrame = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      var buf = [];
      for (var r = 0; r < H; r++) buf.push(buildRow(r, H, W));
      scene.textContent = buf.map(function(row) { return row.join(""); }).join("\n");
    } else {
      cityRaf = requestAnimationFrame(render);
    }
  }

  new ResizeObserver(function() { measure(); }).observe(wrapper);
  init();
})();
