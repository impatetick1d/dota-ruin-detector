/**
 * app.js — Next-Gen UI Renderer & Motion Controller для DOTA 2 RUIN DETECTOR
 * Работает в связке с index.html и analyzer.js
 */

const STEAM_HERO_CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes';
const STEAM_ITEM_CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items';

const HERO_SLUG_OVERRIDES = {
  1: 'antimage',
  7: 'earthshaker',
  11: 'nevermore',
  16: 'sand_king',
  17: 'storm_spirit',
  20: 'vengefulspirit',
  21: 'windrunner',
  22: 'zuus',
  27: 'shadow_shaman',
  30: 'witch_doctor',
  36: 'necrolyte',
  39: 'queenofpain',
  41: 'faceless_void',
  42: 'skeleton_king',
  43: 'death_prophet',
  44: 'phantom_assassin',
  46: 'templar_assassin',
  49: 'dragon_knight',
  51: 'rattletrap',
  53: 'furion',
  54: 'life_stealer',
  55: 'dark_seer',
  60: 'night_stalker',
  62: 'bounty_hunter',
  68: 'ancient_apparition',
  69: 'doom_bringer',
  71: 'spirit_breaker',
  76: 'obsidian_destroyer',
  79: 'shadow_demon',
  80: 'lone_druid',
  81: 'chaos_knight',
  83: 'treant',
  84: 'ogre_magi',
  88: 'nyx_assassin',
  89: 'naga_siren',
  90: 'keeper_of_the_light',
  91: 'wisp',
  95: 'troll_warlord',
  96: 'centaur',
  97: 'magnataur',
  98: 'shredder',
  101: 'skywrath_mage',
  103: 'elder_titan',
  104: 'legion_commander',
  106: 'ember_spirit',
  107: 'earth_spirit',
  108: 'abyssal_underlord',
  112: 'winter_wyvern',
  113: 'arc_warden',
  114: 'monkey_king',
  119: 'dark_willow',
  126: 'void_spirit',
  131: 'ringmaster',
  137: 'primal_beast',
  138: 'muerta',
  145: 'kez'
};

const ROLE_EMOJI_MAP = {
  1: { icon: '🗡️', short: '1', label: 'Керри (Pos 1)' },
  2: { icon: '⚡', short: '2', label: 'Мидер (Pos 2)' },
  3: { icon: '🛡️', short: '3', label: 'Оффлейнер (Pos 3)' },
  4: { icon: '🎯', short: '4', label: 'Роумер / Саппорт (Pos 4)' },
  5: { icon: '👁️', short: '5', label: 'Полная поддержка (Pos 5)' },
  6: { icon: '🌲', short: '6', label: 'Лесник (Pos 6 🌲)' }
};

let browserItemsConstantsSynced = false;
let currentAnalysis = null;
let selectedSlot = null;
let activeWorkspaceTab = 'dossier';
let activeReasonFilter = 'all';
let activeTableFilter = 'all';
let chartGeometryCache = null;

// Инъекция Next-Gen стилей: легкий и четкий 3D-Tilt без мыла + полноразмерный арт героя без обреза
function injectNextGenStyles() {
  if (document.getElementById('d2-nextgen-styles')) return;
  const style = document.createElement('style');
  style.id = 'd2-nextgen-styles';
  style.textContent = `
    :root {
      --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
    }

    body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }

    .font-mono {
      font-variant-numeric: tabular-nums;
    }

    /* Мягкий и легкий 3D-Tilt без замыливания текста внутри */
    .tilt-surface {
      position: relative;
      transform-style: flat !important;
      backface-visibility: hidden;
      will-change: transform;
    }

    button,
    [data-magnetic],
    #analyzeBtn,
    #heroAnalyzeBtn {
      transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease !important;
    }

    /* Четкие внутренние карточки со Spotlight-подсветкой */
    .pro-subcard {
      position: relative;
      background: linear-gradient(180deg, rgba(19, 26, 39, 0.95) 0%, rgba(12, 17, 26, 0.98) 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow:
        inset 0 1px 0 0 rgba(255, 255, 255, 0.07),
        0 8px 20px -10px rgba(0, 0, 0, 0.65);
      transition:
        border-color 0.2s ease,
        background-color 0.2s ease,
        transform 0.2s var(--ease-out-expo);
      overflow: hidden;
    }

    .pro-subcard::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: radial-gradient(
        380px circle at var(--spot-x, -999px) var(--spot-y, -999px),
        rgba(255, 255, 255, 0.06),
        transparent 45%
      );
      pointer-events: none;
      z-index: 0;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .pro-subcard:hover::before {
      opacity: 1;
    }

    .pro-subcard:hover {
      border-color: rgba(255, 255, 255, 0.18);
    }

    .pro-subcard > * {
      position: relative;
      z-index: 1;
    }

    /* Читаемый чип имени героя */
    .hero-name-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.12rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 700;
      line-height: 1.25;
      color: #f8fafc;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.24) 0%, rgba(56, 189, 248, 0.14) 100%);
      border: 1px solid rgba(129, 140, 248, 0.35);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
      white-space: nowrap;
    }

    /* Атмосферный арт героя на верхней карточке Главного Якоря */
    .culprit-atmo-bg {
      position: absolute;
      right: 0;
      top: 0;
      width: 68%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }

    .culprit-atmo-bg img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 22%;
      opacity: 0.25;
      filter: blur(5px) saturate(1.3);
      -webkit-mask-image: radial-gradient(ellipse 90% 90% at 76% 42%, rgba(0, 0, 0, 1) 10%, rgba(0, 0, 0, 0.45) 52%, transparent 82%);
      mask-image: radial-gradient(ellipse 90% 90% at 76% 42%, rgba(0, 0, 0, 1) 10%, rgba(0, 0, 0, 0.45) 52%, transparent 82%);
    }

    /* ИСПРАВЛЕННЫЙ ПОЛНЫЙ ФОН ГЕРОЯ В ДОСЬЕ (#tabPanel-dossier): без резкого обреза на 150px! */
    .dossier-hero-backdrop {
      position: absolute !important;
      right: 0 !important;
      top: 0 !important;
      width: 85% !important;
      height: 380px !important;
      opacity: 1 !important;
      pointer-events: none !important;
      z-index: 0 !important;
      overflow: hidden !important;
      -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.88) 38%, rgba(0,0,0,0.2) 75%, transparent 100%);
      mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.88) 38%, rgba(0,0,0,0.2) 75%, transparent 100%);
    }

    .dossier-hero-backdrop img {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      object-position: 74% 16% !important;
      opacity: 0.32 !important;
      filter: blur(3px) saturate(1.28) contrast(1.05) !important;
      -webkit-mask-image: radial-gradient(ellipse 92% 92% at 76% 22%, rgba(0,0,0,1) 15%, rgba(0,0,0,0.5) 55%, transparent 85%) !important;
      mask-image: radial-gradient(ellipse 92% 92% at 76% 22%, rgba(0,0,0,1) 15%, rgba(0,0,0,0.5) 55%, transparent 85%) !important;
      transform-origin: top right;
    }

    /* Плавная анимация кнопок выбора героев в полосе драфта 5v5 */
    .draft-hero-btn {
      transition:
        transform 0.28s var(--ease-out-expo),
        background-color 0.22s ease,
        border-color 0.22s ease,
        box-shadow 0.28s var(--ease-out-expo) !important;
    }
    .draft-hero-btn:hover {
      transform: translateY(-2px);
    }
    .draft-hero-btn.is-selected {
      transform: translateY(-2px) scale(1.03);
    }

    .nextgen-gauge-ring {
      transition: stroke-dashoffset 1.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .kbd-hint {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.05rem 0.35rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      color: #94a3b8;
      background: rgba(7, 9, 14, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 4px;
      line-height: 1.2;
    }
  `;
  document.head.appendChild(style);
}

// Автоматическая замена кнопки демо-разбора (#9041259372) на лаконичную подсказку
function sanitizeDemoPromptInDom() {
  const demoTriggers = document.querySelectorAll('[onclick*="9041259372"]');
  demoTriggers.forEach((btn) => {
    const parent = btn.parentElement;
    if (parent && (parent.textContent.includes('Нет ID под рукой') || parent.textContent.includes('демо-разбор'))) {
      parent.innerHTML = `
        <span class="inline-flex items-center gap-2 text-xs text-slate-300 bg-[#0d131f]/95 px-3.5 py-1.5 rounded-xl border border-white/[0.08]">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Введите 10-значный ID матча из клиента Dota 2, OpenDota или Dotabuff</span>
          <span class="kbd-hint hidden sm:inline-flex" title="Нажмите / для быстрого фокуса">/</span>
        </span>
      `;
    } else {
      btn.remove();
    }
  });
}

// Легкий и сверхплавный 3D-Tilt (max ~1.5°–2.0° без замыливания шрифтов и без задержки мыши)
function bindSmoothLightTilt() {
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!isFinePointer || typeof gsap === 'undefined') return;

  window.refreshAwwwardsInteractions = function () {
    document.querySelectorAll('[data-tilt]:not([data-smooth-tilt-bound])').forEach((card) => {
      card.setAttribute('data-smooth-tilt-bound', '1');
      card.setAttribute('data-tilt-bound', '1');

      const rawTilt = parseFloat(card.getAttribute('data-tilt')) || 2.5;
      const maxDeg = Math.min(2.0, rawTilt * 0.55);

      const quickRotX = gsap.quickTo(card, 'rotationX', { duration: 0.22, ease: 'power2.out' });
      const quickRotY = gsap.quickTo(card, 'rotationY', { duration: 0.22, ease: 'power2.out' });
      gsap.set(card, { transformPerspective: 1200 });

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
        const relY = (e.clientY - rect.top) / Math.max(1, rect.height);
        card.style.setProperty('--glare-x', `${(relX * 100).toFixed(1)}%`);
        card.style.setProperty('--glare-y', `${(relY * 100).toFixed(1)}%`);

        quickRotY((relX - 0.5) * maxDeg * 2);
        quickRotX((0.5 - relY) * maxDeg * 2);
      }, { passive: true });

      card.addEventListener('mouseleave', () => {
        quickRotX(0);
        quickRotY(0);
      }, { passive: true });
    });

    document.querySelectorAll('[data-magnetic]:not([data-smooth-mag-bound])').forEach((btn) => {
      btn.setAttribute('data-smooth-mag-bound', '1');
      btn.setAttribute('data-mag-bound', '1');
      const strength = Math.min(0.14, (parseFloat(btn.getAttribute('data-magnetic')) || 0.16) * 0.65);

      const quickX = gsap.quickTo(btn, 'x', { duration: 0.18, ease: 'power2.out' });
      const quickY = gsap.quickTo(btn, 'y', { duration: 0.18, ease: 'power2.out' });

      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        quickX((e.clientX - (r.left + r.width / 2)) * strength);
        quickY((e.clientY - (r.top + r.height / 2)) * strength);
      }, { passive: true });

      btn.addEventListener('mouseleave', () => {
        quickX(0);
        quickY(0);
      }, { passive: true });
    });
  };

  window.refreshAwwwardsInteractions();
}

// Глобальный контроллер Spotlight-эффекта и горячих клавиш
function initNextGenInteractions() {
  bindSmoothLightTilt();

  let rafPending = false;
  let lastMoveEvent = null;

  document.addEventListener('mousemove', (e) => {
    lastMoveEvent = e;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (!lastMoveEvent || !lastMoveEvent.target || !lastMoveEvent.target.closest) return;
      const card = lastMoveEvent.target.closest('.pro-subcard');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--spot-x', `${(lastMoveEvent.clientX - rect.left).toFixed(0)}px`);
      card.style.setProperty('--spot-y', `${(lastMoveEvent.clientY - rect.top).toFixed(0)}px`);
    });
  }, { passive: true });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);

    if (e.key === '/' && !isTyping) {
      e.preventDefault();
      const landing = document.getElementById('landingHeroSection');
      const isLandingVisible = landing && !landing.classList.contains('hidden');
      const targetInput = isLandingVisible
        ? (document.getElementById('heroMatchInput') || document.getElementById('matchInput'))
        : (document.getElementById('matchInput') || document.getElementById('heroMatchInput'));
      if (targetInput) {
        targetInput.focus();
        targetInput.select();
      }
      return;
    }

    if (!isTyping && currentAnalysis) {
      const tabMap = { '1': 'dossier', '2': 'chronology', '3': 'versus', '4': 'scoreboard' };
      if (tabMap[e.key]) {
        switchWorkspaceTab(tabMap[e.key]);
      }
    }
  });
}

// Медленная и красивая синхронная анимация счетчика цифр и заполнения кольца SVG (1.35 секунды)
function animateNumbers(containerSelector, durationMs = 1350) {
  const root = containerSelector ? document.querySelector(containerSelector) : document;
  if (!root) return;

  const counters = root.querySelectorAll('[data-count-to]');
  counters.forEach((el) => {
    const target = Number(el.getAttribute('data-count-to')) || 0;
    el.textContent = '0';
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 4);
      el.textContent = Math.round(target * eased);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target;
      }
    }
    requestAnimationFrame(tick);
  });

  const rings = root.querySelectorAll('[data-ring-circumference][data-ring-offset]');
  rings.forEach((ring) => {
    const circumference = parseFloat(ring.getAttribute('data-ring-circumference')) || 0;
    const targetOffset = parseFloat(ring.getAttribute('data-ring-offset')) || 0;

    ring.style.transition = 'none';
    ring.style.strokeDashoffset = `${circumference}`;

    void ring.getBoundingClientRect();
    requestAnimationFrame(() => {
      ring.style.transition = `stroke-dashoffset ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1)`;
      ring.style.strokeDashoffset = `${targetOffset}`;
    });
  });
}

