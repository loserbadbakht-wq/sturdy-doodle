// <!--GAMFC-->version base on commit 43fad05dcdae3b723c53c226f8181fc5bd47223e, time is 2023-06-22 15:20:02 UTC<!--GAMFC-END-->
// @ts-ignore
import { connect } from "cloudflare:sockets";

/* ============================================================
 *  PART A —— VLESS over WebSocket (edtunnel / 甬哥 风格)
 *  PART B —— V-Bridge-Worker v2.0 (路径反向代理 + 伪装)
 * ============================================================ */

/* ------------------------- 0. 全局配置 ------------------------- */

// 生成 UUID:  Powershell -NoExit -Command "[guid]::NewGuid()"
let userID = "86c50e3a-5b87-49dd-bd20-03c7f2735e40";

const proxyIPs = [""];
const cn_hostnames = [''];

let CDNIP = '\u0077\u0077\u0077\u002e\u0076\u0069\u0073\u0061\u002e\u0063\u006f\u006d\u002e\u0073\u0067';

// http_ip
let IP1  = '\u0077\u0077\u0077\u002e\u0076\u0069\u0073\u0061\u002e\u0063\u006f\u006d';
let IP2  = '\u0063\u0069\u0073\u002e\u0076\u0069\u0073\u0061\u002e\u0063\u006f\u006d';
let IP3  = '\u0061\u0066\u0072\u0069\u0063\u0061\u002e\u0076\u0069\u0073\u0061\u002e\u0063\u006f\u006d';
let IP4  = '\u0077\u0077\u0077\u002e\u0076\u0069\u0073\u0061\u002e\u0063\u006f\u006d\u002e\u0073\u0067';
let IP5  = '\u0077\u0077\u0077\u002e\u0076\u0069\u0073\u0061\u0065\u0075\u0072\u006f\u0070\u0065\u002e\u0061\u0074';
let IP6  = '\u0077\u0077\u0077\u002e\u0076\u0069\u0073\u0061\u002e\u0063\u006f\u006d\u002e\u006d\u0074';
let IP7  = '\u0071\u0061\u002e\u0076\u0069\u0073\u0061\u006d\u0069\u0064\u0064\u006c\u0065\u0065\u0061\u0073\u0074\u002e\u0063\u006f\u006d';

// https_ip
let IP8  = '\u0075\u0073\u0061\u002e\u0076\u0069\u0073\u0061\u002e\u0063\u006f\u006d';
let IP9  = '\u006d\u0079\u0061\u006e\u006d\u0061\u0072\u002e\u0076\u0069\u0073\u0061\u002e\u0063\u006f\u006d';
let IP10 = '\u0077\u0077\u0077\u002e\u0076\u0069\u0073\u0061\u002e\u0063\u006f\u006d\u002e\u0074\u0077';
let IP11 = '\u0077\u0077\u0077\u002e\u0076\u0069\u0073\u0061\u0065\u0075\u0072\u006f\u0070\u0065\u002e\u0063\u0068';
let IP12 = '\u0077\u0077\u0077\u002e\u0076\u0069\u0073\u0061\u002e\u0063\u006f\u006d\u002e\u0062\u0072';
let IP13 = '\u0077\u0077\u0077\u002e\u0076\u0069\u0073\u0061\u0073\u006f\u0075\u0074\u0068\u0065\u0061\u0073\u0074\u0065\u0075\u0072\u006f\u0070\u0065\u002e\u0063\u006f\u006d';

// http_port
let PT1 = '80', PT2 = '8080', PT3 = '8880', PT4 = '2052',
    PT5 = '2082', PT6 = '2086', PT7 = '2095';

// https_port
let PT8 = '443', PT9 = '8443', PT10 = '2053',
    PT11 = '2083', PT12 = '2087', PT13 = '2096';

let proxyIP = proxyIPs[Math.floor(Math.random() * proxyIPs.length)] || "";
let proxyPort = '443';

const dohURL = "https://cloudflare-dns.com/dns-query";

if (!isValidUUID(userID)) {
  throw new Error("uuid is not valid");
}

/* ------------------------- 1. 入口 ------------------------- */

