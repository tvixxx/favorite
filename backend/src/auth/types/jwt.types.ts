export interface JwtPayload {
  id: string;
  type?: 'access' | 'refresh';
  authVersion?: number;
}
