'use strict';

// Tests des règles métier de recoService (isolés, sans DB)
// On teste les fonctions internes via generateRecommandations sur des données mockées

jest.mock('../../src/configuration/prismaClient', () => ({
  auditResult: {
    findFirst: jest.fn(),
  },
  keyword: {
    findMany: jest.fn(),
  },
  recommandation: {
    findMany:     jest.fn(),
    createMany:   jest.fn(),
    count:        jest.fn(),
  },
}));

const prisma = require('../../src/configuration/prismaClient');
const { generateRecommandations } = require('../../src/services/recoService');

function makeAudit(breakdown) {
  return {
    id: 1,
    details: JSON.stringify({ breakdown }),
  };
}

describe('generateRecommandations — règles audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.recommandation.findMany.mockResolvedValue([]);
    prisma.recommandation.createMany.mockResolvedValue({ count: 0 });
    prisma.keyword.findMany.mockResolvedValue([]);
  });

  test('R01 — génère une reco HAUTE si balises title manquantes', async () => {
    prisma.auditResult.findFirst.mockResolvedValue(makeAudit({
      title: { pages_affected: 5, ratio: '5/10', penalty: -7 },
    }));
    prisma.recommandation.findMany.mockResolvedValue([]);

    const result = await generateRecommandations(1);
    const calls  = prisma.recommandation.createMany.mock.calls[0]?.[0]?.data ?? [];
    const recoTitle = calls.find(r => r.message.includes('title'));
    expect(recoTitle).toBeDefined();
    expect(recoTitle.priorite).toBe('HAUTE');
  });

  test('R02 — meta description > 50% → HAUTE', async () => {
    prisma.auditResult.findFirst.mockResolvedValue(makeAudit({
      meta_description: { pages_affected: 6, ratio: '6/10', penalty: -6 },
    }));
    const result = await generateRecommandations(1);
    const calls  = prisma.recommandation.createMany.mock.calls[0]?.[0]?.data ?? [];
    const reco = calls.find(r => r.message.includes('meta description'));
    expect(reco?.priorite).toBe('HAUTE');
  });

  test('R05 — liens morts >= 5 → HAUTE', async () => {
    prisma.auditResult.findFirst.mockResolvedValue(makeAudit({
      dead_links: { count: 7, capped: false, penalty: -35 },
    }));
    const result = await generateRecommandations(1);
    const calls  = prisma.recommandation.createMany.mock.calls[0]?.[0]?.data ?? [];
    const reco = calls.find(r => r.message.includes('mort'));
    expect(reco?.priorite).toBe('HAUTE');
  });

  test('R08 — mot-clé HAUTE jamais mesuré', async () => {
    prisma.auditResult.findFirst.mockResolvedValue(null);
    prisma.keyword.findMany.mockResolvedValue([{
      id: 10,
      expression: 'seo senegal',
      priorite: 'HAUTE',
      volume_estime: 1000,
      positionnements: [],
    }]);
    const result = await generateRecommandations(1);
    const calls  = prisma.recommandation.createMany.mock.calls[0]?.[0]?.data ?? [];
    // R06 et R08 génèrent chacun une reco pour ce keyword — on cherche R08 (MOTS_CLES)
    const reco = calls.find(r => r.keywordId === 10 && r.type === 'MOTS_CLES');
    expect(reco).toBeDefined();
    expect(reco.priorite).toBe('HAUTE');
  });

  test('déduplication — ne recrée pas un message existant', async () => {
    prisma.auditResult.findFirst.mockResolvedValue(makeAudit({
      title: { pages_affected: 3, ratio: '3/10', penalty: -4 },
    }));
    const existingMsg = `3 page(s) sans balise <title>`;
    prisma.recommandation.findMany.mockResolvedValue([
      { message: `3 page(s) sans balise <title> détectée(s). Ajouter un title unique et descriptif sur chaque page (50-60 caractères recommandés).` },
    ]);

    await generateRecommandations(1);
    const calls = prisma.recommandation.createMany.mock.calls[0]?.[0]?.data ?? [];
    const dup = calls.find(r => r.message.includes('<title>'));
    expect(dup).toBeUndefined();
  });
});