export default {
  /**
   * @param {Request} request
   * @param {any} env
   * @param {any} ctx
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    try {
      env = env || {};

      /* ---------- 1.1 环境变量覆盖 ---------- */
      userID = env.uuid || userID;

      if (env.proxyip) {
        applyProxyString(env.proxyip);
      } else if (proxyIP) {
        applyProxyString(proxyIP);
      } else {
        proxyIP = "";
        proxyPort = "443";
      }
      console.log("ProxyIP:", proxyIP, "ProxyPort:", proxyPort);

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

      const upgradeHeader = request.headers.get("Upgrade");
      const url = new URL(request.url);

      /* ---------- 1.2 非 WebSocket 请求 ---------- */
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        switch (url.pathname) {

          case `/${userID}`: {
            const cfg = getvlessConfig(userID, request.headers.get("Host"));
            return new Response(cfg, {
              status: 200,
              headers: { "Content-Type": "text/html;charset=utf-8" }
            });
          }

          case `/${userID}/ty`: {
            return new Response(gettyConfig(userID, request.headers.get("Host")), {
              status: 200,
              headers: { "Content-Type": "text/plain;charset=utf-8" }
            });
          }

          case `/${userID}/cl`: {
            return new Response(getclConfig(userID, request.headers.get("Host")), {
              status: 200,
              headers: { "Content-Type": "text/plain;charset=utf-8" }
            });
          }

          case `/${userID}/sb`: {
            return new Response(getsbConfig(userID, request.headers.get("Host")), {
              status: 200,
              headers: { "Content-Type": "application/json;charset=utf-8" }
            });
          }

          case `/${userID}/pty`: {
            return new Response(getptyConfig(userID, request.headers.get("Host")), {
              status: 200,
              headers: { "Content-Type": "text/plain;charset=utf-8" }
            });
          }

          case `/${userID}/pcl`: {
            return new Response(getpclConfig(userID, request.headers.get("Host")), {
              status: 200,
              headers: { "Content-Type": "text/plain;charset=utf-8" }
            });
          }

          case `/${userID}/psb`: {
            return new Response(getpsbConfig(userID, request.headers.get("Host")), {
              status: 200,
              headers: { "Content-Type": "application/json;charset=utf-8" }
            });
          }

          default:
            /* ---------- PART B : V-Bridge 反向代理 ---------- */
            return await vBridgeFetch(request);
        }
      }

      /* ---------- 1.3 WebSocket 请求 ---------- */
      if (url.pathname.includes('/pyip=')) {
        const tmpIp = decodeURIComponent(url.pathname.split("=")[1]);
        if (isValidIP(tmpIp)) {
          applyProxyString(tmpIp);
        }
      }
      return await vlessOverWSHandler(request);

    } catch (err) {
      /** @type {Error} */ let e = err;
      return new Response(e.toString());
    }
  },
};

/* ============================================================
 *  PART B —— V-Bridge-Worker v2.0
 * ============================================================ */

