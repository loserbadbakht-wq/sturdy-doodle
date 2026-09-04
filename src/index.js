// ===== Helper functions =====
function encodeUrl(url) {
  return btoa(url)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeUrl(hash) {
  let base64 = hash.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return atob(base64);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const baseUrl = url.origin;
    const isEmbed = url.searchParams.get('embed') === '1';

    // ----- oEmbed endpoint (FIXED) -----
    if (url.pathname === '/oembed') {
      const requestedUrl = url.searchParams.get('url') || '';
      console.log('oEmbed requested for:', requestedUrl);

      let hash = '';
      let videoUrl = '';
      try {
        const reqUrl = new URL(requestedUrl);
        if (reqUrl.pathname.startsWith('/watch/')) {
          hash = reqUrl.pathname.split('/watch/')[1];
          videoUrl = hash ? decodeUrl(hash) : '';
        }
      } catch {
        // invalid URL
      }

      // If no hash, return a fallback
      if (!hash) {
        return new Response(JSON.stringify({
          version: '1.0',
          type: 'rich',
          provider_name: 'MyPlayer',
          provider_url: baseUrl,
          title: 'Video Player',
          html: `<p>Invalid video link</p>`,
          width: 640,
          height: 400
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          }
        });
      }

      const iframeSrc = `${baseUrl}/watch/${hash}?embed=1`;
      const iframeHtml = `<iframe src="${iframeSrc}" width="640" height="400" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;

      return new Response(JSON.stringify({
        version: '1.0',
        type: 'rich',
        provider_name: 'MyPlayer',
        provider_url: baseUrl,
        title: videoUrl ? videoUrl.split('/').pop() : 'Video Player',
        html: iframeHtml,
        width: 640,
        height: 400,
        thumbnail_url: 'https://via.placeholder.com/640x360/1DB954/000000?text=Video',
        thumbnail_width: 640,
        thumbnail_height: 360,
        cache_age: 86400 // 24h
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // ----- Main player page (unchanged, but I'll include it for completeness) -----
    let videoUrl = '';
    let hash = '';

    if (url.pathname.startsWith('/watch/')) {
      hash = url.pathname.split('/watch/')[1];
      if (hash) {
        try {
          videoUrl = decodeUrl(hash);
        } catch {
          videoUrl = '';
        }
      }
    }

    if (!videoUrl) {
      const direct = url.searchParams.get('video');
      if (direct) {
        videoUrl = direct;
      }
    }

    const title = videoUrl ? videoUrl.split('/').pop() : 'My Video Player';
    const thumbnail = url.searchParams.get('thumb') || 'https://via.placeholder.com/640x360/1DB954/000000?text=Video';
    const pageUrl = hash ? `${baseUrl}/watch/${hash}` : url.href;
    const oembedPageUrl = hash ? `${baseUrl}/watch/${hash}` : url.href;

    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>__TITLE__</title>

    <meta property="og:title" content="__TITLE__" />
    <meta property="og:description" content="Watch this video on MyPlayer" />
    <meta property="og:image" content="__THUMBNAIL__" />
    <meta property="og:url" content="__PAGE_URL__" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />

    <!-- oEmbed discovery link (absolute URL) -->
    <link rel="alternate" type="application/json+oembed" 
          href="__BASE_URL__/oembed?url=__ENCODED_PAGE_URL__" />

    <style>
      /* (your existing styles – omitted for brevity, but keep them as they are) */
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background-color: #141414;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        font-family: sans-serif;
        padding: 20px;
      }
      .main-container {
        width: 100%;
        max-width: 800px;
        background: #000;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      }
      .player-wrapper {
        position: relative;
        background: #000;
        aspect-ratio: 16 / 9;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        touch-action: none;
      }
      .player-wrapper video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
        background: #000;
        touch-action: none;
      }

      .controls {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        padding: 8px 12px;
        gap: 10px;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }
      .controls.controls-show {
        opacity: 1;
        pointer-events: auto;
      }

      .progress-wrapper {
        flex: 1;
        position: relative;
        height: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
      }
      .progress-track {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 4px;
        background: #333 !important;
        border-radius: 2px;
        pointer-events: none;
      }
      .progress-loaded {
        position: absolute;
        left: 0;
        top: 0;
        height: 4px;
        background: #ffffff !important;
        border-radius: 2px;
        pointer-events: none;
        width: 0%;
        z-index: 1;
      }
      .progress-played {
        position: absolute;
        left: 0;
        top: 0;
        height: 4px;
        background: #ff0000 !important;
        border-radius: 2px;
        pointer-events: none;
        width: 0%;
        z-index: 2;
      }
      .progress-input {
        position: relative;
        width: 100%;
        height: 4px;
        -webkit-appearance: none !important;
        appearance: none !important;
        background: transparent !important;
        z-index: 3;
        cursor: pointer;
        margin: 0;
        padding: 0;
        outline: none;
        border: none !important;
      }
      .progress-input::-webkit-slider-track {
        -webkit-appearance: none !important;
        appearance: none !important;
        background: transparent !important;
        height: 4px;
        border: none !important;
      }
      .progress-input::-moz-range-track {
        -moz-appearance: none !important;
        appearance: none !important;
        background: transparent !important;
        height: 4px;
        border: none !important;
      }
      .progress-input::-webkit-slider-thumb {
        -webkit-appearance: none !important;
        appearance: none !important;
        width: 14px !important;
        height: 14px !important;
        border-radius: 50% !important;
        background: #ffffff !important;
        cursor: pointer !important;
        margin-top: -5px !important;
        border: 2px solid #ff0000 !important;
        box-shadow: 0 0 6px rgba(0,0,0,0.6) !important;
        z-index: 5 !important;
      }
      .progress-input::-moz-range-thumb {
        -moz-appearance: none !important;
        appearance: none !important;
        width: 14px !important;
        height: 14px !important;
        border-radius: 50% !important;
        background: #ffffff !important;
        cursor: pointer !important;
        border: 2px solid #ff0000 !important;
        box-shadow: 0 0 6px rgba(0,0,0,0.6) !important;
        z-index: 5 !important;
      }

      button {
        background: none;
        border: none;
        color: #fff;
        font-size: 16px;
        cursor: pointer;
        padding: 4px 6px;
      }
      .volume-container {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #volume {
        width: 60px;
        accent-color: #ffffff;
        background: transparent;
        height: 4px;
      }

      .url-bar {
        padding: 8px 12px;
        background: #222;
        display: flex;
        gap: 8px;
        align-items: center;
        border-top: 1px solid #333;
      }
      .url-bar label {
        color: #aaa;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
      }
      .url-bar input[type="text"] {
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
      .url-bar input[type="text"]:focus {
        border-color: #1DB954;
      }
      .url-bar button {
        background: #1DB954;
        color: #fff;
        padding: 6px 14px;
        border-radius: 4px;
        font-weight: bold;
        border: none;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.2s;
      }
      .url-bar button:hover {
        background: #1ed760;
      }

      .empty-message {
        color: #aaa;
        font-size: 18px;
        text-align: center;
        background: #111;
        padding: 40px;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }
      .empty-message span {
        font-size: 48px;
      }

      .embed-mode .url-bar {
        display: none !important;
      }
      .embed-mode .main-container {
        border-radius: 0;
        box-shadow: none;
      }
      body.embed-mode {
        padding: 0;
        background: #000;
      }
    </style>
</head>
<body class="__BODY_CLASS__">
  <div class="main-container">
    <div class="player-wrapper">
      <video id="video" src="__VIDEO_URL__"></video>
      <div class="controls" id="controls">
        <button id="play-btn">▶</button>
        <button id="skip-back-btn" title="Skip backward 10 seconds">⏪</button>
        <button id="skip-forward-btn" title="Skip forward 10 seconds">⏩</button>
        <div class="progress-wrapper" id="progressWrapper">
          <div class="progress-track" id="progressTrack"></div>
          <div class="progress-loaded" id="progressLoaded"></div>
          <div class="progress-played" id="progressPlayed"></div>
          <input type="range" class="progress-input" id="progressInput" min="0" max="100" value="0">
        </div>
        <div class="volume-container">
          <button id="mute-btn">🔊</button>
          <input type="range" id="volume" min="0" max="1" step="0.1" value="1">
        </div>
      </div>
      <div id="emptyState" class="empty-message" style="display: __EMPTY_DISPLAY__; position: absolute; top:0; left:0; right:0; bottom:0; background: #111;">
        <span>🎬</span>
        <div>No video loaded</div>
        <div style="font-size:14px; color:#666;">Paste a URL below and click "Load"</div>
      </div>
    </div>
    <div class="url-bar">
      <label>🔗 Video URL</label>
      <input type="text" id="videoUrlInput" placeholder="https://example.com/video.mp4" value="__VIDEO_URL__">
      <button id="load-btn">Load</button>
    </div>
  </div>
  <script>
    // ===== (Your existing JavaScript – unchanged) =====
    // ... keep the full script from your last working version ...
    // I'll include it but for brevity I'm assuming it's the same as before
  </script>
</body>
</html>`;

    // ... (rest of the worker with placeholders and response)

    // Determine body class
    const bodyClass = isEmbed ? 'embed-mode' : '';

    let html = htmlTemplate
      .replace(/__VIDEO_URL__/g, videoUrl.replace(/"/g, '&quot;'))
      .replace(/__TITLE__/g, title.replace(/"/g, '&quot;'))
      .replace(/__THUMBNAIL__/g, thumbnail)
      .replace(/__PAGE_URL__/g, pageUrl)
      .replace(/__ENCODED_PAGE_URL__/g, encodeURIComponent(oembedPageUrl))
      .replace(/__BASE_URL__/g, baseUrl)
      .replace(/__EMPTY_DISPLAY__/g, videoUrl ? 'none' : 'flex')
      .replace(/__BODY_CLASS__/g, bodyClass);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};
