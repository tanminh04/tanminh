// Macro news server: gom RSS định kỳ, phân loại, đẩy tin mới xuống trình duyệt qua SSE.
//   node server/index.js            -> chạy thật (cần internet tới các nguồn)
//   DEMO=1 node server/index.js     -> sinh tin giả để test giao diện khi không có mạng
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sources = require('./sources');
const { parseFeed } = require('./rss');
const { classify } = require('./classify');

const PORT = +process.env.PORT || 8080;
const POLL_MS = (+process.env.POLL_SECONDS || 60) * 1000;
const QUOTE_MS = (+process.env.QUOTE_SECONDS || 15) * 1000;
const MAX_ITEMS = 500;
const DEMO = process.env.DEMO === '1';
const FINNHUB_KEY = process.env.FINNHUB_KEY || '';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ---- Kho tin trong bộ nhớ (thay bằng Redis/Postgres khi cần lưu lâu dài) ----
const items = [];
const seen = new Set();
const clients = new Set();
const sourceStatus = Object.fromEntries(sources.map(s => [s.id, { name: s.name, ok: null, lastFetch: null, error: null }]));

function idFor(sourceId, link, title) {
  return crypto.createHash('sha1').update(`${sourceId}|${link || title}`).digest('hex').slice(0, 16);
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

function ingest(source, raw, { silent = false } = {}) {
  const fresh = [];
  for (const r of raw) {
    const id = idFor(source.id, r.link, r.title);
    if (seen.has(id)) continue;
    seen.add(id);
    const item = {
      id, source: source.name, sourceId: source.id,
      title: r.title, summary: r.summary, link: r.link, ts: r.ts,
      receivedAt: Date.now(),
      ...classify(`${r.title} ${r.summary}`, source),
    };
    fresh.push(item);
  }
  if (!fresh.length) return;
  items.push(...fresh);
  items.sort((a, b) => b.ts - a.ts);
  if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
  if (!silent) broadcast('news', fresh.sort((a, b) => a.ts - b.ts));
}

async function fetchSource(source, first) {
  const st = sourceStatus[source.id];
  try {
    const res = await fetch(source.url, {
      headers: { 'user-agent': 'Mozilla/5.0 (macro-news-bot)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ingest(source, parseFeed(await res.text()), { silent: first });
    Object.assign(st, { ok: true, error: null });
  } catch (e) {
    Object.assign(st, { ok: false, error: String(e.message || e) });
  }
  st.lastFetch = Date.now();
}

async function pollAll(first = false) {
  await Promise.all(sources.map(s => fetchSource(s, first)));
  broadcast('status', sourceStatus);
}

// ---- Giá thị trường cho dải ticker ----
const SYMBOLS = (process.env.SYMBOLS || 'SPY,QQQ,TLT,GLD,USO,UUP').split(',');
const quotes = {};

async function pollQuotes() {
  if (!FINNHUB_KEY) return;
  await Promise.all(SYMBOLS.map(async sym => {
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`, { signal: AbortSignal.timeout(10000) });
      const q = await r.json();
      if (q && q.c) quotes[sym] = { sym, price: q.c, change: q.dp, ts: Date.now() };
    } catch { /* bỏ qua mã lỗi, giữ giá cũ */ }
  }));
  broadcast('quotes', Object.values(quotes));
}

// ---- Chế độ DEMO ----
const DEMO_HEADLINES = [
  'Fed\'s Powell says further rate cuts depend on incoming inflation data',
  'US CPI rises 0.3% m/m, core inflation above forecast',
  'ECB holds rates steady, Lagarde flags downside growth risks',
  'Oil jumps 2% as OPEC+ signals deeper output cuts',
  'China PBOC sets yuan midpoint stronger than expected',
  'BoJ\'s Ueda: will keep raising rates if outlook is realized',
  'NHNN giữ nguyên lãi suất điều hành, tỷ giá USD/VND ổn định',
  'US nonfarm payrolls beat expectations, Treasury yields climb',
  'UK gilt yields fall after BoE minutes show split vote',
  'Gold hits record high as dollar weakens',
  'Eurozone PMI contracts for third month, euro slips',
  'VN-Index tăng mạnh nhờ dòng tiền khối ngoại quay lại',
];

function demoTick() {
  const src = sources[Math.floor(Math.random() * sources.length)];
  const title = DEMO_HEADLINES[Math.floor(Math.random() * DEMO_HEADLINES.length)];
  ingest(src, [{ title: `${title} (${new Date().toLocaleTimeString('en-GB')})`, summary: '', link: '', ts: Date.now() }]);
}

function demoQuotes() {
  for (const sym of SYMBOLS) {
    const prev = quotes[sym] || { price: 100 + Math.random() * 400, change: 0 };
    const step = (Math.random() - 0.5) * 0.004;
    quotes[sym] = { sym, price: +(prev.price * (1 + step)).toFixed(2), change: +(prev.change + step * 100).toFixed(2), ts: Date.now(), demo: true };
  }
  broadcast('quotes', Object.values(quotes));
}

// ---- HTTP ----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

function json(res, data) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');

  if (url.pathname === '/api/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write('retry: 3000\n\n');
    res.write(`event: status\ndata: ${JSON.stringify(sourceStatus)}\n\n`);
    if (Object.keys(quotes).length) res.write(`event: quotes\ndata: ${JSON.stringify(Object.values(quotes))}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/api/news') {
    const since = +url.searchParams.get('since') || 0;
    const limit = Math.min(+url.searchParams.get('limit') || 200, MAX_ITEMS);
    return json(res, items.filter(i => i.ts > since).slice(0, limit));
  }
  if (url.pathname === '/api/status') return json(res, { demo: DEMO, quotesProvider: FINNHUB_KEY ? 'finnhub' : DEMO ? 'demo' : null, sources: sourceStatus });

  const file = path.normalize(path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

// Giữ kết nối SSE sống qua proxy
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25000);

server.listen(PORT, async () => {
  console.log(`Macro news on http://localhost:${PORT} ${DEMO ? '(DEMO)' : ''}`);
  if (DEMO) {
    for (let i = 0; i < 15; i++) demoTick();
    setInterval(demoTick, 4000);
    demoQuotes();
    setInterval(demoQuotes, 2000);
  } else {
    await pollAll(true);
    setInterval(pollAll, POLL_MS);
    pollQuotes();
    setInterval(pollQuotes, QUOTE_MS);
  }
});
