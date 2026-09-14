// Cloudflare Worker – YouTube No‑Cookie Embed Proxy
// Deploy as a Worker (ES Module syntax)

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    // 1. Validate the provided URL
    if (!target) {
      return new Response('Missing "url" parameter. Example: /?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    let videoId = null;
    let playlistId = null;

    try {
      const u = new URL(target);
      // Extract video ID from standard watch URLs, short youtu.be links, or embed URLs
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
      // Invalid URL
    }

    if (!videoId && !playlistId) {
      return new Response('Invalid YouTube URL. Provide a watch, youtu.be, embed, or playlist link.', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 2. Build the no‑cookie embed URL (https://www.youtube-nocookie.com/embed/…)
    const embedBase = 'https://www.youtube-nocookie.com/embed/';
    let embedUrl = '';
    if (videoId) {
      embedUrl = `${embedBase}${videoId}`;
    } else if (playlistId) {
      embedUrl = `${embedBase}videoseries?list=${playlistId}`;
    }

    // 3. Return an HTML page with the iframe
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

    // 4. Set privacy‑enhancing headers
    const headers = new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      // Prevent the browser from sending the referrer to YouTube
      'Referrer-Policy': 'no-referrer',
      // Optional: restrict which origins can embed this page
      // 'Content-Security-Policy': "frame-ancestors 'self'",
      // Cache for a short time to reduce repeated requests
      'Cache-Control': 'public, max-age=300',
    });

    return new Response(html, { headers });
  },
};
