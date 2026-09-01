---
title: Cloudflare + GitHub 发布 Hexo 静态网站指南
date: 2026-09-01
tags: []
categories: []
---

> 适用：用 **Hexo** 写博客，源码放 **GitHub**，通过 **Cloudflare Workers Builds** 自动构建部署（Git 推送即上线）。
> 写作端：用 **Obsidian + Obsidian Git** 插件，全程无命令行发文、自动管图片/PDF。
> 本文基于一次完整排坑过程整理，覆盖部署、插件设置、以及"图片反复 404"的根因与机制级修复。

---

## 0. 总体架构

```
你写 Markdown（Obsidian）
   │  Ctrl+V 粘图 → 图片自动存进仓库、自动插入正确链接
   ▼
Obsidian Git 插件（自动 commit + push）
   ▼
GitHub 仓库（[你的用户名]/[你的网站]）
   ▼
Cloudflare Workers Builds（监听 push → 自动 npm install && hexo generate && wrangler deploy）
   ▼
Cloudflare 边缘节点（public/ 作为静态资源对外服务）
   ▼
浏览器访问你的域名 / *.workers.dev
```

要点：**Cloudflare 不走 Hexo 自带的 `hexo deploy`（git 部署器）**，而是把 GitHub 当源码库、Workers 当构建机；`wrangler.toml` 决定构建产物怎么上线。

---

## 1. 前置准备

| 工具 | 说明 |
| --- | --- |
| Node.js ≥ 18 | 跑 Hexo / wrangler |
| Git | 版本管理与推送 |
| GitHub 账号 | 存放源码 |
| Cloudflare 账号 | Workers Builds（免费额度够用） |
| Obsidian | 写作端（可选但强烈推荐） |

本地建站（一次性）：
```bash
npm install -g hexo-cli
hexo init [你的网站]
cd [你的网站]
npm install
hexo new "hello-world"      # 生成 source/_posts/hello-world.md
hexo s                       # 本地预览 http://127.0.0.1:4000
```

---

## 2. GitHub 仓库与首次推送（含排错）

### 2.1 建仓库
- GitHub 新建仓库（如 `[你的网站]`），**不要勾 README / .gitignore**（保持空仓，避免后续 push 冲突）。
- 确认 SSH 连接身份：`ssh -T git@github.com` 应返回 `Hi [你的用户名]! ...`（你的用户名）。

### 2.2 配置 SSH（一次性）
```bash
ssh-keygen -t ed25519 -C "your@email.com"      # 一路回车
# 把 ~/.ssh/id_ed25519.pub 内容粘到 GitHub → Settings → SSH and GPG keys
```
> 若公司网络 `github.com:443` 连不上：给 Git 配代理
> `git config --global http.proxy http://127.0.0.1:7890`（按你的代理端口改）。

### 2.3 推送
```bash
git remote add origin git@github.com:[你的用户名]/[你的网站].git
git add -A
git commit -m "site: init"
git push -u origin main
```

### 2.4 常见错误速查
| 报错 | 原因 | 解决 |
| --- | --- | --- |
| `Failed to connect to github.com:443` | 网络/代理 | `git config --global http.proxy` |
| `Permission denied (publickey)` | 没加 SSH key | 见 2.2 |
| `ERROR: Repository not found` | 仓库名/owner 错或私有 | 核对 `git remote -v` 与 GitHub 仓库名 |
| `! [rejected] main -> main (fetch first)` | 远端有 README 等冲突 | 删仓重建空仓，或 `git pull --rebase` |
| `fatal: no submodule mapping for .deploy_git` | 误把 `.deploy_git` 加进版本库 | `git rm --cached -r .deploy_git` |

---

## 3. Cloudflare Workers Builds 关联部署

### 3.1 wrangler.toml（仓库根目录，必填）
```toml
name = "[你的网站]"
compatibility_date = "2026-08-29"
assets = { directory = "public" }
```
> ⚠️ **不要写 `binding = "ASSETS"`**！`assets` 目录型 Worker 会报 `Cannot use assets with a binding`。
> 也不要写 `main`（纯静态资源 Worker 不需要入口脚本）。

### 3.2 Cloudflare 控制台（一次性）
1. **Workers & Pages → Create → Workers Builds / 导入 Git 仓库**（连 GitHub，授权后选 `[你的网站]`）。
2. 生产分支：`main`。
3. **Build command**：`npm install && npm run build`
4. **Deploy command**：`npx wrangler deploy`   ← 注意带 `npx`（构建机裸 `wrangler` 可能找不到命令，导致部署失败、线上停留在旧/空 `public` → 图片全 404）。
5. 保存 → 首次构建。成功后给一个 `https://[你的网站].<你的子域>.workers.dev` 地址。
6. （可选）自定义域名：Workers 设置里加 Custom Domain，并把 Hexo `_config.yml` 的 `url:` 改成真实域名（仅影响绝对链接/SEO，不影响图片显示）。

