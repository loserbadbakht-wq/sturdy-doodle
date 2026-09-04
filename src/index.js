// Cloudflare Worker - Streaming Proxy with Advanced Features
// Usage: https://your-worker.workers.dev/https://example.com/video.m3u8

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// ============================
// Configuration
// ============================
const config = {
  proxyDomains: [],
  separator: '',
  homepage: true,
  allowedDomains: [],
  browserEmulation: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    acceptLanguage: 'en-US,en;q=0.9',
    acceptEncoding: 'gzip, deflate, br',
    connection: 'keep-alive',
    upgradeInsecureRequests: '1',
    secFetchDest: 'document',
    secFetchMode: 'navigate',
    secFetchSite: 'none',
    secFetchUser: '?1',
  },
  fallback: {
    enabled: true,
    autoReload: true,
  },
  specialSites: {
    wikipedia: {
      enabled: true,
      domains: ['wikipedia.org', 'wikimedia.org', 'mediawiki.org']
    }
  }
};

// ============================
// URL Rewriting Classes
// ============================
class UrlRewriter {
  constructor(baseUrl, proxyBase) {
    this.baseUrl = baseUrl;
    this.proxyBase = proxyBase;
  }

  rewrite(url) {
    if (!url) return url;
    if (/^(javascript:|data:|mailto:|#|blob:|about:)/i.test(url)) return url;
    if (url.startsWith(this.proxyBase)) return url;

    let absolute;
    try {
      absolute = new URL(url, this.baseUrl).href;
    } catch (e) {
      return url;
    }
    return `${this.proxyBase}/${absolute}`;
  }

  rewriteSrcset(srcset) {
    if (!srcset) return srcset;
    return srcset.split(',').map(part => {
      const [url, ...rest] = part.trim().split(/\s+/);
      if (!url) return part;
      return [this.rewrite(url), ...rest].join(' ');
    }).join(', ');
  }

  rewriteStyle(style) {
    if (!style) return style;
    return style.replace(/url\((['"]?)(.*?)\1\)/gi, (match, quote, url) => {
      if (!url || /^(javascript:|data:|#)/i.test(url)) return match;
      const rewritten = this.rewrite(url);
      return `url(${quote}${rewritten}${quote})`;
    });
  }

  element(el) {
    const attrs = ['href', 'src', 'action', 'poster', 'data-src', 'data-href'];
    for (const attr of attrs) {
      const value = el.getAttribute(attr);
      if (value) el.setAttribute(attr, this.rewrite(value));
    }
    const srcset = el.getAttribute('srcset');
    if (srcset) el.setAttribute('srcset', this.rewriteSrcset(srcset));
    const style = el.getAttribute('style');
    if (style) el.setAttribute('style', this.rewriteStyle(style));
  }
}

class MetaContentRewriter {
  constructor(baseURL, proxyDomain) {
    this.baseURL = baseURL;
    this.proxyDomain = proxyDomain;
  }
  element(element) {
    const httpEquiv = element.getAttribute('http-equiv');
    const content = element.getAttribute('content');
    if (httpEquiv && httpEquiv.toLowerCase() === 'refresh' && content) {
      const parts = content.split(';url=');
      if (parts.length === 2) {
        try {
          const url = new URL(parts[1], this.baseURL);
          element.setAttribute('content', `${parts[0]};url=${this.proxyDomain}/${url.href}`);
        } catch (e) {}
      }
    }
    const property = element.getAttribute('property') || element.getAttribute('name');
    if (property && content && (property.includes('og:image') || property.includes('og:url') || property.includes('twitter:image'))) {
      try {
        const url = new URL(content, this.baseURL);
        element.setAttribute('content', `${this.proxyDomain}/${url.href}`);
      } catch (e) {}
    }
  }
}

class BaseTagRewriter {
  constructor(baseURL, proxyDomain) {
    this.baseURL = baseURL;
    this.proxyDomain = proxyDomain;
  }
  element(element) {
    const href = element.getAttribute('href');
    if (href) {
      try {
        const url = new URL(href, this.baseURL);
        element.setAttribute('href', `${this.proxyDomain}/${url.href}`);
      } catch (e) {}
    }
  }
}

class StyleElementRewriter {
  constructor(baseURL, proxyDomain) {
    this.baseURL = baseURL;
    this.proxyDomain = proxyDomain;
  }
  text(text) {
    const rewrittenCSS = rewriteCSS(text.text, this.baseURL, this.proxyDomain);
    text.replace(rewrittenCSS);
  }
}

// ============================
// HLS Playlist Rewriting
// ============================
function rewriteM3U8(content, baseUrl, proxyBase) {
  const lines = content.split('\n');
  const rewritten = lines.map(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) {
      if (line.startsWith('#EXT-X-KEY') || line.startsWith('#EXT-X-MEDIA') || line.startsWith('#EXT-X-MAP')) {
        return line.replace(/URI="([^"]*)"/i, (match, uri) => {
          const abs = new URL(uri, baseUrl).href;
          return `URI="${proxyBase}/${abs}"`;
        });
      }
      return line;
    }
    const abs = new URL(line, baseUrl).href;
    return `${proxyBase}/${abs}`;
  });
  return rewritten.join('\n');
}

// ============================
// CSS URL Rewriting
// ============================
function rewriteCSS(css, baseURL, proxyDomain) {
  if (!css) return css;

  css = css.replace(/@import\s+(?:url\(\s*['"]?([^'")]+)['"]?\s*\)|['"]([^'"]+)['"]).*/g,
    function(match, urlMatch, directMatch) {
      const importUrl = urlMatch || directMatch;
      if (!importUrl || importUrl.startsWith('data:') || importUrl.startsWith(`https://${proxyDomain}/`)) return match;
      try {
        let normalized = importUrl;
        if (normalized.startsWith('//')) normalized = baseURL.protocol + normalized;
        const absolute = new URL(normalized, baseURL).href;
        return match.replace(importUrl, `https://${proxyDomain}/${absolute}`);
      } catch (e) { return match; }
    }
  );

  css = css.replace(/url\(\s*(['"]?)([^'")]+)(['"]?)\s*\)/g,
    function(match, quote1, url, quote2) {
      if (!url || url.startsWith('data:') || url.startsWith(`https://${proxyDomain}/`)) return match;
      try {
        let normalized = url;
        if (normalized.startsWith('//')) normalized = baseURL.protocol + normalized;
        const absolute = new URL(normalized, baseURL).href;
        return `url(${quote1}https://${proxyDomain}/${absolute}${quote2})`;
      } catch (e) { return match; }
    }
  );

  css = css.replace(/image-set\(\s*(?:[^)]|(?:\([^)]*\)))+\)/g, function(match) {
    return match.replace(/url\(\s*(['"]?)([^'")]+)(['"]?)\s*\)/g, function(urlMatch, q1, u, q2) {
      if (!u || u.startsWith('data:') || u.startsWith(`https://${proxyDomain}/`)) return urlMatch;
      try {
        let nu = u;
        if (nu.startsWith('//')) nu = baseURL.protocol + nu;
        const abs = new URL(nu, baseURL).href;
        return `url(${q1}https://${proxyDomain}/${abs}${q2})`;
      } catch (e) { return urlMatch; }
    });
  });

  return css;
}

