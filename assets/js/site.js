/* =========================================================
   Site shell: header, nav, theme, TOC, KaTeX, quiz, pager
   ========================================================= */
(function () {
  'use strict';
  const PAGES = [
    { href: 'index.html', t: 'Home' },
    { href: 'foundations.html', t: 'Foundations' },
    { href: 'one-d.html', t: '1D systems' },
    { href: 'atoms.html', t: 'Atoms & spin' },
    { href: 'statistics.html', t: 'Statistics' },
    { href: 'crystals.html', t: 'Crystals & bands' },
    { href: 'phonons.html', t: 'Phonons, optics, SC' },
    { href: 'semiconductors.html', t: 'Semiconductors' },
    { href: 'pn-junction.html', t: 'p–n junction' },
    { href: 'bjt.html', t: 'BJT' },
    { href: 'mos.html', t: 'MOS' },
    { href: 'nano.html', t: 'Nano' },
    { href: 'simulations.html', t: 'Simulations' },
  ];
  const here = (location.pathname.split('/').pop() || 'index.html');

  /* theme */
  const root = document.documentElement;
  try { const t = localStorage.getItem('ssec-theme'); if (t) root.setAttribute('data-theme', t); } catch (e) { }
  const isDark = () => root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);

  function header() {
    const h = document.createElement('header');
    h.className = 'site-header';
    h.innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="header-inner">
        <a class="brand" href="index.html" aria-label="SSEC home">
          <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)"/><path d="M5 20 C9 20 9 8 13 8 S17 24 21 24 S25 14 27 14" fill="none" stroke="var(--accent-ink)" stroke-width="2.4" stroke-linecap="round"/></svg>
          <span>SSEC<small>Quantum · Solids · Devices</small></span>
        </a>
        <button class="icon-btn menu-btn" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <nav class="nav" id="site-nav" aria-label="Site sections">
          ${PAGES.slice(1).map(p => `<a href="${p.href}"${p.href === here ? ' aria-current="page"' : ''}>${p.t}</a>`).join('')}
        </nav>
        <button class="icon-btn theme-btn" aria-label="Toggle light/dark theme">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" fill="currentColor"/></svg>
        </button>
      </div>`;
    document.body.prepend(h);
    const mb = h.querySelector('.menu-btn'), nav = h.querySelector('.nav');
    mb.addEventListener('click', () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
    h.querySelector('.theme-btn').addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('ssec-theme', next); } catch (e) { }
      if (window.Plot) Plot.rerenderAll();
      document.dispatchEvent(new Event('themechange'));
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (window.Plot) Plot.rerenderAll(); });
  }

  function footer() {
    const f = document.createElement('footer');
    f.className = 'site-footer';
    f.innerHTML = `Interactive study notes · quantum mechanics, solid-state physics, electronic devices and nanoelectronics.<br>All plots are computed live in your browser · formulas by KaTeX · <a href="https://github.com/namsat/ssec">source on GitHub</a>`;
    document.body.appendChild(f);
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

  function pager() {
    const main = document.querySelector('main');
    const i = PAGES.findIndex(p => p.href === here);
    if (!main || i < 0 || here === 'index.html') return;
    const prev = PAGES[i - 1], next = PAGES[i + 1];
    const d = document.createElement('nav'); d.className = 'pager'; d.setAttribute('aria-label', 'Chapter navigation');
    d.innerHTML = (prev ? `<a class="prev" href="${prev.href}"><small>← Previous</small>${prev.t}</a>` : '<span></span>') +
      (next ? `<a class="next" href="${next.href}"><small>Next →</small>${next.t}</a>` : '');
    main.appendChild(d);
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
      });
      fb.setAttribute('aria-live', 'polite');
    });
  }

  header();
  document.addEventListener('DOMContentLoaded', () => {
    toc(); pager(); footer(); quizzes(); math();
  });
  window.addEventListener('load', math);
  window.SSEC = { PAGES };
})();
