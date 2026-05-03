// Serves client/dist and exposes GET /api/repo?owner=&repo=

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

// Debug logger for API requests
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.get("Origin") || "No Origin"}`,
    );
  }
  next();
});

app.use(express.static(path.join(__dirname, "client/dist")));

// ── Plain-text summary extracted from markdown ────────────────────────────
function extractSummary(md, maxChars = 300) {
  if (!md) return null;
  let text = md.replace(/```[\s\S]*?```/g, "");
  const prose = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || /^#/.test(line) || /^!\[/.test(line) || /^\[!\[/.test(line))
      continue;
    if (
      /^<!--/.test(line) ||
      /^</.test(line) ||
      /^[-*]{3,}$/.test(line) ||
      /^\|/.test(line)
    )
      continue;
    if (line.length < 20) continue;
    const clean = line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/~~(.+?)~~/g, "$1")
      .trim();
    if (clean.length < 20) continue;
    prose.push(clean);
    if (prose.join(" ").length >= maxChars) break;
  }
  const full = prose.join(" ");
  if (!full) return null;
  return full.length > maxChars
    ? full.slice(0, maxChars).replace(/\s+\S*$/, "") + "…"
    : full;
}

// ── GitHub fetch helper ───────────────────────────────────────────────────
async function ghFetch(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-download-button/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return fetch(url, { headers });
}

// ── README-based app complexity analysis ──────────────────────────────────

function splitSections(text) {
  const sections = [];
  let heading = "";
  let buf = [];
  for (const line of text.split("\n")) {
    const m = /^#{1,3}\s+(.+)$/.exec(line);
    if (m) {
      if (buf.length || heading)
        sections.push({ heading, content: buf.join("\n") });
      heading = m[1];
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (buf.length || heading)
    sections.push({ heading, content: buf.join("\n") });
  return sections.length ? sections : [{ heading: "", content: text }];
}

function extractCodeBlocks(text) {
  const out = [];
  let m;
  const fenced = /```[^\n]*\n?([\s\S]*?)```/g;
  while ((m = fenced.exec(text)) !== null) out.push(m[1].toLowerCase());
  const inline = /`([^`\n]+)`/g;
  while ((m = inline.exec(text)) !== null) out.push(m[1].toLowerCase());
  return out;
}

function stripMarkdown(text) {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]+`/g, " ");
}

/**
 * Determines how easy the software is to install and run for a non-technical user.
 * @returns {{ tier: 'simple'|'technical'|'highly-technical', label: string, detail: string, signals: string[] }}
 */
function analyzeReadmeComplexity(readmeText, assetNames = []) {
  const sc = { simple: 0, technical: 0, ht: 0 };
  const signals = [];

  function bump(tier, n, signal) {
    sc[tier] += n;
    signals.push(signal);
  }

  const lc = assetNames.map((n) => String(n).toLowerCase());

  const hasInstaller = lc.some(
    (n) =>
      n.endsWith(".exe") ||
      n.endsWith(".msi") ||
      n.endsWith(".dmg") ||
      n.endsWith(".pkg") ||
      n.endsWith(".deb") ||
      n.endsWith(".rpm") ||
      n.endsWith(".appimage"),
  );
  const hasJar = lc.some((n) => n.endsWith(".jar"));
  const hasOnlyArchives =
    lc.length > 0 &&
    !hasInstaller &&
    !hasJar &&
    lc.every(
      (n) =>
        n.endsWith(".zip") ||
        n.endsWith(".tar.gz") ||
        n.endsWith(".tgz") ||
        n.endsWith(".tar.xz") ||
        n.endsWith(".tar.bz2") ||
        n.includes("source code"),
    );

  if (hasInstaller)
    bump("simple", 10, "native platform installer (.exe/.dmg/.deb etc.)");
  if (hasJar) bump("technical", 5, ".jar release (needs Java runtime)");
  if (hasOnlyArchives)
    bump("technical", 3, "only archive files, no platform installer");
  if (lc.length === 0) bump("ht", 6, "no release assets published");

  if (readmeText) {
    const sections = splitSections(readmeText);
    const fullProse = stripMarkdown(readmeText).toLowerCase();

    const htTypes = [
      [
        /\b(this is a|a) (library|package|module|sdk|framework)\b/,
        "described as a library/package/SDK",
        10,
      ],
      [
        /\bcommand[- ]line (tool|utility|interface|app)\b/,
        "command-line tool",
        9,
      ],
      [/\bcli (tool|utility|app|application)\b/, "CLI tool", 9],
      [
        /\brest api\b|\bgraphql api\b|\bweb api\b|\bhttp api\b/,
        "API / web service",
        7,
      ],
      [/\b(telegram|discord|slack|matrix) bot\b/, "messaging bot", 8],
      [/\bheader[- ]only\b/, "header-only library (C++)", 10],
      [/\bautomation script\b/, "automation script", 6],
      [
        /\b(npm|pip|gem|cargo|go get) (install|add)\b/,
        "distributed as a package-manager install",
        7,
      ],
    ];
    for (const [p, s, w] of htTypes) if (p.test(fullProse)) bump("ht", w, s);

    const simpleTypes = [
      [/\bdesktop (app|application)\b/, "described as a desktop app", 4],
      [
        /\bgui (app|application|tool|program)\b|\bgraphical (user )?interface\b/,
        "GUI application",
        4,
      ],
    ];
    for (const [p, s, w] of simpleTypes)
      if (p.test(fullProse)) bump("simple", w, s);

    const stacks = [
      ["simple", /\belectron\b/, "Electron app", 4],
      ["simple", /\btauri\b/, "Tauri app", 4],
      [
        "simple",
        /\bwpf\b|\bwinforms\b|\bwinui\b|\bmaui\b/,
        ".NET GUI (WPF/WinForms/MAUI)",
        4,
      ],
      [
        "simple",
        /\bswiftui\b|\bnsapp\b|\bappkit\b/,
        "native macOS/iOS framework",
        4,
      ],
      [
        "simple",
        /\bqwidget\b|\bqmainwindow\b|\bqt (gui|widget)\b/,
        "Qt GUI widgets",
        3,
      ],
      [
        "simple",
        /\bflutter.{0,60}(desktop|windows|macos|linux)/,
        "Flutter desktop",
        4,
      ],
      ["technical", /\bjavafx\b|\bjavax\.swing\b/, "Java GUI (needs JRE)", 4],
      [
        "technical",
        /\btkinter\b|\bpyqt[456]?\b|\bpyside[26]?\b|\bwxpython\b|\bkivy\b/,
        "Python GUI (needs Python)",
        5,
      ],
      [
        "ht",
        /\bexpress(\.js)?\b|\bfastify\b|\bkoa\b|\bnestjs\b/,
        "Node.js server framework",
        5,
      ],
      [
        "ht",
        /\bflask\b|\bdjango\b|\bfastapi\b|\buvicorn\b/,
        "Python web framework",
        5,
      ],
      ["ht", /\bspring boot\b|\bspring mvc\b/, "Spring Boot server", 5],
    ];
    for (const [tier, p, s, w] of stacks)
      if (p.test(fullProse)) bump(tier, w, s);

    const DEV_SECTION =
      /\b(build(ing)?|compil(e|ing)|develop(ment|ing)?|contribut(e|ing)|from[ -]source|debug(ging)?|test(ing)?|ci|docker(file)?)\b/i;
    const USER_SECTION =
      /\b(install(ation)?|get(ting)? started|quick[- ]start|usage|running|run|setup|download|how to (use|run)|prerequisite|requirement)\b/i;

    for (const { heading, content } of sections) {
      if (DEV_SECTION.test(heading)) continue;

      const isUser = !heading || USER_SECTION.test(heading);
      const wt = isUser ? 1.0 : 0.5;

      const code = extractCodeBlocks(content);
      const htCmds = [
        [
          /\bnpm (start|run dev|run start|run serve|run prod)\b/,
          "npm start/run",
          8,
        ],
        [/\byarn (start|dev|serve)\b/, "yarn start/dev", 7],
        [/\bpython3?\s+\S+\.py\b/, "python <script>.py", 8],
        [/\bpython3?\s+-m\s+\S+/, "python -m <module>", 8],
        [/\bnode\s+\S+\.(?:js|mjs|cjs)\b/, "node <script>", 8],
        [/\bcargo run\b/, "cargo run", 8],
        [/\bgo run\s+[./]/, "go run", 8],
        [
          /\bbash\s+\S+\.sh\b|^\.\/.+\.sh$|sh \S+\.sh\b/,
          "bash/shell script",
          7,
        ],
        [/\bmake (run|start|serve|launch)\b/, "make run/start", 6],
        [
          /\bdocker(-compose)? (run|up)\b|docker compose (run|up)\b/,
          "docker run/up",
          6,
        ],
        [/\buvicorn\b|\bgunicorn\b/, "ASGI/WSGI server", 7],
      ];
      const techCmds = [[/\bjava -jar\b/, "java -jar (needs JRE)", 5]];

      for (const blk of code) {
        for (const [p, s, w] of htCmds)
          if (p.test(blk)) bump("ht", Math.round(w * wt), s);
        for (const [p, s, w] of techCmds)
          if (p.test(blk)) bump("technical", Math.round(w * wt), s);
      }

      if (isUser) {
        const prose = stripMarkdown(content).toLowerCase();

        const simpleUse = [
          [/double[- ]click/, "double-click instruction", 10],
          [
            /download and (run|open|launch|execute)/,
            "download-and-run instruction",
            8,
          ],
          [
            /drag.{0,20}to.{0,20}application/,
            "drag to Applications (macOS)",
            8,
          ],
          [
            /no (installation|setup|configuration) (required|needed)/,
            "no installation required",
            8,
          ],
          [/\bportable\b/, "portable app", 5],
          [/run the installer|open the installer/, "run-the-installer", 7],
          [/click (next|install|finish)/, "click-through installer", 6],
          [
            /standalone (app|application|executable|binary)/,
            "standalone binary",
            6,
          ],
          [/works out of the box/, "works out of the box", 5],
        ];
        for (const [p, s, w] of simpleUse)
          if (p.test(prose)) bump("simple", w, s);

        const htPrereqs = [
          [
            /requires? python\b|needs? python\b|python [23]\.\d+\s+(?:or\s+)?(?:higher|above|required)/,
            "requires Python runtime",
            7,
          ],
          [
            /requires? node\.?js|needs? node\.?js/,
            "requires Node.js runtime",
            6,
          ],
          [/requires? go\b|go \d+\.\d+\s*\+/, "requires Go runtime", 6],
          [/requires? rust\b|needs? rust\b/, "requires Rust runtime", 6],
          [
            /pip install\b|\brequirements\.txt/,
            "pip install / requirements.txt",
            5,
          ],
          [
            /\bnpm install\s*$|\byarn install\s*$/,
            "npm/yarn install required",
            4,
          ],
        ];
        const techPrereqs = [
          [
            /requires? java\b|requires? jre\b|requires? jdk\b/,
            "requires Java runtime",
            4,
          ],
        ];
        for (const [p, s, w] of htPrereqs) if (p.test(prose)) bump("ht", w, s);
        for (const [p, s, w] of techPrereqs)
          if (p.test(prose)) bump("technical", w, s);
      }
    }
  }

  const { simple, technical, ht } = sc;

  if (hasInstaller && ht < 8) {
    return {
      tier: "simple",
      label: "Simple",
      detail: "Download and run. No setup needed.",
      signals,
    };
  }
  if (ht > simple && ht > technical) {
    return {
      tier: "highly-technical",
      label: "Highly Technical",
      detail: "Requires a terminal to run. Built for developers.",
      signals,
    };
  }
  if (simple > technical) {
    return {
      tier: "simple",
      label: "Simple",
      detail: "Download and run. No setup needed.",
      signals,
    };
  }
  if (technical > 0 || simple > 0) {
    return {
      tier: "technical",
      label: "Technical",
      detail: "Has releases but may need extra setup to run.",
      signals,
    };
  }
  return {
    tier: "highly-technical",
    label: "Highly Technical",
    detail: "No prebuilt installer found. Likely requires a developer.",
    signals,
  };
}

// ── README binary download link extraction ────────────────────────────────

/**
 * Extracts binary download links from a README.
 * Catches two cases:
 *  1. Any markdown link whose URL ends in a known binary extension.
 *  2. Platform-named links (Windows / Mac / Linux) that sit under a
 *     heading that looks like a downloads / binaries section.
 * Returns [{ label, url, os }]
 */
function extractReadmeDownloads(readmeText, owner, repo, defaultBranch) {
  if (!readmeText) return [];

  const results = [];
  const seen = new Set();
  const BINARY_EXTS = [".exe", ".msi", ".dmg", ".pkg", ".deb", ".rpm", ".appimage"];
  const DOWNLOAD_HEADING =
    /\b(download|binary|binaries|install(er|ation)?|release|prebuilt|pre-built|get)\b/i;
  const PLATFORM_NAME = /^(windows|win|mac|macos|linux|ubuntu|debian|fedora)$/i;
  const branch = defaultBranch || "master";

  // Resolve a README link href to a direct download URL.
  // Handles: absolute external URLs, GitHub blob URLs, and relative repo paths.
  function resolveUrl(href) {
    if (!href) return null;

    // GitHub blob URL → raw download URL
    const blobMatch = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(href);
    if (blobMatch) {
      return `https://github.com/${blobMatch[1]}/${blobMatch[2]}/raw/${blobMatch[3]}`;
    }

    // Already a raw or external URL
    if (href.startsWith("http")) return href;

    // Relative path within the repo → raw download URL
    const clean = href.replace(/^\.\//, "");
    return `https://github.com/${owner}/${repo}/raw/${branch}/${clean}`;
  }

  let inDownloadSection = false;

  for (const line of readmeText.split("\n")) {
    const headingMatch = /^#{1,4}\s+(.+)$/.exec(line);
    if (headingMatch) {
      inDownloadSection = DOWNLOAD_HEADING.test(headingMatch[1]);
      continue;
    }

    const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
    let m;
    while ((m = linkRe.exec(line)) !== null) {
      const text = m[1].trim();
      const rawHref = m[2].trim();
      if (seen.has(rawHref)) continue;

      const href = rawHref.toLowerCase();
      const t = text.toLowerCase();

      const isBinaryUrl = BINARY_EXTS.some((ext) => href.endsWith(ext));
      const isPlatformLink = PLATFORM_NAME.test(t);

      if (!isBinaryUrl && !(inDownloadSection && isPlatformLink)) continue;

      const resolvedUrl = resolveUrl(rawHref);
      if (!resolvedUrl) continue;

      seen.add(rawHref);

      const u = resolvedUrl.toLowerCase();
      let os = "generic";
      if (/windows|win32|win64|\.exe$|\.msi$/.test(u) || /\b(windows|win)\b/.test(t))
        os = "windows";
      else if (/macos|osx|darwin|\.dmg$|\.pkg$/.test(u) || /\b(mac|macos)\b/.test(t))
        os = "mac";
      else if (/linux|\.deb$|\.rpm$|\.appimage$/.test(u) || /\blinux\b/.test(t))
        os = "linux";

      const osLabel =
        os === "windows" ? "Windows" : os === "mac" ? "macOS" : os === "linux" ? "Linux" : null;

      results.push({ label: osLabel || text, url: resolvedUrl, os });
    }
  }

  return results;
}

