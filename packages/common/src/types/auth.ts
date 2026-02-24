export type UserRole = 'admin' | 'viewer';

export interface JwtPayload {
  id: number;
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
