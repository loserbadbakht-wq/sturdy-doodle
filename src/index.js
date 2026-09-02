// ===== Helper: encode/decode =====
function encodeUrl(url) {
  return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

    // ----- oEmbed endpoint -----
    if (url.pathname === '/oembed') {
      const requestedUrl = url.searchParams.get('url') || '';
      let hash = '';
      try {
        const reqUrl = new URL(requestedUrl);
        if (reqUrl.pathname.startsWith('/watch/')) {
          hash = reqUrl.pathname.split('/watch/')[1];
        }
      } catch {}
      const videoUrl = hash ? decodeUrl(hash) : '';
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
        thumbnail_height: 360
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // ----- Main page -----
    let videoUrl = '';
    let hash = '';
    if (url.pathname.startsWith('/watch/')) {
      hash = url.pathname.split('/watch/')[1];
      if (hash) {
        try { videoUrl = decodeUrl(hash); } catch {}
      }
    }
    if (!videoUrl) {
      const direct = url.searchParams.get('video');
      if (direct) videoUrl = direct;
    }

    const title = videoUrl ? videoUrl.split('/').pop() : 'My Video Player';
    const thumbnail = url.searchParams.get('thumb') || 'https://via.placeholder.com/640x360/1DB954/000000?text=Video';
    const pageUrl = hash ? `${baseUrl}/watch/${hash}` : url.href;
    const oembedPageUrl = hash ? `${baseUrl}/watch/${hash}` : url.href;

    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>__TITLE__</title>
    <meta property="og:title" content="__TITLE__" />
    <meta property="og:description" content="Watch this video on MyPlayer" />
    <meta property="og:image" content="__THUMBNAIL__" />
    <meta property="og:url" content="__PAGE_URL__" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="alternate" type="application/json+oembed" href="__BASE_URL__/oembed?url=__ENCODED_PAGE_URL__" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: #141414;
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
        width: 100%;
        background: #000;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .player-wrapper video {
        width: 100%;
        height: auto;
        display: block;
        background: #000;
      }
      .controls {
        width: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        padding: 8px 12px;
        gap: 12px;
        border-top: 1px solid #333;
      }
      button {
        background: none;
        border: none;
        color: #fff;
        font-size: 18px;
        cursor: pointer;
        padding: 4px 8px;
      }
      input[type="range"] {
        cursor: pointer;
        accent-color: #1DB954;
        background: transparent;
      }
      #progress { flex: 1; }
      .volume-container { display: flex; align-items: center; gap: 6px; }
      #volume { width: 70px; }

      .url-bar {
        padding: 12px 16px;
        background: #222;
        display: flex;
        gap: 10px;
        align-items: center;
        border-top: 1px solid #333;
      }
      .url-bar label { color: #aaa; font-size: 13px; font-weight: 600; white-space: nowrap; }
      .url-bar input[type="text"] {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #444;
        border-radius: 4px;
        background: #111;
        color: #fff;
        font-size: 14px;
        outline: none;
      }
      .url-bar input[type="text"]:focus { border-color: #1DB954; }
      .url-bar button {
        background: #1DB954;
        color: #fff;
        padding: 8px 18px;
        border-radius: 4px;
        font-weight: bold;
        border: none;
        cursor: pointer;
        font-size: 14px;
      }
      .url-bar button:hover { background: #1ed760; }

      .empty-message {
        color: #aaa;
        font-size: 18px;
        text-align: center;
        padding: 40px;
        background: #111;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .empty-message span { font-size: 48px; }

      /* Embed mode */
      .embed-mode .url-bar { display: none !important; }
      .embed-mode .main-container { border-radius: 0; box-shadow: none; }
      body.embed-mode { padding: 0; background: #000; }
    </style>
</head>
<body class="__BODY_CLASS__">
  <div class="main-container">
    <div class="player-wrapper">
      <video id="video" src="__VIDEO_URL__"></video>
    </div>
    <div class="controls">
      <button id="play-btn">▶</button>
      <input type="range" id="progress" min="0" max="100" value="0" />
      <div class="volume-container">
        <button id="mute-btn">🔊</button>
        <input type="range" id="volume" min="0" max="1" step="0.1" value="1" />
      </div>
    </div>
    <div id="emptyState" class="empty-message" style="display: __EMPTY_DISPLAY__;">
      <span>🎬</span>
      <div>No video loaded</div>
      <div style="font-size:14px; color:#666;">Paste a URL below and click "Load"</div>
    </div>
    <div class="url-bar">
      <label>🔗 Video URL</label>
      <input type="text" id="videoUrlInput" placeholder="https://example.com/video.mp4" value="__VIDEO_URL__" />
      <button id="load-btn">Load</button>
    </div>
  </div>
  <script>
    // ===== JavaScript =====
    const video = document.getElementById('video');
    const playBtn = document.getElementById('play-btn');
    const muteBtn = document.getElementById('mute-btn');
    const progress = document.getElementById('progress');
    const volume = document.getElementById('volume');
    const urlInput = document.getElementById('videoUrlInput');
    const loadBtn = document.getElementById('load-btn');
    const emptyState = document.getElementById('emptyState');

    function togglePlay() {
      if (video.paused) { video.play(); playBtn.textContent = '⏸'; }
      else { video.pause(); playBtn.textContent = '▶'; }
    }
    function updateProgress() {
      const percentage = (video.currentTime / video.duration) * 100;
      progress.value = percentage || 0;
    }
    function setProgress() {
      const time = (progress.value * video.duration) / 100;
      video.currentTime = time;
    }
    function handleVolume() {
      video.volume = volume.value;
      muteBtn.textContent = video.volume === 0 ? '🔇' : '🔊';
    }
    function toggleMute() {
      if (video.muted) { video.muted = false; muteBtn.textContent = '🔊'; volume.value = video.volume; }
      else { video.muted = true; muteBtn.textContent = '🔇'; volume.value = 0; }
    }

    // Load video and update URL
    function loadVideo() {
      let newUrl = urlInput.value.trim();
      if (!newUrl) return;
      video.src = newUrl;
      video.load();
      video.play();
      playBtn.textContent = '⏸';
      emptyState.style.display = 'none';
      // Encode and push state
      const hash = btoa(newUrl).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
      const cleanPath = '/watch/' + hash;
      window.history.pushState({}, '', cleanPath);
      document.title = newUrl.split('/').pop() || 'Video Player';
    }

    playBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);
    video.addEventListener('timeupdate', updateProgress);
    progress.addEventListener('input', setProgress);
    volume.addEventListener('input', handleVolume);
    muteBtn.addEventListener('click', toggleMute);
    loadBtn.addEventListener('click', loadVideo);
    urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadVideo(); });

    // On load: decode hash if present
    (function init() {
      const path = window.location.pathname;
      if (path.startsWith('/watch/')) {
        const hash = path.split('/watch/')[1];
        if (hash) {
          try {
            let base64 = hash.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) base64 += '=';
            const decoded = atob(base64);
            if (decoded) {
              video.src = decoded;
              video.load();
              video.play();
              playBtn.textContent = '⏸';
              emptyState.style.display = 'none';
              urlInput.value = decoded;
              document.title = decoded.split('/').pop() || 'Video Player';
            }
          } catch (e) {
            console.error('Decoding error:', e);
            emptyState.style.display = 'block';
          }
        }
      } else if (!video.src || video.src === '') {
        emptyState.style.display = 'block';
      }
    })();
  </script>
</body>
</html>`;

    const bodyClass = isEmbed ? 'embed-mode' : '';
    let html = htmlTemplate
      .replace(/__VIDEO_URL__/g, videoUrl.replace(/"/g, '&quot;'))
      .replace(/__TITLE__/g, title.replace(/"/g, '&quot;'))
      .replace(/__THUMBNAIL__/g, thumbnail)
      .replace(/__PAGE_URL__/g, pageUrl)
      .replace(/__ENCODED_PAGE_URL__/g, encodeURIComponent(oembedPageUrl))
      .replace(/__BASE_URL__/g, baseUrl)
      .replace(/__EMPTY_DISPLAY__/g, videoUrl ? 'none' : 'block')
      .replace(/__BODY_CLASS__/g, bodyClass);

    return new Response(html, {
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
  }
};
