// D:\AI_Codex\Projects\program3-r\demo\v6\llm-proxy.mjs
// v6 DeepSeek LLM 本地代理（CORS 绕开 + 服务端持 Key）
// -----------------------------------------------------------------------------
// 为什么需要：浏览器 fetch DeepSeek 会被 CORS 拦截（DeepSeek 不带
// Access-Control-Allow-Origin）；本代理作"CORS 桥 + 唯一持 Key 的进程"。
//
// 安全模型（v6 final · 严禁前端持有任何 Key）：
//   - 前端 POST 到 http://127.0.0.1:8787/llm，请求体不带 Authorization；
//   - Key 仅由本进程从环境变量 DEEPSEEK_API_KEY 读取（不入文件、不出日志）；
//   - 转发到 DeepSeek 时，服务端注入 'Authorization: Bearer <key>'；
//   - 缺 Key → 503 { error: 'LLM_NOT_CONFIGURED' }，前端 catch 后静默回退模板；
//   - 仅绑 127.0.0.1，局域网不可达。
//
// 启动：cd demo/V1.0 && DEEPSEEK_API_KEY=sk-xxx node llm-proxy.mjs
//      （也支持在 shell 里 `export DEEPSEEK_API_KEY=sk-xxx` 后再 `node llm-proxy.mjs`）
//
// 注：endpoint 默认指向 http://127.0.0.1:8787/llm（见 index.html LLM_CONFIG.endpoint）。
// -----------------------------------------------------------------------------

import http from 'node:http';
import https from 'node:https';

const HOST = '127.0.0.1';
const PORT = Number(process.env.LLM_PROXY_PORT || 8787);
const TARGET = 'https://api.deepseek.com/chat/completions';

// 启动时一次性读 Key；不输出、不打印，仅检查存在性给运维日志
const API_KEY = (process.env.DEEPSEEK_API_KEY || '').trim();

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // 🔒 不暴露 Authorization / * 任意头字段：前端不应发除 Content-Type 之外的头
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

// 标准的"代理未配置"响应：HTTP 503 + body { error: 'LLM_NOT_CONFIGURED' }
function sendNotConfigured(res) {
  res.writeHead(503, { ...corsHeaders(), 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ error: 'LLM_NOT_CONFIGURED', message: '代理未持有 DEEPSEEK_API_KEY。请设置环境变量 DEEPSEEK_API_KEY 后重启代理。' }));
}

const server = http.createServer((req, res) => {
  // 1) CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  // 2) 路径白名单：仅接受 POST /llm
  if (req.method !== 'POST' || req.url !== '/llm') {
    res.writeHead(404, { ...corsHeaders(), 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: { message: 'not_found', expected: 'POST /llm' } }));
  }

  // 3) 🔒 关键：缺 Key 时直接 503，不接收 body 不转发
  if (!API_KEY) {
    return sendNotConfigured(res);
  }

  // 4) 收集 body
  let body = '';
  let size = 0;
  const MAX = 2 * 1024 * 1024; // 2MB 上限，防恶意大 body
  req.on('data', chunk => {
    size += chunk.length;
    if (size > MAX) {
      res.writeHead(413, { ...corsHeaders(), 'Content-Type': 'application/json' });
      req.destroy();
      return res.end(JSON.stringify({ error: { message: 'payload_too_large', limit: MAX } }));
    }
    body += chunk;
  });

  req.on('end', () => {
    if (!body) {
      res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: 'empty_body' } }));
    }

    // 5) 转发到 DeepSeek：服务端注入 Authorization（不在响应里回传 Key）
    const opts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const proxyReq = https.request(TARGET, opts, proxyRes => {
      const headers = { ...corsHeaders() };
      if (proxyRes.headers['content-type']) headers['Content-Type'] = proxyRes.headers['content-type'];
      res.writeHead(proxyRes.statusCode || 502, headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', e => {
      res.writeHead(502, { ...corsHeaders(), 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'proxy_error', detail: e.message } }));
    });
    // 30s 上游超时（与前端 timeoutMs=10s 互为冗余）
    proxyReq.setTimeout(30000, () => {
      proxyReq.destroy(new Error('upstream_timeout_30s'));
    });
    proxyReq.write(body);
    proxyReq.end();
  });

  req.on('error', () => {
    try { res.destroy(); } catch (_) { /* ignore */ }
  });
});

server.on('error', e => {
  if (e && e.code === 'EADDRINUSE') {
    console.error(`\n❌ 端口 ${PORT} 已被占用。请先关闭占用进程，或设置环境变量 LLM_PROXY_PORT=<其他端口> 后重试。\n`);
    process.exit(1);
  }
  console.error('代理服务异常:', e && e.message);
});

server.listen(PORT, HOST, () => {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  DeepSeek LLM 本地代理 · 仅绑 127.0.0.1（防局域网滥用）');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`  监听地址 : http://${HOST}:${PORT}/llm`);
  console.log(`  转发目标 : ${TARGET}`);
  console.log(`  Key 来源 : process.env.DEEPSEEK_API_KEY`);
  console.log(`  Key 状态 : ${API_KEY ? '已配置（' + API_KEY.length + ' 字符，不打印）' : '未配置 → 所有 LLM 请求将返回 503 LLM_NOT_CONFIGURED'}`);
  console.log(`  CSP 提示 : 前端 CSP meta connect-src 必须含 http://${HOST}:${PORT}`);
  console.log('  停止     : Ctrl+C');
  console.log('════════════════════════════════════════════════════════════════');
  if (!API_KEY) {
    console.log('  ⚠️  提示：未检测到 DEEPSEEK_API_KEY。export DEEPSEEK_API_KEY=<your-key> 后重启代理。');
    console.log('════════════════════════════════════════════════════════════════');
  }
});
