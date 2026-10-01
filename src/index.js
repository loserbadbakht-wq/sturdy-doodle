// worker.js
import jikanjs from 'https://esm.sh/jikanjs@0.7.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+|\/+$/g, '');
    const segments = path ? path.split('/') : [];
    const query = url.searchParams;

    // Root endpoint: list available routes
    if (segments.length === 0) {
      return jsonResponse({
        message: 'Jikan API Proxy',
        endpoints: {
          '/anime/:id': 'Get anime by ID',
          '/anime/:id/:request': 'Get anime sub-resource (episodes, characters, etc.)',
          '/manga/:id': 'Get manga by ID',
          '/manga/:id/:request': 'Get manga sub-resource',
          '/character/:id': 'Get character by ID',
          '/character/:id/:request': 'Get character sub-resource',
          '/search/:type': 'Search (anime, manga, person, character) — use ?q=, &page=, &limit=',
          '/top/:type': 'Top list (anime, manga) — use ?page=, &subtype=',
          '/season/:year/:season': 'Seasonal anime (e.g. /season/2024/winter)',
          '/schedule/:day': 'Anime schedule for a day of the week',
        },
      });
    }

    try {
      const [resource, id, subresource] = segments;

      // ── Anime ──────────────────────────────────────────────
      if (resource === 'anime' && id) {
        const data = await jikanjs.loadAnime(
          Number(id),
          subresource || undefined
        );
        return jsonResponse(data);
      }

      // ── Manga ──────────────────────────────────────────────
      if (resource === 'manga' && id) {
        const data = await jikanjs.loadManga(
          Number(id),
          subresource || undefined
        );
        return jsonResponse(data);
      }

      // ── Character ──────────────────────────────────────────
      if (resource === 'character' && id) {
        const data = await jikanjs.loadCharacter(
          Number(id),
          subresource || undefined
        );
        return jsonResponse(data);
      }

      // ── Search ─────────────────────────────────────────────
      if (resource === 'search' && id) {
        const q = query.get('q');
        if (!q) {
          return jsonResponse({ error: 'Missing query parameter: q' }, 400);
        }
        const page = query.get('page') ? Number(query.get('page')) : undefined;
        const limit = query.get('limit') ? Number(query.get('limit')) : undefined;
        const data = await jikanjs.search(id, q, page, {}, limit);
        return jsonResponse(data);
      }

      // ── Top ────────────────────────────────────────────────
      if (resource === 'top' && id) {
        const page = query.get('page') ? Number(query.get('page')) : undefined;
        const subtype = query.get('subtype') || undefined;
        const data = await jikanjs.loadTop(id, page, subtype);
        return jsonResponse(data);
      }

      // ── Season ─────────────────────────────────────────────
      if (resource === 'season' && id && subresource) {
        const data = await jikanjs.loadSeason(Number(id), subresource);
        return jsonResponse(data);
      }

      // ── Schedule ───────────────────────────────────────────
      if (resource === 'schedule' && id) {
        const data = await jikanjs.loadSchedule(id);
        return jsonResponse(data);
      }

      // ── Fallback ───────────────────────────────────────────
      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('Jikan API error:', err);
      return jsonResponse(
        { error: err.message || 'Internal server error' },
        500
      );
    }
  },
};
