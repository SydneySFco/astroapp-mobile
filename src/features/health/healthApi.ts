import {createApi} from '@reduxjs/toolkit/query/react';

import {axiosBaseQuery} from '../../services/api/axiosBaseQuery';

export type HealthResponse = {
  status: string;
  timestamp?: string;
};

export const healthApi = createApi({
  reducerPath: 'healthApi',
  baseQuery: axiosBaseQuery(),
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
