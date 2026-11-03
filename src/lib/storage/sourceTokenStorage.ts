import {mainStorage} from './StorageService';

const TOKEN_PREFIX = 'source_token_';

export const sourceTokenStorage = {
  async getToken(author: string): Promise<string | null> {
    if (!author) return null;
    const val = mainStorage.getString(`${TOKEN_PREFIX}${author.toLowerCase()}`);
    return val || null;
  },

  async setToken(author: string, token: string): Promise<void> {
    if (!author) return;
    mainStorage.setString(`${TOKEN_PREFIX}${author.toLowerCase()}`, token.trim());
  },

  async deleteToken(author: string): Promise<void> {
    if (!author) return;
    mainStorage.delete(`${TOKEN_PREFIX}${author.toLowerCase()}`);
  },
};
