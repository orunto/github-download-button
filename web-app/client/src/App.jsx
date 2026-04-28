import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Icon from './icons.jsx';

// ── Detect user OS ─────────────────────────────────────────────────────────
function detectOS() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
  if (/Linux/i.test(ua)) return 'linux';
  return null;
}
const USER_OS = detectOS();

// ── Language color map (GitHub's standard palette) ─────────────────────────
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Java: '#b07219', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600',
  Ruby: '#701516', Go: '#00ADD8', Rust: '#dea584', PHP: '#4F5D95',
  Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB', Scala: '#c22d40',
  Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c', Vue: '#41b883',
  Markdown: '#5a8fbf', Lua: '#000080', R: '#198CE7', MATLAB: '#e16737',
};

// ── Example repos ──────────────────────────────────────────────────────────
const EXAMPLES = [
  'Tyrrrz/YoutubeDownloader',
  'vercel/next.js',
  'facebook/react',
];

// ── URL parsing ────────────────────────────────────────────────────────────
function parseRepoUrl(raw) {
  const v = (raw || '').trim();
  if (!v) return null;
  const cleaned = v
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');
  const m = cleaned.match(/^([\w.-]+)\/([\w.-]+)(?:\/(?:tree|blob)\/([^/]+))?/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], ref: m[3] };
}

