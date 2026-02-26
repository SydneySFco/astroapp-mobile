import type {AxiosError, AxiosRequestConfig} from 'axios';
import axios from 'axios';
import type {BaseQueryFn} from '@reduxjs/toolkit/query';

type AxiosBaseQueryArgs = {
  url: string;
  method?: AxiosRequestConfig['method'];
  data?: AxiosRequestConfig['data'];
  params?: AxiosRequestConfig['params'];
};

type AxiosBaseQueryConfig = {
  baseUrl: string;
};

export const axiosBaseQuery =
  ({baseUrl}: AxiosBaseQueryConfig = {baseUrl: ''}): BaseQueryFn<
    AxiosBaseQueryArgs,
    unknown,
    {status?: number; data?: unknown}
  > =>
  async ({url, method = 'GET', data, params}) => {
    try {
      const result = await axios({
        url: `${baseUrl}${url}`,
        method,
        data,
        params,
      });

      return {data: result.data};
    } catch (axiosError) {
      const err = axiosError as AxiosError;
      return {
        error: {
          status: err.response?.status,
          data: err.response?.data ?? err.message,
        },
      };
    }
  };
