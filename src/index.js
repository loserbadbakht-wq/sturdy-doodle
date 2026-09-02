// src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const baseUrl = url.origin;

    // ----- oEmbed endpoint -----
    if (url.pathname === '/oembed') {
      const requestedUrl = url.searchParams.get('url') || '';
      const params = new URL(requestedUrl).searchParams;
      const videoUrl = params.get('video') || '';
      const iframeSrc = `${baseUrl}/?video=${encodeURIComponent(videoUrl)}`;
      const iframeHtml = `<iframe src="${iframeSrc}" width="640" height="400" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
      return new Response(JSON.stringify({
        version: '1.0',
        type: 'video',
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

    // ----- Main player page -----
    const videoUrl = url.searchParams.get('video') || '';
    const thumbnail = url.searchParams.get('thumb') || 'https://via.placeholder.com/640x360/1DB954/000000?text=MyPlayer';
    const title = videoUrl ? videoUrl.split('/').pop() : 'My Video Player';

    // The HTML template (same as previous, with placeholders)
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
      body { background-color: #141414; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: sans-serif; }
      .video-container { position: relative; width: 100%; max-width: 800px; background-color: #000; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      video { width: 100%; display: block; }
      .controls { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; padding: 10px; gap: 15px; opacity: 0; transition: opacity 0.3s ease; }
      .video-container:hover .controls { opacity: 1; }
      button { background: none; border: none; color: #fff; font-size: 16px; cursor: pointer; padding: 5px; }
      input[type="range"] { cursor: pointer; accent-color: #ffffff; }
      #progress { flex-grow: 1; }
      .volume-container { display: flex; align-items: center; gap: 5px; }
      #volume { width: 70px; }
      .url-bar { padding: 12px; background: #222; display: flex; gap: 10px; align-items: center; border-top: 1px solid #333; }
      .url-bar input[type="text"] { flex: 1; padding: 8px 12px; border: 1px solid #444; border-radius: 4px; background: #111; color: #fff; font-size: 14px; }
      .url-bar button { background: #1DB954; color: #fff; padding: 8px 20px; border-radius: 4px; font-weight: bold; border: none; cursor: pointer; }
      .url-bar button:hover { background: #1ed760; }
      .url-bar label { color: #aaa; font-size: 13px; }
    </style>
</head>
<body>
  <div class="video-container">
    <video id="video" src="__VIDEO_URL__"></video>
    <div class="controls">
      <button id="play-btn">▶</button>
      <input type="range" id="progress" min="0" max="100" value="0">
      <div class="volume-container">
        <button id="mute-btn">🔊</button>
        <input type="range" id="volume" min="0" max="1" step="0.1" value="1">
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
    if (!video.src) {
      video.style.display = 'none';
      const container = document.querySelector('.video-container');
      const msg = document.createElement('div');
      msg.style.cssText = 'color: #aaa; padding: 40px; text-align: center; background: #111;';
      msg.innerHTML = '🎬 No video loaded.<br>Paste a URL above and click "Load".';
      container.insertBefore(msg, container.firstChild);
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
      .replace(/__BASE_URL__/g, baseUrl);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};
