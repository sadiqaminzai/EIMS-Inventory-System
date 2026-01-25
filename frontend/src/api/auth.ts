import apiClient from './client';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  tenant_id?: number;
  must_change_password?: boolean;
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
  updateProfile: async (data: { name: string; email: string; password?: string; password_confirmation?: string }) => {
    const response = await apiClient.put('/profile', data);
    return response.data;
  },
};