const D = `<html><head><title>404 Not Found</title></head><body><center><h1>404 Not Found</h1></center><hr><center>nginx</center></body></html>`;
const F = new Set(['/favicon.ico', '/robots.txt', '/.env', '/.git', '/.well-known']);
const H_IN  = ['cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'x-forwarded-for',
               'x-real-ip', 'forwarded', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'];
const H_OUT = ['cf-ray', 'alt-svc', 'cf-cache-status', 'x-powered-by', 'x-cloudflare-request-id'];
const P_HTTP = new Set(['80', '8080', '8880', '2052', '2082', '2086', '2095']);

/**
 * V-Bridge 反向代理主逻辑
 * 用法： /https/<host>/<path>   或   /http/<host>/<path>   或   /<host>/<path>
 * @param {Request} r
 * @returns {Promise<Response>}
 */
async function vBridgeFetch(r) {
  try {
    const u = new URL(r.url);
    const p = u.pathname;

    // 1. 资源保护（节省 100k 请求额度）
    if (p === '/' || F.has(p)) {
      return new Response(p === '/' ? D : null, {
        status: p === '/' ? 404 : 204,
        headers: {
          'content-type': 'text/html; charset=UTF-8',
          'server': 'nginx',
          'connection': 'close'
        }
      });
    }

    const s = p.split('/').filter(Boolean);
    if (s.length < 2) {
      return new Response(D, { status: 404, headers: { 'server': 'nginx' } });
    }

    // 2. 智能路由与协议探测
    let i = 0;
    let t = 'https';
    if (s[0] === 'http' || s[0] === 'https') { t = s[0]; i = 1; }

    const h_p = s[i];
    const t_p = '/' + s.slice(i + 1).join('/');
    const [h, o] = h_p.split(':');

    // 预判协议：HTTP 专用端口或裸 IP 时默认走 http
    if (s[0] !== 'https') {
      const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(h);
      if (isIP || (o && P_HTTP.has(o))) t = 'http';
    }

    const dest = `${t}://${h_p}${t_p}${u.search}`;

    // 3. 请求头处理
    const n = new Headers(r.headers);
    n.set('Host', h);
    n.set('Connection', 'keep-alive');
    for (const x of H_IN) n.delete(x);

    // 4. fetch 配置
    const cfg = {
      method: r.method,
      headers: n,
      redirect: 'manual'
    };
    if (r.signal) cfg['signal'] = r.signal;
    cfg['cf'] = { cacheTtl: 0, cacheEverything: false, mirage: false, polish: 'off' };
    if (r.method !== 'GET' && r.method !== 'HEAD') cfg.body = r.body;

    // 5. 执行 + 智能回退
    let res;
    try {
      res = await fetch(dest, cfg);
      if (t === 'https' && (res.status === 525 || res.status === 521 || res.status === 526)) {
        throw new Error('tls handshake failed');
      }
    } catch (e) {
      res = await fetch(dest.replace('https://', 'http://'), cfg);
    }

    // 6. WebSocket / VoIP 直通（零延迟）
    if (res.status === 101 || (r.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      return res;
    }

    // 7. 响应伪装（隐身引擎）
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
 *  PART A —— VLESS 核心实现
 * ============================================================ */

/**
 * 解析并应用 "ip:port" / "[ipv6]:port" 形式的代理地址
 * @param {string} str
 */
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

/**
 * @param {string} ip
 * @returns {boolean}
 */
function isValidIP(ip) {
  const reg = /^[\s\S]*$/;
  return reg.test(ip);
}

/**
 * VLESS over WebSocket 处理器
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function vlessOverWSHandler(request) {
  // @ts-ignore
  const webSocketPair = new WebSocketPair();
  const [client, webSocket] = Object.values(webSocketPair);

  webSocket.accept();

  let address = "";
  let portWithRandomLog = "";
  const log = (/** @type {string} */ info, /** @type {string | undefined} */ event) => {
    console.log(`[${address}:${portWithRandomLog}] ${info}`, event || "");
  };
  const earlyDataHeader = request.headers.get("sec-websocket-protocol") || "";

  const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);

  /** @type {{ value: any | null }} */
  const remoteSocketWapper = { value: null };
  let udpStreamWrite = null;
  let isDns = false;

  // ws --> remote
  readableWebSocketStream
    .pipeTo(
      new WritableStream({
        async write(chunk, controller) {
          if (isDns && udpStreamWrite) {
            return udpStreamWrite(chunk);
          }
          if (remoteSocketWapper.value) {
            const writer = remoteSocketWapper.value.writable.getWriter();
            await writer.write(chunk);
            writer.releaseLock();
            return;
          }

          const {
            hasError,
            message,
            portRemote = 443,
            addressRemote = "",
            rawDataIndex,
            vlessVersion = new Uint8Array([0, 0]),
            isUDP,
          } = await processVlessHeader(chunk, userID);

          address = addressRemote;
          portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? "udp " : "tcp "}`;

          if (hasError) {
            throw new Error(message);
          }

          // UDP 仅放行 DNS(53)
          if (isUDP) {
            if (portRemote === 53) {
              isDns = true;
            } else {
              throw new Error("UDP proxy only enable for DNS which is port 53");
            }
          }

          const vlessResponseHeader = new Uint8Array([vlessVersion[0], 0]);
          const rawClientData = chunk.slice(rawDataIndex);

          if (isDns) {
            const { write } = await handleUDPOutBound(webSocket, vlessResponseHeader, log);
            udpStreamWrite = write;
            udpStreamWrite(rawClientData);
            return;
          }

          handleTCPOutBound(
            remoteSocketWapper,
            addressRemote,
            portRemote,
            rawClientData,
            webSocket,
            vlessResponseHeader,
            log
          );
        },
        close() {
          log(`readableWebSocketStream is close`);
        },
        abort(reason) {
          log(`readableWebSocketStream is abort`, JSON.stringify(reason));
        },
      })
    )
    .catch((err) => {
      log("readableWebSocketStream pipeTo error", err);
    });

  return new Response(null, {
    status: 101,
    // @ts-ignore
    webSocket: client,
  });
}

/**
 * 检查 UUID 是否在 API 响应中
 * @param {string} targetUuid
 * @returns {Promise<boolean>}
 */
async function checkUuidInApiResponse(targetUuid) {
  try {
    const apiResponse = await getApiResponse();
    if (!apiResponse) return false;
    return apiResponse.users.some((user) => user.uuid === targetUuid);
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

async function getApiResponse() {
  return { users: [] };
}

/**
 * 处理出站 TCP 连接
 */
async function handleTCPOutBound(
  remoteSocket,
  addressRemote,
  portRemote,
  rawClientData,
  webSocket,
  vlessResponseHeader,
  log
) {
  async function connectAndWrite(address, port) {
    if (/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(address)) {
      address = `${atob('d3d3Lg==')}${address}${atob('LnNzbGlwLmlv')}`;
    }
    /** @type {any} */
    const tcpSocket = connect({ hostname: address, port: port });
    remoteSocket.value = tcpSocket;
    log(`connected to ${address}:${port}`);
    const writer = tcpSocket.writable.getWriter();
    await writer.write(rawClientData);
    writer.releaseLock();
    return tcpSocket;
  }

  // 无回包时重定向到 proxyIP
  async function retry() {
    const tcpSocket = await connectAndWrite(proxyIP || addressRemote, proxyPort || portRemote);
    tcpSocket.closed
      .catch((error) => {
        console.log("retry tcpSocket closed error", error);
      })
      .finally(() => {
        safeCloseWebSocket(webSocket);
      });
    remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, null, log);
  }

  const tcpSocket = await connectAndWrite(addressRemote, portRemote);

  remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, retry, log);
}

/**
 * 把 WebSocket 变成可读流
 */
function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
  let readableStreamCancel = false;
  const stream = new ReadableStream({
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
      if (error) {
        controller.error(error);
      } else if (earlyData) {
        controller.enqueue(earlyData);
      }
    },

    pull(controller) { /* 背压预留 */ },

    cancel(reason) {
      if (readableStreamCancel) return;
      log(`ReadableStream was canceled, due to ${reason}`);
      readableStreamCancel = true;
      safeCloseWebSocket(webSocketServer);
    },
  });

  return stream;
}

/**
 * 解析 VLESS 协议头
 * @param {ArrayBuffer} vlessBuffer
 * @param {string} userID
 */
async function processVlessHeader(vlessBuffer, userID) {
  if (vlessBuffer.byteLength < 24) {
    return { hasError: true, message: "invalid data" };
  }

  const version = new Uint8Array(vlessBuffer.slice(0, 1));
  let isValidUser = false;
  let isUDP = false;

  const slicedBuffer = new Uint8Array(vlessBuffer.slice(1, 17));
  const slicedBufferString = stringify(slicedBuffer);

  const uuids = userID.includes(",") ? userID.split(",") : [userID];
  const checkUuidInApi = await checkUuidInApiResponse(slicedBufferString);
  isValidUser = uuids.some((userUuid) => checkUuidInApi || slicedBufferString === userUuid.trim());

  console.log(`checkUuidInApi: ${await checkUuidInApiResponse(slicedBufferString)}, userID: ${slicedBufferString}`);

  if (!isValidUser) {
    return { hasError: true, message: "invalid user" };
  }

  const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];

  const command = new Uint8Array(vlessBuffer.slice(18 + optLength, 18 + optLength + 1))[0];
  if (command === 1) {
    // TCP
  } else if (command === 2) {
    isUDP = true;
  } else {
    return { hasError: true, message: `command ${command} is not support, command 01-tcp,02-udp,03-mux` };
  }

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
      addressValue = new Uint8Array(
        vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
      ).join(".");
      break;
    case 2:
      addressLength = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
      addressValueIndex += 1;
      addressValue = new TextDecoder().decode(
        vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
      );
      break;
    case 3:
      addressLength = 16;
      const dataView = new DataView(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
      const ipv6 = [];
      for (let i = 0; i < 8; i++) {
        ipv6.push(dataView.getUint16(i * 2).toString(16));
      }
      addressValue = ipv6.join(":");
      break;
    default:
      return { hasError: true, message: `invild addressType is ${addressType}` };
  }

  if (!addressValue) {
    return { hasError: true, message: `addressValue is empty, addressType is ${addressType}` };
  }

  return {
    hasError: false,
    addressRemote: addressValue,
    addressType,
    portRemote,
    rawDataIndex: addressValueIndex + addressLength,
    vlessVersion: version,
    isUDP,
  };
}

/**
 * remote --> ws
 */
async function remoteSocketToWS(remoteSocket, webSocket, vlessResponseHeader, retry, log) {
  let chunks = [];
  /** @type {ArrayBuffer | null} */
  let vlessHeader = vlessResponseHeader;
  let hasIncomingData = false;

  await remoteSocket.readable
    .pipeTo(
      new WritableStream({
        start() {},
        async write(chunk, controller) {
          hasIncomingData = true;
          if (webSocket.readyState !== WS_READY_STATE_OPEN) {
            controller.error("webSocket.readyState is not open, maybe close");
          }
          if (vlessHeader) {
            webSocket.send(await new Blob([vlessHeader, chunk]).arrayBuffer());
            vlessHeader = null;
          } else {
            webSocket.send(chunk);
          }
        },
        close() {
          log(`remoteConnection!.readable is close with hasIncomingData is ${hasIncomingData}`);
        },
        abort(reason) {
          console.error(`remoteConnection!.readable abort`, reason);
        },
      })
    )
    .catch((error) => {
      console.error(`remoteSocketToWS has exception `, error.stack || error);
      safeCloseWebSocket(webSocket);
    });

  if (hasIncomingData === false && retry) {
    log(`retry`);
    retry();
  }
}

/**
 * base64 -> ArrayBuffer
 */
function base64ToArrayBuffer(base64Str) {
  if (!base64Str) return { error: null };
  try {
    base64Str = base64Str.replace(/-/g, "+").replace(/_/g, "/");
    const decode = atob(base64Str);
    const arryBuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
    return { earlyData: arryBuffer.buffer, error: null };
  } catch (error) {
    return { error };
  }
}

/**
 * UUID 校验
 * @param {string} uuid
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;

function safeCloseWebSocket(socket) {
  try {
    if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING) {
      socket.close();
    }
  } catch (error) {
    console.error("safeCloseWebSocket error", error);
  }
}

const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}

function unsafeStringify(arr, offset = 0) {
  return (
    byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] +
    byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" +
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
  if (!isValidUUID(uuid)) {
    throw TypeError("Stringified UUID is invalid");
  }
  return uuid;
}

/**
 * 处理 UDP(仅 DNS) 出站
 */
async function handleUDPOutBound(webSocket, vlessResponseHeader, log) {
  let isVlessHeaderSent = false;

  const transformStream = new TransformStream({
    start(controller) {},
    transform(chunk, controller) {
      for (let index = 0; index < chunk.byteLength; ) {
        const lengthBuffer = chunk.slice(index, index + 2);
        const udpPakcetLength = new DataView(lengthBuffer).getUint16(0);
        const udpData = new Uint8Array(chunk.slice(index + 2, index + 2 + udpPakcetLength));
        index = index + 2 + udpPakcetLength;
        controller.enqueue(udpData);
      }
    },
    flush(controller) {},
  });

  transformStream.readable
    .pipeTo(
      new WritableStream({
        async write(chunk) {
          const resp = await fetch(dohURL, {
            method: "POST",
            headers: { "content-type": "application/dns-message" },
            body: chunk,
          });
          const dnsQueryResult = await resp.arrayBuffer();
          const udpSize = dnsQueryResult.byteLength;
          const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);
          if (webSocket.readyState === WS_READY_STATE_OPEN) {
            log(`doh success and dns message length is ${udpSize}`);
            if (isVlessHeaderSent) {
              webSocket.send(await new Blob([udpSizeBuffer, dnsQueryResult]).arrayBuffer());
            } else {
              webSocket.send(await new Blob([vlessResponseHeader, udpSizeBuffer, dnsQueryResult]).arrayBuffer());
              isVlessHeaderSent = true;
            }
          }
        },
      })
    )
    .catch((error) => {
      log("dns udp has error" + error);
    });

  const writer = transformStream.writable.getWriter();

  return {
    write(chunk) {
      writer.write(chunk);
    },
  };
}

/* ============================================================
 *  节点构建工具
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

function nodeLink(userID, hostName, n) {
  const q = n.tls
    ? `encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2560`
    : `encryption=none&security=none&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2560`;
  return `vless://${userID}@${n.ip}:${n.pt}?${q}#${nodeTag(n)}`;
}

/* ============================================================
 *  分享 / 订阅内容生成
 * ============================================================ */

/**
 * @param {string} userID
 * @param {string | null} hostName
 * @returns {string}
 */
function getvlessConfig(userID, hostName) {
  const nodes = buildNodes();

  const wvlessws = `vless://${userID}@${CDNIP}:8880?encryption=none&security=none&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#${hostName}`;
  const pvlesswstls = `vless://${userID}@${CDNIP}:8443?encryption=none&security=tls&type=ws&host=${hostName}&sni=${hostName}&fp=random&path=%2F%3Fed%3D2560#${hostName}`;

  const note =
    `甬哥博客地址：https://ygkkk.blogspot.com\n` +
    `甬哥YouTube频道：https://www.youtube.com/@ygkkk\n` +
    `甬哥TG电报群组：https://t.me/ygkkktg\n` +
    `甬哥TG电报频道：https://t.me/ygkkktgpd\n\n` +
    `ProxyIP全局运行中：${proxyIP}:${proxyPort}`;

  const ty  = `https://${hostName}/${userID}/ty`;
  const cl  = `https://${hostName}/${userID}/cl`;
  const sb  = `https://${hostName}/${userID}/sb`;
  const pty = `https://${hostName}/${userID}/pty`;
  const pcl = `https://${hostName}/${userID}/pcl`;
  const psb = `https://${hostName}/${userID}/psb`;

  // 全量聚合分享
  const allShare = nodes.map((n) => nodeLink(userID, hostName, n)).join("\n");
  const wkvlessshare = btoa(allShare);

  // 仅 TLS 聚合分享
  const tlsShare = nodes.filter((n) => n.tls).map((n) => nodeLink(userID, hostName, n)).join("\n");
  const pgvlessshare = btoa(tlsShare);

  const noteshow = note.replace(/\n/g, "<br>");

  const displayHtml = `
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
<style>
.limited-width {
    max-width: 200px;
    overflow: auto;
    word-wrap: break-word;
}
</style>
</head>
<script>
function copyToClipboard(text) {
  const input = document.createElement('textarea');
  input.style.position = 'fixed';
  input.style.opacity = 0;
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('Copy');
  document.body.removeChild(input);
  alert('已复制到剪贴板');
}
</script>`;

  if (hostName.includes("workers.dev")) {
    return `
<br>
<br>
${displayHtml}
<body>
<div class="container">
    <div class="row">
        <div class="col-md-12">
            <h1>Cloudflare-workers/pages-vless代理脚本 V25.5.4</h1>
	    <hr>
            <p>${noteshow}</p>
            <hr>
	    <hr>
	    <hr>
            <br>
            <br>
            <h3>1：CF-workers-vless+ws节点</h3>
			<table class="table">
				<thead>
					<tr>
						<th>节点特色：</th>
						<th>单节点链接如下：</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td class="limited-width">关闭了TLS加密，无视域名阻断</td>
						<td class="limited-width">${wvlessws}</td>
						<td><button class="btn btn-primary" onclick="copyToClipboard('${wvlessws}')">点击复制链接</button></td>
					</tr>
				</tbody>
			</table>
            <h5>客户端参数如下：</h5>
            <ul>
                <li>客户端地址(address)：自定义的域名 或者 优选域名 或者 优选IP 或者 反代IP</li>
                <li>端口(port)：7个http端口可任意选择(80、8080、8880、2052、2082、2086、2095)，或反代IP对应端口</li>
                <li>用户ID(uuid)：${userID}</li>
                <li>传输协议(network)：ws 或者 websocket</li>
                <li>伪装域名(host)：${hostName}</li>
                <li>路径(path)：/?ed=2560</li>
		<li>传输安全(TLS)：关闭</li>
            </ul>
            <hr>
			<hr>
			<hr>
            <br>
            <br>
            <h3>2：CF-workers-vless+ws+tls节点</h3>
			<table class="table">
				<thead>
					<tr>
						<th>节点特色：</th>
						<th>单节点链接如下：</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td class="limited-width">启用了TLS加密，<br>如果客户端支持分片(Fragment)功能，建议开启，防止域名阻断</td>
						<td class="limited-width">${pvlesswstls}</td>
						<td><button class="btn btn-primary" onclick="copyToClipboard('${pvlesswstls}')">点击复制链接</button></td>
					</tr>
				</tbody>
			</table>
            <h5>客户端参数如下：</h5>
            <ul>
                <li>客户端地址(address)：自定义的域名 或者 优选域名 或者 优选IP 或者 反代IP</li>
                <li>端口(port)：6个https端口可任意选择(443、8443、2053、2083、2087、2096)，或反代IP对应端口</li>
                <li>用户ID(uuid)：${userID}</li>
                <li>传输协议(network)：ws 或者 websocket</li>
                <li>伪装域名(host)：${hostName}</li>
                <li>路径(path)：/?ed=2560</li>
                <li>传输安全(TLS)：开启</li>
                <li>跳过证书验证(allowlnsecure)：false</li>
			</ul>
			<hr>
			<hr>
			<hr>
			<br>
			<br>
			<h3>3：聚合通用、Clash-meta、Sing-box订阅链接如下：</h3>
			<hr>
			<p>注意：<br>1、默认每个订阅链接包含TLS+非TLS共13个端口节点<br>2、当前workers域名作为订阅链接，需通过代理进行订阅更新<br>3、如使用的客户端不支持分片功能，则TLS节点不可用</p>
			<hr>

			<table class="table">
					<thead>
						<tr>
							<th>聚合通用分享链接 (可直接导入客户端)：</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td><button class="btn btn-primary" onclick="copyToClipboard('${wkvlessshare}')">点击复制链接</button></td>
						</tr>
					</tbody>
				</table>

			<table class="table">
					<thead>
						<tr>
							<th>聚合通用订阅链接：</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="limited-width">${ty}</td>
							<td><button class="btn btn-primary" onclick="copyToClipboard('${ty}')">点击复制链接</button></td>
						</tr>
					</tbody>
				</table>

				<table class="table">
						<thead>
							<tr>
								<th>Clash-meta订阅链接：</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td class="limited-width">${cl}</td>
								<td><button class="btn btn-primary" onclick="copyToClipboard('${cl}')">点击复制链接</button></td>
							</tr>
						</tbody>
					</table>

					<table class="table">
					<thead>
						<tr>
							<th>Sing-box订阅链接：</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="limited-width">${sb}</td>
							<td><button class="btn btn-primary" onclick="copyToClipboard('${sb}')">点击复制链接</button></td>
						</tr>
					</tbody>
				</table>
				<br>
				<br>
        </div>
    </div>
</div>
</body>
`;
  }

  return `
<br>
<br>
${displayHtml}
<body>
<div class="container">
    <div class="row">
        <div class="col-md-12">
            <h1>Cloudflare-workers/pages-vless代理脚本 V25.5.4</h1>
			<hr>
            <p>${noteshow}</p>
            <hr>
			<hr>
			<hr>
            <br>
            <br>
            <h3>1：CF-pages/workers/自定义域-vless+ws+tls节点</h3>
			<table class="table">
				<thead>
					<tr>
						<th>节点特色：</th>
						<th>单节点链接如下：</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td class="limited-width">启用了TLS加密，<br>如果客户端支持分片(Fragment)功能，可开启，防止域名阻断</td>
						<td class="limited-width">${pvlesswstls}</td>
						<td><button class="btn btn-primary" onclick="copyToClipboard('${pvlesswstls}')">点击复制链接</button></td>
					</tr>
				</tbody>
			</table>
            <h5>客户端参数如下：</h5>
            <ul>
                <li>客户端地址(address)：自定义的域名 或者 优选域名 或者 优选IP 或者 反代IP</li>
                <li>端口(port)：6个https端口可任意选择(443、8443、2053、2083、2087、2096)，或反代IP对应端口</li>
                <li>用户ID(uuid)：${userID}</li>
                <li>传输协议(network)：ws 或者 websocket</li>
                <li>伪装域名(host)：${hostName}</li>
                <li>路径(path)：/?ed=2560</li>
                <li>传输安全(TLS)：开启</li>
                <li>跳过证书验证(allowlnsecure)：false</li>
			</ul>
            <hr>
			<hr>
			<hr>
            <br>
            <br>
			<h3>2：聚合通用、Clash-meta、Sing-box订阅链接如下：</h3>
			<hr>
			<p>注意：以下订阅链接仅6个TLS端口节点</p>
			<hr>

			<table class="table">
					<thead>
						<tr>
							<th>聚合通用分享链接 (可直接导入客户端)：</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td><button class="btn btn-primary" onclick="copyToClipboard('${pgvlessshare}')">点击复制链接</button></td>
						</tr>
					</tbody>
				</table>

			<table class="table">
					<thead>
						<tr>
							<th>聚合通用订阅链接：</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="limited-width">${pty}</td>
							<td><button class="btn btn-primary" onclick="copyToClipboard('${pty}')">点击复制链接</button></td>
						</tr>
					</tbody>
				</table>

				<table class="table">
						<thead>
							<tr>
								<th>Clash-meta订阅链接：</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td class="limited-width">${pcl}</td>
								<td><button class="btn btn-primary" onclick="copyToClipboard('${pcl}')">点击复制链接</button></td>
							</tr>
						</tbody>
					</table>

					<table class="table">
					<thead>
						<tr>
							<th>Sing-box订阅链接：</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="limited-width">${psb}</td>
							<td><button class="btn btn-primary" onclick="copyToClipboard('${psb}')">点击复制链接</button></td>
						</tr>
					</tbody>
				</table>
				<br>
				<br>
        </div>
    </div>
</div>
</body>
`;
}

/* -------------------- 聚合通用（base64 订阅） -------------------- */

function gettyConfig(userID, hostName) {
  const share = buildNodes().map((n) => nodeLink(userID, hostName, n)).join("\n");
  return `${btoa(share)}`;
}

function getptyConfig(userID, hostName) {
  const share = buildNodes().filter((n) => n.tls).map((n) => nodeLink(userID, hostName, n)).join("\n");
  return `${btoa(share)}`;
}

/* -------------------- Clash-meta -------------------- */

function clashProxiesBlock(userID, hostName, nodes) {
  return nodes.map((n) => {
    const server = n.ip.replace(/[\[\]]/g, '');
    const tlsLine = n.tls ? `  tls: true\n  servername: ${hostName}\n` : `  tls: false\n`;
    return `- name: ${nodeTag(n)}
  type: vless
  server: ${server}
  port: ${n.pt}
  uuid: ${userID}
  udp: false
${tlsLine}  network: ws
  ws-opts:
    path: "/?ed=2560"
    headers:
      Host: ${hostName}`;
  }).join("\n\n");
}

function clashGroupsBlock(nodes) {
  const list = nodes.map((n) => `    - ${nodeTag(n)}`).join("\n");
  const listInline = nodes.map((n) => `    - ${nodeTag(n)}`).join("\n");
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
${listInline}`;
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
  const o = {
    server: n.ip,
    server_port: Number(n.pt),
    tag: nodeTag(n),
    packet_encoding: "packetaddr",
    transport: {
      headers: { Host: [hostName] },
      path: "/?ed=2560",
      type: "ws"
    },
    type: "vless",
    uuid: userID
  };
  if (n.tls) {
    o.tls = {
      enabled: true,
      server_name: hostName,
      insecure: false,
      utls: { enabled: true, fingerprint: "chrome" }
    };
  }
  return o;
}

function sbConfigObject(userID, hostName, nodes) {
  const tags = nodes.map((n) => nodeTag(n));
  const outbounds = [
    {
      tag: "select",
      type: "selector",
      default: "auto",
      outbounds: ["auto", ...tags]
    },
    ...nodes.map((n) => sbOutbound(userID, hostName, n)),
    { tag: "direct", type: "direct" },
    {
      tag: "auto",
      type: "urltest",
      outbounds: tags,
      url: "https://www.gstatic.com/generate_204",
      interval: "1m",
      tolerance: 50,
      interrupt_exist_connections: false
    }
  ];

  return {
    log: { disabled: false, level: "info", timestamp: true },
    experimental: {
      clash_api: {
        external_controller: "127.0.0.1:9090",
        external_ui: "ui",
        external_ui_download_url: "",
        external_ui_download_detour: "",
        secret: "",
        default_mode: "Rule"
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
        {
          rule_set: "geosite-geolocation-!cn",
          query_type: ["A", "AAAA"],
          server: "dns_fakeip"
        }
      ],
      fakeip: {
        enabled: true,
        inet4_range: "198.18.0.0/15",
        inet6_range: "fc00::/18"
      },
      independent_cache: true,
      final: "proxydns"
    },
    inbounds: [
      {
        type: "tun",
        tag: "tun-in",
        address: ["172.19.0.1/30", "fd00::1/126"],
        auto_route: true,
        strict_route: true,
        sniff: true,
        sniff_override_destination: true,
        domain_strategy: "prefer_ipv4"
      }
    ],
    outbounds,
    route: {
      rule_set: [
        {
          tag: "geosite-geolocation-!cn",
          type: "remote",
          format: "binary",
          url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/geolocation-!cn.srs",
          download_detour: "select",
          update_interval: "1d"
        },
        {
          tag: "geosite-cn",
          type: "remote",
          format: "binary",
          url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/geolocation-cn.srs",
          download_detour: "select",
          update_interval: "1d"
        },
        {
          tag: "geoip-cn",
          type: "remote",
          format: "binary",
          url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geoip/cn.srs",
          download_detour: "select",
          update_interval: "1d"
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
    ntp: {
      enabled: true,
      server: "time.apple.com",
      server_port: 123,
      interval: "30m",
      detour: "direct"
    }
  };
}

function getsbConfig(userID, hostName) {
  const nodes = buildNodes();
  return JSON.stringify(sbConfigObject(userID, hostName, nodes), null, 2);
}

function getpsbConfig(userID, hostName) {
  const nodes = buildNodes().filter((n) => n.tls);
  return JSON.stringify(sbConfigObject(userID, hostName, nodes), null, 2);
}
