'use strict';

/**
 * Permanent fix for the Obsidian + Hexo image 404 problem.
 *
 * Root cause:
 *   Obsidian's "Custom Attachment Location" plugin (attachmentFolderPath = ./"${noteFileName}") inserts
 *   image links like  ![](./test2/test2-xxx.webp)  (note-folder prefix included).
 *   Hexo's postAsset resolver only matches BARE filenames: it does
 *     PostAsset.findById( join(postPath, "./test2/test2-xxx.webp") )
 *   = source/_posts/test2/./test2/test2-xxx.webp  -> not found -> falls back to a root-relative URL
 *     /test2/test2-xxx.webp  (date segment dropped) -> 404.
 *   A bare filename  ![](test2-xxx.webp)  matches -> /2026/08/30/test2/test2-xxx.webp.
 *
 * This patch intercepts the marked renderer's image() method. When the link carries a folder prefix
 * but its BASENAME matches a file in the post's own asset folder, we resolve it to the correct
 * asset URL first. Works for every post, past and future, independent of what Obsidian writes.
 */

const { posix } = require('path');

hexo.extend.filter.register('marked:renderer', function (renderer) {
  const originalImage = renderer.image ? renderer.image.bind(renderer) : null;

  renderer.image = function (href, title, text) {
    const { hexo, options } = this;
    const { relative_link } = hexo.config;
    const { prependRoot, postPath } = options;

    // Only touch local, post-asset links that carry a directory prefix.
    if (
      postPath &&
      prependRoot &&
      !relative_link &&
      typeof href === 'string' &&
      !/^(#|\/\/|http(s)?:)/.test(href) &&
      !href.startsWith('/') &&
      !href.startsWith('\\')
    ) {
      const normalized = href.replace(/\\/g, '/');
      const base = posix.basename(normalized);
      if (base && base !== normalized) {
        const PostAsset = hexo.model('PostAsset');
        const alt = PostAsset.findById(posix.join(postPath, base));
        if (alt) {
          const { url_for, encodeURL } = require('hexo-util');
          href = url_for.call(hexo, alt.path.replace(/\\/g, '/'));
          let out = `<img src="${encodeURL(href)}"`;
          if (text) out += ` alt="${text}"`;
          if (title) out += ` title="${title}"`;
          if (options.lazyload) out += ' loading="lazy"';
          out += '>';
          if (options.figcaption && text) {
            return `<figure>${out}<figcaption aria-hidden="true">${text}</figcaption></figure>`;
          }
          return out;
        }
      }
    }

    return originalImage ? originalImage(href, title, text) : `<img src="${href}">`;
  };

  return renderer;
});
