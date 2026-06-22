#!/usr/bin/env python3
"""
DGS SEO Bot — crawler BFS production-grade (v2)

Usage:
    python audit.py <site_url> [--max-pages N] [--delay-ms N] [--max-workers N]

Sortie: JSON structuré sur stdout
  {
    "pages":       [...],
    "dead_links":  [...],
    "crawl_stats": { "total_pages": N, "crawl_duration_ms": N, "pages_with_errors": N }
  }
"""

import sys
import json
import time
import asyncio
import argparse
from collections import deque
from urllib.parse import urljoin, urlparse, urldefrag
from urllib.robotparser import RobotFileParser

import aiohttp
from bs4 import BeautifulSoup


# ── Constantes (toutes nommées, aucune valeur magique en dur) ────────────────

USER_AGENT           = "DGS-SEO-Bot/1.0"
DEFAULT_MAX_PAGES    = 500
DEFAULT_DELAY_MS     = 500
DEFAULT_MAX_WORKERS  = 5
REQUEST_TIMEOUT_S    = 10   # timeout de connexion + lecture (hors DNS)
# Cap sur les vérifications de liens morts pour éviter des crawls interminables
MAX_DEAD_LINK_CHECK  = 200


# ── Utilitaires d'URL ────────────────────────────────────────────────────────

def normalize_url(url: str) -> str:
    """Supprime les fragments (#section) et normalise le chemin pour dédoublonner."""
    url, _ = urldefrag(url)
    parsed = urlparse(url)
    # Supprime la barre finale sauf sur la racine ("/")
    path = parsed.path.rstrip("/") or "/"
    return parsed._replace(path=path, fragment="").geturl()


def is_internal(url: str, base_netloc: str) -> bool:
    """Considère comme interne tout lien partageant le même domaine racine.
    Exemple : 'en.wikipedia.org' est interne à 'wikipedia.org'.
    """
    link_netloc = urlparse(url).netloc
    return link_netloc == base_netloc or link_netloc.endswith("." + base_netloc)


def is_http(url: str) -> bool:
    return urlparse(url).scheme in ("http", "https")


# ── robots.txt (RG-01) ───────────────────────────────────────────────────────

