#!/usr/bin/env node
// Hexo 一键发布脚本：git add + commit + push
// Cloudflare Workers Builds 绑定了 GitHub，push 到 main 即自动重建并上线。
//
// 用法：
//   node publish.mjs "提交说明"        （直接运行）
//   npm run pub -- "提交说明"          （通过 npm，-- 之后是传给脚本的参数）
//   不带参数时使用默认提交信息：site: update YYYY-MM-DD
//
// 注意：脚本需在 Hexo 仓库根目录运行（与 package.json / source/ 同级），
//       且当前分支应已跟踪 GitHub 的 main。

import { execSync } from 'node:child_process';

const raw = process.argv.slice(2).join(' ').trim();
const msg = raw || `site: update ${new Date().toISOString().slice(0, 10)}`;
const safe = msg.replace(/"/g, '\\"').replace(/\n/g, ' ');

function sh(cmd, failOk = false) {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch {
    if (!failOk) {
      console.error(`\n✗ 命令执行失败，已中止: ${cmd}`);
      process.exit(1);
    }
    return false;
  }
}

console.log('→ git add -A');
sh('git add -A');

console.log(`→ git commit -m "${msg}"`);
const committed = sh(`git commit -m "${safe}"`, true);
if (!committed) {
  console.log('ℹ 没有需要提交的更改，直接推送…');
}

console.log('→ git push');
sh('git push');

console.log('\n✓ 已推送。Cloudflare Workers Builds 将在约 1 分钟内自动重建并上线。');
