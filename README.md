<p align="center">
  <svg width="52" height="52" viewBox="0 0 1080 1080" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clip-path="url(#clip0)">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M540 28C257.12 28 28 257.12 28 540C28 766.56 174.56 957.92 378.08 1025.76C403.68 1030.24 413.28 1014.88 413.28 1001.44C413.28 989.28 412.64 948.96 412.64 906.08C284 929.76 250.72 874.72 240.48 845.92C234.72 831.2 209.76 785.76 188 773.6C170.08 764 144.48 740.32 187.36 739.68C227.68 739.04 256.48 776.8 266.08 792.16C312.16 869.6 385.76 847.84 415.2 834.4C419.68 801.12 433.12 778.72 447.84 765.92C333.92 753.12 214.88 708.96 214.88 513.12C214.88 457.44 234.72 411.36 267.36 375.52C262.24 362.72 244.32 310.24 272.48 239.84C272.48 239.84 315.36 226.4 413.28 292.32C454.24 280.8 497.76 275.04 541.28 275.04C584.8 275.04 628.32 280.8 669.28 292.32C767.2 225.76 810.08 239.84 810.08 239.84C838.24 310.24 820.32 362.72 815.2 375.52C847.84 411.36 867.68 456.8 867.68 513.12C867.68 709.6 748 753.12 634.08 765.92C652.64 781.92 668.64 812.64 668.64 860.64C668.64 929.12 668 984.16 668 1001.44C668 1014.88 677.6 1030.88 703.2 1025.76C905.44 957.92 1052 765.92 1052 540C1052 257.12 822.88 28 540 28Z" fill="#1B1F23"/>
      <path d="M977.681 732.375H933.625V593.833C933.625 578.594 921.156 566.125 905.917 566.125H795.083C779.844 566.125 767.375 578.594 767.375 593.833V732.375H723.319C698.658 732.375 686.19 762.3 703.646 779.756L830.827 906.938C841.633 917.744 859.09 917.744 869.896 906.938L997.077 779.756C1014.53 762.3 1002.34 732.375 977.681 732.375ZM656.542 1009.46C656.542 1024.7 669.01 1037.17 684.25 1037.17H1016.75C1031.99 1037.17 1044.46 1024.7 1044.46 1009.46C1044.46 994.219 1031.99 981.75 1016.75 981.75H684.25C669.01 981.75 656.542 994.219 656.542 1009.46Z" fill="#00FF6F"/>
    </g>
    <defs>
      <clipPath id="clip0">
        <rect width="1024" height="1024" fill="white" transform="translate(28 28)"/>
      </clipPath>
    </defs>
  </svg>
</p>

<h1 align="center">GitHub Download Button</h1>
<p align="center">The download button GitHub forgot to ship.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-4-black?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome MV3" />
</p>

---

## What it does

GitHub is great for storing software. It is not great for downloading it. Most repos bury their releases under tabs, use inconsistent naming for assets, and give no indication of whether a file requires a terminal or will just open like a normal app.

GitHub Download Button solves that. Paste any public GitHub repo URL and it surfaces the correct download for your operating system, classifies whether the release is a simple double-click installer or something that requires developer knowledge, and summarises the README so you know what you are getting before you commit to the download.

The project ships in two forms: a web app you can open in a browser, and a Chrome extension that injects a floating panel on any GitHub repository page so you never have to leave the tab.

---

## Features

- **OS detection.** Automatically highlights the release asset that matches your platform, Windows, macOS, or Linux, and pushes it to the top of the list.
- **Three-tier complexity rating.** Every repo is rated Simple (download and run, no setup needed), Technical (has releases but needs a runtime like Java), or Highly Technical (requires a terminal to run, built for developers). The rating is determined by a README parser that reads installation instructions, detects terminal commands in user-facing sections, identifies the tech stack, and checks for runtime prerequisites.
- **README summaries.** The backend extracts a plain-text summary from the README so you know what the project does before downloading anything.
- **Chrome extension.** A shadow-DOM panel injects on any `github.com/owner/repo` page, auto-fetches release data, and dismisses per session. The popup also works as a standalone search for repos you are not currently viewing.
- **No login, no tracking.** Everything goes through GitHub's public API. No account required.

