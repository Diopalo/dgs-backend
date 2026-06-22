-- Ajout des champs structurés sur AuditResult pour le suivi d'état et les métriques SEO
ALTER TABLE "AuditResult" ADD COLUMN "statut"             TEXT NOT NULL DEFAULT 'en_cours';
ALTER TABLE "AuditResult" ADD COLUMN "vitesse_ms"         INTEGER;
ALTER TABLE "AuditResult" ADD COLUMN "balises_manquantes" TEXT;
ALTER TABLE "AuditResult" ADD COLUMN "liens_morts"        TEXT;
