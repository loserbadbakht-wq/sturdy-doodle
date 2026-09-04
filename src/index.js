// Cloudflare Worker - Streaming Proxy with HLS support
// Deploy and use like: https://your-worker.workers.dev/https://example.com/video.m3u8

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Helper: rewrite URLs inside HTML and CSS
class UrlRewriter {
  constructor(baseUrl, proxyBase) {
    this.baseUrl = baseUrl;      // original page URL (absolute)
    this.proxyBase = proxyBase;  // base URL of the proxy (e.g., https://worker.com)
  }

  // Rewrite a single URL
  rewrite(url) {
    if (!url) return url;
    if (/^(javascript:|data:|mailto:|#|blob:|about:)/i.test(url)) return url;
    if (url.startsWith(this.proxyBase)) return url; // already proxied

    let absolute;
    try {
      absolute = new URL(url, this.baseUrl).href;
    } catch (e) {
      return url;
    }
    return `${this.proxyBase}/${absolute}`;
  }

  // Rewrite srcset attribute
  rewriteSrcset(srcset) {
    if (!srcset) return srcset;
    return srcset.split(',').map(part => {
      const [url, ...rest] = part.trim().split(/\s+/);
      if (!url) return part;
      return [this.rewrite(url), ...rest].join(' ');
    }).join(', ');
  }

  // Rewrite inline styles (url(...))
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

// Rewrite M3U8 playlists (HLS)
function rewriteM3U8(content, baseUrl, proxyBase) {
  const lines = content.split('\n');
  const rewritten = lines.map(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) {
      // Handle #EXT-X-KEY URI, #EXT-X-MEDIA URI, etc.
      if (line.startsWith('#EXT-X-KEY') || line.startsWith('#EXT-X-MEDIA') || line.startsWith('#EXT-X-MAP')) {
        return line.replace(/URI="([^"]*)"/i, (match, uri) => {
          const abs = new URL(uri, baseUrl).href;
          return `URI="${proxyBase}/${abs}"`;
        });
      }
      return line;
    }
    // Segment line – must be a URL
    const abs = new URL(line, baseUrl).href;
    return `${proxyBase}/${abs}`;
  });
  return rewritten.join('\n');
}

// Main handler
async function handleRequest(request) {
  const url = new URL(request.url);
  const proxyBase = `${url.protocol}//${url.host}`;

  // If request is to root, show a simple form
  if (url.pathname === '/' && request.method === 'GET') {
    return new Response(getLandingPage(), {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  }

  // Parse target URL from the path
  // Path format: /https://example.com/path
  let targetPath = url.pathname.slice(1); // remove leading slash
  if (!targetPath) {
    return new Response('Missing target URL. Usage: ' + proxyBase + '/https://example.com', { status: 400 });
  }
  // Reconstruct full target URL
  let targetUrl;
  try {
    targetUrl = new URL(targetPath);
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      throw new Error('Unsupported protocol');
    }
  } catch (e) {
    return new Response('Invalid target URL: ' + e.message, { status: 400 });
  }

  // Merge query parameters from the proxy URL to the target URL (except 'url' param)
  url.searchParams.forEach((value, key) => {
    if (key !== 'url') targetUrl.searchParams.set(key, value);
  });

  // Prepare request headers: forward most, but set Host to target
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Host', targetUrl.host);
  // Remove proxy-specific headers
  requestHeaders.delete('cf-connecting-ip');
  requestHeaders.delete('cf-ray');
  requestHeaders.delete('x-forwarded-for');
  requestHeaders.delete('x-forwarded-proto');

  const fetchOptions = {
    method: request.method,
    headers: requestHeaders,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'follow',
  };

  try {
    const response = await fetch(targetUrl.href, fetchOptions);

    // Copy response headers
    const responseHeaders = new Headers(response.headers);
    // Remove problematic headers
    responseHeaders.delete('content-security-policy');
    responseHeaders.delete('content-security-policy-report-only');
    responseHeaders.delete('x-frame-options');
    responseHeaders.delete('strict-transport-security');
    responseHeaders.set('access-control-allow-origin', '*');
    responseHeaders.set('x-proxied-by', 'cloudflare-worker-streaming-proxy');

    const contentType = responseHeaders.get('content-type') || '';

    // Handle different content types
    if (contentType.includes('text/html')) {
      // HTML: rewrite URLs and inject <base>
      const originalHtml = await response.text();
      const rewriter = new HTMLRewriter()
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
        .on('[style]', new UrlRewriter(targetUrl.href, proxyBase));

      // Inject <base> tag as first element in <head>
      let htmlWithBase = originalHtml.replace(/<head([^>]*)>/i, `<head$1><base href="${proxyBase}/${targetUrl.href}">`);
      const rewrittenHtml = rewriter.transform(htmlWithBase);
      return new Response(rewrittenHtml, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } else if (contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegurl') || targetUrl.pathname.endsWith('.m3u8')) {
      // HLS playlist: rewrite segment URLs
      const originalPlaylist = await response.text();
      const rewrittenPlaylist = rewriteM3U8(originalPlaylist, targetUrl.href, proxyBase);
      return new Response(rewrittenPlaylist, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } else {
      // All other content: stream as-is
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }
  } catch (error) {
    return new Response('Proxy error: ' + error.message, { status: 502 });
  }
}

function getLandingPage() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Streaming Proxy</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f0f0; }
    .container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 500px; width: 90%; }
    input[type="text"] { width: 100%; padding: 0.75rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px; }
    button { margin-top: 1rem; padding: 0.75rem 1.5rem; font-size: 1rem; background: #0070f3; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0051a8; }
    .note { font-size: 0.85rem; color: #666; margin-top: 1rem; }
    code { background: #eee; padding: 0.2rem 0.4rem; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Streaming Proxy</h1>
    <p>Enter a direct video URL (e.g., <code>.m3u8</code> or <code>.mp4</code>) or a simple streaming page.</p>
    <form id="proxyForm">
      <input type="text" id="urlInput" placeholder="https://example.com/stream.m3u8" required>
      <button type="submit">Go</button>
    </form>
    <p class="note">Usage: <code>https://your-worker.workers.dev/https://example.com/path</code><br>
    Complex sites (YouTube, Twitch) will NOT work due to JavaScript and WebSocket limitations.</p>
  </div>
  <script>
    document.getElementById('proxyForm').addEventListener('submit', function(e) {
      e.preventDefault();
      let input = document.getElementById('urlInput').value.trim();
      if (!input) return;
      if (!/^https?:\\/\\//i.test(input)) input = 'https://' + input;
      window.location.href = '/' + input;
    });
  </script>
</body>
</html>`;
      }
