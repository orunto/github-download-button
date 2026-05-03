// utils.js — shared utilities for content.js and popup.js
// Update RG_BACKEND to your deployed backend URL when in production.
const RG_BACKEND = "http://localhost:3000";

// const RG_BACKEND = "https://githubdownloadbutton.orunto.dev";

const OS_ICON = {
  windows: "⊞",
  mac: "",
  linux: "🐧",
  source: "{ }",
  generic: "↓",
};

function detectOS() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Linux/i.test(ua)) return "linux";
  return null;
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function labelAsset(name) {
  const n = name.toLowerCase();
  if (n.endsWith(".exe") || n.includes("setup") || n.includes("installer"))
    return { label: "Windows installer", os: "windows" };
  if (n.endsWith(".msi")) return { label: "Windows MSI", os: "windows" };
  if (n.endsWith(".dmg")) return { label: "macOS disk image", os: "mac" };
  if (n.endsWith(".pkg")) return { label: "macOS package", os: "mac" };
  if (n.endsWith(".deb"))
    return { label: "Linux (Debian/Ubuntu)", os: "linux" };
  if (n.endsWith(".rpm")) return { label: "Linux (Fedora/RHEL)", os: "linux" };
  if (n.endsWith(".appimage")) return { label: "Linux AppImage", os: "linux" };

  const isWindows =
    /[.\-_](win(dows)?|win(32|64))[.\-_]/.test(n) || n.includes("windows");
  const isMac =
    /[.\-_](osx|macos|darwin)[.\-_]/.test(n) ||
    n.includes("darwin") ||
    n.includes("macos");
  const isLinux = /[.\-_]linux[.\-_]/.test(n) || n.includes("linux");

  const arch = /x64|amd64/.test(n)
    ? " (x64)"
    : /x86|i386|i686/.test(n)
      ? " (x86)"
      : /arm64|aarch64/.test(n)
        ? " (arm64)"
        : /arm/.test(n)
          ? " (arm)"
          : "";

  if (isWindows) return { label: `Windows${arch}`, os: "windows" };
  if (isMac) return { label: `macOS${arch}`, os: "mac" };
  if (isLinux) return { label: `Linux${arch}`, os: "linux" };

  if (n.endsWith(".zip")) return { label: "ZIP archive", os: "generic" };
  if (n.endsWith(".tar.gz") || n.endsWith(".tgz"))
    return { label: "TAR archive", os: "generic" };
  return { label: name, os: "generic" };
}

// Takes raw GitHub releases (as returned by the backend) and enriches them.
function enrichReleases(releases, repoFullName) {
  return (releases || []).map((r) => {
    const assets = (r.assets || []).map((a) => ({
      name: a.name,
      downloadUrl: a.browser_download_url,
      size: formatBytes(a.size),
      downloadCount: a.download_count,
      ...labelAsset(a.name),
    }));
    assets.push({
      name: "Source code (zip)",
      label: "Source code",
      os: "source",
      size: "—",
      downloadUrl: `https://github.com/${repoFullName}/archive/refs/tags/${r.tag_name}.zip`,
    });
    return {
      id: r.id,
      tag: r.tag_name,
      name: r.name || r.tag_name,
      prerelease: r.prerelease,
      assets,
    };
  });
}

// Asset-only fallback rating used when the backend appRating is not available.
function computeRating(enrichedReleases) {
  if (!enrichedReleases || enrichedReleases.length === 0)
    return {
      tier: "highly-technical",
      label: "Highly Technical",
      detail: "No releases. Developer setup required.",
    };
  const hasInstaller = enrichedReleases.some(
    (r) =>
      r.assets &&
      r.assets.some(
        (a) => a.os === "windows" || a.os === "mac" || a.os === "linux",
      ),
  );
  if (hasInstaller)
    return {
      tier: "simple",
      label: "Simple",
      detail: "Download and run. No setup needed.",
    };
  return {
    tier: "technical",
    label: "Technical",
    detail: "No platform installer. Some setup required.",
  };
}

async function fetchRepo(owner, repo) {
  const res = await fetch(
    `${RG_BACKEND}/api/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
  );
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}
