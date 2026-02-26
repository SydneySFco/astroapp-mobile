import {createApi} from '@reduxjs/toolkit/query/react';

import {axiosBaseQuery} from '../../services/api/axiosBaseQuery';

export type HealthResponse = {
  status: string;
  timestamp?: string;
};

export const healthApi = createApi({
  reducerPath: 'healthApi',
  baseQuery: axiosBaseQuery({
    // Gerçek backend URL'i geldiğinde güncellenebilir.
    baseUrl: 'https://example.com',
  }),
  endpoints: build => ({
    getHealth: build.query<HealthResponse, void>({
      query: () => ({
        url: '/health',
        method: 'GET',
      }),
    }),
  }),
});

export const {useGetHealthQuery} = healthApi;
