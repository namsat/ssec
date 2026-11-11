#!/usr/bin/env python3
"""Build static pages: wraps src/*.html fragments in the site shell and
expands small control macros.

Fragment format: first line `<!-- title | description | toc -->` (toc = yes/no).

Macros:
  {{s|id|name|Label|min|max|step|value|unit|dec|flags}}   range slider (flags: log, sci)
  {{sel|id|name|Label|v1:Text 1;v2:Text 2}}               select
  {{chk|id|name|Label|checked?}}                          checkbox
  {{out|id}}                                               live readout box
"""
import re, pathlib, html, json, datetime, subprocess

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / 'src'

SITE = 'https://namsat.github.io/ssec/'
GA_ID = 'G-H386L8M96G'
PAGES = [  # (file, short nav title)
    ('index.html', 'Home'), ('foundations.html', 'Foundations'), ('one-d.html', '1D systems'),
    ('atoms.html', 'Atoms & spin'), ('statistics.html', 'Statistics'), ('crystals.html', 'Crystals & bands'),
    ('phonons.html', 'Phonons, optics, SC'), ('semiconductors.html', 'Semiconductors'), ('pn-junction.html', 'p–n junction'),
    ('bjt.html', 'BJT'), ('mos.html', 'MOS'), ('nano.html', 'Nano'), ('simulations.html', 'Simulations'),
]

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{doc_title}</title>
<meta name="description" content="{desc}">
<meta name="robots" content="{robots}">
<meta name="author" content="Satnam Singh">
<link rel="canonical" href="{url}">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="SSEC — Quantum, Solids & Devices">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{site}assets/img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{site}assets/img/og.png">
<meta name="theme-color" content="#2f4ecb">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%232f4ecb'/%3E%3Cpath d='M5 20 C9 20 9 8 13 8 S17 24 21 24 S25 14 27 14' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="apple-touch-icon" href="assets/img/icon-180.png">
<link rel="sitemap" type="application/xml" href="sitemap.xml">
<script>try{{var t=localStorage.getItem('ssec-theme');if(t)document.documentElement.setAttribute('data-theme',t)}}catch(e){{}}
window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}
gtag('consent','default',{{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'}});
gtag('js',new Date());gtag('config','{ga}');</script>
<script type="application/ld+json">{jsonld}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,500;0,8..60,700;1,8..60,500&display=swap">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
<link rel="stylesheet" href="assets/css/style.css">
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"></script>
<script src="assets/js/plot.js"></script>
<script src="assets/js/physics.js"></script>
<script defer src="assets/js/site.js"></script>
</head>
<body>
{header}
<div class="page{cls}">
{toc}<main id="main" tabindex="-1">
"""
TAIL = """
{pager}</main>
</div>
<footer class="site-footer">Interactive study notes · quantum mechanics, solid-state physics, electronic devices and nanoelectronics.<br>All plots are computed live in your browser · formulas by KaTeX · <a href="https://github.com/namsat/ssec">source on GitHub</a> · <button type="button" id="cookie-settings" class="linklike">Cookie settings</button></footer>
</body>
</html>
"""


def header_html(here):
    cur = ' aria-current="page"'
    links = ''.join(f'<a href="{f}"{cur if f == here else ""}>{html.escape(t)}</a>' for f, t in PAGES[1:])
    return ('<header class="site-header">\n<a class="skip-link" href="#main">Skip to content</a>\n<div class="header-inner">\n'
            '<a class="brand" href="./" aria-label="SSEC home"><svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)"/><path d="M5 20 C9 20 9 8 13 8 S17 24 21 24 S25 14 27 14" fill="none" stroke="var(--accent-ink)" stroke-width="2.4" stroke-linecap="round"/></svg><span>SSEC<small>Quantum · Solids · Devices</small></span></a>\n'
            '<button class="icon-btn menu-btn" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>\n'
            f'<nav class="nav" id="site-nav" aria-label="Site sections">{links}</nav>\n'
            '<button class="icon-btn theme-btn" aria-label="Toggle light/dark theme"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" fill="currentColor"/></svg></button>\n'
            '</div>\n</header>')


def pager_html(here):
    names = [f for f, _ in PAGES]
    if here not in names or here == 'index.html':
        return ''
    i = names.index(here)
    prev, nxt = PAGES[i - 1], PAGES[i + 1] if i + 1 < len(PAGES) else None
    a = f'<a class="prev" href="{prev[0] if prev[0] != "index.html" else "./"}" rel="prev"><small>← Previous</small>{html.escape(prev[1])}</a>'
    b = f'<a class="next" href="{nxt[0]}" rel="next"><small>Next →</small>{html.escape(nxt[1])}</a>' if nxt else ''
    return f'<nav class="pager" aria-label="Chapter navigation">{a}{b}</nav>\n'


def jsonld(name, title, desc, url, chapter_no):
    site = {"@type": "WebSite", "@id": SITE + "#website", "name": "SSEC — Quantum, Solids & Devices", "url": SITE, "inLanguage": "en",
            "description": "Interactive course notes on quantum mechanics, solid-state physics, semiconductor devices and nanoelectronics.",
            "author": {"@type": "Person", "name": "Satnam Singh", "url": "https://github.com/namsat"}}
    if name == 'index.html':
        graph = [site, {"@type": "Course", "@id": SITE + "#course", "name": "Quantum, Solids & Devices", "description": desc, "url": SITE,
                        "inLanguage": "en", "isAccessibleForFree": True, "educationalLevel": "University (bachelor/master)",
                        "provider": {"@type": "Person", "name": "Satnam Singh", "url": "https://github.com/namsat"},
                        "hasCourseInstance": {"@type": "CourseInstance", "courseMode": "online", "courseWorkload": "PT40H"},
                        "offers": {"@type": "Offer", "category": "Free", "price": 0, "priceCurrency": "EUR"},
                        "hasPart": [{"@type": "LearningResource", "name": t, "url": SITE + f} for f, t in PAGES[1:]]}]
    else:
        graph = [site,
                 {"@type": "LearningResource", "@id": url + "#page", "name": title, "headline": title, "description": desc, "url": url,
                  "inLanguage": "en", "isAccessibleForFree": True, "learningResourceType": ["lecture notes", "interactive simulation"],
                  "educationalLevel": "University", "position": chapter_no, "isPartOf": {"@id": SITE + "#course"},
                  "author": {"@type": "Person", "name": "Satnam Singh"}, "image": SITE + "assets/img/og.png"},
                 {"@type": "BreadcrumbList", "itemListElement": [
                     {"@type": "ListItem", "position": 1, "name": "SSEC", "item": SITE},
                     {"@type": "ListItem", "position": 2, "name": title, "item": url}]}]
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, separators=(',', ':'))


def slider(m):
    p = m.group(1).split('|')
    p += [''] * (10 - len(p))
    id_, name, label, mn, mx, st, val, unit, dec, flags = p[:10]
    attrs = f'data-unit="{unit}" ' if unit else ''
    attrs += f'data-dec="{dec or 2}"'
    if 'log' in flags: attrs += ' data-log="1"'
    if 'sci' in flags: attrs += ' data-sci="1"'
    return (f'<div class="ctl"><label for="{id_}">{label} <output for="{id_}"></output></label>'
            f'<input type="range" id="{id_}" name="{name}" min="{mn}" max="{mx}" step="{st}" value="{val}" {attrs}></div>')


def select(m):
    id_, name, label, opts = m.group(1).split('|', 3)
    o = ''.join(f'<option value="{v.split(":",1)[0]}">{v.split(":",1)[1]}</option>' for v in opts.split(';'))
    return f'<div class="ctl"><label for="{id_}">{label}</label><select id="{id_}" name="{name}">{o}</select></div>'


def check(m):
    p = m.group(1).split('|') + ['']
    id_, name, label, chk = p[:4]
    return f'<div class="ctl"><label class="check" for="{id_}"><input type="checkbox" id="{id_}" name="{name}"{" checked" if chk else ""}> {label}</label></div>'


def fig(m):
    p = m.group(1).split('|') + ['', '']
    id_, title, aria, flags = p[:4]
    size = ' tall' if 'tall' in flags else ' short' if 'short' in flags else ''
    cv = f'<div class="plot-wrap{size}"><canvas id="c-{id_}" aria-label="{aria}"></canvas></div>'
    if 'two' in flags:
        cv = f'<div class="plots-2">{cv}<div class="plot-wrap{size}"><canvas id="c-{id_}-b" aria-label="{aria} (second panel)"></canvas></div></div>'
    wide = ' wide' if ('wide' in flags or 'two' in flags) else ''
    return (f'<figure class="fig" id="f-{id_}" style="margin-left:0;margin-right:0"><div class="fig-head"><strong>{title}</strong><span class="tag">Interactive</span></div>'
            f'<div class="fig-body{wide}">{cv}<div class="controls" id="k-{id_}">')


def build():
    for f in sorted(SRC.glob('*.html')):
        txt = f.read_text(encoding='utf-8')
        first, body = txt.split('\n', 1)
        meta = [x.strip() for x in first.strip()[4:-3].split('|')]
        title, desc, toc = (meta + ['', '', 'yes'])[:3]
        body = re.sub(r'\{\{s\|(.*?)\}\}', slider, body)
        body = re.sub(r'\{\{sel\|(.*?)\}\}', select, body)
        body = re.sub(r'\{\{chk\|(.*?)\}\}', check, body)
        body = re.sub(r'\{\{fig\|(.*?)\}\}', fig, body)
        body = body.replace('{{cap}}', '</div></div><figcaption class="fig-cap">').replace('{{/fig}}', '</figcaption></figure>')
        body = re.sub(r'\{\{btn\|(.*?)\|(.*?)\}\}', r'<div class="ctl"><button type="button" id="\1">\2</button></div>', body)
        body = re.sub(r'\{\{out\|(.*?)\}\}', r'<div class="readout" id="\1" aria-live="polite"></div>', body)
        has_toc = toc != 'no'
        name = f.name
        noindex = name == '404.html'
        url = SITE if name == 'index.html' else SITE + name
        names = [p for p, _ in PAGES]
        chap = names.index(name) if name in names else 0
        doc_title = f'{title} | Interactive notes · SSEC' if name != 'index.html' else 'SSEC — Quantum, Solids & Devices: interactive physics and semiconductor notes'
        out = HEAD.format(doc_title=html.escape(doc_title), title=html.escape(title), desc=html.escape(desc), url=url, site=SITE, ga=GA_ID,
                          robots='noindex, follow' if noindex else 'index, follow, max-image-preview:large',
                          og_type='website' if name == 'index.html' else 'article',
                          jsonld=jsonld(name, title, desc, url, chap).replace('</', '<\\/'),
                          header=header_html(name), cls='' if has_toc else ' no-toc',
                          toc='<nav class="toc" aria-label="Page contents"></nav>\n' if has_toc else '') + body + TAIL.format(pager=pager_html(name))
        if noindex:  # served at arbitrary paths: make links absolute, no canonical
            out = out.replace('<head>\n', '<head>\n<base href="' + SITE + '">\n', 1)
            out = re.sub(r'<link rel="canonical"[^>]*>\n', '', out)
        (ROOT / name).write_text(out, encoding='utf-8')
        print('built', f.name)


def sitemap():
    def lastmod(f):
        try:
            d = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', f'src/{f}'], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        except Exception:
            d = ''
        return d or datetime.date.today().isoformat()
    rows = []
    for f, _ in PAGES:
        loc = SITE if f == 'index.html' else SITE + f
        pr = '1.0' if f == 'index.html' else '0.8'
        rows.append(f'  <url><loc>{loc}</loc><lastmod>{lastmod(f)}</lastmod><changefreq>monthly</changefreq><priority>{pr}</priority></url>')
    (ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(rows) + '\n</urlset>\n', encoding='utf-8')
    print('built sitemap.xml')


if __name__ == '__main__':
    build()
    sitemap()
