// Cloudflare Worker: Streaming Platform → m3u8 (Twitch + YouTube)

const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const GQL_URL = 'https://gql.twitch.tv/gql';
const USHER_BASE = 'https://usher.ttvnw.net/api/v2/channel/hls/';
const YT_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

// Twitch persisted query for access token
const TWITCH_ACCESS_TOKEN_QUERY = {
  operationName: 'PlaybackAccessToken',
  extensions: {
    persistedQuery: {
      version: 1,
      sha256Hash: 'ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9'
    }
  },
  variables: {
    isLive: true,
    login: '',
    isVod: false,
    vodID: '',
    playerType: 'embed',
    platform: 'site'
  }
};

// ---------- HTML Page ----------
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Streaming Platform → m3u8</title>
  <style>
    :root {
      --bg: #000000;
      --surface: #121212;
      --surface-hover: #1e1e1e;
      --text: #ffffff;
      --text-secondary: #b3b3b3;
      --accent: #9146ff;        /* Twitch purple default */
      --accent-hover: #772ce8;
      --border: #2a2a2a;
      --radius: 8px;
      --transition: 0.2s ease;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1rem;
    }
    .container {
      width: 100%;
      max-width: 1000px;
      background: var(--surface);
      border-radius: var(--radius);
      padding: 2rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    }
    h1 {
      text-align: center;
      margin-bottom: 0.5rem;
      font-size: 1.8rem;
      letter-spacing: -0.5px;
      color: var(--accent);   /* title uses accent color unless rainbow class overrides */
    }
    /* Animated rainbow gradient for the default title */
    .rainbow-text {
      background: linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet);
      background-size: 400% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;   /* overrides the accent color */
      animation: rainbow-animation 12s linear infinite;  /* <-- slower: 12s */
    }
    @keyframes rainbow-animation {
      0% { background-position: 0% 50%; }
      100% { background-position: 400% 50%; }
    }
    .subtitle {
      color: var(--text-secondary);
      margin-bottom: 2rem;
      font-size: 0.95rem;
      text-align: center;
    }
    label {
      display: block;
      margin-bottom: 0.4rem;
      font-weight: 600;
      color: var(--text-secondary);
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .input-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    input[type="text"] {
      flex: 1;
      padding: 0.8rem 1rem;
      font-size: 1rem;
      background: var(--surface-hover);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      outline: none;
      transition: border-color var(--transition), box-shadow var(--transition);
    }
    input[type="text"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(145, 70, 255, 0.3);
    }
    button {
      padding: 0.8rem 1.2rem;
      font-size: 1rem;
      font-weight: 600;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
      transition: background var(--transition), transform 0.1s ease;
      white-space: nowrap;
    }
    button:hover { background: var(--accent-hover); }
    button:active { transform: scale(0.98); }
    #loading {
      display: none;
      margin: 1rem 0;
      color: var(--text-secondary);
      font-style: italic;
      text-align: center;
    }
    #error {
      color: #ff4444;
      margin-top: 1rem;
      font-size: 0.9rem;
      text-align: center;
    }
    #results {
      margin-top: 2rem;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    .stream-item {
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1rem;
      transition: border-color var(--transition);
    }
    .stream-item:hover { border-color: var(--accent); }
    .stream-item label {
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .url-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .url-row input[type="text"] {
      flex: 1;
      background: #0a0a0a;
      border: 1px solid #333;
      padding: 0.6rem 0.8rem;
      font-size: 0.9rem;
    }
    .copy-btn {
      background: #333;
      color: #fff;
      padding: 0.6rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .copy-btn:hover { background: #444; }
    .copy-btn.copied {
      background: #2e7d32;
      pointer-events: none;
    }
    footer {
      margin-top: 2rem;
      text-align: center;
      color: var(--text-secondary);
      font-size: 0.8rem;
    }

    @media (max-width: 600px) {
      body {
        padding: 0.5rem;
        align-items: flex-start;
      }
      .container {
        padding: 1.2rem;
        border-radius: 6px;
      }
      h1 { font-size: 1.5rem; }
      .subtitle { font-size: 0.85rem; margin-bottom: 1.5rem; }
      .input-row { flex-direction: column; }
      .input-row input[type="text"] { width: 100%; }
      .input-row button { width: 100%; }
      .url-row { flex-direction: column; align-items: stretch; }
      .url-row input[type="text"] { width: 100%; }
      .url-row .copy-btn { width: 100%; }
      .stream-item { padding: 0.8rem; }
      label { font-size: 0.8rem; }
      footer { font-size: 0.75rem; }
      #results { grid-template-columns: 1fr; }
    }

    @media (min-width: 601px) {
      .input-row { flex-direction: row; }
      .url-row { flex-direction: row; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 id="mainTitle" class="rainbow-text">Streaming Platform → m3u8</h1>
    <p class="subtitle">Enter a Twitch channel name or YouTube live URL</p>
    <div class="input-row">
      <input type="text" id="inputUrl" placeholder="e.g. twitch, shroud, or https://youtube.com/watch?v=..." />
      <button onclick="getStreams()">Get Streams</button>
    </div>
    <div id="loading">Loading…</div>
    <div id="results"></div>
    <div id="error"></div>
    <footer>Works with live channels • AMOLED friendly</footer>
  </div>

  <script>
    // Change the accent color and title based on platform
    function setPlatform(platform) {
      const root = document.documentElement;
      const title = document.getElementById('mainTitle');
      if (platform === 'twitch') {
        root.style.setProperty('--accent', '#9146ff');
        root.style.setProperty('--accent-hover', '#772ce8');
        title.textContent = 'Twitch → m3u8';
        title.classList.remove('rainbow-text');
      } else if (platform === 'youtube') {
        root.style.setProperty('--accent', '#ff0000');
        root.style.setProperty('--accent-hover', '#cc0000');
        title.textContent = 'YouTube → m3u8';
        title.classList.remove('rainbow-text');
      } else {
        // Reset to default rainbow
        root.style.setProperty('--accent', '#9146ff');
        root.style.setProperty('--accent-hover', '#772ce8');
        title.textContent = 'Streaming Platform → m3u8';
        title.classList.add('rainbow-text');
      }
    }

    async function getStreams() {
      const input = document.getElementById('inputUrl').value.trim();
      if (!input) return;

      const loading = document.getElementById('loading');
      const results = document.getElementById('results');
      const error = document.getElementById('error');
      loading.style.display = 'block';
      results.innerHTML = '';
      error.textContent = '';

      // Detect platform: if it's a YouTube URL, treat as YouTube, otherwise Twitch channel
      const isYouTube = /youtube\.com|youtu\.be/i.test(input);
      setPlatform(isYouTube ? 'youtube' : 'twitch');

      try {
        const response = await fetch('/getstreams?url=' + encodeURIComponent(input));
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Request failed');
        }

        if (!data.streams || data.streams.length === 0) {
          throw new Error('No streams found. Channel might be offline or does not exist.');
        }

        data.streams.forEach(stream => {
          const div = document.createElement('div');
          div.className = 'stream-item';

          const label = document.createElement('label');
          label.textContent = stream.quality;

          const rowDiv = document.createElement('div');
          rowDiv.className = 'url-row';

          const input = document.createElement('input');
          input.type = 'text';
          input.readOnly = true;
          input.value = stream.url;

          const copyBtn = document.createElement('button');
          copyBtn.className = 'copy-btn';
          copyBtn.textContent = 'Copy';
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(stream.url).then(() => {
              copyBtn.textContent = 'Copied!';
              copyBtn.classList.add('copied');
              setTimeout(() => {
                copyBtn.textContent = 'Copy';
                copyBtn.classList.remove('copied');
              }, 1500);
            }).catch(err => {
              input.select();
              document.execCommand('copy');
              copyBtn.textContent = 'Copied!';
              setTimeout(() => {
                copyBtn.textContent = 'Copy';
              }, 1500);
            });
          });

          rowDiv.appendChild(input);
          rowDiv.appendChild(copyBtn);
          div.appendChild(label);
          div.appendChild(rowDiv);
          results.appendChild(div);
        });
      } catch (err) {
        error.textContent = 'Error: ' + err.message;
      } finally {
        loading.style.display = 'none';
      }
    }
  </script>
</body>
</html>`;

// ---------- Helper Functions ----------

/**
 * Fetch Twitch access token for a live channel.
 */
async function getTwitchAccessToken(channel) {
  const query = {
    ...TWITCH_ACCESS_TOKEN_QUERY,
    variables: { ...TWITCH_ACCESS_TOKEN_QUERY.variables, login: channel }
  };

  const resp = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'Client-ID': CLIENT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(query)
  });

  if (!resp.ok) {
    throw new Error(`Twitch GQL API returned ${resp.status}`);
  }

  const json = await resp.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message || 'Twitch GQL error');
  }
  if (!json.data?.streamPlaybackAccessToken) {
    throw new Error('No access token received. Twitch channel may be offline or invalid.');
  }

  const { signature, value } = json.data.streamPlaybackAccessToken;
  if (!signature || !value) {
    throw new Error('Invalid Twitch access token format');
  }
  return { signature, value };
}

/**
 * Build and fetch Twitch master playlist URL.
 */
async function getTwitchMasterM3U8(channel, token, signature) {
  const params = new URLSearchParams({
    platform: 'web',
    p: String(Math.floor(Math.random() * 1000000)),
    allow_source: 'true',
    allow_audio_only: 'true',
    playlist_include_framerate: 'true',
    multigroup_video: 'true',
    supported_codecs: 'h264',
    sig: signature,
    token: token,
    fast_bread: 'true'
  });

  const masterUrl = `${USHER_BASE}${channel.toLowerCase()}.m3u8?${params.toString()}`;

  const resp = await fetch(masterUrl, {
    headers: {
      'Referer': 'https://player.twitch.tv',
      'Origin': 'https://player.twitch.tv',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!resp.ok) {
    throw new Error(`Twitch Usher returned ${resp.status}. Channel may be offline or token expired.`);
  }
  return { text: await resp.text(), url: masterUrl };
}

/**
 * Parse a master m3u8 playlist and extract variant streams.
 */
function parseMasterPlaylist(masterText, masterUrl) {
  const lines = masterText.split('\n');
  const streams = [];
  let currentStreamInfo = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      currentStreamInfo = {};
      const attrs = line.substring('#EXT-X-STREAM-INF:'.length).split(',');
      attrs.forEach(attr => {
        const idx = attr.indexOf('=');
        if (idx > 0) {
          const key = attr.substring(0, idx).trim();
          const value = attr.substring(idx + 1).trim().replace(/^"|"$/g, '');
          currentStreamInfo[key] = value;
        }
      });
    } else if (line && !line.startsWith('#')) {
      if (currentStreamInfo) {
        let quality = 'Unknown';
        if (currentStreamInfo['STABLE-VARIANT-ID']) {
          quality = currentStreamInfo['STABLE-VARIANT-ID'].toLowerCase();
        } else if (currentStreamInfo['RESOLUTION']) {
          quality = currentStreamInfo['RESOLUTION'];
          if (currentStreamInfo['FRAME-RATE']) {
            quality += ` ${currentStreamInfo['FRAME-RATE']}fps`;
          }
        } else if (currentStreamInfo['NAME']) {
          quality = currentStreamInfo['NAME'];
        }
        if (quality.startsWith('audio')) {
          quality = 'audio_only';
        }
        const resolvedUrl = new URL(line, masterUrl).toString();
        streams.push({ quality, url: resolvedUrl });
      }
      currentStreamInfo = null;
    }
  }
  return streams;
}

/**
 * Twitch stream fetching orchestration.
 */
async function getTwitchStreams(channel) {
  const { signature, value } = await getTwitchAccessToken(channel);
  const { text, url } = await getTwitchMasterM3U8(channel, value, signature);
  return parseMasterPlaylist(text, url);
}

// ---------- YouTube Functions ----------

/**
 * Extract YouTube video ID from various URL forms, or by fetching the page.
 */
async function extractYouTubeVideoId(url) {
  // Direct video ID patterns
  const patterns = [
    /youtube\.com\/watch\?.*v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
    /youtube\.com\/v\/([\w-]{11})/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // If not found, try to fetch the page and extract from ytInitialData
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!resp.ok) return null;
    const text = await resp.text();

    // Look for ytInitialData
    const dataRegex = /var\s+ytInitialData\s*=\s*({.*?});\s*<\/script>/s;
    const match = text.match(dataRegex);
    if (match) {
      const data = JSON.parse(match[1]);
      // Recursively search for videoId
      const videoId = findVideoId(data);
      if (videoId) return videoId;
    }

    // Try ytInitialPlayerResponse
    const playerRegex = /var\s+ytInitialPlayerResponse\s*=\s*({.*?});\s*var\s+\w+\s*=/s;
    const playerMatch = text.match(playerRegex);
    if (playerMatch) {
      const playerData = JSON.parse(playerMatch[1]);
      if (playerData.videoDetails && playerData.videoDetails.videoId) {
        return playerData.videoDetails.videoId;
      }
    }
  } catch (e) {
    // ignore and return null
  }
  return null;
}

// Helper to search for videoId in nested objects
function findVideoId(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.videoId && typeof obj.videoId === 'string') return obj.videoId;
  for (const key in obj) {
    const result = findVideoId(obj[key]);
    if (result) return result;
  }
  return null;
}

/**
 * Fetch YouTube player response via innertube API.
 */
async function fetchYouTubePlayerResponse(videoId) {
  const resp = await fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: new URLSearchParams({ key: YT_API_KEY }),
    body: JSON.stringify({
      videoId: videoId,
      contentCheckOk: true,
      racyCheckOk: true,
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '21.08.266',
          platform: 'DESKTOP',
          clientScreen: 'EMBED',
          clientFormFactor: 'UNKNOWN_FORM_FACTOR',
          browserName: 'Chrome',
        },
        user: { lockedSafetyMode: 'false' },
        request: { useSsl: 'true' },
      },
    }),
  });

  if (!resp.ok) {
    throw new Error(`YouTube API returned ${resp.status}`);
  }
  return await resp.json();
}

/**
 * YouTube stream fetching.
 */
async function getYouTubeStreams(url) {
  const videoId = await extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error('Could not find YouTube video ID. Make sure the URL is correct and the video is live.');
  }

  const playerResponse = await fetchYouTubePlayerResponse(videoId);

  // Check playability status
  const status = playerResponse?.playabilityStatus?.status;
  const reason = playerResponse?.playabilityStatus?.reason;
  if (status && status !== 'OK') {
    throw new Error(`YouTube error: ${status}${reason ? ' - ' + reason : ''}`);
  }

  const hlsManifestUrl = playerResponse?.streamingData?.hlsManifestUrl;
  if (!hlsManifestUrl) {
    throw new Error('No HLS manifest found. The video might not be live or is protected.');
  }

  const resp = await fetch(hlsManifestUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch YouTube HLS manifest (${resp.status})`);
  }
  const masterText = await resp.text();
  return parseMasterPlaylist(masterText, hlsManifestUrl);
}

// ---------- Main Request Handler ----------

async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === '/') {
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  if (url.pathname === '/getstreams') {
    const inputUrl = url.searchParams.get('url');
    if (!inputUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      let streams;
      if (/youtube\.com|youtu\.be/i.test(inputUrl)) {
        streams = await getYouTubeStreams(inputUrl);
      } else {
        // Assume Twitch channel name
        streams = await getTwitchStreams(inputUrl.trim());
      }
      return new Response(JSON.stringify({ streams }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Not found', { status: 404 });
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
