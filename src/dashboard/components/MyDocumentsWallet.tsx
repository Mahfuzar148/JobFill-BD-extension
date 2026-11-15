// JobFill BD - Dashboard Visual Document Wallet & Identity Gallery ("My Documents")
// Displays real uploaded Profile Photograph, NID Front/Back, Academic Certificates, and Supporting Documents.
// Built with strict local encryption (AES-256-GCM), locked NID previews, lazy metadata-first loading,
// and zero cloud or remote leaks.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Image as ImageIcon,
  CreditCard,
  Award,
  BookOpen,
  GraduationCap,
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  FolderOpen,
  FileCheck,
} from 'lucide-react';
import { UserProfile, DocumentMetadata, DocumentCategory, DocumentItem } from '../../types/profile';
import {
  getDocumentMetadataByProfile,
  getDocumentById,
  saveDocument,
  deleteDocument,
  inspectDocumentFile,
  StoredDocument,
} from '../../services/indexedDB';
import { DocumentRepository } from '../../database/document-repository';
import { VaultManager } from '../../security/vault-manager';

export interface MyDocumentsWalletProps {
  profile: UserProfile;
  language?: 'bn' | 'en';
  onNavigateTab: (tab: any) => void;
  onChangeProfile?: (p: UserProfile) => void;
  showToast?: (msg: string) => void;
}

export function maskNidNumber(nid?: string): string {
  if (!nid || !nid.trim()) return '';
  const clean = nid.replace(/[\s-]/g, '');
  if (clean.length <= 4) return '••••';
  return '•••• •••• ' + clean.slice(-4);
}

