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

    <!-- Video.js CDN -->
    <link href="//vjs.zencdn.net/8.23.6/video-js.min.css" rel="stylesheet">
    <script src="//vjs.zencdn.net/8.23.6/video.min.js"></script>

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
      }
      .video-js {
        width: 100%;
        height: 100%;
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
      <video
        id="my-player"
        class="video-js"
        controls
        preload="auto"
        poster="__THUMBNAIL__"
        data-setup='{}'>
        <source src="__VIDEO_URL__" type="__VIDEO_TYPE__"></source>
        <p class="vjs-no-js">
          To view this video please enable JavaScript, and consider upgrading to a
          web browser that
          <a href="https://videojs.com/html5-video-support/" target="_blank">
            supports HTML5 video
          </a>
        </p>
      </video>
    </div>
    <div class="url-bar">
      <label>🔗 Video URL</label>
      <input type="text" id="videoUrlInput" placeholder="https://example.com/video.mp4" value="__VIDEO_URL__">
      <button id="load-btn">Load</button>
    </div>
  </div>

  <script>
    // ===== Helper functions =====
    function encodeUrl(url) {
      return btoa(url)
        .replace(/\\+/g, '-')
        .replace(/\\//g, '_')
        .replace(/=+$/, '');
    }

    // ===== Video.js player initialization =====
    let player = videojs('my-player', {
      fluid: true,
      playbackRates: [0.5, 1, 1.5, 2],
      controlBar: {
        skipButtons: {
          forward: 10,
          backward: 10
        }
      }
    });

    // ===== URL loading =====
    const urlInput = document.getElementById('videoUrlInput');
    const loadBtn = document.getElementById('load-btn');

    function loadVideo() {
      const newUrl = urlInput.value.trim();
      if (!newUrl) return;

      // Update source dynamically
      player.src({
        src: newUrl,
        type: getVideoType(newUrl)
      });
      player.poster(''); // Clear poster or set a new one if desired
      player.play();

      // Update URL hash without reloading
      const hash = encodeUrl(newUrl);
      const cleanPath = '/watch/' + hash;
      window.history.pushState({}, '', cleanPath);
      document.title = newUrl.split('/').pop() || 'Video Player';
    }

    function getVideoType(url) {
      const ext = url.split('.').pop().toLowerCase();
      const types = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        ogg: 'video/ogg',
        ogv: 'video/ogg',
        m3u8: 'application/x-mpegURL',
        mpd: 'application/dash+xml'
      };
      return types[ext] || 'video/mp4'; // fallback
    }

    loadBtn.addEventListener('click', loadVideo);
    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') loadVideo();
    });

    // Initial source type correction (for server-rendered video)
    (function init() {
      const initialUrl = urlInput.value.trim();
      if (initialUrl) {
        const initialType = getVideoType(initialUrl);
        // Update the source type if it was set as a placeholder
        const currentSource = player.currentSource();
        if (currentSource && currentSource.type !== initialType) {
          player.src({
            src: initialUrl,
            type: initialType
          });
        }
      }
    })();
  </script>
</body>
</html>`;

    // Determine video type for the initial source
    const videoType = (() => {
      if (!videoUrl) return 'video/mp4';
      const ext = videoUrl.split('.').pop().toLowerCase();
      const types = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        ogg: 'video/ogg',
        ogv: 'video/ogg',
        m3u8: 'application/x-mpegURL',
        mpd: 'application/dash+xml'
      };
      return types[ext] || 'video/mp4';
    })();

    const bodyClass = isEmbed ? 'embed-mode' : '';

    let html = htmlTemplate
      .replace(/__VIDEO_URL__/g, videoUrl.replace(/"/g, '&quot;'))
      .replace(/__VIDEO_TYPE__/g, videoType)
      .replace(/__TITLE__/g, title.replace(/"/g, '&quot;'))
      .replace(/__THUMBNAIL__/g, thumbnail)
      .replace(/__PAGE_URL__/g, pageUrl)
      .replace(/__ENCODED_PAGE_URL__/g, encodeURIComponent(oembedPageUrl))
      .replace(/__BASE_URL__/g, baseUrl)
      .replace(/__BODY_CLASS__/g, bodyClass);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};
