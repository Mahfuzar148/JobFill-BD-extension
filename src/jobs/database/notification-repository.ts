// JobFill BD - Job Notification Repository (IndexedDB + Fallback)

import { STORES } from '../../database/indexeddb';
import { JobNotificationRecord } from '../types/job.types';
import { SharedStoreCrud } from './job-repository';

const notifCrud = new SharedStoreCrud<JobNotificationRecord>(STORES.NOTIFICATIONS, 'id');

export class JobNotificationRepository {
  public static async getAll(): Promise<JobNotificationRecord[]> {
    const list = await notifCrud.getAll();
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  public static async add(notification: JobNotificationRecord): Promise<void> {
    await notifCrud.put(notification);
  }

  public static async getUnreadCount(): Promise<number> {
    const all = await this.getAll();
    return all.filter((n) => !n.isRead).length;
  }

  public static async markAsRead(id: string): Promise<void> {
    const found = await notifCrud.getByKey(id);
    if (found) {
      await notifCrud.put({ ...found, isRead: true });
    }
  }

  public static async markAllAsRead(): Promise<void> {
    const all = await this.getAll();
    const unread = all.filter((n) => !n.isRead).map((n) => ({ ...n, isRead: true }));
    await notifCrud.putMany(unread);
  }

  public static async clearRead(): Promise<void> {
    const all = await this.getAll();
    for (const item of all) {
      if (item.isRead) {
        await notifCrud.remove(item.id);
      }
    }
  }

  public static async deleteById(id: string): Promise<void> {
    await notifCrud.remove(id);
  }

  public static async clearAll(): Promise<void> {
    await notifCrud.clear();
  }
}
