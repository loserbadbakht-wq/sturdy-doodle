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
// Landing Page (YouTube-style UI + Video.js 10 player)
// ============================
function getHomePage(proxyBase) {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#0f0f0f">
  <title>YouTube</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: #0f0f0f;
      color: #f1f1f1;
      font-family: Roboto, "YouTube Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -webkit-tap-highlight-color: transparent;
      padding-bottom: 64px;
    }
    .shell { max-width: 480px; margin: 0 auto; }

    /* ---------- Player ---------- */
    .player-wrap {
      width: 100%; aspect-ratio: 16 / 9; background: #000; position: relative;
    }
    #playerContainer,
    #playerContainer > *,
    #playerContainer video-player,
    #playerContainer live-video-player,
    #playerContainer video-skin,
    #playerContainer live-video-skin {
      display: block; width: 100%; height: 100%;
    }

    /* ---------- Video meta ---------- */
    .video-title {
      margin: 12px 12px 4px; font-size: 16px; font-weight: 700;
      line-height: 1.3; word-break: break-word;
    }
    .meta-line { padding: 0 12px; font-size: 12px; color: #aaa; margin-bottom: 12px; }

    /* ---------- Search row (under video name) ---------- */
    .search-row {
      padding: 0 12px 14px;
    }
    .search-form {
      display: flex; align-items: center; gap: 6px;
      height: 40px; padding: 0 4px 0 14px;
      background: #121212; border: 1px solid #303030; border-radius: 20px;
    }
    .search-form:focus-within { border-color: #1c62b9; }
    .search-form input {
      flex: 1; min-width: 0; height: 100%;
      background: transparent; border: 0; outline: 0;
      color: #f1f1f1; font-size: 14px; font-family: inherit;
    }
    .search-form input::placeholder { color: #888; }
    .search-form button {
      width: 32px; height: 32px; flex: 0 0 auto;
      display: inline-flex; align-items: center; justify-content: center;
      border: 0; border-radius: 50%; background: #272727;
      color: #f1f1f1; cursor: pointer;
    }
    .search-form button:active { background: #3f3f3f; }
    .search-form button svg { width: 18px; height: 18px; }

    /* ---------- Channel name ---------- */
    .channel-name-row { padding: 0 12px 12px; }
    .channel-name { font-size: 14px; font-weight: 500; color: #f1f1f1; }
    .channel-subs { font-size: 12px; color: #aaa; }

    /* ---------- Description ---------- */
    .description {
      margin: 0 12px 12px; padding: 12px;
      background: #272727; border-radius: 12px;
      font-size: 13px; line-height: 1.45;
    }
    .description .desc-title { font-weight: 500; margin-bottom: 4px; }
    .description .desc-sub { color: #aaa; font-size: 12px; word-break: break-all; }

    /* ---------- Comments ---------- */
    .comments { padding: 4px 12px 20px; }
    .comments-head {
      display: flex; align-items: center; gap: 8px;
      font-size: 14px; font-weight: 500;
    }
    .comments-head svg { width: 20px; height: 20px; fill: currentColor; }

    /* ---------- Bottom nav ---------- */
    .bottom-nav {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 60;
      margin: 0 auto; max-width: 480px;
      display: flex; padding: 6px 0 8px;
      background: #0f0f0f; border-top: 1px solid #272727;
    }
    .nav-item {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      gap: 3px; padding: 2px 0; border: 0; background: none;
      color: #aaa; font-size: 10px; font-family: inherit; cursor: pointer;
    }
    .nav-item svg { width: 24px; height: 24px; fill: currentColor; display: block; }
    .nav-item.active { color: #f1f1f1; }
  </style>
</head>
<body>
  <div class="shell">
    <main>
      <!-- Video.js 10 player mounts here -->
      <div class="player-wrap">
        <div id="playerContainer"></div>
      </div>

      <h1 class="video-title" id="videoTitle">Loading…</h1>
      <div class="meta-line" id="metaLine">Proxied stream</div>

      <!-- URL bar (under video name) -->
      <div class="search-row">
        <form class="search-form" id="searchForm" autocomplete="off">
          <input type="text" id="videoUrlInput" placeholder="Paste a video or .m3u8 URL" spellcheck="false">
          <button type="submit" aria-label="Load">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7"/>
              <path d="m20 20-3.5-3.5" stroke-linecap="round"/>
            </svg>
          </button>
        </form>
      </div>

      <div class="channel-name-row">
        <div class="channel-name">Media Proxy</div>
        <div class="channel-subs">Cloudflare Worker</div>
      </div>

      <div class="description">
        <div class="desc-title">Media Proxy Player</div>
        <div class="desc-sub" id="descUrl">Paste any direct video URL (mp4 / webm) or an HLS playlist (.m3u8) in the field above. Playback is proxied through this Cloudflare Worker.</div>
      </div>

      <div class="comments">
        <div class="comments-head">
          <svg viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/></svg>
          <span>Comments</span>
        </div>
      </div>
    </main>
  </div>

  <!-- Bottom navigation -->
  <nav class="bottom-nav">
    <button class="nav-item active" type="button">
      <svg viewBox="0 0 24 24"><path d="M12 3 2 12h3v8h6v-6h2v6h6v-8h3z"/></svg>
      Home
    </button>
    <button class="nav-item" type="button">
      <svg viewBox="0 0 24 24"><path d="M17.77 10.32 10.9 6.36a2 2 0 0 0-3 1.74v7.8a2 2 0 0 0 3 1.74l6.87-3.96a2 2 0 0 0 0-3.36z"/></svg>
      Shorts
    </button>
    <button class="nav-item" type="button">
      <svg viewBox="0 0 24 24"><path d="M20 8H4V6h16v2zm-2-6H6v2h12V2zm4 10v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2zm-6 4-6-3.27v6.54L16 16z"/></svg>
      Subscriptions
    </button>
    <button class="nav-item" type="button">
      <svg viewBox="0 0 24 24"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z"/></svg>
      You
    </button>
  </nav>

  <!-- Video.js 10 core (video-player + video-skin) -->
  <script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/cdn@10.2.0/video.js"></script>
  <!-- Live player (live-video-player + live-video-skin) -->
  <script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/cdn@10.2.0/live-video.js"></script>
  <!-- HLS media component (hlsjs-video) -->
  <script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/cdn@10.2.0/media/hlsjs-video.js"></script>

  <script type="module">
    var playersReady = Promise.all([
      customElements.whenDefined('video-player').catch(function () {}),
      customElements.whenDefined('live-video-player').catch(function () {}),
      customElements.whenDefined('hlsjs-video').catch(function () {})
    ]);

    var DEFAULT_URL = 'https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/highest.mp4';

    function normalizeUrl(url) {
      if (!/^https?:\\/\\//i.test(url)) {
        if (url.indexOf('//') === 0) url = 'https:' + url;
        else if (url.indexOf('://') === -1) url = 'https://' + url;
      }
      return url;
    }

    function isHlsUrl(url) {
      return /\\.m3u8(\\?|#|$)/i.test(url);
    }

    function toProxiedUrl(url) {
      return window.location.origin + '/' + url;
    }

    function titleForUrl(url) {
      try {
        var u = new URL(url);
        var parts = u.pathname.split('/').filter(Boolean);
        var name = parts.length ? parts[parts.length - 1] : u.hostname;
        name = decodeURIComponent(name).replace(/\\.[a-z0-9]+$/i, '');
        return name || u.hostname;
      } catch (e) {
        return 'Video';
      }
    }

    function hostForUrl(url) {
      try { return new URL(url).hostname; } catch (e) { return 'proxied stream'; }
    }

    function safePlay(el) {
      function tryPlay() {
        try {
          var r = el.play && el.play();
          if (r && typeof r.catch === 'function') r.catch(function () {});
        } catch (e) {}
      }
      tryPlay();
      setTimeout(tryPlay, 100);
      setTimeout(tryPlay, 500);
    }

    async function buildPlayer(rawUrl) {
      await playersReady;

      var url = normalizeUrl(rawUrl);
      var proxiedUrl = toProxiedUrl(url);
      var container = document.getElementById('playerContainer');
      container.innerHTML = '';

      if (isHlsUrl(url)) {
        // HLS (live or VOD) -> live player + hlsjs media
        var player = document.createElement('live-video-player');
        var skin = document.createElement('live-video-skin');
        var media = document.createElement('hlsjs-video');
        media.setAttribute('src', proxiedUrl);
        media.setAttribute('playsinline', '');
        skin.appendChild(media);
        player.appendChild(skin);
        container.appendChild(player);
        safePlay(media);
      } else {
        // Plain video (mp4 / webm / ogv) -> video player + video media
        var player2 = document.createElement('video-player');
        var skin2 = document.createElement('video-skin');
        var media2 = document.createElement('video');
        media2.setAttribute('src', proxiedUrl);
        media2.setAttribute('playsinline', '');
        var fallback = document.createElement('a');
        fallback.href = 'https://videojs.org/help';
        fallback.textContent = 'Video player not working?';
        media2.appendChild(fallback);
        skin2.appendChild(media2);
        player2.appendChild(skin2);
        container.appendChild(player2);
        safePlay(media2);
      }

      document.getElementById('videoTitle').textContent = titleForUrl(url);
      document.getElementById('metaLine').textContent = hostForUrl(url) + ' · proxied';
      document.getElementById('videoUrlInput').value = url;
      document.title = titleForUrl(url) + ' - YouTube';
    }

    document.getElementById('searchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = document.getElementById('videoUrlInput').value.trim();
      if (!v) { document.getElementById('videoUrlInput').focus(); return; }
      buildPlayer(v);
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
