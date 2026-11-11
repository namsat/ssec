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
import re, pathlib, html

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / 'src'

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · SSEC</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#2f4ecb">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%232f4ecb'/%3E%3Cpath d='M5 20 C9 20 9 8 13 8 S17 24 21 24 S25 14 27 14' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E">
<script>try{{var t=localStorage.getItem('ssec-theme');if(t)document.documentElement.setAttribute('data-theme',t)}}catch(e){{}}</script>
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
<div class="page{cls}">
{toc}<main id="main" tabindex="-1">
"""
TAIL = """
</main>
</div>
</body>
</html>
"""


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
        out = HEAD.format(title=html.escape(title), desc=html.escape(desc),
                          cls='' if has_toc else ' no-toc',
                          toc='<nav class="toc" aria-label="Page contents"></nav>\n' if has_toc else '') + body + TAIL
        (ROOT / f.name).write_text(out, encoding='utf-8')
        print('built', f.name)


if __name__ == '__main__':
    build()