// ============================
// JavaScript URL Rewriting (server-side)
// ============================
function rewriteJavaScript(js, baseURL, proxyDomain) {
  if (!js) return js;
  return js
    .replace(/'(https?:\/\/[^']+)'/g, (m, url) => {
      if (url.startsWith(`https://${proxyDomain}/`)) return m;
      return `'https://${proxyDomain}/${url}'`;
    })
    .replace(/"(https?:\/\/[^"]+)"/g, (m, url) => {
      if (url.startsWith(`https://${proxyDomain}/`)) return m;
      return `"https://${proxyDomain}/${url}"`;
    })
    .replace(/`(https?:\/\/[^`$]+)`/g, (m, url) => {
      if (url.startsWith(`https://${proxyDomain}/`)) return m;
      return `\`https://${proxyDomain}/${url}\``;
    });
}

// ============================
// Client-side URL Interception & Fallback
// ============================
class HeadRewriter {
  constructor(originalURL, proxyBase) {
    this.originalURL = originalURL;
    this.proxyBase = proxyBase;
  }

  element(element) {
    element.prepend(`
      <script>
        window.__proxy_base__ = ${JSON.stringify(this.proxyBase)};
        window.__target_url__ = ${JSON.stringify(this.originalURL)};
        (function() {
          const proxyBase = window.__proxy_base__;
          const targetUrl = window.__target_url__;
          function rewriteUrl(url) {
            if (!url) return url;
            if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('blob:')) return url;
            if (url.startsWith(proxyBase)) return url; // already proxied
            if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
              return proxyBase + '/' + url;
            }
            try {
              const absolute = new URL(url, targetUrl).href;
              return proxyBase + '/' + absolute;
            } catch (e) {
              return url;
            }
          }

          const originalFetch = window.fetch;
          window.fetch = function(input, init) {
            if (typeof input === 'string') {
              input = rewriteUrl(input);
            } else if (input instanceof Request) {
              const oldUrl = input.url;
              const newUrl = rewriteUrl(oldUrl);
              if (newUrl !== oldUrl) {
                input = new Request(newUrl, input);
              }
            }
            return originalFetch.call(this, input, init);
          };

          const originalOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url, ...args) {
            url = rewriteUrl(url);
            return originalOpen.call(this, method, url, ...args);
          };

          const originalSendBeacon = navigator.sendBeacon;
          navigator.sendBeacon = function(url, data) {
            url = rewriteUrl(url);
            return originalSendBeacon.call(this, url, data);
          };
        })();
      </script>
    `, { html: true });

    element.append(`
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          document.querySelectorAll('img').forEach(img => {
            if (!img.hasAttribute('data-original-src')) {
              const originalSrc = new URL(img.src).pathname.slice(1);
              img.setAttribute('data-original-src', originalSrc);
              img.setAttribute('onerror', "this.onerror=null;if(this.src!==this.dataset.originalSrc){this.src=this.dataset.originalSrc;}");
            }
          });
          document.querySelectorAll('a[target="_blank"]').forEach(link => {
            link.addEventListener('click', function(e) {
              if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
              e.preventDefault();
              window.open(link.href, '_blank');
            });
          });
          if (document.querySelector('body.mediawiki')) {
            document.querySelectorAll('img[data-src]').forEach(img => {
              if (!img.src && img.dataset.src) img.src = img.dataset.src;
            });
          }
        });
      </script>
    `, { html: true });
  }
}

