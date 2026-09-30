const fs = require("fs");
const axios = require("axios");
const path = require("path");

const TOOLS_FILE = path.join(__dirname, "..", "data", "tools.json");
const README_FILE = path.join(__dirname, "..", "README.md");

const STATUS_ONLINE = "🟢 Online";
const STATUS_OFFLINE = "🔴 Offline";

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

  // Thay đổi ở đây: Dùng HTML Table để set width="100%" và ép % cho từng cột
  for (const [category, items] of Object.entries(groups)) {
    md += `### ${category}\n\n`;
    md += `<table width="100%">\n`;
    md += `  <thead>\n`;
    md += `    <tr>\n`;
    md += `      <th width="25%">Tool & Link</th>\n`;
    md += `      <th width="60%">Purpose</th>\n`;
    md += `      <th width="15%">Status</th>\n`;
    md += `    </tr>\n`;
    md += `  </thead>\n`;
    md += `  <tbody>\n`;

    for (const item of items) {
      md += `    <tr>\n`;
      md += `      <td><a href="${item.tool.url}">${item.tool.name}</a></td>\n`;
      md += `      <td>${item.tool.purpose}</td>\n`;
      md += `      <td>${item.status}</td>\n`;
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

async function main() {
  console.log("🚀 Starting build-readme.js...");
  console.log(`📂 Reading tools from: ${TOOLS_FILE}`);

  const raw = fs.readFileSync(TOOLS_FILE, "utf-8");
  const tools = JSON.parse(raw);
  console.log(`✅ Loaded ${tools.length} tools.`);

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

  console.log("✨ Generating README.md...");
  const markdown = generateMarkdown(results);
  fs.writeFileSync(README_FILE, markdown, "utf-8");
  console.log(`✅ README.md written successfully to: ${README_FILE}`);

  const currentContent = fs.existsSync(README_FILE) ? fs.readFileSync(README_FILE, "utf-8") : "";
  const changed = currentContent !== markdown;
  if (changed) {
    console.log("🔄 README.md has been updated.");
  } else {
    console.log("ℹ️  README.md content unchanged.");
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
