import type { AuditLogFilters } from '@/lib/admin/audit-query';

export type AuditPageParams = {
  q?: string;
  category?: string;
  action?: string;
  organizationId?: string;
  from?: string;
  to?: string;
  page?: string;
  pageSize?: string;
  showNoise?: string;
};

export function auditBasePath(organizationId?: string) {
  return organizationId
    ? `/admin/organizations/${organizationId}/audit`
    : '/admin/audit';
}

export function buildAuditQueryString(
  params: AuditPageParams,
  overrides: Record<string, string | undefined> = {},
) {
  const merged = { ...params, ...overrides };
  const query = new URLSearchParams();

  if (merged.q) query.set('q', merged.q);
  if (merged.category) query.set('category', merged.category);
  if (merged.action) query.set('action', merged.action);
  if (merged.organizationId) query.set('organizationId', merged.organizationId);
  if (merged.from) query.set('from', merged.from);
  if (merged.to) query.set('to', merged.to);
  if (merged.pageSize) query.set('pageSize', merged.pageSize);
  if (merged.page) query.set('page', merged.page);
  if (merged.showNoise === '1') query.set('showNoise', '1');

  return query.toString();
}

export function auditPageHref(
  basePath: string,
  params: AuditPageParams,
  overrides: Record<string, string | undefined> = {},
) {
  const qs = buildAuditQueryString(params, overrides);
  return qs ? `${basePath}?${qs}` : basePath;
}

export function filtersToQueryParams(filters: AuditLogFilters, page?: number, pageSize?: number) {
  const params: AuditPageParams = {};
  if (filters.q) params.q = filters.q;
  if (filters.category && filters.category !== 'all') params.category = filters.category;
  if (filters.action) params.action = filters.action;
  if (filters.organizationId) params.organizationId = filters.organizationId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (page) params.page = String(page);
  if (pageSize) params.pageSize = String(pageSize);
  return params;
}
