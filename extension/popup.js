// popup.js — extension popup logic. Runs after utils.js.
const app = document.getElementById("app");
const USER_OS = detectOS(); // from utils.js

// ── Render helpers ─────────────────────────────────────────────────────────
function setApp(html) {
  app.innerHTML = html;
}

function shell(bodyHtml, owner, repo) {
  return `
    <div class="header">
      <div class="brand-mark">↓</div>
      <span class="brand-name">Repo Grab</span>
      ${owner ? `<span class="brand-tag">${owner}/${repo}</span>` : '<span class="brand-tag">extension</span>'}
    </div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">
      <span>github-download-button</span>
      ${owner ? `<a href="https://github.com/${owner}/${repo}/releases" target="_blank">releases on github →</a>` : ""}
    </div>`;
}

function renderLoading(owner, repo) {
  setApp(
    shell(
      `
    <div class="loading">
      <div class="spinner"></div>
      <span>Finding your download button…</span>
    </div>`,
      owner,
      repo,
    ),
  );
}

function renderSearch(msg) {
  setApp(
    shell(
      `
    <div class="search-wrap">
      ${msg ? `<div class="error-msg">${msg}</div>` : '<div class="search-label">Enter a GitHub repo URL or owner/repo:</div>'}
      <div class="search-row">
        <input id="rg-input" class="search-input" type="text" placeholder="owner/repo or full URL" spellcheck="false" />
        <button id="rg-go" class="search-btn">Fetch →</button>
      </div>
    </div>`,
      null,
      null,
    ),
  );

  const input = document.getElementById("rg-input");
  const go = document.getElementById("rg-go");

  function submit() {
    const raw = input.value.trim();
    if (!raw) return;
    const parsed = parseGithubInput(raw);
    if (!parsed) {
      renderSearch("Invalid URL! Try owner/repo or a full GitHub URL.");
      return;
    }
    renderLoading(parsed.owner, parsed.repo);
    doFetch(parsed.owner, parsed.repo);
  }

  go.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
  input.focus();
}

function renderResult(owner, repo, data) {
  let { repoJson, releases, appRating, readmeDownloads } = data;
  const fullName = repoJson.full_name.toLowerCase();
  const isHome = fullName === "orunto/github-download-button";

  if (isHome) {
    appRating = {
      tier: "simple",
      label: "Simple",
      detail: "Home Sweet Home",
    };
  }

  const enriched = enrichReleases(releases, repoJson.full_name); // utils.js
  const rating = appRating || computeRating(enriched); // utils.js
  const latest = enriched[0];

  if (!latest) {
    renderNoReleases(owner, repo, repoJson, rating, readmeDownloads || []);
    return;
  }

  const sorted = [...latest.assets].sort(
    (a, b) => (a.os === USER_OS ? -1 : 0) - (b.os === USER_OS ? -1 : 0),
  );
  const matched = sorted.filter((a) => a.os === USER_OS);
  const others = sorted.filter((a) => a.os !== USER_OS);
  const primary = matched.length > 0 ? matched : sorted.slice(0, 4);
  const othersLabel = `▼ ${others.length} more download${others.length !== 1 ? "s" : ""}`;

  setApp(
    shell(
      `
    <div class="repo-line">
      <span class="repo-name">${owner}/${repo} ${isHome ? '<span class="home-tag">🏠 Home Sweet Home</span>' : ""}</span>
      <span class="rating ${rating.tier}">${rating.tier === "simple" ? "✓" : rating.tier === "highly-technical" ? "⚠" : "⚙"} ${rating.label}</span>
    </div>
    <div class="rating-detail">${rating.detail}</div>
    <div class="divider"></div>
    <div class="section-label">Downloads${matched.length > 0 && USER_OS ? ` · ${USER_OS}` : ""}</div>
    <div class="assets" id="rg-primary">
      ${primary.map((a) => assetHTML(a, a.os === USER_OS)).join("")}
    </div>
    ${
      matched.length > 0 && others.length > 0
        ? `
      <button class="expand-btn" id="rg-expand">${othersLabel}</button>
      <div class="others" id="rg-others" style="display:none;">
        ${others.map((a) => assetHTML(a, false)).join("")}
      </div>
    `
        : ""
    }
    <div class="divider"></div>
    <a href="https://github.com/${owner}/${repo}/releases" target="_blank" class="gh-link">
      View all releases on GitHub →
    </a>`,
      owner,
      repo,
    ),
  );

  // Wire download clicks
  document.querySelectorAll(".asset[data-dl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      chrome.tabs.create({ url: btn.dataset.dl });
    });
  });

  // Wire expand toggle
  const expandBtn = document.getElementById("rg-expand");
  const othersEl = document.getElementById("rg-others");
  if (expandBtn && othersEl) {
    expandBtn.addEventListener("click", () => {
      const hidden = othersEl.style.display === "none";
      othersEl.style.display = hidden ? "flex" : "none";
      expandBtn.textContent = hidden ? "▲ Show less" : othersLabel;
    });
  }
}