### 3.3 构建失败排错
| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `error occurred while updating repository submodules` | `.deploy_git` 被当 submodule | `git rm --cached -r .deploy_git` + `.gitignore` 加 `.deploy_git/` |
| `0 files generated` + `Cannot use assets with a binding` | wrangler.toml 写了 binding | 删掉 `binding` |
| 主题缺失/样式崩 | Butterfly 没进仓库 | 克隆主题后 `rm -rf themes/butterfly/.git` 当普通文件提交，并装 `hexo-renderer-pug` + `hexo-renderer-stylus` |
| `EJSONPARSE` package.json line N | JSON 缺逗号 | 修 package.json（如 `server` 后补逗号） |
| 构建报缺渲染器 | 依赖没装全 | `package.json` 依赖齐全后 `npm install` |

---

## 4. Hexo 关键配置（`_config.yml`）

```yaml
# URL（先留占位符也行，上线后改真实域名）
url: http://example.com
permalink: :year/:month/:day/:title/

# 资源机制（图片正确显示的核心）
post_asset_folder: true      # 每篇帖子生成同名资源文件夹 source/_posts/标题/
relative_link: false
marked:
  prependRoot: true          # 资源链接自动加站点根路径
  postAsset: true            # 识别帖子同名资源文件夹，自动拼正确网址

theme: butterfly
```

> `post_asset_folder: true` + `marked.postAsset: true` 的含义：
> 帖子里的图片**必须只写文件名** `![](xxx.webp)`，Hexo 会去 `source/_posts/标题/` 找并拼成 `/2026/08/30/标题/xxx.webp`。
> **带 `./标题/` 子目录前缀反而会被错误解析成根目录 → 404。**

---

## 5. 必备 Obsidian 插件及设置（写作端）

前提：把 Hexo 仓库根目录（`[你的网站]/`）作为 **Obsidian 仓库**打开。

### 5.1 Obsidian Git —— 自动提交推送
设置 → 第三方插件 → Obsidian Git：
- 开启 **Auto commit + push**（如每 1–5 分钟，或关闭自动、手动 `Commit and push`）。
- 这样你在 Obsidian 里写完即上线，无需命令行。

### 5.2 Custom Attachment Location ★核心（决定图片存哪 + 链接长啥样）
设置 → 第三方插件 → Custom Attachment Location（当前维护者 mnaoumov）：

| 设置项 | 填值 | 说明 |
| --- | --- | --- |
| **Location for New Attachments** (`attachmentFolderPath`) | `./${noteFileName}` | 图片存到 `source/_posts/标题/` 同名文件夹，与 Hexo 资源文件夹对齐 |
| **Generated file name** (`generatedAttachmentFileName`) | `file-${date:{momentJsFormat:'YYYYMMDDHHmmssSSS'}}` | 时间戳命名避免重名 |
| **Markdown URL format** (`markdownUrlFormat`) | `${generatedAttachmentFileName}` | 插入笔记的链接只写**文件名**（不含目录） |

⚠️ **三条红线（踩过无数次）**：
1. 变量名是 **`${noteFileName}`**，不是 `${filename}`（`${filename}` 是非法 token，会报 "Unknown token 'filename'" 且图片存错位置 → 404）。
2. 日期 token 必须用 **JSON5 对象包裹**：`${date:{momentJsFormat:'YYYYMMDDHHmmssSSS'}}`。旧的 `${date:YYYYMMDD}` 写法已失效。
3. **改完插件设置后必须重启 Obsidian（或插件开关切一次）！** 只改磁盘 `data.json` 不会让运行中的 Obsidian 生效——它会一直用旧配置，导致**每篇新文章都复现** `./标题/图片.webp` 错链接（本博客图片反复 404 的真因）。

> `attachmentFolderPath`（存哪）与 `markdownUrlFormat`（链接长啥样）是**两个完全独立的设置**，少一个都不行。

### 5.3 Image Converter —— 自动压成 webp（强烈推荐）
粘贴图片时自动压缩 + 转 webp，显著减小仓库体积、规避 Workers 2 万文件数上限。
- **Folder**：留空（= 原地转换，最稳）；不要乱填 token。
- **Conversion**：格式 `WEBP`，质量 `75–85`。
- **Filename**：默认（时间戳）。
- **Link Format**：标准 Markdown `![](...)`。

---

## 6. 图片反复 404 的根因与机制级修复

