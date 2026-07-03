import type { UserProfile } from './user-profile';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthResponse {
  user: UserProfile;
  tokens: AuthTokens;
}