// ── Main API endpoint ─────────────────────────────────────────────────────
app.get("/api/repo", async (req, res) => {
  const { owner, repo } = req.query;
  console.log(`[api/repo] ${owner}/${repo}`);

  if (!owner || !repo) {
    return res
      .status(400)
      .json({ kind: "invalid", message: "Missing owner or repo" });
  }

  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    return res
      .status(400)
      .json({ kind: "invalid", message: "Invalid owner or repo name" });
  }

  try {
    const [repoRes, releasesRes, readmeRes] = await Promise.all([
      ghFetch(`https://api.github.com/repos/${owner}/${repo}`),
      ghFetch(
        `https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`,
      ),
      ghFetch(`https://api.github.com/repos/${owner}/${repo}/readme`),
    ]);

    if (repoRes.status === 404)
      return res.status(404).json({ kind: "notfound" });
    if (repoRes.status === 403 || repoRes.status === 429)
      return res.status(429).json({ kind: "ratelimit" });
    if (!repoRes.ok)
      return res.status(502).json({ kind: "error", status: repoRes.status });

    const repoJson = await repoRes.json();
    if (repoJson.private) return res.status(403).json({ kind: "private" });

    if (releasesRes.status === 403 || releasesRes.status === 429)
      return res.status(429).json({ kind: "ratelimit" });

    let releases = [];
    if (releasesRes.ok) {
      const all = await releasesRes.json();
      releases = all.filter((r) => !r.draft);
    } else {
      console.warn(
        `[api/repo] releases fetch failed: ${releasesRes.status} for ${owner}/${repo}`,
      );
    }

    let readmeText = null;
    if (readmeRes.ok) {
      const readmeJson = await readmeRes.json();
      try {
        readmeText = Buffer.from(
          readmeJson.content.replace(/\n/g, ""),
          "base64",
        ).toString("utf-8");
      } catch {
        // ignore decode failures
      }
    }

    const readmeSummary = extractSummary(readmeText);
    const assetNames = releases.flatMap((r) =>
      (r.assets || []).map((a) => a.name),
    );

    const readmeDownloads = releases.length === 0
      ? extractReadmeDownloads(readmeText, owner, repo, repoJson.default_branch)
      : [];

    // When there are no GitHub releases but the README links to binary files,
    // treat those filenames as pseudo-asset-names so the rating reflects that
    // actual installers exist.
    const effectiveAssetNames =
      readmeDownloads.length > 0
        ? [...assetNames, ...readmeDownloads.map((d) => d.url)]
        : assetNames;

    const appRating = analyzeReadmeComplexity(readmeText, effectiveAssetNames);
    console.log(
      `[api/repo] rating=${appRating.tier} signals=[${appRating.signals.join(", ")}]`,
    );

    return res.json({ repoJson, releases, readmeSummary, appRating, readmeDownloads });
  } catch (err) {
    console.error("[api/repo]", err);
    return res
      .status(500)
      .json({ kind: "error", message: "Internal server error" });
  }
});

// SPA catch-all — serve index.html for any non-API route
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "client/dist/index.html"));
});

app.listen(PORT, () => {
  console.log(`GitHub Download Button running at http://localhost:${PORT}`);
  if (!process.env.GITHUB_TOKEN) {
    console.warn(
      "[warn] GITHUB_TOKEN not set — GitHub rate limit is 60 req/hr",
    );
  }
});