function renderNoReleases(owner, repo, repoJson, rating, readmeDownloads) {
  const srcUrl = `https://github.com/${repoJson.full_name}/archive/refs/heads/${repoJson.default_branch || "main"}.zip`;
  const ratingTier = rating.tier;
  const ratingIcon = ratingTier === "simple" ? "✓" : ratingTier === "highly-technical" ? "⚠" : "⚙";
  const rdl = readmeDownloads || [];
  const readmeDlRows = rdl.map((d) =>
    assetHTML({ name: d.label, label: d.label, os: d.os, size: "—", downloadUrl: d.url }, d.os === USER_OS),
  );
  setApp(
    shell(
      `
    <div class="repo-line">
      <span class="repo-name">${owner}/${repo}</span>
      <span class="rating ${ratingTier}">${ratingIcon} ${rating.label}</span>
    </div>
    <div class="rating-detail">${rating.detail}</div>
    <div class="divider"></div>
    ${rdl.length > 0 ? `
    <div class="section-label">Downloads · from README</div>
    <div class="assets" id="rg-readme-dls">${readmeDlRows.join("")}</div>
    <div class="divider"></div>
    <div class="section-label">Source</div>
    ` : `<div class="section-label">Downloads</div>`}
    <div class="assets">
      ${assetHTML({ name: "Source code (zip)", label: "Source code (.zip)", os: "source", size: "—", downloadUrl: srcUrl }, false)}
    </div>`,
      owner,
      repo,
    ),
  );

  document.querySelectorAll(".asset[data-dl]").forEach((btn) => {
    btn.addEventListener("click", () =>
      chrome.tabs.create({ url: btn.dataset.dl }),
    );
  });
}

function renderError(owner, repo) {
  setApp(
    shell(
      `
    <div class="error-msg">Couldn't connect to the Repo Grab server.<br>
    Make sure it's running at <code style="font-size:11px;">${RG_BACKEND}</code>.</div>
    <button class="search-btn" id="rg-retry" style="margin-top:4px;width:100%;border-radius:8px;padding:9px;">
      Try again
    </button>`,
      owner,
      repo,
    ),
  );
  document.getElementById("rg-retry")?.addEventListener("click", () => {
    renderLoading(owner, repo);
    doFetch(owner, repo);
  });
}

function assetHTML(asset, isMatch) {
  const icon = OS_ICON[asset.os] || "↓"; // OS_ICON from utils.js
  return `
    <button class="asset${isMatch ? " match" : ""}" data-dl="${asset.downloadUrl}">
      <div class="asset-left">
        <span class="asset-icon">${icon}</span>
        <div class="asset-info">
          <div class="asset-lbl">
            ${asset.label}
            ${isMatch ? '<span class="your-os-tag">your os</span>' : ""}
          </div>
          <div class="asset-filename">${asset.name}</div>
        </div>
      </div>
      <div class="asset-right">
        ${asset.size !== "—" ? `<span class="asset-size">${asset.size}</span>` : ""}
        <span class="dl-badge">Download</span>
      </div>
    </button>`;
}

// ── Utilities ──────────────────────────────────────────────────────────────
function parseGithubInput(raw) {
  const cleaned = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
  const m = cleaned.match(/^([\w.-]+)\/([\w.-]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

function doFetch(owner, repo) {
  fetchRepo(owner, repo) // from utils.js
    .then((data) => renderResult(owner, repo, data))
    .catch((err) => {
      let msg = `Couldn't connect to the Repo Grab server.<br>
      Make sure it's running at <code style="font-size:11px;">${RG_BACKEND}</code>.`;

      if (err && err.kind === "notfound") {
        msg = "Repository not found or private. Double-check the URL.";
      } else if (err && err.kind === "private") {
        msg =
          "This repository is private. Repo Grab only works with public repos.";
      } else if (err && err.kind === "ratelimit") {
        msg = "GitHub rate limit hit. Try again in a minute.";
      }

      setApp(
        shell(
          `
        <div class="error-msg">${msg}</div>
        <button class="search-btn" id="rg-retry" style="margin-top:4px;width:100%;border-radius:8px;padding:9px;">
          Try again
        </button>`,
          owner,
          repo,
        ),
      );

      document.getElementById("rg-retry")?.addEventListener("click", () => {
        renderLoading(owner, repo);
        doFetch(owner, repo);
      });
    });
}

// ── Entry point ────────────────────────────────────────────────────────────
(async () => {
  let owner = null,
    repo = null;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.url) {
      const url = new URL(tab.url);
      if (url.hostname === "github.com") {
        const parts = url.pathname
          .replace(/^\//, "")
          .split("/")
          .filter(Boolean);
        if (parts.length >= 2) {
          [owner, repo] = parts;
        }
      }
    }
  } catch {}

  if (owner && repo) {
    renderLoading(owner, repo);
    doFetch(owner, repo);
  } else {
    renderSearch(null);
  }
})();
