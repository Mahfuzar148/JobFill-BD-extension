// JobFill BD - Bookmark Button Component

import React from 'react';
import { Bookmark } from 'lucide-react';

interface BookmarkButtonProps {
  isBookmarked: boolean;
  onToggle: () => void;
  compact?: boolean;
  language?: 'bn' | 'en';
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  isBookmarked,
  onToggle,
  compact = false,
  language = 'en',
}) => {
  const bn = language === 'bn';
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isBookmarked ? (bn ? 'বুকমার্ক সরান' : 'Remove Bookmark') : (bn ? 'চাকরি সংরক্ষণ করুন' : 'Bookmark Job')}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold text-xs border transition-all cursor-pointer ${
        compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
      } ${
        isBookmarked
          ? 'bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
      }`}
    >
      <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
      {!compact && <span>{isBookmarked ? (bn ? 'সংরক্ষিত' : 'Bookmarked') : (bn ? 'সংরক্ষণ' : 'Bookmark')}</span>}
    </button>
  );
};
