import type {AxiosError, AxiosRequestConfig} from 'axios';
import axios from 'axios';
import type {BaseQueryFn} from '@reduxjs/toolkit/query';

import {getApiConfig} from '../../config/apiConfig';
import {tokenStorage} from '../auth/tokenStorage';

type AxiosBaseQueryArgs = {
  url: string;
  method?: AxiosRequestConfig['method'];
  data?: AxiosRequestConfig['data'];
  params?: AxiosRequestConfig['params'];
  headers?: AxiosRequestConfig['headers'];
};

type AxiosBaseQueryConfig = {
  baseUrl?: string;
};

export const axiosBaseQuery =
  ({baseUrl}: AxiosBaseQueryConfig = {}): BaseQueryFn<
    AxiosBaseQueryArgs,
    unknown,
    {status?: number | 'TIMEOUT'; data?: unknown}
  > =>
  async ({url, method = 'GET', data, params, headers}) => {
    try {
      const apiConfig = getApiConfig();
      const tokens = await tokenStorage.getTokens();
      const result = await axios({
        url: `${baseUrl ?? apiConfig.baseUrl}${url}`,
        method,
        data,
        params,
        timeout: apiConfig.timeoutMs,
        headers: {
          ...apiConfig.defaultHeaders,
          ...(tokens?.accessToken
            ? {
                Authorization: `Bearer ${tokens.accessToken}`,
              }
            : undefined),
          ...headers,
        },
      });

      return {data: result.data};
    } catch (axiosError) {
      const err = axiosError as AxiosError;
      return {
        error: {
          status: err.code === 'ECONNABORTED' ? 'TIMEOUT' : err.response?.status,
          data: err.response?.data ?? err.message,
        },
      };
    }
  };
