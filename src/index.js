export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    // If no URL provided, show the input form
    if (!target) {
      return new Response(getFormHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Extract video ID or playlist ID
    let videoId = null;
    let playlistId = null;

    try {
      const u = new URL(target);
      if (u.hostname === 'youtu.be') {
        videoId = u.pathname.slice(1);
      } else if (u.hostname.endsWith('youtube.com')) {
        if (u.pathname === '/watch') {
          videoId = u.searchParams.get('v');
        } else if (u.pathname.startsWith('/embed/')) {
          videoId = u.pathname.split('/')[2];
        } else if (u.pathname === '/playlist') {
          playlistId = u.searchParams.get('list');
        }
      }
    } catch {
      // Not a valid URL, maybe just a video ID?
      if (/^[a-zA-Z0-9_-]{11}$/.test(target)) {
        videoId = target;
      }
    }

    if (!videoId && !playlistId) {
      return new Response('Invalid YouTube URL. Please go back and try again.', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Build no-cookie embed URL
    const embedBase = 'https://www.youtube-nocookie.com/embed/';
    let embedUrl = '';
    if (videoId) {
      embedUrl = `${embedBase}${videoId}`;
    } else if (playlistId) {
      embedUrl = `${embedBase}videoseries?list=${playlistId}`;
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouTube No‑Cookie Embed</title>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000; }
    iframe { width: 100%; max-width: 960px; aspect-ratio: 16 / 9; border: 0; }
  </style>
</head>
<body>
  <iframe
    src="${embedUrl}"
    title="YouTube video player"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen
  ></iframe>
</body>
</html>`.trim();

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'public, max-age=300',
      },
    });
  },
};

function getFormHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouTube No‑Cookie Embedder</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #111; color: #eee; }
    form { background: #222; padding: 2rem; border-radius: 12px; width: 100%; max-width: 500px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
    h1 { margin-top: 0; font-size: 1.4rem; }
    input[type="url"] { width: 100%; padding: 0.75rem; font-size: 1rem; border: 1px solid #444; border-radius: 6px; background: #333; color: #eee; box-sizing: border-box; }
    button { margin-top: 1rem; width: 100%; padding: 0.75rem; font-size: 1rem; background: #ff0000; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
    button:hover { background: #cc0000; }
    p { font-size: 0.85rem; color: #aaa; margin-top: 1rem; }
  </style>
</head>
<body>
  <form action="/" method="GET">
    <h1>YouTube No‑Cookie Embed</h1>
    <input type="url" name="url" placeholder="Paste YouTube link here…" required autofocus>
    <button type="submit">Embed Video</button>
    <p>Supports watch, youtu.be, embed, and playlist links.</p>
  </form>
</body>
</html>`.trim();
        }
