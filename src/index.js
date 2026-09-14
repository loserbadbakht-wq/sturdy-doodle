<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UDP Config Scanner</title>
<style>
  :root{
    --bg:#0d1117; --panel:#161b22; --panel2:#1c232c; --line:#2a323d;
    --txt:#e6edf3; --dim:#8b949e; --acc:#58a6ff;
    --yes:#3fb950; --no:#f85149; --warn:#d29922;
  }
  *{box-sizing:border-box}
  body{
    margin:0; background:var(--bg); color:var(--txt);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    line-height:1.5;
  }
  .wrap{max-width:900px;margin:0 auto;padding:28px 16px 80px}
  h1{font-size:22px;margin:0 0 6px}
  .sub{color:var(--dim);font-size:14px;margin:0 0 20px}
  code{background:var(--panel2);padding:1px 5px;border-radius:4px;font-size:12px}
  .bar{display:flex;gap:8px}
  .bar input{
    flex:1;min-width:0;padding:11px 13px;border-radius:8px;
    border:1px solid var(--line);background:var(--panel);color:var(--txt);
    font-size:14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  }
  .bar input:focus{outline:none;border-color:var(--acc)}
  button{
    padding:11px 18px;border-radius:8px;border:1px solid transparent;
    background:var(--acc);color:#04121f;font-weight:600;font-size:14px;cursor:pointer;
  }
  button:hover{filter:brightness(1.1)}
  button:disabled{opacity:.5;cursor:default}
  .bar2{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px}
  .bar2 label{font-size:13px;color:var(--dim);display:flex;gap:6px;align-items:center;cursor:pointer}
  .ghost{background:transparent;border:1px solid var(--line);color:var(--txt);font-weight:500;padding:7px 12px;font-size:13px}
  .ghost:hover{border-color:var(--acc);color:var(--acc);filter:none}
  .status{margin-top:16px;font-size:13px;color:var(--dim);min-height:20px}
  .status.err{color:var(--no)}
  .stats{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 6px}
  .stat{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 14px;font-size:13px}
  .stat b{font-size:16px;display:block}
  .stat.g b{color:var(--yes)}
  .card{
    background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--no);
    border-radius:10px;padding:12px 14px;margin-top:10px;
  }
  .card.is-udp{border-left-color:var(--yes)}
  .row1{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
  .ttl{font-weight:600;font-size:14px;word-break:break-word}
  .badge{font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap;letter-spacing:.4px}
  .badge.yes{background:rgba(63,185,80,.15);color:var(--yes);border:1px solid rgba(63,185,80,.4)}
  .badge.no{background:rgba(248,81,73,.12);color:var(--no);border:1px solid rgba(248,81,73,.35)}
  .row2{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:var(--acc);margin-top:2px;word-break:break-all}
  .tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .tag{font-size:11px;background:var(--panel2);border:1px solid var(--line);color:var(--dim);padding:2px 7px;border-radius:5px}
  .why{font-size:12px;color:var(--warn);margin-top:8px}
  .raw{
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#6e7681;
    margin-top:8px;word-break:break-all;max-height:44px;overflow:hidden;
  }
  .copy{
    margin-top:10px;padding:5px 12px;font-size:12px;background:transparent;
    border:1px solid var(--line);color:var(--dim);font-weight:500;
  }
  .copy:hover{border-color:var(--acc);color:var(--acc);filter:none}
  .empty{color:var(--dim);font-size:14px;padding:24px 0;text-align:center}
  .note{margin-top:28px;font-size:12px;color:#6e7681;border-top:1px solid var(--line);padding-top:14px}
</style>
</head>
<body>
<div class="wrap">
  <h1>🔍 UDP Config Scanner</h1>
  <p class="sub">Paste a subscription <code>.txt</code> link — it gets fetched, every Shadowsocks / ShadowsocksR config is parsed, and the ones that relay <b>UDP</b> are listed first.</p>

  <div class="bar">
    <input id="url" type="url" placeholder="https://example.com/sub.txt" spellcheck="false" autocomplete="off">
    <button id="go">Scan</button>
  </div>

  <div class="bar2">
    <label><input type="checkbox" id="showAll"> show non-UDP as well</label>
    <button class="ghost" id="copyUdp">Copy UDP links</button>
    <button class="ghost" id="openTxt">Open UDP as plain text</button>
  </div>

  <div id="status" class="status"></div>
  <div id="stats" class="stats"></div>
  <div id="out"></div>

  <div class="note">
    <b>How “UDP” is decided</b> (heuristic — no live probing is possible from a Worker):<br>
    • <b>ss://</b> → UDP is relayed by default. If a plugin is present, only <code>v2ray-plugin</code>/<code>xray-plugin</code> with <code>mode=quic</code> is treated as UDP-capable.<br>
    • <b>ssr://</b> → <code>origin</code>, <code>auth_sha1_v4</code>, <code>auth_aes128_md5</code>, <code>auth_aes128_sha1</code> relay UDP; the <code>auth_chain_*</code> family does not.<br>
    • Everything else is skipped.
  </div>
</div>

<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var lastData = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function setStatus(msg, isErr) {
    var el = $('status');
    el.textContent = msg || '';
    el.className = 'status' + (isErr ? ' err' : '');
  }

  function card(it) {
    var title = it.remarks ? it.remarks : (it.host + ':' + it.port);
    var h = '';
    h += '<div class="card ' + (it.udp ? 'is-udp' : '') + '">';
    h += '<div class="row1"><span class="ttl">' + esc(title) + '</span>';
    h += it.udp ? '<span class="badge yes">UDP ✓</span>' : '<span class="badge no">no UDP</span>';
    h += '</div>';
    h += '<div class="row2">' + esc(it.host) + ':' + esc(it.port) + '</div>';
    h += '<div class="tags">';
    h += '<span class="tag">' + esc(String(it.type).toUpperCase()) + '</span>';
    if (it.protocol) h += '<span class="tag">proto: ' + esc(it.protocol) + '</span>';
    if (it.method) h += '<span class="tag">' + esc(it.method) + '</span>';
    if (it.obfs) h += '<span class="tag">obfs: ' + esc(it.obfs) + '</span>';
    if (it.plugin) h += '<span class="tag">plugin: ' + esc(it.plugin) + '</span>';
    h += '</div>';
    h += '<div class="why">' + esc(it.reason) + '</div>';
    h += '<div class="raw">' + esc(it.raw) + '</div>';
    h += '<button class="copy" data-copy="' + esc(it.raw) + '">Copy link</button>';
    h += '</div>';
    return h;
  }

  function render(data) {
    var items = data.items || [];
    var showAll = $('showAll').checked;
    var list = showAll ? items : items.filter(function (i) { return i.udp; });

    $('stats').innerHTML =
      '<div class="stat"><b>' + data.total + '</b>configs parsed</div>' +
      '<div class="stat g"><b>' + data.udpCount + '</b>support UDP</div>' +
      (data.skipped ? '<div class="stat"><b>' + data.skipped + '</b>lines skipped</div>' : '');

    if (!list.length) {
      $('out').innerHTML = '<div class="empty">' +
        (items.length ? 'No UDP-capable configs found.' : 'No Shadowsocks / ShadowsocksR configs found in that file.') +
        '</div>';
      return;
    }
    $('out').innerHTML = list.map(card).join('');
  }

  function scan() {
    var url = $('url').value.trim();
    if (!url) { setStatus('Please enter a subscription link.', true); return; }
    $('go').disabled = true;
    $('out').innerHTML = '';
    $('stats').innerHTML = '';
    setStatus('Fetching subscription…');

    fetch('/api/scan?url=' + encodeURIComponent(url))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { setStatus('Error: ' + data.error, true); return; }
        lastData = data;
        setStatus('Loaded ' + data.total + ' configs from ' + data.source);
        render(data);
      })
      .catch(function (e) { setStatus('Error: ' + e.message, true); })
      .finally(function () { $('go').disabled = false; });
  }

  $('go').addEventListener('click', scan);
  $('url').addEventListener('keydown', function (e) { if (e.key === 'Enter') scan(); });
  $('showAll').addEventListener('change', function () { if (lastData) render(lastData); });

  $('out').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var txt = btn.getAttribute('data-copy');
    navigator.clipboard.writeText(txt).then(function () {
      var old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = old; }, 1200);
    });
  });

  $('copyUdp').addEventListener('click', function () {
    if (!lastData) { setStatus('Scan something first.', true); return; }
    var links = lastData.items.filter(function (i) { return i.udp; }).map(function (i) { return i.raw; }).join('\n');
    if (!links) { setStatus('No UDP configs to copy.', true); return; }
    navigator.clipboard.writeText(links).then(function () {
      setStatus('Copied ' + links.split('\n').length + ' UDP links to clipboard.');
    });
  });

  $('openTxt').addEventListener('click', function () {
    var url = $('url').value.trim();
    if (!url) { setStatus('Enter a subscription link first.', true); return; }
    window.open('/api/scan?format=text&url=' + encodeURIComponent(url), '_blank');
  });
})();
</script>
</body>
</html>
