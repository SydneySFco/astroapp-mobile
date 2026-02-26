import {createApi} from '@reduxjs/toolkit/query/react';

import {axiosBaseQuery} from '../../services/api/axiosBaseQuery';
import {tokenStorage} from '../../services/auth/tokenStorage';
import type {
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
} from './authTypes';

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['AuthSession'],
  endpoints: builder => ({
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: body => ({
        url: '/auth/login',
        method: 'POST',
        data: body,
      }),
      async onQueryStarted(_, {queryFulfilled}) {
        const {data} = await queryFulfilled;
        await tokenStorage.setTokens(data.tokens);
      },
      invalidatesTags: ['AuthSession'],
    }),
    register: builder.mutation<AuthResponse, RegisterRequest>({
      query: body => ({
        url: '/auth/register',
        method: 'POST',
        data: body,
      }),
      async onQueryStarted(_, {queryFulfilled}) {
        const {data} = await queryFulfilled;
        await tokenStorage.setTokens(data.tokens);
      },
      invalidatesTags: ['AuthSession'],
    }),
    forgotPassword: builder.mutation<{message: string}, ForgotPasswordRequest>({
      query: body => ({
        url: '/auth/forgot-password',
        method: 'POST',
        data: body,
      }),
    }),
    logout: builder.mutation<{success: boolean}, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      async onQueryStarted(_, {queryFulfilled}) {
        try {
          await queryFulfilled;
        } finally {
          await tokenStorage.clearTokens();
        }
      },
      invalidatesTags: ['AuthSession'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useLogoutMutation,
} = authApi;
