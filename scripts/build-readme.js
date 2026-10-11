const fs = require("fs");
const axios = require("axios");
const path = require("path");

// NOTE: many sites send very large response headers (e.g. Tricentis). Node's
// default 16 KB header limit then throws HPE_HEADER_OVERFLOW and the tool is
// wrongly reported as Offline. Always run through `npm run build`, or directly:
//   node --max-http-header-size=131072 scripts/build-readme.js

const TOOLS_DIR = path.join(__dirname, "..", "data", "tools");
const README_FILE = path.join(__dirname, "..", "README.md");
const DOCS_DIR = path.join(__dirname, "..", "docs");
const HTML_FILE = path.join(DOCS_DIR, "index.html");

const STATUS_ONLINE = "🟢";
const STATUS_OFFLINE = "🔴";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
};

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Resolve a tech logo from the tool's domain using Google's public favicon
// service (no API key required). Returns "" when the URL is not parseable.
function faviconUrl(url) {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch (err) {
    return "";
  }
}

async function checkTool(tool) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await axios({
      method: "GET",
      url: tool.url,
      timeout: 8000,
      headers: BROWSER_HEADERS,
      validateStatus: () => true,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.status >= 500) {
      return { status: STATUS_OFFLINE, httpCode: res.status };
    }
    return { status: STATUS_ONLINE, httpCode: res.status };
  } catch (err) {
    return { status: STATUS_OFFLINE, httpCode: "error" };
  }
}

function groupByCategory(toolsWithStatus) {
  const groups = {};
  for (const item of toolsWithStatus) {
    const cat = item.tool.category || "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

function generateMarkdown(toolsWithStatus) {
  const total = toolsWithStatus.length;
  const online = toolsWithStatus.filter((t) => t.status === STATUS_ONLINE).length;
  const offline = total - online;
  const groups = groupByCategory(toolsWithStatus);
  const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });

  let md = `# 🛠️️ Awesome Free Dev Tools

<div align="center">
  <img width="300" alt="Awesome Free Dev Tools" src="awesome-free-dev-tools.png">
</div>

[![Total Tools](https://img.shields.io/badge/Total_Tools-${total}-blue?style=for-the-badge)](https://github.com/pnnnhan99/awesome-free-dev-tools)
[![Online](https://img.shields.io/badge/Online-${online}-brightgreen?style=for-the-badge)](https://github.com/pnnnhan99/awesome-free-dev-tools)
[![Offline](https://img.shields.io/badge/Offline-${offline}-red?style=for-the-badge)](https://github.com/pnnnhan99/awesome-free-dev-tools)
[![Auto Update](https://img.shields.io/badge/Auto_Update-Active-purple?style=for-the-badge&logo=github-actions)](https://github.com/pnnnhan99/awesome-free-dev-tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](https://opensource.org/licenses/MIT)

> 🎯 **The best free-tier tools collection** for developers and Vibe Coders. Status is automatically checked every night to keep information accurate.
>
> 🤝 **Want to contribute?** Open a Pull Request or create an Issue to suggest a new tool!

## 📋 Overview

| Metric | Value |
|---|---|
| Total Tools | ${total} |
| 🟢 Online | ${online} |
| 🔴 Offline | ${offline} |
| Last Updated | ${now} (GMT+7) |

---

## 📂 Table of Contents

`;

  for (const category of Object.keys(groups)) {
    md += `- [${category}](#${slug(category)})\n`;
  }

  md += `\n---\n\n`;

  for (const [category, items] of Object.entries(groups)) {
    md += `### ${category}\n\n`;
    md += `<table>\n`;
    md += `  <thead>\n`;
    md += `    <tr>\n`;
    md += `      <th>Tool & Link</th>\n`;
    md += `      <th>Purpose</th>\n`;
    md += `      <th>Pricing</th>\n`;
    md += `      <th>Status</th>\n`;
    md += `    </tr>\n`;
    md += `  </thead>\n`;
    md += `  <tbody>\n`;

    for (const item of items) {
      const pricing = item.tool.pricing || "N/A";
      md += `    <tr>\n`;
      md += `      <td style="vertical-align: middle;"><a href="${item.tool.url}">${item.tool.name}</a></td>\n`;
      md += `      <td style="vertical-align: middle;">${item.tool.purpose}</td>\n`;
      md += `      <td style="text-align: center; vertical-align: middle;">${pricing}</td>\n`;
      md += `      <td style="text-align: right; vertical-align: middle;">${item.status}</td>\n`;
      md += `    </tr>\n`;
    }

    md += `  </tbody>\n`;
    md += `</table>\n\n`;
    md += `---\n\n`;
  }

  md += `## 📝 Notes

- **Status** is automatically checked every night by GitHub Actions.
- 🟢 Online: Server responds (status < 500).
- 🔴 Offline: Timeout, DNS error, or server error (status >= 500).
- All contributions welcome via PR at [GitHub](https://github.com/pnnnhan99/awesome-free-dev-tools).

---

<p align="center">
  Made with 💜 by the <a href="https://github.com/pnnnhan99/awesome-free-dev-tools">Awesome Free Dev Tools</a> community
</p>

<p align="center">
  🕐 Last updated: ${now}
</p>
`;

  return md;
}

