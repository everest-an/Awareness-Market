import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { AppRouter } from '../../../server/routers';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with your actual API URL
const API_URL = process.env.API_URL || 'https://3000-i36m3c90bb24kkg32sxe6-2e91daaf.manus-asia.computer/api/trpc';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: API_URL,
      async headers() {
        // Get auth token from AsyncStorage
        const token = await AsyncStorage.getItem('auth_token');
        return {
          authorization: token ? `Bearer ${token}` : '',
        };
      },
    }),
  ],
});

// Auth helpers
export const authService = {
  async saveToken(token: string) {
    await AsyncStorage.setItem('auth_token', token);
  },
  
  async getToken() {
    return await AsyncStorage.getItem('auth_token');
  },
  
  async removeToken() {
    await AsyncStorage.removeItem('auth_token');
  },
  
  async isAuthenticated() {
    const token = await this.getToken();
    return !!token;
  },
};
