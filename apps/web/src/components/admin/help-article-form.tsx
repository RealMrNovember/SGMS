'use client';

import {
  createHelpArticle,
  deleteHelpArticle,
  updateHelpArticle,
  type HelpAdminState,
} from '@/actions/help-admin';
import { HELP_CATEGORIES, HELP_LOCALES } from '@/lib/help/types';
import { useRouter } from 'next/navigation';
import { useActionState, useTransition } from 'react';

const AUDIENCES = ['OWNER', 'ADMIN', 'STAFF', 'TRAINER', 'ATHLETE', 'RECEPTION'] as const;

type ArticleFormValues = {
  id?: string;
  slug: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
  isOnboardingGuide: boolean;
  onboardingKey: string;
  relatedFeatureFlag: string;
  audiences: string[];
  locale: string;
  title: string;
  bodyMarkdown: string;
};

export function HelpArticleForm({ initial }: { initial?: ArticleFormValues }) {
  const isEdit = Boolean(initial?.id);
  const action = isEdit ? updateHelpArticle : createHelpArticle;
  const [state, formAction, pending] = useActionState(action, {} as HelpAdminState);
  const router = useRouter();
  const [deletePending, startDelete] = useTransition();

  return (
    <div className="space-y-4">
      {state.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {state.success}
        </p>
      ) : null}

      <form action={formAction} className="card space-y-4 p-5">
        {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="muted">Slug</span>
            <input
              name="slug"
              required
              defaultValue={initial?.slug ?? ''}
              className="input w-full"
              placeholder="topic-example"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="muted">Kategori</span>
            <select name="category" className="input w-full" defaultValue={initial?.category ?? 'general'}>
              {HELP_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="muted">Sıra</span>
            <input
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={initial?.sortOrder ?? 0}
              className="input w-full"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="muted">Çeviri dili</span>
            <select name="locale" className="input w-full" defaultValue={initial?.locale ?? 'tr'}>
              {HELP_LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {locale}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="muted text-sm">Hedef kitle</legend>
          <div className="flex flex-wrap gap-3">
            {AUDIENCES.map((audience) => (
              <label key={audience} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="audiences"
                  value={audience}
                  defaultChecked={initial?.audiences?.includes(audience) ?? audience === 'OWNER'}
                />
                {audience}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isPublished" defaultChecked={initial?.isPublished ?? true} />
            Yayında
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isOnboardingGuide"
              defaultChecked={initial?.isOnboardingGuide ?? false}
            />
            Başlangıç rehberi
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="muted">Onboarding anahtarı</span>
            <input
              name="onboardingKey"
              defaultValue={initial?.onboardingKey ?? ''}
              className="input w-full"
              placeholder="owner | reception | trainer | athlete"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="muted">Feature flag (opsiyonel)</span>
            <input
              name="relatedFeatureFlag"
              defaultValue={initial?.relatedFeatureFlag ?? ''}
              className="input w-full"
              placeholder="integrations"
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="muted">Başlık</span>
          <input name="title" required defaultValue={initial?.title ?? ''} className="input w-full" />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="muted">İçerik (Markdown)</span>
          <textarea
            name="bodyMarkdown"
            required
            rows={16}
            defaultValue={initial?.bodyMarkdown ?? ''}
            className="input w-full font-mono text-xs"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={pending}>
            {pending ? '…' : isEdit ? 'Güncelle' : 'Oluştur'}
          </button>
          {initial?.id ? (
            <button
              type="button"
              className="button px-4 py-2 text-sm text-rose-200"
              disabled={deletePending}
              onClick={() => {
                if (!confirm('Bu kılavuzu silmek istediğinize emin misiniz?')) return;
                startDelete(async () => {
                  await deleteHelpArticle(initial.id!);
                  router.push('/admin/help');
                  router.refresh();
                });
              }}
            >
              Sil
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
