/* =========================================================
   Site behaviour: menu, theme, TOC, KaTeX, quizzes, analytics consent
   (header, footer and chapter pager are static HTML written by build.py)
   ========================================================= */
(function () {
  'use strict';
  const GA_ID = 'G-H386L8M96G';
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
  };
  const isDark = () => root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);

  function header() {
    const h = document.querySelector('.site-header');
    if (!h) return;
    const mb = h.querySelector('.menu-btn'), nav = h.querySelector('.nav');
    mb.addEventListener('click', () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
    h.querySelector('.theme-btn').addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store.set('ssec-theme', next);
      if (window.Plot) Plot.rerenderAll();
      document.dispatchEvent(new Event('themechange'));
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (window.Plot) Plot.rerenderAll(); });
  }

  function toc() {
    const nav = document.querySelector('.toc');
    if (!nav) return;
    const hs = [...document.querySelectorAll('main h2[id]')];
    nav.innerHTML = '<h2>On this page</h2><ol>' + hs.map(h => `<li><a href="#${h.id}">${h.dataset.short || h.textContent}</a></li>`).join('') + '</ol>';
    const links = [...nav.querySelectorAll('a')];
    const io = new IntersectionObserver((ents) => {
      ents.forEach(e => {
        if (e.isIntersecting) { links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id)); }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    hs.forEach(h => io.observe(h));
  }

  let mathDone = false;
  function math() {
    if (!mathDone && window.renderMathInElement) {
      mathDone = true;
      renderMathInElement(document.body, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true }, { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }],
        throwOnError: false, ignoredClasses: ['no-math'],
        macros: { '\\ket': '\\left|#1\\right\\rangle', '\\bra': '\\left\\langle#1\\right|', '\\braket': '\\left\\langle#1\\middle|#2\\right\\rangle', '\\expval': '\\left\\langle#1\\right\\rangle', '\\dd': '\\mathrm{d}', '\\vb': '\\mathbf{#1}', '\\hbarr': '\\hbar' }
      });
    }
  }

  function quizzes() {
    document.querySelectorAll('.quiz fieldset').forEach(fs => {
      const fb = fs.querySelector('.fb');
      fs.addEventListener('change', (e) => {
        const ok = e.target.dataset.ok !== undefined;
        fb.className = 'fb ' + (ok ? 'ok' : 'no');
        fb.textContent = ok ? '✓ Correct. ' + (fs.dataset.why || '') : '✗ Not quite — try again.';
        if (window.gtag) gtag('event', 'quiz_answer', { correct: ok, page_path: location.pathname });
      });
      fb.setAttribute('aria-live', 'polite');
    });
  }

  /* ---------- analytics with consent (Google Consent Mode v2, basic) ----------
     Nothing is loaded from Google until the visitor accepts. */
  function loadGA() {
    if (document.getElementById('ga-lib')) return;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    const s = document.createElement('script');
    s.id = 'ga-lib'; s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }
  function consentBanner(force) {
    const old = document.querySelector('.consent'); if (old) old.remove();
    const choice = store.get('ssec-consent');
    if (choice === 'granted') loadGA();
    if (choice && !force) return;
    const b = document.createElement('div');
    b.className = 'consent'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-live', 'polite'); b.setAttribute('aria-label', 'Analytics cookies');
    b.innerHTML = `<p>This site uses Google Analytics cookies, only if you agree, to count visits and see which chapters are useful. No advertising, no profiling.</p>
      <div class="consent-actions"><button type="button" class="btn" data-c="denied">Decline</button><button type="button" class="btn primary" data-c="granted">Accept</button></div>`;
    b.addEventListener('click', (e) => {
      const c = e.target.dataset && e.target.dataset.c; if (!c) return;
      store.set('ssec-consent', c);
      if (c === 'granted') loadGA();
      else if (document.getElementById('ga-lib')) { gtag('consent', 'update', { analytics_storage: 'denied' }); }
      b.remove();
    });
    document.body.appendChild(b);
  }

  header();
  document.addEventListener('DOMContentLoaded', () => {
    toc(); quizzes(); math(); consentBanner(false);
    const cb = document.getElementById('cookie-settings'); if (cb) cb.addEventListener('click', () => consentBanner(true));
  });
  window.addEventListener('load', math);
})();