async def load_robots(session: aiohttp.ClientSession, base_url: str) -> RobotFileParser:
    """Charge et parse robots.txt du domaine cible.
    Si inaccessible ou absent (4xx/5xx), autorise tout le crawl (standard RFC).
    Note : on ne peut pas utiliser rp.read() car il est synchrone + bloquant.
    On gère manuellement allow_all pour reproduire le comportement de read().
    """
    parsed     = urlparse(base_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp         = RobotFileParser()
    rp.set_url(robots_url)
    try:
        async with session.get(
            robots_url,
            timeout=aiohttp.ClientTimeout(sock_connect=REQUEST_TIMEOUT_S, sock_read=REQUEST_TIMEOUT_S)
        ) as resp:
            if resp.status == 200:
                text = await resp.text(errors="replace")
                rp.parse(text.splitlines())
            else:
                # 404 / 5xx → aucune restriction, comme le ferait rp.read() en cas de 4xx
                rp.allow_all = True
    except Exception:
        # Timeout ou erreur réseau → on autorise par défaut
        rp.allow_all = True
    return rp


# ── Récupération d'une page ──────────────────────────────────────────────────

async def fetch_page(
    session: aiohttp.ClientSession,
    url: str
) -> tuple:
    """Retourne (status: int|None, elapsed_ms: int, final_url: str, html: str|None).
    Les redirections 301/302 sont suivies automatiquement (allow_redirects=True).
    """
    start = time.monotonic()
    try:
        async with session.get(
            url,
            timeout=aiohttp.ClientTimeout(sock_connect=REQUEST_TIMEOUT_S, sock_read=REQUEST_TIMEOUT_S),
            allow_redirects=True
        ) as resp:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            html       = await resp.text(errors="replace")
            return resp.status, elapsed_ms, str(resp.url), html
    except Exception:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        return None, elapsed_ms, url, None


# ── Analyse SEO d'une page ───────────────────────────────────────────────────

def analyze_page(
    url: str,
    status: int,
    elapsed_ms: int,
    html: str,
    base_netloc: str
) -> dict:
    """Extrait toutes les métriques SEO d'une page HTML et retourne un dict structuré."""
    soup = BeautifulSoup(html, "html.parser")

    # ── Balises SEO fondamentales ────────────────────────────────────────────
    title_tag  = soup.find("title")
    title      = title_tag.get_text(strip=True) if title_tag else None

    md_tag           = soup.find("meta", attrs={"name": "description"})
    meta_description = (
        (md_tag.get("content") or "").strip() or None
    ) if md_tag else None

    h1_tags  = soup.find_all("h1")
    h1_count = len(h1_tags)

    # Structure des headings h1 à h6
    headings = {f"h{i}": len(soup.find_all(f"h{i}")) for i in range(1, 7)}

    # ── Balises techniques ────────────────────────────────────────────────────
    canonical_tag = soup.find("link", attrs={"rel": "canonical"})
    canonical     = canonical_tag.get("href") if canonical_tag else None

    mr_tag              = soup.find("meta", attrs={"name": "robots"})
    meta_robots_content = (mr_tag.get("content") or "").lower() if mr_tag else ""
    noindex             = "noindex"  in meta_robots_content
    nofollow            = "nofollow" in meta_robots_content

    # ── Extraction des liens ──────────────────────────────────────────────────
    internal_links: set = set()
    external_links: set = set()

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        absolute = normalize_url(urljoin(url, href))
        if not is_http(absolute):
            continue
        if is_internal(absolute, base_netloc):
            internal_links.add(absolute)
        else:
            external_links.add(absolute)

    # ── Problèmes SEO détectés ────────────────────────────────────────────────
    issues: dict = {}
    if not title:
        issues["title"] = "manquant"
    if not meta_description:
        issues["meta_description"] = "manquant"
    if h1_count == 0:
        issues["h1"] = "absent"
    elif h1_count > 1:
        issues["h1"] = f"{h1_count} balises H1 détectées (1 attendue)"

    return {
        "url":              url,
        "status_code":      status,
        "elapsed_ms":       elapsed_ms,
        "title":            title,
        "meta_description": meta_description,
        "h1_count":         h1_count,
        "headings":         headings,
        "canonical":        canonical,
        "noindex":          noindex,
        "nofollow":         nofollow,
        "issues":           issues,
        "internal_links":   sorted(internal_links),
        "external_links":   sorted(external_links),
    }


# ── Vérification des liens morts ─────────────────────────────────────────────

async def check_link(
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
    url: str
) -> dict:
    """HEAD en premier (plus léger), fallback GET si HEAD non supporté.
    Retourne {"url": ..., "status": int|None}.
    """
    async with semaphore:
        timeout = aiohttp.ClientTimeout(sock_connect=REQUEST_TIMEOUT_S, sock_read=REQUEST_TIMEOUT_S)
        for method in ("head", "get"):
            try:
                async with getattr(session, method)(
                    url, timeout=timeout, allow_redirects=True
                ) as resp:
                    return {"url": url, "status": resp.status}
            except Exception:
                continue
        return {"url": url, "status": None}


async def check_dead_links(
    session: aiohttp.ClientSession,
    urls: set,
    max_workers: int
) -> list:
    """Vérifie en parallèle (semaphore) le statut de chaque URL.
    Considère mort : status None (timeout/erreur) ou >= 400.
    """
    if not urls:
        return []
    semaphore = asyncio.Semaphore(max_workers)
    results   = await asyncio.gather(
        *[check_link(session, semaphore, u) for u in urls]
    )
    return [r for r in results if r["status"] is None or r["status"] >= 400]


# ── BFS crawler ───────────────────────────────────────────────────────────────

async def run_crawl(
    site_url: str,
    max_pages: int,
    delay_ms: int,
    max_workers: int
) -> dict:
    """Crawl BFS (Breadth-First Search) du site.

    Garanties :
    - Chaque URL n'est visitée qu'une seule fois (ensemble visited)
    - robots.txt est respecté avant chaque requête (RG-01)
    - Délai configurable entre chaque requête (politesse)
    - Redirections suivies automatiquement
    - Liens morts vérifiés en parallèle après le crawl
    """
    crawl_start         = time.monotonic()
    base_netloc         = urlparse(site_url).netloc
    visited:       set  = set()
    crawled_urls:  set  = set()
    queue               = deque([normalize_url(site_url)])
    pages:         list = []
    all_outgoing:  set  = set()

    # ThreadedResolver utilise le DNS système (socket.getaddrinfo) via un thread pool,
    # ce qui contourne les problèmes du resolver DNS asynchrone natif d'aiohttp.
    resolver  = aiohttp.ThreadedResolver()
    connector = aiohttp.TCPConnector(limit=max_workers, ssl=False, resolver=resolver)
    # On exclut "br" (Brotli) : la version système d'aiohttp ne le décode pas.
    headers   = {"User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate"}

    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:

        # ── 1. Chargement de robots.txt ───────────────────────────────────
        robots = await load_robots(session, site_url)

        # ── 2. BFS ────────────────────────────────────────────────────────
        while queue and len(pages) < max_pages:
            url = queue.popleft()

            if url in visited:
                continue
            visited.add(url)

            # Vérification robots.txt avant chaque requête (RG-01)
            if not robots.can_fetch(USER_AGENT, url):
                continue

            # Délai de politesse (sauf pour la toute première page)
            if pages:
                await asyncio.sleep(delay_ms / 1000)

            status, elapsed_ms, final_url, html = await fetch_page(session, url)

            # Page inaccessible : enregistrée comme erreur, BFS continue
            if html is None:
                pages.append({
                    "url":         url,
                    "status_code": status,
                    "elapsed_ms":  elapsed_ms,
                    "error":       True,
                    "issues":      {"fetch": "impossible d'accéder à la page"},
                })
                continue

            page_data = analyze_page(final_url, status, elapsed_ms, html, base_netloc)
            pages.append(page_data)
            crawled_urls.add(final_url)

            # Enqueue les liens internes non encore visités
            for link in page_data["internal_links"]:
                if link not in visited:
                    queue.append(link)

            # Collecte globale pour la vérification des liens morts
            all_outgoing.update(page_data["internal_links"])
            all_outgoing.update(page_data["external_links"])

        # ── 3. Vérification des liens morts ──────────────────────────────
        # Exclure les URLs déjà crawlées (statut connu) et cap à MAX_DEAD_LINK_CHECK
        links_to_check = list(all_outgoing - crawled_urls)[:MAX_DEAD_LINK_CHECK]
        dead_links     = await check_dead_links(session, set(links_to_check), max_workers)

    crawl_duration_ms = int((time.monotonic() - crawl_start) * 1000)
    pages_with_errors = sum(
        1 for p in pages
        if p.get("error") or (p.get("status_code") and p["status_code"] >= 400)
    )

    return {
        "pages":      pages,
        "dead_links": dead_links,
        "crawl_stats": {
            "total_pages":       len(pages),
            "crawl_duration_ms": crawl_duration_ms,
            "pages_with_errors": pages_with_errors,
        },
    }


# ── Point d'entrée ────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="DGS SEO Bot — analyse technique SEO par crawl BFS"
    )
    parser.add_argument(
        "site_url",
        help="URL racine du site à crawler"
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=DEFAULT_MAX_PAGES,
        help=f"Nombre max de pages à crawler (défaut : {DEFAULT_MAX_PAGES})"
    )
    parser.add_argument(
        "--delay-ms",
        type=int,
        default=DEFAULT_DELAY_MS,
        help=f"Délai entre requêtes en ms (défaut : {DEFAULT_DELAY_MS})"
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=DEFAULT_MAX_WORKERS,
        help=f"Workers parallèles pour la vérif. des liens morts (défaut : {DEFAULT_MAX_WORKERS})"
    )
    return parser.parse_args()


def main():
    args = parse_args()
    try:
        result = asyncio.run(run_crawl(
            site_url    = args.site_url,
            max_pages   = args.max_pages,
            delay_ms    = args.delay_ms,
            max_workers = args.max_workers,
        ))
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