// ============================
// Main Handler
// ============================
async function handleRequest(request) {
  const url = new URL(request.url);
  const proxyBase = `${url.protocol}//${url.host}`;

  if (url.pathname === '/' && request.method === 'GET' && !url.search) {
    if (config.homepage) return getHomePage(proxyBase);
  }

  let targetUrl;
  try {
    let targetPath = url.pathname.slice(1);
    if (!targetPath) {
      if (url.searchParams.has('q')) {
        targetUrl = new URL('https://duckduckgo.com/');
        url.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));
      } else {
        return new Response('Missing target URL. Usage: ' + proxyBase + '/https://example.com', { status: 400 });
      }
    } else {
      if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
        targetUrl = new URL(targetPath);
      } else {
        let resolved = null;
        const ref = request.headers.get('Referer') || '';
        if (ref.startsWith(`${proxyBase}/`)) {
          let refInner = ref.substring(`${proxyBase}/`.length);
          if (refInner.startsWith('http://') || refInner.startsWith('https://')) {
            try {
              const baseRefURL = new URL(refInner);
              resolved = new URL(targetPath, baseRefURL);
            } catch {}
          }
        }
        if (resolved) {
          targetUrl = resolved;
        } else {
          if (targetPath.includes('.') && !targetPath.includes('/')) {
            targetUrl = new URL('https://' + targetPath);
          } else {
            const q = encodeURIComponent(targetPath);
            targetUrl = new URL(`https://duckduckgo.com/?q=${q}${url.search ? '&' + url.search.substring(1) : ''}`);
          }
        }
      }
    }

    if (targetPath && (targetPath.startsWith('http://') || targetPath.startsWith('https://')) && url.searchParams.toString()) {
      url.searchParams.forEach((value, key) => {
        if (key !== 'url') targetUrl.searchParams.set(key, value);
      });
    }

    if (config.allowedDomains.length > 0) {
      const isAllowed = config.allowedDomains.some(domain =>
        targetUrl.hostname === domain || targetUrl.hostname.endsWith(`.${domain}`)
      );
      if (!isAllowed) {
        return new Response('Domain not in whitelist', { status: 403 });
      }
    }
  } catch (e) {
    return new Response(`URL parsing error: ${e.message}`, { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  const isWikipediaSite = config.specialSites.wikipedia.enabled &&
    config.specialSites.wikipedia.domains.some(d => targetUrl.hostname.endsWith(d));

  // Build request headers with browser emulation
  const requestHeaders = new Headers();
  // Copy essential original headers
  ['cookie', 'range', 'if-none-match', 'if-modified-since', 'content-type', 'content-length'].forEach(h => {
    if (request.headers.has(h)) requestHeaders.set(h, request.headers.get(h));
  });

  // Browser emulation
  requestHeaders.set('User-Agent', config.browserEmulation.userAgent);
  requestHeaders.set('Accept', config.browserEmulation.accept);
  requestHeaders.set('Accept-Language', config.browserEmulation.acceptLanguage);
  requestHeaders.set('Accept-Encoding', config.browserEmulation.acceptEncoding);
  requestHeaders.set('Connection', config.browserEmulation.connection);
  requestHeaders.set('Upgrade-Insecure-Requests', config.browserEmulation.upgradeInsecureRequests);
  requestHeaders.set('Sec-Fetch-Dest', config.browserEmulation.secFetchDest);
  requestHeaders.set('Sec-Fetch-Mode', config.browserEmulation.secFetchMode);
  requestHeaders.set('Sec-Fetch-Site', config.browserEmulation.secFetchSite);
  requestHeaders.set('Sec-Fetch-User', config.browserEmulation.secFetchUser);
  requestHeaders.set('Host', targetUrl.host);

  // Handle Referer and Origin carefully to avoid 403s
  const originalReferer = request.headers.get('Referer');
  const originalOrigin = request.headers.get('Origin');

  if (originalReferer) {
    const refererUrl = new URL(originalReferer);
    if (refererUrl.host === url.host) {
      // It's a proxied referer; extract the actual target URL
      let inner = refererUrl.pathname.slice(1);
      if (inner.startsWith('http://') || inner.startsWith('https://')) {
        requestHeaders.set('Referer', inner);
      } else {
        requestHeaders.set('Referer', targetUrl.origin);
      }
    } else {
      // Direct referer from elsewhere, forward as-is
      requestHeaders.set('Referer', originalReferer);
    }
  } else {
    // No referer; omit (do not set)
  }

  if (originalOrigin) {
    const originUrl = new URL(originalOrigin);
    if (originUrl.host === url.host) {
      requestHeaders.set('Origin', targetUrl.origin);
    } else {
      requestHeaders.set('Origin', originalOrigin);
    }
  } else {
    // No origin; omit. For direct m3u8, many servers reject an Origin header, so we ensure it's not set.
    if (targetUrl.pathname.endsWith('.m3u8')) {
      requestHeaders.delete('Origin');
    }
  }

  const fetchOptions = {
    method: request.method,
    headers: requestHeaders,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  };

  try {
    const response = await fetch(targetUrl.href, fetchOptions);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-security-policy');
    responseHeaders.delete('content-security-policy-report-only');
    responseHeaders.delete('x-frame-options');
    responseHeaders.delete('strict-transport-security');
    responseHeaders.set('access-control-allow-origin', '*');
    responseHeaders.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    responseHeaders.set('access-control-allow-headers', '*');
    responseHeaders.set('access-control-allow-credentials', 'true');
    responseHeaders.set('x-proxied-by', 'cloudflare-worker-streaming-proxy');

    const setCookies = response.headers.getAll ? response.headers.getAll('Set-Cookie') : [];
    if (setCookies.length > 0) {
      setCookies.forEach(cookie => responseHeaders.append('Set-Cookie', cookie));
    }

    if ([301, 302, 307, 308].includes(response.status)) {
      const location = responseHeaders.get('Location');
      if (location) {
        try {
          const redirectURL = new URL(location, targetUrl);
          responseHeaders.set('Location', `${proxyBase}/${redirectURL.href}`);
        } catch (e) {}
      }
    }

    const contentType = responseHeaders.get('content-type') || '';

    if (contentType.includes('text/html')) {
      const originalHtml = await response.text();
      let rewriter = new HTMLRewriter()
        .on('a[href]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('link[href]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('script[src]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('img[src]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('img[srcset]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('form[action]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('source[src]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('source[srcset]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('video[poster]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('audio[src]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('iframe[src]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('object[data]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('embed[src]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('[style]', new UrlRewriter(targetUrl.href, proxyBase))
        .on('meta[content]', new MetaContentRewriter(targetUrl, proxyBase))
        .on('base[href]', new BaseTagRewriter(targetUrl, proxyBase))
        .on('style', new StyleElementRewriter(targetUrl, proxyBase));

      if (isWikipediaSite) {
        rewriter = rewriter.on('img[data-src]', new UrlRewriter(targetUrl.href, proxyBase));
      }

      rewriter = rewriter.on('head', new HeadRewriter(targetUrl.href, proxyBase));

      const originalResponse = new Response(originalHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      const transformed = rewriter.transform(originalResponse);
      const rewrittenHtml = await transformed.text();

      return new Response(rewrittenHtml, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    else if (contentType.includes('text/css') || contentType.includes('application/x-stylesheet')) {
      const cssText = await response.text();
      const rewrittenCSS = rewriteCSS(cssText, targetUrl, proxyBase);
      return new Response(rewrittenCSS, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    else if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
      const jsText = await response.text();
      const rewrittenJS = rewriteJavaScript(jsText, targetUrl, proxyBase);
      return new Response(rewrittenJS, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    else if (contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegurl') || targetUrl.pathname.endsWith('.m3u8')) {
      const playlist = await response.text();
      const rewritten = rewriteM3U8(playlist, targetUrl, proxyBase);
      return new Response(rewritten, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response(getErrorPage(error, targetUrl.href), {
      status: 502,
      headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

// ============================
// Landing Page (with Video.js and HLS support, and proxied custom sources)
// ============================
function getHomePage(proxyBase) {
  return new Response(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Streaming Proxy</title>
  <!-- Video.js CSS -->
  <link href="//vjs.zencdn.net/8.23.6/video-js.min.css" rel="stylesheet">
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f0f0f0;
      padding: 20px;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 700px;
      width: 90%;
    }
    h1 {
      margin-bottom: 1rem;
    }
    .input-group {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    input[type="text"] {
      flex: 1;
      padding: 0.75rem;
      font-size: 1rem;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    button {
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      background: #0070f3;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
    }
    button:hover {
      background: #0051a8;
    }
    .note {
      font-size: 0.85rem;
      color: #666;
      margin-top: 1rem;
    }
    code {
      background: #eee;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
    }
    .video-container {
      margin-top: 2rem;
      border-top: 1px solid #ddd;
      padding-top: 1.5rem;
    }
    .source-input {
      margin-top: 1rem;
      text-align: left;
    }
    .source-input label {
      font-weight: bold;
      display: block;
      margin-bottom: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Streaming Proxy</h1>
    <p>Enter a direct video URL (e.g., <code>.m3u8</code> or <code>.mp4</code>) or a simple website.</p>
    <form id="proxyForm">
      <div class="input-group">
        <input type="text" id="urlInput" placeholder="https://example.com/stream.m3u8" required>
        <button type="submit">Go</button>
      </div>
    </form>

    <!-- Video.js demo player -->
    <div class="video-container">
      <video
        id="my-player"
        class="video-js vjs-big-play-centered"
        controls
        preload="auto"
        poster="//vjs.zencdn.net/v/oceans.png"
        data-setup='{"fluid": true, "responsive": true, "playbackRates": [0.5, 1, 1.5, 2]}'
      >
        <source src="//vjs.zencdn.net/v/oceans.mp4" type="video/mp4"></source>
        <source src="//vjs.zencdn.net/v/oceans.webm" type="video/webm"></source>
        <source src="//vjs.zencdn.net/v/oceans.ogv" type="video/ogg"></source>
        <p class="vjs-no-js">
          To view this video please enable JavaScript, and consider upgrading to a
          web browser that
          <a href="https://videojs.com/html5-video-support/" target="_blank">
            supports HTML5 video
          </a>
        </p>
      </video>

      <!-- Custom source input -->
      <div class="source-input">
        <label for="videoUrlInput">Load custom video URL (MP4, WebM, OGG, HLS (.m3u8), DASH) — will be proxied:</label>
        <div class="input-group">
          <input type="text" id="videoUrlInput" placeholder="https://example.com/path/to/stream.m3u8">
          <button type="button" id="loadVideoBtn">Load Video</button>
        </div>
      </div>
    </div>

    <p class="note">Usage: <code>${proxyBase}/https://example.com/path</code><br>
    Complex sites (YouTube, Twitch) will NOT work due to JavaScript and WebSocket limitations.</p>
  </div>

  <!-- Video.js JavaScript -->
  <script src="//vjs.zencdn.net/8.23.6/video.min.js"></script>
  <!-- VHS (HTTP Streaming) plugin for HLS and DASH -->
  <script src="//cdn.jsdelivr.net/npm/@videojs/http-streaming@3.13.0/dist/videojs-http-streaming.min.js"></script>
  <script>
    document.getElementById('proxyForm').addEventListener('submit', function(e) {
      e.preventDefault();
      let input = document.getElementById('urlInput').value.trim();
      if (!input) return;
      if (!/^https?:\\/\\//i.test(input)) input = 'https://' + input;
      window.location.href = '/' + input;
    });

    // Initialize Video.js player
    var player = videojs('my-player', {
      fluid: true,
      responsive: true,
      playbackRates: [0.5, 1, 1.5, 2],
      controls: true,
      preload: 'auto',
      poster: '//vjs.zencdn.net/v/oceans.png'
    });

    // Load custom video URL through the proxy
    document.getElementById('loadVideoBtn').addEventListener('click', function() {
      var url = document.getElementById('videoUrlInput').value.trim();
      if (!url) {
        alert('Please enter a video URL');
        return;
      }
      // Ensure the URL has a protocol
      if (!/^https?:\\/\\//i.test(url)) {
        if (url.startsWith('//')) url = 'https:' + url;
        else if (!url.includes('://')) url = 'https://' + url;
      }

      // Build the proxied URL: current origin + '/' + original absolute URL
      var proxiedUrl = window.location.origin + '/' + url;

      // Determine MIME type from original URL
      var type = getTypeFromUrl(url);

      // Set source to the proxied URL and play
      player.src({ src: proxiedUrl, type: type });
      player.play();
    });

    // Helper to guess MIME type from URL
    function getTypeFromUrl(url) {
      const lower = url.toLowerCase();
      if (lower.includes('.m3u8')) return 'application/x-mpegURL';
      if (lower.includes('.mpd')) return 'application/dash+xml';
      if (lower.includes('.mp4')) return 'video/mp4';
      if (lower.includes('.webm')) return 'video/webm';
      if (lower.includes('.ogv') || lower.includes('.ogg')) return 'video/ogg';
      return undefined;
    }
  </script>
</body>
</html>`, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}

// ============================
// Error Page
// ============================
function getErrorPage(error, targetUrl) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proxy Error</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    .error-container { background-color: #f8d7da; color: #721c24; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
    .direct-access { background-color: #d4edda; color: #155724; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
    h1 { color: #d63031; }
    a.direct-link { display: inline-block; margin-top: 10px; color: #fff; background-color: #17a2b8; padding: 8px 16px; text-decoration: none; border-radius: 4px; }
    a.direct-link:hover { background-color: #138496; }
    .details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 20px; font-family: monospace; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Proxy Request Failed</h1>
  <div class="error-container"><strong>Error:</strong> ${error.message}</div>
  <div class="direct-access">
    <p>The proxy couldn't reach the requested resource. You can try to access it directly:</p>
    <a class="direct-link" href="${targetUrl}" target="_blank">Open ${targetUrl} directly</a>
  </div>
  <div class="details">Request URL: ${targetUrl}\nTime: ${new Date().toISOString()}</div>
</body>
</html>`;
  }
