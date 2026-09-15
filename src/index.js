/**
 * Cloudflare Worker — Shadowsocks / ShadowsocksR UDP Scanner
 *
 * GET  /              -> HTML page with a URL input bar
 * GET  /?url=<txt>    -> scans the txt link and lists UDP-capable configs
 * GET  /api?url=<txt> -> same, but returns JSON
 *
 * Supported link formats
 *   ss://base64(method:pass@host:port)#tag
 *   ss://base64(method:pass)@host:port?plugin=...#tag
 *   ss://method:pass@host:port#tag                     (SIP002)
 *   ssr://base64(host:port:proto:method:obfs:b64pass/?params)#tag
 *   ssr://host:port:proto:method:obfs:b64pass/?params#tag   (plaintext form)
 *
 * "Uses UDP" logic
 *   1. explicit udp / udp-relay / udp_relay param  -> wins
 *   2. ssr://                                      -> never (TCP only)
 *   3. ss:// + obfs plugin                         -> TCP only
 *   4. ss:// + v2ray/xray plugin                   -> UDP tunnelled
 *   5. plain ss://                                 -> UDP capable
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/* ------------------------------------------------------------------ */
/* Base64 helpers                                                      */
/* ------------------------------------------------------------------ */

function b64decode(input) {
  let s = String(input).trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  if (!s) return '';
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function tryB64decode(s) {
  try {
    const out = b64decode(s);
    if (!out) return null;
    if (/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(out)) return null;
    return out;
  } catch {
    return null;
  }
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function splitHostPort(hp) {
  hp = String(hp).trim();
  if (hp.startsWith('[')) {
    const end = hp.indexOf(']');
    if (end !== -1) return [hp.slice(1, end), hp.slice(end + 1).replace(/^:/, '')];
  }
  const i = hp.lastIndexOf(':');
  if (i === -1) return [hp, ''];
  return [hp.slice(0, i), hp.slice(i + 1)];
}

function esc(s) {
  return String(s === undefined || s === null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/* ------------------------------------------------------------------ */
/* Parsers                                                             */
/* ------------------------------------------------------------------ */

function parseSS(raw) {
  const cfg = {
    type: 'ss',
    raw,
    host: '',
    port: '',
    method: '',
    password: '',
    plugin: '',
    protocol: '',
    obfs: '',
    params: {},
    remarks: '',
  };

  let rest = raw.slice(5);

  const hash = rest.indexOf('#');
  if (hash !== -1) {
    cfg.remarks = safeDecode(rest.slice(hash + 1)).trim();
    rest = rest.slice(0, hash);
  }

  const q = rest.indexOf('?');
  if (q !== -1) {
    const qs = rest.slice(q + 1);
    rest = rest.slice(0, q);
    for (const [k, v] of new URLSearchParams(qs)) cfg.params[k.toLowerCase()] = v;
  }

  rest = rest.replace(/\/+$/, '');

  let userinfo, hostport;
  const at = rest.lastIndexOf('@');

  if (at !== -1) {
    userinfo = rest.slice(0, at);
    hostport = rest.slice(at + 1);
    if (!userinfo.includes(':')) {
      const d = tryB64decode(userinfo);
      userinfo = d !== null ? d : safeDecode(userinfo);
    } else {
      userinfo = safeDecode(userinfo);
    }
  } else {
    const d = tryB64decode(rest);
    if (d === null) throw new Error('Invalid ss:// payload (not base64, no userinfo@host)');
    const at2 = d.lastIndexOf('@');
    if (at2 === -1) throw new Error('Invalid ss:// payload (no @ separator)');
    userinfo = d.slice(0, at2);
    hostport = d.slice(at2 + 1);
  }

  const ci = userinfo.indexOf(':');
  if (ci !== -1) {
    cfg.method = userinfo.slice(0, ci);
    cfg.password = userinfo.slice(ci + 1);
  } else {
    cfg.method = userinfo;
  }

  const [h, p] = splitHostPort(hostport);
  cfg.host = h;
  cfg.port = p;
  cfg.plugin = cfg.params.plugin || '';
  return cfg;
}

function parseSSR(raw) {
  const cfg = {
    type: 'ssr',
    raw,
    host: '',
    port: '',
    protocol: '',
    method: '',
    obfs: '',
    password: '',
    params: {},
    remarks: '',
    group: '',
  };

  let rest = raw.slice(6);

  const hash = rest.indexOf('#');
  if (hash !== -1) {
    cfg.remarks = safeDecode(rest.slice(hash + 1)).trim();
    rest = rest.slice(0, hash);
  }

  let query = '';
  const q = rest.indexOf('/?');
  if (q !== -1) {
    query = rest.slice(q + 2);
    rest = rest.slice(0, q);
  } else {
    const q2 = rest.indexOf('?');
    if (q2 !== -1) {
      query = rest.slice(q2 + 1);
      rest = rest.slice(0, q2);
    }
  }
  rest = rest.replace(/\/+$/, '');

  let body = tryB64decode(rest);
  if (body === null || body.split(':').length < 6) {
    body = safeDecode(rest);
  }
  if (!body || body.split(':').length < 6) {
    throw new Error('Malformed SSR payload (expected at least 6 ":"-separated fields)');
  }

  const parts = body.split(':');
  cfg.host = parts[0];
  cfg.port = parts[1];
  cfg.protocol = parts[2];
  cfg.method = parts[3];
  cfg.obfs = parts[4];

  const passRaw = parts.slice(5).join(':');
  cfg.password = tryB64decode(passRaw) ?? passRaw;

  for (const [k, v] of new URLSearchParams(query)) {
    const key = k.toLowerCase();
    if (key === 'remarks') {
      cfg.remarks = (tryB64decode(v) ?? safeDecode(v)).trim();
    } else if (key === 'group') {
      cfg.group = (tryB64decode(v) ?? safeDecode(v)).trim();
    } else if (key === 'obfsparam') {
      cfg.params.obfsparam = tryB64decode(v) ?? safeDecode(v);
    } else if (key === 'protoparam') {
      cfg.params.protoparam = tryB64decode(v) ?? safeDecode(v);
    } else {
      cfg.params[key] = v;
    }
  }

  return cfg;
}

/* ------------------------------------------------------------------ */
/* UDP detection                                                       */
/* ------------------------------------------------------------------ */

function detectUdp(cfg) {
  const p = cfg.params || {};

  for (const key of ['udp', 'udp-relay', 'udp_relay', 'udprelay']) {
    if (p[key] !== undefined && p[key] !== '') {
      const on = /^(1|true|yes|on|enable|enabled)$/i.test(String(p[key]));
      return { udp: on, reason: `link declares ${key}=${p[key]}` };
    }
  }
  if (p.network && /udp/i.test(p.network)) {
    return { udp: true, reason: 'network=udp' };
  }

  if (cfg.type === 'ssr') {
    return { udp: false, reason: 'ShadowsocksR protocol has no UDP relay (TCP only)' };
  }

  const plugin = (cfg.plugin || '').toLowerCase();
  if (plugin) {
    if (plugin.includes('obfs')) {
      return { udp: false, reason: `plugin "${plugin}" is TCP only` };
    }
    if (plugin.includes('v2ray-plugin') || plugin.includes('xray-plugin')) {
      return { udp: true, reason: `plugin "${plugin}" tunnels UDP` };
    }
    return { udp: false, reason: `unknown plugin "${plugin}" — assumed TCP only` };
  }

  return { udp: true, reason: 'plain Shadowsocks supports UDP relay (server must enable it)' };
}

/* ------------------------------------------------------------------ */
/* Scanning                                                            */
/* ------------------------------------------------------------------ */

function maybeDecodeBase64(text) {
  if (text.includes('://')) return text;
  const cleaned = text.replace(/\s+/g, '');
  if (cleaned.length > 20 && /^[A-Za-z0-9+/\-_]+=*$/.test(cleaned)) {
    const d = tryB64decode(cleaned);
    if (d && d.includes('://')) return d;
  }
  return text;
}

function extractUrisFromLine(line) {
  const out = [];
  const re = /ssr?:\/\//gi;
  const marks = [];
  let m;
  while ((m = re.exec(line)) !== null) marks.push(m.index);
  if (!marks.length) return out;

  for (let i = 0; i < marks.length; i++) {
    const start = marks[i];
    const end = i + 1 < marks.length ? marks[i + 1] : line.length;
    const uri = line.slice(start, end).trim();
    if (uri.length > 6) out.push(uri);
  }
  return out;
}

async function scan(target) {
  const res = await fetch(target, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/plain,text/*,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} while fetching the subscription`);
  }

  const rawText = await res.text();
  const text = maybeDecodeBase64(rawText).replace(/^\uFEFF/, '');

  const lines = text.split(/\r\n|\r|\n/);

  const configs = [];
  const errors = [];

  for (const line of lines) {
    for (const uri of extractUrisFromLine(line)) {
      try {
        const cfg = uri.startsWith('ssr://') ? parseSSR(uri) : parseSS(uri);
        const d = detectUdp(cfg);
        cfg.udp = d.udp;
        cfg.udpReason = d.reason;
        configs.push(cfg);
      } catch (e) {
        errors.push({ uri: uri.slice(0, 160), error: String((e && e.message) || e) });
      }
    }
  }

  const stats = {
    total: configs.length,
    udp: configs.filter((c) => c.udp).length,
    tcpOnly: configs.filter((c) => !c.udp).length,
    ss: configs.filter((c) => c.type === 'ss').length,
    ssr: configs.filter((c) => c.type === 'ssr').length,
    parseErrors: errors.length,
  };

  const preview = lines.filter((l) => l.trim()).slice(0, 30);

  return { configs, stats, errors, preview };
}

/* ------------------------------------------------------------------ */
/* HTML rendering                                                      */
/* ------------------------------------------------------------------ */

const STYLE = `
  :root{
    --bg:#0d1117; --panel:#161b22; --border:#30363d; --fg:#e6edf3;
    --muted:#8b949e; --accent:#58a6ff; --ok:#3fb950; --bad:#f85149; --warn:#d29922;
  }
  *{box-sizing:border-box}
  html,body{max-width:100%;overflow-x:hidden}
  body{
    margin:0; padding:20px 14px 56px; background:var(--bg); color:var(--fg);
    font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-text-size-adjust:100%;
  }
  .wrap{max-width:1400px;margin:0 auto}
  h1{font-size:20px;margin:0 0 4px;line-height:1.25}
  .sub{color:var(--muted);font-size:13px;margin:0 0 18px}
  .sub code,footer code{background:var(--panel);border:1px solid var(--border);border-radius:4px;padding:1px 5px}
  form{display:flex;gap:10px;flex-wrap:wrap;background:var(--panel);border:1px solid var(--border);
       border-radius:12px;padding:12px;margin-bottom:16px}
  input[type=url]{
    flex:1 1 320px;min-width:0;width:100%;background:#0d1117;border:1px solid var(--border);border-radius:8px;
    color:var(--fg);padding:11px 13px;font-size:16px;outline:none;
  }
  input[type=url]:focus{border-color:var(--accent)}
  label.chk{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;white-space:nowrap;
            padding:6px 2px;cursor:pointer}
  button{
    background:var(--accent);color:#03121f;border:0;border-radius:8px;padding:11px 20px;
    font-weight:700;cursor:pointer;font-size:15px;
  }
  button:hover{filter:brightness(1.1)}
  .stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .pill{background:var(--panel);border:1px solid var(--border);border-radius:999px;padding:5px 12px;
        font-size:12.5px;color:var(--muted);white-space:nowrap}
  .pill b{color:var(--fg)}
  .pill.ok b{color:var(--ok)} .pill.no b{color:var(--bad)} .pill.warn b{color:var(--warn)}
  .hint{color:var(--muted);font-size:13px;margin:0 0 12px}
  .hint a{color:var(--accent);display:inline-block;padding:2px 0}
  .alert{background:var(--panel);border:1px solid var(--border);border-left:3px solid var(--accent);
         border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:14px;overflow-wrap:anywhere}
  .alert.err{border-left-color:var(--bad)}
  pre.preview{background:#0d1117;border:1px solid var(--border);border-radius:8px;padding:12px;
              overflow:auto;max-height:380px;font-size:12px;line-height:1.45;margin-bottom:18px;
              font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#c9d1d9;white-space:pre}
  .tablewrap{width:100%}
  table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--border);
        border-radius:12px;overflow:hidden;font-size:13px}
  th,td{padding:9px 11px;text-align:left;border-bottom:1px solid var(--border);vertical-align:top}
  th{background:#1c2128;color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  tr:last-child td{border-bottom:0}
  tr:hover td{background:#1c2128}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;
        overflow-wrap:anywhere;word-break:break-word}
  .badge{display:inline-block;padding:1px 7px;border-radius:5px;font-size:11px;font-weight:700;text-transform:uppercase}
  .badge.ss{background:#1f6feb33;color:#79c0ff;border:1px solid #1f6feb66}
  .badge.ssr{background:#8957e533;color:#d2a8ff;border:1px solid #8957e566}
  .yes{color:var(--ok);font-weight:700;white-space:nowrap}
  .no{color:var(--bad);font-weight:600;white-space:nowrap}
  .why{color:var(--muted);max-width:280px;overflow-wrap:anywhere}
  .raw button{background:#21262d;color:var(--fg);border:1px solid var(--border);border-radius:6px;
              padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;min-height:28px}
  .raw button:hover{background:#30363d}
  footer{color:var(--muted);font-size:12px;margin-top:26px;line-height:1.7;overflow-wrap:anywhere}

  /* ---------- MOBILE ---------- */
  @media (max-width: 760px){
    body{padding:16px 10px 48px}
    h1{font-size:18px}
    form{padding:10px;gap:8px}
    input[type=url]{flex:1 1 100%;font-size:16px} /* 16px prevents iOS zoom */
    label.chk{flex:1 1 auto}
    form > button{flex:1 1 100%;padding:12px}

    /* table -> stacked cards */
    table, thead, tbody, tr, td{display:block;width:100%}
    thead{display:none}
    table{background:transparent;border:0;border-radius:0;overflow:visible;font-size:14px}
    tbody tr{
      background:var(--panel);
      border:1px solid var(--border);
      border-radius:12px;
      margin-bottom:10px;
      overflow:hidden;
    }
    tbody tr:hover td{background:transparent}

    tbody td{
      display:grid;
      grid-template-columns: 42% 1fr;
      gap:10px;
      align-items:start;
      padding:8px 12px;
      border-bottom:1px solid var(--border);
      text-align:right;
      overflow-wrap:anywhere;
    }
    tbody tr td:last-child{border-bottom:0}
    tbody td::before{
      content: attr(data-label);
      text-align:left;
      color:var(--muted);
      font-size:11px;
      font-weight:600;
      text-transform:uppercase;
      letter-spacing:.04em;
      padding-top:2px;
    }

    /* index cell becomes the card header */
    tbody td.idx{
      display:flex;
      align-items:center;
      gap:8px;
      background:#1c2128;
      color:var(--accent);
      font-weight:700;
      font-size:13px;
      padding:9px 12px;
      text-align:left;
      border-bottom:1px solid var(--border);
    }
    tbody td.idx::before{
      content:"CONFIG";
      font-size:11px;
      font-weight:600;
      letter-spacing:.06em;
      color:var(--muted);
    }

    .why{max-width:none}
    .mono{font-size:13px}
    .raw{justify-items:end}
    .raw button{padding:7px 14px;font-size:12px;min-height:32px}
    .hint{font-size:12.5px}
    .hint a{display:inline-block;padding:4px 0}
    pre.preview{font-size:11.5px;padding:10px}
    .stats{gap:6px}
    .pill{padding:4px 10px;font-size:12px}
  }

  @media (max-width: 380px){
    tbody td{grid-template-columns: 100%; text-align:left; gap:2px}
    tbody td::before{font-size:10.5px}
    tbody td.raw{justify-items:start}
  }
`;

const SCRIPT = `
async function copyRaw(btn){
  try{
    await navigator.clipboard.writeText(btn.dataset.raw);
    btn.textContent = 'copied';
  }catch(e){
    btn.textContent = 'failed';
  }
  setTimeout(()=>{ btn.textContent = 'copy'; }, 1200);
}
`;

function renderRows(list) {
  let html =
    '<div class="tablewrap"><table><thead><tr>' +
    '<th>#</th><th>Type</th><th>Server</th><th>Port</th><th>Method</th>' +
    '<th>Protocol / Obfs</th><th>UDP</th><th>Why</th><th>Remarks</th><th>Raw</th>' +
    '</tr></thead><tbody>';

  list.forEach((c, i) => {
    const middle =
      c.type === 'ssr'
        ? `${c.protocol || '—'} / ${c.obfs || '—'}`
        : c.plugin
        ? `plugin: ${c.plugin}`
        : '—';

    html +=
      '<tr>' +
      `<td class="idx" data-label="#">#${i + 1}</td>` +
      `<td data-label="Type"><span class="badge ${c.type}">${c.type}</span></td>` +
      `<td class="mono" data-label="Server">${esc(c.host)}</td>` +
      `<td class="mono" data-label="Port">${esc(c.port)}</td>` +
      `<td class="mono" data-label="Method">${esc(c.method)}</td>` +
      `<td class="mono" data-label="Protocol">${esc(middle)}</td>` +
      `<td data-label="UDP">${c.udp ? '<span class="yes">✔ UDP</span>' : '<span class="no">✖ TCP</span>'}</td>` +
      `<td class="why" data-label="Why">${esc(c.udpReason)}</td>` +
      `<td data-label="Remarks">${esc(c.remarks)}</td>` +
      `<td class="raw" data-label="Raw"><button type="button" data-raw="${esc(c.raw)}" onclick="copyRaw(this)">copy</button></td>` +
      '</tr>';
  });

  return html + '</tbody></table></div>';
}

function renderPage({ target, showAll, result, error }) {
  let body = '';

  if (error) {
    body += `<div class="alert err"><b>Error:</b> ${esc(error)}</div>`;
  }

  if (result) {
    const list = showAll ? result.configs : result.configs.filter((c) => c.udp);
    const s = result.stats;

    body += `<div class="stats">
      <span class="pill">Parsed: <b>${s.total}</b></span>
      <span class="pill ok">UDP: <b>${s.udp}</b></span>
      <span class="pill no">TCP only: <b>${s.tcpOnly}</b></span>
      <span class="pill">ss: <b>${s.ss}</b></span>
      <span class="pill">ssr: <b>${s.ssr}</b></span>
      ${s.parseErrors ? `<span class="pill warn">Parse errors: <b>${s.parseErrors}</b></span>` : ''}
    </div>`;

    if (s.total === 0 && result.preview && result.preview.length) {
      body += `<div class="alert err"><b>No configs could be parsed.</b>
        Below are the first lines the Worker actually received — check that the URL points at a
        plain-text subscription and not at an HTML page or a login wall.</div>`;
      body += `<pre class="preview">${esc(result.preview.join('\n'))}</pre>`;
    }

    const q = encodeURIComponent(target);
    body += `<p class="hint">${
      showAll ? 'Showing <b>all</b> parsed configs.' : 'Showing only configs that <b>use UDP</b>.'
    } &nbsp;·&nbsp; <a href="?url=${q}${showAll ? '' : '&all=1'}">${
      showAll ? 'Show UDP only' : 'Show all configs'
    }</a> &nbsp;·&nbsp; <a href="/api?url=${q}">JSON API</a></p>`;

    if (s.total > 0 && !list.length) {
      body += `<div class="alert">No UDP-capable configs found — every parsed config is TCP only.</div>`;
    } else if (list.length) {
      body += renderRows(list);
    }
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0d1117">
<title>SS / SSR UDP Scanner</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <h1>🛰️ Shadowsocks / SSR UDP Scanner</h1>
  <p class="sub">Paste a subscription <code>.txt</code> link — the worker fetches it, parses every <code>ss://</code> and <code>ssr://</code> config and lists the ones that use UDP.</p>

  <form method="GET" action="/">
    <input type="url" name="url" placeholder="https://example.com/sub.txt" value="${esc(target)}"
           inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" required>
    <label class="chk"><input type="checkbox" name="all" value="1" ${showAll ? 'checked' : ''}> show all configs</label>
    <button type="submit">Scan</button>
  </form>

  ${body}

  <footer>
    <b>How “uses UDP” is decided</b><br>
    • An explicit <code>udp</code> / <code>udp-relay</code> parameter in the link always wins.<br>
    • <code>ssr://</code> — ShadowsocksR has no UDP relay, it is TCP only.<br>
    • <code>ss://</code> with an <code>obfs-local</code> / <code>simple-obfs</code> plugin — TCP only.<br>
    • <code>ss://</code> with a <code>v2ray-plugin</code> / <code>xray-plugin</code> — tunnels UDP.<br>
    • Plain <code>ss://</code> — Shadowsocks supports UDP relay (the server has to enable it).<br>
    A Worker cannot send real UDP packets, so this is a capability classification, not a live probe.
  </footer>
</div>
<script>${SCRIPT}</script>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Worker entry point                                                  */
/* ------------------------------------------------------------------ */

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      'content-type': 'application/json;charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    /* ---------- JSON API ---------- */
    if (url.pathname === '/api') {
      const target = (url.searchParams.get('url') || '').trim();
      if (!target) return json({ ok: false, error: 'Missing ?url= parameter' }, 400);

      try {
        const { configs, stats, errors } = await scan(target);
        return json({
          ok: true,
          source: target,
          stats,
          udpConfigs: configs
            .filter((c) => c.udp)
            .map((c) => ({
              type: c.type,
              host: c.host,
              port: c.port,
              method: c.method,
              protocol: c.protocol || null,
              obfs: c.obfs || null,
              plugin: c.plugin || null,
              remarks: c.remarks,
              udpReason: c.udpReason,
              raw: c.raw,
            })),
          allConfigs: configs.map((c) => ({
            type: c.type,
            host: c.host,
            port: c.port,
            udp: c.udp,
            udpReason: c.udpReason,
          })),
          errors,
        });
      } catch (e) {
        return json({ ok: false, error: String((e && e.message) || e) }, 502);
      }
    }

    /* ---------- HTML page ---------- */
    const target = (url.searchParams.get('url') || '').trim();
    const showAll = url.searchParams.has('all');

    let result = null;
    let error = null;

    if (target) {
      try {
        result = await scan(target);
      } catch (e) {
        error = String((e && e.message) || e);
      }
    }

    return new Response(renderPage({ target, showAll, result, error }), {
      headers: {
        'content-type': 'text/html;charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  },
};
