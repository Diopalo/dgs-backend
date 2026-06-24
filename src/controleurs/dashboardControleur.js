'use strict';

const prisma  = require('../configuration/prismaClient');
const { NotFoundError } = require('../utils/errors');

function calcSanteGlobale(scoreAudit, scorePositions, scoreRecos) {
  const score = Math.round(scoreAudit * 0.4 + scorePositions * 0.3 + scoreRecos * 0.3);
  return {
    score,
    niveau: score >= 70 ? 'bon' : score >= 40 ? 'moyen' : 'critique',
    detail: { score_audit: Math.round(scoreAudit), score_positions: Math.round(scorePositions), score_recos: Math.round(scoreRecos) },
  };
}

// GET /api/sites/:siteId/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);

    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, nom: true, url: true } });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const [audits, keywords, recos, contenus] = await Promise.all([
      prisma.auditResult.findMany({
        where: { siteId, statut: 'termine' },
        orderBy: { crawledAt: 'desc' },
        take: 10,
        select: { id: true, score: true, statut: true, crawledAt: true },
      }),
      prisma.keyword.findMany({
        where: { siteId },
        include: {
          positionnements: { orderBy: { mesuredAt: 'desc' }, take: 2 },
        },
      }),
      prisma.recommandation.findMany({
        where: { siteId, statut: { in: ['OUVERTE', 'EN_COURS'] } },
        orderBy: [{ priorite: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.contenuEditorial.findMany({
        where: { siteId },
        orderBy: { date_publication: 'asc' },
      }),
    ]);

    const dernierAudit  = audits[0] ?? null;
    const scoreAudit    = dernierAudit?.score ?? 0;

    // Score positions : 100 − (mots-clés hors top10 / total) × 100
    const total = keywords.length;
    const horsTop10 = keywords.filter(kw => {
      const pos = kw.positionnements[0]?.position;
      return pos === null || pos === undefined || pos > 10;
    }).length;
    const scorePositions = total > 0 ? Math.max(0, 100 - (horsTop10 / total) * 100) : 100;

    // Score recos : max(0, 100 − nb_recos_HAUTE_ouvertes × 10)
    const recoHautes  = recos.filter(r => r.priorite === 'HAUTE').length;
    const scoreRecos  = Math.max(0, 100 - recoHautes * 10);

    // Grouper par priorité
    const motsClesByPrio = { HAUTE: 0, MOYENNE: 0, BASSE: 0 };
    keywords.forEach(kw => { motsClesByPrio[kw.priorite]++; });

    const recosByPrio = { HAUTE: 0, MOYENNE: 0, BASSE: 0 };
    recos.forEach(r => { recosByPrio[r.priorite]++; });

    const contenusByStatut = { IDEE: 0, REDACTION: 0, PUBLIE: 0 };
    contenus.forEach(c => { contenusByStatut[c.statut]++; });

    // top5 positions : les 5 mots-clés les mieux positionnés avec position non-null
    const top5 = keywords
      .filter(kw => kw.positionnements[0]?.position != null)
      .sort((a, b) => (a.positionnements[0]?.position ?? 999) - (b.positionnements[0]?.position ?? 999))
      .slice(0, 5)
      .map(kw => {
        const curr = kw.positionnements[0]?.position;
        const prev = kw.positionnements[1]?.position;
        let tendance = 'stable';
        if (prev != null && curr != null) {
          tendance = curr < prev ? 'hausse' : curr > prev ? 'baisse' : 'stable';
        }
        return { expression: kw.expression, position_actuelle: curr, tendance };
      });

    // 3 prochains articles (date_publication >= aujourd'hui)
    const now = new Date();
    const aVenir = contenus
      .filter(c => c.date_publication && new Date(c.date_publication) >= now)
      .slice(0, 3);

    // 3 recos HAUTE les plus récentes
    const dernieresRecos = recos.filter(r => r.priorite === 'HAUTE').slice(0, 3);

    res.json({
      status: 'success',
      data: {
        site,
        audit: {
          dernier_score:      scoreAudit,
          date_dernier_audit: dernierAudit?.crawledAt ?? null,
          statut:             dernierAudit?.statut ?? null,
          evolution_score:    audits.map(a => ({ date: a.crawledAt, score: a.score })),
        },
        mots_cles: {
          total,
          par_priorite: motsClesByPrio,
          top5_positions: top5,
        },
        recommandations: {
          total_ouvertes: recos.length,
          par_priorite:   recosByPrio,
          dernieres:      dernieresRecos,
        },
        calendrier: {
          total:      contenus.length,
          par_statut: contenusByStatut,
          a_venir:    aVenir,
        },
        sante_globale: calcSanteGlobale(scoreAudit, scorePositions, scoreRecos),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/global  (ADMIN uniquement)
const getDashboardGlobal = async (req, res, next) => {
  try {
    const sites = await prisma.site.findMany({
      include: {
        auditResults: {
          where: { statut: 'termine' },
          orderBy: { crawledAt: 'desc' },
          take: 1,
        },
        keywords: {
          include: {
            positionnements: { orderBy: { mesuredAt: 'desc' }, take: 1 },
          },
        },
        recommandations: {
          where: { statut: { in: ['OUVERTE', 'EN_COURS'] } },
        },
      },
    });

    const rows = sites.map(site => {
      const scoreAudit    = site.auditResults[0]?.score ?? 0;
      const total         = site.keywords.length;
      const horsTop10     = site.keywords.filter(kw => {
        const p = kw.positionnements[0]?.position;
        return p == null || p > 10;
      }).length;
      const scorePositions = total > 0 ? Math.max(0, 100 - (horsTop10 / total) * 100) : 100;
      const recoHautes     = site.recommandations.filter(r => r.priorite === 'HAUTE').length;
      const scoreRecos     = Math.max(0, 100 - recoHautes * 10);
      const sante          = calcSanteGlobale(scoreAudit, scorePositions, scoreRecos);

      return {
        id:             site.id,
        nom:            site.nom,
        url:            site.url,
        score:          scoreAudit,
        recos_ouvertes: site.recommandations.length,
        sante_globale:  sante,
      };
    });

    rows.sort((a, b) => a.sante_globale.score - b.sante_globale.score);

    res.json({ status: 'success', data: rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard, getDashboardGlobal };
