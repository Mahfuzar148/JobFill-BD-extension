// JobFill BD - Bookmark Repository (IndexedDB + Fallback)

import { STORES } from '../../database/indexeddb';
import { BookmarkRecord } from '../types/job.types';
import { SharedStoreCrud } from './job-repository';

const bookmarkCrud = new SharedStoreCrud<BookmarkRecord>(STORES.BOOKMARKS, 'jobId');

export class BookmarkRepository {
  public static async getAll(): Promise<BookmarkRecord[]> {
    const list = await bookmarkCrud.getAll();
    return list.sort((a, b) => b.savedAt - a.savedAt);
  }

  public static async getBookmarkedJobIds(): Promise<Set<string>> {
    const list = await bookmarkCrud.getAll();
    return new Set(list.map((b) => b.jobId));
  }

  public static async isBookmarked(jobId: string): Promise<boolean> {
    const item = await bookmarkCrud.getByKey(jobId);
    return item !== null;
  }

  public static async addBookmark(jobId: string, note?: string): Promise<BookmarkRecord> {
    const rec: BookmarkRecord = {
      jobId,
      savedAt: Date.now(),
      note,
    };
    await bookmarkCrud.put(rec);
    return rec;
  }

  public static async removeBookmark(jobId: string): Promise<void> {
    await bookmarkCrud.remove(jobId);
  }

  public static async toggleBookmark(jobId: string): Promise<boolean> {
    const exists = await this.isBookmarked(jobId);
    if (exists) {
      await this.removeBookmark(jobId);
      return false;
    }
    await this.addBookmark(jobId);
    return true;
  }

  public static async clearAll(): Promise<void> {
    await bookmarkCrud.clear();
  }
}
