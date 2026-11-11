// JobFill BD - Saved Field Mappings Page
// Implements Part 16 of UI/UX Master Specification:
// Searchable management interface for Adaptive Mapping Memory.
// Allows users to view, inspect, and delete remembered site mappings.

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Database, Trash2, Search, ExternalLink, ShieldCheck, Download, Upload } from 'lucide-react';
import { MappingRepository } from '../../database/mapping-repository';
import { LearnedMappingRecord } from '../../intelligence/mapping-memory';

export const SavedMappingsPage: React.FC = () => {
  const { language, showToast } = useApp();
  const [mappings, setMappings] = useState<LearnedMappingRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const loadMappings = async () => {
    setIsLoading(true);
    const map = await MappingRepository.load();
    setMappings(Array.from(map.values()));
    setIsLoading(false);
  };

  useEffect(() => {
    loadMappings();
  }, []);

  const handleDeleteOne = async (fingerprintHash: string) => {
    const ok = await MappingRepository.deleteMapping(fingerprintHash);
    if (ok) {
      await loadMappings();
      showToast(language === 'bn' ? '🗑️ ম্যাপিং রুলটি মুছে ফেলা হয়েছে।' : '🗑️ Mapping rule deleted.');
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(mappings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobfill-mappings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Expected JSON array of mapping rules');
      const count = await MappingRepository.importMappings(parsed);
      await loadMappings();
      showToast(language === 'bn' ? `✅ ${count}টি ম্যাপিং রুল ইম্পোর্ট হয়েছে` : `✅ Imported ${count} mapping rules`);
    } catch (err: any) {
      showToast(`⚠️ Import error: ${err?.message || 'Invalid JSON'}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleClearAll = async () => {
    if (window.confirm(language === 'bn' ? 'আপনি কি নিশ্চিত যে সমস্ত সংরক্ষিত ম্যাপিং মুছে ফেলতে চান?' : 'Are you sure you want to clear all learned mappings?')) {
      await MappingRepository.clear();
      await loadMappings();
      showToast(language === 'bn' ? '🗑️ সমস্ত ম্যাপিং মুছে ফেলা হয়েছে।' : '🗑️ All learned mappings cleared.');
    }
  };

  const filtered = mappings.filter((m) =>
    m.domain.toLowerCase().includes(search.toLowerCase()) ||
    m.canonicalKey.toLowerCase().includes(search.toLowerCase()) ||
    m.fingerprintHash.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Database className="text-emerald-600" size={24} />
            {language === 'bn' ? 'সংরক্ষিত ফিল্ড ম্যাপিং (Saved Mappings)' : 'Saved Field Mappings'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'অ্যাডাপ্টিভ মেমরিতে সংরক্ষিত বিভিন্ন ওয়েবসাইটের অনুমোদিত ম্যাপিং তালিকা।'
              : 'Knowledge base of user-confirmed field mappings across recruitment portals.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportJson}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
          >
            <Upload size={13} />
            {language === 'bn' ? 'ইম্পোর্ট JSON' : 'Import JSON'}
          </button>
          {mappings.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
              >
                <Download size={13} />
                {language === 'bn' ? 'এক্সপোর্ট JSON' : 'Export JSON'}
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 size={13} />
                {language === 'bn' ? 'সব মুছুন (Clear All)' : 'Clear All Mappings'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Zero Personal Data Guarantee Note */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2.5">
        <ShieldCheck className="text-emerald-600 shrink-0" size={18} />
        <span>
          <strong>{language === 'bn' ? 'প্রাইভেসি নিশ্চয়তা:' : 'Privacy Guarantee:'}</strong>{' '}
          {language === 'bn'
            ? 'ম্যাপিং মেমরিতে কোনো ব্যক্তিগত তথ্য (নাম, ফোন, রোল) সেভ হয় না; কেবল ফিল্ডের স্ট্রাকচারাল রুল সংরক্ষিত থাকে।'
            : 'Mapping memory only stores structural domain fingerprints. Zero personal data is ever recorded here.'}
        </span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={language === 'bn' ? 'ডোমেইন বা ফিল্ড নাম দিয়ে খুঁজুন...' : 'Search by domain or canonical key...'}
          className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500"
        />
      </div>

      {/* Mappings Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4 text-xs text-slate-400">
            <Database size={32} className="mx-auto mb-2 opacity-40" />
            {language === 'bn'
              ? 'এখনো কোনো কাস্টম ফিল্ড ম্যাপিং সংরক্ষিত নেই।'
              : 'No learned field mappings recorded yet. They will appear here when you confirm mappings on job portals.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Domain / Portal</th>
                  <th className="py-3 px-4">Canonical Mapping Key</th>
                  <th className="py-3 px-4">Confirmations</th>
                  <th className="py-3 px-4">Accuracy Score</th>
                  <th className="py-3 px-4">Last Confirmed</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((m) => (
                  <tr key={m.fingerprintHash} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <ExternalLink size={12} className="text-slate-400" />
                      {m.domain}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-emerald-800 dark:text-emerald-400 font-semibold">
                      {m.canonicalKey}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {m.confirmationCount} time(s)
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {m.accuracyScore}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(m.lastConfirmedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteOne(m.fingerprintHash)}
                        title={language === 'bn' ? 'মুছুন' : 'Delete mapping'}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
