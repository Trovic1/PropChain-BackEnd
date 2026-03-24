// User entity type definitions
// These are local type definitions that match the Prisma schema

export type UserRole = 'USER' | 'ADMIN' | 'AGENT';

export interface User {
  id: string;
  email: string;
  password: string | null;

  walletAddress: string | null;
  role: UserRole;
  roleId: string | null;
  password: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  preferences: Record<string, unknown> | null;
  privacySettings: Record<string, unknown> | null;
}
 * Flexible enough for email/password and Web3 users
 */
export type CreateUserInput = {
  email: string;
  password?: string;
  walletAddress?: string;
  role?: UserRole;
  roleId?: string;
};

export type PrismaUser = User;
