// <!--GAMFC-->version base on commit 43fad05dcdae3b723c53c226f8181fc5bd47223e, time is 2023-06-22 15:20:02 UTC<!--GAMFC-END-->
// @ts-ignore
import { connect } from "cloudflare:sockets";

/* ============================================================
 *  Unified Worker  =  VLESS-WS tunnel  +  V-Bridge reverse proxy
 *  Configs route through the reverse proxy path by default.
 *  Camouflage domains: speedtest.net family.
 * ============================================================ */

/* ------------------------- 0. 全局配置 ------------------------- */

let userID = "86c50e3a-5b87-49dd-bd20-03c7f2735e40";

const proxyIPs = [""];
const cn_hostnames = [''];

let CDNIP = "www.speedtest.net";

let IP1  = "www.speedtest.net";
let IP2  = "c.speedtest.net";
let IP3  = "speedtest.net";
let IP4  = "ookla.com";
let IP5  = "www.ookla.com";
let IP6  = "speedtestcustom.com";
let IP7  = "speedtest4business.com";

let IP8  = "speedtest.net";
let IP9  = "c.speedtest.net";
let IP10 = "ookla.com";
let IP11 = "www.speedtest.net";
let IP12 = "www.ookla.com";
let IP13 = "speedtestcustom.com";

let PT1 = '80',   PT2 = '8080', PT3 = '8880', PT4 = '2052',
    PT5 = '2082', PT6 = '2086', PT7 = '2095';

let PT8 = '443',  PT9 = '8443', PT10 = '2053',
    PT11 = '2083', PT12 = '2087', PT13 = '2096';

let proxyIP = proxyIPs[Math.floor(Math.random() * proxyIPs.length)] || "";
let proxyPort = '443';

const dohURL = "https://cloudflare-dns.com/dns-query";

if (!isValidUUID(userID)) throw new Error("uuid is not valid");

/* ============================================================
 *  1. 入口路由
 * ============================================================ */

export default {
  async fetch(request, env, ctx) {
    try {
      env = env || {};

      /* ---------- env overrides ---------- */
      userID = env.uuid || userID;
      if (env.proxyip) applyProxyString(env.proxyip);
      else if (proxyIP) applyProxyString(proxyIP);

      CDNIP = env.cdnip || CDNIP;
      IP1  = env.ip1  || IP1;   IP2  = env.ip2  || IP2;
      IP3  = env.ip3  || IP3;   IP4  = env.ip4  || IP4;
      IP5  = env.ip5  || IP5;   IP6  = env.ip6  || IP6;
      IP7  = env.ip7  || IP7;   IP8  = env.ip8  || IP8;
      IP9  = env.ip9  || IP9;   IP10 = env.ip10 || IP10;
      IP11 = env.ip11 || IP11;  IP12 = env.ip12 || IP12;
      IP13 = env.ip13 || IP13;
      PT1  = env.pt1  || PT1;   PT2  = env.pt2  || PT2;
      PT3  = env.pt3  || PT3;   PT4  = env.pt4  || PT4;
      PT5  = env.pt5  || PT5;   PT6  = env.pt6  || PT6;
      PT7  = env.pt7  || PT7;   PT8  = env.pt8  || PT8;
      PT9  = env.pt9  || PT9;   PT10 = env.pt10 || PT10;
      PT11 = env.pt11 || PT11;  PT12 = env.pt12 || PT12;
      PT13 = env.pt13 || PT13;

      const upgrade = (request.headers.get("Upgrade") || "").toLowerCase();
      const url = new URL(request.url);

      /* ========== LAYER 1 : VLESS over WebSocket ========== */
      if (upgrade === "websocket") {
        // V-Bridge path: /<host>:<port>/...  →  set fallback proxy
        const m = url.pathname.match(/^\/([^\/]+?)(?:\/(.*))?$/);
        if (m && m[1]) {
          const target = decodeURIComponent(m[1]);
          if (target.includes(':') || /^[a-z0-9.\-]+$/i.test(target)) {
            applyProxyString(target.includes(':') ? target : `${target}:443`);
          }
        }
        return await vlessOverWSHandler(request);
      }

      /* ========== LAYER 2 : config / subscription ========== */
      const host = request.headers.get("Host");
      switch (url.pathname) {
        case `/${userID}`:      return html(getvlessConfig(userID, host));
        case `/${userID}/ty`:   return txt(gettyConfig(userID, host));
        case `/${userID}/cl`:   return txt(getclConfig(userID, host));
        case `/${userID}/sb`:   return json(getsbConfig(userID, host));
        case `/${userID}/pty`:  return txt(getptyConfig(userID, host));
        case `/${userID}/pcl`:  return txt(getpclConfig(userID, host));
        case `/${userID}/psb`:  return json(getpsbConfig(userID, host));
      }

      /* ========== LAYER 3 : V-Bridge reverse proxy (camouflage) ========== */
      return await vBridgeFetch(request);

    } catch (err) {
      return new Response(err.toString());
    }
  },
};