async function ensureBrowserItemsConstants() {
  if (browserItemsConstantsSynced) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const resp = await fetch('https://api.opendota.com/api/constants/items', { signal: controller.signal });
    clearTimeout(timer);
    if (resp.ok) {
      const itemsMap = await resp.json();
      if (typeof registerOpenDotaItemsConstants === 'function') {
        registerOpenDotaItemsConstants(itemsMap);
      }
      browserItemsConstantsSynced = true;
    }
  } catch (_) {}
}

function getHeroImageUrl(heroId, heroNameStr) {
  const slug =
    HERO_SLUG_OVERRIDES[heroId] ||
    String(heroNameStr || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  return `${STEAM_HERO_CDN}/${slug}.png`;
}

function animateProgressBars(containerSelector) {
  if (typeof gsap === 'undefined') return;
  const root = containerSelector ? document.querySelector(containerSelector) : document;
  if (!root) return;
  const bars = root.querySelectorAll('[data-gsap-bar]');
  bars.forEach((bar) => {
    const targetW = bar.getAttribute('data-gsap-bar') || '0%';
    gsap.fromTo(
      bar,
      { width: '0%' },
      { width: targetW, duration: 0.55, ease: 'power3.out', overwrite: 'auto' }
    );
  });
}

function triggerHooksRefresh() {
  if (typeof window.refreshAwwwardsInteractions === 'function') {
    window.refreshAwwwardsInteractions();
  }
}

// Кнопка запроса парсинга матча в OpenDota (Honorable Mention)
async function handleRequestOpenDotaParse(matchId) {
  const btn = document.getElementById('requestParseBtn');
  const statusEl = document.getElementById('requestParseStatusText');
  if (!matchId) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Отправка запроса в OpenDota...</span>';
  }

  try {
    let res = null;
    if (typeof requestOpenDotaMatchParse === 'function') {
      res = await requestOpenDotaMatchParse(matchId);
    } else {
      const resp = await fetch(`https://api.opendota.com/api/request/${encodeURIComponent(matchId)}`, { method: 'POST' });
      const data = resp.ok ? await resp.json() : null;
      res = { ok: resp.ok, jobId: data && data.job ? data.job.jobId : null };
    }

    if (res && res.ok) {
      if (btn) {
        btn.innerHTML = `<span>✓ Запрос отправлен ${res.jobId ? `(Job #${res.jobId})` : ''} — перепроверьте через 1–2 мин</span>`;
        btn.className = 'w-full mt-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 cursor-default';
      }
      if (statusEl) {
        statusEl.textContent = 'OpenDota скачивает реплей. Нажмите «Проверить» повторно через 1–2 минуты для 100% точности.';
      }
    } else {
      throw new Error('OpenDota отклонил запрос');
    }
  } catch (_) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🔄 Повторить запрос парсинга реплея</span>';
    }
  }
}

// Круговой SVG-индикатор Индекса Руина (с анимацией заполнения кольца с 0)
function renderRadialGauge(score, ruinType = '', compact = false) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const strokeColor = clamped >= 55 ? '#f43f5e' : clamped >= 25 ? '#f59e0b' : '#10b981';
  const glowClass = clamped >= 55 ? 'radial-crimson-glow' : clamped >= 25 ? 'radial-amber-glow' : 'radial-emerald-glow';
  const textColor = clamped >= 55 ? 'text-rose-400' : clamped >= 25 ? 'text-amber-400' : 'text-emerald-400';

  if (compact) {
    const size = 72;
    const r = 28;
    const c = 2 * Math.PI * r;
    const offset = c - (clamped / 100) * c;
    return `
      <div class="flex items-center gap-3 bg-[#080b11]/90 px-3.5 py-2 rounded-xl border border-white/[0.1] shadow-md">
        <div class="relative w-[64px] h-[64px] flex items-center justify-center shrink-0">
          <svg viewBox="0 0 ${size} ${size}" class="w-full h-full -rotate-90">
            <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6" />
            <circle
              cx="${size / 2}"
              cy="${size / 2}"
              r="${r}"
              fill="none"
              stroke="${strokeColor}"
              stroke-width="6"
              stroke-linecap="round"
              stroke-dasharray="${c.toFixed(1)}"
              stroke-dashoffset="${c.toFixed(1)}"
              data-ring-circumference="${c.toFixed(1)}"
              data-ring-offset="${offset.toFixed(1)}"
              class="nextgen-gauge-ring ${glowClass}"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span data-count-to="${clamped}" class="font-mono text-base font-extrabold ${textColor}">0</span>
            <span class="font-mono text-[9px] text-slate-400">/100</span>
          </div>
        </div>
        <div class="hidden sm:block">
          <div class="text-[10px] font-display uppercase tracking-wider text-slate-300 font-bold">Индекс вины</div>
          <div class="text-xs font-display font-bold text-white mt-0.5">${ruinType}</div>
        </div>
      </div>
    `;
  }

  const size = 148;
  const r = 56;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return `
    <div class="flex flex-col items-center justify-center bg-[#080b11]/85 px-6 py-4 rounded-2xl border border-white/[0.12] shadow-xl shrink-0 self-start lg:self-center">
      <div class="text-[10px] font-display uppercase tracking-widest text-slate-300 font-bold mb-1.5">Индекс Руина</div>
      <div class="relative w-[132px] h-[132px] flex items-center justify-center">
        <svg viewBox="0 0 ${size} ${size}" class="w-full h-full -rotate-90">
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="10" />
          <circle
            cx="${size / 2}"
            cy="${size / 2}"
            r="${r}"
            fill="none"
            stroke="${strokeColor}"
            stroke-width="10"
            stroke-linecap="round"
            stroke-dasharray="${c.toFixed(1)}"
            stroke-dashoffset="${c.toFixed(1)}"
            data-ring-circumference="${c.toFixed(1)}"
            data-ring-offset="${offset.toFixed(1)}"
            class="nextgen-gauge-ring ${glowClass}"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <div data-count-to="${clamped}" class="font-mono text-3xl sm:text-4xl font-extrabold ${textColor} tracking-tight">0</div>
          <div class="font-mono text-[11px] text-slate-400 font-semibold mt-1">/ 100</div>
        </div>
      </div>
      <div class="font-display text-xs font-bold uppercase tracking-wider ${textColor} mt-2 text-center">${ruinType}</div>
    </div>
  `;
}

function renderHeroChip(heroName, extraText = '') {
  if (!heroName) return '';
  const suffix = extraText ? ` <span class="text-slate-300 font-normal">${extraText}</span>` : '';
  return `<span class="hero-name-chip">${heroName}${suffix}</span>`;
}

function formatRichHeroMentions(rawText) {
  if (!rawText) return '';
  let text = String(rawText);

  if (currentAnalysis && Array.isArray(currentAnalysis.players)) {
    for (const p of currentAnalysis.players) {
      const pName = String(p.personaname || '').trim();
      const hName = String(p.hero_name || '').trim();
      if (!pName || !hName) continue;

      const escapedP = pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedH = hName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const withMetaRegex = new RegExp(`${escapedP}\\s*\\(${escapedH},\\s*([^)]+)\\)`, 'g');
      text = text.replace(
        withMetaRegex,
        `<strong class="text-white font-semibold">${pName}</strong> <span class="hero-name-chip">${hName}</span> <span class="font-mono text-[11px] text-slate-300">[$1]</span>`
      );

      const exactPairRegex = new RegExp(`${escapedP}\\s*\\(${escapedH}\\)`, 'g');
      text = text.replace(
        exactPairRegex,
        `<strong class="text-white font-semibold">${pName}</strong> <span class="hero-name-chip">${hName}</span>`
      );
    }

    const allHeroNames = [...new Set(currentAnalysis.players.map(p => p.hero_name).filter(Boolean))]
      .sort((a, b) => b.length - a.length);

    for (const hName of allHeroNames) {
      const escapedH = hName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cdRegex = new RegExp(`(?<!>)\\b${escapedH}\\s*\\(([^)]+в КД[^)]*)\\)`, 'g');
      text = text.replace(
        cdRegex,
        `<span class="hero-name-chip">${hName}</span> <span class="font-mono text-[11px] text-amber-300 font-semibold">($1)</span>`
      );
      const trackRegex = new RegExp(`(?<!>)\\b${escapedH}\\s*\\(Track\\)`, 'g');
      text = text.replace(
        trackRegex,
        `<span class="hero-name-chip">${hName} · Track</span>`
      );
    }
  }

  return text;
}

function renderInventoryIcons(inventoryList, small = false) {
  const slots = Array.isArray(inventoryList) ? inventoryList : [];
  if (slots.length === 0) {
    return `<span class="text-[11px] text-rose-300 font-semibold px-2 py-0.5 rounded bg-rose-950/60 border border-rose-700/50">Пустой инвентарь</span>`;
  }
  const sizeCls = small ? 'w-8 h-6 rounded' : 'w-11 h-8 rounded-md';
  return slots.map(item => {
    const imgSrc = item.img || (item.slug ? `${STEAM_ITEM_CDN}/${item.slug}.png` : null);
    const safeName = String(item.name || `Предмет #${item.id}`).replace(/"/g, '&quot;').replace(/'/g, '');
    const timingTooltip = item.timingNote
      ? ` • ${String(item.timingNote).replace(/"/g, '&quot;').replace(/'/g, '')}`
      : (item.boughtAt ? ` • Куплен на ${item.boughtAt}` : '');
    const fullTitle = `${safeName} (~${item.cost} золота)${timingTooltip}`;

    const isCritical = item.timingStatus === 'critical_late' || item.timingStatus === 'useless';
    const isWarn = item.timingStatus === 'late';
    const borderCls = isCritical
      ? 'border-rose-500 ring-1 ring-rose-500/60'
      : isWarn
        ? 'border-amber-400/90'
        : 'border-white/15';

    const badgeOverlay = item.boughtAtMin ? `
      <span class="absolute -bottom-1 right-0 px-1 py-[1px] text-[8px] leading-none font-mono font-bold rounded-tl rounded-br ${
        isCritical
          ? 'bg-rose-600 text-white'
          : isWarn
            ? 'bg-amber-400 text-slate-950'
            : 'bg-slate-950/95 text-slate-200 border-t border-l border-white/15'
      }">
        ${item.boughtAtMin}${isCritical ? '!' : ''}
      </span>
    ` : '';

    if (imgSrc) {
      return `
        <div class="relative inline-flex shrink-0 group/item" title="${fullTitle}">
          <img src="${imgSrc}" alt="${safeName}" class="${sizeCls} object-cover border ${borderCls} bg-slate-950 shrink-0 group-hover/item:scale-105 transition" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline-flex';" />
          <span style="display:none" class="${sizeCls} items-center justify-center bg-slate-800 border border-slate-700 text-[9px] font-mono text-slate-200 shrink-0">#${item.id}</span>
          ${badgeOverlay}
        </div>
      `;
    }
    return `<span title="${fullTitle}" class="${sizeCls} inline-flex items-center justify-center bg-slate-800 border border-slate-700 text-[9px] font-mono text-slate-200 shrink-0">#${item.id}</span>`;
  }).join('');
}

function getSemanticBadgeStyle(name) {
  const str = String(name || '');
  if (str === 'Боец до последнего') {
    return {
      cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/35',
      icon: '🔥',
      hint: 'Высокий боевой вклад в драках и по урону за весь матч'
    };
  }
  if (
    str.includes('Лесник (Pos 6)') ||
    str.startsWith('Поздний BKB') ||
    str.startsWith('Без BKB') ||
    str.startsWith('Без Nullifier') ||
    str.startsWith('Без MKB') ||
    str.startsWith('Без Break') ||
    str.startsWith('Без анти-хила') ||
    str.startsWith('Без AoE') ||
    str.startsWith('Руин-билд') ||
    str === 'Раскормил врага' ||
    str === 'Саппорт без сейв-слотов' ||
    str === 'Умер в стане с БКБ' ||
    str === 'Разбил шмотки' ||
    str === 'Жертва без байбека'
  ) {
    return {
      cls: 'bg-rose-500/15 text-rose-200 border-rose-500/35',
      icon: (str.includes('BKB') || str.includes('Nullifier') || str.includes('MKB') || str.includes('Break') || str.includes('хила') || str.includes('AoE') || str.includes('сейв')) ? '🤖' : '🚨',
      hint: str
    };
  }
  return {
    cls: 'bg-white/[0.07] text-slate-200 border-white/[0.15]',
    icon: '•',
    hint: str
  };
}

function renderBadgePills(badges, compact = false) {
  if (!Array.isArray(badges) || badges.length === 0) return '';
  return badges.map(name => {
    const st = getSemanticBadgeStyle(name);
    if (compact) {
      return `<span title="${st.hint}" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${st.cls}">${st.icon} ${name}</span>`;
    }
    return `<span title="${st.hint}" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${st.cls}">${st.icon} <span>${name}</span></span>`;
  }).join('');
}

function scoreBadgeColor(score) {
  if (score >= 60) return 'bg-rose-500/20 text-rose-200 border-rose-500/40';
  if (score >= 35) return 'bg-amber-500/20 text-amber-200 border-amber-500/40';
  if (score >= 15) return 'bg-slate-800/90 text-slate-100 border-white/15';
  return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30';
}

function toggleHelpModal() {
  const modal = document.getElementById('helpModal');
  if (!modal) return;
  const isOpening = modal.classList.contains('hidden');
  modal.classList.toggle('hidden');
  if (isOpening && typeof gsap !== 'undefined') {
    gsap.fromTo(
      modal.firstElementChild,
      { scale: 0.94, opacity: 0, y: 12 },
      { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }
    );
  }
}

function switchWorkspaceTab(tabName) {
  activeWorkspaceTab = tabName;
  const tabs = ['dossier', 'chronology', 'versus', 'scoreboard'];
  for (const t of tabs) {
    const btn = document.getElementById(`tabBtn-${t}`);
    const panel = document.getElementById(`tabPanel-${t}`);
    if (btn) {
      btn.className = `font-display uppercase tracking-wider px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold border transition flex items-center gap-2 ${
        t === tabName ? 'tab-btn-active' : 'tab-btn-inactive'
      }`;
    }
    if (panel) {
      const wasHidden = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', t !== tabName);
      if (t === tabName && wasHidden && typeof gsap !== 'undefined') {
        gsap.fromTo(
          panel,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.38, ease: 'power2.out' }
        );
        animateProgressBars(`#tabPanel-${t}`);
      }
    }
  }
}

