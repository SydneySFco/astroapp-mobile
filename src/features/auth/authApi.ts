import {createApi} from '@reduxjs/toolkit/query/react';

import {axiosBaseQuery} from '../../services/api/axiosBaseQuery';
import {tokenStorage} from '../../services/auth/tokenStorage';
import {supabaseAuth} from '../../services/supabase/auth';
import {isSupabaseConfigured} from '../../services/supabase/client';
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
      async queryFn(body, _api, _extra, baseQuery) {
        if (isSupabaseConfigured) {
          try {
            const data = await supabaseAuth.signIn(body);
            return {data};
          } catch (error) {
            return {
              error: {
                status: 400,
                data: error,
              },
            };
          }
        }

        return (await baseQuery({
          url: '/auth/login',
          method: 'POST',
          data: body,
        })) as {data: AuthResponse} | {error: {status?: number | 'TIMEOUT'; data?: unknown}};
      },
      async onQueryStarted(_, {queryFulfilled}) {
        const {data} = await queryFulfilled;
        await tokenStorage.setTokens(data.tokens);
      },
      invalidatesTags: ['AuthSession'],
    }),
    register: builder.mutation<AuthResponse, RegisterRequest>({
      async queryFn(body, _api, _extra, baseQuery) {
        if (isSupabaseConfigured) {
          try {
            const data = await supabaseAuth.signUp(body);
            return {data};
          } catch (error) {
            return {
              error: {
                status: 400,
                data: error,
              },
            };
          }
        }

        return (await baseQuery({
          url: '/auth/register',
          method: 'POST',
          data: body,
        })) as {data: AuthResponse} | {error: {status?: number | 'TIMEOUT'; data?: unknown}};
      },
      async onQueryStarted(_, {queryFulfilled}) {
        const {data} = await queryFulfilled;
        await tokenStorage.setTokens(data.tokens);
      },
      invalidatesTags: ['AuthSession'],
    }),
    forgotPassword: builder.mutation<{message: string}, ForgotPasswordRequest>({
      async queryFn(body, _api, _extra, baseQuery) {
        if (isSupabaseConfigured) {
          try {
            const data = await supabaseAuth.forgotPassword(body);
            return {data};
          } catch (error) {
            return {
              error: {
                status: 400,
                data: error,
              },
            };
          }
        }

        return (await baseQuery({
          url: '/auth/forgot-password',
          method: 'POST',
          data: body,
        })) as
          | {data: {message: string}}
          | {error: {status?: number | 'TIMEOUT'; data?: unknown}};
      },
    }),
    logout: builder.mutation<{success: boolean}, void>({
      async queryFn(_arg, _api, _extra, baseQuery) {
        if (isSupabaseConfigured) {
          try {
            const data = await supabaseAuth.logout();
            return {data};
          } catch (error) {
            return {
              error: {
                status: 400,
                data: error,
              },
            };
          }
        }

        return (await baseQuery({
          url: '/auth/logout',
          method: 'POST',
        })) as
          | {data: {success: boolean}}
          | {error: {status?: number | 'TIMEOUT'; data?: unknown}};
      },
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
