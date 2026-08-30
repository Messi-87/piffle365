// scripts/asset-link-normalize.js
// 根因兜底：Obsidian「Custom Attachment Location」插件在配置未重载时，
// 会把图片链接写成 "./<帖子名>/图片.webp" 形式。Hexo 的 post_asset_folder
// 机制要求链接是「纯文件名」，否则线上容易出现 404。
// 此过滤器在构建期自动剥离 "./<slug>/" 前缀，使图片无论 Obsidian 怎么写都能正确解析。
// 属于系统性修复，不需要逐篇手动改 md。
const path = require('path');

hexo.extend.filter.register('before_post_render', function (data) {
  if (!data || !data.source || typeof data.content !== 'string') return data;
  const slug = path.basename(data.source, path.extname(data.source));
  if (!slug) return data;
  // 转义正则特殊字符，避免 slug 中的 . * + 等导致错误
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 匹配 ![](./slug/xxx) 与 [文本](./slug/xxx) 两种写法，去掉 "./slug/" 前缀
  const re = new RegExp('\\(\\./' + escaped + '/', 'g');
  data.content = data.content.replace(re, '(');
  return data;
});
