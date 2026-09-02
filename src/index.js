export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const baseUrl = url.origin;

    // ----- oEmbed endpoint (type changed to "rich") -----
    if (url.pathname === '/oembed') {
      const requestedUrl = url.searchParams.get('url') || '';
      const params = new URL(requestedUrl).searchParams;
      const videoUrl = params.get('video') || '';

      // Build the iframe that will be embedded
      const iframeSrc = `${baseUrl}/?video=${encodeURIComponent(videoUrl)}`;
      const iframeHtml = `<iframe src="${iframeSrc}" width="640" height="400" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;

      return new Response(JSON.stringify({
        version: '1.0',
        type: 'rich',          // <-- CHANGE HERE: was "video"
        provider_name: 'MyPlayer',
        provider_url: baseUrl,
        title: videoUrl ? videoUrl.split('/').pop() : 'Video Player',
        html: iframeHtml,
        width: 640,
        height: 400,
        thumbnail_url: 'https://via.placeholder.com/640x360/1DB954/000000?text=MyPlayer',
        thumbnail_width: 640,
        thumbnail_height: 360
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // ----- Main player page (unchanged from previous version) -----
    const videoUrl = url.searchParams.get('video') || '';
    const thumbnail = url.searchParams.get('thumb') || 'https://via.placeholder.com/640x360/1DB954/000000?text=MyPlayer';
    const title = videoUrl ? videoUrl.split('/').pop() : 'My Video Player';

    // (the rest of the HTML template is the same as before, so I'll omit it for brevity)
    // But you must include the full HTML template as in the previous answer.
    // I'll put it back here for completeness...
    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>__TITLE__</title>
    <meta property="og:title" content="__TITLE__" />
    <meta property="og:description" content="Watch this video on MyPlayer" />
    <meta property="og:video" content="__VIDEO_URL__" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="640" />
    <meta property="og:video:height" content="360" />
    <meta property="og:image" content="__THUMBNAIL__" />
    <meta property="og:url" content="__PAGE_URL__" />
    <meta property="og:type" content="video.other" />
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
      }
      .player-wrapper video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
        background: #000;
      }
      .controls {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        padding: 10px 15px;
        gap: 15px;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .player-wrapper:hover .controls {
        opacity: 1;
      }
      button {
        background: none;
        border: none;
        color: #fff;
        font-size: 18px;
        cursor: pointer;
        padding: 5px 8px;
      }
      input[type="range"] {
        cursor: pointer;
        accent-color: #ffffff;
        background: transparent;
      }
      #progress {
        flex: 1;
      }
      .volume-container {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #volume {
        width: 70px;
      }
      .url-bar {
        padding: 14px 16px;
        background: #222;
        display: flex;
        gap: 12px;
        align-items: center;
        border-top: 1px solid #333;
      }
      .url-bar label {
        color: #aaa;
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
      }
      .url-bar input[type="text"] {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid #444;
        border-radius: 6px;
        background: #111;
        color: #fff;
        font-size: 14px;
        outline: none;
        transition: border 0.2s;
      }
      .url-bar input[type="text"]:focus {
        border-color: #1DB954;
      }
      .url-bar button {
        background: #1DB954;
        color: #fff;
        padding: 10px 24px;
        border-radius: 6px;
        font-weight: bold;
        border: none;
        cursor: pointer;
        font-size: 14px;
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
    </style>
</head>
<body>
  <div class="main-container">
    <div class="player-wrapper">
      <video id="video" src="__VIDEO_URL__"></video>
      <div class="controls">
        <button id="play-btn">▶</button>
        <input type="range" id="progress" min="0" max="100" value="0">
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
    function loadVideo() {
      let newUrl = urlInput.value.trim();
      if (!newUrl) return;
      video.src = newUrl;
      video.load();
      video.play();
      playBtn.textContent = '⏸';
      emptyState.style.display = 'none';
      const params = new URLSearchParams(window.location.search);
      params.set('video', newUrl);
      window.history.pushState({}, '', window.location.pathname + '?' + params.toString());
    }
    playBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);
    video.addEventListener('timeupdate', updateProgress);
    progress.addEventListener('input', setProgress);
    volume.addEventListener('input', handleVolume);
    muteBtn.addEventListener('click', toggleMute);
    loadBtn.addEventListener('click', loadVideo);
    urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadVideo(); });
    if (!video.src || video.src === '') {
      emptyState.style.display = 'flex';
    } else {
      emptyState.style.display = 'none';
    }
  </script>
</body>
</html>`;

    // Replace placeholders
    let html = htmlTemplate
      .replace(/__VIDEO_URL__/g, videoUrl.replace(/"/g, '&quot;'))
      .replace(/__TITLE__/g, title.replace(/"/g, '&quot;'))
      .replace(/__THUMBNAIL__/g, thumbnail)
      .replace(/__PAGE_URL__/g, url.href)
      .replace(/__ENCODED_PAGE_URL__/g, encodeURIComponent(url.href))
      .replace(/__BASE_URL__/g, baseUrl)
      .replace(/__EMPTY_DISPLAY__/g, videoUrl ? 'none' : 'flex');

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};