function setReasonFilter(filterVal) {
  activeReasonFilter = filterVal;
  for (const k of ['all', 'penalties', 'bonuses']) {
    const btn = document.getElementById(`reasonFilter-${k}`);
    if (btn) {
      btn.className = k === filterVal
        ? 'px-2.5 py-1 rounded-md font-semibold bg-[#1b2333] text-white'
        : 'px-2.5 py-1 rounded-md font-medium text-slate-300 hover:text-white';
    }
  }
  if (currentAnalysis) renderInspectorReasonsList(currentAnalysis);
}

function setTableFilter(filterVal) {
  activeTableFilter = filterVal;
  for (const k of ['all', 'radiant', 'dire', 'cores', 'supports']) {
    const btn = document.getElementById(`tableFilter-${k}`);
    if (btn) {
      btn.className = k === filterVal
        ? 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1b2333] text-white border border-white/20'
        : 'px-3 py-1.5 rounded-lg text-xs font-medium bg-[#121824] text-slate-300 border border-white/[0.08] hover:bg-[#1b2333]';
    }
  }
  if (currentAnalysis) renderScoreboard(currentAnalysis);
}

function saveRecentMatch(data) {
  try {
    const raw = localStorage.getItem('d2_recent_matches_v5');
    const list = raw ? JSON.parse(raw) : [];
    const c = data.verdict.culprit;
    const entry = {
      id: String(data.match_id),
      hero: c.hero_name,
      name: c.personaname,
      score: c.scores.total
    };
    const filtered = list.filter(x => x.id !== entry.id);
    filtered.unshift(entry);
    localStorage.setItem('d2_recent_matches_v5', JSON.stringify(filtered.slice(0, 6)));
    renderRecentMatches();
  } catch (_) {}
}

function renderRecentMatches() {
  const container = document.getElementById('recentMatchesRow');
  const heroBox = document.getElementById('heroRecentMatchesBox');
  try {
    const raw = localStorage.getItem('d2_recent_matches_v5');
    const list = raw ? JSON.parse(raw) : [];
    if (list.length === 0) {
      if (container) {
        container.innerHTML = `<span class="text-slate-400">Введите 10-значный ID матча Dota 2 (из клиента игры, OpenDota или Dotabuff)</span>`;
      }
      if (heroBox) heroBox.innerHTML = '';
      return;
    }
    const buttonsHtml = list.map(m => `
      <button
        type="button"
        data-cursor="ЗАГРУЗИТЬ"
        onclick="quickLoadMatch('${m.id}')"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121824] hover:bg-[#1b2436] border border-white/[0.1] hover:border-white/25 text-[11px] text-slate-200 transition shadow-sm"
      >
        <span class="font-mono text-white font-semibold">#${m.id}</span>
        <span class="hero-name-chip">${m.hero}</span>
        <span class="font-mono font-bold ${m.score >= 50 ? 'text-rose-400' : m.score >= 25 ? 'text-amber-400' : 'text-emerald-400'}">${m.score}</span>
      </button>
    `).join('');

    if (container) {
      container.innerHTML = `<span class="text-slate-400 mr-1 font-medium">Недавние матчи:</span>${buttonsHtml}`;
    }
    if (heroBox) {
      heroBox.innerHTML = `<span class="text-slate-400 mr-1 font-medium">Недавно проверенные:</span>${buttonsHtml}`;
    }
  } catch (_) {}
}

function showLandingScreen() {
  const landing = document.getElementById('landingHeroSection');
  const verdict = document.getElementById('verdictSection');
  const backBtn = document.getElementById('backToHomeBtn');
  const errorBox = document.getElementById('errorBox');
  if (landing) landing.classList.remove('hidden');
  if (verdict) verdict.classList.add('hidden');
  if (backBtn) backBtn.classList.add('hidden');
  if (errorBox) errorBox.classList.add('hidden');
  const heroInput = document.getElementById('heroMatchInput');
  if (heroInput) heroInput.focus();
  if (landing && typeof gsap !== 'undefined') {
    gsap.fromTo(landing, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
  }
}

function quickLoadMatch(id) {
  const input = document.getElementById('matchInput');
  const heroInput = document.getElementById('heroMatchInput');
  if (input) input.value = id;
  if (heroInput) heroInput.value = id;
  handleSearch();
}

function handleHeroSearch(e) {
  if (e) e.preventDefault();
  const heroInput = document.getElementById('heroMatchInput');
  const headerInput = document.getElementById('matchInput');
  if (heroInput && headerInput) {
    headerInput.value = heroInput.value;
  }
  handleSearch();
}

async function fetchAnalysis(matchId) {
  const rawInput = String(matchId || '').trim();
  const digitMatch = rawInput.match(/\d{5,15}/);
  const cleanId = digitMatch ? digitMatch[0] : rawInput;
  if (!cleanId || !/^\d{5,15}$/.test(cleanId)) {
    throw new Error('Пожалуйста, введите корректный ID матча из цифр (например, из истории матчей Dota 2) или ссылку на матч.');
  }

  if (window.module && window.module.exports) {
    Object.assign(window, window.module.exports);
  }

  ensureBrowserItemsConstants();

  if (window.location.protocol.startsWith('http')) {
    try {
      const resp = await fetch(`/api/analyze/${encodeURIComponent(cleanId)}`);
      if (resp.ok) return await resp.json();
    } catch (_) {}
  }

  let rawMatch = null;
  let sourceType = 'opendota_direct';
  try {
    const odResp = await fetch(`https://api.opendota.com/api/matches/${encodeURIComponent(cleanId)}`);
    if (odResp.ok) {
      rawMatch = await odResp.json();
    }
  } catch (_) {}

  if (typeof fetchStratzMatchAndEnrich === 'function') {
    try {
      const enriched = await fetchStratzMatchAndEnrich(cleanId, rawMatch, { timeoutMs: 3500 });
      if (enriched) {
        if (!rawMatch) sourceType = 'stratz_direct';
        else if (enriched.stratz_enriched) sourceType = 'opendota_plus_stratz';
        rawMatch = enriched;
      }
    } catch (_) {}
  }

  if (!rawMatch && typeof DEMO_MATCHES !== 'undefined' && DEMO_MATCHES[cleanId] && typeof analyzeMatch === 'function') {
    return { source: 'cached_match', ...analyzeMatch(DEMO_MATCHES[cleanId]) };
  }

  if (!rawMatch) {
    throw new Error(`Матч #${cleanId} не найден в базе OpenDota и STRATZ API. Проверьте правильность ID матча.`);
  }

  if (typeof syncDotaConstantsAndMeta === 'function' && Array.isArray(rawMatch.players)) {
    try {
      await syncDotaConstantsAndMeta(rawMatch.players, { timeoutMs: 2500 });
    } catch (_) {}
  }

  let analyzed;
  if (typeof analyzeMatchWithLlm === 'function') {
    analyzed = await analyzeMatchWithLlm(rawMatch, { timeoutMs: 2500, enrichWithStratz: false });
  } else if (typeof analyzeMatch === 'function') {
    analyzed = analyzeMatch(rawMatch);
  } else {
    throw new Error('Файл analyzer.js не загружен или не найден в папке со страницей.');
  }

  return { source: sourceType, ...analyzed };
}

async function handleSearch(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('matchInput');
  const heroInput = document.getElementById('heroMatchInput');
  const queryVal = (input && input.value.trim()) || (heroInput && heroInput.value.trim()) || '';
  if (input) input.value = queryVal;
  if (heroInput) heroInput.value = queryVal;

  const errorBox = document.getElementById('errorBox');
  const btn = document.getElementById('analyzeBtn');
  const heroBtn = document.getElementById('heroAnalyzeBtn');

  if (errorBox) errorBox.classList.add('hidden');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Анализ...</span>';
  }
  if (heroBtn) {
    heroBtn.disabled = true;
    heroBtn.innerHTML = '<span>⏳ Загрузка и ИИ-аудит матча...</span>';
  }

  try {
    const result = await fetchAnalysis(queryVal);
    currentAnalysis = result;
    selectedSlot = result.verdict.culprit.player_slot;
    saveRecentMatch(result);
    renderDashboard(result);
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message || 'Не удалось загрузить матч. Проверьте номер матча.';
      errorBox.classList.remove('hidden');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Проверить</span>';
    }
    if (heroBtn) {
      heroBtn.disabled = false;
      heroBtn.innerHTML = '<span>Проанализировать матч →</span>';
    }
  }
}

function selectPlayer(slot, switchToDossier = false) {
  const isNewHero = selectedSlot !== slot;
  selectedSlot = slot;
  if (switchToDossier && activeWorkspaceTab !== 'dossier') {
    switchWorkspaceTab('dossier');
  }
  if (currentAnalysis) {
    renderHeroDraftStrip(currentAnalysis);
    renderInspector(currentAnalysis, isNewHero);
    renderLeaderboard(currentAnalysis);
    renderScoreboard(currentAnalysis);
    triggerHooksRefresh();
  }
}

function copyMatchReport() {
  if (!currentAnalysis) return;
  const d = currentAnalysis;
  const c = d.verdict.culprit;
  const topReasons = c.reasons
    .filter(r => r.points > 0)
    .slice(0, 3)
    .map(r => `• [${r.timestamp}] ${r.title} (+${r.points})`)
    .join('\n');
  const baLine = c.build_audit && c.build_audit.verdictStatus !== 'good'
    ? `\n🛠️ Билд: ${c.build_audit.headline}`
    : '';
  const text = [
    `📊 Dota 2 Ruin Detector • Матч #${d.match_id} (${d.duration_formatted})`,
    `🏆 Победа: ${d.radiant_win ? 'Radiant' : 'Dire'} (${d.radiant_score}:${d.dire_score})`,
    `⚓ Главный виновник: ${c.personaname} [${c.hero_name} • ${c.role}] — ${c.scores.total}/100 очков вины`,
    `💥 Вердикт: ${c.shortVerdict}${baLine}`,
    topReasons ? `\nКлючевые улики:\n${topReasons}` : ''
  ].filter(Boolean).join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  const toast = document.getElementById('copyToast');
  if (toast) {
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2800);
  }
}

