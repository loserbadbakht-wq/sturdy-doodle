// ===== Helper: encode/decode URL to/from base64url =====
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
      const iframeHtml = `<iframe src="${iframeSrc}" width="100%" height="190" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;

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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // ----- Main player page -----
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

    <link rel="alternate" type="application/json+oembed" 
          href="__BASE_URL__/oembed?url=__ENCODED_PAGE_URL__" />

    <style>
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

      .progress-container {
        flex: 1;
        position: relative;
        height: 4px;
        display: flex;
        align-items: center;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
      }
      .progress-loaded {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        background: rgba(255, 255, 255, 0.4);
        border-radius: 2px;
        pointer-events: none;
        width: 0%;
        z-index: 1;
      }
      .progress-container input[type="range"] {
        width: 100%;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        position: relative;
        z-index: 2;
        cursor: pointer;
        margin: 0;
      }
      .progress-container input[type="range"]::-webkit-slider-track {
        background: transparent;
      }
      .progress-container input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
        margin-top: -4px;
        box-shadow: 0 0 4px rgba(0,0,0,0.6);
      }
      .progress-container input[type="range"]::-moz-range-track {
        background: transparent;
        border: none;
      }
      .progress-container input[type="range"]::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
        border: none;
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
        <div class="progress-container">
          <div class="progress-loaded" id="progress-loaded"></div>
          <input type="range" id="progress" min="0" max="100" value="0">
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
    // ===== Client‑side helpers =====
    function encodeUrl(url) {
      return btoa(url)
        .replace(/\\+/g, '-')
        .replace(/\\//g, '_')
        .replace(/=+$/, '');
    }

    function decodeUrl(hash) {
      let base64 = hash.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      return atob(base64);
    }

    // ===== DOM references =====
    const video = document.getElementById('video');
    const controls = document.getElementById('controls');
    const playerWrapper = document.querySelector('.player-wrapper');
    const playBtn = document.getElementById('play-btn');
    const skipBackBtn = document.getElementById('skip-back-btn');
    const skipForwardBtn = document.getElementById('skip-forward-btn');
    const muteBtn = document.getElementById('mute-btn');
    const progress = document.getElementById('progress');
    const progressLoaded = document.getElementById('progress-loaded');
    const volume = document.getElementById('volume');
    const urlInput = document.getElementById('videoUrlInput');
    const loadBtn = document.getElementById('load-btn');
    const emptyState = document.getElementById('emptyState');

    // ===== Controls visibility with 3‑second auto‑hide =====
    let hideTimeout;

    function showControls() {
      controls.classList.add('controls-show');
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        controls.classList.remove('controls-show');
      }, 3000);
    }

    function hideControlsImmediately() {
      controls.classList.remove('controls-show');
      clearTimeout(hideTimeout);
    }

    // Mouse events
    playerWrapper.addEventListener('mouseenter', showControls);
    playerWrapper.addEventListener('mousemove', showControls);
    playerWrapper.addEventListener('mouseleave', hideControlsImmediately);

    // ===== Touch events (ONLY on video, ignore if touch starts on controls) =====
    let holdTimer = null;
    let isHeld = false;

    function handleTouchStart(e) {
      // Ignore touches that started on any control element
      if (e.target.closest('.controls')) {
        return;
      }
      e.preventDefault();
      holdTimer = setTimeout(() => {
        isHeld = true;
        // Toggle controls visibility
        if (controls.classList.contains('controls-show')) {
          hideControlsImmediately();
        } else {
          showControls();
        }
      }, 600);
    }

    function handleTouchEnd(e) {
      // Ignore if touch ended on controls (though it shouldn't happen if start was ignored)
      if (e.target.closest('.controls')) {
        return;
      }
      e.preventDefault();
      clearTimeout(holdTimer);
      if (!isHeld) {
        // Tap: toggle play and show controls
        togglePlay();
        showControls();
      }
      isHeld = false;
    }

    function handleTouchCancel(e) {
      clearTimeout(holdTimer);
      isHeld = false;
    }

    // Attach touch events only to the video element
    video.addEventListener('touchstart', handleTouchStart, { passive: false });
    video.addEventListener('touchend', handleTouchEnd, { passive: false });
    video.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    // ===== Player functions =====
    function togglePlay() {
      if (video.paused) {
        video.play();
        playBtn.textContent = '⏸';
      } else {
        video.pause();
        playBtn.textContent = '▶';
      }
    }

    function updateProgress() {
      const percentage = (video.currentTime / video.duration) * 100;
      progress.value = percentage || 0;
    }

    function setProgress() {
      const time = (progress.value * video.duration) / 100;
      video.currentTime = time;
      showControls();
    }

    function handleVolume() {
      video.volume = volume.value;
      muteBtn.textContent = video.volume === 0 ? '🔇' : '🔊';
      showControls();
    }

    function toggleMute() {
      if (video.muted) {
        video.muted = false;
        muteBtn.textContent = '🔊';
        volume.value = video.volume;
      } else {
        video.muted = true;
        muteBtn.textContent = '🔇';
        volume.value = 0;
      }
      showControls();
    }

    function skipBack() {
      video.currentTime = Math.max(0, video.currentTime - 10);
      showControls();
    }
    function skipForward() {
      video.currentTime = Math.min(video.duration, video.currentTime + 10);
      showControls();
    }

    // ===== Loading progress =====
    function updateLoaded() {
      if (video.duration > 0 && video.buffered.length > 0) {
        const loaded = video.buffered.end(0);
        const percent = (loaded / video.duration) * 100;
        progressLoaded.style.width = Math.min(percent, 100) + '%';
      }
    }
    function resetLoaded() {
      progressLoaded.style.width = '0%';
    }

    // ===== Load video =====
    function loadVideo() {
      let newUrl = urlInput.value.trim();
      if (!newUrl) return;

      video.src = newUrl;
      video.load();
      video.play();
      playBtn.textContent = '⏸';
      emptyState.style.display = 'none';
      resetLoaded();
      showControls();

      const hash = encodeUrl(newUrl);
      const cleanPath = '/watch/' + hash;
      window.history.pushState({}, '', cleanPath);
      document.title = newUrl.split('/').pop() || 'Video Player';
    }

    // ===== Event listeners =====
    // Mouse click on video
    video.addEventListener('click', () => {
      togglePlay();
      showControls();
    });

    // Control buttons
    playBtn.addEventListener('click', togglePlay);
    skipBackBtn.addEventListener('click', skipBack);
    skipForwardBtn.addEventListener('click', skipForward);
    muteBtn.addEventListener('click', toggleMute);
    progress.addEventListener('input', setProgress);
    volume.addEventListener('input', handleVolume);
    loadBtn.addEventListener('click', loadVideo);
    urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadVideo(); });

    // Video events
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('progress', updateLoaded);
    video.addEventListener('durationchange', resetLoaded);

    // ===== On page load =====
    (function init() {
      const path = window.location.pathname;
      if (path.startsWith('/watch/')) {
        const hash = path.split('/watch/')[1];
        if (hash) {
          try {
            const decoded = decodeUrl(hash);
            if (decoded) {
              video.src = decoded;
              video.load();
              video.play();
              playBtn.textContent = '⏸';
              emptyState.style.display = 'none';
              urlInput.value = decoded;
              document.title = decoded.split('/').pop() || 'Video Player';
              showControls();
            }
          } catch {}
        }
      } else if (!video.src || video.src === '') {
        emptyState.style.display = 'flex';
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
