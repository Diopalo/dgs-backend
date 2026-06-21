"""
Script d'audit technique SEO — RG-01, RG-02 (version multi-pages, J4)
Usage : python audit.py <url>
Sortie : un objet JSON sur stdout.

Crawle la page racine + jusqu'à MAX_PAGES_TO_ANALYZE-1 pages internes
supplementaires pour calculer une vitesse moyenne et un score representatifs
de l'ensemble du site, tout en respectant robots.txt et en limitant le
nombre de requêtes (RG-01).
"""

import sys
import json
import time
import asyncio
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import aiohttp
from bs4 import BeautifulSoup

MAX_PAGES_TO_ANALYZE = 5      # page racine incluse
MAX_LINKS_TO_CHECK = 20       # liens verifies pour les codes HTTP (morts inclus)
TIMEOUT_SECONDS = 10
MAX_CONCURRENT_REQUESTS = 5
USER_AGENT = "DGS-SEO-Auditor/1.0"


async def is_allowed_by_robots(session, url):
    """RG-01 : verifie que le crawl est autorise par robots.txt."""
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = RobotFileParser()
    try:
        async with session.get(robots_url, timeout=TIMEOUT_SECONDS) as response:
            if response.status == 200:
                content = await response.text()
                rp.parse(content.splitlines())
                return rp.can_fetch(USER_AGENT, url)
    except Exception:
        pass
    return True  # robots.txt inaccessible -> on autorise par defaut


async def fetch_page(session, url):
    start = time.monotonic()
    try:
        async with session.get(url, timeout=TIMEOUT_SECONDS, allow_redirects=True) as response:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            text = await response.text()
            return response.status, elapsed_ms, text
    except Exception:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        return None, elapsed_ms, None


async def check_link_status(session, semaphore, url):
    async with semaphore:
        try:
            async with session.head(url, timeout=TIMEOUT_SECONDS, allow_redirects=True) as response:
                return url, response.status
        except Exception:
            try:
                async with session.get(url, timeout=TIMEOUT_SECONDS, allow_redirects=True) as response:
                    return url, response.status
            except Exception:
                return url, None


def analyser_balises(html, base_url):
    soup = BeautifulSoup(html, "html.parser")

    title_tag = soup.find("title")
    meta_description = soup.find("meta", attrs={"name": "description"})
    h1_tags = soup.find_all("h1")

    balises_manquantes = {}
    if not title_tag or not title_tag.get_text(strip=True):
        balises_manquantes["title"] = "manquant"
    if not meta_description or not (meta_description.get("content") or "").strip():
        balises_manquantes["meta_description"] = "manquant"
    if len(h1_tags) == 0:
        balises_manquantes["h1"] = "manquant"
    elif len(h1_tags) > 1:
        balises_manquantes["h1"] = f"{len(h1_tags)} balises H1 detectees (1 attendue)"

    structure_headings = {f"h{level}": len(soup.find_all(f"h{level}")) for level in range(1, 7)}

    liens = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith(("mailto:", "tel:", "#")):
            continue
        absolute = urljoin(base_url, href)
        if urlparse(absolute).scheme in ("http", "https"):
            liens.add(absolute)

    return balises_manquantes, structure_headings, list(liens)


def calculer_score(balises_manquantes_resume, nb_pages, vitesse_ms_moyenne, nb_liens_morts):
    """
    RG-02 : score pondere, calcule sur des metriques agregees multi-pages.
    Ponderation :
      - title manquant     : -15 points * (proportion de pages concernees)
      - meta_description    : -10 points * (proportion de pages concernees)
      - h1 manquant/duplique: -10 points * (proportion de pages concernees)
      - vitesse moyenne      : -20 si > 3000ms, -10 si > 1000ms
      - liens morts          : -5 points par lien mort, plafonne à -30
    """
    score = 100.0

    if nb_pages > 0:
        score -= 15 * (balises_manquantes_resume.get("title", 0) / nb_pages)
        score -= 10 * (balises_manquantes_resume.get("meta_description", 0) / nb_pages)
        score -= 10 * (balises_manquantes_resume.get("h1", 0) / nb_pages)

    if vitesse_ms_moyenne > 3000:
        score -= 20
    elif vitesse_ms_moyenne > 1000:
        score -= 10

    score -= min(nb_liens_morts * 5, 30)

    return max(0, min(100, round(score)))