function renderHeroDraftStrip(data) {
  const strip = document.getElementById('heroDraftStrip');
  if (!strip) return;

  const radHeader = document.getElementById('draftRadiantHeader');
  const direHeader = document.getElementById('draftDireHeader');
  if (radHeader) radHeader.innerHTML = `🟢 Radiant (<span class="font-mono">${data.radiant_score}</span>) ${data.radiant_win ? '• ПОБЕДА' : ''}`;
  if (direHeader) direHeader.innerHTML = `🔴 Dire (<span class="font-mono">${data.dire_score}</span>) ${!data.radiant_win ? '• ПОБЕДА' : ''}`;

  const radPlayers = data.players.filter(p => p.isRadiant);
  const direPlayers = data.players.filter(p => !p.isRadiant);

  const renderMiniHeroBtn = (p) => {
    const active = p.player_slot === selectedSlot;
    const score = p.scores.total;
    const roleMeta = ROLE_EMOJI_MAP[p.position] || { icon: '🎮', short: p.position, label: p.role };
    const scoreCls = score >= 60
      ? 'bg-rose-500 text-white shadow-sm shadow-rose-950'
      : score >= 35
        ? 'bg-amber-400 text-slate-950 font-black'
        : 'bg-[#07090e]/95 text-slate-100 border border-white/15';

    const borderActive = active
      ? (p.isRadiant
          ? 'is-selected bg-gradient-to-b from-emerald-950/80 to-[#162030] border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-950/50'
          : 'is-selected bg-gradient-to-b from-rose-950/80 to-[#162030] border-rose-400 ring-2 ring-rose-400/40 shadow-lg shadow-rose-950/50')
      : 'bg-[#121824]/90 border-white/[0.09] hover:bg-[#192233] hover:border-white/25';

    return `
      <button
        onclick="selectPlayer(${p.player_slot}, true)"
        data-cursor="${p.hero_name}"
        title="${p.personaname} • ${p.hero_name} (${roleMeta.label}) • KDA ${p.stats.kills}/${p.stats.deaths}/${p.stats.assists} • Вина: ${score}/100"
        class="draft-hero-btn group relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border ${borderActive}"
      >
        <div class="relative shrink-0">
          <img
            src="${getHeroImageUrl(p.hero_id, p.hero_name)}"
            alt="${p.hero_name}"
            class="w-14 h-8 sm:w-16 sm:h-9 rounded-lg object-cover border border-white/15 shadow-sm group-hover:scale-[1.04] transition"
            onerror="this.style.display='none'"
          />
          <span
            title="${roleMeta.label}"
            class="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-md bg-[#07090e]/95 border border-white/20 text-[10px] font-mono font-bold text-slate-100 leading-none flex items-center gap-0.5 shadow"
          >
            <span>${roleMeta.icon}</span><span>${roleMeta.short}</span>
          </span>
        </div>

        <div class="flex flex-col items-end justify-center shrink-0">
          <span class="text-xs font-mono font-extrabold px-2 py-1 rounded-lg ${scoreCls}">
            ${score}
          </span>
        </div>
      </button>
    `;
  };

  strip.innerHTML = `
    <div class="lg:col-span-5 grid grid-cols-5 gap-2">
      ${radPlayers.map(renderMiniHeroBtn).join('')}
    </div>
    <div class="lg:col-span-1 flex items-center justify-center py-1 lg:py-0">
      <span class="text-[11px] font-mono font-black text-slate-300 px-2.5 py-1 rounded-lg bg-[#121824] border border-white/[0.1]">5 VS 5</span>
    </div>
    <div class="lg:col-span-5 grid grid-cols-5 gap-2">
      ${direPlayers.map(renderMiniHeroBtn).join('')}
    </div>
  `;
}

