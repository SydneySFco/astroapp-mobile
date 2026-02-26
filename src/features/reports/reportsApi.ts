import {createApi} from '@reduxjs/toolkit/query/react';

import {axiosBaseQuery} from '../../services/api/axiosBaseQuery';

export type ReportCatalogItem = {
  id: string;
  title: string;
  shortDescription: string;
  preview: string;
  price: number;
  currency: 'TRY';
};

export type ReportDetail = ReportCatalogItem & {
  fullContent: string;
  purchased: boolean;
};

export type PurchasedReport = {
  reportId: string;
  purchasedAt: string;
};

export type ReportCatalogResponse = {
  items: ReportCatalogItem[];
};

export type PurchasedReportsResponse = {
  items: PurchasedReport[];
};

export const reportsApi = createApi({
  reducerPath: 'reportsApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['ReportsCatalog', 'ReportDetail', 'PurchasedReports'],
  endpoints: builder => ({
    getReportCatalog: builder.query<ReportCatalogResponse, void>({
      query: () => ({
        url: '/reports/catalog',
        method: 'GET',
      }),
      providesTags: ['ReportsCatalog'],
      // NOTE: Keep local mock fallback (reportsSlice initialState) until backend route is stable.
    }),
    getReportDetail: builder.query<ReportDetail, string>({
      query: reportId => ({
        url: `/reports/${reportId}`,
        method: 'GET',
      }),
      providesTags: (_, __, reportId) => [{type: 'ReportDetail', id: reportId}],
      // NOTE: UI currently reads local report content; switch to this endpoint as source of truth in RLOOP-010.
    }),
    getPurchasedReports: builder.query<PurchasedReportsResponse, void>({
      query: () => ({
        url: '/reports/purchased',
        method: 'GET',
      }),
      providesTags: ['PurchasedReports'],
    }),
  }),
});

export const {
  useGetReportCatalogQuery,
  useGetReportDetailQuery,
  useGetPurchasedReportsQuery,
} = reportsApi;