### 6.1 根因
图片 404 不是某一篇 md 写错，而是 **Obsidian 插件配置改了但没重载**：运行实例用旧配置，粘图时写出 `./标题/图片.webp`（带前缀）和 `标题-时间戳.webp`（带前缀文件名）。证据：新文章在改配置之后创建，却仍带前缀、文件名也对不上磁盘模板。

### 6.2 机制级修复（一次性，无需逐篇改 md）
在仓库 `scripts/asset-link-normalize.js` 增加一个 **Hexo 构建期过滤器**，自动剥离 `./标题/` 前缀：

```js
// scripts/asset-link-normalize.js
// 根因兜底：Obsidian 偶尔会插入 "./<帖子名>/图片" 形式的链接，
// Hexo 的 post_asset_folder 需要纯文件名。此过滤器在构建期自动剥离 "./<slug>/" 前缀，
// 使图片无论 Obsidian 怎么写都能正确解析（系统性修复，无需逐篇改 md）。
const path = require('path');

hexo.extend.filter.register('before_post_render', function (data) {
  if (!data || !data.source || typeof data.content !== 'string') return data;
  const slug = path.basename(data.source, path.extname(data.source));
  if (!slug) return data;
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('\\(\\./' + escaped + '/', 'g');
  data.content = data.content.replace(re, '(');
  return data;
});
```

> 实测：即使 md 故意写 `./test2/test2-xxx.webp`，构建后 HTML 仍是正确 `/2026/08/30/test2/test2-xxx.webp`，图片正常。
> Hexo 会自动加载 `scripts/` 下的 JS，无需额外安装。

---

## 7. 标准写作 → 发布流程

```bash
# 1) 本地建帖子（生成 .md + 同名资源文件夹）
hexo new "文章标题"
```
1. Obsidian 打开 `source/_posts/文章标题.md` 写作。
2. 正文 `Ctrl+V` 粘截图 → 图片自动存进资源文件夹，并插入正确链接（重启 Obsidian 后应为 `![](file-时间戳.webp)`）。
3. PDF 等手动放 `source/files/`，引用写 `[点击下载](/files/xxx.pdf)`。
4. **Obsidian Git 自动 commit + push**（或手动 `Obsidian Git: Commit and push` / `npm run pub`）。
5. 约 1 分钟后 Cloudflare 重建完成，访问域名即可见图文。

**备用一键发布脚本**（仓库根，双击 `publish.bat` 或 `node publish.mjs`）：`git add -A && git commit && git push`。

---

## 8. .gitignore 与红线

仓库根 `.gitignore`（**必须包含以下，否则 `db.json`/`public` 进 git 会污染缓存导致图片错乱**）：
```
.deploy_git/
node_modules/
public/
db.json
.obsidian/
.DS_Store
*.log
```

Workers Free 红线：
| 限制 | 数值 | 后果 |
| --- | --- | --- |
| 单版本**文件数** | 20,000 | 超限部署失败；图片/PDF 都计入 |
| 单个**文件大小** | 25 MiB | 超限部署直接失败 |

- 小图（截图、配图）走 GitHub 没问题；别塞几十 MB 原图/大量照片/视频。
- 单文件 > 25 MiB 或图片极多 → 改用 **Cloudflare R2**（免费 10GB + 零出流量费）。

---

## 9. 排错速查表

| 症状                                            | 优先排查                                                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| push 报 443 / publickey / not found / rejected | 见 2.4                                                                                                                                   |
| 构建报 submodule / 0 files / EJSONPARSE          | 见 3.3                                                                                                                                   |
| 图片在 Obsidian 正常、线上 404                        | ① md 链接是否带 `./标题/` 前缀（加了过滤器也会自动修，但最好重启 Obsidian 让链接本身就干净）② 查 Cloudflare 构建日志确认 `public/2026/08/30/...webp` 已生成 ③ 硬刷新 / Purge Everything |
| 线上整站样式崩                                       | 主题 `themes/butterfly` 未进 git → 克隆后 `rm -rf themes/butterfly/.git` 提交                                                                    |
| 新文章又出现 `./标题/` 前缀                             | **Obsidian 没重启**，插件用旧配置 → 重启 Obsidian（过滤器仍会兜底，但文件名会带 `标题-` 前缀，难看）                                                                       |

---

## 10. 本地预览验证

```bash
hexo clean && hexo s    # 起 http://127.0.0.1:4000 看图片是否显示
# 或仅构建检查产物：
rm -rf public db.json && hexo generate
# 应有 public/2026/08/30/标题/xxx.webp，且 index.html 里 <img src="/2026/08/30/标题/xxx.webp">
```

满意再 push 上线。
