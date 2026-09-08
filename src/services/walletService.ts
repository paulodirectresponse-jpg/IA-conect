import { apiRequest } from './apiClient.js';
import { WalletAccount, WalletTransaction } from '../types/index.js';

export const walletService = {
  async getSummary(): Promise<WalletAccount> {
    return apiRequest<WalletAccount>('/api/wallet/summary');
  },

  async listTransactions(limit = 20, offset = 0): Promise<{ transactions: WalletTransaction[]; total: number }> {
    return apiRequest<{ transactions: WalletTransaction[]; total: number }>(
      `/api/wallet/transactions?limit=${limit}&offset=${offset}`
    );
  },
};
