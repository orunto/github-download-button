export default function PrivacyPage() {
  return (
    <div className="page">
      <header className="topbar">
        <a href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <svg className="brand-mark" width="28" height="28" viewBox="0 0 1080 1080" fill="none" aria-hidden="true">
            <g clipPath="url(#pp-clip)">
              <path fillRule="evenodd" clipRule="evenodd" d="M540 28C257.12 28 28 257.12 28 540C28 766.56 174.56 957.92 378.08 1025.76C403.68 1030.24 413.28 1014.88 413.28 1001.44C413.28 989.28 412.64 948.96 412.64 906.08C284 929.76 250.72 874.72 240.48 845.92C234.72 831.2 209.76 785.76 188 773.6C170.08 764 144.48 740.32 187.36 739.68C227.68 739.04 256.48 776.8 266.08 792.16C312.16 869.6 385.76 847.84 415.2 834.4C419.68 801.12 433.12 778.72 447.84 765.92C333.92 753.12 214.88 708.96 214.88 513.12C214.88 457.44 234.72 411.36 267.36 375.52C262.24 362.72 244.32 310.24 272.48 239.84C272.48 239.84 315.36 226.4 413.28 292.32C454.24 280.8 497.76 275.04 541.28 275.04C584.8 275.04 628.32 280.8 669.28 292.32C767.2 225.76 810.08 239.84 810.08 239.84C838.24 310.24 820.32 362.72 815.2 375.52C847.84 411.36 867.68 456.8 867.68 513.12C867.68 709.6 748 753.12 634.08 765.92C652.64 781.92 668.64 812.64 668.64 860.64C668.64 929.12 668 984.16 668 1001.44C668 1014.88 677.6 1030.88 703.2 1025.76C905.44 957.92 1052 765.92 1052 540C1052 257.12 822.88 28 540 28Z" fill="#1B1F23"/>
              <path d="M977.681 732.375H933.625V593.833C933.625 578.594 921.156 566.125 905.917 566.125H795.083C779.844 566.125 767.375 578.594 767.375 593.833V732.375H723.319C698.658 732.375 686.19 762.3 703.646 779.756L830.827 906.938C841.633 917.744 859.09 917.744 869.896 906.938L997.077 779.756C1014.53 762.3 1002.34 732.375 977.681 732.375ZM656.542 1009.46C656.542 1024.7 669.01 1037.17 684.25 1037.17H1016.75C1031.99 1037.17 1044.46 1024.7 1044.46 1009.46C1044.46 994.219 1031.99 981.75 1016.75 981.75H684.25C669.01 981.75 656.542 994.219 656.542 1009.46Z" fill="#00FF6F"/>
            </g>
            <defs>
              <clipPath id="pp-clip">
                <rect width="1024" height="1024" fill="white" transform="translate(28 28)"/>
              </clipPath>
            </defs>
          </svg>
          GitHub Download Button
          <span className="brand-meta">public beta</span>
        </a>
        <a href="/" style={{ fontSize: 13, color: "var(--ink-3)", textDecoration: "none" }}>
          ← Back
        </a>
      </header>

      <main className="main" style={{ alignItems: "flex-start" }}>
        <div style={{ width: "100%", maxWidth: 680 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6, marginTop: 0 }}>
            Privacy Policy
          </h1>
          <p style={{ margin: "0 0 40px", fontSize: 13, color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>
            Last updated: May 3, 2026
          </p>

          <Section title="The short version">
            <p>GitHub Download Button does not collect, store, or share any personal information. No accounts. No tracking. No analytics.</p>
          </Section>

          <Section title="What happens when you use this">
            <p>
              When you visit a GitHub repository page, the extension sends the repository owner and name (for example,{" "}
              <code>microsoft/vscode</code>) to our API at{" "}
              <code>githubdownloadbutton.orunto.dev</code>. This is used solely to look up publicly available release and README information for that repository via GitHub's public API. The response is displayed directly to you and is not stored anywhere.
            </p>
            <p>
              The same applies when you use the web app. Entering a repository URL causes that owner and repo name to be sent to the same API endpoint for the same purpose.
            </p>
          </Section>

          <Section title="What we do not collect">
            <ul>
              <li>Your name, email address, or any account information</li>
              <li>Your IP address</li>
              <li>Your browsing history</li>
              <li>Which repositories you look up</li>
              <li>Any information about your device beyond what your browser sends in a standard HTTP request</li>
            </ul>
            <p>We do not use cookies, analytics platforms, session recording, or any form of user tracking.</p>
          </Section>

          <Section title="Third-party services">
            <p>
              Repository data is sourced from GitHub's public API (<code>api.github.com</code>). We are not affiliated with GitHub. GitHub's own privacy policy governs the data it makes available through its public API.
            </p>
          </Section>

          <Section title="Data storage">
            <p>
              The extension uses your browser's built-in <code>sessionStorage</code> to remember if you have dismissed the download panel on a given page. This data never leaves your browser and is cleared automatically when you close the tab.
            </p>
            <p>
              The web app uses your browser's <code>localStorage</code> to keep a short list of recently looked-up repositories for your convenience. This data also never leaves your browser and can be cleared at any time through your browser's settings.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy can be sent to{" "}
              <a href="mailto:oruntoeniola@gmail.com" style={{ color: "var(--accent)" }}>
                oruntoeniola@gmail.com
              </a>.
            </p>
          </Section>
        </div>
      </main>

      <footer className="footer">
        <span>GitHub Download Button, for people who don't want to learn Git.</span>
        <a href="/privacy" style={{ fontSize: 13, color: "var(--ink-3)", textDecoration: "none" }}>
          Privacy policy
        </a>
      </footer>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        marginBottom: 12,
        marginTop: 0,
        paddingBottom: 10,
        borderBottom: "1px solid var(--line)",
      }}>
        {title}
      </h2>
      <div style={{ fontSize: 14.5, color: "var(--ink-2)", lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </section>
  );
}