// ── Format helpers ─────────────────────────────────────────────────────────
function formatSize(kb) {
  if (!kb) return '—';
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatStars(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Repo complexity rating (fallback when API doesn't return one) ───────────
function computeRating(releases) {
  if (!releases || releases.length === 0)
    return { tier: 'highly-technical', label: 'Highly Technical', detail: 'No releases. Developer setup required.' };
  const hasInstaller = releases.some(r =>
    r.assets && r.assets.some(a => a.os === 'windows' || a.os === 'mac' || a.os === 'linux')
  );
  if (hasInstaller)
    return { tier: 'simple',    label: 'Simple',    detail: 'Download and run. No setup needed.' };
  return   { tier: 'technical', label: 'Technical', detail: 'No platform installer. Some setup required.' };
}

function tierColor(tier) {
  if (tier === 'simple')           return 'var(--good)';
  if (tier === 'highly-technical') return 'var(--danger)';
  return 'var(--warn)';
}

function tierIcon(tier) {
  if (tier === 'simple')           return '✓';
  if (tier === 'highly-technical') return '⚠';
  return '⚙';
}

function tierBadgeStyle(tier) {
  if (tier === 'simple')           return { bg: '#edf7f0', border: '#b8dfc4' };
  if (tier === 'highly-technical') return { bg: '#fdf1f0', border: '#f0ccc9' };
  return { bg: '#fdf6ee', border: '#ecd9bd' };
}

// ── Guess a human label for an asset filename ──────────────────────────────
function labelAsset(name) {
  const n = name.toLowerCase();

  if (n.endsWith('.exe') || n.includes('setup') || n.includes('installer'))
    return { label: 'Windows installer', os: 'windows' };
  if (n.endsWith('.msi'))
    return { label: 'Windows MSI installer', os: 'windows' };
  if (n.endsWith('.dmg'))
    return { label: 'macOS disk image', os: 'mac' };
  if (n.endsWith('.pkg'))
    return { label: 'macOS package', os: 'mac' };
  if (n.endsWith('.deb'))
    return { label: 'Linux (Debian / Ubuntu)', os: 'linux' };
  if (n.endsWith('.rpm'))
    return { label: 'Linux (Fedora / RHEL)', os: 'linux' };
  if (n.endsWith('.appimage'))
    return { label: 'Linux AppImage', os: 'linux' };

  const isWindows = /[.\-_](win(dows)?|win(32|64))[.\-_]/.test(n) || n.includes('windows');
  const isMac     = /[.\-_](osx|macos|darwin)[.\-_]/.test(n) || n.includes('darwin') || n.includes('macos');
  const isLinux   = /[.\-_]linux[.\-_]/.test(n) || n.includes('linux');

  const arch = /x64|amd64/.test(n) ? ' (x64)'
             : /x86|i386|i686/.test(n) ? ' (x86)'
             : /arm64|aarch64/.test(n) ? ' (arm64)'
             : /arm/.test(n) ? ' (arm)'
             : '';

  if (isWindows) return { label: `Windows${arch}`, os: 'windows' };
  if (isMac)     return { label: `macOS${arch}`, os: 'mac' };
  if (isLinux)   return { label: `Linux${arch}`, os: 'linux' };

  if (n.endsWith('.zip'))                          return { label: 'ZIP archive', os: 'generic' };
  if (n.endsWith('.tar.gz') || n.endsWith('.tgz')) return { label: 'TAR archive', os: 'generic' };
  if (n === 'source code (zip)' || n === 'source code (tar.gz)')
    return { label: name, os: 'source' };
  return { label: name, os: 'generic' };
}

// ── API fetch ──────────────────────────────────────────────────────────────
async function fetchRepoData(owner, repo) {
  const res = await fetch(
    `/api/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ kind: 'error' }));
    throw err;
  }
  const data = await res.json();
  return { ...data, summaryIsAi: false };
}

// ── Loading steps ──────────────────────────────────────────────────────────
const LOADING_STEPS = ['Reaching github.com…', 'Reading repository details', 'Checking for releases', 'Preparing download options'];

// ── Toast hook ─────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);
  return [toast, show];
}

// ── Recent history hook ────────────────────────────────────────────────────
const STORAGE_KEY = 'repograb_recent';
function useRecent() {
  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const add = useCallback((slug) => {
    setRecent((prev) => {
      const next = [
        { url: slug, ago: 'just now', ts: Date.now() },
        ...prev.filter((x) => x.url !== slug),
      ].slice(0, 5);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  return [recent, add];
}

// ── Relative time ──────────────────────────────────────────────────────────
function relTime(ts) {
  if (!ts) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState('idle'); // idle | loading | loaded | error
  const [loadingStep, setLoadingStep] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [toast, showToast] = useToast();
  const [recent, addRecent] = useRecent();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const parsed = useMemo(() => parseRepoUrl(url), [url]);
  const canSubmit = parsed && stage !== 'loading';

  const handleSubmit = useCallback(async (e, urlOverride) => {
    if (e && e.preventDefault) e.preventDefault();
    const target = urlOverride != null ? urlOverride : url;
    const p = parseRepoUrl(target);
    if (!p) return;
    if (urlOverride != null) setUrl(urlOverride);

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStage('loading');
    setLoadingStep(0);
    setError(null);
    setData(null);

    const key = `${p.owner}/${p.repo}`;

    let stepI = 0;
    const stepTimer = setInterval(() => {
      stepI = Math.min(stepI + 1, LOADING_STEPS.length - 1);
      setLoadingStep(stepI);
    }, 500);

    try {
      const { repoJson, releases, readmeSummary, summaryIsAi, appRating } = await fetchRepoData(p.owner, p.repo);
      clearInterval(stepTimer);
      setLoadingStep(LOADING_STEPS.length - 1);

      const defaultBranch = repoJson.default_branch || 'main';
      const branch = p.ref || defaultBranch;

      const enrichedReleases = releases.map((r) => {
        const assets = r.assets.map((a) => ({
          id: a.id,
          name: a.name,
          size: formatBytes(a.size),
          downloadUrl: a.browser_download_url,
          downloadCount: a.download_count,
          ...labelAsset(a.name),
        }));
        assets.push(
          { name: 'Source code (zip)', label: 'Source code', os: 'source',
            size: '—', downloadUrl: `https://github.com/${repoJson.full_name}/archive/refs/tags/${r.tag_name}.zip`, downloadCount: null },
        );
        return {
          id: r.id,
          tag: r.tag_name,
          name: r.name || r.tag_name,
          prerelease: r.prerelease,
          publishedAt: r.published_at,
          body: r.body || '',
          assets,
          htmlUrl: r.html_url,
        };
      });

      setData({
        owner: repoJson.owner.login,
        repo: repoJson.name,
        description: repoJson.description || 'A public repository on GitHub.',
        language: repoJson.language || 'Mixed',
        langColor: LANG_COLORS[repoJson.language] || '#8a8e98',
        stars: formatStars(repoJson.stargazers_count),
        branch,
        size: formatSize(repoJson.size),
        topics: repoJson.topics || [],
        avatarUrl: repoJson.owner.avatar_url,
        readmeSummary,
        summaryIsAi,
        readmeUrl: `https://github.com/${repoJson.owner.login}/${repoJson.name}#readme`,
        sourceDownloadUrl: `https://github.com/${repoJson.owner.login}/${repoJson.name}/archive/refs/heads/${branch}.zip`,
        htmlUrl: repoJson.html_url,
        releases: enrichedReleases,
        rating: appRating || computeRating(enrichedReleases),
      });
      setStage('loaded');
      addRecent(key);
    } catch (err) {
      clearInterval(stepTimer);
      if (ctrl.signal.aborted) return;

      let msg = '';
      if (err.kind === 'notfound') {
        msg = `We couldn't find that repository. Double-check the URL; owners and names are case-sensitive.`;
      } else if (err.kind === 'private') {
        msg = `This repository is private. Repo Grab can only download public repositories.`;
      } else if (err.kind === 'ratelimit') {
        msg = `GitHub's rate limit was hit. Wait a minute and try again, or use a GitHub token.`;
      } else {
        msg = `Something went wrong fetching that repo. GitHub may be having issues. Try again in a moment.`;
      }
      setError({ kind: err.kind || 'error', message: msg });
      setStage('error');
    }
  }, [url, addRecent]);

  const handleReset = () => {
    if (abortRef.current) abortRef.current.abort();
    setStage('idle');
    setData(null);
    setError(null);
    setUrl('');
    setLoadingStep(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="page">
      <div className="grid-bg" />

      <header className="topbar">
        <div className="brand">
          <svg className="brand-mark" width="28" height="28" viewBox="0 0 1080 1080" fill="none" aria-hidden="true">
            <g clipPath="url(#brand-clip)">
              <path fillRule="evenodd" clipRule="evenodd" d="M540 28C257.12 28 28 257.12 28 540C28 766.56 174.56 957.92 378.08 1025.76C403.68 1030.24 413.28 1014.88 413.28 1001.44C413.28 989.28 412.64 948.96 412.64 906.08C284 929.76 250.72 874.72 240.48 845.92C234.72 831.2 209.76 785.76 188 773.6C170.08 764 144.48 740.32 187.36 739.68C227.68 739.04 256.48 776.8 266.08 792.16C312.16 869.6 385.76 847.84 415.2 834.4C419.68 801.12 433.12 778.72 447.84 765.92C333.92 753.12 214.88 708.96 214.88 513.12C214.88 457.44 234.72 411.36 267.36 375.52C262.24 362.72 244.32 310.24 272.48 239.84C272.48 239.84 315.36 226.4 413.28 292.32C454.24 280.8 497.76 275.04 541.28 275.04C584.8 275.04 628.32 280.8 669.28 292.32C767.2 225.76 810.08 239.84 810.08 239.84C838.24 310.24 820.32 362.72 815.2 375.52C847.84 411.36 867.68 456.8 867.68 513.12C867.68 709.6 748 753.12 634.08 765.92C652.64 781.92 668.64 812.64 668.64 860.64C668.64 929.12 668 984.16 668 1001.44C668 1014.88 677.6 1030.88 703.2 1025.76C905.44 957.92 1052 765.92 1052 540C1052 257.12 822.88 28 540 28Z" fill="#1B1F23"/>
              <path d="M977.681 732.375H933.625V593.833C933.625 578.594 921.156 566.125 905.917 566.125H795.083C779.844 566.125 767.375 578.594 767.375 593.833V732.375H723.319C698.658 732.375 686.19 762.3 703.646 779.756L830.827 906.938C841.633 917.744 859.09 917.744 869.896 906.938L997.077 779.756C1014.53 762.3 1002.34 732.375 977.681 732.375ZM656.542 1009.46C656.542 1024.7 669.01 1037.17 684.25 1037.17H1016.75C1031.99 1037.17 1044.46 1024.7 1044.46 1009.46C1044.46 994.219 1031.99 981.75 1016.75 981.75H684.25C669.01 981.75 656.542 994.219 656.542 1009.46Z" fill="#00FF6F"/>
            </g>
            <defs>
              <clipPath id="brand-clip">
                <rect width="1024" height="1024" fill="white" transform="translate(28 28)"/>
              </clipPath>
            </defs>
          </svg>
          <div>
            GitHub Download Button
            <div className="brand-meta">public beta</div>
          </div>
        </div>
        <div className="topbar-right">
          <button onClick={() => setShowHowItWorks(true)}>
            <Icon.Question />
            <span className="link-label">How it works</span>
          </button>
          <span className="status-pill">
            <span className="dot" />
            github api: ok
          </span>
        </div>
      </header>

      <main className="main">
        {stage === 'idle' && (
          <IdleView
            url={url}
            setUrl={setUrl}
            inputRef={inputRef}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
            recent={recent}
            onPickRecent={(u) => handleSubmit(null, u)}
            onPickExample={(ex) => handleSubmit(null, ex)}
          />
        )}

        {stage === 'loading' && (
          <LoadingView url={url} step={loadingStep} />
        )}

        {stage === 'loaded' && data && (
          <LoadedView
            data={data}
            onReset={handleReset}
            showToast={showToast}
          />
        )}

        {stage === 'error' && (
          <ErrorView
            url={url}
            setUrl={setUrl}
            inputRef={inputRef}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
            error={error}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="footer">
        <span>GitHub Download Button, for people who don't want to learn Git.</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          built on github's public api · no login required · by{' '}
          <a href="https://orunto.dev" target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 8 }}>
            <img src="/orunto.png" alt="" aria-hidden="true" style={{ width: 14, height: 14, objectFit: 'contain' }} />
            Orunto Eniola
          </a>
        </span>
      </footer>

      {showHowItWorks && (
        <HowItWorksModal onClose={() => setShowHowItWorks(false)} />
      )}

      {toast && (
        <div className="toast">
          <span className="tick">✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Idle / landing view ────────────────────────────────────────────────────
function IdleView({ url, setUrl, inputRef, canSubmit, onSubmit, recent, onPickRecent, onPickExample }) {
  return (
    <>
      <section className="hero fade-in">
        <div className="eyebrow">
          <Icon.Spark className="tick" />
          one paste · one click · zero git
        </div>
        <h1 className="headline">
          Paste a GitHub link.<br/>
          We hand you the <em>files</em>.
        </h1>
        <p className="subhead">
          Skip the <span className="mono">clone</span>, the <span className="mono">fork</span>, the{' '}
          <span className="mono">install gh</span>. Drop the URL below and we'll fetch what's
          inside. Plus the README, so you know what to do next.
        </p>
      </section>

      <form className="input-card" onSubmit={onSubmit}>
        <span className="input-prefix">
          <Icon.Github />
          <span>github.com /</span>
        </span>
        <input
          ref={inputRef}
          className="input-field mono"
          type="text"
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="owner/repo  or  full URL"
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
          Fetch <Icon.Arrow />
        </button>
      </form>

      <div className="hint-row">
        <span className="hint-text">
          <Icon.Info />
          <span>try one:</span>
        </span>
        <div className="examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="example-chip"
                    onClick={() => onPickExample(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="recent">
          <div className="recent-title">Recent</div>
          <div className="recent-list">
            {recent.map((r) => (
              <div key={r.url} className="recent-item" onClick={() => onPickRecent(r.url)}>
                <span>{r.url}</span>
                <span className="ago">
                  <Icon.Clock /> {r.ts ? relTime(r.ts) : r.ago}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Loading view ───────────────────────────────────────────────────────────
function LoadingView({ url, step }) {
  return (
    <>
      <section className="hero fade-in">
        <div className="eyebrow">
          <span className="mono">fetching {url}</span>
        </div>
        <h1 className="headline">Hold on. Looking at this repo…</h1>
      </section>

      <div className="loading-wrap fade-in">
        {LOADING_STEPS.map((label, i) => (
          <div
            key={i}
            className={`loading-step ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}
          >
            <span className="indicator" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Error view ─────────────────────────────────────────────────────────────
function ErrorView({ url, setUrl, inputRef, canSubmit, onSubmit, error, onReset }) {
  return (
    <>
      <section className="hero fade-in">
        <h1 className="headline">That didn't work.</h1>
        <p className="subhead">No worries. Try a different URL, or one of the examples below.</p>
      </section>

      <form className="input-card has-error" onSubmit={onSubmit}>
        <span className="input-prefix">
          <Icon.Github />
          <span>github.com /</span>
        </span>
        <input
          ref={inputRef}
          className="input-field mono"
          type="text"
          value={url}
          autoFocus
          onChange={(e) => setUrl(e.target.value)}
          placeholder="owner/repo  or  full URL"
          spellCheck={false}
        />
        <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
          Try again <Icon.Arrow />
        </button>
      </form>

      {error && (
        <div className="error-inline fade-in">
          <Icon.Alert />
          <div>{error.message}</div>
        </div>
      )}

      <div className="hint-row" style={{ marginTop: 18 }}>
        <span className="hint-text"><Icon.Info /><span>or try one of these:</span></span>
        <div className="examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="example-chip"
                    onClick={() => onSubmit(null, ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Loaded view ────────────────────────────────────────────────────────────
function LoadedView({ data, onReset, showToast }) {
  const {
    owner, repo, description, language, langColor, stars,
    size, avatarUrl, readmeSummary, summaryIsAi, readmeUrl,
    sourceDownloadUrl, htmlUrl, topics, releases, rating,
  } = data;

  const hasReleases = releases && releases.length > 0;

  return (
    <>
      <section className="hero fade-in" style={{ marginBottom: 8 }}>
        <div className="eyebrow">
          <span className="dot" style={{
            width: 6, height: 6, borderRadius: 999,
            background: 'var(--good)', display: 'inline-block'
          }} />
          <span>
            found it ·{' '}
            <span style={{ fontWeight: 600, color: tierColor(rating.tier) }}>
              {rating.label}
            </span>
            {hasReleases ? ` · ${releases.length} release${releases.length > 1 ? 's' : ''}` : ''}
          </span>
        </div>
        <h1 className="headline" style={{ fontSize: 30, marginBottom: 8 }}>
          {hasReleases
            ? <>Latest release of <em>{repo}</em></>
            : <>Here's <em>{repo}</em></>}
        </h1>
      </section>

      <div className="result fade-in">
        <section className="card">
          <div className="card-header">
            <h2>The Repo</h2>
            <button className="btn btn-ghost" onClick={onReset}>Try another</button>
          </div>
          <div className="card-body">
            <div className="repo-id">
              <div className="repo-avatar mono">
                {avatarUrl
                  ? <img src={avatarUrl} alt={owner} />
                  : repo.slice(0, 2).toUpperCase()
                }
              </div>
              <div className="repo-meta">
                <div className="repo-name mono">
                  <span className="owner">{owner}</span>
                  <span className="slash">/</span>
                  <span>{repo}</span>
                </div>
                <div className="repo-desc">{description}</div>
              </div>
            </div>

            <div className="repo-stats">
              {language && (
                <span className="stat">
                  <span className="lang-dot" style={{ background: langColor }} />
                  {language}
                </span>
              )}
              <span className="stat"><Icon.Star /> {stars}</span>
              <span className="stat"><Icon.Book /> {size}</span>
            </div>

            {(() => {
              const { bg, border } = tierBadgeStyle(rating.tier);
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: tierColor(rating.tier),
                    letterSpacing: '0.02em',
                  }}>
                    {tierIcon(rating.tier)} {rating.label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>·</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{rating.detail}</span>
                </div>
              );
            })()}

            {hasReleases ? (
              <ReleasePanel releases={releases} showToast={showToast} />
            ) : (
              <NoReleasesPanel
                repo={repo}
                sourceDownloadUrl={sourceDownloadUrl}
                htmlUrl={htmlUrl}
                showToast={showToast}
              />
            )}

            <a
              href={htmlUrl}
              target="_blank"
              rel="noopener"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, fontSize: 12.5, color: 'var(--ink-3)', textDecoration: 'none',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <Icon.ExternalLink /> view on github.com
            </a>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>About the repository</h2>
            <span className="status-pill" title="README from the repository">
              <Icon.Book />
              readme
            </span>
          </div>
          <div className="card-body">
            {readmeSummary ? (
              <ReadmeView summary={readmeSummary} readmeUrl={readmeUrl} isAi={summaryIsAi} />
            ) : (
              <NoReadme repo={repo} htmlUrl={htmlUrl} />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

// ── Release panel ──────────────────────────────────────────────────────────
function ReleasePanel({ releases, showToast }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const release = releases[selectedIdx];

  const handleDownload = (asset) => {
    window.location.href = asset.downloadUrl;
    showToast(`Downloading ${asset.name}…`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {releases.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="choice-label">Release</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {releases.map((r, i) => (
              <button
                key={r.id}
                type="button"
                className="example-chip"
                onClick={() => setSelectedIdx(i)}
                style={i === selectedIdx ? {
                  borderColor: 'var(--accent)',
                  color: 'var(--accent-ink)',
                  background: 'var(--accent-soft)',
                } : {}}
              >
                {r.tag}{r.prerelease ? ' (pre)' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="choice-label">Downloads</span>
        {[...release.assets]
          .sort((a, b) => {
            const aMatch = a.os === USER_OS ? -1 : 0;
            const bMatch = b.os === USER_OS ? -1 : 0;
            return aMatch - bMatch;
          })
          .map((asset) => (
            <AssetRow key={asset.name} asset={asset} onDownload={handleDownload} isMatch={asset.os === USER_OS} />
          ))
        }
      </div>
    </div>
  );
}

// ── Single asset row ───────────────────────────────────────────────────────
const OS_ICON = {
  windows: '⊞',
  mac: '',
  linux: '🐧',
  source: '{ }',
  generic: '↓',
};

function AssetRow({ asset, onDownload, isMatch }) {
  const icon = OS_ICON[asset.os] || '↓';
  const baseBg = isMatch ? 'var(--accent-soft)' : 'var(--surface)';
  const baseBorder = isMatch ? 'var(--accent)' : 'var(--line)';
  return (
    <button
      type="button"
      onClick={() => onDownload(asset)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, padding: '10px 12px',
        background: baseBg, border: `1px solid ${baseBorder}`,
        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        textAlign: 'left', width: '100%',
        transition: 'border-color .12s, background .12s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.background = 'var(--accent-soft)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = baseBorder;
        e.currentTarget.style.background = baseBg;
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{
          width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: isMatch ? '#d4e4f3' : 'var(--code-bg)', borderRadius: 7, fontSize: 14,
          fontFamily: asset.os === 'source' ? "'JetBrains Mono', monospace" : undefined,
          color: isMatch ? 'var(--accent-ink)' : 'var(--ink-2)',
        }}>
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontWeight: 500, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {asset.label}
            </span>
            {isMatch && (
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: 'var(--accent-ink)', background: '#c2d8ec',
                padding: '2px 5px', borderRadius: 4, flexShrink: 0,
              }}>
                your os
              </span>
            )}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
            {asset.name}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {asset.size !== '—' && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'var(--ink-3)' }}>
            {asset.size}
          </span>
        )}
        <span style={{
          background: 'var(--accent)', color: '#fff',
          padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
        }}>
          Download
        </span>
      </div>
    </button>
  );
}

// ── No releases fallback ───────────────────────────────────────────────────
function NoReleasesPanel({ repo, sourceDownloadUrl, htmlUrl, showToast }) {
  const handleDownload = () => {
    window.location.href = sourceDownloadUrl;
    showToast('Download started. Check your Downloads folder');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        padding: '14px 16px',
        background: '#fdfcf8',
        border: '1px solid var(--line-2)',
        borderLeft: '3px solid var(--ink-3)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>
          <Icon.Info />
          No releases published yet
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          This repo hasn't put out an official release. No installers, no versioned packages.
          That usually means it's still early-stage, or it's a library meant to be used by developers
          rather than downloaded and run directly.
        </p>
        <a href={`${htmlUrl}/releases`} target="_blank" rel="noopener"
           style={{ fontSize: 12, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon.ExternalLink /> Check the releases page on GitHub
        </a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
          still want the files?
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
          You can download the raw source code. This is the current state of the project,
          not a packaged release.
        </p>
        <button className="btn btn-accent" onClick={handleDownload} style={{ alignSelf: 'stretch' }}>
          <Icon.ArrowDown />
          Download source code ({repo}.zip)
        </button>
      </div>
    </div>
  );
}

// ── README panel ───────────────────────────────────────────────────────────
function ReadmeView({ summary, readmeUrl, isAi }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="readme-label">From the README</div>
      <p style={{ margin: 0, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.65 }}>
        {summary}
      </p>
      <a
        href={readmeUrl}
        target="_blank"
        rel="noopener"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--accent)', fontWeight: 500,
          textDecoration: 'none', alignSelf: 'flex-start',
          padding: '7px 12px',
          border: '1px solid #d4dfeb',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--accent-soft)',
          transition: 'background .12s, border-color .12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#dce8f3';
          e.currentTarget.style.borderColor = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--accent-soft)';
          e.currentTarget.style.borderColor = '#d4dfeb';
        }}
      >
        <Icon.Book /> Read the full README
        <Icon.ExternalLink />
      </a>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace" }}>
        {'extracted from readme'}
      </p>
    </div>
  );
}

function NoReadme({ repo, htmlUrl }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="callout">
        <Icon.Info />
        <span>
          This repo doesn't have a README. Once you download and unzip it,
          look inside the folder. There may be a <span className="mono" style={{ fontSize: 12 }}>CONTRIBUTING.md</span>,
          a <span className="mono" style={{ fontSize: 12 }}>docs/</span> folder,
          or comments in the code explaining what to do next.
        </span>
      </div>
      <a href={htmlUrl} target="_blank" rel="noopener"
         style={{ color: 'var(--accent)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icon.ExternalLink /> Browse the repository on GitHub
      </a>
    </div>
  );
}

// ── How it works modal ─────────────────────────────────────────────────────
function HowItWorksModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const steps = [
    {
      title: "Paste the link",
      detail: "Copy the link from your browser and paste it in the box. It'll look something like github.com/someone/someapp.",
    },
    {
      title: "We check what's available",
      detail: "We look up whether the app has any files ready to download, like an installer or a .exe.",
    },
    {
      title: "We find the right file for you",
      detail: "We detect whether you're on Windows, Mac, or Linux and put the right download at the top.",
    },
    {
      title: "Hit Download. Done.",
      detail: "The file goes straight to your Downloads folder, just like any other download from the web.",
    },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <span className="modal-title" id="modal-title">How it works</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            Someone sent you a GitHub link and you just want to download the app? That's exactly what this is for.
          </p>
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={i} className="step">
                <span className="step-num">{i + 1}</span>
                <div className="step-body">
                  <span className="step-title">{s.title}</span>
                  <span className="step-detail">{s.detail}</span>
                </div>
              </li>
            ))}
          </ol>
          <div style={{
            padding: '12px 14px',
            background: 'var(--accent-soft)',
            border: '1px solid #d4dfeb',
            borderLeft: '3px solid var(--accent)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            color: 'var(--ink-2)',
            lineHeight: 1.55,
          }}>
            <strong style={{ color: 'var(--accent-ink)', display: 'block', marginBottom: 4 }}>What do the ratings mean?</strong>
            <strong style={{ color: 'var(--good)' }}>Simple</strong> means there's a ready-to-run installer. Download and open it like any other app.{' '}
            <strong style={{ color: 'var(--warn)' }}>Technical</strong> means releases exist but need extra setup, like having Java installed.{' '}
            <strong style={{ color: 'var(--danger)' }}>Highly Technical</strong> means you need a terminal to run it. This is built for developers, not everyday users.
          </div>
        </div>
      </div>
    </div>
  );
}