async def run_audit(url):
    async with aiohttp.ClientSession(headers={"User-Agent": USER_AGENT}) as session:
        if not await is_allowed_by_robots(session, url):
            return {"statut": "echec", "erreur": "Crawl interdit par robots.txt"}

        root_domain = urlparse(url).netloc

        # 1. Page racine
        status, vitesse_ms, html = await fetch_page(session, url)
        if status is None or html is None:
            return {"statut": "echec", "erreur": f"Impossible d'acceder à {url}"}

        balises, structure, liens = analyser_balises(html, url)
        pages_analysees = [{
            "url": url,
            "vitesse_ms": vitesse_ms,
            "balises_manquantes": balises,
            "structure_headings": structure,
        }]

        liens_internes = [l for l in liens if urlparse(l).netloc == root_domain and l != url]
        liens_externes = [l for l in liens if urlparse(l).netloc != root_domain]

        # 2. Pages internes supplementaires à analyser en profondeur
        pages_a_analyser = liens_internes[:MAX_PAGES_TO_ANALYZE - 1]

        for page_url in pages_a_analyser:
            if not await is_allowed_by_robots(session, page_url):
                continue
            p_status, p_vitesse, p_html = await fetch_page(session, page_url)
            if p_status is not None and p_html is not None:
                p_balises, p_structure, p_liens = analyser_balises(p_html, page_url)
                pages_analysees.append({
                    "url": page_url,
                    "vitesse_ms": p_vitesse,
                    "balises_manquantes": p_balises,
                    "structure_headings": p_structure,
                })
                liens_internes.extend([l for l in p_liens if urlparse(l).netloc == root_domain])
                liens_externes.extend([l for l in p_liens if urlparse(l).netloc != root_domain])

        # 3. Verification des liens morts (internes + externes, dedoublonnes)
        tous_liens = list(dict.fromkeys(liens_internes + liens_externes))
        liens_a_verifier = tous_liens[:MAX_LINKS_TO_CHECK]

        semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
        resultats_liens = await asyncio.gather(
            *[check_link_status(session, semaphore, lien) for lien in liens_a_verifier]
        )
        liens_morts = [
            {"url": lien, "code": code}
            for lien, code in resultats_liens
            if code is None or code >= 400
        ]

        # 4. Agregation des metriques multi-pages
        nb_pages = len(pages_analysees)
        vitesse_ms_moyenne = round(sum(p["vitesse_ms"] for p in pages_analysees) / nb_pages)

        balises_manquantes_resume = {"title": 0, "meta_description": 0, "h1": 0}
        for p in pages_analysees:
            for cle in balises_manquantes_resume:
                if cle in p["balises_manquantes"]:
                    balises_manquantes_resume[cle] += 1

        score = calculer_score(balises_manquantes_resume, nb_pages, vitesse_ms_moyenne, len(liens_morts))

        return {
            "statut": "termine",
            "score": score,
            "vitesse_ms_moyenne": vitesse_ms_moyenne,
            "pages_analysees": pages_analysees,
            "balises_manquantes_resume": balises_manquantes_resume,
            "liens_analyses": len(liens_a_verifier),
            "liens_morts": liens_morts,
        }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"statut": "echec", "erreur": "URL manquante en argument"}))
        sys.exit(1)

    url = sys.argv[1]
    resultat = asyncio.run(run_audit(url))
    print(json.dumps(resultat, ensure_ascii=False))


if __name__ == "__main__":
    main()
