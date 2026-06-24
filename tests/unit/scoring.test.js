'use strict';

const { calculateSeoScore } = require('../../src/services/auditRunner');

function makePages(n, overrides = []) {
  return Array.from({ length: n }, (_, i) => ({
    url: `http://example.com/page-${i}`,
    status_code: 200,
    elapsed_ms:  500,
    issues: {},
    canonical: true,
    noindex: false,
    ...overrides[i],
  }));
}

describe('calculateSeoScore', () => {
  test('retourne 0 si aucune page', () => {
    const { score } = calculateSeoScore({ pages: [], dead_links: [] });
    expect(score).toBe(0);
  });

  test('retourne ~100 pour un site parfait', () => {
    const pages = makePages(15);
    const { score } = calculateSeoScore({ pages, dead_links: [] });
    expect(score).toBeGreaterThanOrEqual(95);
  });

  test('pénalise les balises title manquantes', () => {
    // 5 pages sur 10 sans title → pénalité = 15 * 0.5 = 7.5 > bonus max 5
    const pages = makePages(10, [
      { issues: { title: 'missing' }, canonical: false },
      { issues: { title: 'missing' }, canonical: false },
      { issues: { title: 'missing' }, canonical: false },
      { issues: { title: 'missing' }, canonical: false },
      { issues: { title: 'missing' }, canonical: false },
    ]);
    const { score, breakdown } = calculateSeoScore({ pages, dead_links: [] });
    expect(score).toBeLessThan(100);
    expect(breakdown.title.pages_affected).toBe(5);
  });

  test('pénalise les liens morts (plafond à 30)', () => {
    const pages = makePages(20);
    const dead_links = Array.from({ length: 10 }, (_, i) => ({ url: `http://dead-${i}.com` }));
    const { score, breakdown } = calculateSeoScore({ pages, dead_links });
    expect(breakdown.dead_links.count).toBe(10);
    expect(score).toBeLessThan(100);
  });

  test('pénalise la vitesse très lente (>3000ms)', () => {
    const pages = makePages(10).map(p => ({ ...p, elapsed_ms: 4000 }));
    const { score, breakdown } = calculateSeoScore({ pages, dead_links: [] });
    expect(breakdown.speed.threshold).toBe('>3000ms');
    expect(score).toBeLessThan(100);
  });

  test('le score est toujours entre 0 et 100', () => {
    const pages = makePages(2, [
      { issues: { title: 'x', meta_description: 'x', h1: 'x' }, elapsed_ms: 5000 },
      { issues: { title: 'x', meta_description: 'x', h1: 'x' }, elapsed_ms: 5000 },
    ]);
    const dead_links = Array.from({ length: 20 }, () => ({ url: 'x' }));
    const { score } = calculateSeoScore({ pages, dead_links });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('bonus canonical et no-noindex', () => {
    const pages = makePages(20);
    const { score: scoreWithBonus } = calculateSeoScore({ pages, dead_links: [] });

    const pagesNoCanonical = pages.map(p => ({ ...p, canonical: false }));
    const { score: scoreWithout } = calculateSeoScore({ pages: pagesNoCanonical, dead_links: [] });
    expect(scoreWithBonus).toBeGreaterThanOrEqual(scoreWithout);
  });
});
