/**
 * server.js — Node.js Бэкенд для поиска руинеров в Dota 2 (OpenDota API + STRATZ GraphQL API, v5.6)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  analyzeMatch,
  analyzeMatchWithLlm,
  syncDotaConstantsAndMeta,
  fetchStratzMatchAndEnrich,
  DEFAULT_STRATZ_API_TOKEN,
  DEMO_MATCHES,
  HEROES_DB,
  registerOpenDotaItemsConstants
} = require('./analyzer');

const PORT = process.env.PORT || 3000;
const OPENDOTA_BASE = 'https://opendota.com';
const STRATZ_TOKEN = process.env.STRATZ_API_TOKEN || DEFAULT_STRATZ_API_TOKEN;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

let dynamicConstantsLoaded = false;

async function ensureConstantsLoaded() {
  if (dynamicConstantsLoaded) return;
  try {
    const [heroesRes, itemsRes] = await Promise.all([
      fetch(`${OPENDOTA_BASE}/constants/heroes`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Dota2-Ruin-Detector/5.6' },
        signal: AbortSignal.timeout(4000)
      }),
      fetch(`${OPENDOTA_BASE}/constants/items`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Dota2-Ruin-Detector/5.6' },
        signal: AbortSignal.timeout(4000)
      })
    ]);

    if (heroesRes.ok) {
      const data = await heroesRes.json();
      for (const h of Object.values(data)) {
        if (h && h.id) {
          const roles = Array.isArray(h.roles) ? h.roles : [];
          const existing = HEROES_DB[h.id] || {};
          HEROES_DB[h.id] = {
            ...existing,
            name: h.localized_name || existing.name || `Hero #${h.id}`,
            isSupport: existing.isSupport ?? (roles.includes('Support') && !roles.includes('Carry'))
          };
        }
      }
    }

    if (itemsRes.ok) {
      const itemsData = await itemsRes.json();
      registerOpenDotaItemsConstants(itemsData);
    }

    dynamicConstantsLoaded = true;
  } catch (_) {
    // Используем встроенные словари HEROES_DB и ITEMS_DB при отсутствии внешнего соединения
  }
}

async function fetchAndAnalyzeMatch(matchId) {
  const rawInput = String(matchId || "").trim();
  const digitMatch = rawInput.match(/\d{5,15}/);
  const cleanId = digitMatch ? digitMatch[0] : rawInput;
  if (!/^\d{5,15}\$/.test(cleanId)) {
    const err = new Error('Некорректный формат Match ID. Введите числовой идентификатор матча.');
    err.statusCode = 400;
    throw err;
  }

  await ensureConstantsLoaded();

  if (DEMO_MATCHES[cleanId]) {
    return {
      source: 'demo',
      ...analyzeMatch(DEMO_MATCHES[cleanId])
    };
  }

  let matchData = null;
  let sourceLabel = 'opendota_live';

  try {
    const response = await fetch(`${OPENDOTA_BASE}/matches/${cleanId}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Dota2-Ruin-Detector/5.6' },
      signal: AbortSignal.timeout(8000)
    });
    if (response.ok) {
      matchData = await response.json();
    }
  } catch (_) {}

  try {
    const enriched = await fetchStratzMatchAndEnrich(cleanId, matchData, {
      stratzToken: STRATZ_TOKEN,
      timeoutMs: 5000
    });
    if (enriched) {
      if (!matchData) sourceLabel = 'stratz_live';
      else if (enriched.stratz_enriched) sourceLabel = 'opendota_plus_stratz';
      matchData = enriched;
    }
  } catch (_) {}

  if (!matchData) {
    const err = new Error(`Матч #${cleanId} не найден ни в OpenDota API, ни в STRATZ API.`);
    err.statusCode = 404;
    throw err;
  }

  const analyzed = await analyzeMatchWithLlm(matchData, {
    stratzToken: STRATZ_TOKEN,
    enrichWithStratz: false
  });
  return {
    source: sourceLabel,
    ...analyzed
  };
}

if (process.argv.includes('--selftest')) {
  console.log('=== Самодиагностика Dota 2 Ruin Detector v5.6 (AI Build Evaluator + STRATZ) ===');
  for (const id of Object.keys(DEMO_MATCHES)) {
    const result = analyzeMatch(DEMO_MATCHES[id]);
    const c = result.verdict.culprit;
    console.log(
      `Матч #${id} (${result.duration_formatted}) -> [${c.ruinType}] ${c.personaname} (${c.hero_name}, ${c.role}) | ` +
      `Итог: ${c.scores.total}/100 (1.Экономика: +${c.scores.economy}, 2.Геймплей: +${c.scores.gameplay}, ` +
      `3.Бенчмарк: +${c.scores.benchmark}, 4.Амнистия: ${c.scores.amnesty}, 5.Таймлайн: +${c.scores.timeline})`
    );
  }
  process.exit(0);
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // 1. Обработка API-запроса на анализ матча
    const matchRoute = pathname.match(/^\/api\/analyze\/([^/]+)\$/);
    if (req.method === 'GET' && matchRoute) {
      const matchId = matchRoute;
      try {
        const analysis = await fetchAndAnalyzeMatch(matchId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(analysis));
      } catch (err) {
        const code = err.statusCode || 500;
        res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: err.message || 'Внутренняя ошибка сервера' }));
      }
    }

    // 2. Раздача всех статических файлов (index.html, app.js, стили и др.)
    if (req.method === 'GET') {
      let relativePath = (pathname === '/' || pathname === '/public/index.html') 
        ? 'index.html' 
        : pathname.replace(/^\/+/, '');
      
      const filePath = path.join(__dirname, relativePath);

      // Защита от выхода за пределы папки и проверка существования файла
      if (filePath.startsWith(__dirname) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        return res.end(fs.readFileSync(filePath));
      }
    }

    // 3. Ответ 404, если файл или маршрут не найден
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Маршрут не найден' }));
  });

  server.listen(PORT, () => {
    console.log(`🚀 Dota 2 Ruin Detector v5.6 (AI Build Evaluator + STRATZ) запущен: http://localhost:${PORT}`);
  });
}

startServer();
