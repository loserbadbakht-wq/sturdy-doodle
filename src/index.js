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
      // Allow protocol-relative or relative? For simplicity, we require absolute URL.
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

  // Copy essential original headers (range, cookies, etc.)
  ['cookie', 'range', 'if-none-match', 'if-modified-since', 'content-type', 'content-length'].forEach(h => {
    if (request.headers.has(h)) requestHeaders.set(h, request.headers.get(h));
  });

  // Browser emulation
  requestHeaders.set('User-Agent', config.browserEmulation.userAgent);
  requestHeaders.set('Accept', config.browserEmulation.accept);
  requestHeaders.set('Accept-Language', config.browserEmulation.acceptLanguage);
  requestHeaders.set('Accept-Encoding', config.browserEmulation.acceptEncoding);
  requestHeaders.set('Connection', config.browserEmulation.connection);
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
    // No referer; omit
  }

  if (originalOrigin) {
    const originUrl = new URL(originalOrigin);
    if (originUrl.host === url.host) {
      requestHeaders.set('Origin', targetUrl.origin);
    } else {
      requestHeaders.set('Origin', originalOrigin);
    }
  } else {
    // No origin; omit. For m3u8, many servers reject an Origin header, so ensure it's not set.
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

    // Copy response headers and clean problematic ones
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

    // Copy multiple Set-Cookie headers
    const setCookies = response.headers.getAll ? response.headers.getAll('Set-Cookie') : [];
    if (setCookies.length > 0) {
      setCookies.forEach(cookie => responseHeaders.append('Set-Cookie', cookie));
    }

    // Handle redirects manually (so they stay proxied)
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

    // HLS playlist rewriting
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

    // All other media: stream as-is
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
// Landing Page (Video player only)
// ============================
function getHomePage(proxyBase) {
  return new Response(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Media Proxy Player</title>
  <!-- Video.js CSS -->
  <link href="//vjs.zencdn.net/8.23.6/video-js.min.css" rel="stylesheet">
  <style>
    body {
      background-color: #141414;
      color: #666;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: 100vh;
      font-family: sans-serif;
      padding: 20px;
    }
    .container {
      width: 100%;
      max-width: 800px;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
    }
    .input-group {
      padding: 8px 12px;
      background: #222;
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
    input[type="text"]:hover {
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
    .video-container {
      height: 100%;
      width: 100%;
    }
    .source-input {
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="container">
   
    <!-- Video.js player -->
    <div class="video-container">
      <video
        id="my-player"
        class="video-js vjs-big-play-centered"
        controls
        preload="auto"
        poster="//vjs.zencdn.net/v/oceans.png"
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
        <div class="input-group">
          <input type="text" id="videoUrlInput" placeholder="Enter Video URL to Proxy">
          <button type="button" id="loadVideoBtn">Load Video</button>
        </div>
      </div>
    </div>

  <!-- Video.js JavaScript -->
  <script src="//vjs.zencdn.net/8.23.6/video.min.js"></script>
  <!-- VHS (HTTP Streaming) plugin for HLS and DASH -->
  <script src="//cdn.jsdelivr.net/npm/@videojs/http-streaming@3.13.0/dist/videojs-http-streaming.min.js"></script>
  <script>
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
