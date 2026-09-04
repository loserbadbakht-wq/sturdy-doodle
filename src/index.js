// Cloudflare Worker: Twitch → m3u8 URL generator (AMOLED theme + copy buttons)

const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const GQL_URL = 'https://gql.twitch.tv/gql';
const USHER_BASE = 'https://usher.ttvnw.net/api/v2/channel/hls/';
const PLAYBACK_ACCESS_TOKEN_QUERY = {
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

// AMOLED-friendly, modern HTML page
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Twitch → m3u8</title>
  <style>
    :root {
      --bg: #000000;
      --surface: #121212;
      --surface-hover: #1e1e1e;
      --text: #ffffff;
      --text-secondary: #b3b3b3;
      --accent: #9146ff;
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
      max-width: 720px;
      background: var(--surface);
      border-radius: var(--radius);
      padding: 2rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    }
    h1 {
      color: var(--accent);
      margin-bottom: 0.5rem;
      font-size: 1.8rem;
      letter-spacing: -0.5px;
    }
    .subtitle {
      color: var(--text-secondary);
      margin-bottom: 2rem;
      font-size: 0.95rem;
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
    }
    #error {
      color: #ff4444;
      margin-top: 1rem;
      font-size: 0.9rem;
    }
    #results {
      margin-top: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .stream-item {
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1rem;
      transition: border-color var(--transition);
    }
    .stream-item:hover { border-color: var(--accent); } /* changed to purple */
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
  </style>
</head>
<body>
  <div class="container">
    <h1>Twitch → m3u8</h1>
    <p class="subtitle">Get direct HLS stream URLs for any live channel</p>
    <div class="input-row">
      <input type="text" id="channel" placeholder="e.g. twitch, shroud, xqcow..." />
      <button onclick="getStreams()">Get Streams</button>
    </div>
    <div id="loading">Loading…</div>
    <div id="results"></div>
    <div id="error"></div>
    <footer>Works best with live channels • AMOLED friendly</footer>
  </div>

  <script>
    async function getStreams() {
      const channel = document.getElementById('channel').value.trim();
      if (!channel) return;

      const loading = document.getElementById('loading');
      const results = document.getElementById('results');
      const error = document.getElementById('error');
      loading.style.display = 'block';
      results.innerHTML = '';
      error.textContent = '';

      try {
        const response = await fetch('/getstreams?channel=' + encodeURIComponent(channel));
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
              // Fallback for older browsers
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

/**
 * Fetch the playback access token for a live channel.
 */
async function getAccessToken(channel) {
  const query = {
    ...PLAYBACK_ACCESS_TOKEN_QUERY,
    variables: { ...PLAYBACK_ACCESS_TOKEN_QUERY.variables, login: channel }
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
    throw new Error(`GQL API returned ${resp.status}`);
  }

  const json = await resp.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message || 'GQL error');
  }
  if (!json.data?.streamPlaybackAccessToken) {
    throw new Error('No access token received. Channel may be offline or invalid.');
  }

  const { signature, value } = json.data.streamPlaybackAccessToken;
  if (!signature || !value) {
    throw new Error('Invalid access token format');
  }
  return { signature, value };
}

/**
 * Build the usher master playlist URL and fetch it.
 */
async function getMasterM3U8(channel, token, signature) {
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
    throw new Error(`Usher returned ${resp.status}. The channel may be offline or the token expired.`);
  }
  return { text: await resp.text(), url: masterUrl };
}

/**
 * Parse the master m3u8 and extract variant streams.
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
 * Main function: orchestrates token fetch, master playlist fetch, and parsing.
 */
async function getStreams(channel) {
  const { signature, value } = await getAccessToken(channel);
  const { text, url } = await getMasterM3U8(channel, value, signature);
  return parseMasterPlaylist(text, url);
}

/**
 * Cloudflare Worker request handler.
 */
async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === '/') {
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  if (url.pathname === '/getstreams') {
    const channel = url.searchParams.get('channel');
    if (!channel) {
      return new Response(JSON.stringify({ error: 'Missing channel parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const streams = await getStreams(channel);
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
