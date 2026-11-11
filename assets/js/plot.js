/* =========================================================
   Lightweight, accessible canvas plotter + control binding
   No dependencies. Theme-aware (reads CSS variables).
   ========================================================= */
(function (global) {
  'use strict';

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const COLOR = (c) => (c && c.startsWith('--')) ? css(c) : (c && /^c\d$/.test(c) ? css('--' + c) : (c || css('--c1')));

  function niceStep(range, target) {
    const raw = range / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const s = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
    return s * mag;
  }
  function fmt(v, step) {
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e5 || a < 1e-3) return v.toExponential(0).replace('e+', 'e');
    const dec = Math.max(0, -Math.floor(Math.log10(step || a)) );
    return v.toFixed(Math.min(dec, 4));
  }
  function supNum(e) {
    const map = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return String(e).split('').map(c => map[c] || c).join('');
  }

  class Plot {
    constructor(canvas, opts = {}) {
      this.cv = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
      this.ctx = this.cv.getContext('2d');
      this.o = Object.assign({ xlabel: '', ylabel: '', xlim: null, ylim: null, logx: false, logy: false, grid: true, pad: { l: 58, r: 16, t: 14, b: 44 }, equal: false, hover: true, xticks: null }, opts);
      this.series = []; this.ann = [];
      this.hoverPt = null;
      if (!this.cv.hasAttribute('role')) this.cv.setAttribute('role', 'img');
      if (opts.aria && !this.cv.hasAttribute('aria-label')) this.cv.setAttribute('aria-label', opts.aria);
      this._mkTooltip();
      const ro = new ResizeObserver(() => this.render());
      ro.observe(this.cv);
      Plot._all.push(this);
      if (this.o.hover) this._bindHover();
    }
    _mkTooltip() {
      const wrap = this.cv.parentElement;
      if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
      this.tip = document.createElement('div');
      this.tip.className = 'tooltip';
      this.tip.setAttribute('aria-hidden', 'true');
      wrap.appendChild(this.tip);
    }
    _bindHover() {
      const move = (e) => {
        const r = this.cv.getBoundingClientRect();
        const px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        const py = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
        this.hoverPt = { px, py };
        this.render();
      };
      this.cv.addEventListener('mousemove', move);
      this.cv.addEventListener('touchmove', move, { passive: true });
      this.cv.addEventListener('mouseleave', () => { this.hoverPt = null; this.tip.style.opacity = 0; this.render(); });
    }
    set(series, ann = [], opts) {
      this.series = series || []; this.ann = ann || [];
      if (opts) Object.assign(this.o, opts);
      this.render();
      return this;
    }
    _bounds() {
      let { xlim, ylim } = this.o;
      if (!xlim || !ylim) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const s of this.series) {
          for (let i = 0; i < s.x.length; i++) {
            const x = s.x[i], y = s.y[i];
            if (!isFinite(x) || !isFinite(y)) continue;
            if (this.o.logy && y <= 0) continue;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
        if (!isFinite(x0)) { x0 = 0; x1 = 1; y0 = 0; y1 = 1; }
        if (!xlim) xlim = [x0, x1];
        if (!ylim) {
          if (this.o.logy) ylim = [y0, y1 * 1.5];
          else { const d = (y1 - y0) || Math.abs(y1) || 1; ylim = [y0 - 0.06 * d, y1 + 0.08 * d]; }
        }
      }
      return { xlim, ylim };
    }
    render() {
      const cv = this.cv, dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) return;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const c = this.ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      const P = this.o.pad; const pw = W - P.l - P.r, ph = H - P.t - P.b;
      let { xlim, ylim } = this._bounds();
      const lx = this.o.logx, ly = this.o.logy;
      const tx = (v) => lx ? Math.log10(v) : v, ty = (v) => ly ? Math.log10(Math.max(v, 1e-300)) : v;
      let X0 = tx(xlim[0]), X1 = tx(xlim[1]), Y0 = ty(ylim[0]), Y1 = ty(ylim[1]);
      if (X1 === X0) X1 = X0 + 1; if (Y1 === Y0) Y1 = Y0 + 1;
      if (this.o.equal) {
        const sx = pw / (X1 - X0), sy = ph / (Y1 - Y0);
        if (sx > sy) { const mid = (X0 + X1) / 2, half = pw / sy / 2; X0 = mid - half; X1 = mid + half; }
        else { const mid = (Y0 + Y1) / 2, half = ph / sx / 2; Y0 = mid - half; Y1 = mid + half; }
      }
      const X = (v) => P.l + (tx(v) - X0) / (X1 - X0) * pw;
      const Y = (v) => P.t + ph - (ty(v) - Y0) / (Y1 - Y0) * ph;
      this.map = { X, Y, P, pw, ph, X0, X1, Y0, Y1, lx, ly };
      const ink = css('--ink'), ink3 = css('--ink-3'), line = css('--line');
      c.font = '12px "IBM Plex Sans", system-ui, sans-serif';

      // grid + ticks
      c.strokeStyle = line; c.fillStyle = ink3; c.lineWidth = 1;
      const ticks = (a, b, log, n) => {
        const out = [];
        if (log) { for (let e = Math.ceil(a); e <= Math.floor(b); e++) out.push({ v: Math.pow(10, e), lab: '10' + supNum(e) }); if (out.length > 9) return out.filter((_, i) => i % Math.ceil(out.length / 8) === 0); return out; }
        const st = niceStep(b - a, n); for (let v = Math.ceil(a / st) * st; v <= b + st * 1e-9; v += st) out.push({ v: Math.abs(v) < st * 1e-9 ? 0 : v, lab: fmt(Math.abs(v) < st * 1e-9 ? 0 : v, st) });
        return out;
      };
      const xt = this.o.xticks || ticks(X0, X1, lx, Math.max(3, pw / 90));
      const yt = ticks(Y0, Y1, ly, Math.max(3, ph / 55));
      c.textAlign = 'center'; c.textBaseline = 'top';
      for (const t of xt) { const x = X(t.v); if (x < P.l - 1 || x > P.l + pw + 1) continue; if (this.o.grid) { c.globalAlpha = .7; c.beginPath(); c.moveTo(x, P.t); c.lineTo(x, P.t + ph); c.stroke(); c.globalAlpha = 1; } c.fillText(t.lab, x, P.t + ph + 6); }
      c.textAlign = 'right'; c.textBaseline = 'middle';
      for (const t of yt) { const y = Y(t.v); if (y < P.t - 1 || y > P.t + ph + 1) continue; if (this.o.grid) { c.globalAlpha = .7; c.beginPath(); c.moveTo(P.l, y); c.lineTo(P.l + pw, y); c.stroke(); c.globalAlpha = 1; } c.fillText(t.lab, P.l - 6, y); }
      // axes frame
      c.strokeStyle = ink3; c.lineWidth = 1; c.strokeRect(P.l + .5, P.t + .5, pw, ph);
      // labels
      c.fillStyle = css('--ink-2'); c.font = '13px "IBM Plex Sans", system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(this.o.xlabel, P.l + pw / 2, H - 4);
      c.save(); c.translate(14, P.t + ph / 2); c.rotate(-Math.PI / 2); c.textBaseline = 'middle'; c.fillText(this.o.ylabel, 0, 0); c.restore();

      c.save(); c.beginPath(); c.rect(P.l, P.t, pw, ph); c.clip();
      // annotations under
      for (const a of this.ann) if (!a.over) this._ann(a, X, Y, P, pw, ph);
      // series
      for (const s of this.series) {
        const col = COLOR(s.color);
        if (s.fill !== undefined && s.fill !== false) {
          c.beginPath(); let started = false;
          const base = typeof s.fill === 'number' ? s.fill : 0;
          for (let i = 0; i < s.x.length; i++) { const yv = s.y[i]; if (!isFinite(yv)) continue; const px = X(s.x[i]), py = Y(yv); if (!started) { c.moveTo(px, Y(base)); c.lineTo(px, py); started = true; } else c.lineTo(px, py); }
          if (started) { c.lineTo(X(s.x[s.x.length - 1]), Y(base)); c.closePath(); c.globalAlpha = s.fillAlpha || .15; c.fillStyle = s.fillColor ? COLOR(s.fillColor) : col; c.fill(); c.globalAlpha = 1; }
        }
        if (s.points) {
          c.fillStyle = col;
          for (let i = 0; i < s.x.length; i++) { if (!isFinite(s.y[i])) continue; c.beginPath(); c.arc(X(s.x[i]), Y(s.y[i]), s.r || 2.5, 0, 7); c.fill(); }
          continue;
        }
        c.strokeStyle = col; c.lineWidth = s.width || 2.2; c.setLineDash(s.dash || []); c.lineJoin = 'round';
        c.globalAlpha = s.alpha || 1;
        c.beginPath(); let pen = false;
        for (let i = 0; i < s.x.length; i++) {
          const yv = s.y[i];
          if (!isFinite(yv) || (ly && yv <= 0)) { pen = false; continue; }
          let py = Y(yv); py = Math.max(-1e4, Math.min(1e4, py));
          const px = X(s.x[i]);
          if (!pen) { c.moveTo(px, py); pen = true; } else c.lineTo(px, py);
        }
        c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      }
      for (const a of this.ann) if (a.over) this._ann(a, X, Y, P, pw, ph);
      c.restore();
      this._legend(P, pw, ph);
      this._hover(X, Y, P, pw, ph);
    }
    _legend(P, pw, ph) {
      const pos = this.o.legend === undefined ? 'tr' : this.o.legend;
      if (!pos) return;
      const seen = new Set(), items = [];
      for (const s of this.series) { if (!s.label || s.noLegend || seen.has(s.label)) continue; seen.add(s.label); items.push(s); }
      if (!items.length) return;
      const c = this.ctx; c.font = '12px "IBM Plex Sans", system-ui, sans-serif';
      const w = Math.max(...items.map(s => c.measureText(s.label).width)) + 38, h = items.length * 17 + 8;
      const x = pos[1] === 'r' ? P.l + pw - w - 8 : P.l + 8, y = pos[0] === 't' ? P.t + 8 : P.t + ph - h - 8;
      c.globalAlpha = .85; c.fillStyle = css('--bg-elev'); c.fillRect(x, y, w, h); c.globalAlpha = 1;
      c.strokeStyle = css('--line'); c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w, h);
      items.forEach((s, i) => {
        const yy = y + 12 + i * 17, col = COLOR(s.color);
        c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.4; c.setLineDash(s.dash || []);
        if (s.points) { c.beginPath(); c.arc(x + 16, yy, 3, 0, 7); c.fill(); }
        else { c.beginPath(); c.moveTo(x + 6, yy); c.lineTo(x + 26, yy); c.stroke(); }
        c.setLineDash([]); c.fillStyle = css('--ink-2'); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(s.label, x + 32, yy);
      });
    }
    _ann(a, X, Y, P, pw, ph) {
      const c = this.ctx; const col = COLOR(a.color || '--ink-3');
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = a.width || 1.3; c.setLineDash(a.dash || [5, 4]);
      c.font = (a.bold ? '600 ' : '') + '12px "IBM Plex Sans", system-ui, sans-serif';
      if (a.type === 'hline') { const y = Y(a.y); c.beginPath(); c.moveTo(P.l, y); c.lineTo(P.l + pw, y); c.stroke(); if (a.label) { c.setLineDash([]); c.textAlign = a.align || 'right'; c.textBaseline = 'bottom'; c.fillText(a.label, a.align === 'left' ? P.l + 6 : P.l + pw - 6, y - 3); } }
      else if (a.type === 'vline') { const x = X(a.x); c.beginPath(); c.moveTo(x, P.t); c.lineTo(x, P.t + ph); c.stroke(); if (a.label) { c.setLineDash([]); c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(a.label, x + 4, P.t + 4 + (a.dy || 0)); } }
      else if (a.type === 'seg') { c.setLineDash(a.dash || []); c.beginPath(); c.moveTo(X(a.x0), Y(a.y0)); c.lineTo(X(a.x1), Y(a.y1)); c.stroke(); }
      else if (a.type === 'rect') { c.setLineDash([]); c.globalAlpha = a.alpha || .12; c.fillRect(X(a.x0), Y(a.y1), X(a.x1) - X(a.x0), Y(a.y0) - Y(a.y1)); c.globalAlpha = 1; }
      else if (a.type === 'text') { c.setLineDash([]); c.textAlign = a.align || 'left'; c.textBaseline = a.base || 'middle'; c.fillText(a.text, X(a.x) + (a.dx || 0), Y(a.y) + (a.dy || 0)); }
      else if (a.type === 'dot') { c.setLineDash([]); c.beginPath(); c.arc(X(a.x), Y(a.y), a.r || 4, 0, 7); c.fill(); }
      else if (a.type === 'arrow') { c.setLineDash([]); const x0 = X(a.x0), y0 = Y(a.y0), x1 = X(a.x1), y1 = Y(a.y1); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); const ang = Math.atan2(y1 - y0, x1 - x0); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 8 * Math.cos(ang - .4), y1 - 8 * Math.sin(ang - .4)); c.lineTo(x1 - 8 * Math.cos(ang + .4), y1 - 8 * Math.sin(ang + .4)); c.closePath(); c.fill(); }
      c.setLineDash([]);
    }
    _hover(X, Y, P, pw, ph) {
      if (!this.hoverPt || !this.series.length) return;
      const { px, py } = this.hoverPt;
      if (px < P.l || px > P.l + pw || py < P.t || py > P.t + ph) { this.tip.style.opacity = 0; return; }
      let best = null;
      for (const s of this.series) {
        if (s.noHover) continue;
        for (let i = 0; i < s.x.length; i++) {
          if (!isFinite(s.y[i])) continue;
          const dx = X(s.x[i]) - px, dy = Y(s.y[i]) - py; const d = dx * dx + dy * dy;
          if (!best || d < best.d) best = { d, s, i };
        }
      }
      if (!best || best.d > 60 * 60) { this.tip.style.opacity = 0; return; }
      const c = this.ctx, xv = best.s.x[best.i], yv = best.s.y[best.i];
      c.fillStyle = COLOR(best.s.color); c.strokeStyle = css('--bg-elev'); c.lineWidth = 2;
      c.beginPath(); c.arc(X(xv), Y(yv), 5, 0, 7); c.fill(); c.stroke();
      const f = (v) => Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(3) : (+v.toPrecision(4)).toString();
      this.tip.textContent = (best.s.label ? best.s.label + ': ' : '') + '(' + f(xv) + ', ' + f(yv) + ')';
      const tw = this.tip.offsetWidth;
      let lx = X(xv) + 12 + 8; if (lx + tw > this.cv.clientWidth) lx = X(xv) - tw - 4;
      this.tip.style.left = lx + 'px'; this.tip.style.top = (Y(yv) - 10) + 'px'; this.tip.style.opacity = 1;
    }
    /* convert pixel → data (for dragging) */
    invert(px, py) { const m = this.map; if (!m) return null; const xv = m.X0 + (px - m.P.l) / m.pw * (m.X1 - m.X0); const yv = m.Y0 + (m.P.t + m.ph - py) / m.ph * (m.Y1 - m.Y0); return { x: m.lx ? Math.pow(10, xv) : xv, y: m.ly ? Math.pow(10, yv) : yv }; }
  }
  Plot._all = [];
  Plot.rerenderAll = () => Plot._all.forEach(p => p.render());

  /* ---------- numeric helpers ---------- */
  const linspace = (a, b, n) => { const out = new Array(n); for (let i = 0; i < n; i++) out[i] = a + (b - a) * i / (n - 1); return out; };
  const logspace = (a, b, n) => linspace(a, b, n).map(v => Math.pow(10, v));
  function bisect(f, a, b, tol = 1e-12, it = 200) { let fa = f(a); for (let i = 0; i < it; i++) { const m = (a + b) / 2, fm = f(m); if (fa * fm <= 0) b = m; else { a = m; fa = fm; } if (b - a < tol) break; } return (a + b) / 2; }

  /* ---------- controls binding ---------- */
  function bind(root, update) {
    if (typeof root === 'string') root = document.getElementById(root);
    const inputs = root.querySelectorAll('input, select');
    const read = () => {
      const v = {};
      inputs.forEach(el => {
        if (!el.name) return;
        let val;
        if (el.type === 'checkbox') val = el.checked;
        else if (el.type === 'range' || el.type === 'number') { val = parseFloat(el.value); if (el.dataset.log) val = Math.pow(10, val); }
        else val = el.value;
        v[el.name] = val;
        const out = root.querySelector('output[for="' + el.id + '"]');
        if (out && el.type !== 'checkbox') {
          const dec = el.dataset.dec !== undefined ? +el.dataset.dec : 2;
          const unit = el.dataset.unit || '';
          let txt;
          if (el.dataset.log || el.dataset.sci) txt = val.toExponential(dec === 2 ? 1 : dec).replace('e+', 'e');
          else txt = typeof val === 'number' ? val.toFixed(dec) : val;
          out.textContent = txt + (unit ? ' ' + unit : '');
        }
      });
      return v;
    };
    const run = () => update(read());
    inputs.forEach(el => el.addEventListener('input', run));
    run();
    return run;
  }

  /* live-region text for screen readers */
  function say(el, html) { if (typeof el === 'string') el = document.getElementById(el); if (el) el.innerHTML = html; }

  /* figure helper: canvas c-ID (+ optional c-ID-b), controls k-ID */
  function fig(id, opts, update) {
    const p = new Plot('c-' + id, opts);
    const b = document.getElementById('c-' + id + '-b');
    const p2 = b ? new Plot(b, opts.b || {}) : null;
    const k = document.getElementById('k-' + id);
    const run = k ? bind(k, v => update(v, p, p2)) : (update({}, p, p2), () => update({}, p, p2));
    return { p, p2, run };
  }
  /* play/pause animation bound to a button; fn(tSeconds) */
  function anim(btnId, fn, label) {
    const btn = document.getElementById(btnId); let on = false, t = 0, last = 0;
    const name = label || btn.textContent;
    btn.setAttribute('aria-pressed', 'false');
    const loop = (now) => { if (!on) return; t += Math.min(0.05, (now - last) / 1000); last = now; fn(t); requestAnimationFrame(loop); };
    btn.addEventListener('click', () => { on = !on; btn.textContent = on ? '❚❚ Pause' : name; btn.setAttribute('aria-pressed', on); if (on) { last = performance.now(); requestAnimationFrame(loop); } });
    return { time: () => t, reset: () => { t = 0; }, running: () => on };
  }

  global.Plot = Plot;
  global.Num = { linspace, logspace, bisect };
  global.UI = { bind, say, css, fig, anim };
})(window);
