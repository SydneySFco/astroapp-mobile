import type {AuthTokens} from '../../services/auth/tokenStorage';

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
  birthDate: string;
  birthTime?: string;
  city: string;
  country: string;
  intent: string;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
};

export type AuthResponse = {
  message: string;
  user: UserProfile;
  tokens: AuthTokens;
};
