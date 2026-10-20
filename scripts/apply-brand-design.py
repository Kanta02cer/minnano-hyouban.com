#!/usr/bin/env python3
"""Apply the reviewed editorial layout to existing, source-backed HTML.

This is a presentation pass, not a replacement article generator. Existing source
sections, registered outbound anchors, structured evidence and dates are retained.
"""
import argparse
import hashlib
import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site-v2"
DATA = ROOT / "content/report-presentation.json"
HOLD_RECORDS = json.loads((ROOT / "content/report-publication-holds.json").read_text())["articles"]
HOLD = set(HOLD_RECORDS)
EDITED_DATE = "2026-10-20"
E = html.escape
PHOTOS = {
    "11756": ("sachi-plamo-murakami-11755.jpg", "Sachiプラモの商品を手にする村上博司氏", "11755", "left top"),
    "11755": ("sachi-plamo-murakami-11755.jpg", "株式会社サチクルの村上博司氏", "11755", "left top"),
    "11625": ("hira-tire-tanaka-11627.jpg", "比良タイヤ工業所の田中佑弥氏", "11627", "52% top"),
    "11627": ("hira-tire-tanaka-11627.jpg", "比良タイヤ工業所の田中佑弥氏", "11627", "52% top"),
    "11819": ("brain-sako-11820.jpg", "迫佑樹氏", "11820", "50% top"),
    "11820": ("brain-sako-11820.jpg", "迫佑樹氏", "11820", "50% top"),
}
HEADING_PHRASES = {
    "11197": ["施術の経験を、暮らしに", "寄り添う院づくりへ。"],
    "11669": ["現場で磨いた", "リフォームを、", "各地域の店舗へ。"],
    "11670": ["寄付を通じて、地域の", "困りごとに目を向ける。"],
    "11672": ["頭皮ケアを、サロンの", "技術とメニューに。"],
    "11970": ["起業の先に、事業を", "支える仕事があった。"],
    "12042": ["運送の現場から、", "確認業務を支える", "仕組みへ。"],
}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}


class Elements(HTMLParser):
    """Source offsets retain original markup, links and attribute values."""
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source, self.nodes, self.stack = source, [], []
        self.lines = [0]
        self.lines.extend(m.end() for m in re.finditer("\n", source))
        self.feed(source)

    def absolute_position(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        start = self.absolute_position()
        node = {"tag": tag, "attrs": dict(attrs), "start": start,
                "inner": start + len(self.get_starttag_text()),
                "parent": self.stack[-1] if self.stack else None}
        self.nodes.append(node)
        if tag in VOID:
            node["end"] = node["inner"]
            node["close"] = node["inner"]
        else:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            node = self.stack.pop()
            node["end"] = node["close"] = node["inner"]

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index]["tag"] == tag:
                node = self.stack[index]
                node["close"] = self.absolute_position()
                node["end"] = self.source.index(">", self.absolute_position()) + 1
                del self.stack[index:]
                return

    def one(self, tag=None, cls=None, id=None):
        found = [n for n in self.nodes if (not tag or n["tag"] == tag)
                 and (not cls or cls in n["attrs"].get("class", "").split())
                 and (not id or n["attrs"].get("id") == id)]
        if len(found) != 1:
            raise ValueError(f"Expected one element: {tag}/{cls}/{id}, got {len(found)}")
        return found[0]

    def raw(self, node):
        return self.source[node["start"]:node["end"]]

    def inside(self, node):
        return self.source[node["inner"]:node["close"]]