const html = (b) => new Response(b, { headers: { "Content-Type": "text/html;charset=utf-8" } });
const txt  = (b) => new Response(b, { headers: { "Content-Type": "text/plain;charset=utf-8" } });
const json = (b) => new Response(b, { headers: { "Content-Type": "application/json;charset=utf-8" } });

/* ============================================================
 *  2. V-Bridge reverse proxy (default camouflage)
 * ============================================================ */

const D = `<html><head><title>404 Not Found</title></head><body><center><h1>404 Not Found</h1></center><hr><center>nginx</center></body></html>`;
const F = new Set(['/favicon.ico', '/robots.txt', '/.env', '/.git', '/.well-known']);
const H_IN  = ['cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'x-forwarded-for',
               'x-real-ip', 'forwarded', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'];
const H_OUT = ['cf-ray', 'alt-svc', 'cf-cache-status', 'x-powered-by', 'x-cloudflare-request-id'];
const P_HTTP = new Set(['80', '8080', '8880', '2052', '2082', '2086', '2095']);

async function vBridgeFetch(r) {
  try {
    const u = new URL(r.url);
    const p = u.pathname;

    /* ---- original cn_hostnames camouflage ---- */
    if (cn_hostnames.length > 1 || cn_hostnames[0] !== '') {
      const rand = cn_hostnames[Math.floor(Math.random() * cn_hostnames.length)];
      const h = new Headers(r.headers);
      h.set("cf-connecting-ip", "1.2.3.4");
      h.set("x-forwarded-for", "1.2.3.4");
      h.set("x-real-ip", "1.2.3.4");
      h.set("referer", "https://www.google.com/search?q=edtunnel");
      const pr = await fetch(`https://${rand}${p}${u.search}`, {
        method: r.method, headers: h, body: r.body, redirect: "manual"
      });
      if ([301, 302].includes(pr.status))
        return new Response(`Redirects to ${rand} are not allowed.`, { status: 403 });
      return pr;
    }

    /* ---- V-Bridge behaviour ---- */
    if (p === '/' || F.has(p)) {
      return new Response(p === '/' ? D : null, {
        status: p === '/' ? 404 : 204,
        headers: { 'content-type': 'text/html; charset=UTF-8', 'server': 'nginx', 'connection': 'close' }
      });
    }

    const s = p.split('/').filter(Boolean);
    if (s.length < 2) return new Response(D, { status: 404, headers: { 'server': 'nginx' } });

    let i = 0;
    let t = 'https';
    if (s[0] === 'http' || s[0] === 'https') { t = s[0]; i = 1; }

    const h_p = s[i];
    const t_p = '/' + s.slice(i + 1).join('/');
    const [h, o] = h_p.split(':');

    if (s[0] !== 'https') {
      const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(h);
      if (isIP || (o && P_HTTP.has(o))) t = 'http';
    }

    const dest = `${t}://${h_p}${t_p}${u.search}`;

    const n = new Headers(r.headers);
    n.set('Host', h);
    n.set('Connection', 'keep-alive');
    for (const x of H_IN) n.delete(x);

    const cfg = { method: r.method, headers: n, redirect: 'manual' };
    if (r.signal) cfg['signal'] = r.signal;
    cfg['cf'] = { cacheTtl: 0, cacheEverything: false, mirage: false, polish: 'off' };
    if (r.method !== 'GET' && r.method !== 'HEAD') cfg.body = r.body;

    let res;
    try {
      res = await fetch(dest, cfg);
      if (t === 'https' && (res.status === 525 || res.status === 521 || res.status === 526)) throw new Error();
    } catch (e) {
      res = await fetch(dest.replace('https://', 'http://'), cfg);
    }

    if (res.status === 101 || (r.headers.get('Upgrade') || '').toLowerCase() === 'websocket') return res;

    const out = new Headers(res.headers);
    for (const x of H_OUT) out.delete(x);
    out.set('Server', 'nginx');
    out.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    out.set('X-Content-Type-Options', 'nosniff');

    return new Response(res.body, { status: res.status, headers: out });
  } catch (e) {
    return new Response(null, { status: 499 });
  }
}

/* ============================================================
 *  3. VLESS core
 * ============================================================ */

function applyProxyString(str) {
  let sVal = String(str).trim();
  if (!sVal) return;
  if (sVal.startsWith('[')) {
    const end = sVal.indexOf(']');
    if (end !== -1) {
      proxyIP = sVal.slice(1, end);
      const rest = sVal.slice(end + 1).replace(/^:/, '');
      proxyPort = rest || '443';
      return;
    }
  }
  const idx = sVal.lastIndexOf(':');
  if (idx !== -1 && /^\d+$/.test(sVal.slice(idx + 1))) {
    proxyIP = sVal.slice(0, idx);
    proxyPort = sVal.slice(idx + 1);
  } else {
    proxyIP = sVal;
    proxyPort = '443';
  }
}

function isValidIP(ip) { return /^[\s\S]*$/.test(ip); }

async function vlessOverWSHandler(request) {
  // @ts-ignore
  const webSocketPair = new WebSocketPair();
  const [client, webSocket] = Object.values(webSocketPair);
  webSocket.accept();

  let address = "";
  let portWithRandomLog = "";
  const log = (info, event) => console.log(`[${address}:${portWithRandomLog}] ${info}`, event || "");
  const earlyDataHeader = request.headers.get("sec-websocket-protocol") || "";
  const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);

  const remoteSocketWapper = { value: null };
  let udpStreamWrite = null;
  let isDns = false;

  readableWebSocketStream.pipeTo(new WritableStream({
    async write(chunk, controller) {
      if (isDns && udpStreamWrite) return udpStreamWrite(chunk);
      if (remoteSocketWapper.value) {
        const writer = remoteSocketWapper.value.writable.getWriter();
        await writer.write(chunk);
        writer.releaseLock();
        return;
      }

      const {
        hasError, message, portRemote = 443, addressRemote = "",
        rawDataIndex, vlessVersion = new Uint8Array([0, 0]), isUDP,
      } = await processVlessHeader(chunk, userID);

      address = addressRemote;
      portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? "udp " : "tcp "}`;
      if (hasError) throw new Error(message);

      if (isUDP) {
        if (portRemote === 53) isDns = true;
        else throw new Error("UDP proxy only enable for DNS which is port 53");
      }

      const vlessResponseHeader = new Uint8Array([vlessVersion[0], 0]);
      const rawClientData = chunk.slice(rawDataIndex);

      if (isDns) {
        const { write } = await handleUDPOutBound(webSocket, vlessResponseHeader, log);
        udpStreamWrite = write;
        udpStreamWrite(rawClientData);
        return;
      }

      handleTCPOutBound(remoteSocketWapper, addressRemote, portRemote, rawClientData,
                        webSocket, vlessResponseHeader, log);
    },
    close() { log(`readableWebSocketStream is close`); },
    abort(reason) { log(`readableWebSocketStream is abort`, JSON.stringify(reason)); },
  })).catch((err) => log("readableWebSocketStream pipeTo error", err));

  return new Response(null, { status: 101, webSocket: client });
}

async function checkUuidInApiResponse(targetUuid) {
  try {
    const apiResponse = await getApiResponse();
    if (!apiResponse) return false;
    return apiResponse.users.some((u) => u.uuid === targetUuid);
  } catch (e) { return false; }
}
async function getApiResponse() { return { users: [] }; }

async function handleTCPOutBound(remoteSocket, addressRemote, portRemote, rawClientData,
                                 webSocket, vlessResponseHeader, log) {
  async function connectAndWrite(address, port) {
    if (/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(address)) {
      address = `${atob('d3d3Lg==')}${address}${atob('LnNzbGlwLmlv')}`;
    }
    // @ts-ignore
    const tcpSocket = connect({ hostname: address, port: port });
    remoteSocket.value = tcpSocket;
    log(`connected to ${address}:${port}`);
    const writer = tcpSocket.writable.getWriter();
    await writer.write(rawClientData);
    writer.releaseLock();
    return tcpSocket;
  }

  async function retry() {
    const tcpSocket = await connectAndWrite(proxyIP || addressRemote, proxyPort || portRemote);
    tcpSocket.closed.catch((e) => console.log("retry tcpSocket closed error", e))
      .finally(() => safeCloseWebSocket(webSocket));
    remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, null, log);
  }

  const tcpSocket = await connectAndWrite(addressRemote, portRemote);
  remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, retry, log);
}

function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
  let readableStreamCancel = false;
  return new ReadableStream({
    start(controller) {
      webSocketServer.addEventListener("message", (event) => {
        if (readableStreamCancel) return;
        controller.enqueue(event.data);
      });
      webSocketServer.addEventListener("close", () => {
        safeCloseWebSocket(webSocketServer);
        if (readableStreamCancel) return;
        controller.close();
      });
      webSocketServer.addEventListener("error", (err) => {
        log("webSocketServer has error");
        controller.error(err);
      });
      const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
      if (error) controller.error(error);
      else if (earlyData) controller.enqueue(earlyData);
    },
    pull() {},
    cancel(reason) {
      if (readableStreamCancel) return;
      log(`ReadableStream was canceled, due to ${reason}`);
      readableStreamCancel = true;
      safeCloseWebSocket(webSocketServer);
    },
  });
}

async function processVlessHeader(vlessBuffer, userID) {
  if (vlessBuffer.byteLength < 24) return { hasError: true, message: "invalid data" };
  const version = new Uint8Array(vlessBuffer.slice(0, 1));
  let isValidUser = false;
  let isUDP = false;

  const slicedBuffer = new Uint8Array(vlessBuffer.slice(1, 17));
  const slicedBufferString = stringify(slicedBuffer);
  const uuids = userID.includes(",") ? userID.split(",") : [userID];
  const checkUuidInApi = await checkUuidInApiResponse(slicedBufferString);
  isValidUser = uuids.some((u) => checkUuidInApi || slicedBufferString === u.trim());
  if (!isValidUser) return { hasError: true, message: "invalid user" };

  const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
  const command = new Uint8Array(vlessBuffer.slice(18 + optLength, 18 + optLength + 1))[0];
  if (command === 1) { /* tcp */ }
  else if (command === 2) isUDP = true;
  else return { hasError: true, message: `command ${command} is not support` };

  const portIndex = 18 + optLength + 1;
  const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
  const portRemote = new DataView(portBuffer).getUint16(0);

  let addressIndex = portIndex + 2;
  const addressBuffer = new Uint8Array(vlessBuffer.slice(addressIndex, addressIndex + 1));
  const addressType = addressBuffer[0];
  let addressLength = 0;
  let addressValueIndex = addressIndex + 1;
  let addressValue = "";

  switch (addressType) {
    case 1:
      addressLength = 4;
      addressValue = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join(".");
      break;
    case 2:
      addressLength = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
      addressValueIndex += 1;
      addressValue = new TextDecoder().decode(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
      break;
    case 3:
      addressLength = 16;
      const dv = new DataView(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
      const ipv6 = [];
      for (let i = 0; i < 8; i++) ipv6.push(dv.getUint16(i * 2).toString(16));
      addressValue = ipv6.join(":");
      break;
    default:
      return { hasError: true, message: `invalid addressType is ${addressType}` };
  }
  if (!addressValue) return { hasError: true, message: `addressValue is empty` };

  return {
    hasError: false, addressRemote: addressValue, addressType, portRemote,
    rawDataIndex: addressValueIndex + addressLength, vlessVersion: version, isUDP,
  };
}

async function remoteSocketToWS(remoteSocket, webSocket, vlessResponseHeader, retry, log) {
  let vlessHeader = vlessResponseHeader;
  let hasIncomingData = false;
  await remoteSocket.readable.pipeTo(new WritableStream({
    start() {},
    async write(chunk, controller) {
      hasIncomingData = true;
      if (webSocket.readyState !== WS_READY_STATE_OPEN) controller.error("webSocket.readyState is not open");
      if (vlessHeader) {
        webSocket.send(await new Blob([vlessHeader, chunk]).arrayBuffer());
        vlessHeader = null;
      } else webSocket.send(chunk);
    },
    close() { log(`remoteConnection readable close, hasIncomingData=${hasIncomingData}`); },
    abort(reason) { console.error("remoteConnection readable abort", reason); },
  })).catch((error) => {
    console.error("remoteSocketToWS exception", error.stack || error);
    safeCloseWebSocket(webSocket);
  });
  if (hasIncomingData === false && retry) { log("retry"); retry(); }
}

function base64ToArrayBuffer(base64Str) {
  if (!base64Str) return { error: null };
  try {
    base64Str = base64Str.replace(/-/g, "+").replace(/_/g, "/");
    const decode = atob(base64Str);
    return { earlyData: Uint8Array.from(decode, (c) => c.charCodeAt(0)).buffer, error: null };
  } catch (error) { return { error }; }
}

function isValidUUID(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;
function safeCloseWebSocket(socket) {
  try {
    if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING) socket.close();
  } catch (e) { console.error("safeCloseWebSocket error", e); }
}

const byteToHex = [];
for (let i = 0; i < 256; ++i) byteToHex.push((i + 256).toString(16).slice(1));

function unsafeStringify(arr, offset = 0) {
  return (
    byteToHex[arr[offset]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" +
    byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" +
    byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" +
    byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" +
    byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] +
    byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] +
    byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]
  ).toLowerCase();
}
function stringify(arr, offset = 0) {
  const uuid = unsafeStringify(arr, offset);
  if (!isValidUUID(uuid)) throw TypeError("Stringified UUID is invalid");
  return uuid;
}

async function handleUDPOutBound(webSocket, vlessResponseHeader, log) {
  let isVlessHeaderSent = false;
  const transformStream = new TransformStream({
    start() {},
    transform(chunk, controller) {
      for (let index = 0; index < chunk.byteLength; ) {
        const lengthBuffer = chunk.slice(index, index + 2);
        const udpPakcetLength = new DataView(lengthBuffer).getUint16(0);
        const udpData = new Uint8Array(chunk.slice(index + 2, index + 2 + udpPakcetLength));
        index = index + 2 + udpPakcetLength;
        controller.enqueue(udpData);
      }
    },
    flush() {},
  });

  transformStream.readable.pipeTo(new WritableStream({
    async write(chunk) {
      const resp = await fetch(dohURL, {
        method: "POST", headers: { "content-type": "application/dns-message" }, body: chunk,
      });
      const dnsQueryResult = await resp.arrayBuffer();
      const udpSize = dnsQueryResult.byteLength;
      const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);
      if (webSocket.readyState === WS_READY_STATE_OPEN) {
        log(`doh success, dns length=${udpSize}`);
        if (isVlessHeaderSent) webSocket.send(await new Blob([udpSizeBuffer, dnsQueryResult]).arrayBuffer());
        else {
          webSocket.send(await new Blob([vlessResponseHeader, udpSizeBuffer, dnsQueryResult]).arrayBuffer());
          isVlessHeaderSent = true;
        }
      }
    },
  })).catch((error) => log("dns udp has error" + error));

  const writer = transformStream.writable.getWriter();
  return { write(chunk) { writer.write(chunk); } };
}

/* ============================================================
 *  4. Config builders
 *     Path = /{realIP}:{realPort}/?ed=2560   (V-Bridge style)
 * ============================================================ */

function buildNodes() {
  return [
    { i: 1,  ip: IP1,  pt: PT1,  tls: false },
    { i: 2,  ip: IP2,  pt: PT2,  tls: false },
    { i: 3,  ip: IP3,  pt: PT3,  tls: false },
    { i: 4,  ip: IP4,  pt: PT4,  tls: false },
    { i: 5,  ip: IP5,  pt: PT5,  tls: false },
    { i: 6,  ip: IP6,  pt: PT6,  tls: false },
    { i: 7,  ip: IP7,  pt: PT7,  tls: false },
    { i: 8,  ip: IP8,  pt: PT8,  tls: true  },
    { i: 9,  ip: IP9,  pt: PT9,  tls: true  },
    { i: 10, ip: IP10, pt: PT10, tls: true  },
    { i: 11, ip: IP11, pt: PT11, tls: true  },
    { i: 12, ip: IP12, pt: PT12, tls: true  },
    { i: 13, ip: IP13, pt: PT13, tls: true  },
  ];
}

const nodeTag = (n) => `CF_V${n.i}_${n.ip}_${n.pt}`;

/** V-Bridge path segment: "<ip>:<port>" (brackets stripped) */
const bridgeTarget = (n) => `${n.ip.replace(/[\[\]]/g, '')}:${n.pt}`;

/**
 * vless:// link →  Worker:443, path = /<realIP>:<realPort>/?ed=2560
 */
function nodeLink(userID, hostName, n) {
  const target = bridgeTarget(n);
  const path = encodeURIComponent(`/${target}/`) + '%3Fed%3D2560';
  const q = `encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=${path}`;
  return `vless://${userID}@${hostName}:443?${q}#${nodeTag(n)}`;
}

/* -------------------- HTML page -------------------- */

function getvlessConfig(userID, hostName) {
  const nodes = buildNodes();
  const wvlessws    = nodeLink(userID, hostName, { i: 0, ip: CDNIP, pt: '8880', tls: false });
  const pvlesswstls = nodeLink(userID, hostName, { i: 0, ip: CDNIP, pt: '8443', tls: true  });

  const note =
    `甬哥博客地址：https://ygkkk.blogspot.com\n` +
    `甬哥YouTube频道：https://www.youtube.com/@ygkkk\n` +
    `甬哥TG电报群组：https://t.me/ygkkktg\n` +
    `甬哥TG电报频道：https://t.me/ygkkktgpd\n\n` +
    `V-Bridge 反向代理已启用：所有节点通过 /{IP}:{PORT}/ 路径转发`;

  const ty  = `https://${hostName}/${userID}/ty`;
  const cl  = `https://${hostName}/${userID}/cl`;
  const sb  = `https://${hostName}/${userID}/sb`;
  const pty = `https://${hostName}/${userID}/pty`;
  const pcl = `https://${hostName}/${userID}/pcl`;
  const psb = `https://${hostName}/${userID}/psb`;

  const allShare = nodes.map((n) => nodeLink(userID, hostName, n)).join("\n");
  const wkvlessshare = btoa(allShare);
  const tlsShare = nodes.filter((n) => n.tls).map((n) => nodeLink(userID, hostName, n)).join("\n");
  const pgvlessshare = btoa(tlsShare);

  const noteshow = note.replace(/\n/g, "<br>");
  const displayHtml = `
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<style>.limited-width{max-width:200px;overflow:auto;word-wrap:break-word}</style>
</head>
<script>
function copyToClipboard(t){const i=document.createElement('textarea');i.style.position='fixed';i.style.opacity=0;i.value=t;document.body.appendChild(i);i.select();document.execCommand('Copy');document.body.removeChild(i);alert('已复制到剪贴板');}
</script>`;

  if (hostName.includes("workers.dev")) {
    return `
<br><br>${displayHtml}
<body>
<div class="container"><div class="row"><div class="col-md-12">
<h1>Cloudflare-workers/pages-vless代理脚本 V25.5.4</h1><hr>
<p>${noteshow}</p><hr><hr><hr><br><br>
<h3>1：CF-workers-vless+ws 节点 (经V-Bridge转发)</h3>
<table class="table"><thead><tr><th>节点特色：</th><th>单节点链接如下：</th></tr></thead><tbody><tr>
<td class="limited-width">非TLS·经Worker反向代理</td>
<td class="limited-width">${wvlessws}</td>
<td><button class="btn btn-primary" onclick="copyToClipboard('${wvlessws}')">复制</button></td>
</tr></tbody></table>
<h5>客户端参数：</h5>
<ul>
<li>地址(address)：${hostName}</li>
<li>端口(port)：443</li>
<li>用户ID(uuid)：${userID}</li>
<li>传输协议：ws</li>
<li>伪装域名(host)：${hostName}</li>
<li>路径(path)：见上方链接</li>
<li>传输安全(TLS)：开启</li>
</ul>
<hr><hr><hr><br><br>
<h3>2：CF-workers-vless+ws+tls 节点</h3>
<table class="table"><thead><tr><th>节点特色：</th><th>单节点链接如下：</th></tr></thead><tbody><tr>
<td class="limited-width">启用TLS·经Worker反向代理</td>
<td class="limited-width">${pvlesswstls}</td>
<td><button class="btn btn-primary" onclick="copyToClipboard('${pvlesswstls}')">复制</button></td>
</tr></tbody></table>
<hr><hr><hr><br><br>
<h3>3：订阅链接</h3>
<table class="table"><thead><tr><th>聚合通用分享：</th></tr></thead><tbody><tr>
<td><button class="btn btn-primary" onclick="copyToClipboard('${wkvlessshare}')">复制</button></td>
</tr></tbody></table>
<table class="table"><thead><tr><th>聚合通用订阅：</th></tr></thead><tbody><tr>
<td class="limited-width">${ty}</td>
<td><button class="btn btn-primary" onclick="copyToClipboard('${ty}')">复制</button></td>
</tr></tbody></table>
<table class="table"><thead><tr><th>Clash-meta：</th></tr></thead><tbody><tr>
<td class="limited-width">${cl}</td>
<td><button class="btn btn-primary" onclick="copyToClipboard('${cl}')">复制</button></td>
</tr></tbody></table>
<table class="table"><thead><tr><th>Sing-box：</th></tr></thead><tbody><tr>
<td class="limited-width">${sb}</td>
<td><button class="btn btn-primary" onclick="copyToClipboard('${sb}')">复制</button></td>
</tr></tbody></table>
<br><br>
</div></div></div></body>`;
  }

  return `
<br><br>${displayHtml}
<body>
<div class="container"><div class="row"><div class="col-md-12">
<h1>Cloudflare-workers/pages-vless代理脚本 V25.5.4</h1><hr>
<p>${noteshow}</p><hr><hr><hr><br><br>
<h3>1：CF-pages/workers/自定义域-vless+ws+tls 节点</h3>
<table class="table"><thead><tr><th>节点特色：</th><th>单节点链接如下：</th></tr></thead><tbody><tr>
<td class="limited-width">TLS·经Worker反向代理</td>
<td class="limited-width">${pvlesswstls}</td>
<td><button class="btn btn-primary" onclick="copyToClipboard('${pvlesswstls}')">复制</button></td>
</tr></tbody></table>
<hr><hr><hr><br><br>
<h3>2：订阅链接 (仅TLS节点)</h3>
<table class="table"><thead><tr><th>聚合通用分享：</th></tr></thead><tbody><tr>
<td><button class="btn btn-primary" onclick="copyToClipboard('${pgvlessshare}')">复制</button></td>
</tr></tbody></table>
<table class="table"><thead><tr><th>聚合通用订阅：</th></tr></thead><tbody><tr>
<td class="limited-width">${pty}</td>
<td><button class="btn btn-primary" onclick="copyToClipboard('${pty}')">复制</button></td>
</tr></tbody></table>
<table class="table"><thead><tr><th>Clash-meta：</th></tr></thead><tbody><tr>
<td class="limited-width">${pcl}</td>
<td><button class="btn btn-primary" onclick="copyToClipboard('${pcl}')">复制</button></td>
</tr></tbody></table>
<table class="table"><thead><tr><th>Sing-box：</th></tr></thead><tbody><tr>
<td class="limited-width">${psb}</td>
<td><button class="btn btn-primary" onclick="copyToClipboard('${psb}')">复制</button></td>
</tr></tbody></table>
<br><br>
</div></div></div></body>`;
}

/* -------------------- Base64 subscription -------------------- */

function gettyConfig(userID, hostName) {
  return btoa(buildNodes().map((n) => nodeLink(userID, hostName, n)).join("\n"));
}
function getptyConfig(userID, hostName) {
  return btoa(buildNodes().filter((n) => n.tls).map((n) => nodeLink(userID, hostName, n)).join("\n"));
}

/* -------------------- Clash-meta -------------------- */

function clashProxiesBlock(userID, hostName, nodes) {
  return nodes.map((n) => {
    const target = bridgeTarget(n);
    const tlsLine = n.tls ? `  tls: true\n  servername: ${hostName}\n` : `  tls: false\n`;
    return `- name: ${nodeTag(n)}
  type: vless
  server: ${hostName}
  port: 443
  uuid: ${userID}
  udp: false
${tlsLine}  network: ws
  ws-opts:
    path: "/${target}/?ed=2560"
    headers:
      Host: ${hostName}`;
  }).join("\n\n");
}

function clashGroupsBlock(nodes) {
  const list = nodes.map((n) => `    - ${nodeTag(n)}`).join("\n");
  return `proxy-groups:
- name: 负载均衡
  type: load-balance
  url: http://www.gstatic.com/generate_204
  interval: 300
  proxies:
${list}

- name: 自动选择
  type: url-test
  url: http://www.gstatic.com/generate_204
  interval: 300
  tolerance: 50
  proxies:
${list}

- name: 🌍选择代理
  type: select
  proxies:
    - 负载均衡
    - 自动选择
    - DIRECT
${list}`;
}

function getclConfig(userID, hostName) {
  const nodes = buildNodes();
  return `port: 7890
allow-lan: true
mode: rule
log-level: info
unified-delay: true
global-client-fingerprint: chrome
dns:
  enable: false
  listen: :53
  ipv6: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  default-nameserver:
    - 223.5.5.5
    - 114.114.114.114
    - 8.8.8.8
  nameserver:
    - https://dns.alidns.com/dns-query
    - https://doh.pub/dns-query
  fallback:
    - https://1.0.0.1/dns-query
    - tls://dns.google
  fallback-filter:
    geoip: true
    geoip-code: CN
    ipcidr:
      - 240.0.0.0/4

proxies:
${clashProxiesBlock(userID, hostName, nodes)}

${clashGroupsBlock(nodes)}

rules:
  - GEOIP,LAN,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,🌍选择代理
`;
}

function getpclConfig(userID, hostName) {
  const nodes = buildNodes().filter((n) => n.tls);
  return `port: 7890
allow-lan: true
mode: rule
log-level: info
unified-delay: true
global-client-fingerprint: chrome
dns:
  enable: false
  listen: :53
  ipv6: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  default-nameserver:
    - 223.5.5.5
    - 114.114.114.114
    - 8.8.8.8
  nameserver:
    - https://dns.alidns.com/dns-query
    - https://doh.pub/dns-query
  fallback:
    - https://1.0.0.1/dns-query
    - tls://dns.google
  fallback-filter:
    geoip: true
    geoip-code: CN
    ipcidr:
      - 240.0.0.0/4

proxies:
${clashProxiesBlock(userID, hostName, nodes)}

${clashGroupsBlock(nodes)}

rules:
  - GEOIP,LAN,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,🌍选择代理
`;
}

/* -------------------- Sing-box -------------------- */

function sbOutbound(userID, hostName, n) {
  const target = bridgeTarget(n);
  return {
    server: hostName,
    server_port: 443,
    tag: nodeTag(n),
    tls: {
      enabled: true,
      server_name: hostName,
      insecure: false,
      utls: { enabled: true, fingerprint: "chrome" }
    },
    packet_encoding: "packetaddr",
    transport: {
      headers: { Host: [hostName] },
      path: `/${target}/?ed=2560`,
      type: "ws"
    },
    type: "vless",
    uuid: userID
  };
}

function sbConfigObject(userID, hostName, nodes) {
  const tags = nodes.map((n) => nodeTag(n));
  const outbounds = [
    { tag: "select", type: "selector", default: "auto", outbounds: ["auto", ...tags] },
    ...nodes.map((n) => sbOutbound(userID, hostName, n)),
    { tag: "direct", type: "direct" },
    {
      tag: "auto", type: "urltest", outbounds: tags,
      url: "https://www.gstatic.com/generate_204",
      interval: "1m", tolerance: 50, interrupt_exist_connections: false
    }
  ];

  return {
    log: { disabled: false, level: "info", timestamp: true },
    experimental: {
      clash_api: {
        external_controller: "127.0.0.1:9090", external_ui: "ui",
        external_ui_download_url: "", external_ui_download_detour: "",
        secret: "", default_mode: "Rule"
      },
      cache_file: { enabled: true, path: "cache.db", store_fakeip: true }
    },
    dns: {
      servers: [
        { tag: "proxydns", address: "tls://8.8.8.8/dns-query", detour: "select" },
        { tag: "localdns", address: "h3://223.5.5.5/dns-query", detour: "direct" },
        { tag: "dns_fakeip", address: "fakeip" }
      ],
      rules: [
        { outbound: "any", server: "localdns", disable_cache: true },
        { clash_mode: "Global", server: "proxydns" },
        { clash_mode: "Direct", server: "localdns" },
        { rule_set: "geosite-cn", server: "localdns" },
        { rule_set: "geosite-geolocation-!cn", server: "proxydns" },
        { rule_set: "geosite-geolocation-!cn", query_type: ["A", "AAAA"], server: "dns_fakeip" }
      ],
      fakeip: { enabled: true, inet4_range: "198.18.0.0/15", inet6_range: "fc00::/18" },
      independent_cache: true,
      final: "proxydns"
    },
    inbounds: [{
      type: "tun", tag: "tun-in",
      address: ["172.19.0.1/30", "fd00::1/126"],
      auto_route: true, strict_route: true,
      sniff: true, sniff_override_destination: true, domain_strategy: "prefer_ipv4"
    }],
    outbounds,
    route: {
      rule_set: [
        {
          tag: "geosite-geolocation-!cn", type: "remote", format: "binary",
          url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/geolocation-!cn.srs",
          download_detour: "select", update_interval: "1d"
        },
        {
          tag: "geosite-cn", type: "remote", format: "binary",
          url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/geolocation-cn.srs",
          download_detour: "select", update_interval: "1d"
        },
        {
          tag: "geoip-cn", type: "remote", format: "binary",
          url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geoip/cn.srs",
          download_detour: "select", update_interval: "1d"
        }
      ],
      auto_detect_interface: true,
      final: "select",
      rules: [
        { inbound: "tun-in", action: "sniff" },
        { protocol: "dns", action: "hijack-dns" },
        { port: 443, network: "udp", action: "reject" },
        { clash_mode: "Direct", outbound: "direct" },
        { clash_mode: "Global", outbound: "select" },
        { rule_set: "geoip-cn", outbound: "direct" },
        { rule_set: "geosite-cn", outbound: "direct" },
        { ip_is_private: true, outbound: "direct" },
        { rule_set: "geosite-geolocation-!cn", outbound: "select" }
      ]
    },
    ntp: { enabled: true, server: "time.apple.com", server_port: 123, interval: "30m", detour: "direct" }
  };
}

function getsbConfig(userID, hostName) {
  return JSON.stringify(sbConfigObject(userID, hostName, buildNodes()), null, 2);
}
function getpsbConfig(userID, hostName) {
  return JSON.stringify(sbConfigObject(userID, hostName, buildNodes().filter((n) => n.tls)), null, 2);
}
