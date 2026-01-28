import apiClient from './client';

export interface BackupDto {
  id: number;
  tenant_id: number;
  filename: string;
  path: string;
  size: number;
  type: 'manual' | 'automatic';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error_message?: string | null;
  tables_included?: string[] | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  creator?: {
    id: number;
    name: string;
  } | null;
  formatted_size?: string;
}

export interface BackupSettingsDto {
  id: number;
  tenant_id: number;
  auto_backup_enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  backup_time: string;
  day_of_week?: number | null;
  day_of_month?: number | null;
  retention_days: number;
  max_backups: number;
  last_backup_at?: string | null;
  next_backup_at?: string | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedBackups {
  data: BackupDto[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface BackupSettingsUpdateDto {
  auto_backup_enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  backup_time: string;
  day_of_week?: number | null;
  day_of_month?: number | null;
  retention_days: number;
  max_backups: number;
}

export const backupApi = {
  // Get list of backups
  getBackups: async (page = 1): Promise<PaginatedBackups> => {
    const response = await apiClient.get<PaginatedBackups>('/settings/backups', {
      params: { page },
    });
    return response.data;
  },

  // Create a new manual backup
  createBackup: async (): Promise<BackupDto> => {
    const response = await apiClient.post<BackupDto>('/settings/backups');
    return response.data;
  },

  // Download a backup file
  downloadBackup: async (backupId: number): Promise<Blob> => {
    const response = await apiClient.get(`/settings/backups/${backupId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Delete a backup
  deleteBackup: async (backupId: number): Promise<void> => {
    await apiClient.delete(`/settings/backups/${backupId}`);
  },

  // Restore from a backup
  restoreBackup: async (backupId: number): Promise<{ message: string; backup: BackupDto }> => {
    const response = await apiClient.post(`/settings/backups/${backupId}/restore`);
    return response.data;
  },

  // Get backup settings
  getSettings: async (): Promise<BackupSettingsDto> => {
    const response = await apiClient.get<BackupSettingsDto>('/settings/backup-settings');
    return response.data;
  },

  // Update backup settings
  updateSettings: async (data: BackupSettingsUpdateDto): Promise<BackupSettingsDto> => {
    const response = await apiClient.put<BackupSettingsDto>('/settings/backup-settings', data);
    return response.data;
  },
};
