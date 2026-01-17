import apiClient from './client';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
  permissions: string[];
}

export interface AuthResponse {
  user: User;
  token: string;
}

export const authApi = {
  login: async (credentials: { email: string; password: string; tenant_id?: number }) => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  logout: async () => {
    await apiClient.post('/auth/logout');
  },

  getProfile: async () => {
    const response = await apiClient.get<User>('/user');
    return response.data;
  },
};
