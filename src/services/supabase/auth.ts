import type {AuthResponse, ForgotPasswordRequest, LoginRequest, RegisterRequest} from '../../features/auth/authTypes';
import type {AuthTokens} from '../auth/tokenStorage';
import {supabase} from './client';

const mapTokens = (accessToken?: string, refreshToken?: string | null): AuthTokens => ({
  accessToken: accessToken ?? '',
  refreshToken: refreshToken ?? undefined,
});

const buildAuthResponse = (
  params: {
    message: string;
    userId?: string;
    email?: string;
    fullName?: string;
    tokens?: AuthTokens;
  },
): AuthResponse => ({
  message: params.message,
  user: {
    id: params.userId ?? 'pending-profile',
    email: params.email ?? '',
    fullName: params.fullName ?? '',
  },
  tokens: params.tokens ?? {accessToken: ''},
});

export const supabaseAuth = {
  async signIn(payload: LoginRequest): Promise<AuthResponse> {
    const {data, error} = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });

    if (error) {
      throw error;
    }

    return buildAuthResponse({
      message: 'Supabase sign-in successful.',
      userId: data.user?.id,
      email: data.user?.email,
      fullName: (data.user?.user_metadata?.full_name as string | undefined) ?? '',
      tokens: mapTokens(data.session?.access_token, data.session?.refresh_token),
    });
  },

  async signUp(payload: RegisterRequest): Promise<AuthResponse> {
    const {data, error} = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.fullName,
          birth_date: payload.birthDate,
          birth_time: payload.birthTime,
          city: payload.city,
          country: payload.country,
          intent: payload.intent,
        },
      },
    });

    if (error) {
      throw error;
    }

    return buildAuthResponse({
      message:
        data.session != null
          ? 'Supabase sign-up successful.'
          : 'Sign-up created. Email confirmation may be required.',
      userId: data.user?.id,
      email: data.user?.email,
      fullName: (data.user?.user_metadata?.full_name as string | undefined) ?? payload.fullName,
      tokens: mapTokens(data.session?.access_token, data.session?.refresh_token),
    });
  },

  async forgotPassword(payload: ForgotPasswordRequest): Promise<{message: string}> {
    const {error} = await supabase.auth.resetPasswordForEmail(payload.email);

    if (error) {
      throw error;
    }

    return {message: 'Password reset email sent.'};
  },

  async logout(): Promise<{success: boolean}> {
    const {error} = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    return {success: true};
  },
};
