/* =========================================================
   Numerical physics toolkit (pure JS)
   - physical constants
   - complex arithmetic, 2x2 complex matrices (transfer matrix)
   - symmetric eigensolver (Householder tridiagonalisation + QL)
   - finite-difference 1D Schrödinger solver
   - special functions (Hermite, Laguerre, Fermi integrals)
   ========================================================= */
(function (g) {
  'use strict';
  const K = {
    hbar: 1.054571817e-34, h: 6.62607015e-34, q: 1.602176634e-19, me: 9.1093837015e-31, kB: 1.380649e-23,
    c: 2.99792458e8, eps0: 8.8541878128e-12, kBeV: 8.617333262e-5, a0: 5.29177e-11, Ry: 13.605693,
    hbar2_2m_eVnm2: 0.0380998, // ħ²/2m0 in eV·nm²
  };

  /* ---------- complex ---------- */
  const C = (re, im = 0) => ({ re, im });
  const cadd = (a, b) => C(a.re + b.re, a.im + b.im);
  const csub = (a, b) => C(a.re - b.re, a.im - b.im);
  const cmul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const cabs2 = (a) => a.re * a.re + a.im * a.im;
  const cexp = (a) => { const e = Math.exp(a.re); return C(e * Math.cos(a.im), e * Math.sin(a.im)); };
  const csqrt = (a) => { const r = Math.hypot(a.re, a.im); const re = Math.sqrt((r + a.re) / 2); const im = Math.sign(a.im || 1) * Math.sqrt(Math.max(0, (r - a.re) / 2)); return C(re, im); };
  const cscale = (a, s) => C(a.re * s, a.im * s);
  const m2mul = (A, B) => [[cadd(cmul(A[0][0], B[0][0]), cmul(A[0][1], B[1][0])), cadd(cmul(A[0][0], B[0][1]), cmul(A[0][1], B[1][1]))],
  [cadd(cmul(A[1][0], B[0][0]), cmul(A[1][1], B[1][0])), cadd(cmul(A[1][0], B[0][1]), cmul(A[1][1], B[1][1]))]];

  /**
   * Transmission through a piecewise-constant 1D potential.
   * regions: [{V (eV), w (nm), m (rel. mass)}], leads left/right are first/last with w ignored.
   * Uses BenDaniel–Duke matching (ψ and ψ'/m continuous). Returns T.
   */
  function transmission(E, regions) {
    const n = regions.length;
    const k = regions.map(r => csqrt(C((E - r.V) / (K.hbar2_2m_eVnm2 / r.m), 0))); // 1/nm
    // ensure tiny imaginary for numerical stability
    let M = [[C(1), C(0)], [C(0), C(1)]];
    let x = 0;
    for (let j = 0; j < n - 1; j++) {
      if (j > 0) x += regions[j].w;
      const kj = k[j], kn = k[j + 1];
      const rj = regions[j].m, rn = regions[j + 1].m;
      // interface at x: [A_j e^{ik_j x} + B_j e^{-ik_j x}] matching
      const kjx = cmul(C(0, 1), cscale(kj, x)), knx = cmul(C(0, 1), cscale(kn, x));
      const ej = cexp(kjx), ejm = cexp(cscale(kjx, -1)), en = cexp(knx), enm = cexp(cscale(knx, -1));
      // D_j(x) = [[e, e^-],[ik e/m, -ik e^-/m]]
      const Dj = [[ej, ejm], [cmul(cscale(cmul(C(0, 1), kj), 1 / rj), ej), cmul(cscale(cmul(C(0, -1), kj), 1 / rj), ejm)]];
      const Dn = [[en, enm], [cmul(cscale(cmul(C(0, 1), kn), 1 / rn), en), cmul(cscale(cmul(C(0, -1), kn), 1 / rn), enm)]];
      // coefficients_{n} = Dn^-1 Dj coefficients_j
      const det = csub(cmul(Dn[0][0], Dn[1][1]), cmul(Dn[0][1], Dn[1][0]));
      const Dninv = [[cdiv(Dn[1][1], det), cdiv(cscale(Dn[0][1], -1), det)], [cdiv(cscale(Dn[1][0], -1), det), cdiv(Dn[0][0], det)]];
      M = m2mul(m2mul(Dninv, Dj), M);
    }
    // incoming from left: A0=1, B0=r ; outgoing: A_N = t, B_N = 0  =>  0 = M10 + M11 r
    const r = cdiv(cscale(M[1][0], -1), M[1][1]);
    const t = cadd(M[0][0], cmul(M[0][1], r));
    const kL = k[0], kR = k[n - 1];
    if (kR.re <= 0 || kL.re <= 0) return 0;
    return cabs2(t) * (kR.re / regions[n - 1].m) / (kL.re / regions[0].m);
  }

  /* ---------- symmetric eigen (Numerical Recipes style) ---------- */
  function tred2(a, wantV) {
    const n = a.length; const d = new Float64Array(n), e = new Float64Array(n);
    for (let i = n - 1; i > 0; i--) {
      const l = i - 1; let h = 0, scale = 0;
      if (l > 0) {
        for (let k = 0; k <= l; k++) scale += Math.abs(a[i][k]);
        if (scale === 0) e[i] = a[i][l];
        else {
          for (let k = 0; k <= l; k++) { a[i][k] /= scale; h += a[i][k] * a[i][k]; }
          let f = a[i][l]; const gg = f >= 0 ? -Math.sqrt(h) : Math.sqrt(h);
          e[i] = scale * gg; h -= f * gg; a[i][l] = f - gg; f = 0;
          for (let j = 0; j <= l; j++) {
            if (wantV) a[j][i] = a[i][j] / h;
            let g2 = 0;
            for (let k = 0; k <= j; k++) g2 += a[j][k] * a[i][k];
            for (let k = j + 1; k <= l; k++) g2 += a[k][j] * a[i][k];
            e[j] = g2 / h; f += e[j] * a[i][j];
          }
          const hh = f / (h + h);
          for (let j = 0; j <= l; j++) { f = a[i][j]; e[j] = g2fix(e[j] - hh * f); const gj = e[j]; for (let k = 0; k <= j; k++) a[j][k] -= (f * e[k] + gj * a[i][k]); }
        }
      } else e[i] = a[i][l];
      d[i] = h;
    }
    d[0] = 0; e[0] = 0;
    for (let i = 0; i < n; i++) {
      if (wantV) {
        const l = i - 1;
        if (d[i]) { for (let j = 0; j <= l; j++) { let gg = 0; for (let k = 0; k <= l; k++) gg += a[i][k] * a[k][j]; for (let k = 0; k <= l; k++) a[k][j] -= gg * a[k][i]; } }
        d[i] = a[i][i]; a[i][i] = 1; for (let j = 0; j <= l; j++) a[j][i] = a[i][j] = 0;
      } else d[i] = a[i][i];
    }
    return { d, e };
  }
  function g2fix(x) { return x; }
  function tqli(d, e, z) {
    const n = d.length;
    for (let i = 1; i < n; i++) e[i - 1] = e[i]; e[n - 1] = 0;
    for (let l = 0; l < n; l++) {
      let iter = 0, m;
      do {
        for (m = l; m < n - 1; m++) { const dd = Math.abs(d[m]) + Math.abs(d[m + 1]); if (Math.abs(e[m]) <= 1e-15 * dd) break; }
        if (m !== l) {
          if (iter++ === 60) break;
          let gg = (d[l + 1] - d[l]) / (2 * e[l]); let r = Math.hypot(gg, 1);
          gg = d[m] - d[l] + e[l] / (gg + (gg >= 0 ? Math.abs(r) : -Math.abs(r)));
          let s = 1, c = 1, p = 0, i;
          for (i = m - 1; i >= l; i--) {
            let f = s * e[i]; const b = c * e[i];
            e[i + 1] = (r = Math.hypot(f, gg));
            if (r === 0) { d[i + 1] -= p; e[m] = 0; break; }
            s = f / r; c = gg / r; gg = d[i + 1] - p; r = (d[i] - gg) * s + 2 * c * b; d[i + 1] = gg + (p = s * r); gg = c * r - b;
            if (z) for (let k = 0; k < n; k++) { f = z[k][i + 1]; z[k][i + 1] = s * z[k][i] + c * f; z[k][i] = c * z[k][i] - s * f; }
          }
          if (r === 0 && i >= l) continue;
          d[l] -= p; e[l] = gg; e[m] = 0;
        }
      } while (m !== l);
    }
  }
  /** eigenvalues (sorted) of real symmetric matrix A (array of arrays). A is copied. */
  function eigSym(A, wantV = false) {
    const a = A.map(r => Float64Array.from(r));
    const { d, e } = tred2(a, wantV);
    tqli(d, e, wantV ? a : null);
    const idx = [...d.keys()].sort((i, j) => d[i] - d[j]);
    const vals = idx.map(i => d[i]);
    if (!wantV) return { vals };
    const vecs = idx.map(i => a.map(row => row[i]));
    return { vals, vecs };
  }
  /** eigenvalues of symmetric tridiagonal (diag d, offdiag e of length n-1) */
  function eigTri(diag, off) {
    const n = diag.length; const d = Float64Array.from(diag); const e = new Float64Array(n);
    for (let i = 1; i < n; i++) e[i] = off[i - 1];
    tqli(d, e, null);
    return Array.from(d).sort((x, y) => x - y);
  }
  /** inverse iteration for eigenvector of tridiagonal near eigenvalue E */
  function triVec(diag, off, E) {
    const n = diag.length; const shift = E + 1e-10 * (Math.abs(E) + 1);
    let v = new Float64Array(n).fill(1);
    for (let it = 0; it < 4; it++) {
      // solve (T - shift) x = v with Thomas algorithm
      const cp = new Float64Array(n), dp = new Float64Array(n);
      let b0 = diag[0] - shift; cp[0] = (off[0] || 0) / b0; dp[0] = v[0] / b0;
      for (let i = 1; i < n; i++) { const a = off[i - 1], b = diag[i] - shift - a * cp[i - 1]; cp[i] = i < n - 1 ? off[i] / b : 0; dp[i] = (v[i] - a * dp[i - 1]) / b; }
      const x = new Float64Array(n); x[n - 1] = dp[n - 1];
      for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
      let nrm = 0; for (let i = 0; i < n; i++) nrm += x[i] * x[i]; nrm = Math.sqrt(nrm);
      for (let i = 0; i < n; i++) x[i] /= nrm; v = x;
    }
    return v;
  }
  /**
   * 1D Schrödinger by finite differences on grid x (nm), V(x) in eV, rel. mass m.
   * returns {E:[...nStates], psi:[[...]]} with psi normalised to ∫|ψ|²dx=1 (nm⁻¹)
   */
  function schrodinger1D(x, V, m, nStates) {
    const N = x.length, h = x[1] - x[0]; const t = K.hbar2_2m_eVnm2 / m / (h * h);
    const diag = V.map(v => v + 2 * t), off = new Array(N - 1).fill(-t);
    const all = eigTri(diag, off);
    const E = all.slice(0, nStates);
    const psi = E.map(e => { const v = triVec(diag, off, e); const s = 1 / Math.sqrt(h); let sg = 0; for (let i = 0; i < N; i++) if (Math.abs(v[i]) > Math.abs(sg)) sg = v[i]; const sgn = sg >= 0 ? 1 : -1; return Array.from(v, a => a * s * sgn); });
    return { E, psi };
  }

  /* ---------- special functions ---------- */
  function hermite(n, x) { if (n === 0) return 1; let h0 = 1, h1 = 2 * x; for (let k = 1; k < n; k++) { const h2 = 2 * x * h1 - 2 * k * h0; h0 = h1; h1 = h2; } return h1; }
  function fact(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
  function laguerreA(n, a, x) { if (n === 0) return 1; let l0 = 1, l1 = 1 + a - x; for (let k = 1; k < n; k++) { const l2 = ((2 * k + 1 + a - x) * l1 - (k + a) * l0) / (k + 1); l0 = l1; l1 = l2; } return l1; }
  /** harmonic oscillator eigenfunction in dimensionless ξ */
  function hoPsi(n, xi) { const N = 1 / Math.sqrt(Math.pow(2, n) * fact(n) * Math.sqrt(Math.PI)); return N * hermite(n, xi) * Math.exp(-xi * xi / 2); }
  /** hydrogen radial R_nl(r) with r in units of a0 */
  function hydrogenR(n, l, r) { const rho = 2 * r / n; const N = Math.sqrt(Math.pow(2 / n, 3) * fact(n - l - 1) / (2 * n * fact(n + l))); return N * Math.exp(-rho / 2) * Math.pow(rho, l) * laguerreA(n - l - 1, 2 * l + 1, rho); }
  /** Fermi–Dirac integral F_{1/2}(η) normalised (Joyce–Dixon/Bednarczyk approx.) */
  function F12(eta) { // normalized: F = 2/√π ∫ sqrt(x)/(1+e^{x-η})
    const a = Math.pow(eta, 4) + 50 + 33.6 * eta * (1 - 0.68 * Math.exp(-0.17 * Math.pow(eta + 1, 2)));
    const v = 3 * Math.sqrt(Math.PI) / (4 * Math.pow(a, 3 / 8));
    return 1 / (Math.exp(-eta) + v);
  }
  /** Debye function integral for heat capacity: C/(3NkB) */
  function debyeC(T, TD) {
    if (T <= 0) return 0; const xD = TD / T; const n = 400; let s = 0;
    for (let i = 1; i <= n; i++) { const x = xD * (i - .5) / n; const em = Math.exp(-x); s += Math.pow(x, 4) * em / ((1 - em) * (1 - em)); }
    s *= xD / n; return 3 * Math.pow(T / TD, 3) * s;
  }
  function einsteinC(T, TE) { if (T <= 0) return 0; const x = TE / T; const em = Math.exp(-x); return x * x * em / ((1 - em) * (1 - em)); }

  /* ---------- silicon device parameters (cm, V, s units) ---------- */
  const Si = {
    eps: 11.7 * 8.8541878128e-14, epsOx: 3.9 * 8.8541878128e-14, q: 1.602176634e-19, chi: 4.05,
    kT: (T) => 8.617333262e-5 * T,                       // eV (numerically = V_T in volts)
    Eg: (T) => 1.17 - 4.73e-4 * T * T / (T + 636),
    Nc: (T) => 2.86e19 * Math.pow(T / 300, 1.5),
    Nv: (T) => 3.10e19 * Math.pow(T / 300, 1.5),
    ni: (T) => Math.sqrt(Si.Nc(T) * Si.Nv(T)) * Math.exp(-Si.Eg(T) / (2 * Si.kT(T))),
    mun: (N) => 68.5 + (1414 - 68.5) / (1 + Math.pow(N / 9.2e16, 0.711)),
    mup: (N) => 44.9 + (470.5 - 44.9) / (1 + Math.pow(N / 2.23e17, 0.719)),
  };
  const sci = (x, d = 2) => { if (!isFinite(x)) return '–'; if (x === 0) return '0'; const [m, e] = x.toExponential(d).split('e'); const sup = String(+e).split('').map(c => ({ '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }[c])).join(''); return m + '×10' + sup; };
  /* engineering format with SI prefix */
  const eng = (x, unit = '', d = 3) => { if (!isFinite(x)) return '–'; if (x === 0) return '0 ' + unit; const pre = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'], [1e-18, 'a']]; const a = Math.abs(x); for (const [f, s] of pre) if (a >= f * 0.9995) return (x / f).toPrecision(d) + ' ' + s + unit; return x.toExponential(2) + ' ' + unit; };

  /* ---------- Hermitian eigenvalues via real symmetric embedding ---------- */
  function eigHerm(A, B) { // H = A + iB, A symmetric, B antisymmetric
    const n = A.length, M = [];
    for (let i = 0; i < n; i++) { const r = new Float64Array(2 * n); for (let j = 0; j < n; j++) { r[j] = A[i][j]; r[n + j] = -B[i][j]; } M.push(r); }
    for (let i = 0; i < n; i++) { const r = new Float64Array(2 * n); for (let j = 0; j < n; j++) { r[j] = B[i][j]; r[n + j] = A[i][j]; } M.push(r); }
    const v = eigSym(M).vals, out = []; for (let i = 0; i < 2 * n; i += 2) out.push((v[i] + v[i + 1]) / 2); return out;
  }

  /* ---------- empirical pseudopotential method (diamond / zincblende) ---------- */
  const EPM = {
    /* a (Å); symmetric V3,V8,V11 and antisymmetric V3,V4,V11 form factors in Ry (Cohen & Bergstresser 1966) */
    materials: {
      Si: { a: 5.43, S: [-0.21, 0.04, 0.08], A: [0, 0, 0], gap: 1.12 }, Ge: { a: 5.66, S: [-0.23, 0.01, 0.06], A: [0, 0, 0], gap: 0.66 },
      Sn: { a: 6.49, S: [-0.20, 0.00, 0.04], A: [0, 0, 0], gap: 0 }, GaAs: { a: 5.64, S: [-0.23, 0.01, 0.06], A: [0.07, 0.05, 0.01], gap: 1.42 },
      GaP: { a: 5.44, S: [-0.22, 0.03, 0.07], A: [0.12, 0.07, 0.02], gap: 2.26 }, InP: { a: 5.86, S: [-0.23, 0.01, 0.06], A: [0.07, 0.05, 0.01], gap: 1.34 },
      InAs: { a: 6.04, S: [-0.22, 0.00, 0.05], A: [0.08, 0.05, 0.03], gap: 0.35 }, InSb: { a: 6.48, S: [-0.20, 0.00, 0.04], A: [0.06, 0.05, 0.01], gap: 0.17 },
      ZnSe: { a: 5.65, S: [-0.23, 0.01, 0.06], A: [0.18, 0.12, 0.03], gap: 2.70 }, CdTe: { a: 6.41, S: [-0.20, 0.00, 0.04], A: [0.15, 0.09, 0.04], gap: 1.50 },
    },
    basis(cut) { const G = []; for (let h = -5; h <= 5; h++) for (let k = -5; k <= 5; k++) for (let l = -5; l <= 5; l++) { const par = (Math.abs(h) % 2) + (Math.abs(k) % 2) + (Math.abs(l) % 2); if (par !== 0 && par !== 3) continue; const g2 = h * h + k * k + l * l; if (g2 <= cut) G.push([h, k, l]); } return G; },
    /* potential part of H (k independent): returns {A,B,complex} */
    potential(G, S, Aa) {
      const n = G.length, A = [], B = [], cx = Aa.some(x => x !== 0);
      for (let i = 0; i < n; i++) { A.push(new Float64Array(n)); B.push(new Float64Array(n)); }
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (i === j) continue; const d = [G[i][0] - G[j][0], G[i][1] - G[j][1], G[i][2] - G[j][2]], g2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2], ph = Math.PI / 4 * (d[0] + d[1] + d[2]);
        const vs = g2 === 3 ? S[0] : g2 === 8 ? S[1] : g2 === 11 ? S[2] : 0, va = g2 === 3 ? Aa[0] : g2 === 4 ? Aa[1] : g2 === 11 ? Aa[2] : 0;
        A[i][j] = vs * Math.cos(ph); B[i][j] = va * Math.sin(ph); }
      return { A, B, cx };
    },
    /* eigenvalues (eV) at k (units 2π/a) */
    bands(k, G, pot, a, nb) {
      const n = G.length, c = Math.pow(2 * Math.PI * 0.529177 / a, 2), A = pot.A.map(r => Float64Array.from(r));
      for (let i = 0; i < n; i++) { const q0 = k[0] + G[i][0], q1 = k[1] + G[i][1], q2 = k[2] + G[i][2]; A[i][i] = c * (q0 * q0 + q1 * q1 + q2 * q2); }
      const v = pot.cx ? eigHerm(A, pot.B) : eigSym(A).vals; return v.slice(0, nb).map(e => e * 13.6057);
    },
  };

  /* ---------- graphene nanoribbon tight binding ---------- */
  function ribbon(type, N) { // returns {pos, T, bonds:[i,j,shift]}
    const s3 = Math.sqrt(3), pos = []; let T;
    if (type === 'zigzag') { T = s3; for (let m = 0; m < N; m++) { // B row then A row of each zigzag chain
        const yB = 1.5 * m + 1, yA = 1.5 * (m + 1), xB = (m % 2 === 0 ? 0 : s3 / 2), xA = (m % 2 === 0 ? s3 / 2 : 0); pos.push([xB, yB], [xA, yA]); } }
    else { T = 3; for (let j = 0; j < N; j++) { const x = j * s3 / 2; if (j % 2 === 0) pos.push([x, 0], [x, 1]); else pos.push([x, 1.5], [x, 2.5]); } }
    const bonds = [], n = pos.length; // periodic direction: x for zigzag, y for armchair
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let s = -1; s <= 1; s++) { if (i === j && s === 0) continue; const dx = pos[j][0] - pos[i][0] + (type === 'zigzag' ? s * T : 0), dy = pos[j][1] - pos[i][1] + (type === 'zigzag' ? 0 : s * T); if (Math.abs(Math.hypot(dx, dy) - 1) < 0.02) bonds.push([i, j, s]); }
    return { pos, T, bonds, n };
  }
  function ribbonBands(rb, kT, t) { // kT = k·T in [-π, π]
    const n = rb.n, A = [], B = []; for (let i = 0; i < n; i++) { A.push(new Float64Array(n)); B.push(new Float64Array(n)); }
    for (const [i, j, s] of rb.bonds) { A[i][j] += -t * Math.cos(kT * s); B[i][j] += -t * Math.sin(kT * s); }
    return eigHerm(A, B);
  }

  g.Phys = { Si, sci, eng, eigHerm, EPM, ribbon, ribbonBands, K, C, cadd, csub, cmul, cdiv, cabs2, cexp, csqrt, transmission, eigSym, eigTri, triVec, schrodinger1D, hermite, hoPsi, hydrogenR, laguerreA, fact, F12, debyeC, einsteinC };
})(window);