---

## How it works

```
Browser / Extension
       |
       | GET /api/repo?owner=&repo=
       v
  Express backend
       |
       |-- GitHub API: repo metadata
       |-- GitHub API: releases (up to 5)
       |-- GitHub API: README (base64 decoded)
       |
       |-- analyzeReadmeComplexity()
       |     Splits README by section, skips build/dev headings,
       |     scores asset filenames and prose signals to return
       |     Simple / Technical / Highly Technical
       |
       |-- extractSummary(): plain-text excerpt from README prose
       |
       v
  JSON response: { repoJson, releases, readmeSummary, appRating }
       |
       v
  React frontend: OS-filtered asset list, rating badge, README summary
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, vanilla CSS |
| Backend | Node.js 18+, Express 4 |
| GitHub data | GitHub REST API v3, public endpoints |
| Extension | Chrome Manifest V3, shadow DOM, no build step |
| Deployment | Railway, Render, or Fly.io |

---

## Project structure

```
github-download-button/
  web-app/
    server.js          Express server, GitHub API proxy, README analysis
    vite.config.js     Vite config, proxies /api to Express in dev
    package.json
    client/
      index.html       Vite entry point
      public/          Static assets (logo, author mark)
      src/
        main.jsx       ReactDOM entry
        App.jsx        Main React application
        icons.jsx      SVG icon components
        styles.css     All styles
  extension/
    manifest.json      Chrome MV3 manifest
    utils.js           Shared: detectOS, labelAsset, enrichReleases, computeRating, fetchRepo
    content.js         Injected panel on GitHub repo pages
    popup.js           Extension popup logic
    popup.html         Popup shell
    popup.css          Popup styles
```

---

## Running locally

**Prerequisites:** Node.js 18+. A GitHub personal access token is optional but raises the rate limit from 60 to 5,000 requests per hour.

```bash
git clone https://github.com/madebyorunto/github-download-button.git
cd github-download-button/web-app

npm install

# Copy and fill in environment variables
cp .env.example .env.local

npm run dev
```

This starts both the Express server (port 3000) and the Vite dev server (port 5173) in parallel. Open `http://localhost:5173`. The Vite dev server proxies `/api` requests to Express, so both hot module replacement and the backend work at the same time.

To build and serve the production bundle locally:

```bash
npm run build
npm start        # serves client/dist from Express on port 3000
```

---

## Deploying

The web app is a standard Node.js server. Any platform that runs `npm run build && npm start` works.

**Railway / Render:** Connect the repo, set the root directory to `web-app/`, add `GITHUB_TOKEN` and `ANTHROPIC_API_KEY` as environment variables. Both platforms detect the `start` script automatically.

**Fly.io:** Same, using `fly launch` inside `web-app/`.

---

## Loading the Chrome extension

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select the `extension/` folder.
4. The extension injects automatically on any `github.com/owner/repo` page, provided the backend is running at `http://localhost:3000`.

To point the extension at a deployed backend, update `RG_BACKEND` at the top of `extension/utils.js` before loading it.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | No | Personal access token. Raises the GitHub API rate limit from 60 to 5,000 requests per hour. |
| `PORT` | No | Port the server listens on. Defaults to 3000. |

---

## Contributing

Pull requests are welcome. A few things to keep in mind before opening one.

**Branching.** Branch off `master`. Name your branch after what it does: `fix/asset-detection`, `feat/firefox-extension`, `refactor/rating-algorithm`.

**Opening a PR.** Describe what the change does and why. If it touches the rating algorithm, include a few repo URLs that demonstrate the before and after behaviour.

**Issues.** Bug reports should include the repo URL that triggered the issue, the rating shown, and what you expected. Feature requests should explain the user problem, not just the proposed solution.

**Scope.** This tool is for non-technical users who just want to download an app. Features that add complexity for the sake of power-users are out of scope. Keep the surface simple.

---

<p align="center">
  Built by <a href="https://orunto.dev">Orunto Eniola</a>. Public beta.
</p>
