// JobFill BD - Encrypted Backup & Data Portability Manager
// Delegates cleanly to canonical storage backup routines so Vault Encryption is never bypassed.

import { exportProfileData, importProfileData } from '../services/storage';
import { UserProfile } from '../types/profile';

export interface BackupPayload {
  appName: 'JobFill BD';
  version: string;
  exportedAt: string;
  profiles: UserProfile[];
}

export class BackupManager {
  public static async exportBackup(encrypted = false, password?: string): Promise<string> {
    return exportProfileData(encrypted, password);
  }

  public static async importBackup(fileContent: string, password?: string): Promise<number> {
    return importProfileData(fileContent, password);
  }
}
