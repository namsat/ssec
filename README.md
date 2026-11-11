# SSEC — Quantum, Solids & Devices

Interactive course notes that go from the wavefunction to the transistor: quantum mechanics, statistical physics, solid-state physics, semiconductor devices, nanoelectronics and band-structure simulation. Every chapter has derivations you can unfold and plots you can drive; all numerics run in the browser.

**Live site:** https://namsat.github.io/ssec/

## Chapters

| # | Page | Topics |
|---|------|--------|
| 01 | `foundations.html` | Lagrangian/Hamiltonian mechanics, postulates, Hilbert space, uncertainty, Ehrenfest, pictures |
| 02 | `one-d.html` | Wells, barriers and tunnelling, harmonic oscillator, coherent states, Kronig–Penney |
| 03 | `atoms.html` | Angular momentum, hydrogen, spin, perturbation theory, Zeeman effect, helium, H₂⁺, photons |
| 04 | `statistics.html` | Bose–Einstein and Fermi–Dirac, black body, Debye model, electron gas, screening, Einstein coefficients |
| 05 | `crystals.html` | Reciprocal lattice, X-ray diffraction, cohesion, Bloch theorem, band models, transport, thermoelectricity |
| 06 | `phonons.html` | Phonons, thermal conductivity, optical properties, electron–phonon coupling, superconductivity |
| 07 | `semiconductors.html` | Carrier statistics, Shockley equations, drift–diffusion model, Haynes–Shockley |
| 08 | `pn-junction.html` | Electrostatics, C–V, ideal and real diode, breakdown, charge control, photodiode, solar cell, LED |
| 09 | `bjt.html` | Carrier profiles, Ebers–Moll, Gummel plot, hybrid-π model |
| 10 | `mos.html` | MOS capacitor, threshold, MOSFET, CMOS inverter, short-channel effects, floating-gate memories |
| 11 | `nano.html` | Schottky contacts, heterojunctions, 2DEG and HEMT, Landauer, resonant tunnelling, Coulomb blockade, graphene |
| 12 | `simulations.html` | Plane-wave solver, empirical pseudopotentials (Si, Ge, III–V), tight-binding nanoribbons, DFT overview |

## How it is built

No framework and no build dependencies beyond Python 3.

- `src/*.html` — page content (text, formulas, figure scripts)
- `build.py` — wraps each fragment in the site shell and expands the control macros; run `python3 build.py`
- `assets/js/plot.js` — small canvas plotting library (theme-aware, hover read-out, log axes)
- `assets/js/physics.js` — numerics: symmetric/Hermitian eigensolvers, 1D Schrödinger solver, transfer matrices, pseudopotential and tight-binding Hamiltonians
- `assets/js/site.js` — navigation, table of contents, theme switch, quizzes
- Formulas are rendered with KaTeX (loaded from a CDN)

The generated pages are committed at the repository root. GitHub Pages serves the `gh-pages` branch, which mirrors `main`: after a change run `python3 build.py`, commit, then `git push origin main main:gh-pages`.

## Search and analytics

- Every page has a canonical URL, Open Graph/Twitter metadata, and JSON-LD (`Course` on the home page, `LearningResource` + `BreadcrumbList` on chapters). `build.py` also writes `sitemap.xml`.
- Google Analytics 4 (`G-H386L8M96G`) uses Consent Mode v2 in basic mode: `gtag.js` is not loaded until the visitor accepts the banner. Visitors can change their choice from **Cookie settings** in the footer.
- The site is verified in Google Search Console under the `namsat.github.io` owner.

## Accessibility

Native form controls with labels, keyboard operable; every figure has a text description and a live text read-out of its key numbers; light and dark themes; animations run only on request.

Material parameters are textbook values for teaching, not design data.