function renderWidescreenSidebars(data) {
  const radPlayers = data.players.filter(p => p.isRadiant);
  const direPlayers = data.players.filter(p => !p.isRadiant);

  const sumBy = (arr, fn) => arr.reduce((acc, x) => acc + (Number(fn(x)) || 0), 0);

  const radNw = sumBy(radPlayers, p => p.stats.net_worth);
  const direNw = sumBy(direPlayers, p => p.stats.net_worth);
  const radDmg = sumBy(radPlayers, p => p.stats.hero_damage);
  const direDmg = sumBy(direPlayers, p => p.stats.hero_damage);
  const radTowers = sumBy(radPlayers, p => p.tower_damage);
  const direTowers = sumBy(direPlayers, p => p.tower_damage);
  const radWards = sumBy(radPlayers, p => p.wards_placed);
  const direWards = sumBy(direPlayers, p => p.wards_placed);
  const radAvgRuin = Math.round(sumBy(radPlayers, p => p.scores.total) / Math.max(1, radPlayers.length));
  const direAvgRuin = Math.round(sumBy(direPlayers, p => p.scores.total) / Math.max(1, direPlayers.length));

  const topDmgPlayer = [...data.players].sort((a, b) => b.stats.hero_damage - a.stats.hero_damage)[0];
  const topTowerPlayer = [...data.players].sort((a, b) => b.tower_damage - a.tower_damage)[0];
  const turningEvent = (data.chronology || []).find(e => e.tag.includes('ПЕРЕЛОМ')) || (data.chronology || [])[1] || (data.chronology || [])[0];

  const unparsedWarningHtml = !data.is_parsed ? `
    <div class="p-3 rounded-xl bg-amber-950/35 border border-amber-500/40 space-y-1.5">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[10px] font-display uppercase tracking-wider font-bold text-amber-300">⚠ Матч не распарсен в OpenDota</span>
      </div>
      <p id="requestParseStatusText" class="text-[11px] text-slate-200 leading-snug">
        Без парсинга реплея недоступны логи тимфайтов (кто какие кнопки нажал в замесе) и точные варды, поэтому сложнее со 100% точностью назвать виновного.
      </p>
      <button
        id="requestParseBtn"
        type="button"
        onclick="handleRequestOpenDotaParse('${data.match_id}')"
        class="w-full mt-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/45 transition flex items-center justify-center gap-1.5"
      >
        <span>⚡ Запросить парсинг реплея в OpenDota</span>
      </button>
    </div>
  ` : '';

  const highlightsEl = document.getElementById('matchQuickHighlightsCard');
  if (highlightsEl) {
    highlightsEl.innerHTML = `
      <div class="space-y-3 relative z-10">
        <div class="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
          <div>
            <span class="text-[10px] uppercase tracking-wider font-bold text-slate-300">Ключевые показатели катки</span>
            <h3 class="text-sm sm:text-base font-bold text-white mt-0.5 uppercase">Сводный радар матча</h3>
          </div>
          <span class="text-[11px] font-mono ${data.is_parsed ? 'text-emerald-300 border-emerald-500/35' : 'text-amber-300 border-amber-500/35'} bg-[#121824] px-2.5 py-0.5 rounded border">
            ${data.is_parsed ? '✓ Полный лог реплея' : '⚠ Базовый лог API'}
          </span>
        </div>

        ${unparsedWarningHtml}

        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2.5">
          <div onclick="selectPlayer(${topDmgPlayer.player_slot}, true)" class="cursor-pointer p-3 rounded-xl pro-subcard hover:border-white/25 transition flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <img src="${getHeroImageUrl(topDmgPlayer.hero_id, topDmgPlayer.hero_name)}" alt="" class="w-10 h-6 rounded object-cover border border-white/15 shrink-0" onerror="this.style.display='none'" />
              <div class="truncate">
                <div class="text-[10px] uppercase tracking-wider font-bold text-emerald-400">🔥 Топ-1 по урону в матче</div>
                <div class="text-xs font-bold text-white truncate flex items-center gap-1.5 mt-0.5">
                  <span class="truncate">${topDmgPlayer.personaname}</span>
                  ${renderHeroChip(topDmgPlayer.hero_name)}
                </div>
              </div>
            </div>
            <span class="font-mono text-xs font-bold text-slate-100 shrink-0">${topDmgPlayer.stats.hero_damage.toLocaleString('ru-RU')}</span>
          </div>

          <div onclick="selectPlayer(${topTowerPlayer.player_slot}, true)" class="cursor-pointer p-3 rounded-xl pro-subcard hover:border-white/25 transition flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <img src="${getHeroImageUrl(topTowerPlayer.hero_id, topTowerPlayer.hero_name)}" alt="" class="w-10 h-6 rounded object-cover border border-white/15 shrink-0" onerror="this.style.display='none'" />
              <div class="truncate">
                <div class="text-[10px] uppercase tracking-wider font-bold text-sky-400">🏰 Главный снос строений</div>
                <div class="text-xs font-bold text-white truncate flex items-center gap-1.5 mt-0.5">
                  <span class="truncate">${topTowerPlayer.personaname}</span>
                  ${renderHeroChip(topTowerPlayer.hero_name)}
                </div>
              </div>
            </div>
            <span class="font-mono text-xs font-bold text-slate-100 shrink-0">${topTowerPlayer.tower_damage.toLocaleString('ru-RU')}</span>
          </div>
        </div>

        ${turningEvent ? `
          <div onclick="switchWorkspaceTab('chronology')" class="cursor-pointer p-3 rounded-xl bg-[#121824] border border-white/[0.1] border-l-2 border-l-amber-400 hover:bg-[#172030] transition space-y-1">
            <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-300">
              <span>⚡ Переломный момент игры</span>
              <span class="font-mono text-slate-200">${turningEvent.time} →</span>
            </div>
            <div class="text-xs font-semibold text-white line-clamp-2 leading-snug">
              ${formatRichHeroMentions(turningEvent.title)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  const radarEl = document.getElementById('teamMacroRadarBody');
  if (radarEl) {
    const radarMetrics = [
      { label: 'Фраги (Счет)', rad: data.radiant_score, dire: data.dire_score, fmt: v => v },
      { label: 'Общая ценность (NW)', rad: radNw, dire: direNw, fmt: v => `${(v / 1000).toFixed(1)}k` },
      { label: 'Урон по героям', rad: radDmg, dire: direDmg, fmt: v => `${(v / 1000).toFixed(1)}k` },
      { label: 'Урон по вышкам', rad: radTowers, dire: direTowers, fmt: v => v.toLocaleString('ru-RU') },
      { label: 'Поставлено вардов', rad: radWards, dire: direWards, fmt: v => v },
      { label: 'Средний балл вины', rad: radAvgRuin, dire: direAvgRuin, fmt: v => `${v}/100`, invert: true }
    ];

    radarEl.innerHTML = radarMetrics.map(m => {
      const total = Math.max(1, m.rad + m.dire);
      const radPct = Math.round((m.rad / total) * 100);
      const direPct = 100 - radPct;
      return `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-mono font-bold text-emerald-400">${m.fmt(m.rad)}</span>
            <span class="text-[11px] text-slate-300 font-medium">${m.label}</span>
            <span class="font-mono font-bold text-rose-400">${m.fmt(m.dire)}</span>
          </div>
          <div class="w-full h-1.5 bg-[#07090e] rounded-full overflow-hidden flex">
            <div class="bg-emerald-500/90 h-full transition-all" style="width: ${radPct}%"></div>
            <div class="bg-rose-500/90 h-full transition-all" style="width: ${direPct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  const matchupsEl = document.getElementById('laneMatchupsSidebar');
  if (matchupsEl) {
    const positions = [1, 2, 3, 4, 5];
    matchupsEl.innerHTML = positions.map(pos => {
      const rP = radPlayers.find(p => p.position === pos) || radPlayers[pos - 1] || radPlayers[0];
      const dP = direPlayers.find(p => p.position === pos) || direPlayers[pos - 1] || direPlayers[0];
      const roleMeta = ROLE_EMOJI_MAP[pos];
      return `
        <button
          onclick="setVersusByRole(${pos}); switchWorkspaceTab('versus');"
          class="w-full p-2.5 rounded-xl pro-subcard hover:bg-[#182030] hover:border-white/20 transition flex items-center justify-between gap-2 text-left"
        >
          <div class="flex items-center gap-2 min-w-0">
            <img src="${getHeroImageUrl(rP.hero_id, rP.hero_name)}" alt="" class="w-8 h-5 rounded object-cover border border-emerald-500/40 shrink-0" onerror="this.style.display='none'" />
            <span class="hero-name-chip">${rP.hero_name}</span>
          </div>
          <span class="text-[10px] font-mono text-slate-300 font-semibold shrink-0">${roleMeta.icon} Pos ${pos}</span>
          <div class="flex items-center gap-2 min-w-0 justify-end">
            <span class="hero-name-chip">${dP.hero_name}</span>
            <img src="${getHeroImageUrl(dP.hero_id, dP.hero_name)}" alt="" class="w-8 h-5 rounded object-cover border border-rose-500/40 shrink-0" onerror="this.style.display='none'" />
          </div>
        </button>
      `;
    }).join('');
  }
}

function renderDashboard(data) {
  const landingEl = document.getElementById('landingHeroSection');
  if (landingEl) landingEl.classList.add('hidden');
  const backBtn = document.getElementById('backToHomeBtn');
  if (backBtn) backBtn.classList.remove('hidden');
  const verdictSec = document.getElementById('verdictSection');
  if (verdictSec) verdictSec.classList.remove('hidden');

  const vc = document.getElementById('verdictCard');
  const c = data.verdict.culprit;
  const closeRuiner = data.verdict.close_ruiner;
  const scoreGap = data.verdict.score_gap ?? 0;
  const isExplicit = c.scores.sabotage >= 55 && c.scores.total >= 50;
  const hasRealRuiner = c.scores.total >= 25;

  const bannerCls = isExplicit
    ? 'verdict-banner-ruin'
    : hasRealRuiner
      ? 'verdict-banner-anchor'
      : 'verdict-banner-clean';

  const statusPill = isExplicit
    ? `<span class="font-display px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-rose-500/25 text-rose-200 border border-rose-500/45">🚨 Явный саботаж</span>`
    : hasRealRuiner
      ? `<span class="font-display px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-500/25 text-amber-200 border border-amber-500/45">⚓ Главный якорь матча</span>`
      : `<span class="font-display px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-500/25 text-emerald-200 border border-emerald-500/45">✅ Чистая игра</span>`;

  const topReasons = c.reasons.filter(r => r.points > 0).sort((a, b) => b.points - a.points).slice(0, 3);
  const topFactsHtml = topReasons.length > 0 ? `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
      ${topReasons.map(r => `
        <div class="p-3 rounded-xl bg-[#0e1420]/85 border border-white/[0.1] border-l-2 border-l-rose-500 flex flex-col justify-between gap-1 backdrop-blur-md">
          <div class="flex items-center justify-between gap-2">
            <span class="font-display text-[10px] font-bold uppercase tracking-wider text-slate-300">${r.category} • <span class="font-mono text-slate-200">${r.timestamp}</span></span>
            <span class="font-mono text-xs font-bold text-rose-400">+${r.points}</span>
          </div>
          <div class="text-xs font-bold text-white leading-snug">${formatRichHeroMentions(r.title)}</div>
          <div class="text-[11px] font-mono text-slate-300 truncate">
            ${r.shortPill || ''}
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const nearRuinerHtml = (closeRuiner && closeRuiner.scores.total >= 20) ? `
    <div class="pt-3.5 mt-3.5 border-t border-white/[0.1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <img src="${getHeroImageUrl(closeRuiner.hero_id, closeRuiner.hero_name)}" alt="" class="w-10 h-6 rounded object-cover border border-white/15" onerror="this.style.display='none'" />
        <span class="text-slate-300">Второй кандидат (#2 • разрыв <span class="font-mono text-white font-semibold">${scoreGap}</span> очк.):</span>
        <strong class="text-white font-semibold">${closeRuiner.personaname}</strong>
        ${renderHeroChip(closeRuiner.hero_name)}
        <span class="text-slate-300 font-mono">• ${closeRuiner.role} • KDA ${closeRuiner.stats.kills}/${closeRuiner.stats.deaths}/${closeRuiner.stats.assists}</span>
      </div>
      <button onclick="selectPlayer(${closeRuiner.player_slot}, true)" data-cursor="ДОСЬЕ #2" class="font-display uppercase tracking-wider px-3 py-1.5 rounded-lg bg-[#121824]/90 hover:bg-[#1b2333] text-xs font-bold text-slate-100 border border-white/[0.12] transition self-start sm:self-auto shrink-0">
        Посмотреть досье (<span class="font-mono">${closeRuiner.scores.total}/100</span>) →
      </button>
    </div>
  ` : '';

  const verdictPrefix = isExplicit ? 'Главный руинер:' : hasRealRuiner ? 'Главный якорь:' : 'Лидер антирейтинга:';
  const culpritHeroImgUrl = getHeroImageUrl(c.hero_id, c.hero_name);

  vc.className = `xl:col-span-8 relative overflow-hidden rounded-2xl p-5 sm:p-6 flex flex-col justify-between tilt-surface ${bannerCls}`;
  vc.innerHTML = `
    <div class="culprit-atmo-bg">
      <img src="${culpritHeroImgUrl}" alt="" onerror="this.style.display='none'" />
    </div>

    <div style="position: relative; z-index: 3;" class="flex flex-col justify-between h-full">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div class="space-y-3.5 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            ${statusPill}
            <span class="text-xs font-mono text-slate-100 bg-[#121824]/90 px-2.5 py-0.5 rounded-md border border-white/[0.1]">
              Матч #${data.match_id} • ${data.duration_formatted}
            </span>
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-[#121824]/90 border border-white/[0.1] ${data.radiant_win ? 'text-emerald-400' : 'text-rose-400'}">
              Победа ${data.radiant_win ? 'Radiant' : 'Dire'} (<span class="font-mono">${data.radiant_score}:${data.dire_score}</span>)
            </span>
          </div>

          <div class="flex items-center gap-4">
            <img src="${culpritHeroImgUrl}" alt="" class="w-20 h-12 rounded-xl object-cover border border-white/20 shadow-lg hidden sm:block shrink-0" onerror="this.style.display='none'" />
            <div>
              <h2 class="text-xl sm:text-3xl font-bold text-white tracking-tight flex flex-wrap items-center gap-2.5 uppercase">
                <span class="text-slate-200">${verdictPrefix}</span>
                <span class="text-white">${c.personaname}</span>
                <span class="font-display text-base sm:text-xl font-bold px-3 py-0.5 rounded-lg bg-indigo-500/25 text-indigo-200 border border-indigo-400/40">${c.hero_name}</span>
              </h2>
              <div class="text-xs sm:text-sm font-medium text-slate-200 mt-1">
                Главная причина: <span class="text-white font-semibold">${formatRichHeroMentions(c.shortVerdict)}</span>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 pt-0.5">
            <div class="px-2.5 py-1 rounded-lg bg-[#0e1420]/85 border border-white/[0.1] text-xs backdrop-blur-sm">
              <span class="text-slate-300">Роль:</span>
              <strong class="text-white ml-1">${c.role}</strong>
            </div>
            <div class="px-2.5 py-1 rounded-lg bg-[#0e1420]/85 border border-white/[0.1] text-xs backdrop-blur-sm">
              <span class="text-slate-300">KDA:</span>
              <strong class="text-white ml-1 font-mono">${c.stats.kills}/${c.stats.deaths}/${c.stats.assists}</strong>
            </div>
            <div class="px-2.5 py-1 rounded-lg bg-[#0e1420]/85 border border-white/[0.1] text-xs backdrop-blur-sm">
              <span class="text-slate-300">Драки:</span>
              <strong class="text-white ml-1 font-mono">${c.teamfight_participation_pct}%</strong>
            </div>
            <div class="px-2.5 py-1 rounded-lg bg-[#0e1420]/85 border border-white/[0.1] text-xs backdrop-blur-sm">
              <span class="text-slate-300">Урон команды:</span>
              <strong class="text-white ml-1 font-mono">${c.dmg_share_pct}%</strong>
            </div>
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e1420]/85 border border-white/[0.1] text-xs backdrop-blur-sm">
              <span class="text-slate-300 mr-0.5">Слоты:</span>
              ${renderInventoryIcons(c.inventory, true)}
            </div>
          </div>

          ${topFactsHtml}
        </div>

        ${renderRadialGauge(c.scores.total, c.ruinType, false)}
      </div>
      ${nearRuinerHtml}
    </div>
  `;

  const chronoBadge = document.getElementById('chronoCountBadge');
  if (chronoBadge) {
    chronoBadge.textContent = Array.isArray(data.chronology) ? data.chronology.length : 0;
  }

  renderWidescreenSidebars(data);
  renderHeroDraftStrip(data);
  renderChronology(data);
  initVersusSelectors(data);
  renderInspector(data);
  renderLeaderboard(data);
  renderScoreboard(data);

  animateNumbers('#verdictCard');
  triggerHooksRefresh();
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(
      '#verdictSection > *',
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out' }
    );
  }
}

// ============================================================================
// ХРОНОЛОГИЯ МАТЧА И ИНТЕРАКТИВНЫЙ ГРАФИК ЗОЛОТА
// ============================================================================
function highlightChronologyStep(stepIdx) {
  const cards = document.querySelectorAll('[data-chrono-step]');
  cards.forEach(el => {
    const idx = Number(el.getAttribute('data-chrono-step'));
    if (idx === stepIdx) {
      el.classList.add('ring-2', 'ring-rose-500/80', 'bg-[#1a2234]');
      if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      el.classList.remove('ring-2', 'ring-rose-500/80', 'bg-[#1a2234]');
    }
  });
}

function updateGoldChartMinuteInspector(minIdx) {
  if (!chartGeometryCache || !currentAnalysis) return;
  const { series, padX, plotW, plotH, midY, maxAbs } = chartGeometryCache;
  const clampedIdx = Math.max(0, Math.min(series.length - 1, Math.round(minIdx)));
  const val = Number(series[clampedIdx] || 0);
  const prevVal = Number(series[Math.max(0, clampedIdx - 3)] || 0);
  const delta3m = val - prevVal;

  const cx = padX + (clampedIdx / Math.max(1, series.length - 1)) * plotW;
  const cy = midY - (val / maxAbs) * (plotH / 2);

  const vLine = document.getElementById('goldCrosshairLine');
  const dot = document.getElementById('goldCrosshairDot');
  const hud = document.getElementById('goldLiveHudBar');

  if (vLine) {
    vLine.setAttribute('x1', cx.toFixed(1));
    vLine.setAttribute('x2', cx.toFixed(1));
    vLine.style.opacity = '1';
  }
  if (dot) {
    dot.setAttribute('cx', cx.toFixed(1));
    dot.setAttribute('cy', cy.toFixed(1));
    dot.setAttribute('fill', val >= 0 ? '#10b981' : '#f43f5e');
    dot.style.opacity = '1';
  }

  if (hud) {
    const absGold = Math.abs(val).toLocaleString('ru-RU');
    const leaderText = val > 150
      ? `<span class="text-emerald-400 font-bold">🟢 Radiant +${absGold} 🪙</span>`
      : val < -150
        ? `<span class="text-rose-400 font-bold">🔴 Dire +${absGold} 🪙</span>`
        : `<span class="text-slate-200 font-bold">⚖️ Равная игра (${absGold} 🪙)</span>`;

    const swingAbs = Math.abs(delta3m).toLocaleString('ru-RU');
    const swingHtml = Math.abs(delta3m) >= 1200
      ? `<span class="px-2 py-0.5 rounded bg-white/[0.08] font-mono text-[11px] ${delta3m > 0 ? 'text-emerald-300' : 'text-rose-300'}">Рывок за 3 мин: ${delta3m > 0 ? 'Radiant' : 'Dire'} +${swingAbs} 🪙</span>`
      : `<span class="text-slate-300 font-mono text-[11px]">Темп стабильный</span>`;

    const nearEv = (currentAnalysis.chronology || []).find(ev => Math.abs(Math.round(ev.sortTimeSec / 60) - clampedIdx) <= 2);
    const evBadge = nearEv
      ? `<span class="px-2.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-100 text-xs font-semibold truncate max-w-md">⚡ ${nearEv.time}: ${formatRichHeroMentions(nearEv.title)}</span>`
      : `<span class="text-xs text-slate-300">Наведите курсор или кликните на узлы перелома на графике</span>`;

    hud.innerHTML = `
      <div class="flex flex-wrap items-center gap-3">
        <span class="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-[#07090e] text-white border border-white/15">⏱ ${String(clampedIdx).padStart(2, '0')}:00</span>
        <div class="text-xs sm:text-sm font-mono">${leaderText}</div>
        ${swingHtml}
      </div>
      <div class="truncate">${evBadge}</div>
    `;
  }
}

function handleGoldSvgMouseMove(evt) {
  if (!chartGeometryCache) return;
  const svg = evt.currentTarget;
  if (!svg || !svg.getBoundingClientRect) return;
  const rect = svg.getBoundingClientRect();
  const relX = ((evt.clientX - rect.left) / Math.max(1, rect.width)) * chartGeometryCache.width;
  const ratio = (relX - chartGeometryCache.padX) / Math.max(1, chartGeometryCache.plotW);
  const minIdx = Math.round(ratio * (chartGeometryCache.series.length - 1));
  updateGoldChartMinuteInspector(minIdx);
}

function renderGoldSwingSvg(data) {
  const container = document.getElementById('goldSwingChartContainer');
  if (!container) return;

  const series = Array.isArray(data.radiant_gold_adv) ? data.radiant_gold_adv : [];
  if (series.length < 2) {
    container.innerHTML = `
      <div class="p-4 rounded-xl pro-subcard text-xs text-slate-200">
        Поминутный график золота недоступен для нераспарсенного реплея (ниже представлена реконструкция ключевых фаз матча по итоговой статистике).
      </div>
    `;
    return;
  }

  const width = 980;
  const height = 250;
  const padX = 52;
  const padY = 28;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;
  const midY = padY + plotH / 2;

  const maxAbs = Math.max(5000, ...series.map(v => Math.abs(v || 0)));
  const xForIdx = idx => padX + (idx / Math.max(1, series.length - 1)) * plotW;
  const yForVal = val => midY - ((val || 0) / maxAbs) * (plotH / 2);

  chartGeometryCache = { series, width, height, padX, padY, plotW, plotH, midY, maxAbs };

  let maxRadLead = 0, maxRadMin = 0;
  let maxDireLead = 0, maxDireMin = 0;
  let biggestSwing = 0, biggestSwingMin = 0;
  let leadChanges = 0;
  let prevSign = 0;

  series.forEach((v, idx) => {
    const val = Number(v || 0);
    if (val > maxRadLead) { maxRadLead = val; maxRadMin = idx; }
    if (-val > maxDireLead) { maxDireLead = -val; maxDireMin = idx; }
    if (idx >= 3) {
      const swing = Math.abs(val - Number(series[idx - 3] || 0));
      if (swing > biggestSwing) { biggestSwing = swing; biggestSwingMin = idx; }
    }
    const sign = val > 500 ? 1 : val < -500 ? -1 : 0;
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) leadChanges++;
    if (sign !== 0) prevSign = sign;
  });

  const radPolygonPts = [
    `${xForIdx(0).toFixed(1)},${midY.toFixed(1)}`,
    ...series.map((v, idx) => `${xForIdx(idx).toFixed(1)},${yForVal(Math.max(0, v || 0)).toFixed(1)}`),
    `${xForIdx(series.length - 1).toFixed(1)},${midY.toFixed(1)}`
  ].join(' ');

  const direPolygonPts = [
    `${xForIdx(0).toFixed(1)},${midY.toFixed(1)}`,
    ...series.map((v, idx) => `${xForIdx(idx).toFixed(1)},${yForVal(Math.min(0, v || 0)).toFixed(1)}`),
    `${xForIdx(series.length - 1).toFixed(1)},${midY.toFixed(1)}`
  ].join(' ');

  const linePoints = series.map((v, idx) => `${xForIdx(idx).toFixed(1)},${yForVal(v).toFixed(1)}`).join(' ');

  const eventsWithIdx = (data.chronology || []).map((ev, stepIdx) => ({ ev, stepIdx }));
  const markers = eventsWithIdx
    .filter(({ ev }) => ev.sortTimeSec >= 600 && ev.sortTimeSec <= data.duration_sec)
    .map(({ ev, stepIdx }) => {
      const mIdx = Math.min(series.length - 1, Math.max(0, Math.round(ev.sortTimeSec / 60)));
      const cx = xForIdx(mIdx);
      const cy = yForVal(series[mIdx] || 0);
      const isBkb = ev.tag.includes('BKB');
      const isTurn = ev.tag.includes('ПЕРЕЛОМ');
      const color = isBkb ? '#f59e0b' : isTurn ? '#f43f5e' : '#38bdf8';
      const safeTitle = String(`${ev.time}: ${ev.title}`).replace(/"/g, '&quot;');
      const labelY = cy > midY ? Math.max(18, cy - 12) : Math.min(height - 16, cy + 18);

      return `
        <g class="cursor-pointer group" onclick="highlightChronologyStep(${stepIdx}); updateGoldChartMinuteInspector(${mIdx});" title="${safeTitle}">
          <line x1="${cx.toFixed(1)}" y1="${padY}" x2="${cx.toFixed(1)}" y2="${height - padY}" stroke="${color}" stroke-dasharray="3,3" stroke-opacity="0.5" />
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9" fill="${color}" fill-opacity="0.24" />
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="${color}" stroke="#07090e" stroke-width="2" />
          <rect x="${(cx - 22).toFixed(1)}" y="${(labelY - 9).toFixed(1)}" width="44" height="14" rx="4" fill="#07090e" stroke="${color}" stroke-opacity="0.7" />
          <text x="${cx.toFixed(1)}" y="${(labelY + 1).toFixed(1)}" text-anchor="middle" fill="#ffffff" font-size="8.5" font-family="JetBrains Mono, monospace" font-weight="700">${ev.time}</text>
        </g>
      `;
    }).join('');

  const maxK = Math.round(maxAbs / 1000);
  const halfK = Math.round(maxAbs / 2000);

  container.innerHTML = `
    <div class="space-y-3.5">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button onclick="updateGoldChartMinuteInspector(${maxRadMin})" class="text-left p-3 rounded-xl pro-subcard hover:border-emerald-500/45 transition">
          <div class="text-[10px] font-display uppercase tracking-wider text-slate-300">Пик Radiant (Свет)</div>
          <div class="font-mono text-sm sm:text-base font-extrabold text-emerald-400 mt-0.5">+${(maxRadLead / 1000).toFixed(1)}k 🪙 <span class="text-xs text-slate-300 font-normal">на ${maxRadMin}:00</span></div>
        </button>
        <button onclick="updateGoldChartMinuteInspector(${maxDireMin})" class="text-left p-3 rounded-xl pro-subcard hover:border-rose-500/45 transition">
          <div class="text-[10px] font-display uppercase tracking-wider text-slate-300">Пик Dire (Тьма)</div>
          <div class="font-mono text-sm sm:text-base font-extrabold text-rose-400 mt-0.5">+${(maxDireLead / 1000).toFixed(1)}k 🪙 <span class="text-xs text-slate-300 font-normal">на ${maxDireMin}:00</span></div>
        </button>
        <button onclick="updateGoldChartMinuteInspector(${biggestSwingMin})" class="text-left p-3 rounded-xl pro-subcard hover:border-amber-500/45 transition">
          <div class="text-[10px] font-display uppercase tracking-wider text-slate-300">Главный обвал / рывок</div>
          <div class="font-mono text-sm sm:text-base font-extrabold text-amber-400 mt-0.5">Δ ${(biggestSwing / 1000).toFixed(1)}k 🪙 <span class="text-xs text-slate-300 font-normal">к ${biggestSwingMin}:00</span></div>
        </button>
        <div class="p-3 rounded-xl pro-subcard">
          <div class="text-[10px] font-display uppercase tracking-wider text-slate-300">Качели по игре</div>
          <div class="font-mono text-sm sm:text-base font-extrabold text-sky-400 mt-0.5">${leadChanges} <span class="text-xs text-slate-300 font-normal">смен лидера</span></div>
        </div>
      </div>

      <div id="goldLiveHudBar" class="p-3 rounded-xl bg-[#121824] border border-white/[0.1] flex flex-wrap items-center justify-between gap-2 min-h-[46px]"></div>

      <div class="relative rounded-xl bg-[#090d14] border border-white/[0.08] p-2 shadow-inner">
        <svg
          viewBox="0 0 ${width} ${height}"
          class="w-full h-56 sm:h-64 select-none cursor-crosshair"
          onmousemove="handleGoldSvgMouseMove(event)"
        >
          <defs>
            <linearGradient id="radAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#10b981" stop-opacity="0.42" />
              <stop offset="100%" stop-color="#10b981" stop-opacity="0.02" />
            </linearGradient>
            <linearGradient id="direAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.02" />
              <stop offset="100%" stop-color="#f43f5e" stop-opacity="0.42" />
            </linearGradient>
          </defs>

          <line x1="${padX}" y1="${padY}" x2="${width - padX}" y2="${padY}" stroke="rgba(16, 185, 129, 0.14)" stroke-dasharray="2,4" />
          <line x1="${padX}" y1="${(padY + midY) / 2}" x2="${width - padX}" y2="${(padY + midY) / 2}" stroke="rgba(255,255,255,0.05)" />
          <line x1="${padX}" y1="${midY}" x2="${width - padX}" y2="${midY}" stroke="rgba(255,255,255,0.26)" stroke-width="1.2" />
          <line x1="${padX}" y1="${(midY + height - padY) / 2}" x2="${width - padX}" y2="${(midY + height - padY) / 2}" stroke="rgba(255,255,255,0.05)" />
          <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="rgba(244, 63, 94, 0.14)" stroke-dasharray="2,4" />

          <text x="${padX - 8}" y="${padY + 4}" text-anchor="end" fill="#10b981" font-size="9.5" font-family="JetBrains Mono, monospace" font-weight="700">+${maxK}k</text>
          <text x="${padX - 8}" y="${(padY + midY) / 2 + 3}" text-anchor="end" fill="#10b981" fill-opacity="0.75" font-size="8.5" font-family="JetBrains Mono, monospace">+${halfK}k</text>
          <text x="${padX - 8}" y="${midY + 3}" text-anchor="end" fill="#cbd5e1" font-size="9" font-family="JetBrains Mono, monospace">0</text>
          <text x="${padX - 8}" y="${(midY + height - padY) / 2 + 3}" text-anchor="end" fill="#f43f5e" fill-opacity="0.75" font-size="8.5" font-family="JetBrains Mono, monospace">-${halfK}k</text>
          <text x="${padX - 8}" y="${height - padY + 3}" text-anchor="end" fill="#f43f5e" font-size="9.5" font-family="JetBrains Mono, monospace" font-weight="700">-${maxK}k</text>

          <text x="${padX}" y="${height - 6}" text-anchor="start" fill="#94a3b8" font-size="9" font-family="JetBrains Mono, monospace">00:00</text>
          <text x="${padX + plotW * 0.25}" y="${height - 6}" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="JetBrains Mono, monospace">${Math.round((series.length - 1) * 0.25)}:00</text>
          <text x="${padX + plotW * 0.50}" y="${height - 6}" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="JetBrains Mono, monospace">${Math.round((series.length - 1) * 0.50)}:00</text>
          <text x="${padX + plotW * 0.75}" y="${height - 6}" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="JetBrains Mono, monospace">${Math.round((series.length - 1) * 0.75)}:00</text>
          <text x="${width - padX}" y="${height - 6}" text-anchor="end" fill="#e2e8f0" font-size="9" font-family="JetBrains Mono, monospace" font-weight="700">${data.duration_formatted}</text>

          <polygon points="${radPolygonPts}" fill="url(#radAreaGrad)" />
          <polygon points="${direPolygonPts}" fill="url(#direAreaGrad)" />
          <polyline fill="none" stroke="#f8fafc" stroke-width="2.3" stroke-linejoin="round" points="${linePoints}" />

          <line id="goldCrosshairLine" x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="2,2" style="opacity:0; pointer-events:none;" />
          <circle id="goldCrosshairDot" cx="${padX}" cy="${midY}" r="6" fill="#10b981" stroke="#ffffff" stroke-width="2" style="opacity:0; pointer-events:none;" />

          ${markers}
        </svg>
      </div>
    </div>
  `;

  const turnEv = (data.chronology || []).find(ev => ev.tag.includes('ПЕРЕЛОМ'));
  const initMin = turnEv ? Math.round(turnEv.sortTimeSec / 60) : Math.floor(series.length * 0.6);
  updateGoldChartMinuteInspector(initMin);
}

function renderChronology(data) {
  renderGoldSwingSvg(data);

  const grid = document.getElementById('matchChronologyGrid');
  if (!grid) return;

  const events = Array.isArray(data.chronology) ? data.chronology : [];
  if (events.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-xs text-slate-300 p-4 rounded-xl pro-subcard">Хронология событий для этого матча отсутствует.</div>`;
    return;
  }

  grid.innerHTML = events.map((ev, idx) => {
    const toneStyles = {
      critical: {
        border: 'border-l-4 border-l-rose-500 border-white/[0.1]',
        badge: 'bg-rose-500/20 text-rose-200 border-rose-500/35',
        pill: 'bg-rose-950/70 text-rose-100 border-rose-700/50'
      },
      warn: {
        border: 'border-l-4 border-l-amber-400 border-white/[0.1]',
        badge: 'bg-amber-500/20 text-amber-200 border-amber-500/35',
        pill: 'bg-amber-950/60 text-amber-100 border-amber-700/50'
      },
      good: {
        border: 'border-l-4 border-l-emerald-400 border-white/[0.1]',
        badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/35',
        pill: 'bg-emerald-950/60 text-emerald-100 border-emerald-700/50'
      },
      neutral: {
        border: 'border-l-4 border-l-sky-400 border-white/[0.1]',
        badge: 'bg-sky-500/20 text-sky-200 border-sky-500/35',
        pill: 'bg-slate-800 text-slate-100 border-white/15'
      }
    };
    const st = toneStyles[ev.tone] || toneStyles.neutral;
    const minIdx = Math.max(0, Math.round((ev.sortTimeSec || 600) / 60));

    return `
      <div
        data-chrono-step="${idx}"
        onclick="highlightChronologyStep(${idx}); updateGoldChartMinuteInspector(${minIdx});"
        data-cursor="МИНУТА ${minIdx}"
        class="cursor-pointer p-4 rounded-xl pro-subcard ${st.border} hover:bg-[#171f30] transition flex flex-col justify-between gap-3"
      >
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <span class="font-display text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${st.badge}">
              ${ev.tag}
            </span>
            <span class="font-mono text-xs font-extrabold text-white px-2 py-0.5 rounded bg-[#07090e] border border-white/15">
              ⏱ ${ev.time}
            </span>
          </div>
          <h4 class="font-display text-sm font-bold text-white leading-snug">
            ${formatRichHeroMentions(ev.title)}
          </h4>
          <p class="text-xs text-slate-200 leading-relaxed">
            ${formatRichHeroMentions(ev.description)}
          </p>
        </div>

        <div class="pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2">
          <span class="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded border ${st.pill}">
            ${ev.pill || ev.time}
          </span>
          <span class="text-[10px] font-mono text-slate-400">Шаг #${idx + 1}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// ЦЕНТРАЛЬНОЕ ДОСЬЕ ИГРОКА + МИНИ-ИИ ОЦЕНЩИК БИЛДА
// ============================================================================
function renderInspector(data, animateTransition = false) {
  const p = data.players.find(x => x.player_slot === selectedSlot) || data.verdict.culprit;
  if (!p) return;

  const heroImgUrl = getHeroImageUrl(p.hero_id, p.hero_name);
  const bgImg = document.getElementById('inspectorBgHeroImg');
  if (bgImg) {
    if (bgImg.parentElement) {
      bgImg.parentElement.removeAttribute('style');
      bgImg.parentElement.className = 'dossier-hero-backdrop';
    }
    bgImg.style.display = 'block';
    bgImg.src = heroImgUrl;
  }

  const avatarImg = document.getElementById('inspectorHeroImg');
  if (avatarImg) {
    avatarImg.style.display = 'block';
    avatarImg.src = heroImgUrl;
  }

  const typeBadge = document.getElementById('inspectorTypeBadge');
  if (typeBadge) {
    const isSab = p.scores.sabotage >= 55 && p.scores.total >= 50;
    const isAnchor = p.scores.total >= 35;
    typeBadge.className = `font-display text-[11px] uppercase tracking-wider font-bold ${
      isSab ? 'text-rose-400' : isAnchor ? 'text-amber-400' : 'text-emerald-400'
    }`;
    typeBadge.textContent = p.ruinType;
  }

  const roleBadge = document.getElementById('inspectorRoleBadge');
  if (roleBadge) {
    roleBadge.textContent = `${p.teamName} • ${p.role}`;
  }

  const titleEl = document.getElementById('inspectorTitle');
  if (titleEl) {
    titleEl.innerHTML = `
      <span>${p.personaname}</span>
      ${renderHeroChip(p.hero_name)}
      <span class="font-mono text-xs sm:text-sm font-normal text-slate-300">KDA ${p.stats.kills}/${p.stats.deaths}/${p.stats.assists}</span>
    `;
  }

  const radialBox = document.getElementById('inspectorRadialBox');
  if (radialBox) {
    radialBox.innerHTML = renderRadialGauge(p.scores.total, p.ruinType, true);
    animateNumbers('#inspectorRadialBox');
  }

  const badgesRow = document.getElementById('inspectorBadgesRow');
  if (badgesRow) {
    badgesRow.innerHTML = p.badges && p.badges.length > 0
      ? renderBadgePills(p.badges, false)
      : `<span class="text-xs text-emerald-300 font-medium px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30">✓ Без грубых маркеров руина</span>`;
  }

  const invRow = document.getElementById('inspectorInventoryRow');
  if (invRow) {
    invRow.innerHTML = renderInventoryIcons(p.inventory, false);
  }

  const buildBox = document.getElementById('inspectorBuildAudit');
  if (buildBox && p.build_audit) {
    const ba = p.build_audit;
    const statusMap = {
      good: {
        border: 'border-emerald-500/35 bg-emerald-950/20',
        pill: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
        label: '✓ БИЛД ПО МЕТЕ И ПИКУ'
      },
      warning: {
        border: 'border-amber-500/40 bg-amber-950/20',
        pill: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
        label: '⚠ СПОРНЫЙ ТАЙМИНГ / ЗАКУП'
      },
      hidden_ruin: {
        border: 'border-rose-500/50 bg-rose-950/25',
        pill: 'bg-rose-500/25 text-rose-200 border-rose-500/45',
        label: '🚨 СКРЫТЫЙ РУИН БИЛДОМ'
      },
      empty_networth: {
        border: 'border-rose-500/50 bg-rose-950/25',
        pill: 'bg-rose-500/25 text-rose-200 border-rose-500/45',
        label: '💸 ПУСТОЙ НЕТВОРС (СЛИВ ЗОЛОТА)'
      }
    };
    const st = statusMap[ba.verdictStatus] || statusMap.good;
    const matrixRows = Array.isArray(ba.counterMatrix) ? ba.counterMatrix : [];

    const matrixHtml = matrixRows.length > 0 ? `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
        ${matrixRows.map(row => {
          const isFail = row.status === 'failed';
          const isWarn = row.status === 'warning';
          const rowBorder = isFail
            ? 'border-rose-500/45 bg-rose-950/30'
            : isWarn
              ? 'border-amber-500/40 bg-amber-950/25'
              : 'border-white/[0.1] bg-[#0c1018]/95';
          const respColor = isFail ? 'text-rose-200' : isWarn ? 'text-amber-200' : 'text-emerald-200';
          return `
            <div class="p-2.5 rounded-xl border ${rowBorder} space-y-1">
              <div class="flex items-center justify-between gap-2">
                <span class="font-display text-[10px] uppercase tracking-wider font-bold text-slate-200">${row.category}</span>
                <span class="text-[10px] font-mono text-slate-300 truncate max-w-[160px]" title="${row.expectedItems}">${row.expectedItems}</span>
              </div>
              <div class="text-[11px] text-slate-300 truncate" title="${row.threat}">Угроза: <span class="text-white font-medium">${row.threat}</span></div>
              <div class="text-xs font-semibold ${respColor} leading-snug">${row.playerResponse}</div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    buildBox.innerHTML = `
      <div class="p-4 rounded-2xl border ${st.border} space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-display text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border ${st.pill}">
              ${st.label}
            </span>
            <span class="text-[11px] font-mono text-slate-200 px-2 py-0.5 rounded bg-[#07090e]/90 border border-white/[0.1]">
              Архетип: ${ba.archetypeLabel || p.role}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-mono text-slate-300">Оценка сборки ИИ:</span>
            <span class="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-[#07090e] border border-white/15 ${
              ba.buildScore >= 80 ? 'text-emerald-400' : ba.buildScore >= 60 ? 'text-amber-400' : 'text-rose-400'
            }">${ba.buildScore}/100</span>
          </div>
        </div>

        <div>
          <div class="font-display text-sm sm:text-base font-bold text-white leading-snug">
            ${formatRichHeroMentions(ba.headline)}
          </div>
          <p class="text-xs text-slate-200 mt-1 leading-relaxed">
            ${formatRichHeroMentions(ba.explanation)}
          </p>
        </div>

        ${matrixHtml}
      </div>
    `;
  }

  const totalPill = document.getElementById('inspectorTotalScorePill');
  if (totalPill) {
    totalPill.className = `text-[11px] font-mono font-bold px-2.5 py-0.5 rounded border ${scoreBadgeColor(p.scores.total)}`;
    totalPill.textContent = `Итого: ${p.scores.total} / 100 очков вины`;
  }

  const barsEl = document.getElementById('inspectorBars');
  if (barsEl) {
    const categories = [
      {
        title: '🪙 Экономика и Сборка',
        val: p.scores.economy,
        max: 35,
        sub: `NW: ${p.stats.net_worth.toLocaleString('ru-RU')} 🪙 • Урон/Золото: ${p.damage_per_gold}`
      },
      {
        title: '⚔️ Импакт в драках и Башни',
        val: p.scores.gameplay,
        max: 40,
        sub: `Драки: ${p.teamfight_participation_pct}% • Доля урона: ${p.dmg_share_pct}% • Башни: ${p.tower_damage.toLocaleString('ru-RU')}`
      },
      {
        title: '⏱️ Ошибки по таймлайну',
        val: p.scores.timeline,
        max: 60,
        sub: `Смертей: ${p.stats.deaths} • Урон за жизнь: ${p.damage_per_death.toLocaleString('ru-RU')}`
      },
      {
        title: '📊 КПД на герое (Перцентиль)',
        val: p.scores.benchmark,
        max: 25,
        sub: `Отыграл лучше ${p.hero_efficiency_percentile}% игроков на ${p.hero_name}`
      }
    ];

    barsEl.innerHTML = categories.map(cat => {
      const pct = Math.min(100, Math.round((cat.val / cat.max) * 100));
      const barColor = pct >= 60 ? 'bg-rose-500' : pct >= 30 ? 'bg-amber-400' : 'bg-emerald-500';
      return `
        <div class="p-3 rounded-xl pro-subcard space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-display font-bold text-white">${cat.title}</span>
            <span class="font-mono font-bold ${cat.val > 0 ? 'text-rose-400' : 'text-emerald-400'}">+${cat.val} <span class="text-slate-400 font-normal">/ ${cat.max}</span></span>
          </div>
          <div class="w-full h-1.5 bg-[#07090e] rounded-full overflow-hidden">
            <div data-gsap-bar="${pct}%" class="${barColor} h-full rounded-full" style="width: ${pct}%"></div>
          </div>
          <div class="text-[11px] font-mono text-slate-300 truncate">${cat.sub}</div>
        </div>
      `;
    }).join('');
  }

  const supCard = document.getElementById('inspectorSupportCard');
  if (supCard) {
    if (p.scores.amnesty < 0) {
      const ab = p.amnesty_banner || {
        title: p.scores.amnesty_title || (p.isSupport ? '🛡 Саппорт-амнистия активирована' : '⚔️ Боевая амнистия активирована'),
        text: p.scores.amnesty_text || (p.isSupport
          ? `Списано ${Math.abs(p.scores.amnesty)} очков вины за полезность на карте, сейв и вижен (Вардов: ${p.wards_placed}, Лечение: ${(p.stats.hero_healing || 0).toLocaleString('ru-RU')}).`
          : `Списано ${Math.abs(p.scores.amnesty)} очков вины за высокий вклад в командные драки (Участие: ${p.teamfight_participation_pct}%, Урон: ${p.stats.hero_damage.toLocaleString('ru-RU')}).`)
      };
      supCard.innerHTML = `
        <div class="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-between gap-3 text-xs">
          <div>
            <span class="font-display font-bold uppercase text-emerald-200">${ab.title}</span>
            <p class="text-slate-200 text-[11px] mt-0.5">${ab.text}</p>
          </div>
          <span class="font-mono text-sm font-extrabold text-emerald-400 shrink-0">${p.scores.amnesty} очк.</span>
        </div>
      `;
    } else {
      supCard.innerHTML = '';
    }
  }

  const forEl = document.getElementById('inspectorForensics');
  if (forEl && p.forensics) {
    const f = p.forensics;
    forEl.innerHTML = `
      <div class="p-3 rounded-xl pro-subcard border-t-2 border-t-rose-500/70 space-y-1">
        <div class="text-[10px] font-display uppercase tracking-wider font-bold text-rose-400">⏱ Ключевой эпизод (${f.turningPoint.time})</div>
        <div class="text-xs font-bold text-white leading-snug">${f.turningPoint.title}</div>
        <div class="text-[11px] text-slate-200 leading-relaxed">${f.turningPoint.text}</div>
      </div>
      <div class="p-3 rounded-xl pro-subcard border-t-2 border-t-sky-500/70 space-y-1">
        <div class="text-[10px] font-display uppercase tracking-wider font-bold text-sky-400">⚖️ Фактор оправдания / КПД</div>
        <div class="text-xs font-bold text-white leading-snug">${f.innocence.title}</div>
        <div class="text-[11px] text-slate-200 leading-relaxed">${f.innocence.text}</div>
      </div>
      <div class="p-3 rounded-xl pro-subcard border-t-2 border-t-emerald-500/70 space-y-1">
        <div class="text-[10px] font-display uppercase tracking-wider font-bold text-emerald-400">💡 Рекомендация по игре</div>
        <div class="text-xs font-bold text-white leading-snug">Что улучшить</div>
        <div class="text-[11px] text-slate-200 leading-relaxed">${f.lessonAction}</div>
      </div>
    `;
  }

  renderInspectorReasonsList(data);
  animateProgressBars('#tabPanel-dossier');

  if (animateTransition && typeof gsap !== 'undefined') {
    if (bgImg) {
      gsap.fromTo(
        bgImg,
        { opacity: 0, scale: 1.08, x: 16 },
        { opacity: 0.34, scale: 1, x: 0, duration: 0.55, ease: 'power3.out', overwrite: 'auto' }
      );
    }
    if (avatarImg) {
      gsap.fromTo(
        avatarImg,
        { scale: 0.86, opacity: 0.3 },
        { scale: 1, opacity: 1, duration: 0.32, ease: 'back.out(1.7)', overwrite: 'auto' }
      );
    }
    gsap.fromTo(
      [
        '#inspectorTitle',
        '#inspectorBadgesRow',
        '#inspectorInventoryRow',
        '#inspectorBuildAudit',
        '#inspectorBars > *',
        '#inspectorSupportCard',
        '#inspectorForensics > *',
        '#inspectorReasons > *'
      ],
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.32, stagger: 0.022, ease: 'power3.out', overwrite: 'auto' }
    );
  }
}

function renderInspectorReasonsList(data) {
  const container = document.getElementById('inspectorReasons');
  if (!container) return;
  const p = data.players.find(x => x.player_slot === selectedSlot) || data.verdict.culprit;
  if (!p) return;

  let list = Array.isArray(p.reasons) ? [...p.reasons] : [];
  if (activeReasonFilter === 'penalties') {
    list = list.filter(r => r.points > 0);
  } else if (activeReasonFilter === 'bonuses') {
    list = list.filter(r => r.points < 0);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="p-4 rounded-xl pro-subcard text-xs text-emerald-300 flex items-center gap-2">
        <span>✅</span>
        <span>В выбранной категории нет зафиксированных ошибок или штрафов.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(r => {
    const isBonus = r.points < 0;
    const isSab = r.type === 'sabotage';
    const borderCls = isBonus
      ? 'border-l-4 border-l-emerald-400 border-white/[0.1]'
      : isSab
        ? 'border-l-4 border-l-rose-500 border-rose-500/35 bg-rose-950/20'
        : 'border-l-4 border-l-amber-400 border-white/[0.1]';
    const ptsBadge = isBonus
      ? `<span class="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/35">${r.points} очк.</span>`
      : `<span class="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/35">+${r.points} очк.</span>`;

    return `
      <div class="p-3.5 rounded-xl pro-subcard ${borderCls} space-y-1.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="font-display text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#07090e] text-slate-200 border border-white/15">
              ${r.category}
            </span>
            <span class="font-mono text-[11px] text-slate-300">⏱ ${r.timestamp}</span>
            ${r.shortPill ? `<span class="font-mono text-[11px] text-amber-300 hidden sm:inline">• ${r.shortPill}</span>` : ''}
          </div>
          ${ptsBadge}
        </div>
        <div class="text-xs sm:text-sm font-bold text-white leading-snug">
          ${formatRichHeroMentions(r.title)}
        </div>
        <p class="text-xs text-slate-200 leading-relaxed">
          ${formatRichHeroMentions(r.detail)}
        </p>
      </div>
    `;
  }).join('');
}

// ============================================================================
// ПРАВАЯ КОЛОНКА: РЕЙТИНГ ВСЕХ 10 УЧАСТНИКОВ (LEADERBOARD)
// ============================================================================
function renderLeaderboard(data) {
  const container = document.getElementById('ruinLeaderboard');
  if (!container) return;

  container.innerHTML = data.leaderboard.map((p, idx) => {
    const active = p.player_slot === selectedSlot;
    const roleMeta = ROLE_EMOJI_MAP[p.position] || { icon: '🎮', short: p.position };
    const cardCls = active
      ? 'bg-[#1b2436] border-rose-500/65 ring-1 ring-rose-500/45 shadow-lg'
      : 'pro-subcard hover:bg-[#171f30] hover:border-white/20';

    return `
      <div
        onclick="selectPlayer(${p.player_slot}, false)"
        data-cursor="ДОСЬЕ"
        class="cursor-pointer p-3 rounded-xl border transition ${cardCls} space-y-2"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="font-mono text-xs font-extrabold w-5 text-center ${idx === 0 ? 'text-rose-400' : idx === 1 ? 'text-amber-400' : 'text-slate-400'}">
              #${idx + 1}
            </span>
            <img
              src="${getHeroImageUrl(p.hero_id, p.hero_name)}"
              alt="${p.hero_name}"
              class="w-11 h-7 rounded object-cover border ${p.isRadiant ? 'border-emerald-500/45' : 'border-rose-500/45'} shrink-0"
              onerror="this.style.display='none'"
            />
            <div class="min-w-0">
              <div class="text-xs font-bold text-white truncate flex items-center gap-1.5">
                <span class="truncate">${p.personaname}</span>
              </div>
              <div class="flex items-center gap-1.5 text-[10px] text-slate-300 font-mono">
                <span class="${p.isRadiant ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}">${p.isRadiant ? 'RAD' : 'DIRE'}</span>
                <span>•</span>
                <span>${roleMeta.icon} Pos ${roleMeta.short}</span>
                <span>•</span>
                <span>${p.stats.kills}/${p.stats.deaths}/${p.stats.assists}</span>
              </div>
            </div>
          </div>

          <span class="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border shrink-0 ${scoreBadgeColor(p.scores.total)}">
            ${p.scores.total}
          </span>
        </div>

        <div class="text-[11px] text-slate-300 truncate pl-7">
          ${formatRichHeroMentions(p.shortVerdict)}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// ВКЛАДКА 3: ДУЭЛЬ 1 НА 1 (HEAD-TO-HEAD TUG-OF-WAR)
// ============================================================================
function initVersusSelectors(data) {
  const selA = document.getElementById('versusSelectA');
  const selB = document.getElementById('versusSelectB');
  if (!selA || !selB) return;

  const optionsHtml = data.players.map(p => {
    const side = p.isRadiant ? '🟢 Radiant' : '🔴 Dire';
    return `<option value="${p.player_slot}">${side} • ${p.personaname} (${p.hero_name} — ${p.role})</option>`;
  }).join('');

  selA.innerHTML = optionsHtml;
  selB.innerHTML = optionsHtml;

  const radCarry = data.players.find(p => p.isRadiant && p.position === 1) || data.players[0];
  const direCarry = data.players.find(p => !p.isRadiant && p.position === 1) || data.players[5] || data.players[1];

  selA.value = String(radCarry.player_slot);
  selB.value = String(direCarry.player_slot);
  renderVersusPanel();
}

function setVersusByRole(pos) {
  if (!currentAnalysis) return;
  const selA = document.getElementById('versusSelectA');
  const selB = document.getElementById('versusSelectB');
  if (!selA || !selB) return;

  const rP = currentAnalysis.players.find(p => p.isRadiant && p.position === pos) || currentAnalysis.players[0];
  const dP = currentAnalysis.players.find(p => !p.isRadiant && p.position === pos) || currentAnalysis.players[5];
  selA.value = String(rP.player_slot);
  selB.value = String(dP.player_slot);
  renderVersusPanel();
}

function setVersusTopRuiners() {
  if (!currentAnalysis || !Array.isArray(currentAnalysis.leaderboard)) return;
  const selA = document.getElementById('versusSelectA');
  const selB = document.getElementById('versusSelectB');
  if (!selA || !selB) return;

  const top1 = currentAnalysis.leaderboard[0];
  const top2 = currentAnalysis.leaderboard[1] || currentAnalysis.leaderboard[0];
  selA.value = String(top1.player_slot);
  selB.value = String(top2.player_slot);
  renderVersusPanel();
}

function renderVersusPanel() {
  if (!currentAnalysis) return;
  const selA = document.getElementById('versusSelectA');
  const selB = document.getElementById('versusSelectB');
  const body = document.getElementById('versusComparisonBody');
  if (!selA || !selB || !body) return;

  const pA = currentAnalysis.players.find(p => String(p.player_slot) === String(selA.value)) || currentAnalysis.players[0];
  const pB = currentAnalysis.players.find(p => String(p.player_slot) === String(selB.value)) || currentAnalysis.players[1];

  const metrics = [
    { label: 'Индекс неруина (Меньше вины = Лучше)', a: pA.scores.total, b: pB.scores.total, fmt: v => `${v}/100`, lowerBetter: true },
    { label: 'KDA Коэффициент', a: Number(pA.stats.kda), b: Number(pB.stats.kda), fmt: v => v.toFixed(2) },
    { label: 'Урон по героям', a: pA.stats.hero_damage, b: pB.stats.hero_damage, fmt: v => v.toLocaleString('ru-RU') },
    { label: 'Участие в драках (KP %)', a: pA.teamfight_participation_pct, b: pB.teamfight_participation_pct, fmt: v => `${v}%` },
    { label: 'Урон на 1 золото (КПД ресурса)', a: pA.damage_per_gold, b: pB.damage_per_gold, fmt: v => v.toFixed(2) },
    { label: 'Урон по вышкам', a: pA.tower_damage, b: pB.tower_damage, fmt: v => v.toLocaleString('ru-RU') },
    { label: 'Общая ценность (Net Worth)', a: pA.stats.net_worth, b: pB.stats.net_worth, fmt: v => `${v.toLocaleString('ru-RU')} 🪙` },
    { label: 'Оценка билда Мини-ИИ', a: pA.build_audit ? pA.build_audit.buildScore : 80, b: pB.build_audit ? pB.build_audit.buildScore : 80, fmt: v => `${v}/100` }
  ];

  let winsA = 0;
  let winsB = 0;
  metrics.forEach(m => {
    if (m.a === m.b) return;
    const aWins = m.lowerBetter ? m.a < m.b : m.a > m.b;
    if (aWins) winsA++;
    else winsB++;
  });

  const rowsHtml = metrics.map(m => {
    const aWins = m.lowerBetter ? m.a < m.b : m.a > m.b;
    const bWins = m.lowerBetter ? m.b < m.a : m.b > m.a;
    const sum = Math.max(0.01, Number(m.a) + Number(m.b));
    const shareA = m.lowerBetter
      ? Math.round(((sum - Number(m.a)) / sum) * 100)
      : Math.round((Number(m.a) / sum) * 100);
    const clampedA = Math.max(12, Math.min(88, shareA));
    const clampedB = 100 - clampedA;

    return `
      <div class="p-3 rounded-xl pro-subcard space-y-1.5">
        <div class="flex items-center justify-between text-xs">
          <span class="font-mono font-bold ${aWins ? 'text-emerald-400' : 'text-slate-200'}">${m.fmt(m.a)} ${aWins ? '★' : ''}</span>
          <span class="text-[11px] font-display uppercase tracking-wider text-slate-300 font-bold">${m.label}</span>
          <span class="font-mono font-bold ${bWins ? 'text-sky-400' : 'text-slate-200'}">${bWins ? '★' : ''} ${m.fmt(m.b)}</span>
        </div>
        <div class="w-full h-2 bg-[#07090e] rounded-full overflow-hidden flex">
          <div class="bg-emerald-500/90 h-full transition-all" style="width: ${clampedA}%"></div>
          <div class="bg-sky-500/90 h-full transition-all" style="width: ${clampedB}%"></div>
        </div>
      </div>
    `;
  }).join('');

  body.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-4 rounded-2xl pro-subcard border border-white/[0.1]">
      <div onclick="selectPlayer(${pA.player_slot}, true)" class="cursor-pointer flex items-center gap-3">
        <img src="${getHeroImageUrl(pA.hero_id, pA.hero_name)}" alt="" class="w-16 h-10 rounded-lg object-cover border border-emerald-500/45" onerror="this.style.display='none'" />
        <div>
          <div class="text-sm font-bold text-white flex items-center gap-1.5">${pA.personaname} ${renderHeroChip(pA.hero_name)}</div>
          <div class="text-xs text-slate-300 font-mono">${pA.role} • KDA ${pA.stats.kills}/${pA.stats.deaths}/${pA.stats.assists}</div>
        </div>
      </div>

      <div class="text-center py-2 px-4 rounded-xl bg-[#07090e] border border-white/15">
        <div class="text-[10px] font-display uppercase tracking-widest text-slate-300">Счет дуэли по параметрам</div>
        <div class="font-mono text-2xl font-extrabold text-white mt-0.5">
          <span class="text-emerald-400">${winsA}</span>
          <span class="text-slate-500 mx-2">:</span>
          <span class="text-sky-400">${winsB}</span>
        </div>
      </div>

      <div onclick="selectPlayer(${pB.player_slot}, true)" class="cursor-pointer flex items-center justify-end gap-3 text-right">
        <div>
          <div class="text-sm font-bold text-white flex items-center justify-end gap-1.5">${renderHeroChip(pB.hero_name)} ${pB.personaname}</div>
          <div class="text-xs text-slate-300 font-mono">${pB.role} • KDA ${pB.stats.kills}/${pB.stats.deaths}/${pB.stats.assists}</div>
        </div>
        <img src="${getHeroImageUrl(pB.hero_id, pB.hero_name)}" alt="" class="w-16 h-10 rounded-lg object-cover border border-sky-500/45" onerror="this.style.display='none'" />
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      ${rowsHtml}
    </div>
  `;
}

// ============================================================================
// ВКЛАДКА 4: ПОЛНАЯ СВОДНАЯ ТАБЛИЦА ВСЕХ 10 ИГРОКОВ
// ============================================================================
function renderScoreboard(data) {
  const tbody = document.getElementById('scoreboardBody');
  if (!tbody) return;

  let list = [...data.players];
  if (activeTableFilter === 'radiant') list = list.filter(p => p.isRadiant);
  else if (activeTableFilter === 'dire') list = list.filter(p => !p.isRadiant);
  else if (activeTableFilter === 'cores') list = list.filter(p => !p.isSupport);
  else if (activeTableFilter === 'supports') list = list.filter(p => p.isSupport);

  tbody.innerHTML = list.map(p => {
    const active = p.player_slot === selectedSlot;
    const roleMeta = ROLE_EMOJI_MAP[p.position] || { icon: '🎮', short: p.position };
    const rowCls = active ? 'bg-[#1a2336]' : 'hover:bg-[#141b29]';

    return `
      <tr onclick="selectPlayer(${p.player_slot}, true)" data-cursor="ДОСЬЕ" class="cursor-pointer transition ${rowCls}">
        <td class="py-3 px-4">
          <div class="flex items-center gap-2.5">
            <img src="${getHeroImageUrl(p.hero_id, p.hero_name)}" alt="" class="w-11 h-7 rounded object-cover border ${p.isRadiant ? 'border-emerald-500/45' : 'border-rose-500/45'} shrink-0" onerror="this.style.display='none'" />
            <div>
              <div class="font-bold text-white flex items-center gap-1.5">
                <span>${p.personaname}</span>
                ${renderHeroChip(p.hero_name)}
              </div>
              <div class="text-[10px] font-mono ${p.isRadiant ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}">${p.teamName}</div>
            </div>
          </div>
        </td>
        <td class="py-3 px-3 font-mono text-xs text-slate-200 whitespace-nowrap">${roleMeta.icon} ${p.role}</td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-1">${renderInventoryIcons(p.inventory, true)}</div>
        </td>
        <td class="py-3 px-3 text-center font-mono font-bold text-white whitespace-nowrap">${p.stats.kills} / ${p.stats.deaths} / ${p.stats.assists}</td>
        <td class="py-3 px-3 text-right font-mono text-slate-100">${p.teamfight_participation_pct}%</td>
        <td class="py-3 px-3 text-right font-mono text-slate-100">${p.dmg_share_pct}%</td>
        <td class="py-3 px-3 text-right font-mono ${p.damage_per_gold < 0.88 && !p.isSupport ? 'text-rose-400 font-bold' : 'text-slate-100'}">${p.damage_per_gold}</td>
        <td class="py-3 px-3 text-right font-mono text-slate-200">${p.jungle_farm_pct}%</td>
        <td class="py-3 px-3 text-right font-mono text-slate-100">${p.tower_damage.toLocaleString('ru-RU')}</td>
        <td class="py-3 px-3 text-right font-mono text-slate-200">${p.wards_placed}</td>
        <td class="py-3 px-4 text-right">
          <span class="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border ${scoreBadgeColor(p.scores.total)}">
            ${p.scores.total}/100
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

window.addEventListener('DOMContentLoaded', () => {
  injectNextGenStyles();
  sanitizeDemoPromptInDom();
  initNextGenInteractions();
  renderRecentMatches();
  ensureBrowserItemsConstants();
});