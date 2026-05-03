// content.js — auto-injects a download panel on GitHub repo pages.
// Runs after utils.js (listed first in manifest content_scripts).
(function () {
  "use strict";

  // ── Styles (defined first — used when building shadow DOM) ────────────
  const PANEL_CSS = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .panel {
      width: 320px;
      background: #fff;
      border: 1px solid #e6e3dc;
      border-radius: 14px;
      box-shadow: 0 4px 18px rgba(20,22,28,.1), 0 18px 50px rgba(20,22,28,.07);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #1a1d23;
      overflow: hidden;
    }

    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 11px 16px;
      border-bottom: 1px solid #e6e3dc;
      background: #f6f5f1;
    }
    .brand { font-weight: 700; font-size: 12.5px; letter-spacing: -0.01em; color: #1a1d23; }
    .close-btn {
      background: none; border: none; cursor: pointer;
      color: #8a8e98; font-size: 13px; padding: 2px 5px;
      border-radius: 4px; line-height: 1;
    }
    .close-btn:hover { background: #e6e3dc; color: #1a1d23; }

    .body { padding: 13px 15px; display: flex; flex-direction: column; gap: 10px; }

    .loading { display: flex; align-items: center; gap: 9px; color: #8a8e98; font-size: 12.5px; padding: 4px 0; }
    .spinner {
      width: 13px; height: 13px; flex-shrink: 0;
      border: 1.5px solid #e6e3dc; border-top-color: #3a5a7c;
      border-radius: 50%; animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .repo-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .repo-name { font-size: 12px; color: #4a4e57; font-family: 'Consolas', 'Courier New', monospace; }
    .home-tag {
      font-size: 9px;
      background: #fff9db;
      color: #856404;
      border: 1px solid #ffeeba;
      padding: 1px 5px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin-left: 2px;
      font-weight: 600;
    }
    .rating {
      display: inline-flex; align-items: center;
      padding: 2px 8px; border-radius: 999px;
      font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em;
    }
    .rating.simple            { background: #e8f4ec; color: #2d6a3a; }
    .rating.technical         { background: #fdf6ee; color: #7a4a1e; }
    .rating.highly-technical  { background: #fdf1f0; color: #8b2020; }
    .rating-detail { font-size: 11.5px; color: #8a8e98; }

    .section-label {
      font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.07em; color: #8a8e98; font-weight: 600;
    }
    .divider { height: 1px; background: #e6e3dc; }

    .assets { display: flex; flex-direction: column; gap: 5px; }
    .asset {
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px; padding: 8px 10px;
      background: #fff; border: 1px solid #e6e3dc;
      border-radius: 8px; cursor: pointer; width: 100%; text-align: left;
      transition: border-color .12s, background .12s;
    }
    .asset.match { border-color: #3a5a7c; background: #e8eef5; }
    .asset:hover { border-color: #3a5a7c; background: #e8eef5; }
    .asset-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .asset-icon {
      width: 24px; height: 24px; flex-shrink: 0;
      background: #f0ede5; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; color: #4a4e57;
      font-family: 'Consolas', 'Courier New', monospace;
    }
    .asset.match .asset-icon { background: #d4e4f3; }
    .asset-lbl {
      font-size: 12.5px; font-weight: 500; color: #1a1d23;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .asset-right { display: flex; align-items: center; gap: 7px; flex-shrink: 0; }
    .asset-size { font-size: 10.5px; color: #8a8e98; font-family: 'Consolas', 'Courier New', monospace; }
    .dl-btn {
      background: #3a5a7c; color: #fff; border: none;
      padding: 3px 8px; border-radius: 5px; font-size: 11px; cursor: pointer;
    }

    .expand-btn {
      background: none; border: 1px solid #e6e3dc;
      border-radius: 7px; padding: 7px 12px;
      font-size: 12px; color: #4a4e57; cursor: pointer; width: 100%;
      text-align: center; transition: background .12s;
    }
    .expand-btn:hover { background: #f6f5f1; }

    #rg-others { display: flex; flex-direction: column; gap: 5px; }

    .gh-link {
      display: flex; align-items: center; justify-content: center;
      font-size: 11.5px; color: #8a8e98; text-decoration: none;
    }
    .gh-link:hover { color: #3a5a7c; }

    .error-msg { font-size: 12.5px; color: #b04a3e; line-height: 1.5; }
  `;

  // ── Guard: only run on /owner/repo pages ──────────────────────────────
  const RESERVED = new Set([
    "explore",
    "settings",
    "login",
    "logout",
    "notifications",
    "issues",
    "marketplace",
    "sponsors",
    "orgs",
    "about",
    "pricing",
    "security",
    "topics",
    "collections",
    "trending",
    "new",
    "codespaces",
    "discussions",
    "features",
    "enterprise",
    "contact",
    "team",
  ]);
  const parts = location.pathname.replace(/^\//, "").split("/").filter(Boolean);
  if (parts.length < 2 || RESERVED.has(parts[0])) return;

  const [owner, repo] = parts;
  const SESSION_KEY = `rg-dismissed:${owner}/${repo}`;
  if (sessionStorage.getItem(SESSION_KEY)) return;
  if (document.getElementById("rg-host")) return;

  const USER_OS = detectOS(); // from utils.js

  // ── Build shadow DOM ───────────────────────────────────────────────────
  const host = document.createElement("div");
  host.id = "rg-host";
  Object.assign(host.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
  });
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = PANEL_CSS;
  shadow.appendChild(styleEl);

  const panel = document.createElement("div");
  panel.className = "panel";
  shadow.appendChild(panel);

  // ── Event delegation ───────────────────────────────────────────────────
  shadow.addEventListener("click", (e) => {
    if (e.target.closest(".close-btn")) {
      sessionStorage.setItem(SESSION_KEY, "1");
      host.remove();
      return;
    }
    const assetBtn = e.target.closest(".asset");
    if (assetBtn && assetBtn.dataset.dl) {
      window.location.href = assetBtn.dataset.dl;
      return;
    }
    const dlBtn = e.target.closest(".dl-btn");
    if (dlBtn) {
      const asset = dlBtn.closest(".asset");
      if (asset && asset.dataset.dl) window.location.href = asset.dataset.dl;
      return;
    }
    if (e.target.id === "rg-expand") {
      const others = shadow.getElementById("rg-others");
      if (!others) return;
      const hidden = others.style.display === "none";
      others.style.display = hidden ? "flex" : "none";
      e.target.textContent = hidden ? "▲ Show less" : e.target.dataset.label;
    }
  });

  // ── Loading state ──────────────────────────────────────────────────────
  panel.innerHTML = `
    <div class="header">
      <span class="brand">↓ GitHub Download Button</span>
      <button class="close-btn" title="Dismiss">✕</button>
    </div>
    <div class="body">
      <div class="loading">
        <div class="spinner"></div>
        <span>Finding your download button…</span>
      </div>
    </div>`;

  // ── Fetch & render ─────────────────────────────────────────────────────
  fetchRepo(owner, repo) // from utils.js
    .then(({ repoJson, releases, appRating, readmeDownloads }) => {
      const fullName = repoJson.full_name.toLowerCase();
      const isHome = fullName === "orunto/github-download-button";

      if (isHome) {
        appRating = {
          tier: "simple",
          label: "Simple",
          detail: "Home Sweet Home",
        };
      }

      const enriched = enrichReleases(releases, repoJson.full_name);
      const rating = appRating || computeRating(enriched);
      const latest = enriched[0];

      if (!latest) {
        renderNoReleases(repoJson, rating, readmeDownloads || []);
        return;
      }

      const sorted = [...latest.assets].sort(
        (a, b) => (a.os === USER_OS ? -1 : 0) - (b.os === USER_OS ? -1 : 0),
      );
      const matched = sorted.filter((a) => a.os === USER_OS);
      const others = sorted.filter((a) => a.os !== USER_OS);
      const primary = matched.length > 0 ? matched : sorted.slice(0, 3);
      const othersLabel = `▼ ${others.length} more download${others.length !== 1 ? "s" : ""}`;

      panel.innerHTML = `
        <div class="header">
          <span class="brand">↓ GitHub Download Button</span>
          <button class="close-btn" title="Dismiss">✕</button>
        </div>
        <div class="body">
          <div class="repo-line">
            <span class="repo-name">${owner}/${repo} ${isHome ? '<span class="home-tag">🏠 Home Sweet Home</span>' : ""}</span>
            <span class="rating ${rating.tier}">${rating.tier === "simple" ? "✓" : rating.tier === "highly-technical" ? "⚠" : "⚙"} ${rating.label}</span>
          </div>
          <div class="rating-detail">${rating.detail}</div>
          <div class="divider"></div>
          <div class="section-label">Downloads${matched.length > 0 && USER_OS ? ` · ${USER_OS}` : ""}</div>
          <div class="assets">
            ${primary.map((a) => assetRow(a, a.os === USER_OS)).join("")}
          </div>
          ${
            matched.length > 0 && others.length > 0
              ? `
            <button class="expand-btn" id="rg-expand" data-label="${othersLabel}">${othersLabel}</button>
            <div id="rg-others" style="display:none;flex-direction:column;gap:5px;">
              ${others.map((a) => assetRow(a, false)).join("")}
            </div>
          `
              : ""
          }
          <div class="divider"></div>
          <a href="https://github.com/${owner}/${repo}/releases" target="_blank" class="gh-link">
            View all releases on GitHub →
          </a>
        </div>`;
    })
    .catch((err) => {
      let msg = "Couldn't connect — is the Repo Grab server running?";
      if (err && err.kind === "notfound") {
        msg = "Repository not found or private. Check the URL.";
      } else if (err && err.kind === "private") {
        msg =
          "This repository is private. Repo Grab only works with public repos.";
      } else if (err && err.kind === "ratelimit") {
        msg = "GitHub rate limit hit. Try again in a minute.";
      }
      panel.innerHTML = `
        <div class="header">
          <span class="brand">↓ GitHub Download Button</span>
          <button class="close-btn" title="Dismiss">✕</button>
        </div>
        <div class="body">
          <div class="error-msg">${msg}</div>
        </div>`;
    });
  // ── Helpers ────────────────────────────────────────────────────────────
  function renderNoReleases(repoJson, rating, readmeDownloads) {
    const srcUrl = `https://github.com/${repoJson.full_name}/archive/refs/heads/${repoJson.default_branch || "main"}.zip`;
    const ratingTier = rating.tier;
    const ratingIcon = ratingTier === "simple" ? "✓" : ratingTier === "highly-technical" ? "⚠" : "⚙";
    const readmeDlRows = (readmeDownloads || []).map((d) => {
      const icon = OS_ICON[d.os] || "↓";
      const isMatch = d.os === USER_OS;
      return `
        <button class="asset${isMatch ? " match" : ""}" data-dl="${d.url}">
          <div class="asset-left">
            <span class="asset-icon">${icon}</span>
            <span class="asset-lbl">${d.label}</span>
          </div>
          <span class="dl-btn">↓</span>
        </button>`;
    });
    panel.innerHTML = `
      <div class="header">
        <span class="brand">↓ GitHub Download Button</span>
        <button class="close-btn" title="Dismiss">✕</button>
      </div>
      <div class="body">
        <div class="repo-line">
          <span class="repo-name">${repoJson.full_name}</span>
          <span class="rating ${ratingTier}">${ratingIcon} ${rating.label}</span>
        </div>
        <div class="rating-detail">${rating.detail}</div>
        <div class="divider"></div>
        ${readmeDlRows.length > 0 ? `
        <div class="section-label">Downloads · from README</div>
        <div class="assets">${readmeDlRows.join("")}</div>
        <div class="divider"></div>
        <div class="section-label">Source</div>
        ` : `<div class="section-label">Downloads</div>`}
        <div class="assets">
          <button class="asset" data-dl="${srcUrl}">
            <div class="asset-left">
              <span class="asset-icon">{ }</span>
              <span class="asset-lbl">Source code (.zip)</span>
            </div>
            <span class="dl-btn">↓</span>
          </button>
        </div>
      </div>`;
  }

  function assetRow(asset, isMatch) {
    const icon = OS_ICON[asset.os] || "↓"; // OS_ICON from utils.js
    return `
      <button class="asset${isMatch ? " match" : ""}" data-dl="${asset.downloadUrl}">
        <div class="asset-left">
          <span class="asset-icon">${icon}</span>
          <span class="asset-lbl">${asset.label}</span>
        </div>
        <div class="asset-right">
          ${asset.size !== "—" ? `<span class="asset-size">${asset.size}</span>` : ""}
          <span class="dl-btn">↓</span>
        </div>
      </button>`;
  }
})();
