// backend/server.js — Repo Grab API server
// Requires: ANTHROPIC_API_KEY env var (and optionally GITHUB_TOKEN for higher rate limits)
//
// Run:  node server.js          (or: npm start)
// Dev:  npm run dev             (restarts on file changes, Node 18+)
//
// Serves the frontend from ../frontend and exposes GET /api/repo?owner=&repo=

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Anthropic client ──────────────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // set this in your environment
});

// ── Plain-text summary extracted from markdown (fallback when Claude fails) ──
function extractSummary(md, maxChars = 300) {
  if (!md) return null;
  let text = md.replace(/```[\s\S]*?```/g, '');
  const prose = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || /^#/.test(line) || /^!\[/.test(line) || /^\[!\[/.test(line)) continue;
    if (/^<!--/.test(line) || /^</.test(line) || /^[-*]{3,}$/.test(line) || /^\|/.test(line)) continue;
    if (line.length < 20) continue;
    const clean = line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .trim();
    if (clean.length < 20) continue;
    prose.push(clean);
    if (prose.join(' ').length >= maxChars) break;
  }
  const full = prose.join(' ');
  if (!full) return null;
  return full.length > maxChars ? full.slice(0, maxChars).replace(/\s+\S*$/, '') + '…' : full;
}

// ── GitHub fetch helper ───────────────────────────────────────────────────
async function ghFetch(url) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'repo-grab/1.0',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return fetch(url, { headers });
}

// ── Claude Haiku summary ──────────────────────────────────────────────────
async function generateSummary(readmeText, repoName, description) {
  if (!readmeText || !process.env.ANTHROPIC_API_KEY) return null;

  // Strip fenced code blocks and limit input size to stay within token budget
  const cleaned = readmeText
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .slice(0, 5000);

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 160,
      messages: [
        {
          role: 'user',
          content: `Summarise this GitHub repository in 2–3 sentences for someone deciding whether to download it. Be plain and specific: what does it do, who is it for, what do you need to use it? Do not start with "This repository" or repeat the repo name.

Repo: ${repoName}
Description: ${description || '(none)'}

README (excerpt):
${cleaned}`,
        },
      ],
    });
    return message.content[0].text.trim();
  } catch (err) {
    // Non-fatal — fall back to no summary rather than crashing the request
    console.error('[claude]', err.message);
    return null;
  }
}

// ── Main API endpoint ─────────────────────────────────────────────────────
app.get('/api/repo', async (req, res) => {
  const { owner, repo } = req.query;
  console.log(`[api/repo] ${owner}/${repo}`);

  if (!owner || !repo) {
    return res.status(400).json({ kind: 'invalid', message: 'Missing owner or repo' });
  }

  // Basic sanity check — prevent path traversal / weird inputs
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    return res.status(400).json({ kind: 'invalid', message: 'Invalid owner or repo name' });
  }

  try {
    const [repoRes, releasesRes, readmeRes] = await Promise.all([
      ghFetch(`https://api.github.com/repos/${owner}/${repo}`),
      ghFetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`),
      ghFetch(`https://api.github.com/repos/${owner}/${repo}/readme`),
    ]);

    if (repoRes.status === 404) return res.status(404).json({ kind: 'notfound' });
    if (repoRes.status === 403 || repoRes.status === 429) return res.status(429).json({ kind: 'ratelimit' });
    if (!repoRes.ok) return res.status(502).json({ kind: 'error', status: repoRes.status });

    const repoJson = await repoRes.json();
    if (repoJson.private) return res.status(403).json({ kind: 'private' });

    // Releases — ignore errors gracefully
    let releases = [];
    if (releasesRes.ok) {
      const all = await releasesRes.json();
      releases = all.filter((r) => !r.draft);
    }

    // README — decode base64 content
    let readmeText = null;
    if (readmeRes.ok) {
      const readmeJson = await readmeRes.json();
      try {
        readmeText = Buffer.from(readmeJson.content.replace(/\n/g, ''), 'base64').toString('utf-8');
      } catch {
        // ignore decode failures
      }
    }

    // Generate AI summary with Claude Haiku, fall back to plain extraction if it fails
    const aiSummary = await generateSummary(readmeText, repoJson.name, repoJson.description);
    const readmeSummary = aiSummary ?? extractSummary(readmeText);

    return res.json({ repoJson, releases, readmeSummary });
  } catch (err) {
    console.error('[api/repo]', err);
    return res.status(500).json({ kind: 'error', message: 'Internal server error' });
  }
});

// SPA catch-all — serve index.html for any non-API route
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Repo Grab running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[warn] ANTHROPIC_API_KEY not set — summaries will be skipped');
  }
  if (!process.env.GITHUB_TOKEN) {
    console.warn('[warn] GITHUB_TOKEN not set — GitHub rate limit is 60 req/hr');
  }
});
