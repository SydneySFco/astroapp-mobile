import {createApi} from '@reduxjs/toolkit/query/react';

import {axiosBaseQuery} from '../../services/api/axiosBaseQuery';

type LoginRequest = {
  email: string;
  password: string;
};

type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
  birthDate: string;
  intent: string;
};

type ForgotPasswordRequest = {
  email: string;
};

type AuthResponse = {
  message: string;
};

const API_BASE_URL = '';

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: axiosBaseQuery({baseUrl: API_BASE_URL}),
  endpoints: builder => ({
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: body => ({
        url: '/auth/login',
        method: 'POST',
        data: body,
      }),
    }),
    register: builder.mutation<AuthResponse, RegisterRequest>({
      query: body => ({
        url: '/auth/register',
        method: 'POST',
        data: body,
      }),
    }),
    forgotPassword: builder.mutation<AuthResponse, ForgotPasswordRequest>({
      query: body => ({
        url: '/auth/forgot-password',
        method: 'POST',
        data: body,
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
} = authApi;
