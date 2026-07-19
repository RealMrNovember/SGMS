-- Faz 33: Rol bazlı kullanım kılavuzu (HelpArticle)

CREATE TYPE "HelpAudience" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'TRAINER', 'ATHLETE', 'RECEPTION');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HELP_ARTICLE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HELP_ARTICLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HELP_ARTICLE_DELETED';

CREATE TABLE "help_articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "audiences" "HelpAudience"[],
    "category" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "related_feature_flag" TEXT,
    "is_onboarding_guide" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "help_article_translations" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body_markdown" TEXT NOT NULL,
    CONSTRAINT "help_article_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "help_articles_slug_key" ON "help_articles"("slug");
CREATE INDEX "help_articles_category_sort_order_idx" ON "help_articles"("category", "sort_order");
CREATE INDEX "help_articles_is_onboarding_guide_idx" ON "help_articles"("is_onboarding_guide");
CREATE INDEX "help_articles_is_published_idx" ON "help_articles"("is_published");
CREATE UNIQUE INDEX "help_article_translations_article_id_locale_key" ON "help_article_translations"("article_id", "locale");
CREATE INDEX "help_article_translations_locale_idx" ON "help_article_translations"("locale");

ALTER TABLE "help_article_translations"
  ADD CONSTRAINT "help_article_translations_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "help_articles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