function generateHtml(toolsWithStatus) {
  const total = toolsWithStatus.length;
  const online = toolsWithStatus.filter((t) => t.status === STATUS_ONLINE).length;
  const offline = total - online;
  const groups = groupByCategory(toolsWithStatus);
  const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });

  const toc = Object.keys(groups)
    .map((cat) => `        <li><a href="#${slug(cat)}">${escapeHtml(cat)}</a></li>`)
    .join("\n");

  let sections = "";
  for (const [category, items] of Object.entries(groups)) {
    const rows = items
      .map((item) => {
        const pricing = item.tool.pricing || "N/A";
        const logo = faviconUrl(item.tool.url);
        const logoCell = logo
          ? `<img class="logo" src="${escapeHtml(logo)}" alt="" width="24" height="24" loading="lazy" onerror="this.style.visibility='hidden'">`
          : "";
        return `          <tr>
            <td class="logo-cell">${logoCell}</td>
            <td><a href="${escapeHtml(item.tool.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.tool.name)}</a></td>
            <td>${escapeHtml(item.tool.purpose)}</td>
            <td>${escapeHtml(pricing)}</td>
            <td class="status">${item.status}</td>
          </tr>`;
      })
      .join("\n");

    sections += `      <section class="category">
        <h2 id="${slug(category)}">${escapeHtml(category)} <span class="count">${items.length}</span></h2>
        <table>
          <colgroup>
            <col class="col-logo">
            <col class="col-tool">
            <col class="col-purpose">
            <col class="col-pricing">
            <col class="col-status">
          </colgroup>
          <thead>
            <tr><th><span class="sr-only">Logo</span></th><th>Tool &amp; Link</th><th>Purpose</th><th>Pricing</th><th class=status>Status</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </section>
`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🛠️ Awesome Free Dev Tools</title>
  <meta name="description" content="The best free-tier tools collection for developers and Vibe Coders">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="header">
    <h1>🛠️ Awesome Free Dev Tools</h1>
    <p>The best free-tier tools collection for developers and Vibe Coders.</p>
    <div style="margin-top: 15px;">
      <a href="https://github.com/pnnnhan99/awesome-free-dev-tools"><img src="https://img.shields.io/badge/View_on_GitHub-181717?style=for-the-badge&logo=github" alt="GitHub"></a>
      <a href="https://github.com/pnnnhan99/awesome-free-dev-tools"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License"></a>
    </div>
  </div>
  <div class="stats">
    <div class="stat-card"><div class="number">${total}</div><div class="label">Total Tools</div></div>
    <div class="stat-card live"><div class="number">${online}</div><div class="label">🟢 Online</div></div>
    <div class="stat-card dead"><div class="number">${offline}</div><div class="label">🔴 Offline</div></div>
  </div>
  <div class="main-container">
    <aside class="sidebar">
      <nav class="toc">
        <h2>📂 Table of Contents</h2>
        <ul>
          ${toc}
        </ul>
      </nav>
    </aside>
    <main class="content">
      ${sections}    
    </main>
  </div>
  <div class="footer">
    <p>Made with 💜 by the Awesome Free Dev Tools community</p>
    <p>🕐 Last updated: ${now} (GMT+7)</p>
  </div>
</body>
</html>
`;
}

async function main() {
  console.log("🚀 Starting build-readme.js...");
  console.log(`📂 Reading tools from: ${TOOLS_DIR}`);

  const files = fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.json'));
  const tools = [];
  for (const file of files) {
    const filePath = path.join(TOOLS_DIR, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const categoryTools = JSON.parse(raw);
    tools.push(...categoryTools);
  }
  console.log(`✅ Loaded ${tools.length} tools from ${files.length} category files.`);

  console.log("\n🔍 Checking tool status (timeout: 8s each)...");
  const results = [];

  for (const tool of tools) {
    console.log(`  ⏳ Checking: ${tool.name} (${tool.url})...`);
    const result = await checkTool(tool);
    results.push({ tool, ...result });
    console.log(`  ✅ ${tool.name}: ${result.status} (${result.httpCode})`);
  }

  const onlineCount = results.filter((r) => r.status === STATUS_ONLINE).length;
  console.log(`\n📊 Results: ${onlineCount}/${results.length} tools are online.`);

  console.log("✨ Generating README.md and docs/index.html...");
  const markdown = generateMarkdown(results);
  const html = generateHtml(results);

  const prevReadme = fs.existsSync(README_FILE) ? fs.readFileSync(README_FILE, "utf-8") : "";
  const prevHtml = fs.existsSync(HTML_FILE) ? fs.readFileSync(HTML_FILE, "utf-8") : "";

  fs.writeFileSync(README_FILE, markdown, "utf-8");
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(HTML_FILE, html, "utf-8");

  console.log(`✅ README.md written successfully to: ${README_FILE}`);
  console.log(`✅ docs/index.html written successfully to: ${HTML_FILE}`);

  if (prevReadme !== markdown || prevHtml !== html) {
    console.log("🔄 Files have been updated.");
  } else {
    console.log("ℹ️  Content unchanged.");
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
}

module.exports = {
  slug,
  escapeHtml,
  faviconUrl,
  groupByCategory,
  generateMarkdown,
  generateHtml,
};
