/* =========================================================
   Tag Rugby EPS — application (100 % locale, hors ligne)
   Aucune donnée d'élève ne quitte l'appareil : stockage localStorage.
   ========================================================= */
(() => {
  'use strict';

  const STORE_KEY = 'tagrugby-eps-v1';

  const COLORS = [
    { name: 'Rouge', hex: '#e53935' },
    { name: 'Bleu', hex: '#1e63d6' },
    { name: 'Vert', hex: '#2e9d47' },
    { name: 'Jaune', hex: '#fbc02d' },
    { name: 'Orange', hex: '#f57c00' },
    { name: 'Violet', hex: '#8e24aa' },
    { name: 'Blanc', hex: '#f5f5f5' },
    { name: 'Noir', hex: '#263238' },
    { name: 'Rose', hex: '#e91e63' },
    { name: 'Gris', hex: '#90a4ae' }
  ];

  const DEFAULT_SETTINGS = {
    duration: 360,
    voice: true,
    voiceRate: 1.05,
    sun: false,
    displayMode: 'bibs',
    winPts: 3,
    drawPts: 2,
    lossPts: 1,
    mixBonus: 3,
    refPts: 1,
    fields: 1,
    doubleLeg: false,
    playersPerTeam: 4,
    teamCount: 4
  };

  const LOSS_LABELS = {
    tag: 'Tag',
    ground: 'Ballon au sol',
    touch: 'Touche',
    foul: 'Faute'
  };

  const EVENT_ICONS = {
    try: '🏉',
    tag: '🏳️',
    ground: '⬇️',
    touch: '↔️',
    foul: '🟨',
    intercept: '⚡',
    possession: '🔄'
  };

  const TIERS = {
    bronze: { label: 'Bronze', g: ['#6b3e1f', '#d9a066', '#8a5a2b'], ink: '#2b1606', rim: '#f3c99a' },
    silver: { label: 'Argent', g: ['#6f7b86', '#eef3f7', '#8f9ba6'], ink: '#1d262e', rim: '#ffffff' },
    gold: { label: 'Or', g: ['#8c6512', '#ffe797', '#c4931b'], ink: '#2d1f00', rim: '#fff3c4' },
    maestro: { label: 'Maestro', g: ['#12062b', '#5b21b6', '#1e0b45'], ink: '#ffd76a', rim: '#f5c542' },
    elite: { label: "Arbitre d'élite", g: ['#022c2b', '#0d9488', '#042f2e'], ink: '#e6fffb', rim: '#5eead4' }
  };

  const ATTRS = ['ATT', 'COL', 'DEF', 'INT', 'ARB', 'MIX'];
  const ATTR_LABELS = { ATT: 'ATT', COL: 'PAS', DEF: 'DEF', INT: 'INT', ARB: 'ARB', MIX: 'MIX' };

  /* ---------------- Utilitaires ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const other = (k) => (k === 'a' ? 'b' : 'a');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function textOn(hex) {
    const h = String(hex || '#777777').replace('#', '');
    const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    const r = parseInt(n.slice(0, 2), 16) / 255;
    const g = parseInt(n.slice(2, 4), 16) / 255;
    const b = parseInt(n.slice(4, 6), 16) / 255;
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.45 ? '#111111' : '#ffffff';
  }

  function fmtClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function fmtSec(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    return Math.floor(s / 60) + "'" + String(s % 60).padStart(2, '0');
  }

  function teamStyle(t) {
    return t ? `--c:${t.color};--tc:${textOn(t.color)}` : '--c:#555;--tc:#fff';
  }

  function chip(t, extra = '') {
    if (!t) return '<span class="chip" style="--c:#555;--tc:#fff">?</span>';
    return `<span class="chip ${extra}" style="${teamStyle(t)}">${esc(t.name)}</span>`;
  }

  /* ---------------- État & persistance ---------------- */
  function freshState() {
    return {
      version: 1,
      settings: { ...DEFAULT_SETTINGS },
      teams: [],
      matches: [],
      currentMatchId: null,
      timer: { running: false, endAt: 0 },
      tab: 'tournoi',
      cardTeam: 'all',
      createdAt: Date.now()
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return freshState();
      const s = JSON.parse(raw);
      const f = freshState();
      return {
        ...f,
        ...s,
        settings: { ...f.settings, ...(s.settings || {}) },
        timer: { ...f.timer, ...(s.timer || {}) },
        teams: Array.isArray(s.teams) ? s.teams : [],
        matches: Array.isArray(s.matches) ? s.matches : []
      };
    } catch (e) {
      return freshState();
    }
  }

  let state = load();
  let saveWarned = false;

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      if (!saveWarned) {
        saveWarned = true;
        toast('⚠️ Impossible d\'enregistrer sur l\'appareil (stockage plein ou bloqué)');
      }
    }
  }

  const durationMs = () => Math.round(state.settings.duration * 1000);
  const teamById = (id) => state.teams.find((t) => t.id === id) || null;
  const cur = () => state.matches.find((m) => m.id === state.currentMatchId) || null;
  const teamOf = (m, side) => teamById(side === 'a' ? m.a : m.b);

  function playerById(pid) {
    for (const t of state.teams) {
      const p = t.players.find((x) => x.id === pid);
      if (p) return { p, t };
    }
    return null;
  }

  function pLabel(p, t) {
    if (!p) return '?';
    if (state.settings.displayMode === 'names' && p.name && p.name.trim()) return p.name.trim();
    return `${t ? t.name : ''} ${p.bib}`.trim();
  }

  function pLabelById(pid) {
    const r = playerById(pid);
    return r ? pLabel(r.p, r.t) : '?';
  }

  /* ---------------- Création des équipes & rotation ---------------- */
  function makeTeam(index, nPlayers) {
    const used = new Set(state.teams.map((t) => t.color));
    let c = COLORS[index % COLORS.length];
    if (used.has(c.hex)) c = COLORS.find((x) => !used.has(x.hex)) || c;
    return {
      id: uid(),
      name: c.name,
      color: c.hex,
      players: Array.from({ length: nPlayers }, (_, k) => ({ id: uid(), bib: k + 1, name: '', gender: '' }))
    };
  }

  function roundRobin(ids) {
    const t = ids.slice();
    if (t.length % 2) t.push(null);
    const n = t.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = t[i];
        const b = t[n - 1 - i];
        if (a !== null && b !== null) pairs.push(r % 2 ? [b, a] : [a, b]);
      }
      rounds.push(pairs);
      t.splice(1, 0, t.pop());
    }
    return rounds;
  }

  function newMatch(slot, field, a, b, ref) {
    return {
      id: uid(),
      slot,
      field,
      a,
      b,
      ref,
      status: 'pending',
      events: [],
      refRating: null,
      possession: 'a',
      attempt: 1,
      sideA: 'left',
      remaining: durationMs(),
      warned: {},
      undo: [],
      startedAt: null,
      endedAt: null
    };
  }

  function buildSchedule(teams, fields, doubleLeg) {
    const ids = teams.map((t) => t.id);
    if (ids.length < 2) return [];
    let pairs = roundRobin(ids).flat();
    if (doubleLeg) pairs = pairs.concat(roundRobin(ids).flat().map(([a, b]) => [b, a]));
    const remaining = pairs.map(([a, b]) => ({ a, b }));
    const refCount = Object.fromEntries(ids.map((id) => [id, 0]));
    const playCount = Object.fromEntries(ids.map((id) => [id, 0]));
    let lastPlayed = new Set();
    let lastRef = new Set();
    const matches = [];
    let slot = 0;

    while (remaining.length) {
      slot++;
      const busy = new Set();
      const slotMatches = [];
      for (let f = 0; f < fields; f++) {
        let best = -1;
        let bestScore = Infinity;
        remaining.forEach((m, idx) => {
          if (busy.has(m.a) || busy.has(m.b)) return;
          const backToBack = (lastPlayed.has(m.a) ? 1 : 0) + (lastPlayed.has(m.b) ? 1 : 0);
          const score = backToBack * 1000 + (playCount[m.a] + playCount[m.b]) * 10 + idx;
          if (score < bestScore) {
            bestScore = score;
            best = idx;
          }
        });
        if (best < 0) break;
        const m = remaining.splice(best, 1)[0];
        busy.add(m.a);
        busy.add(m.b);
        playCount[m.a]++;
        playCount[m.b]++;
        slotMatches.push(m);
      }
      const idle = ids.filter((id) => !busy.has(id));
      const refs = new Set();
      slotMatches.forEach((m, f) => {
        const cand = idle
          .filter((id) => !refs.has(id))
          .sort((x, y) => refCount[x] - refCount[y] || (lastRef.has(x) ? 1 : 0) - (lastRef.has(y) ? 1 : 0));
        const ref = cand.length ? cand[0] : null;
        if (ref) {
          refs.add(ref);
          refCount[ref]++;
        }
        matches.push(newMatch(slot, f + 1, m.a, m.b, ref));
      });
      lastPlayed = busy;
      lastRef = refs;
    }
    return matches;
  }

  function readSetupForm() {
    const s = state.settings;
    s.teamCount = parseInt($('#setTeamCount').value, 10) || 4;
    s.playersPerTeam = parseInt($('#setPlayers').value, 10) || 4;
    s.fields = parseInt($('#setFields').value, 10) || 1;
    s.doubleLeg = $('#setDouble').checked;
    const d = parseFloat(String($('#setDuration').value).replace(',', '.'));
    if (d > 0) s.duration = Math.round(clamp(d, 1, 30) * 60);
  }

  function hasPlayedMatches() {
    return state.matches.some((m) => m.status !== 'pending' || m.events.length);
  }

  function createTournament() {
    readSetupForm();
    if (state.teams.length && !confirm('Recréer les équipes et la rotation ?\nLes équipes, prénoms et résultats actuels seront effacés.')) return;
    stopTimerSilently();
    state.teams = [];
    for (let i = 0; i < state.settings.teamCount; i++) state.teams.push(makeTeam(i, state.settings.playersPerTeam));
    state.matches = buildSchedule(state.teams, state.settings.fields, state.settings.doubleLeg);
    state.currentMatchId = state.matches.length ? state.matches[0].id : null;
    save();
    renderAll();
    toast(`✅ ${state.teams.length} équipes et ${state.matches.length} rencontres créées`);
  }

  function regenSchedule() {
    readSetupForm();
    if (state.teams.length < 2) {
      toast('Il faut au moins 2 équipes');
      return;
    }
    if (hasPlayedMatches() && !confirm('Des matchs ont déjà été joués.\nRégénérer la rotation efface tous les résultats. Continuer ?')) return;
    stopTimerSilently();
    state.matches = buildSchedule(state.teams, state.settings.fields, state.settings.doubleLeg);
    state.currentMatchId = state.matches.length ? state.matches[0].id : null;
    save();
    renderAll();
    toast(`🔁 Rotation régénérée : ${state.matches.length} rencontres`);
  }

  /* ---------------- Score & statistiques ---------------- */
  function tryPoints(m) {
    const counts = {};
    const pts = {};
    for (const e of m.events) {
      if (e.type !== 'try') continue;
      const key = e.player || 'inconnu-' + e.team;
      counts[key] = (counts[key] || 0) + 1;
      pts[e.id] = counts[key] === 1 ? 10 : 1;
    }
    return pts;
  }

  function matchScore(m) {
    const pts = tryPoints(m);
    const sc = { a: 0, b: 0 };
    for (const e of m.events) if (e.type === 'try') sc[e.team] += pts[e.id];
    return sc;
  }

  function isStarted(m) {
    return m.status === 'done' || (m.status === 'live' && (m.events.length > 0 || m.remaining < durationMs() || m.startedAt));
  }

  function computeStats() {
    const st = {};
    for (const t of state.teams) {
      for (const p of t.players) {
        st[p.id] = {
          matches: 0, tries: 0, points: 0, tryMatches: 0, assists: 0, assistedTries: 0, solo: 0,
          tags: 0, ints: 0, fouls: 0, refs: 0, refRatingSum: 0, refRated: 0, crossAssists: 0, crossReceived: 0
        };
      }
    }
    const gender = (pid) => {
      const r = playerById(pid);
      return r ? r.p.gender : '';
    };
    for (const m of state.matches) {
      if (!isStarted(m)) continue;
      for (const side of ['a', 'b']) {
        const t = teamOf(m, side);
        if (t) t.players.forEach((p) => st[p.id] && st[p.id].matches++);
      }
      if (m.status === 'done' && m.ref) {
        const rt = teamById(m.ref);
        if (rt) {
          rt.players.forEach((p) => {
            if (!st[p.id]) return;
            st[p.id].refs++;
            if (m.refRating) {
              st[p.id].refRatingSum += m.refRating;
              st[p.id].refRated++;
            }
          });
        }
      }
      const pts = tryPoints(m);
      for (const e of m.events) {
        if (e.type === 'try' && e.player && st[e.player]) {
          const s = st[e.player];
          s.tries++;
          s.points += pts[e.id];
          if (pts[e.id] === 10) s.tryMatches++;
          if (e.assist && st[e.assist]) {
            st[e.assist].assists++;
            s.assistedTries++;
            const g1 = gender(e.assist);
            const g2 = gender(e.player);
            if (g1 && g2 && g1 !== g2) {
              st[e.assist].crossAssists++;
              s.crossReceived++;
            }
          } else {
            s.solo++;
          }
        } else if (e.type === 'tag' && e.defender && st[e.defender]) {
          st[e.defender].tags++;
        } else if (e.type === 'intercept' && e.player && st[e.player]) {
          st[e.player].ints++;
        } else if (e.type === 'foul' && e.player && st[e.player]) {
          st[e.player].fouls++;
        }
      }
    }
    return st;
  }

  function teamMixMap(stats) {
    const map = {};
    for (const t of state.teams) {
      map[t.id] = t.players.length > 0 && t.players.every((p) => stats[p.id] && stats[p.id].tries > 0);
    }
    return map;
  }

  const rate = (x, k) => Math.round(50 + 49 * (1 - Math.exp(-Math.max(0, x) / k)));

  function ratings(s, teamMix) {
    const avgRef = s.refRated ? s.refRatingSum / s.refRated : 2;
    const ATT = rate(s.tries + s.tryMatches * 0.5, 4);
    const COL = clamp(rate(s.assists * 1.3 + s.assistedTries * 0.5, 3.5) - Math.min(8, Math.max(0, s.solo - s.assists) * 1.5), 50, 99);
    const DEF = rate(s.tags, 4);
    const INT = rate(s.ints * 1.4, 3);
    const ARB = clamp(rate(s.refs * (avgRef / 2) * 1.5, 3) - s.fouls * 3, 50, 99);
    const MIX = rate(s.crossAssists * 1.5 + s.crossReceived * 1.5 + (s.tries > 0 ? 1.5 : 0) + (teamMix ? 3 : 0) + s.matches * 0.3, 5);
    const OVR = Math.round(ATT * 0.2 + COL * 0.2 + DEF * 0.18 + INT * 0.12 + ARB * 0.15 + MIX * 0.15);
    return { ATT, COL, DEF, INT, ARB, MIX, OVR };
  }

  function buildCards() {
    const stats = computeStats();
    const mixMap = teamMixMap(stats);
    const maxAssists = Math.max(0, ...Object.values(stats).map((s) => s.assists));
    const cards = [];
    for (const t of state.teams) {
      for (const p of t.players) {
        const s = stats[p.id];
        const r = ratings(s, mixMap[t.id]);
        const actions = s.tries + s.assists + s.tags + s.ints;
        const avgRef = s.refRated ? s.refRatingSum / s.refRated : 0;
        const maestro = s.assists >= 2 && s.assists === maxAssists;
        const elite = s.refs >= 2 && s.refRated > 0 && avgRef >= 2.5 && s.fouls === 0;
        let tier = 'bronze';
        if (r.OVR >= 72 && s.refs >= 1 && s.matches >= 2 && actions >= 4) tier = 'gold';
        else if (s.matches >= 2 && (r.OVR >= 62 || (s.fouls === 0 && actions >= 2))) tier = 'silver';
        if (elite) tier = 'elite';
        if (maestro) tier = 'maestro';
        const badges = [];
        if (maestro) badges.push({ cls: 'mae', txt: 'Maestro' });
        if (elite) badges.push({ cls: 'arb', txt: "Arbitre d'élite" });
        if (mixMap[t.id]) badges.push({ cls: 'mix', txt: 'Mixité' });
        const best = ['ATT', 'COL', 'DEF', 'INT'].reduce((a, k) => (r[k] > r[a] ? k : a), 'ATT');
        const pos = r[best] > 50 ? ATTR_LABELS[best] : 'JEU';
        cards.push({ p, t, s, r, tier, badges, pos, mix: mixMap[t.id] });
      }
    }
    return cards;
  }

  function standings() {
    const S = state.settings;
    const stats = computeStats();
    const mixMap = teamMixMap(stats);
    const rows = state.teams.map((t) => ({ team: t, J: 0, G: 0, N: 0, P: 0, PM: 0, PE: 0, pts: 0, mix: 0, arb: 0, refs: 0 }));
    const byId = Object.fromEntries(rows.map((r) => [r.team.id, r]));
    for (const m of state.matches) {
      if (m.status !== 'done') continue;
      const sc = matchScore(m);
      const ra = byId[m.a];
      const rb = byId[m.b];
      if (ra && rb) {
        ra.J++; rb.J++;
        ra.PM += sc.a; ra.PE += sc.b;
        rb.PM += sc.b; rb.PE += sc.a;
        if (sc.a > sc.b) { ra.G++; rb.P++; ra.pts += S.winPts; rb.pts += S.lossPts; }
        else if (sc.a < sc.b) { rb.G++; ra.P++; rb.pts += S.winPts; ra.pts += S.lossPts; }
        else { ra.N++; rb.N++; ra.pts += S.drawPts; rb.pts += S.drawPts; }
      }
      if (m.ref && byId[m.ref]) {
        const r = byId[m.ref];
        r.refs++;
        if (m.refRating !== 1) r.arb += S.refPts;
        if (m.refRating === 3) r.arb += 1;
      }
    }
    for (const r of rows) {
      r.mix = mixMap[r.team.id] ? S.mixBonus : 0;
      r.diff = r.PM - r.PE;
      r.total = r.pts + r.mix + r.arb;
    }
    rows.sort((x, y) => y.total - x.total || y.diff - x.diff || y.PM - x.PM || x.team.name.localeCompare(y.team.name));
    return rows;
  }

  /* ---------------- Synthèse vocale ---------------- */
  let frVoice = null;

  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = speechSynthesis.getVoices();
    frVoice = voices.find((v) => /^fr(-|_)FR/i.test(v.lang) && v.localService) ||
      voices.find((v) => /^fr(-|_)FR/i.test(v.lang)) ||
      voices.find((v) => /^fr/i.test(v.lang)) || null;
  }

  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.addEventListener ? speechSynthesis.addEventListener('voiceschanged', pickVoice) : (speechSynthesis.onvoiceschanged = pickVoice);
  }

  function speak(text, urgent = false) {
    if (!state.settings.voice || !('speechSynthesis' in window)) return;
    try {
      if (urgent) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      u.rate = state.settings.voiceRate;
      u.volume = 1;
      if (frVoice) u.voice = frVoice;
      speechSynthesis.speak(u);
    } catch (e) { /* synthèse indisponible */ }
  }

  /* ---------------- Son, vibration, flash ---------------- */
  let audioCtx = null;

  function initAudio() {
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { audioCtx = null; }
  }

  function beep(times = 3, freq = 880, len = 0.35) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + i * (len + 0.15));
      g.gain.exponentialRampToValueAtTime(0.5, t0 + i * (len + 0.15) + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * (len + 0.15) + len);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + i * (len + 0.15));
      o.stop(t0 + i * (len + 0.15) + len + 0.02);
    }
  }

  function vibrate(p) {
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* non supporté */ }
  }

  function flash(color) {
    const f = $('#flash');
    f.style.setProperty('--c', color);
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  let toastTimer = null;
  function toast(msg, ms = 2400) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  /* ---------------- Wake Lock (écran allumé) ---------------- */
  let wakeLock = null;

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
          renderWake();
        });
      }
    } catch (e) { wakeLock = null; }
    renderWake();
  }

  async function releaseWakeLock() {
    try { if (wakeLock) await wakeLock.release(); } catch (e) { /* déjà libéré */ }
    wakeLock = null;
    renderWake();
  }

  function renderWake() {
    const el = $('#wakeInfo');
    if (!el) return;
    if (!('wakeLock' in navigator)) el.textContent = state.timer.running ? 'Veille non bloquable' : '';
    else el.textContent = wakeLock ? '🔆 Écran maintenu' : '';
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (state.timer.running) requestWakeLock();
      tick();
    }
  });

  /* ---------------- Chronomètre ---------------- */
  function remainingNow(m) {
    if (state.timer.running && state.currentMatchId === m.id) return Math.max(0, state.timer.endAt - Date.now());
    return m.remaining;
  }

  function elapsedSec(m) {
    return Math.round((durationMs() - remainingNow(m)) / 1000);
  }

  function ensureLive(m) {
    if (m.status === 'pending') m.status = 'live';
    if (!m.startedAt) m.startedAt = Date.now();
  }

  function stopTimerSilently() {
    const m = cur();
    if (m && state.timer.running) m.remaining = remainingNow(m);
    state.timer.running = false;
    releaseWakeLock();
  }

  function playPause() {
    const m = cur();
    if (!guard(m)) return;
    initAudio();
    if (state.timer.running) {
      m.remaining = remainingNow(m);
      state.timer.running = false;
      releaseWakeLock();
      speak('Temps mort.');
      toast('⏸ Chrono en pause');
    } else {
      if (m.remaining <= 0) {
        toast('⏱ Temps écoulé : réinitialisez le chrono (↺) pour rejouer');
        return;
      }
      const firstStart = !m.startedAt && m.events.length === 0;
      ensureLive(m);
      state.timer.running = true;
      state.timer.endAt = Date.now() + m.remaining;
      requestWakeLock();
      if (firstStart) {
        const A = teamOf(m, 'a');
        const B = teamOf(m, 'b');
        const K = teamOf(m, m.possession);
        speak(`Début du match ! ${A.name} contre ${B.name}. Engagement équipe ${K.name}.`, true);
      } else {
        speak('Reprise du jeu.');
      }
    }
    save();
    renderPupitre();
  }

  function resetClock() {
    const m = cur();
    if (!guard(m)) return;
    if (!confirm('Remettre le chronomètre à ' + fmtClock(durationMs()) + ' ?\n(Les actions du match sont conservées.)')) return;
    state.timer.running = false;
    releaseWakeLock();
    m.remaining = durationMs();
    m.warned = {};
    save();
    renderPupitre();
    toast('↺ Chrono réinitialisé');
  }

  const WARNINGS = [
    [120000, 'Plus que 2 minutes !'],
    [60000, 'Plus qu\'une minute !'],
    [30000, 'Trente secondes !'],
    [10000, 'Dix secondes !']
  ];

  function tick() {
    const m = cur();
    if (m && state.timer.running) {
      const r = remainingNow(m);
      for (const [thr, msg] of WARNINGS) {
        if (durationMs() > thr && r <= thr && r > thr - 5000 && !m.warned[thr]) {
          m.warned[thr] = true;
          speak(msg, true);
          if (thr >= 60000) beep(1, 660, 0.2);
          save();
        } else if (r <= thr - 5000 && !m.warned[thr]) {
          m.warned[thr] = true;
        }
      }
      if (r <= 0) endOfMatch(m);
    }
    renderClock();
  }

  function endOfMatch(m) {
    m.remaining = 0;
    state.timer.running = false;
    m.endedAt = Date.now();
    releaseWakeLock();
    save();
    beep(3, 880, 0.45);
    vibrate([400, 150, 400, 150, 600]);
    const A = teamOf(m, 'a');
    const B = teamOf(m, 'b');
    const sc = matchScore(m);
    speak(`Fin du match ! ${A.name} ${sc.a}, ${B.name} ${sc.b}.`, true);
    $('#endScore').innerHTML = `${chip(A)} ${sc.a} – ${sc.b} ${chip(B)}`;
    $('#endOverlay').hidden = false;
    renderPupitre();
  }

  /* ---------------- Actions d'arbitrage ---------------- */
  function guard(m) {
    if (!m) {
      toast('Choisissez d\'abord une rencontre');
      return false;
    }
    if (m.status === 'done') {
      toast('Match validé : rouvrez-le depuis la grille pour le modifier');
      return false;
    }
    return true;
  }

  function snapshot(m) {
    m.undo.push(JSON.stringify({ events: m.events, possession: m.possession, attempt: m.attempt }));
    if (m.undo.length > 80) m.undo.shift();
  }

  let pendingSpot = null;

  function addEvent(m, ev) {
    ev.id = uid();
    ev.t = elapsedSec(m);
    ev.attempt = m.attempt;
    if (pendingSpot) {
      ev.x = pendingSpot.x;
      ev.y = pendingSpot.y;
      pendingSpot = null;
    }
    m.events.push(ev);
    return ev;
  }

  function loseAttempt(type) {
    const m = cur();
    if (!guard(m)) return;
    hideStrip();
    snapshot(m);
    ensureLive(m);
    const atk = m.possession;
    const atkTeam = teamOf(m, atk);
    const ev = addEvent(m, { type, team: atk });
    let msg;
    if (m.attempt >= 4) {
      ev.turnover = true;
      m.possession = other(atk);
      m.attempt = 1;
      const nt = teamOf(m, m.possession);
      msg = type === 'tag'
        ? `Quatrième tag, changement de balle ! Ballon à l'équipe ${nt.name}.`
        : `${LOSS_LABELS[type]}, quatrième tentative. Changement de balle ! Ballon à l'équipe ${nt.name}.`;
      vibrate([120, 60, 120]);
    } else {
      m.attempt++;
      msg = `${LOSS_LABELS[type]}. Tentative ${m.attempt} sur 4.`;
      vibrate(60);
    }
    speak(msg, true);
    flash(getComputedStyle(document.body).getPropertyValue('--' + type).trim() || '#f59e0b');
    save();
    renderPupitre();
    if (type === 'tag') showStrip(ev.id, 'defender', teamOf(m, other(atk)), 'Qui a tagué ? (facultatif)');
    else if (type === 'foul') showStrip(ev.id, 'player', atkTeam, 'Qui a commis la faute ? (facultatif)');
  }

  function intercept() {
    const m = cur();
    if (!guard(m)) return;
    hideStrip();
    snapshot(m);
    ensureLive(m);
    const def = other(m.possession);
    const ev = addEvent(m, { type: 'intercept', team: def });
    m.possession = def;
    m.attempt = 1;
    const t = teamOf(m, def);
    speak(`Interception équipe ${t.name} ! Contre-attaque !`, true);
    vibrate([80, 40, 80]);
    flash(t.color);
    save();
    renderPupitre();
    showStrip(ev.id, 'player', t, 'Qui a intercepté ? (facultatif)');
  }

  function swapPossession() {
    const m = cur();
    if (!guard(m)) return;
    hideStrip();
    snapshot(m);
    m.possession = other(m.possession);
    m.attempt = 1;
    const t = teamOf(m, m.possession);
    speak(`Ballon à l'équipe ${t.name}.`, true);
    save();
    renderPupitre();
  }

  function setKickoff(side) {
    const m = cur();
    if (!guard(m)) return;
    if (m.possession === side) return;
    if (m.events.length || m.startedAt) {
      swapPossession();
      return;
    }
    m.possession = side;
    m.attempt = 1;
    save();
    renderPupitre();
    toast(`Engagement : ${teamOf(m, side).name}`);
  }

  function undo() {
    const m = cur();
    if (!m) return;
    if (m.status === 'done') {
      toast('Match validé : rouvrez-le depuis la grille');
      return;
    }
    if (!m.undo.length) {
      toast('Rien à annuler');
      return;
    }
    const s = JSON.parse(m.undo.pop());
    m.events = s.events;
    m.possession = s.possession;
    m.attempt = s.attempt;
    hideStrip();
    save();
    renderPupitre();
    speak('Action annulée.', true);
    toast('↩️ Dernière action annulée');
  }

  function swapSides() {
    const m = cur();
    if (!m) return;
    m.sideA = m.sideA === 'left' ? 'right' : 'left';
    save();
    renderField();
    toast('⇄ Côtés inversés');
  }

  /* ---------------- Modale ESSAI ---------------- */
  let tryDraft = null;

  function openTry() {
    const m = cur();
    if (!guard(m)) return;
    hideStrip();
    tryDraft = { team: m.possession, scorer: null, assist: null, step: 1 };
    renderTryModal();
  }

  function renderTryModal() {
    const m = cur();
    const t = teamOf(m, tryDraft.team);
    const ot = teamOf(m, other(tryDraft.team));
    const pts = tryPoints(m);
    const already = (pid) => m.events.some((e) => e.type === 'try' && e.player === pid && pts[e.id]);
    let body = '';
    if (tryDraft.step === 1) {
      body = `
        <h2>🏉 Essai ${chip(t)} — qui a marqué ?</h2>
        <p class="muted">1er essai du joueur dans ce match : <b>10 points</b> · essais suivants : <b>1 point</b>.</p>
        <div class="pgrid">${t.players.map((p) => playerBtn(p, t, 'pickScorer', already(p.id) ? '+1 pt' : '+10 pts')).join('')}</div>
        <div class="modal-team-switch">
          <button class="btn small" data-act="tryTeam">C'est un essai de l'équipe ${esc(ot.name)}</button>
          <button class="btn small" data-act="closeModal">Annuler</button>
        </div>`;
    } else {
      const sc = playerById(tryDraft.scorer);
      body = `
        <h2>🤝 Passe décisive ?</h2>
        <p class="muted">Essai de <b>${esc(pLabel(sc.p, sc.t))}</b>. Touchez le passeur, ou « Sans passeur ».</p>
        <div class="pgrid">
          ${t.players.filter((p) => p.id !== tryDraft.scorer).map((p) => playerBtn(p, t, 'pickAssist', 'Passeur')).join('')}
          <button class="pbtn none" data-act="pickAssist" data-pid="">
            <span class="num">∅</span><span class="nm">Sans passeur</span>
          </button>
        </div>
        <div class="modal-team-switch">
          <button class="btn small" data-act="tryBack">← Changer de marqueur</button>
          <button class="btn small" data-act="closeModal">Annuler</button>
        </div>`;
    }
    openModal(body);
  }

  function playerBtn(p, t, act, sub) {
    const nm = state.settings.displayMode === 'names' && p.name ? p.name : t.name;
    return `<button class="pbtn" style="${teamStyle(t)}" data-act="${act}" data-pid="${p.id}">
      <span class="num">${esc(p.bib)}</span><span class="nm">${esc(nm)}</span>${sub ? `<span class="nm">${esc(sub)}</span>` : ''}
    </button>`;
  }

  function confirmTry() {
    const m = cur();
    if (!guard(m)) return;
    snapshot(m);
    ensureLive(m);
    const ev = addEvent(m, { type: 'try', team: tryDraft.team, player: tryDraft.scorer, assist: tryDraft.assist || null });
    const pts = tryPoints(m)[ev.id];
    m.possession = other(tryDraft.team);
    m.attempt = 1;
    const t = teamOf(m, tryDraft.team);
    const sc = matchScore(m);
    const A = teamOf(m, 'a');
    const B = teamOf(m, 'b');
    const who = pLabelById(tryDraft.scorer);
    const passe = tryDraft.assist ? ` Passe décisive de ${pLabelById(tryDraft.assist)}.` : '';
    speak(`Essai équipe ${t.name} ! ${pts === 10 ? 'Premier essai de ' + who + ', 10 points.' : who + ', 1 point.'}${passe} ${A.name} ${sc.a}, ${B.name} ${sc.b}.`, true);
    vibrate([200, 80, 200]);
    flash(t.color);
    closeModal();
    tryDraft = null;
    save();
    renderPupitre();
    toast(`🏉 Essai ${t.name} (+${pts})`);
  }

  /* ---------------- Bandeau de sélection rapide (facultatif) ---------------- */
  let stripTimer = null;
  let stripCtx = null;

  function showStrip(eventId, field, team, title) {
    stripCtx = { eventId, field };
    $('#stripTitle').textContent = title;
    $('#stripPlayers').innerHTML = team.players.map((p) => playerBtn(p, team, 'stripPick', '')).join('');
    const bar = $('#stripBar');
    bar.classList.remove('run');
    bar.style.transitionDuration = '0s';
    bar.style.width = '100%';
    $('#strip').hidden = false;
    void bar.offsetWidth;
    bar.style.transitionDuration = '7s';
    bar.classList.add('run');
    bar.style.width = '0%';
    clearTimeout(stripTimer);
    stripTimer = setTimeout(hideStrip, 7000);
  }

  function hideStrip() {
    clearTimeout(stripTimer);
    stripCtx = null;
    const s = $('#strip');
    if (s) s.hidden = true;
  }

  function stripPick(pid) {
    const m = cur();
    if (!m || !stripCtx) return;
    const ev = m.events.find((e) => e.id === stripCtx.eventId);
    if (ev) {
      ev[stripCtx.field] = pid;
      save();
      renderLog();
      toast(`✔ ${pLabelById(pid)}`);
    }
    hideStrip();
  }

  /* ---------------- Modale générique ---------------- */
  function openModal(html) {
    $('#modalBox').innerHTML = html;
    $('#modal').hidden = false;
  }

  function closeModal() {
    $('#modal').hidden = true;
    $('#modalBox').innerHTML = '';
  }

  /* ---------------- Validation de match ---------------- */
  let validateDraft = null;

  function openValidate() {
    const m = cur();
    if (!m) {
      toast('Aucune rencontre sélectionnée');
      return;
    }
    if (m.status === 'done') {
      toast('Ce match est déjà validé');
      return;
    }
    $('#endOverlay').hidden = true;
    validateDraft = { rating: m.refRating || null };
    renderValidate();
  }

  function renderValidate() {
    const m = cur();
    const A = teamOf(m, 'a');
    const B = teamOf(m, 'b');
    const R = m.ref ? teamById(m.ref) : null;
    const sc = matchScore(m);
    const stars = [1, 2, 3].map((n) => `<button data-act="rate" data-n="${n}" class="${validateDraft.rating && n <= validateDraft.rating ? 'on' : ''}" aria-label="${n} étoile(s)">⭐</button>`).join('');
    openModal(`
      <h2>✅ Valider le match</h2>
      <div class="big-score">${chip(A)} ${sc.a} – ${sc.b} ${chip(B)}</div>
      ${R ? `<p>Qualité de l'arbitrage de l'équipe ${chip(R, 'ref')} (rigueur, placement, annonces) :</p>
        <div class="stars">${stars}</div>
        <p class="hint">1★ arbitrage à revoir (0 pt) · 2★ correct (+${state.settings.refPts} pt) · 3★ excellent (+${state.settings.refPts + 1} pts). Sans note : +${state.settings.refPts} pt.</p>` :
        '<p class="muted">Pas d\'équipe arbitre sur ce créneau (enseignant ou auto-arbitrage).</p>'}
      <div class="btn-row center">
        <button class="btn primary big" data-act="confirmValidate">Valider le résultat</button>
        <button class="btn big" data-act="closeModal">Annuler</button>
      </div>`);
  }

  function confirmValidate() {
    const m = cur();
    if (!m) return;
    if (state.timer.running) {
      m.remaining = remainingNow(m);
      state.timer.running = false;
      releaseWakeLock();
    }
    ensureLive(m);
    m.status = 'done';
    m.refRating = validateDraft ? validateDraft.rating : null;
    m.endedAt = m.endedAt || Date.now();
    closeModal();
    hideStrip();
    save();
    const next = state.matches.find((x) => x.status !== 'done' && x.id !== m.id);
    renderAll();
    if (next) {
      openModal(`
        <h2>✅ Résultat enregistré</h2>
        <p>Rencontre suivante : créneau ${next.slot}, terrain ${next.field}</p>
        <div class="big-score">${chip(teamById(next.a))} <span class="muted">vs</span> ${chip(teamById(next.b))}</div>
        <p class="center muted">Arbitre : ${next.ref ? chip(teamById(next.ref), 'ref') : 'enseignant'}</p>
        <div class="btn-row center">
          <button class="btn primary big" data-act="openMatch" data-id="${next.id}">▶ Passer au match suivant</button>
          <button class="btn big" data-act="closeModal">Rester ici</button>
        </div>`);
    } else {
      toast('🏁 Tous les matchs sont validés !');
    }
  }

  function openMatch(id) {
    if (state.currentMatchId !== id && state.timer.running) {
      if (!confirm('Le chronomètre du match en cours tourne.\nLe mettre en pause et changer de rencontre ?')) {
        renderPupitre();
        return;
      }
      stopTimerSilently();
    }
    state.currentMatchId = id;
    pendingSpot = null;
    hideStrip();
    closeModal();
    $('#endOverlay').hidden = true;
    save();
    goTab('pupitre');
  }

  function reopenMatch(id) {
    const m = state.matches.find((x) => x.id === id);
    if (!m) return;
    if (!confirm('Rouvrir ce match pour corriger les actions ?\nIl ne comptera plus au classement tant qu\'il ne sera pas revalidé.')) return;
    m.status = 'live';
    save();
    openMatch(id);
  }

  /* ---------------- Rendu : en-tête & navigation ---------------- */
  function goTab(tab) {
    state.tab = tab;
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== tab; });
    $$('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    save();
    renderActive();
    window.scrollTo({ top: 0 });
  }

  function renderHeader() {
    const s = state.settings;
    document.body.classList.toggle('sun', !!s.sun);
    $('#btnSun').classList.toggle('on', !!s.sun);
    $('#btnVoice').classList.toggle('on', !!s.voice);
    $('#btnVoice').textContent = s.voice ? '🔊' : '🔇';
    $('#btnMode').textContent = s.displayMode === 'names' ? 'Aa' : '#';
    $('#btnMode').classList.toggle('on', s.displayMode === 'names');
    const done = state.matches.filter((m) => m.status === 'done').length;
    $('#brandSub').textContent = state.teams.length
      ? `${state.teams.length} équipes · ${done}/${state.matches.length} matchs joués`
      : 'Tournoi hors ligne';
    document.querySelector('meta[name=theme-color]').setAttribute('content', s.sun ? '#000000' : '#0b3d2e');
  }

  function renderActive() {
    renderHeader();
    switch (state.tab) {
      case 'tournoi': renderTournoi(); break;
      case 'equipes': renderEquipes(); break;
      case 'pupitre': renderPupitre(); break;
      case 'classement': renderClassement(); break;
      case 'cartes': renderCartes(); break;
      case 'reglages': renderReglages(); break;
      default: renderTournoi();
    }
  }

  function renderAll() {
    renderActive();
  }

  /* ---------------- Rendu : tournoi ---------------- */
  function renderTournoi() {
    const s = state.settings;
    $('#setTeamCount').value = String(state.teams.length || s.teamCount);
    $('#setPlayers').value = String(clamp(s.playersPerTeam, 3, 5));
    $('#setFields').value = String(s.fields);
    $('#setDuration').value = String(s.duration / 60);
    $('#setDouble').checked = !!s.doubleLeg;

    const box = $('#rotation');
    if (!state.matches.length) {
      $('#rotationInfo').textContent = '';
      box.innerHTML = '<p class="muted">Aucune rotation. Choisissez le nombre d\'équipes puis « Créer équipes + rotation ».</p>';
      return;
    }
    const slots = {};
    state.matches.forEach((m) => (slots[m.slot] = slots[m.slot] || []).push(m));
    const nSlots = Object.keys(slots).length;
    const minutes = Math.round((nSlots * (s.duration + 60)) / 60);
    $('#rotationInfo').textContent = `${state.matches.length} matchs · ${nSlots} créneaux · ≈ ${minutes} min (avec 1 min de rotation)`;

    box.innerHTML = Object.keys(slots).map((k) => {
      const ms = slots[k];
      const busy = new Set(ms.flatMap((m) => [m.a, m.b, m.ref]));
      const rest = state.teams.filter((t) => !busy.has(t.id));
      return `<div class="slot">
        <div class="slot-head">
          <span class="slot-title">⏱ Créneau ${k} <span class="muted">· ${fmtClock(s.duration * 1000)}</span></span>
          ${rest.length ? `<span class="slot-rest">Observation / repos : ${rest.map((t) => chip(t, 'ref')).join(' ')}</span>` : ''}
        </div>
        ${ms.map((m) => {
          const A = teamById(m.a);
          const B = teamById(m.b);
          const R = m.ref ? teamById(m.ref) : null;
          const sc = matchScore(m);
          const st = m.status === 'done' ? '<span class="status done">Terminé</span>' : m.status === 'live' ? '<span class="status live">En cours</span>' : '<span class="status">À jouer</span>';
          const btn = m.status === 'done'
            ? `<button class="btn small" data-act="reopenMatch" data-id="${m.id}">Rouvrir</button>`
            : `<button class="btn small primary" data-act="openMatch" data-id="${m.id}">Arbitrer ▶</button>`;
          return `<div class="match-row ${m.status} ${m.id === state.currentMatchId ? 'current' : ''}">
            <div class="mr-field">T${m.field}</div>
            <div class="mr-teams">${chip(A)} ${m.status === 'pending' ? '<span class="muted">vs</span>' : `<span class="mr-score">${sc.a} – ${sc.b}</span>`} ${chip(B)} ${st}</div>
            <div>${btn}</div>
            <div class="mr-ref" style="grid-column:1/-1">🟨 Arbitre / observateur : ${R ? chip(R, 'ref') : '<b>Enseignant / auto-arbitrage</b>'}${m.refRating ? ' · ' + '⭐'.repeat(m.refRating) : ''}</div>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');
  }

  /* ---------------- Rendu : équipes ---------------- */
  function renderEquipes() {
    $('#segBibs').classList.toggle('on', state.settings.displayMode === 'bibs');
    $('#segNames').classList.toggle('on', state.settings.displayMode === 'names');
    const box = $('#teamsEditor');
    if (!state.teams.length) {
      box.innerHTML = '<div class="panel empty"><p class="muted">Aucune équipe. Créez le tournoi dans l\'onglet Tournoi ou ajoutez une équipe.</p></div>';
      return;
    }
    box.innerHTML = state.teams.map((t) => `
      <div class="panel team-card" style="${teamStyle(t)}">
        <div class="team-head">
          <input type="text" value="${esc(t.name)}" data-tfield="name" data-tid="${t.id}" aria-label="Nom de l'équipe" maxlength="24">
          <span class="chip" style="${teamStyle(t)}">${t.players.length} joueurs</span>
          <button class="del" data-act="delTeam" data-tid="${t.id}" aria-label="Supprimer l'équipe">🗑</button>
        </div>
        <div class="color-pick">
          ${COLORS.map((c) => `<button style="--c:${c.hex}" class="${c.hex === t.color ? 'on' : ''}" data-act="teamColor" data-tid="${t.id}" data-hex="${c.hex}" data-cname="${c.name}" aria-label="${c.name}"></button>`).join('')}
        </div>
        ${t.players.map((p) => `
          <div class="player-row">
            <input type="number" min="0" max="99" value="${esc(p.bib)}" data-pfield="bib" data-pid="${p.id}" aria-label="Dossard" inputmode="numeric">
            <input type="text" value="${esc(p.name)}" placeholder="${esc(t.name + ' ' + p.bib)}" data-pfield="name" data-pid="${p.id}" aria-label="Prénom" maxlength="20" autocomplete="off" autocapitalize="words">
            <span class="gender" role="group" aria-label="Genre">
              <button data-act="gender" data-pid="${p.id}" data-g="F" class="${p.gender === 'F' ? 'on' : ''}">F</button>
              <button data-act="gender" data-pid="${p.id}" data-g="G" class="${p.gender === 'G' ? 'on' : ''}">G</button>
            </span>
            <button class="del" data-act="delPlayer" data-pid="${p.id}" aria-label="Retirer le joueur">✕</button>
          </div>`).join('')}
        <div class="btn-row"><button class="btn small" data-act="addPlayer" data-tid="${t.id}">➕ Joueur</button></div>
      </div>`).join('');
  }

  /* ---------------- Rendu : pupitre ---------------- */
  function renderMatchSelect() {
    const sel = $('#matchSelect');
    if (!state.matches.length) {
      sel.innerHTML = '<option value="">— Aucune rencontre —</option>';
      return;
    }
    sel.innerHTML = state.matches.map((m) => {
      const A = teamById(m.a);
      const B = teamById(m.b);
      const sc = matchScore(m);
      const mark = m.status === 'done' ? '✅' : m.status === 'live' ? '🟠' : '⚪';
      const score = m.status === 'pending' ? '' : ` (${sc.a}-${sc.b})`;
      return `<option value="${m.id}" ${m.id === state.currentMatchId ? 'selected' : ''}>${mark} C${m.slot} · T${m.field} · ${esc(A ? A.name : '?')} vs ${esc(B ? B.name : '?')}${score}</option>`;
    }).join('');
  }

  function renderPupitre() {
    renderMatchSelect();
    const m = cur();
    $('#pupEmpty').hidden = !!m;
    $('#pupBody').hidden = !m;
    if (!m) return;
    const A = teamOf(m, 'a');
    const B = teamOf(m, 'b');
    const R = m.ref ? teamById(m.ref) : null;
    $('#refInfo').innerHTML = `🟨 Arbitre : ${R ? chip(R, 'ref') : 'enseignant'} ${m.status === 'done' ? '<span class="status done">Validé</span>' : ''}`;
    const sc = matchScore(m);
    for (const [side, T, el] of [['a', A, $('#sbA')], ['b', B, $('#sbB')]]) {
      el.style.cssText = teamStyle(T);
      el.querySelector('.sb-name').textContent = T ? T.name : '?';
      el.querySelector('.sb-score').textContent = sc[side];
      el.classList.toggle('poss', m.possession === side);
      el.setAttribute('aria-label', `${T ? T.name : ''} : ${sc[side]} points${m.possession === side ? ', en possession' : ''}`);
    }
    const P = teamOf(m, m.possession);
    const att = $('#attempts');
    att.style.cssText = teamStyle(P);
    $('#attLabel').innerHTML = `${chip(P)} attaque — tentative <b>${m.attempt}/4</b>${m.attempt === 4 ? ' · <span style="color:var(--danger)">DERNIÈRE !</span>' : ''}`;
    $$('.att-gauge span').forEach((s) => {
      const n = +s.dataset.n;
      s.className = n < m.attempt ? 'used' : n === m.attempt ? 'cur' + (n === 4 ? ' last' : '') : '';
    });
    renderClock();
    renderField();
    renderLog();
    renderWake();
  }

  function renderClock() {
    const m = cur();
    const c = $('#clock');
    if (!m || !c) return;
    const r = remainingNow(m);
    c.textContent = fmtClock(r);
    c.classList.toggle('warn', r <= 60000 && r > 0);
    c.classList.toggle('over', r <= 0);
    const b = $('#btnPlay');
    b.textContent = state.timer.running ? '❚❚' : '▶';
    b.classList.toggle('running', state.timer.running);
  }

  const FIELD_FALLBACK = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 896">
      <rect width="1400" height="896" fill="#bcd55a"/>
      <rect x="20" y="20" width="1360" height="856" fill="none" stroke="#25406f" stroke-width="16"/>
      <rect x="70" y="70" width="1260" height="756" fill="none" stroke="#fff" stroke-width="10"/>
      <rect x="78" y="78" width="120" height="740" fill="#283f6e"/>
      <rect x="1202" y="78" width="120" height="740" fill="#283f6e"/>
      <line x1="700" y1="70" x2="700" y2="826" stroke="#fff" stroke-width="10"/>
      <line x1="450" y1="70" x2="450" y2="826" stroke="#fff" stroke-width="4" stroke-dasharray="20 18"/>
      <line x1="950" y1="70" x2="950" y2="826" stroke="#fff" stroke-width="4" stroke-dasharray="20 18"/>
      <text x="138" y="448" fill="#fff" font-family="Arial" font-weight="bold" font-size="48" text-anchor="middle" transform="rotate(-90 138 448)">EN-BUT</text>
      <text x="1262" y="448" fill="#fff" font-family="Arial" font-weight="bold" font-size="48" text-anchor="middle" transform="rotate(90 1262 448)">EN-BUT</text>
    </svg>`);

  function renderField() {
    const m = cur();
    const ov = $('#fieldOverlay');
    if (!m || !ov) return;
    const A = teamOf(m, 'a');
    const B = teamOf(m, 'b');
    const left = m.sideA === 'left' ? A : B;
    const right = m.sideA === 'left' ? B : A;
    const P = teamOf(m, m.possession);
    const attacksRight = (m.possession === 'a') === (m.sideA === 'left');
    const markers = m.events.filter((e) => e.x != null).map((e) => {
      const t = teamOf(m, e.team);
      const icon = { try: '★', tag: '✕', ground: '•', touch: '⇥', foul: '!', intercept: '⚡' }[e.type] || '•';
      return `<span class="mk ${e.type}" style="left:${e.x}%;top:${e.y}%;${teamStyle(t)}" title="${esc(e.type)}">${icon}</span>`;
    }).join('');
    ov.innerHTML = `
      <span class="ez-label" style="left:6.5%;${teamStyle(left)}">En-but ${esc(left.name)}</span>
      <span class="ez-label right" style="left:93.5%;${teamStyle(right)}">En-but ${esc(right.name)}</span>
      <span class="attack-arrow ${attacksRight ? '' : 'left'}" style="${teamStyle(P)}">
        ${attacksRight ? `${esc(P.name)} attaque <span class="arr">➜</span>` : `<span class="arr">⬅</span> ${esc(P.name)} attaque`}
      </span>
      ${markers}
      ${pendingSpot ? `<span class="spot" style="left:${pendingSpot.x}%;top:${pendingSpot.y}%"></span>` : ''}`;
  }

  function eventText(m, e, pts) {
    const nm = (pid) => (pid ? esc(pLabelById(pid)) : '');
    switch (e.type) {
      case 'try':
        return `<b>Essai</b> ${nm(e.player)} <b>(+${pts[e.id]})</b>${e.assist ? ` · passe ${nm(e.assist)}` : ''}`;
      case 'intercept':
        return `<b>Interception</b>${e.player ? ' par ' + nm(e.player) : ''}`;
      case 'tag':
      case 'ground':
      case 'touch':
      case 'foul':
        return `<b>${LOSS_LABELS[e.type]}</b> — tentative ${e.attempt}/4${e.defender ? ' · tag de ' + nm(e.defender) : ''}${e.type === 'foul' && e.player ? ' · ' + nm(e.player) : ''}${e.turnover ? ' <span class="to">→ changement de balle</span>' : ''}`;
      default:
        return esc(e.type);
    }
  }

  function renderLog() {
    const m = cur();
    if (!m) return;
    const pts = tryPoints(m);
    const items = m.events.slice().reverse();
    $('#logCount').textContent = `${m.events.length} action(s)`;
    $('#log').innerHTML = items.length
      ? items.map((e) => {
        const t = teamOf(m, e.team);
        return `<li><span class="t">${fmtSec(e.t)}</span><span class="dot" style="${teamStyle(t)}">${EVENT_ICONS[e.type] || ''}</span><span>${eventText(m, e, pts)}</span></li>`;
      }).join('')
      : '<li><span></span><span></span><span class="muted">Aucune action pour l\'instant. Choisissez l\'équipe qui engage (touchez son score), puis lancez le chrono ▶.</span></li>';
  }

  /* ---------------- Rendu : classement ---------------- */
  function renderClassement() {
    const S = state.settings;
    const live = state.matches.find((m) => m.status === 'live');
    if (live) {
      const sc = matchScore(live);
      $('#liveBanner').innerHTML = `<div class="live-banner">🟠 En cours : ${chip(teamById(live.a))} ${sc.a} – ${sc.b} ${chip(teamById(live.b))} <span class="muted">(compté après validation)</span></div>`;
    } else {
      $('#liveBanner').innerHTML = '';
    }
    const rows = standings();
    if (!rows.length) {
      $('#standings').innerHTML = '<p class="muted">Aucune équipe.</p>';
    } else {
      $('#standings').innerHTML = `<table class="std">
        <thead><tr><th>#</th><th>Équipe</th><th>J</th><th>G</th><th>N</th><th>P</th><th>PM</th><th>PE</th><th>Diff</th><th>Pts</th><th>Mixité</th><th>Arb.</th><th>Total</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr>
          <td class="rank">${i + 1}</td>
          <td class="team">${chip(r.team)}</td>
          <td>${r.J}</td><td>${r.G}</td><td>${r.N}</td><td>${r.P}</td>
          <td>${r.PM}</td><td>${r.PE}</td><td>${r.diff > 0 ? '+' : ''}${r.diff}</td>
          <td>${r.pts}</td>
          <td>${r.mix ? `<span class="badge-mix">+${r.mix}</span>` : '–'}</td>
          <td>${r.arb}${r.refs ? ` <span class="muted">(${r.refs})</span>` : ''}</td>
          <td class="total">${r.total}</td>
        </tr>`).join('')}</tbody></table>`;
    }
    $('#standingsLegend').innerHTML = `Victoire ${S.winPts} pts · Nul ${S.drawPts} pts · Défaite ${S.lossPts} pt · <b>Bonus mixité +${S.mixBonus}</b> quand tous les membres de l'équipe (filles et garçons) ont marqué au moins un essai · <b>Arbitrage</b> : +${S.refPts} par match arbitré (0 si 1★, +1 si 3★). Départage : total, différence, points marqués.`;

    const cards = buildCards();
    const top = (key, label, unit) => {
      const list = cards.filter((c) => c.s[key] > 0).sort((a, b) => b.s[key] - a.s[key]).slice(0, 5);
      return `<div class="leader"><h4>${label}</h4>${list.length
        ? `<ol>${list.map((c) => `<li>${esc(pLabel(c.p, c.t))} <span class="muted">(${esc(c.t.name)})</span> — <b>${c.s[key]}</b> ${unit}</li>`).join('')}</ol>`
        : '<p class="muted">—</p>'}</div>`;
    };
    $('#leaders').innerHTML =
      top('tries', '🏉 Essais', 'essai(s)') +
      top('assists', '🤝 Passes décisives', 'passe(s)') +
      top('tags', '🏳️ Tags défensifs', 'tag(s)') +
      top('ints', '⚡ Interceptions', 'interc.') +
      top('refs', '🟨 Matchs arbitrés', 'match(s)');
  }

  /* ---------------- Cartes joueurs (CSS) ---------------- */
  function avatarSVG(color, bib) {
    const ink = textOn(color);
    return `<svg viewBox="0 0 200 200" aria-hidden="true">
      <defs><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".15"/></linearGradient></defs>
      <path d="M22 200 C26 140 60 118 100 118 C140 118 174 140 178 200 Z" fill="${color}" stroke="rgba(0,0,0,.45)" stroke-width="4"/>
      <path d="M22 200 C26 140 60 118 100 118 C140 118 174 140 178 200 Z" fill="url(#sh)"/>
      <path d="M78 120 L100 146 L122 120" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="5"/>
      <rect x="40" y="186" width="120" height="10" rx="3" fill="#fff" opacity=".7"/>
      <rect x="40" y="186" width="18" height="10" fill="#e11d48"/><rect x="142" y="186" width="18" height="10" fill="#e11d48"/>
      <circle cx="100" cy="72" r="40" fill="#f1d3b3" stroke="rgba(0,0,0,.35)" stroke-width="4"/>
      <path d="M60 66 C62 36 86 28 100 28 C120 28 140 38 140 66 C130 52 112 48 100 48 C86 48 70 54 60 66 Z" fill="#3b2a20"/>
      <text x="100" y="178" text-anchor="middle" font-family="system-ui,Arial" font-weight="900" font-size="40" fill="${ink}">${esc(bib)}</text>
    </svg>`;
  }

  function cardHTML(c) {
    const name = pLabel(c.p, c.t);
    return `<div class="card tier-${c.tier}" style="--team:${c.t.color};--team-ink:${textOn(c.t.color)}">
      <div class="c-tier">${esc(TIERS[c.tier].label)}</div>
      <div class="c-top">
        <div class="c-ovr">${c.r.OVR}</div>
        <div class="c-pos">${esc(c.pos)}</div>
        <div class="c-flag">${esc(c.p.gender || '')}</div>
        <div class="c-num">#${esc(c.p.bib)}</div>
      </div>
      <div class="c-avatar">${avatarSVG(c.t.color, c.p.bib)}</div>
      <div class="c-name">${esc(name)}</div>
      <div class="c-stats">
        <div><b>${c.r.ATT}</b><span>ATT</span></div>
        <div><b>${c.r.DEF}</b><span>DEF</span></div>
        <div><b>${c.r.COL}</b><span>PAS</span></div>
        <div><b>${c.r.INT}</b><span>INT</span></div>
        <div><b>${c.r.ARB}</b><span>ARB</span></div>
        <div><b>${c.r.MIX}</b><span>MIX</span></div>
      </div>
      <div class="c-badges">${c.badges.map((b) => `<span class="${b.cls}">${esc(b.txt)}</span>`).join('')}</div>
      <div class="c-foot">${esc(c.t.name)} · Tag Rugby EPS</div>
    </div>`;
  }

  function filteredCards() {
    const cards = buildCards();
    return state.cardTeam === 'all' ? cards : cards.filter((c) => c.t.id === state.cardTeam);
  }

  function renderCartes() {
    const sel = $('#cardTeam');
    if (state.cardTeam !== 'all' && !teamById(state.cardTeam)) state.cardTeam = 'all';
    sel.innerHTML = `<option value="all">Toutes les équipes</option>` + state.teams.map((t) => `<option value="${t.id}" ${t.id === state.cardTeam ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    const cards = filteredCards();
    $('#cards').innerHTML = cards.length
      ? cards.map((c) => `<div class="card-cell">${cardHTML(c)}
          <div class="muted small-txt">${c.s.tries} essai(s) · ${c.s.assists} passe(s) · ${c.s.tags} tag(s) · ${c.s.ints} interc. · ${c.s.refs} arb.</div>
          <button class="btn small" data-act="cardPNG" data-pid="${c.p.id}">⬇ Télécharger PNG</button>
        </div>`).join('')
      : '<div class="panel empty"><p class="muted">Aucun joueur. Créez le tournoi pour générer les cartes.</p></div>';
  }

  /* ---------------- Cartes joueurs (Canvas → PNG) ---------------- */
  function shieldPath(g, x, y, w, h) {
    const P = [[0.09, 0], [0.91, 0], [1, 0.05], [1, 0.89], [0.88, 0.96], [0.5, 1], [0.12, 0.96], [0, 0.89], [0, 0.05]];
    g.beginPath();
    P.forEach(([px, py], i) => (i ? g.lineTo(x + px * w, y + py * h) : g.moveTo(x + px * w, y + py * h)));
    g.closePath();
  }

  function fitText(g, text, maxW, size, weight) {
    let s = size;
    do {
      g.font = `${weight} ${s}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
      s -= 2;
    } while (g.measureText(text).width > maxW && s > 16);
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawCard(c) {
    const W = 750;
    const H = 1050;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    const T = TIERS[c.tier];
    const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

    g.save();
    shieldPath(g, 0, 0, W, H);
    g.clip();
    const bg = g.createLinearGradient(0, 0, W * 0.6, H);
    bg.addColorStop(0, T.g[0]);
    bg.addColorStop(0.45, T.g[1]);
    bg.addColorStop(1, T.g[2]);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.08;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 22;
    for (let i = -H; i < W + H; i += 60) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i - H, H);
      g.stroke();
    }
    g.globalAlpha = 1;
    if (c.tier === 'maestro' || c.tier === 'elite') {
      const holo = g.createLinearGradient(0, 0, W, H);
      holo.addColorStop(0.25, 'rgba(255,0,200,0)');
      holo.addColorStop(0.4, 'rgba(255,0,200,.22)');
      holo.addColorStop(0.5, 'rgba(0,255,255,.22)');
      holo.addColorStop(0.6, 'rgba(255,255,0,.22)');
      holo.addColorStop(0.75, 'rgba(255,255,0,0)');
      g.fillStyle = holo;
      g.fillRect(0, 0, W, H);
    }
    const sh = g.createLinearGradient(0, 0, W, H * 0.7);
    sh.addColorStop(0.3, 'rgba(255,255,255,0)');
    sh.addColorStop(0.45, 'rgba(255,255,255,.35)');
    sh.addColorStop(0.6, 'rgba(255,255,255,0)');
    g.fillStyle = sh;
    g.fillRect(0, 0, W, H);
    g.restore();

    g.strokeStyle = T.rim;
    g.lineWidth = 8;
    shieldPath(g, 24, 24, W - 48, H - 48);
    g.stroke();

    g.fillStyle = T.ink;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.font = `900 30px ${FONT}`;
    g.fillText(T.label.toUpperCase(), W - 150, 82);

    g.font = `900 160px ${FONT}`;
    g.fillText(String(c.r.OVR), 160, 225);
    g.font = `900 60px ${FONT}`;
    g.fillText(c.pos, 160, 292);

    g.fillStyle = c.t.color;
    roundRect(g, 100, 318, 120, 76, 12);
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = T.ink;
    g.stroke();
    if (c.p.gender) {
      g.fillStyle = textOn(c.t.color);
      g.font = `900 46px ${FONT}`;
      g.fillText(c.p.gender, 160, 373);
    }
    g.fillStyle = T.ink;
    g.font = `900 46px ${FONT}`;
    g.fillText('#' + c.p.bib, 160, 455);

    const ax = 470;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.35)';
    g.shadowBlur = 20;
    g.shadowOffsetY = 10;
    g.beginPath();
    g.moveTo(ax - 200, 560);
    g.bezierCurveTo(ax - 196, 420, ax - 120, 382, ax, 382);
    g.bezierCurveTo(ax + 120, 382, ax + 196, 420, ax + 200, 560);
    g.closePath();
    g.fillStyle = c.t.color;
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,.4)';
    g.lineWidth = 6;
    g.stroke();
    g.beginPath();
    g.moveTo(ax - 50, 386);
    g.lineTo(ax, 440);
    g.lineTo(ax + 50, 386);
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 9;
    g.stroke();
    g.fillStyle = textOn(c.t.color);
    g.font = `900 92px ${FONT}`;
    g.fillText(String(c.p.bib), ax, 538);
    g.beginPath();
    g.arc(ax, 270, 92, 0, Math.PI * 2);
    g.fillStyle = '#f1d3b3';
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.stroke();
    g.beginPath();
    g.moveTo(ax - 92, 255);
    g.bezierCurveTo(ax - 88, 186, ax - 40, 170, ax, 170);
    g.bezierCurveTo(ax + 46, 170, ax + 92, 192, ax + 92, 255);
    g.bezierCurveTo(ax + 68, 222, ax + 30, 214, ax, 214);
    g.bezierCurveTo(ax - 34, 214, ax - 70, 226, ax - 92, 255);
    g.closePath();
    g.fillStyle = '#3b2a20';
    g.fill();

    const name = pLabel(c.p, c.t).toUpperCase();
    g.fillStyle = T.ink;
    fitText(g, name, W - 140, 66, 900);
    g.fillText(name, W / 2, 640);
    g.fillRect(90, 662, W - 180, 5);

    const stats = [['ATT', c.r.ATT], ['DEF', c.r.DEF], ['PAS', c.r.COL], ['INT', c.r.INT], ['ARB', c.r.ARB], ['MIX', c.r.MIX]];
    stats.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col === 0 ? 150 : 455;
      const y = 740 + row * 72;
      g.textAlign = 'right';
      g.font = `900 64px ${FONT}`;
      g.fillText(String(v), x + 90, y);
      g.textAlign = 'left';
      g.font = `700 46px ${FONT}`;
      g.fillText(k, x + 110, y);
    });
    g.fillRect(W / 2 - 2, 692, 4, 196);

    if (c.badges.length) {
      g.font = `900 26px ${FONT}`;
      const pads = c.badges.map((b) => g.measureText(b.txt.toUpperCase()).width + 36);
      const total = pads.reduce((a, b) => a + b, 0) + (c.badges.length - 1) * 12;
      let x = (W - total) / 2;
      c.badges.forEach((b, i) => {
        const w = pads[i];
        const grad = g.createLinearGradient(x, 0, x + w, 0);
        const cols = b.cls === 'mix' ? ['#ec4899', '#3b82f6'] : b.cls === 'mae' ? ['#7c3aed', '#f59e0b'] : ['#0f766e', '#22d3ee'];
        grad.addColorStop(0, cols[0]);
        grad.addColorStop(1, cols[1]);
        g.fillStyle = grad;
        roundRect(g, x, 912, w, 44, 22);
        g.fill();
        g.fillStyle = '#ffffff';
        g.textAlign = 'center';
        g.fillText(b.txt.toUpperCase(), x + w / 2, 943);
        x += w + 12;
      });
    }
    g.fillStyle = T.ink;
    g.textAlign = 'center';
    g.font = `800 24px ${FONT}`;
    g.globalAlpha = 0.85;
    g.fillText(`${c.t.name.toUpperCase()} · TAG RUGBY EPS`, W / 2, 1000);
    g.globalAlpha = 1;
    return cv;
  }

  function slug(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase() || 'joueur';
  }

  function downloadCardPNG(pid) {
    const c = buildCards().find((x) => x.p.id === pid);
    if (!c) return;
    const cv = drawCard(c);
    const fname = `carte_${slug(pLabel(c.p, c.t))}.png`;
    if (cv.toBlob) {
      cv.toBlob((blob) => downloadBlob(blob, fname), 'image/png');
    } else {
      const a = document.createElement('a');
      a.href = cv.toDataURL('image/png');
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  function downloadBlob(blob, fname) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ---------------- Planche A4 ---------------- */
  function openPrintSheet() {
    const cards = filteredCards();
    if (!cards.length) {
      toast('Aucune carte à imprimer');
      return;
    }
    const pages = [];
    for (let i = 0; i < cards.length; i += 9) pages.push(cards.slice(i, i + 9));
    $('#printSheet').innerHTML = pages.map((pg) => `<div class="print-page">${pg.map((c) => `<div class="print-cell">${cardHTML(c)}</div>`).join('')}</div>`).join('');
    $('#printInfo').textContent = `${cards.length} carte(s) · ${pages.length} page(s) A4 · 9 cartes 63 × 88 mm par page`;
    $('#printPreview').hidden = false;
  }

  /* ---------------- Export CSV (Excel / Pronote) ---------------- */
  function csvCell(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s) && isNaN(Number(s))) s = "'" + s;
    if (/[;"\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(';')).join('\r\n');

  function csvRencontres() {
    const rows = [['Créneau', 'Terrain', 'Équipe A', 'Score A', 'Score B', 'Équipe B', 'Vainqueur', 'Équipe arbitre', 'Note arbitrage (/3)', 'Statut', 'Nb actions', 'Détail des essais']];
    for (const m of state.matches) {
      const A = teamById(m.a);
      const B = teamById(m.b);
      const R = m.ref ? teamById(m.ref) : null;
      const sc = matchScore(m);
      const pts = tryPoints(m);
      const win = m.status === 'pending' ? '' : sc.a > sc.b ? A.name : sc.b > sc.a ? B.name : 'Nul';
      const detail = m.events.filter((e) => e.type === 'try').map((e) => `${fmtSec(e.t)} ${teamOf(m, e.team).name} : ${pLabelById(e.player)} (+${pts[e.id]})${e.assist ? ' passe ' + pLabelById(e.assist) : ''}`).join(' | ');
      rows.push([m.slot, m.field, A ? A.name : '', m.status === 'pending' ? '' : sc.a, m.status === 'pending' ? '' : sc.b, B ? B.name : '', win, R ? R.name : 'Enseignant', m.refRating || '', m.status === 'done' ? 'Terminé' : m.status === 'live' ? 'En cours' : 'À jouer', m.events.length, detail]);
    }
    return toCSV(rows);
  }

  function csvClassement() {
    const rows = [['Rang', 'Équipe', 'Joués', 'Gagnés', 'Nuls', 'Perdus', 'Points marqués', 'Points encaissés', 'Goal-average', 'Points match', 'Bonus mixité', 'Matchs arbitrés', 'Points arbitrage', 'Total']];
    standings().forEach((r, i) => rows.push([i + 1, r.team.name, r.J, r.G, r.N, r.P, r.PM, r.PE, r.diff, r.pts, r.mix, r.refs, r.arb, r.total]));
    return toCSV(rows);
  }

  function csvEleves() {
    const rows = [['Équipe', 'Dossard', 'Prénom', 'Genre', 'Matchs joués', 'Essais', 'Points marqués', 'Matchs avec essai', 'Passes décisives', 'Tags défensifs', 'Interceptions', 'Fautes', 'Matchs arbitrés', 'Note moy. arbitrage', 'ATT', 'PAS/COL', 'DEF', 'INT', 'ARB', 'MIX', 'Note générale (OVR)', 'Carte', 'Badges']];
    for (const c of buildCards()) {
      const s = c.s;
      rows.push([c.t.name, c.p.bib, c.p.name || '', c.p.gender || '', s.matches, s.tries, s.points, s.tryMatches, s.assists, s.tags, s.ints, s.fouls, s.refs,
        s.refRated ? (s.refRatingSum / s.refRated).toFixed(1).replace('.', ',') : '',
        c.r.ATT, c.r.COL, c.r.DEF, c.r.INT, c.r.ARB, c.r.MIX, c.r.OVR, TIERS[c.tier].label, c.badges.map((b) => b.txt).join(', ')]);
    }
    return toCSV(rows);
  }

  function exportCSV(kind) {
    if (!state.teams.length) {
      toast('Rien à exporter : créez d\'abord le tournoi');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    let content;
    switch (kind) {
      case 'rencontres': content = csvRencontres(); break;
      case 'classement': content = csvClassement(); break;
      case 'eleves': content = csvEleves(); break;
      default:
        content = ['RÉSULTATS DES RENCONTRES', csvRencontres(), '', 'CLASSEMENT GÉNÉRAL DES ÉQUIPES', csvClassement(), '', 'BILAN INDIVIDUEL DES ÉLÈVES', csvEleves()].join('\r\n');
        kind = 'complet';
    }
    downloadBlob(new Blob(['﻿' + content + '\r\n'], { type: 'text/csv;charset=utf-8' }), `tag-rugby_${kind}_${date}.csv`);
    toast('📄 Fichier CSV créé');
  }

  /* ---------------- Sauvegarde JSON ---------------- */
  function exportJSON() {
    const date = new Date().toISOString().slice(0, 10);
    stopTimerSilently();
    save();
    downloadBlob(new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }), `tag-rugby_sauvegarde_${date}.json`);
    renderActive();
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(String(reader.result));
        if (!s || !Array.isArray(s.teams) || !Array.isArray(s.matches)) throw new Error('format');
        if (!confirm('Remplacer le tournoi actuel par cette sauvegarde ?')) return;
        const f = freshState();
        state = { ...f, ...s, settings: { ...f.settings, ...(s.settings || {}) }, timer: { running: false, endAt: 0 } };
        save();
        renderAll();
        toast('✅ Sauvegarde restaurée');
      } catch (e) {
        toast('❌ Fichier de sauvegarde invalide');
      }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    if (!confirm('Effacer DÉFINITIVEMENT toutes les données du tournoi sur cet appareil ?')) return;
    if (!confirm('Dernière confirmation : équipes, prénoms, résultats et cartes seront supprimés.')) return;
    stopTimerSilently();
    const keep = { sun: state.settings.sun, voice: state.settings.voice, voiceRate: state.settings.voiceRate };
    state = freshState();
    Object.assign(state.settings, keep);
    save();
    renderAll();
    toast('🗑 Données effacées');
  }

  /* ---------------- Réglages ---------------- */
  function renderReglages() {
    const s = state.settings;
    $$('[data-setting]').forEach((el) => {
      const k = el.dataset.setting;
      if (k === 'durationMin') el.value = String(s.duration / 60);
      else if (el.type === 'checkbox') el.checked = !!s[k];
      else el.value = String(s[k]);
    });
  }

  function onSettingChange(el) {
    const s = state.settings;
    const k = el.dataset.setting;
    if (k === 'durationMin') {
      const v = parseFloat(String(el.value).replace(',', '.'));
      if (!(v > 0)) return;
      const old = durationMs();
      s.duration = Math.round(clamp(v, 1, 30) * 60);
      for (const m of state.matches) {
        if (m.status === 'pending' || (m.remaining === old && !m.startedAt)) m.remaining = durationMs();
      }
    } else if (el.type === 'checkbox') {
      s[k] = el.checked;
    } else if (k === 'voiceRate') {
      s[k] = parseFloat(el.value) || 1;
    } else {
      const v = parseInt(el.value, 10);
      s[k] = isNaN(v) ? s[k] : clamp(v, 0, 99);
    }
    save();
    renderHeader();
  }

  /* ---------------- Édition des équipes ---------------- */
  function findPlayer(pid) {
    for (const t of state.teams) {
      const i = t.players.findIndex((p) => p.id === pid);
      if (i >= 0) return { t, i, p: t.players[i] };
    }
    return null;
  }

  function onTeamInput(el) {
    if (el.dataset.tfield) {
      const t = teamById(el.dataset.tid);
      if (!t) return;
      const v = el.value.trim().slice(0, 24);
      if (v) t.name = v;
      else el.value = t.name;
    } else if (el.dataset.pfield) {
      const r = findPlayer(el.dataset.pid);
      if (!r) return;
      if (el.dataset.pfield === 'bib') {
        const v = parseInt(el.value, 10);
        if (!isNaN(v)) r.p.bib = clamp(v, 0, 99);
        else el.value = r.p.bib;
      } else {
        r.p.name = el.value.trim().slice(0, 20);
      }
    }
    save();
    renderHeader();
  }

  /* ---------------- Plein écran ---------------- */
  function toggleFullscreen() {
    const d = document;
    const el = d.documentElement;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      } else {
        (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      }
    } catch (e) {
      toast('Plein écran non disponible : ajoutez l\'app à l\'écran d\'accueil');
    }
  }

  /* ---------------- Gestion des clics (délégation) ---------------- */
  const ACTIONS = {
    goTab: (el) => goTab(el.dataset.tab),
    toggleSun: () => { state.settings.sun = !state.settings.sun; save(); renderActive(); },
    toggleVoice: () => {
      state.settings.voice = !state.settings.voice;
      save();
      renderHeader();
      if (state.settings.voice) speak('Annonces vocales activées.', true);
      else if ('speechSynthesis' in window) speechSynthesis.cancel();
    },
    toggleMode: () => {
      state.settings.displayMode = state.settings.displayMode === 'names' ? 'bibs' : 'names';
      save();
      renderActive();
      toast(state.settings.displayMode === 'names' ? 'Mode Prénoms' : 'Mode Dossards rapides');
    },
    setMode: (el) => { state.settings.displayMode = el.dataset.mode; save(); renderActive(); },
    toggleFullscreen,
    testVoice: () => speak('Essai équipe Rouge ! Plus que 2 minutes. Quatrième tag, changement de balle.', true),

    createTournament,
    regenSchedule,
    openMatch: (el) => openMatch(el.dataset.id),
    reopenMatch: (el) => reopenMatch(el.dataset.id),

    addTeam: () => {
      if (state.teams.length >= COLORS.length) { toast('Maximum ' + COLORS.length + ' équipes'); return; }
      state.teams.push(makeTeam(state.teams.length, state.settings.playersPerTeam));
      save();
      renderEquipes();
      renderHeader();
      toast('Équipe ajoutée — pensez à régénérer la rotation');
    },
    delTeam: (el) => {
      const t = teamById(el.dataset.tid);
      if (!t) return;
      const used = state.matches.some((m) => m.a === t.id || m.b === t.id || m.ref === t.id);
      if (!confirm(`Supprimer l'équipe ${t.name} ?${used ? '\nSes rencontres seront retirées de la grille.' : ''}`)) return;
      if (used) {
        const curM = cur();
        if (curM && (curM.a === t.id || curM.b === t.id)) stopTimerSilently();
        state.matches = state.matches.filter((m) => m.a !== t.id && m.b !== t.id);
        state.matches.forEach((m) => { if (m.ref === t.id) m.ref = null; });
        if (!cur()) state.currentMatchId = state.matches.length ? state.matches[0].id : null;
      }
      state.teams = state.teams.filter((x) => x.id !== t.id);
      save();
      renderEquipes();
      renderHeader();
    },
    teamColor: (el) => {
      const t = teamById(el.dataset.tid);
      if (!t) return;
      const oldDefault = COLORS.some((c) => c.name === t.name);
      t.color = el.dataset.hex;
      if (oldDefault) t.name = el.dataset.cname;
      save();
      renderEquipes();
    },
    addPlayer: (el) => {
      const t = teamById(el.dataset.tid);
      if (!t) return;
      if (t.players.length >= 8) { toast('8 joueurs maximum'); return; }
      const bib = t.players.reduce((mx, p) => Math.max(mx, +p.bib || 0), 0) + 1;
      t.players.push({ id: uid(), bib, name: '', gender: '' });
      save();
      renderEquipes();
    },
    delPlayer: (el) => {
      const r = findPlayer(el.dataset.pid);
      if (!r) return;
      const used = state.matches.some((m) => m.events.some((e) => [e.player, e.assist, e.defender].includes(r.p.id)));
      if (!confirm(`Retirer ${pLabel(r.p, r.t)} ?${used ? '\nSes actions déjà enregistrées ne lui seront plus attribuées.' : ''}`)) return;
      r.t.players.splice(r.i, 1);
      save();
      renderEquipes();
    },
    gender: (el) => {
      const r = findPlayer(el.dataset.pid);
      if (!r) return;
      r.p.gender = r.p.gender === el.dataset.g ? '' : el.dataset.g;
      save();
      renderEquipes();
    },

    playPause,
    resetClock,
    setKickoff: (el) => setKickoff(el.dataset.side),
    try: openTry,
    loss: (el) => loseAttempt(el.dataset.type),
    intercept,
    undo,
    swapPossession,
    swapSides,
    clearSpot: () => { pendingSpot = null; renderField(); },
    validateMatch: openValidate,
    confirmValidate,
    rate: (el) => {
      const n = +el.dataset.n;
      validateDraft.rating = validateDraft.rating === n ? null : n;
      renderValidate();
    },
    closeEnd: () => { $('#endOverlay').hidden = true; },

    pickScorer: (el) => { tryDraft.scorer = el.dataset.pid; tryDraft.step = 2; renderTryModal(); },
    pickAssist: (el) => { tryDraft.assist = el.dataset.pid || null; confirmTry(); },
    tryTeam: () => { tryDraft.team = other(tryDraft.team); tryDraft.scorer = null; renderTryModal(); },
    tryBack: () => { tryDraft.step = 1; tryDraft.scorer = null; renderTryModal(); },
    closeModal: () => { closeModal(); tryDraft = null; },

    stripPick: (el) => stripPick(el.dataset.pid),
    hideStrip,

    cardPNG: (el) => downloadCardPNG(el.dataset.pid),
    printSheet: openPrintSheet,
    doPrint: () => window.print(),
    closePrint: () => { $('#printPreview').hidden = true; $('#printSheet').innerHTML = ''; },

    exportCSV: (el) => exportCSV(el.dataset.kind),
    exportJSON,
    resetAll
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) {
      e.preventDefault();
      fn(el, e);
    }
  });

  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
      closeModal();
      tryDraft = null;
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'matchSelect') {
      if (el.value) openMatch(el.value);
    } else if (el.id === 'cardTeam') {
      state.cardTeam = el.value;
      save();
      renderCartes();
    } else if (el.id === 'importFile') {
      if (el.files && el.files[0]) importJSON(el.files[0]);
      el.value = '';
    } else if (el.dataset.setting) {
      onSettingChange(el);
      if (el.dataset.setting === 'sun') renderActive();
    } else if (el.dataset.tfield || el.dataset.pfield) {
      onTeamInput(el);
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.setting === 'voiceRate') onSettingChange(el);
  });

  /* Terrain : pointer la position de la prochaine action */
  $('#field').addEventListener('click', (e) => {
    const m = cur();
    if (!m) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = clamp(((e.clientX - r.left) / r.width) * 100, 1, 99);
    const y = clamp(((e.clientY - r.top) / r.height) * 100, 1, 99);
    pendingSpot = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    renderField();
    toast('📍 Position notée pour la prochaine action', 1400);
  });

  $('#fieldImg').addEventListener('error', function onErr() {
    this.removeEventListener('error', onErr);
    this.src = FIELD_FALLBACK;
  });

  /* Reflet des cartes qui suit le doigt / la souris */
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest && e.target.closest('.cards-grid .card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.style.setProperty('--ry', ((px - 0.5) * 16).toFixed(1) + 'deg');
    card.style.setProperty('--rx', ((0.5 - py) * 16).toFixed(1) + 'deg');
  });

  /* Raccourcis clavier (tablette avec clavier / test sur ordinateur) */
  document.addEventListener('keydown', (e) => {
    if (state.tab !== 'pupitre' || e.target.matches('input, select, textarea') || !$('#modal').hidden) return;
    const map = { ' ': () => playPause(), e: openTry, t: () => loseAttempt('tag'), s: () => loseAttempt('ground'), o: () => loseAttempt('touch'), f: () => loseAttempt('foul'), i: intercept, z: undo };
    const fn = map[e.key.toLowerCase()];
    if (fn) {
      e.preventDefault();
      fn();
    }
  });

  /* Protection contre la fermeture / le rafraîchissement accidentel */
  window.addEventListener('beforeunload', (e) => {
    if (state.timer.running) {
      const m = cur();
      if (m) m.remaining = remainingNow(m);
    }
    save();
    if (state.teams.length || state.matches.length) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
    return undefined;
  });

  window.addEventListener('pagehide', save);

  /* ---------------- Démarrage ---------------- */
  function boot() {
    const m = cur();
    if (state.timer.running && m) {
      if (remainingNow(m) <= 0) {
        m.remaining = 0;
        state.timer.running = false;
      } else {
        requestWakeLock();
      }
    } else {
      state.timer.running = false;
    }
    if (!state.currentMatchId && state.matches.length) state.currentMatchId = state.matches[0].id;
    const tab = ['tournoi', 'equipes', 'pupitre', 'classement', 'cartes', 'reglages'].includes(state.tab) ? state.tab : 'tournoi';
    goTab(tab);
    setInterval(tick, 250);

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* mode hors ligne indisponible */ });
    }
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => { /* non accordé */ });
    }
  }

  boot();
})();