export const MyDocumentsWallet: React.FC<MyDocumentsWalletProps> = ({
  profile,
  language = 'bn',
  onNavigateTab,
  onChangeProfile,
  showToast,
}) => {
  const isBn = language === 'bn';

  // Metadata items loaded lazily for this profile
  const [docMetas, setDocMetas] = useState<DocumentMetadata[]>([]);
  const [isLoadingMetas, setIsLoadingMetas] = useState(true);

  // Decrypted Profile Photo for safe thumbnail
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<DocumentMetadata | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);

  // Signature Metadata and Thumbnail
  const [sigMeta, setSigMeta] = useState<DocumentMetadata | null>(null);
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);

  // Active Preview State
  const [previewDoc, setPreviewDoc] = useState<{
    meta: DocumentMetadata;
    dataUrl: string;
    blobUrl?: string;
  } | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotation, setPreviewRotation] = useState(0);

  // NID Unlock / Authentication State
  const [authModalDocId, setAuthModalDocId] = useState<string | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isVaultProtected, setIsVaultProtected] = useState(false);
  const [revealedNidDocIds, setRevealedNidDocIds] = useState<Set<string>>(new Set());

  // Delete Confirmation State
  const [docToDelete, setDocToDelete] = useState<DocumentMetadata | null>(null);

  // File upload input ref and target slot
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTargetCategory, setUploadTargetCategory] = useState<DocumentCategory | null>(null);
  const [uploadTargetTitle, setUploadTargetTitle] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // 1. Load document metadata strictly scoped to active profile
  const loadProfileDocuments = useCallback(async () => {
    setIsLoadingMetas(true);
    try {
      const metas = await getDocumentMetadataByProfile(profile.id);
      setDocMetas(metas);

      // Check security settings for NID authentication
      const secSettings = await VaultManager.getSettings();
      setIsVaultProtected(Boolean(secSettings.isPasswordProtected));

      // Load Profile Photo thumbnail lazily
      const photoOriginal = metas.find((m) => m.documentType === 'photo' && !m.isProcessedVariant);
      const photoProcessed = metas.find((m) => m.documentType === 'photo' && m.isProcessedVariant);
      const activePhotoMeta = photoProcessed || photoOriginal || metas.find((m) => m.documentType === 'photo');

      if (activePhotoMeta) {
        setPhotoMeta(activePhotoMeta);
        setIsLoadingPhoto(true);
        try {
          const decryptedPhoto = await getDocumentById(activePhotoMeta.documentId);
          setPhotoDataUrl(decryptedPhoto?.dataUrl || null);
        } catch {
          setPhotoDataUrl(null);
        } finally {
          setIsLoadingPhoto(false);
        }
      } else {
        setPhotoMeta(null);
        setPhotoDataUrl(null);
      }

      // Load Signature metadata and thumbnail
      const sigRecord = metas.find((m) => m.documentType === 'signature');
      if (sigRecord) {
        setSigMeta(sigRecord);
        try {
          const decryptedSig = await getDocumentById(sigRecord.documentId);
          setSigDataUrl(decryptedSig?.dataUrl || null);
        } catch {
          setSigDataUrl(null);
        }
      } else {
        setSigMeta(null);
        setSigDataUrl(null);
      }
    } catch (err: any) {
      console.warn('Failed to load profile documents:', err?.message);
    } finally {
      setIsLoadingMetas(false);
    }
  }, [profile.id]);

  useEffect(() => {
    // Reset view-specific state when switching profile to avoid any data cross-contamination
    setRevealedNidDocIds(new Set());
    setPreviewDoc(null);
    setPhotoDataUrl(null);
    setSigDataUrl(null);
    loadProfileDocuments();
  }, [profile.id, loadProfileDocuments]);

  // Helper to find document in metadata list
  const findMatchingMeta = (
    category: DocumentCategory,
    keywords?: RegExp
  ): DocumentMetadata | undefined => {
    // Direct category match
    const direct = docMetas.find((m) => m.documentType === category);
    if (direct) return direct;

    // Keyword match across titles/fileNames if category is general
    if (keywords) {
      return docMetas.find(
        (m) =>
          keywords.test(m.title || '') ||
          keywords.test(m.fileName || '') ||
          keywords.test(m.documentType)
      );
    }
    return undefined;
  };

  // Specific Slot Matches
  const nidFrontMeta = findMatchingMeta('nid_front', /nid.*front|জাতীয়.*পরিচয়.*সম্মুখ/i);
  const nidBackMeta = findMatchingMeta('nid_back', /nid.*back|জাতীয়.*পরিচয়.*বিপরীত/i);
  const sscCertMeta = findMatchingMeta('ssc_cert', /ssc.*cert|দাখিল.*সনদ|মাধ্যমিক.*সনদ/i);
  const sscMarksheetMeta = findMatchingMeta('ssc_marksheet', /ssc.*marksheet|ssc.*transcript|মাধ্যমিক.*মার্কশিট/i);
  const hscCertMeta = findMatchingMeta('hsc_cert', /hsc.*cert|আলিম.*সনদ|উচ্চ.*মাধ্যমিক.*সনদ/i);
  const hscMarksheetMeta = findMatchingMeta('hsc_marksheet', /hsc.*marksheet|hsc.*transcript|উচ্চ.*মাধ্যমিক.*মার্কশিট/i);
  const gradCertMeta = findMatchingMeta('grad_cert', /grad|bachelor|degree|স্নাতক.*সনদ/i);
  const transcriptMeta = findMatchingMeta('transcript', /transcript|একাডেমিক.*ট্রান্সক্রিপ্ট/i);

  // Other documents counts
  const trainingCertsCount = docMetas.filter((m) => m.documentType === 'training_cert').length;
  const experienceDocsCount = docMetas.filter(
    (m) => m.documentType === 'other' && /experience|অভিজ্ঞতা|service/i.test(m.title || m.fileName)
  ).length;
  const cvCount = docMetas.filter((m) => m.documentType === 'cv').length;
  const otherDocsCount = docMetas.filter(
    (m) =>
      m.documentType !== 'photo' &&
      m.documentType !== 'signature' &&
      m.documentType !== 'nid_front' &&
      m.documentType !== 'nid_back' &&
      m.documentType !== 'ssc_cert' &&
      m.documentType !== 'ssc_marksheet' &&
      m.documentType !== 'hsc_cert' &&
      m.documentType !== 'hsc_marksheet' &&
      m.documentType !== 'grad_cert' &&
      m.documentType !== 'transcript'
  ).length;

  const totalUploadedSlotsCount = docMetas.filter((m) => !m.isProcessedVariant).length;

  // 2. Open File Chooser for a specific category
  const triggerUploadSlot = (category: DocumentCategory, title: string) => {
    setUploadTargetCategory(category);
    setUploadTargetTitle(title);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // 3. Handle File Selection and Safe Encrypted Storage
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetCategory) return;

    setIsUploading(true);
    try {
      const inspected = await inspectDocumentFile(file);
      const isPhoto = uploadTargetCategory === 'photo';
      const isSig = uploadTargetCategory === 'signature';
      const docId = isPhoto
        ? `photo_${profile.id}_original`
        : isSig
          ? `sig_${profile.id}_original`
          : `doc_${profile.id}_${uploadTargetCategory}_${Date.now()}`;

      const newRecord: StoredDocument = {
        id: docId,
        documentId: docId,
        profileId: profile.id,
        type: uploadTargetCategory,
        documentType: uploadTargetCategory,
        title: uploadTargetTitle || file.name,
        fileName: file.name,
        fileSize: inspected.fileSize,
        fileSizeKb: inspected.sizeKb,
        mimeType: inspected.mimeType,
        width: inspected.width,
        height: inspected.height,
        isProcessedVariant: false,
        dataUrl: inspected.dataUrl,
        createdAt: new Date().toISOString(),
      };

      // Save to encrypted repository
      await saveDocument(newRecord);

      // Sync metadata with profile.documents
      if (onChangeProfile) {
        const existingDocs = profile.documents || [];
        const filtered = existingDocs.filter((d) => d.id !== docId && d.type !== uploadTargetCategory);
        const newDocItem: DocumentItem = {
          id: docId,
          type: uploadTargetCategory,
          title: newRecord.title,
          fileName: newRecord.fileName,
          fileSizeKb: newRecord.fileSizeKb,
          fileSize: newRecord.fileSize,
          mimeType: newRecord.mimeType,
          dimensions: inspected.width ? { width: inspected.width, height: inspected.height } : undefined,
          uploadedAt: newRecord.createdAt,
          isProcessedVariant: false,
        };
        onChangeProfile({
          ...profile,
          documents: [...filtered, newDocItem],
        });
      }

      await loadProfileDocuments();
      if (showToast) {
        showToast(
          isBn
            ? `✅ ${uploadTargetTitle || 'ডকুমেন্ট'} সফলভাবে এনক্রিপ্টেড ভল্টে সংরক্ষিত হয়েছে!`
            : `✅ ${uploadTargetTitle || 'Document'} saved securely to encrypted vault!`
        );
      }
    } catch (err: any) {
      alert((isBn ? 'ডকুমেন্ট আপলোড ব্যর্থ হয়েছে: ' : 'Failed to upload document: ') + (err?.message || err));
    } finally {
      setIsUploading(false);
      setUploadTargetCategory(null);
      setUploadTargetTitle('');
    }
  };

  // 4. Authorized Document Preview Execution
  const openSecurePreview = async (meta: DocumentMetadata) => {
    try {
      const fullDoc = await getDocumentById(meta.documentId);
      if (!fullDoc || !fullDoc.dataUrl) {
        alert(
          isBn
            ? 'ডকুমেন্ট ফাইলটি পাওয়া যায়নি। অনুগ্রহ করে পুনরায় আপলোড করুন।'
            : 'Document file unavailable. Please restore or upload again.'
        );
        return;
      }

      setPreviewZoom(1);
      setPreviewRotation(0);
      setPreviewDoc({
        meta,
        dataUrl: fullDoc.dataUrl,
      });
    } catch (err: any) {
      alert((isBn ? 'প্রিভিউ লোড করতে সমস্যা হয়েছে: ' : 'Failed to load preview: ') + (err?.message || err));
    }
  };

  // 5. NID Authorization & Unlock Flow
  const handleNidClick = (meta?: DocumentMetadata) => {
    if (!meta) return;
    if (isVaultProtected && VaultManager.isLocked()) {
      setAuthModalDocId(meta.documentId);
      setAuthPassword('');
      setAuthError('');
    } else {
      // Prompt quick screen privacy confirmation if not password protected
      setAuthModalDocId(meta.documentId);
      setAuthPassword('');
      setAuthError('');
    }
  };

  const handleConfirmNidUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authModalDocId) return;

    if (isVaultProtected && VaultManager.isLocked()) {
      const ok = await VaultManager.unlock(authPassword);
      if (!ok) {
        setAuthError(
          isBn
            ? 'ভুল ভল্ট পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিয়ে চেষ্টা করুন।'
            : 'Incorrect vault password! Please try again.'
        );
        return;
      }
    }

    const docId = authModalDocId;
    setRevealedNidDocIds((prev) => new Set(prev).add(docId));
    setAuthModalDocId(null);

    const targetMeta = docMetas.find((m) => m.documentId === docId);
    if (targetMeta) {
      await openSecurePreview(targetMeta);
    }
  };

  // 6. Close Preview and Clean Up Sensitive Object URLs & State
  const closePreviewModal = () => {
    if (previewDoc?.blobUrl) {
      URL.revokeObjectURL(previewDoc.blobUrl);
    }
    setPreviewDoc(null);
    setPreviewZoom(1);
    setPreviewRotation(0);
    // Relock revealed NID representation upon closing preview
    setRevealedNidDocIds(new Set());
  };

  // 7. Handle Safe Deletion with Confirmation
  const confirmDeleteDocument = async () => {
    if (!docToDelete) return;
    try {
      await deleteDocument(docToDelete.documentId);

      if (onChangeProfile) {
        const filtered = (profile.documents || []).filter((d) => d.id !== docToDelete.documentId);
        onChangeProfile({
          ...profile,
          documents: filtered,
        });
      }

      await loadProfileDocuments();
      if (showToast) {
        showToast(
          isBn
            ? `🗑️ ${docToDelete.title || 'ডকুমেন্ট'} মুছে ফেলা হয়েছে`
            : `🗑️ ${docToDelete.title || 'Document'} deleted`
        );
      }
    } catch (err: any) {
      alert((isBn ? 'ডকুমেন্ট মুছতে সমস্যা হয়েছে: ' : 'Failed to delete document: ') + (err?.message || err));
    } finally {
      setDocToDelete(null);
    }
  };

  // 8. Download Document DataUrl Safely
  const downloadDocument = (dataUrl: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-6 transition-colors">
      {/* Hidden File Input for Direct Uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
        accept={
          uploadTargetCategory === 'photo' || uploadTargetCategory === 'signature'
            ? 'image/jpeg,image/png,image/jpg'
            : 'image/jpeg,image/png,image/jpg,application/pdf'
        }
      />

      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📁</span>
            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">
              {isBn ? 'আমার ডকুমেন্টস ও সার্টিফিকেট' : 'My Documents & Identity Wallet'}
            </h3>
            <span className="bg-petro-50 dark:bg-petro-950/80 text-petro-700 dark:text-petro-300 border border-petro-200 dark:border-petro-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              {totalUploadedSlotsCount} {isBn ? 'টি সংরক্ষিত' : 'Uploaded'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isBn
              ? 'আপনার প্রোফাইল ছবি, জাতীয় পরিচয়পত্র ও শিক্ষাগত সনদসমূহ এক নিরাপদ অফলাইন ভল্টে।'
              : 'Your profile, identity and academic documents in one secure local place.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Local AES-256</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('documents')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-petro-600 hover:bg-petro-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{isBn ? 'সব ডকুমেন্ট দেখুন' : 'View All Documents'}</span>
          </button>
        </div>
      </div>

      {/* TOP GRID: Area A (Profile Photo) + Area B (Identity Documents) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* AREA A: PROFILE PHOTOGRAPH (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-petro-600" />
                {isBn ? 'প্রোফাইল ছবি' : 'Profile Photograph'}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  photoMeta
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {photoMeta ? (isBn ? 'আপলোড সম্পন্ন' : 'Uploaded') : isBn ? 'অনুপস্থিত' : 'Missing'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Photo Thumbnail */}
              <div className="w-24 h-24 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex items-center justify-center shrink-0 shadow-xs relative">
                {isLoadingPhoto ? (
                  <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
                ) : photoDataUrl ? (
                  <img
                    src={photoDataUrl}
                    alt={photoMeta?.title || 'Applicant Photograph'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-2 text-slate-400">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
                    <span className="text-[9px] block leading-tight">{isBn ? 'ছবি নেই' : 'No Photo'}</span>
                  </div>
                )}
              </div>

              {/* Photo Details */}
              <div className="text-xs space-y-1 min-w-0">
                <div className="font-bold text-slate-800 dark:text-white truncate">
                  {profile.personal.applicantNameEn || (isBn ? 'আবেদনকারী' : 'Applicant')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {photoMeta ? (
                    <>
                      <span>{photoMeta.fileSize ? Math.round(photoMeta.fileSize / 1024) : 0} KB</span>
                      {photoMeta.width ? <span> • {photoMeta.width}×{photoMeta.height}px</span> : ''}
                    </>
                  ) : (
                    <span>{isBn ? '৩০০×৩০০ পিক্সেল (সর্বোচ্চ ১০০ KB)' : '300×300 px (Max 100 KB)'}</span>
                  )}
                </div>
                <div className="text-[10px] text-petro-600 dark:text-petro-400 font-semibold">
                  {photoMeta?.isProcessedVariant
                    ? (isBn ? '✓ ক্রপ করা স্ট্যান্ডার্ড কপি' : '✓ 300×300 Standard Variant')
                    : photoMeta
                      ? (isBn ? 'মূল আপলোডকৃত ছবি' : 'Original Photograph')
                      : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Photo Actions */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
            {photoMeta ? (
              <>
                <button
                  type="button"
                  onClick={() => triggerUploadSlot('photo', 'Applicant Photograph')}
                  className="flex-1 py-1.5 px-2 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-semibold shadow-2xs transition cursor-pointer text-center"
                >
                  {isBn ? 'ছবি পরিবর্তন' : 'Change Photo'}
                </button>
                <button
                  type="button"
                  onClick={() => openSecurePreview(photoMeta)}
                  className="p-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer shadow-2xs"
                  title={isBn ? 'বড় করে দেখুন' : 'Preview'}
                >
                  <Eye className="w-4 h-4 text-petro-600" />
                </button>
                <button
                  type="button"
                  onClick={() => setDocToDelete(photoMeta)}
                  className="p-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 dark:border-rose-800 cursor-pointer shadow-2xs"
                  title={isBn ? 'ছবি মুছুন' : 'Remove Photo'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => triggerUploadSlot('photo', 'Applicant Photograph')}
                className="w-full py-2 px-3 bg-petro-600 hover:bg-petro-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isBn ? 'প্রোফাইল ছবি আপলোড করুন' : 'Upload Profile Photo'}</span>
              </button>
            )}
          </div>
        </div>

        {/* AREA B: IDENTITY DOCUMENTS (NID Front & Back - 8 Cols) */}
        <div className="lg:col-span-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sky-600" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  {isBn ? 'জাতীয় পরিচয়পত্র (NID Documents)' : 'Identity Documents (Local-Only)'}
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isBn
                  ? 'গোপনীয়তার স্বার্থে NID প্রিভিউ লক করা থাকে। দেখার জন্য আনলক করুন।'
                  : 'NID cards remain locked to protect sensitive identity data. Unlock to preview.'}
              </p>
            </div>
            {profile.personal.nid ? (
              <div className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-mono text-slate-700 dark:text-slate-300">
                <Shield className="w-3 h-3 text-sky-600" />
                <span>NID: {maskNidNumber(profile.personal.nid)}</span>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Card B1: NID Front */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between shadow-2xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-white">
                    {isBn ? 'জাতীয় পরিচয়পত্র সম্মুখভাগ' : 'NID Front Part'}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      nidFrontMeta
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {nidFrontMeta ? (isBn ? 'আপলোড সম্পন্ন' : 'Uploaded') : isBn ? 'অনুপস্থিত' : 'Missing'}
                  </span>
                </div>

                {nidFrontMeta ? (
                  <div className="h-28 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center p-3 text-center relative overflow-hidden">
                    <Lock className="w-6 h-6 text-sky-600 mb-1" />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {isBn ? 'লকড প্রিভিউ' : 'Locked Preview'}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {nidFrontMeta.fileName} ({Math.round(nidFrontMeta.fileSize / 1024)} KB)
                    </span>
                  </div>
                ) : (
                  <div className="h-28 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-3 text-center text-slate-400">
                    <CreditCard className="w-6 h-6 mb-1 opacity-40" />
                    <span className="text-[11px]">{isBn ? 'কোনো ফাইল নেই' : 'No document uploaded'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                {nidFrontMeta ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleNidClick(nidFrontMeta)}
                      className="flex-1 py-1 px-2.5 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>{isBn ? 'আনলক ও প্রিভিউ' : 'Unlock & View'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerUploadSlot('nid_front', 'NID Front Part')}
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer text-xs"
                      title={isBn ? 'প্রতিস্থাপন করুন' : 'Replace'}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocToDelete(nidFrontMeta)}
                      className="p-1.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 rounded-lg hover:bg-rose-100 cursor-pointer text-xs"
                      title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => triggerUploadSlot('nid_front', 'NID Front Part')}
                    className="w-full py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-600" />
                    <span>{isBn ? 'সম্মুখভাগ আপলোড' : 'Upload Front'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Card B2: NID Back */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between shadow-2xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-white">
                    {isBn ? 'জাতীয় পরিচয়পত্র বিপরীতভাগ' : 'NID Back Part'}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      nidBackMeta
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {nidBackMeta ? (isBn ? 'আপলোড সম্পন্ন' : 'Uploaded') : isBn ? 'অনুপস্থিত' : 'Missing'}
                  </span>
                </div>

                {nidBackMeta ? (
                  <div className="h-28 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center p-3 text-center relative overflow-hidden">
                    <Lock className="w-6 h-6 text-sky-600 mb-1" />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {isBn ? 'লকড প্রিভিউ' : 'Locked Preview'}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {nidBackMeta.fileName} ({Math.round(nidBackMeta.fileSize / 1024)} KB)
                    </span>
                  </div>
                ) : (
                  <div className="h-28 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-3 text-center text-slate-400">
                    <CreditCard className="w-6 h-6 mb-1 opacity-40" />
                    <span className="text-[11px]">{isBn ? 'কোনো ফাইল নেই' : 'No document uploaded'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                {nidBackMeta ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleNidClick(nidBackMeta)}
                      className="flex-1 py-1 px-2.5 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>{isBn ? 'আনলক ও প্রিভিউ' : 'Unlock & View'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerUploadSlot('nid_back', 'NID Back Part')}
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer text-xs"
                      title={isBn ? 'প্রতিস্থাপন করুন' : 'Replace'}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocToDelete(nidBackMeta)}
                      className="p-1.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 rounded-lg hover:bg-rose-100 cursor-pointer text-xs"
                      title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => triggerUploadSlot('nid_back', 'NID Back Part')}
                    className="w-full py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-600" />
                    <span>{isBn ? 'বিপরীতভাগ আপলোড' : 'Upload Back'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AREA C: ACADEMIC CERTIFICATES & MARKSHEETS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-violet-600" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              {isBn ? 'শিক্ষাগত সনদ ও মার্কশিট (Academic Certificates)' : 'Academic Certificates & Marksheets'}
            </h4>
          </div>
          <span className="text-[11px] text-slate-500">
            {isBn ? 'সরকারি ও ব্যাংক চাকরির আবেদনে সরাসরি ব্যবহৃত' : 'Used for Govt & Bank Application Verification'}
          </span>
        </div>

        {/* 4 Primary Education Cards (SSC Cert, SSC Marksheet, HSC Cert, HSC Marksheet) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* C1. SSC Certificate */}
          <AcademicCertCard
            title={isBn ? 'এসএসসি সনদপত্র' : 'SSC Certificate'}
            level="Secondary (SSC/Dakhil)"
            boardOrInst={profile.ssc?.board || profile.ssc?.institution}
            passingYear={profile.ssc?.passingYear}
            docMeta={sscCertMeta}
            isBn={isBn}
            icon={<Award className="w-4 h-4 text-violet-600" />}
            onPreview={() => sscCertMeta && openSecurePreview(sscCertMeta)}
            onUpload={() => triggerUploadSlot('ssc_cert', 'SSC Certificate')}
            onDelete={() => sscCertMeta && setDocToDelete(sscCertMeta)}
          />

          {/* C2. SSC Marksheet */}
          <AcademicCertCard
            title={isBn ? 'এসএসসি মার্কশিট' : 'SSC Marksheet'}
            level="Secondary (SSC/Dakhil)"
            boardOrInst={profile.ssc?.board || (profile.ssc?.gpa ? `GPA ${profile.ssc.gpa}` : undefined)}
            passingYear={profile.ssc?.passingYear}
            docMeta={sscMarksheetMeta}
            isBn={isBn}
            icon={<BookOpen className="w-4 h-4 text-purple-600" />}
            onPreview={() => sscMarksheetMeta && openSecurePreview(sscMarksheetMeta)}
            onUpload={() => triggerUploadSlot('ssc_marksheet', 'SSC Marksheet')}
            onDelete={() => sscMarksheetMeta && setDocToDelete(sscMarksheetMeta)}
          />

          {/* C3. HSC Certificate */}
          <AcademicCertCard
            title={isBn ? 'এইচএসসি সনদপত্র' : 'HSC Certificate'}
            level="Higher Secondary (HSC/Alim)"
            boardOrInst={profile.hsc?.board || profile.hsc?.institution}
            passingYear={profile.hsc?.passingYear}
            docMeta={hscCertMeta}
            isBn={isBn}
            icon={<Award className="w-4 h-4 text-blue-600" />}
            onPreview={() => hscCertMeta && openSecurePreview(hscCertMeta)}
            onUpload={() => triggerUploadSlot('hsc_cert', 'HSC Certificate')}
            onDelete={() => hscCertMeta && setDocToDelete(hscCertMeta)}
          />

          {/* C4. HSC Marksheet */}
          <AcademicCertCard
            title={isBn ? 'এইচএসসি মার্কশিট' : 'HSC Marksheet'}
            level="Higher Secondary (HSC/Alim)"
            boardOrInst={profile.hsc?.board || (profile.hsc?.gpa ? `GPA ${profile.hsc.gpa}` : undefined)}
            passingYear={profile.hsc?.passingYear}
            docMeta={hscMarksheetMeta}
            isBn={isBn}
            icon={<BookOpen className="w-4 h-4 text-cyan-600" />}
            onPreview={() => hscMarksheetMeta && openSecurePreview(hscMarksheetMeta)}
            onUpload={() => triggerUploadSlot('hsc_marksheet', 'HSC Marksheet')}
            onDelete={() => hscMarksheetMeta && setDocToDelete(hscMarksheetMeta)}
          />
        </div>

        {/* Additional Higher Education Slots (Graduation & Transcript) if applicable */}
        {(profile.hasGraduation || gradCertMeta || transcriptMeta) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <AcademicCertCard
              title={isBn ? 'স্নাতক / ডিগ্রি সনদ' : 'Graduation Certificate'}
              level="Higher Education (Bachelor)"
              boardOrInst={profile.graduation?.universityInstitute || profile.graduation?.college}
              passingYear={profile.graduation?.passingYear}
              docMeta={gradCertMeta}
              isBn={isBn}
              icon={<GraduationCap className="w-4 h-4 text-emerald-600" />}
              onPreview={() => gradCertMeta && openSecurePreview(gradCertMeta)}
              onUpload={() => triggerUploadSlot('grad_cert', 'Graduation Certificate')}
              onDelete={() => gradCertMeta && setDocToDelete(gradCertMeta)}
            />

            <AcademicCertCard
              title={isBn ? 'একাডেমিক ট্রান্সক্রিপ্ট' : 'Academic Transcript'}
              level="Transcript / Marks"
              boardOrInst={profile.graduation?.universityInstitute}
              passingYear={profile.graduation?.passingYear}
              docMeta={transcriptMeta}
              isBn={isBn}
              icon={<BookOpen className="w-4 h-4 text-teal-600" />}
              onPreview={() => transcriptMeta && openSecurePreview(transcriptMeta)}
              onUpload={() => triggerUploadSlot('transcript', 'Academic Transcript')}
              onDelete={() => transcriptMeta && setDocToDelete(transcriptMeta)}
            />
          </div>
        )}
      </div>

      {/* AREA D: OTHER DOCUMENTS & SIGNATURE */}
      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            {isBn ? 'স্বাক্ষর ও অন্যান্য কাগজপত্র' : 'Signature & Supporting Documents'}
          </span>
          <span className="text-[11px] text-slate-500">
            {isBn ? 'কাজের অভিজ্ঞতা, ট্রেনিং ও সিভি' : 'Training, Experience & CV'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* D1. Signature Card */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  {isBn ? 'আবেদনকারীর স্বাক্ষর' : 'Signature'}
                </span>
                <span
                  className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded ${
                    sigMeta
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {sigMeta ? '300×80 px' : isBn ? 'অনুপস্থিত' : 'Missing'}
                </span>
              </div>
              <div className="h-12 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                {sigDataUrl ? (
                  <img src={sigDataUrl} alt="Signature" className="max-h-10 max-w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-slate-400 italic">
                    {isBn ? 'স্বাক্ষর আপলোড নেই' : 'No signature'}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => triggerUploadSlot('signature', 'Applicant Signature')}
                className="text-[11px] font-semibold text-petro-700 dark:text-petro-300 hover:underline cursor-pointer"
              >
                {sigMeta ? (isBn ? 'স্বাক্ষর পরিবর্তন' : 'Change') : isBn ? 'আপলোড করুন' : 'Upload'}
              </button>
              {sigMeta && (
                <button
                  type="button"
                  onClick={() => openSecurePreview(sigMeta)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="View"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* D2. CV / Resume */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  {isBn ? 'সিভি / জীবনবৃত্তান্ত' : 'CV / Resume'}
                </span>
                <span className="text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded">
                  {cvCount} {isBn ? 'টি' : 'Saved'}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500">
                {isBn ? 'পিডিএফ বা ডক ফরম্যাটে সিভি' : 'PDF/DOC format uploaded CV'}
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => triggerUploadSlot('cv', 'CV / Resume')}
                className="text-[11px] font-semibold text-petro-700 dark:text-petro-300 hover:underline cursor-pointer"
              >
                {isBn ? 'সিভি যোগ করুন' : '+ Upload CV'}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('cv_builder')}
                className="text-[10.5px] text-indigo-600 hover:underline cursor-pointer"
              >
                {isBn ? 'ATS বিল্ডার' : 'ATS Builder'}
              </button>
            </div>
          </div>

          {/* D3. Training & Certifications */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  {isBn ? 'ট্রেনিং ও পেশাগত সনদ' : 'Training Certs'}
                </span>
                <span className="text-[10px] bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold px-1.5 py-0.2 rounded">
                  {trainingCertsCount} {isBn ? 'টি' : 'Saved'}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500">
                {isBn ? 'আইটি, ভাষা বা প্রফেশনাল কোর্স' : 'Vocational & professional courses'}
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => triggerUploadSlot('training_cert', 'Training Certificate')}
                className="text-[11px] font-semibold text-petro-700 dark:text-petro-300 hover:underline cursor-pointer"
              >
                {isBn ? '+ সনদ যোগ করুন' : '+ Add Cert'}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('documents')}
                className="text-[10.5px] text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {isBn ? 'সব দেখুন' : 'View all'}
              </button>
            </div>
          </div>

          {/* D4. Other Supporting Docs */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  {isBn ? 'অন্যান্য সংযুক্তি' : 'Other Documents'}
                </span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.2 rounded">
                  {otherDocsCount} {isBn ? 'টি' : 'Files'}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500">
                {isBn ? 'অভিজ্ঞতা সনদ, ছাড়পত্র ইত্যাদি' : 'Experience letters, NOC & other files'}
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => triggerUploadSlot('other', 'Supporting Document')}
                className="text-[11px] font-semibold text-petro-700 dark:text-petro-300 hover:underline cursor-pointer"
              >
                {isBn ? '+ ফাইল যোগ' : '+ Add File'}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('documents')}
                className="text-[10.5px] text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {isBn ? 'ম্যানেজার' : 'Manager'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: SECURE DOCUMENT PREVIEW (Image / PDF with Zoom & Safe Cleanup) */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2.5 truncate">
                <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="truncate">
                  <div className="text-sm font-bold text-slate-800 dark:text-white truncate">
                    {previewDoc.meta.title || previewDoc.meta.fileName}
                  </div>
                  <div className="text-[10.5px] text-slate-500">
                    {previewDoc.meta.fileName} • {Math.round(previewDoc.meta.fileSize / 1024)} KB
                    {previewDoc.meta.width ? ` • ${previewDoc.meta.width}×${previewDoc.meta.height}px` : ''}
                  </div>
                </div>
              </div>

              {/* Toolbar Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {previewDoc.meta.mimeType?.startsWith('image/') && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.max(0.5, z - 0.25))}
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-mono px-1 text-slate-500">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.min(3, z + 0.25))}
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewRotation((r) => (r + 90) % 360)}
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100"
                      title="Rotate"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => downloadDocument(previewDoc.dataUrl, previewDoc.meta.fileName)}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={closePreviewModal}
                  className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-300"
                  title="Close and Lock"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Secure Image or PDF Viewer */}
            <div className="flex-1 p-4 overflow-auto bg-slate-100 dark:bg-slate-950 flex items-center justify-center min-h-[380px] max-h-[72vh]">
              {previewDoc.meta.mimeType === 'application/pdf' ||
              previewDoc.dataUrl.startsWith('data:application/pdf') ? (
                <div className="w-full h-[65vh] flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <object
                    data={previewDoc.dataUrl}
                    type="application/pdf"
                    className="w-full h-full rounded-lg"
                  >
                    <div className="text-center p-6 space-y-3">
                      <FileText className="w-12 h-12 text-rose-500 mx-auto" />
                      <div className="font-bold text-slate-800 dark:text-white">
                        {previewDoc.meta.fileName} (PDF)
                      </div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {isBn
                          ? 'ব্রাউজারে সরাসরি পিডিএফ প্রিভিউ সাপোর্ট না করলে নিচের বোতামটি দিয়ে ডাউনলোড করে দেখুন।'
                          : 'Direct PDF embed is not supported by your viewport. Download to view.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => downloadDocument(previewDoc.dataUrl, previewDoc.meta.fileName)}
                        className="px-4 py-2 bg-petro-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        {isBn ? 'পিডিএফ ডাউনলোড করুন' : 'Download PDF File'}
                      </button>
                    </div>
                  </object>
                </div>
              ) : (
                <div className="overflow-auto max-w-full max-h-full flex items-center justify-center">
                  <img
                    src={previewDoc.dataUrl}
                    alt={previewDoc.meta.title}
                    style={{
                      transform: `scale(${previewZoom}) rotate(${previewRotation}deg)`,
                      transition: 'transform 0.15s ease-out',
                    }}
                    className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-md select-none"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer with Explicit Lock Button */}
            <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                🔒 {isBn ? 'প্রিভিউ বন্ধ করলে মেমরি থেকে সাময়িক ক্যাশ মুছে যাবে' : 'Closing this preview clears cached memory'}
              </span>
              <button
                type="button"
                onClick={closePreviewModal}
                className="px-4 py-1.5 bg-petro-600 hover:bg-petro-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
              >
                {isBn ? 'বন্ধ করুন ও লক করুন' : 'Close & Lock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NID UNLOCK / AUTHENTICATION PROMPT */}
      {authModalDocId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmNidUnlock}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                {isBn ? 'জাতীয় পরিচয়পত্র আনলক করুন' : 'Unlock Sensitive Identity Document'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isVaultProtected
                  ? isBn
                    ? 'আপনার সংবেদনশীল NID দেখতে এনক্রিপ্টেড ভল্ট পাসওয়ার্ড দিন।'
                    : 'Enter your master vault password to reveal this NID document.'
                  : isBn
                    ? 'গোপনীয়তা রক্ষা: নিশ্চিত করুন আপনার স্ক্রিন অন্য কেউ দেখছে না।'
                    : 'Screen Privacy: Ensure your screen is private before revealing NID.'}
              </p>
            </div>

            {isVaultProtected && (
              <div className="space-y-1.5">
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder={isBn ? 'ভল্ট পাসওয়ার্ড লিখুন...' : 'Enter master vault password...'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-petro-500 outline-hidden"
                  autoFocus
                />
                {authError && (
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{authError}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAuthModalDocId(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="flex-1 py-2 px-3 rounded-xl bg-petro-600 hover:bg-petro-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {isBn ? 'অনুমোদন ও আনলক' : 'Authorize & Unlock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                {isBn ? 'ডকুমেন্টটি মুছে ফেলতে চান?' : 'Delete this document?'}
              </h4>
              <p className="text-xs text-slate-500">
                "{docToDelete.title || docToDelete.fileName}"{' '}
                {isBn
                  ? 'এনক্রিপ্টেড ডাটাবেজ থেকে স্থায়ীভাবে মুছে যাবে।'
                  : 'will be permanently removed from encrypted storage.'}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {isBn ? 'না, রাখুন' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmDeleteDocument}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                {isBn ? 'হ্যাঁ, মুছুন' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// ACADEMIC CERTIFICATE CARD SUB-COMPONENT
// ============================================================================
interface AcademicCertCardProps {
  title: string;
  level: string;
  boardOrInst?: string;
  passingYear?: string;
  docMeta?: DocumentMetadata;
  isBn: boolean;
  icon: React.ReactNode;
  onPreview: () => void;
  onUpload: () => void;
  onDelete: () => void;
}

const AcademicCertCard: React.FC<AcademicCertCardProps> = ({
  title,
  level,
  boardOrInst,
  passingYear,
  docMeta,
  isBn,
  icon,
  onPreview,
  onUpload,
  onDelete,
}) => {
  const isPdf = docMeta?.mimeType === 'application/pdf';

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 p-3.5 flex flex-col justify-between shadow-2xs hover:border-petro-300 transition-colors">
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-1.5 truncate">
            {icon}
            <span className="font-bold text-xs text-slate-800 dark:text-white truncate" title={title}>
              {title}
            </span>
          </div>
          <span
            className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
              docMeta
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
            }`}
          >
            {docMeta ? (isBn ? 'সংরক্ষিত' : 'Uploaded') : isBn ? 'অনুপস্থিত' : 'Missing'}
          </span>
        </div>

        {/* Level & Institution Info from Profile */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-slate-200/60 dark:border-slate-800 text-[10.5px] space-y-0.5">
          <div className="text-slate-400 dark:text-slate-500 font-semibold truncate">{level}</div>
          <div className="text-slate-700 dark:text-slate-300 font-medium truncate">
            {boardOrInst ? boardOrInst : isBn ? 'প্রতিষ্ঠান নির্ধারণ করা হয়নি' : 'Not specified'}
          </div>
          {passingYear && (
            <div className="text-[10px] text-slate-500">
              {isBn ? 'পাসের সাল:' : 'Year:'} <span className="font-bold text-slate-700 dark:text-slate-300">{passingYear}</span>
            </div>
          )}
        </div>

        {/* File Specifics if uploaded */}
        {docMeta ? (
          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 flex items-center justify-between px-1">
            <span className="truncate max-w-[120px] font-mono text-[10px]" title={docMeta.fileName}>
              {isPdf ? '📄 PDF' : '🖼️ IMG'} • {Math.round(docMeta.fileSize / 1024)} KB
            </span>
            <span className="text-[9.5px]">
              {new Date(docMeta.createdAt).toLocaleDateString(isBn ? 'bn-BD' : 'en-US')}
            </span>
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 italic px-1">
            {isBn ? 'এখনো কোনো ফাইল আপলোড করা হয়নি' : 'No document uploaded yet'}
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
        {docMeta ? (
          <>
            <button
              type="button"
              onClick={onPreview}
              className="flex-1 py-1 px-2 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-semibold shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-petro-600" />
              <span>{isBn ? 'প্রিভিউ' : 'Preview'}</span>
            </button>
            <button
              type="button"
              onClick={onUpload}
              className="p-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer"
              title={isBn ? 'নতুন ফাইল দিয়ে প্রতিস্থাপন করুন' : 'Replace file'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 dark:border-rose-800 cursor-pointer"
              title={isBn ? 'মুছে ফেলুন' : 'Delete'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onUpload}
            className="w-full py-1.5 px-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-petro-600" />
            <span>{isBn ? 'সনদ আপলোড করুন' : 'Upload File'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
