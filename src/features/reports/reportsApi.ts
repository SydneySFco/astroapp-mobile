import {createApi, fakeBaseQuery} from '@reduxjs/toolkit/query/react';

import {isSupabaseConfigured, supabase} from '../../services/supabase/client';

export type ReportListItem = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  preview: string;
  price: number;
  currency: string;
};

export type ReportDetail = ReportListItem & {
  fullContent: string;
  purchased: boolean;
};

export type PurchasedReport = {
  reportId: string;
  purchasedAt: string;
};

export type ReportCatalogResponse = {
  items: ReportListItem[];
};

export type PurchasedReportsResponse = {
  items: PurchasedReport[];
};

type SupabaseReportCatalogRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price_cents: number;
  currency: string;
  is_active: boolean;
};

type SupabaseUserReportRow = {
  report_catalog_id: string;
  created_at: string;
  title: string | null;
  summary: string | null;
  content_json: unknown;
};

const fallbackCatalog: ReportListItem[] = [
  {
    id: 'career-focus-2026',
    slug: 'career-focus-2026',
    title: 'Kariyer Odağı Raporu',
    shortDescription: 'Önümüzdeki 30 gün için iş ve üretkenlik odağı.',
    preview:
      'Bu dönemde dikkatini tek bir hedefe topladığında ivme artıyor. 7 günlük planla ilerlemek en güçlü strateji.',
    price: 149,
    currency: 'TRY',
  },
  {
    id: 'relationship-patterns-2026',
    slug: 'relationship-patterns-2026',
    title: 'İlişki Dinamikleri Raporu',
    shortDescription: 'İletişim kalıpların ve duygusal denge önerileri.',
    preview:
      'Empati kasın güçlü; ancak sınır koymayı geciktirdiğinde yorgunluk artıyor. Net istek cümleleri ilişkiyi dengeler.',
    price: 199,
    currency: 'TRY',
  },
];

const mapCatalogRowToItem = (row: SupabaseReportCatalogRow): ReportListItem => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  shortDescription: row.description ?? 'Açıklama yakında eklenecek.',
  preview: row.description ?? 'Ön izleme metni yakında eklenecek.',
  price: Number((row.price_cents / 100).toFixed(2)),
  currency: row.currency,
});

const mapUserReportContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (content && typeof content === 'object') {
    return JSON.stringify(content, null, 2);
  }

  return 'Rapor içeriği hazırlanıyor.';
};

export const reportsApi = createApi({
  reducerPath: 'reportsApi',
  baseQuery: fakeBaseQuery<{status?: number; data?: unknown}>(),
  tagTypes: ['ReportsCatalog', 'ReportDetail', 'PurchasedReports'],
  endpoints: builder => ({
    getReportCatalog: builder.query<ReportCatalogResponse, void>({
      async queryFn() {
        if (!isSupabaseConfigured) {
          return {data: {items: fallbackCatalog}};
        }

        const {data, error} = await supabase
          .from('reports_catalog')
          .select('id,slug,title,description,price_cents,currency,is_active')
          .eq('is_active', true)
          .order('created_at', {ascending: false});

        if (error) {
          return {error: {status: 500, data: error.message}};
        }

        return {
          data: {
            items: ((data ?? []) as SupabaseReportCatalogRow[]).map(mapCatalogRowToItem),
          },
        };
      },
      providesTags: ['ReportsCatalog'],
    }),
    getReportDetail: builder.query<ReportDetail, string>({
      async queryFn(reportId) {
        if (!isSupabaseConfigured) {
          const fallback = fallbackCatalog.find(item => item.id === reportId);

          if (!fallback) {
            return {error: {status: 404, data: 'Report not found'}};
          }

          return {
            data: {
              ...fallback,
              fullContent: fallback.preview,
              purchased: false,
            },
          };
        }

        const [{data: catalogData, error: catalogError}, {data: userReportData}] = await Promise.all([
          supabase
            .from('reports_catalog')
            .select('id,slug,title,description,price_cents,currency,is_active')
            .eq('id', reportId)
            .eq('is_active', true)
            .single(),
          supabase
            .from('user_reports')
            .select('report_catalog_id,created_at,title,summary,content_json')
            .eq('report_catalog_id', reportId)
            .order('created_at', {ascending: false})
            .limit(1)
            .maybeSingle(),
        ]);

        if (catalogError) {
          return {error: {status: 500, data: catalogError.message}};
        }

        const catalogItem = mapCatalogRowToItem(catalogData as SupabaseReportCatalogRow);
        const userReport = (userReportData ?? null) as SupabaseUserReportRow | null;

        return {
          data: {
            ...catalogItem,
            fullContent: userReport ? mapUserReportContent(userReport.content_json) : catalogItem.preview,
            purchased: Boolean(userReport),
          },
        };
      },
      providesTags: (_, __, reportId) => [{type: 'ReportDetail', id: reportId}],
    }),
    getPurchasedReports: builder.query<PurchasedReportsResponse, void>({
      async queryFn() {
        if (!isSupabaseConfigured) {
          return {data: {items: []}};
        }

        const {data, error} = await supabase
          .from('user_reports')
          .select('report_catalog_id,created_at')
          .order('created_at', {ascending: false});

        if (error) {
          return {error: {status: 500, data: error.message}};
        }

        return {
          data: {
            items: ((data ?? []) as {report_catalog_id: string; created_at: string}[]).map(item => ({
              reportId: item.report_catalog_id,
              purchasedAt: item.created_at,
            })),
          },
        };
      },
      providesTags: ['PurchasedReports'],
    }),
    purchaseReport: builder.mutation<{ok: true}, {reportCatalogId: string}>({
      async queryFn({reportCatalogId}) {
        if (!isSupabaseConfigured) {
          return {data: {ok: true}};
        }

        const {error} = await supabase.from('report_orders').insert({
          report_catalog_id: reportCatalogId,
          status: 'pending',
        });

        if (error) {
          return {error: {status: 500, data: error.message}};
        }

        return {data: {ok: true}};
      },
      invalidatesTags: ['PurchasedReports'],
    }),
  }),
});

export const {
  useGetReportCatalogQuery,
  useGetReportDetailQuery,
  useGetPurchasedReportsQuery,
  usePurchaseReportMutation,
} = reportsApi;
