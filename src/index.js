// Cloudflare Worker - Media Streaming Proxy (Video Only)
// Usage: https://your-worker.workers.dev/https://example.com/video.m3u8

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// ============================
// Configuration
// ============================
const config = {
  separator: '',
  browserEmulation: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
    accept: '*/*',
    acceptLanguage: 'en-US,en;q=0.9',
    acceptEncoding: 'gzip, deflate, br',
    connection: 'keep-alive',
  }
};

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
// Main Handler
// ============================
async function handleRequest(request) {
  const url = new URL(request.url);
  const proxyBase = `${url.protocol}//${url.host}`;

  // Homepage (video player only)
  if (url.pathname === '/' && request.method === 'GET' && !url.search) {
    return getHomePage(proxyBase);
  }

  // Parse target URL from path
  let targetPath = url.pathname.slice(1);
  if (!targetPath) {
    return new Response('Missing target URL. Usage: ' + proxyBase + '/https://example.com/video.m3u8', { status: 400 });
  }

  let targetUrl;
  try {
    if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
      targetUrl = new URL(targetPath);
    } else {
      return new Response('Invalid target URL. Must start with http:// or https://', { status: 400 });
    }

    // Copy query parameters from proxy URL to target URL (excluding 'url' if present)
    url.searchParams.forEach((value, key) => {
      if (key !== 'url') targetUrl.searchParams.set(key, value);
    });
  } catch (e) {
    return new Response(`URL parsing error: ${e.message}`, { status: 400 });
  }

  // Build request headers with browser emulation
  const requestHeaders = new Headers();

  ['cookie', 'range', 'if-none-match', 'if-modified-since', 'content-type', 'content-length'].forEach(h => {
    if (request.headers.has(h)) requestHeaders.set(h, request.headers.get(h));
  });

  requestHeaders.set('User-Agent', config.browserEmulation.userAgent);
  requestHeaders.set('Accept', config.browserEmulation.accept);
  requestHeaders.set('Accept-Language', config.browserEmulation.acceptLanguage);
  requestHeaders.set('Accept-Encoding', config.browserEmulation.acceptEncoding);
  requestHeaders.set('Connection', config.browserEmulation.connection);
  requestHeaders.set('Host', targetUrl.host);

  const originalReferer = request.headers.get('Referer');
  const originalOrigin = request.headers.get('Origin');

  if (originalReferer) {
    const refererUrl = new URL(originalReferer);
    if (refererUrl.host === url.host) {
      let inner = refererUrl.pathname.slice(1);
      if (inner.startsWith('http://') || inner.startsWith('https://')) {
        requestHeaders.set('Referer', inner);
      } else {
        requestHeaders.set('Referer', targetUrl.origin);
      }
    } else {
      requestHeaders.set('Referer', originalReferer);
    }
  }

  if (originalOrigin) {
    const originUrl = new URL(originalOrigin);
    if (originUrl.host === url.host) {
      requestHeaders.set('Origin', targetUrl.origin);
    } else {
      requestHeaders.set('Origin', originalOrigin);
    }
  } else {
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
    responseHeaders.set('x-proxied-by', 'cloudflare-worker-media-proxy');

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

    if (contentType.includes('application/vnd.apple.mpegurl') ||
        contentType.includes('application/x-mpegurl') ||
        targetUrl.pathname.endsWith('.m3u8')) {
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
// Landing Page (Video.js 10 web components)
// ============================
function getHomePage(proxyBase) {
  return new Response(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Media Proxy Player</title>
  <style>
    body {
      background-color: #141414;
      color: #ddd;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: 100vh;
      font-family: sans-serif;
      padding: 20px;
      margin: 0;
    }
    .container {
      width: 100%;
      max-width: 800px;
    }
    .player-container {
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      margin-bottom: 12px;
    }
    .input-group {
      padding: 8px 12px;
      background: #222;
      border-radius: 8px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    input[type="text"] {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #444;
      border-radius: 4px;
      background: #111;
      color: #fff;
      font-size: 13px;
      outline: none;
      transition: border 0.2s;
    }
    input[type="text"]:focus {
      border-color: #0070f3;
    }
    button {
      background: #0070f3;
      color: #fff;
      padding: 6px 14px;
      border-radius: 4px;
      font-weight: bold;
      border: none;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.2s;
    }
    button:hover {
      background: #0051a8;
    }
    .source-input {
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="player-container" id="playerContainer"></div>
    <div class="source-input">
      <div class="input-group">
        <input type="text" id="videoUrlInput" placeholder="Enter Video URL to Proxy">
        <button type="button" id="loadVideoBtn">Load Video</button>
      </div>
    </div>
  </div>

  <!-- Video.js 10 core (video-player + video-skin) -->
  <script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/cdn@10.2.0/video.js"></script>
  <!-- Live player (live-video-player + live-video-skin) -->
  <script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/cdn@10.2.0/live-video.js"></script>
  <!-- HLS media component (hlsjs-video) -->
  <script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/cdn@10.2.0/media/hlsjs-video.js"></script>

  <script type="module">
    const playersReady = Promise.all([
      customElements.whenDefined('video-player').catch(() => {}),
      customElements.whenDefined('live-video-player').catch(() => {}),
      customElements.whenDefined('hlsjs-video').catch(() => {}),
    ]);

    const DEFAULT_URL = 'https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/highest.mp4';

    function normalizeUrl(url) {
      if (!/^https?:\\/\\//i.test(url)) {
        if (url.startsWith('//')) url = 'https:' + url;
        else if (!url.includes('://')) url = 'https://' + url;
      }
      return url;
    }

    function isHlsUrl(url) {
      return /\\.m3u8(\\?|$)/i.test(url);
    }

    function toProxiedUrl(url) {
      return window.location.origin + '/' + url;
    }

    function safePlay(el) {
      const tryPlay = () => {
        try {
          const result = el.play && el.play();
          if (result && typeof result.catch === 'function') result.catch(() => {});
        } catch (e) {}
      };
      tryPlay();
      setTimeout(tryPlay, 100);
      setTimeout(tryPlay, 500);
    }

    async function buildPlayer(rawUrl) {
      await playersReady;
      const url = normalizeUrl(rawUrl);
      const proxiedUrl = toProxiedUrl(url);
      const container = document.getElementById('playerContainer');
      container.innerHTML = '';

      if (isHlsUrl(url)) {
        // HLS (live or VOD) -> live player + hlsjs media
        const player = document.createElement('live-video-player');
        const skin = document.createElement('live-video-skin');
        const media = document.createElement('hlsjs-video');
        media.setAttribute('src', proxiedUrl);
        media.setAttribute('playsinline', '');
        skin.appendChild(media);
        player.appendChild(skin);
        container.appendChild(player);
        safePlay(media);
      } else {
        // Plain video (mp4 / webm / ogv) -> video player + video media
        const player = document.createElement('video-player');
        const skin = document.createElement('video-skin');
        const media = document.createElement('video');
        media.setAttribute('src', proxiedUrl);
        media.setAttribute('playsinline', '');
        const fallback = document.createElement('a');
        fallback.href = 'https://videojs.org/help';
        fallback.textContent = 'Video player not working?';
        media.appendChild(fallback);
        skin.appendChild(media);
        player.appendChild(skin);
        container.appendChild(player);
        safePlay(media);
      }
    }

    document.getElementById('loadVideoBtn').addEventListener('click', function() {
      const url = document.getElementById('videoUrlInput').value.trim();
      if (!url) {
        alert('Please enter a video URL');
        return;
      }
      buildPlayer(url);
    });

    // Boot with a default stream
    buildPlayer(DEFAULT_URL);
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
    body { background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #ffffff; max-width: 800px; margin: 0 auto; padding: 20px; }
    .error-container { background-color: #721c24; color: #f8d7da; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
    .direct-access { background-color: #155724; color: #d4edda; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
    h1 { color: #d63031; }
    a.direct-link { display: inline-block; margin-top: 10px; color: #fff; background-color: #138496; padding: 8px 16px; text-decoration: none; border-radius: 4px; }
    a.direct-link:hover { background-color: #17a2b8; }
    .details { background-color: #121212; padding: 15px; border-radius: 4px; margin-top: 20px; font-family: monospace; white-space: pre-wrap; }
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