def plain(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def header():
    return '''<header class="shell journal-header">
<div class="utility"><span class="micro">COMPANY / SERVICE / PEOPLE</span><button class="motion-toggle" type="button" data-motion>アニメーションを止める</button></div>
<div class="masthead"><a class="brand" href="/" aria-label="みんなの評判.com ホーム"><span class="glitch" data-copy="みんなの評判">みんなの評判</span><small>.com</small></a><p>THE COMPANY REPORT &amp; REVIEW JOURNAL</p></div>
<nav class="main-nav" aria-label="メインメニュー"><div class="nav-links"><a href="/articles.html">企業・サービスを読む</a><a href="/guide.html">このメディアについて</a><a href="/editor.html">編集者</a></div><span class="micro">BEYOND THE NEWS</span></nav>
</header>'''


def footer():
    return '''<footer class="shell journal-footer"><div class="editor-note"><div><p class="micro">EDITOR'S NOTE</p><h2>ニュースの、その先へ。</h2></div><p>会社やサービスを知る入口は、ひとつのニュース。みんなの評判.comは、公開情報と提供された取材記録を照らし合わせ、事業の背景や具体的な工夫を伝えます。取材方法と情報の出所は、記事ごとに示しています。</p></div><div class="footer"><span>© みんなの評判.com</span><nav aria-label="フッターメニュー"><a href="/guide.html">編集方針</a> <a href="/editor.html">編集者</a> <a href="/privacy.html">プライバシー</a> <a href="/disclaimer.html">免責事項</a></nav></div></footer>'''


def photo(article_id, credit=True):
    filename, label, source_id, position = PHOTOS[article_id]
    image = f'<img src="/{filename}" alt="{E(label)}" style="object-position:{position}" decoding="async">'
    if not credit:
        return image
    return f'<figure class="journal-photo">{image}<figcaption>{E(label)} ／ 写真出典：<a href="https://globalnewsasia.com/article.php?id={source_id}&amp;country=4" data-mm-link="gna-photo-{source_id}">Global News Asia</a></figcaption></figure>'


def shell_document(source, main, page_class=""):
    head = re.search(r"<!doctype[^>]*>[\s\S]*?</head>", source, re.I)
    if not head:
        raise ValueError("HTML head absent")
    h = head[0]
    h = re.sub(r'<link[^>]+href=["\'](?:/)?(?:site|home-b|brand-story)\.css[^"\']*["\'][^>]*>\s*', "", h)
    h = re.sub(r'<script[^>]+src=["\']/brand-story\.js[^"\']*["\'][^>]*></script>\s*', "", h)
    h = h.replace("</head>", '<link rel="stylesheet" href="/brand-story.css?v=20261020">\n<script src="/brand-story.js?v=20261020" defer></script>\n</head>')
    return h + f'\n<body class="brand-journal {page_class}" data-brand-story="20261020"><a class="skip-link" href="#main">本文へ</a>\n' + header() + "\n" + main + "\n" + footer() + "\n</body>\n</html>\n"


def take_block(source, name):
    pattern = rf"<!-- {name}_START -->[\s\S]*?<!-- {name}_END -->"
    matches = re.findall(pattern, source)
    if len(matches) > 1:
        raise ValueError(f"Repeated {name}")
    return (matches[0] if matches else "", re.sub(pattern, "", source))


def replace_headline(source, headline, modified_date):
    source = re.sub(r'(<meta\s+property="og:title"\s+content=")[^"]*(")',
                    lambda m: m[1] + E(headline, quote=True) + m[2], source)
    def change(match):
        value = json.loads(match[2])
        if value.get("@type") == "Article":
            value["headline"] = headline
            value["dateModified"] = modified_date
        for node in value.get("@graph", []):
            if node.get("@type") == "WebPage":
                node["name"] = headline
                node["dateModified"] = modified_date
            if node.get("@type") == "BreadcrumbList":
                node["itemListElement"][-1]["name"] = headline
        return match[1] + json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + match[3]
    return re.sub(r'(<script\s+type="application/ld\+json"[^>]*>)([\s\S]*?)(</script>)', change, source)


def photo_measurement(source, article_id):
    """Register the one added, visible photograph credit, keeping existing IDs."""
    if article_id not in PHOTOS:
        return source
    source_id = PHOTOS[article_id][2]
    url = f"https://globalnewsasia.com/article.php?id={source_id}&country=4"
    link_id = f"gna-photo-{source_id}"
    pattern = r'(<script id="media-analytics-config" type="application/json">)([\s\S]*?)(</script>)'
    def update(match):
        config = json.loads(match[2])
        current = [link for link in config["links"] if link["id"] == link_id]
        expected = {"id": link_id, "kind": "news_gna", "href": url, "verified": True}
        if current and current != [expected]:
            raise ValueError(f"{article_id}: conflicting photograph measurement")
        if not current:
            config["links"].append(expected)
        config["manifestVersion"] = "20261020_links_v2_photos"
        return match[1] + json.dumps(config, ensure_ascii=False, separators=(",", ":")) + match[3]
    source, count = re.subn(pattern, update, source)
    if count != 1:
        raise ValueError(f"{article_id}: expected one measurement config")
    def cite(match):
        data = json.loads(match[2])
        if data.get("@type") == "Article" and url not in data.get("citation", []):
            data.setdefault("citation", []).append(url)
        return match[1] + json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + match[3]
    return re.sub(r'(<script\s+type="application/ld\+json"[^>]*>)([\s\S]*?)(</script>)', cite, source)


def apply_text(source, entry):
    scripts = []
    def hold(match):
        scripts.append(match[0])
        return f"@@BRAND_SCRIPT_{len(scripts) - 1}@@"
    source = re.sub(r"<script\b[\s\S]*?</script>", hold, source)
    for item in entry.get("textReplacements", []):
        old, new = item["from"], item["to"]
        if "<" in old or "<" in new:
            raise ValueError("Text replacements must not contain HTML")
        found = False
        replacement = E(new, quote=True)
        for encoded in dict.fromkeys([E(old, quote=True), E(old, quote=False), old]):
            if encoded in source:
                source = source.replace(encoded, replacement)
                found = True
        if not found and replacement not in source and new not in source:
            raise ValueError(f"Replacement source missing: {old[:80]}")
    def rewrite(value):
        if isinstance(value, str):
            if value.startswith(("https://", "http://", "/")):
                return value
            for item in entry.get("textReplacements", []):
                value = value.replace(item["from"], item["to"])
            return value
        if isinstance(value, list):
            return [rewrite(x) for x in value]
        if isinstance(value, dict):
            return {k: rewrite(v) for k, v in value.items()}
        return value
    for i, script in enumerate(scripts):
        if 'type="application/ld+json"' in script:
            opening, body, closing = re.fullmatch(r"(<script\b[^>]*>)([\s\S]*?)(</script>)", script).groups()
            script = opening + json.dumps(rewrite(json.loads(body)), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + closing
        source = source.replace(f"@@BRAND_SCRIPT_{i}@@", script)
    return source


def report(source, article_id, entry):
    source = apply_text(source, entry)
    doc = Elements(source)
    main_node = doc.one(cls="report-main")
    inside = doc.inside(main_node)
    brief, inside = take_block(inside, "SEARCH_BRIEF")
    guide, inside = take_block(inside, "READER_GUIDE")
    interview, inside = take_block(inside, "INTERVIEW_NOTES")
    # A regenerated interview contains the company block beside the interview.
    # In the reading layout the unchanged company block belongs in the reference half.
    company = ""
    interview_parts = re.findall(r'<section\b[\s\S]*?</section>', interview)
    if interview_parts:
        interview = "<!-- INTERVIEW_NOTES_START -->\n" + interview_parts[0] + "\n<!-- INTERVIEW_NOTES_END -->"
        if len(interview_parts) > 1:
            company = interview_parts[1]
    inside = re.sub(r'<div class="reference-divider"[^>]*>[\s\S]*?</div>', "", inside)
    parsed = Elements(inside)
    blocks = [n for n in parsed.nodes if n["parent"] is None and "end" in n]
    stories, references, official, misc = [], [], [], []
    ref_ids = {"related", "company", "company-heading", "record", "record-heading",
               "reviews", "reviews-heading", "reputation", "reputation-title",
               "sources", "sources-heading", "sources-title", "media", "coverage-title",
               "syndication-heading", "relationship", "relationship-title",
               "company-status", "company-profile-heading", "note", "track-record"}
    for n in blocks:
        raw, attrs = parsed.raw(n), n["attrs"]
        classes = attrs.get("class", "").split()
        if attrs.get("id") == "story-start":
            continue
        if attrs.get("id") == "company-profile":
            company = raw
        elif "original-deck" in classes:
            # Reviewed leads repeat facts retained in the article and new intro.
            continue
        elif "legacy-context" in classes:
            references.append(raw)
        elif "official-visit" in classes:
            official.append(raw)
        elif n["tag"] == "section":
            if attrs.get("aria-labelledby", "") in ref_ids or attrs.get("id") in {"editorial-relationship", "company-profile"}:
                references.append(raw)
            else:
                stories.append(raw)
        else:
            misc.append(raw)
    # Source-backed dates and author remain visible at the start.
    byline = re.search(r'<p\b[^>]*class="report-byline"[^>]*>[\s\S]*?</p>', brief)
    byline_html = byline[0] if byline else ""
    if byline:
        brief = brief.replace(byline_html, "")
    # Reruns retain the date/byline already in the hero.
    if not byline_html:
        old = re.search(r'<p\b[^>]*class="report-byline"[^>]*>[\s\S]*?</p>', source)
        byline_html = old[0] if old else ""
    modified_date = entry["modifiedDate"]
    year, month, day = map(int, modified_date.split("-"))
    byline_html = re.sub(r'記事更新：<time datetime="[^"]*">[^<]*</time>',
                        f'記事更新：<time datetime="{modified_date}">{year}年{month}月{day}日</time>', byline_html)
    old_meta = re.search(r'<div class="report-meta"[^>]*>[\s\S]*?</div>', source)
    old_meta = old_meta[0] if old_meta else ""
    # The original evidence navigation remains useful in the lower half.
    sidebar = [n for n in doc.nodes if n["tag"] == "aside" and "report-sidebar" in n["attrs"].get("class", "")]
    if sidebar:
        references.append('<div class="legacy-context">' + doc.inside(sidebar[0]) + "</div>")
    toc = [('story-start', '事業の背景を読む')]
    if interview:
        toc.append(('interview-notes', '取材から見える工夫'))
    if company:
        toc.append(('company-profile', '会社・サービス情報'))
    toc += [('research-brief', '特徴・実績・口コミ'), ('report-summary', 'まとめ'),
            ('report-faq', 'よくある質問')]
    nav = '<nav class="story-toc" aria-label="この記事の目次"><p class="micro">IN THIS STORY</p>' + "".join(
        f'<a href="#{target}"><span>{i:02d}</span>{E(label)}</a>' for i, (target, label) in enumerate(toc, 1)) + "</nav>"
    identity, heading = entry["identity"], entry["heading"]
    headline = identity + "｜" + heading
    phrases = HEADING_PHRASES.get(article_id, re.findall(r"[^、]+、?", heading))
    if "".join(phrases) != heading:
        raise ValueError(f"{article_id}: update the reviewed heading line breaks")
    heading_html = "".join(f'<span class="headline-phrase">{E(phrase)}</span>' for phrase in phrases)
    disclosure = [n for n in doc.nodes if n["attrs"].get("id") == "editorial-relationship"
                  and not (main_node["start"] < n["start"] < main_node["end"])]
    disclosure_html = "".join(doc.raw(n) for n in disclosure)
    hero = f'''<header class="article-top brand-article"><p class="breadcrumbs"><a href="/">ホーム</a> / <a href="/articles.html">企業・サービス</a></p><p class="kicker">COMPANY &amp; SERVICE / IN DEPTH</p><h1><small>{E(identity)}<span class="headline-divider">｜</span></small>{heading_html}</h1><p class="article-intro">{E(entry["lead"])}</p>{byline_html}{old_meta}{disclosure_html}</header>'''
    content = "\n".join(misc + stories + ([interview] if interview else []) + official)
    detail = '<div class="reference-divider"><p class="micro">DETAILS &amp; SOURCES</p><h2>もう一歩、詳しく。</h2><p>会社情報から、実績・口コミの読み方、記事の根拠まで。</p></div>'
    lower = "\n".join(([company] if company else []) + [brief] + references + [guide])
    visual = photo(article_id) if article_id in PHOTOS else ""
    main = f'<main id="main" class="shell">{hero}{visual}<div class="story-layout"><aside class="story-navigation">{nav}</aside><article class="report-main"><div id="story-start"></div>{content}\n{detail}\n{lower}</article></div></main>'
    return photo_measurement(shell_document(replace_headline(source, headline, modified_date), main, "report-page"), article_id)


def card(article_id, entry, index):
    category = "人物・経営" if any(x in entry["identity"] for x in ["氏", "代表"]) else "会社・サービス"
    short = entry["identity"] or entry["heading"]
    text = '<div class="card-visual type' + (' graphite' if index % 3 == 1 else '') + f'"><small>COMPANY / SERVICE</small><span>{E(short)}</span><small>REPORT {article_id}</small></div>'
    if article_id in PHOTOS:
        text = '<div class="card-visual">' + photo(article_id, False) + '</div>'
    return f'''<article class="story-card" data-story-card data-category="{E(category)}" data-search="{E(entry["identity"] + " " + entry["heading"] + " " + entry["lead"])}"><a href="/reports/{article_id}/">{text}<div class="card-copy"><div class="meta"><span>{category}</span><span>READ THE STORY ↗</span></div><h3>{E(entry["heading"])}</h3><p>{E(entry["identity"])}</p><div class="card-foot"><span>ニュースと取材から深掘りする</span><span class="arrow">↗</span></div></div></a></article>'''


def catalogue(source, entries, home=False):
    ids = re.search(r"const reportIds = \[(.*?)\];", (ROOT / "scripts/build-public-v2.js").read_text(), re.S)[1]
    ids = re.findall(r"'([^']+)'", ids)
    items = dict(entries)
    for id in ids:
        if id not in items:
            old = (SITE / f"reports/{id}/index.html").read_text()
            items[id] = {"identity": "村田隆行氏", "heading": plain(re.search(r"<h1[^>]*>([\s\S]*?)</h1>", old)[1]), "lead": ""}
    def update_catalogue(match):
        graph = json.loads(match[2])
        for node in graph.get("@graph", []):
            if node.get("@type") in {"WebPage", "CollectionPage"}:
                node["dateModified"] = EDITED_DATE
            if node.get("@type") == "ItemList":
                for item in node["itemListElement"]:
                    article_id = item["url"].rstrip("/").split("/")[-1]
                    if article_id in entries:
                        entry = entries[article_id]
                        item["name"] = entry["identity"] + "｜" + entry["heading"]
        return match[1] + json.dumps(graph, ensure_ascii=False, separators=(",", ":")) + match[3]
    source = re.sub(r'(<script type="application/ld\+json" data-search-graph>)([\s\S]*?)(</script>)',
                    update_catalogue, source)
    hero = '''<section class="editorial-hero"><div class="hero-intro"><p class="kicker">BEYOND THE NEWS</p><h1><span>ニュースの先に、</span><span><em>会社の素顔</em>がある。</span></h1><p class="intro-copy">選ばれる理由は、日々の仕事の中に。ニュースで話題になった会社やサービスの背景を、公開情報と取材記録からひもときます。</p><div class="hero-actions"><a class="solid-link" href="/articles.html">企業・サービスを読む <span>↗</span></a><a class="text-link" href="/guide.html">このメディアについて</a></div></div><a class="feature-visual art" href="/reports/11756/"><p class="micro">SERVICE CLOSE-UP / SACHI PLAMO</p><div class="large-word">Make.<br><i>Listen.</i><br>Make it better.</div><div><div class="art-step"><span>01</span><p>使う人の不便から、考える。</p></div><div class="art-step"><span>02</span><p>声を受け止め、改良へつなぐ。</p></div></div><div class="visual-foot"><span>Sachiプラモ / 株式会社サチクル</span><span>READ ↗</span></div></a></section>''' if home else '''<header class="article-top"><p class="kicker">THE STORIES</p><h1>企業・サービスを読む。</h1><p class="article-intro">ニュースで知った名前から、その会社らしい仕事の中へ。事業の背景、具体的な工夫、実績と口コミの根拠をたどります。</p></header>'''
    if home:
        hero = re.sub(r'<a class="feature-visual art"[\s\S]*?</a>', '<div><a class="feature-visual photo home-photo" href="/reports/11756/">' + photo("11756", False) + '<div class="photo-label"><p>Sachiプラモ / 株式会社サチクル</p><h2>道具づくりは、<br>使う人の声から。</h2></div></a><p class="photo-credit">写真出典：<a href="https://globalnewsasia.com/article.php?id=11755&amp;country=4">Global News Asia</a></p></div>', hero)
    tools = '''<div class="section-head"><h2>ストーリーを探す。<small>THE STORIES</small></h2><p><span data-story-count>66</span> ARTICLES</p></div><div class="browse-tools"><div class="filters"><button data-story-filter="all" aria-pressed="true">すべて</button><button data-story-filter="会社・サービス" aria-pressed="false">会社・サービス</button><button data-story-filter="人物・経営" aria-pressed="false">人物・経営</button></div><label class="search"><span aria-hidden="true">⌕</span><input type="search" data-story-search placeholder="会社名・サービス名で検索" aria-label="会社名・サービス名で記事を検索"></label></div>'''
    cards = '<div class="story-grid">' + "".join(card(id, items[id], i) for i, id in enumerate(ids)) + '</div><p class="empty" data-story-empty hidden>該当する記事はありません。別の言葉でもお試しください。</p>'
    sister = '''<section class="sister-banner"><div><p class="micro">SISTER MEDIA</p><h2>その選択に、人がいる。</h2><p>事業の背景にある、経営者の歩みと考え方。姉妹メディアでは、人生の転機や仕事への向き合い方に光を当てます。</p></div><div class="sister-right"><a class="sister-name" href="https://shacho-shuzai.com/">社長の取材<small>.com</small></a><p><a class="text-link" href="https://shacho-shuzai.com/">経営者のストーリーを読む <span>↗</span></a></p></div></section>'''
    return shell_document(source, f'<main id="main" class="shell">{hero}<section id="stories">{tools}{cards}</section>{sister}</main>', "home-page" if home else "archive-page")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", action="append", help="Only these report IDs; shared pages are left unchanged")
    ap.add_argument("--overrides", type=Path, help="Reviewed editorial presentation overrides")
    args = ap.parse_args()
    for id, record in HOLD_RECORDS.items():
        current = hashlib.sha256((SITE / f"reports/{id}/index.html").read_bytes()).hexdigest()
        if current != record["sha256"]:
            raise ValueError(f"{id}: held public snapshot SHA changed; reconcile the observed public file first")
    entries = json.loads(DATA.read_text())
    pending = {}
    if args.overrides:
        updates = json.loads(args.overrides.read_text())
        for id, data in updates.items():
            if id in HOLD:
                raise ValueError(f"{id}: publication hold")
            entries.setdefault(id, {}).update(data)
        # Keep typed interview/summary/FAQ source text aligned with the visible
        # replacement. Only exact, reviewed strings are changed, never URLs/IDs.
        def rewrite(value, replacements):
            if isinstance(value, str):
                if value.startswith(("https://", "http://", "/")):
                    return value
                for item in replacements:
                    value = value.replace(item["from"], item["to"])
                return value
            if isinstance(value, list):
                return [rewrite(x, replacements) for x in value]
            if isinstance(value, dict):
                return {k: rewrite(v, replacements) for k, v in value.items()}
            return value
        for name in ["search-briefs-bulk.json", "search-briefs-original.json",
                     "report-interviews.json", "report-reader-guides.json"]:
            path = ROOT / "content" / name
            values = json.loads(path.read_text())
            changed = False
            for id, update in updates.items():
                if id in values and update.get("textReplacements"):
                    new = rewrite(values[id], update["textReplacements"])
                    changed = changed or new != values[id]
                    values[id] = new
            if changed:
                pending[path] = json.dumps(values, ensure_ascii=False, indent=2) + "\n"
    for id, entry in entries.items():
        if id not in HOLD:
            entry.setdefault("modifiedDate", EDITED_DATE)
    pending[DATA] = json.dumps(entries, ensure_ascii=False, indent=2) + "\n"
    for name in ["search-briefs-bulk.json", "search-briefs-original.json"]:
        path = ROOT / "content" / name
        values = json.loads(pending.get(path, path.read_text()))
        for id, entry in entries.items():
            if id in values and id not in HOLD and (not args.id or id in args.id):
                values[id]["modifiedDate"] = entry["modifiedDate"]
        pending[path] = json.dumps(values, ensure_ascii=False, indent=2) + "\n"
    changed = []
    for id, entry in entries.items():
        if id in HOLD or (args.id and id not in args.id):
            continue
        p = SITE / f"reports/{id}/index.html"
        old = p.read_text()
        new = report(old, id, entry)
        if old != new:
            pending[p] = new
            changed.append(str(p.relative_to(ROOT)))
    if not args.id:
        for name in ["index.html", "articles.html"]:
            p = SITE / name
            pending[p] = catalogue(p.read_text(), entries, name == "index.html")
        for name in ["guide.html", "editor.html", "privacy.html", "disclaimer.html", "404.html"]:
            p = SITE / name
            source = p.read_text()
            doc = Elements(source)
            main_node = doc.one(tag="main")
            pending[p] = shell_document(source, doc.raw(main_node), "information-page")
    # No source data or HTML is written until every replacement has succeeded.
    for path, source in pending.items():
        if path.read_text() != source:
            path.write_text(source)
    print(json.dumps({"updated_reports": len(changed), "held_ids": sorted(HOLD)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
