// Cloudflare Worker: Twitch → m3u8 URL generator

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

// Simple HTML page
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Twitch → m3u8</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    h1 { color: #9146ff; }
    input[type="text"] { width: 100%; padding: 0.5rem; font-size: 1rem; margin-bottom: 1rem; }
    button { padding: 0.6rem 1.2rem; font-size: 1rem; background: #9146ff; color: white; border: none; cursor: pointer; }
    button:hover { background: #772ce8; }
    #results { margin-top: 2rem; }
    .stream-item { margin-bottom: 1rem; }
    .stream-item label { display: block; font-weight: bold; margin-bottom: 0.2rem; }
    .stream-item input[type="text"] { width: 100%; padding: 0.4rem; }
    #error { color: red; margin-top: 1rem; }
    #loading { display: none; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>Twitch → m3u8 URL Generator</h1>
  <p>Enter a Twitch channel name (e.g. <code>twitch</code>)</p>
  <input type="text" id="channel" placeholder="Channel name..." />
  <button onclick="getStreams()">Get Streams</button>
  <div id="loading">Loading…</div>
  <div id="results"></div>
  <div id="error"></div>

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
          const input = document.createElement('input');
          input.type = 'text';
          input.readOnly = true;
          input.value = stream.url;
          div.appendChild(label);
          div.appendChild(input);
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
      // User-Agent is set automatically by the Worker
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
      // Parse attributes like BANDWIDTH=..., RESOLUTION=..., etc.
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
      // This is the URL for the previous EXT-X-STREAM-INF
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
        // Mark audio-only
        if (quality.startsWith('audio')) {
          quality = 'audio_only';
        }
        // Resolve relative URL
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
  // 1. Get access token
  const { signature, value } = await getAccessToken(channel);
  // 2. Get master playlist
  const { text, url } = await getMasterM3U8(channel, value, signature);
  // 3. Parse variants
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
