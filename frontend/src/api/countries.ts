import apiClient from './client';

export interface CountryDto {
  id: number;
  name: string;
  details?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export const countryApi = {
  list: async () => (await apiClient.get<CountryDto[]>('/countries')).data,
  create: async (data: Partial<CountryDto>) => (await apiClient.post<CountryDto>('/countries', data)).data,
  update: async (id: string, data: Partial<CountryDto>) => (await apiClient.put<CountryDto>(`/countries/${id}`, data)).data,
  remove: async (id: string) => { await apiClient.delete(`/countries/${id}`); },
};
