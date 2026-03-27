export type DonationStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export interface Donation {
  id: string;
  provider: string;
  providerTransactionId: string;
  amount: number;
  currency: string;
  donorName?: string | null;
  donorEmail?: string | null;
  blockchainHash?: string | null;
  status: DonationStatus;
  userId?: string | null;
  projectId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: any;
  project?: any;
}
