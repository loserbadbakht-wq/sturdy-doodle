// Cloudflare Worker: Scan Shadowsocks configs for UDP support
export default {
  async fetch(request) {
    const { method, url } = request;

    // Serve the HTML form on GET requests
    if (method === "GET") {
      return new Response(getFormHTML(), {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }

    // Handle form submission on POST
    if (method === "POST") {
      const formData = await request.formData();
      const txtUrl = formData.get("url");

      if (!txtUrl) {
        return new Response("Missing URL parameter", { status: 400 });
      }

      try {
        // Fetch the text file
        const resp = await fetch(txtUrl);
        if (!resp.ok) {
          throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`);
        }
        const text = await resp.text();

        // Parse lines and filter for UDP-enabled SS configs
        const lines = text.split(/\r?\n/);
        const results = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;

          const info = parseSSConfig(trimmed);
          if (info && info.udp) {
            results.push(info);
          }
        }

        // Return the results as an HTML page
        return new Response(getResultsHTML(results, txtUrl), {
          headers: { "content-type": "text/html;charset=UTF-8" },
        });
      } catch (err) {
        return new Response(`Error: ${err.message}`, { status: 500 });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  },
};

/**
 * Parses a Shadowsocks URI and returns an object with UDP support info.
 * Supports SIP002 and legacy formats.
 * @param {string} uri
 * @returns {{uri: string, udp: boolean, reason: string} | null}
 */
function parseSSConfig(uri) {
  // Only handle ss:// URIs
  if (!uri.startsWith("ss://")) return null;

  try {
    // Split off the fragment (tag) and query
    const withoutFragment = uri.split("#")[0];
    const [base, queryString] = withoutFragment.split("?");

    // Parse the query parameters
    const params = new URLSearchParams(queryString || "");
    const udpParam = params.get("udp");
    const udpRelayParam = params.get("udp-relay");
    const pluginParam = params.get("plugin");

    // Check for UDP indicators
    let udp = false;
    let reason = "";

    // 1. Query parameter udp=true / udp=1
    if (udpParam === "true" || udpParam === "1") {
      udp = true;
      reason = "udp=true in query";
    }
    // 2. Query parameter udp-relay=true
    else if (udpRelayParam === "true") {
      udp = true;
      reason = "udp-relay=true in query";
    }
    // 3. Plugin options may indicate UDP (e.g., v2ray-plugin;mode=quic)
    else if (pluginParam) {
      const pluginLower = pluginParam.toLowerCase();
      if (
        pluginLower.includes("mode=quic") ||
        pluginLower.includes("mode=udp") ||
        pluginLower.includes("udp")
      ) {
        udp = true;
        reason = `plugin indicates UDP (${pluginParam})`;
      }
    }

    // 4. For SIP002 JSON payloads (base64-encoded JSON after ss://)
    //    Also check for a top-level "udp" field.
    if (!udp) {
      // Try to detect a base64-encoded JSON blob in the userinfo part
      const afterScheme = base.replace("ss://", "");
      // A simple heuristic: if it looks like base64 and contains no '@', it might be JSON
      if (/^[A-Za-z0-9+/=]+$/.test(afterScheme) && !afterScheme.includes("@")) {
        try {
          const decoded = atob(afterScheme);
          const json = JSON.parse(decoded);
          if (json.udp === true) {
            udp = true;
            reason = "udp=true in decoded JSON";
          }
        } catch (_) {
          // Not JSON, ignore
        }
      }
    }

    if (udp) {
      return { uri, udp: true, reason };
    }
    return { uri, udp: false, reason: "" };
  } catch (e) {
    return null; // Invalid URI
  }
}

/**
 * Returns the HTML for the input form.
 */
function getFormHTML() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shadowsocks UDP Scanner</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
    input[type="url"] { width: 100%; padding: 0.75rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; }
    button { margin-top: 1rem; padding: 0.75rem 1.5rem; font-size: 1rem; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    .hint { color: #666; font-size: 0.9rem; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <h1>Shadowsocks UDP Scanner</h1>
  <p>Enter the URL of a text file containing <code>ss://</code> configurations (one per line).</p>
  <form method="POST">
    <label for="url">Text file URL</label>
    <input type="url" id="url" name="url" placeholder="https://example.com/configs.txt" required>
    <div class="hint">The file should contain one Shadowsocks URI per line.</div>
    <button type="submit">Scan for UDP support</button>
  </form>
</body>
</html>`;
}

/**
 * Returns the HTML for the results page.
 * @param {Array} results
 * @param {string} sourceUrl
 */
function getResultsHTML(results, sourceUrl) {
  if (results.length === 0) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UDP Scan Results</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    .back { margin-bottom: 1rem; }
    .back a { color: #2563eb; text-decoration: none; }
    .back a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="back"><a href="/">← Scan another file</a></div>
  <h1>UDP Scan Results</h1>
  <p>No Shadowsocks configurations with UDP support found in <code>${escapeHtml(sourceUrl)}</code>.</p>
</body>
</html>`;
  }

  const rows = results
    .map(
      (r) => `
    <tr>
      <td><code>${escapeHtml(r.uri)}</code></td>
      <td>${escapeHtml(r.reason)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UDP Scan Results</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    .back { margin-bottom: 1rem; }
    .back a { color: #2563eb; text-decoration: none; }
    .back a:hover { text-decoration: underline; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    td code { word-break: break-all; font-size: 0.9rem; }
    .count { color: #666; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="back"><a href="/">← Scan another file</a></div>
  <h1>UDP Scan Results</h1>
  <p>Found <strong>${results.length}</strong> Shadowsocks configuration(s) with UDP support in <code>${escapeHtml(sourceUrl)}</code>.</p>
  <table>
    <thead>
      <tr>
        <th>Configuration URI</th>
        <th>Reason</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}

/**
 * Escapes HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
                  }
