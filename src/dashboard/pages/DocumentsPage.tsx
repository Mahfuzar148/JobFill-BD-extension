import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Wand2,
  ShieldCheck,
  CreditCard,
  Award,
  FolderPlus,
  Scissors,
} from 'lucide-react';
import { ImageCropModal } from '../components/ImageCropModal';
import { ProcessedImageResult } from '../../services/image-processor';
import { UserProfile, DocumentCategory, DocumentItem } from '../../types/profile';
import {
  inspectDocumentFile,
  saveDocument,
  saveProcessedDocumentVariant,
  getDocumentsByProfile,
  deleteDocument,
  StoredDocument,
} from '../../services/indexedDB';
import { ImageProcessor } from '../../services/image-processor';
import { DocumentValidator } from '../../validation/document-validator';

interface DocumentsPageProps {
  profile: UserProfile;
  onChangeProfile: (p: UserProfile) => void;
  showToast: (msg: string) => void;
}

const OTHER_DOC_CATEGORIES: Array<{
  type: DocumentCategory;
  title: string;
  titleBn: string;
  accept: string;
  icon: React.ReactNode;
}> = [
  {
    type: 'nid',
    title: 'National ID (NID)',
    titleBn: 'জাতীয় পরিচয়পত্র',
    accept: 'image/jpeg,image/jpg,image/png,application/pdf',
    icon: <CreditCard className="w-4 h-4 text-sky-600" />,
  },
  {
    type: 'birth_certificate',
    title: 'Birth Certificate',
    titleBn: 'জন্ম নিবন্ধন সনদ',
    accept: 'image/jpeg,image/jpg,image/png,application/pdf',
    icon: <FileText className="w-4 h-4 text-emerald-600" />,
  },
  {
    type: 'educational_certificate',
    title: 'Educational Certificates',
    titleBn: 'শিক্ষাগত সনদপত্র',
    accept: 'image/jpeg,image/jpg,image/png,application/pdf',
    icon: <Award className="w-4 h-4 text-violet-600" />,
  },
  {
    type: 'cv',
    title: 'CV / Resume',
    titleBn: 'সিভি / জীবনবৃত্তান্ত',
    accept:
      '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    icon: <FileText className="w-4 h-4 text-amber-600" />,
  },
  {
    type: 'other',
    title: 'Other Documents',
    titleBn: 'অন্যান্য কাগজপত্র',
    accept: 'image/jpeg,image/jpg,image/png,application/pdf,.doc,.docx',
    icon: <FolderPlus className="w-4 h-4 text-slate-600" />,
  },
];

export const DocumentsPage: React.FC<DocumentsPageProps> = ({ profile, onChangeProfile, showToast }) => {
  const [savedDocs, setSavedDocs] = useState<StoredDocument[]>([]);

  const [photoOriginal, setPhotoOriginal] = useState<StoredDocument | null>(null);
  const [photoProcessed, setPhotoProcessed] = useState<StoredDocument | null>(null);

  const [sigOriginal, setSigOriginal] = useState<StoredDocument | null>(null);
  const [sigProcessed, setSigProcessed] = useState<StoredDocument | null>(null);
  const [cropTarget, setCropTarget] = useState<'photo' | 'signature' | null>(null);

  const handleApplyCropResult = async (result: ProcessedImageResult) => {
    if (!cropTarget) return;
    const isPhoto = cropTarget === 'photo';
    const orig = isPhoto ? photoOriginal : sigOriginal;
    if (!orig) return;

    const variantDoc: StoredDocument = {
      id: `${orig.id}_processed`,
      documentId: `${orig.id}_processed`,
      profileId: profile.id,
      type: cropTarget,
      documentType: cropTarget,
      title: isPhoto
        ? 'Applicant Photograph (Cropped 300×300 Copy)'
        : 'Applicant Signature (Cropped 300×80 Clean Copy)',
      fileName: isPhoto ? 'photo_300x300_cropped.jpg' : 'signature_300x80_clean.jpg',
      fileSize: result.fileSize,
      fileSizeKb: result.sizeKb,
      mimeType: result.format,
      width: result.width,
      height: result.height,
      isProcessedVariant: true,
      parentDocumentId: orig.id,
      dataUrl: result.dataUrl,
      createdAt: new Date().toISOString(),
    };
    await saveProcessedDocumentVariant(orig.id, variantDoc);
    await loadStoredDocuments();
    showToast(
      isPhoto
        ? '✂️ মূল ছবি সংরক্ষিত রেখে ক্রপ করা ৩০০×৩০০ কপি তৈরি হয়েছে!'
        : '✂️ মূল স্বাক্ষর সংরক্ষিত রেখে পরিষ্কার ৩০০×৮০ কপি তৈরি হয়েছে!'
    );
  };

  const loadStoredDocuments = useCallback(async () => {
    try {
      const docs = await getDocumentsByProfile(profile.id);
      setSavedDocs(docs);

      const photos = docs.filter((d) => (d.documentType || d.type) === 'photo');
      setPhotoOriginal(photos.find((d) => !d.isProcessedVariant) || photos[0] || null);
      setPhotoProcessed(photos.find((d) => d.isProcessedVariant) || null);

      const sigs = docs.filter((d) => (d.documentType || d.type) === 'signature');
      setSigOriginal(sigs.find((d) => !d.isProcessedVariant) || sigs[0] || null);
      setSigProcessed(sigs.find((d) => d.isProcessedVariant) || null);
    } catch (e: any) {
      console.warn('Could not load saved documents:', e?.message);
    }
  }, [profile.id]);

  useEffect(() => {
    loadStoredDocuments();
  }, [loadStoredDocuments]);

  const syncProfileDocMetadata = (docItem: DocumentItem) => {
    const existing = profile.documents || [];
    const filtered = existing.filter((d) => d.id !== docItem.id);
    onChangeProfile({
      ...profile,
      documents: [...filtered, docItem],
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const inspected = await inspectDocumentFile(file);
      const originalId = `photo_${profile.id}_original`;

      const doc: StoredDocument = {
        id: originalId,
        documentId: originalId,
        profileId: profile.id,
        type: 'photo',
        documentType: 'photo',
        title: 'Applicant Photograph (Original)',
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

      await saveDocument(doc);
      syncProfileDocMetadata({
        id: originalId,
        type: 'photo',
        title: doc.title,
        fileName: doc.fileName,
        fileSizeKb: doc.fileSizeKb,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        dimensions: { width: inspected.width, height: inspected.height },
        uploadedAt: doc.createdAt,
        isProcessedVariant: false,
      });

      await loadStoredDocuments();
      showToast('✅ মূল ছবি এনক্রিপ্টেড ভল্টে নিরাপদে সংরক্ষিত হয়েছে!');
    } catch (err: any) {
      alert('ছবি লোড করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleAutoFitPhoto = async () => {
    if (!photoOriginal?.dataUrl) return;
    try {
      showToast('⏳ মূল ছবি অক্ষত রেখে ৩০০ × ৩০০ পিক্সেলের আলাদা কপি তৈরি হচ্ছে...');
      const processed = await ImageProcessor.processAndFit(photoOriginal.dataUrl, 300, 300, 100, 'image/jpeg');

      const variantDoc: StoredDocument = {
        id: `${photoOriginal.id}_processed`,
        documentId: `${photoOriginal.id}_processed`,
        profileId: profile.id,
        type: 'photo',
        documentType: 'photo',
        title: 'Applicant Photograph (300×300 Standard Copy)',
        fileName: 'photo_300x300.jpg',
        fileSize: processed.fileSize,
        fileSizeKb: processed.sizeKb,
        mimeType: 'image/jpeg',
        width: 300,
        height: 300,
        isProcessedVariant: true,
        parentDocumentId: photoOriginal.id,
        dataUrl: processed.dataUrl,
        createdAt: new Date().toISOString(),
      };

      await saveProcessedDocumentVariant(photoOriginal.id, variantDoc);
      await loadStoredDocuments();
      showToast('✨ মূল ছবি অপরিবর্তিত রেখে ৩০০ × ৩০০ পিক্সেলের স্ট্যান্ডার্ড কপি তৈরি হয়েছে!');
    } catch (e: any) {
      alert('Photo resize error: ' + e.message);
    }
  };

  const handleSigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const inspected = await inspectDocumentFile(file);
      const originalId = `sig_${profile.id}_original`;

      const doc: StoredDocument = {
        id: originalId,
        documentId: originalId,
        profileId: profile.id,
        type: 'signature',
        documentType: 'signature',
        title: 'Applicant Signature (Original)',
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

      await saveDocument(doc);
      syncProfileDocMetadata({
        id: originalId,
        type: 'signature',
        title: doc.title,
        fileName: doc.fileName,
        fileSizeKb: doc.fileSizeKb,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        dimensions: { width: inspected.width, height: inspected.height },
        uploadedAt: doc.createdAt,
        isProcessedVariant: false,
      });

      await loadStoredDocuments();
      showToast('✅ মূল স্বাক্ষর এনক্রিপ্টেড ভল্টে নিরাপদে সংরক্ষিত হয়েছে!');
    } catch (err: any) {
      alert('স্বাক্ষর লোড করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleAutoFitSig = async () => {
    if (!sigOriginal?.dataUrl) return;
    try {
      showToast('⏳ মূল স্বাক্ষর অক্ষত রেখে ৩০০ × ৮০ পিক্সেলের আলাদা কপি তৈরি হচ্ছে...');
      const processed = await ImageProcessor.processAndFit(sigOriginal.dataUrl, 300, 80, 60, 'image/jpeg');

      const variantDoc: StoredDocument = {
        id: `${sigOriginal.id}_processed`,
        documentId: `${sigOriginal.id}_processed`,
        profileId: profile.id,
        type: 'signature',
        documentType: 'signature',
        title: 'Applicant Signature (300×80 Standard Copy)',
        fileName: 'signature_300x80.jpg',
        fileSize: processed.fileSize,
        fileSizeKb: processed.sizeKb,
        mimeType: 'image/jpeg',
        width: 300,
        height: 80,
        isProcessedVariant: true,
        parentDocumentId: sigOriginal.id,
        dataUrl: processed.dataUrl,
        createdAt: new Date().toISOString(),
      };

      await saveProcessedDocumentVariant(sigOriginal.id, variantDoc);
      await loadStoredDocuments();
      showToast('✨ মূল স্বাক্ষর অপরিবর্তিত রেখে ৩০০ × ৮০ পিক্সেলের স্ট্যান্ডার্ড কপি তৈরি হয়েছে!');
    } catch (e: any) {
      alert('Signature resize error: ' + e.message);
    }
  };

  const handleOtherDocUpload = async (
    category: DocumentCategory,
    title: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const inspected = await inspectDocumentFile(file);
      const docId = `doc_${profile.id}_${category}_${Date.now()}`;
      const doc: StoredDocument = {
        id: docId,
        documentId: docId,
        profileId: profile.id,
        type: category,
        documentType: category,
        title,
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

      await saveDocument(doc);
      syncProfileDocMetadata({
        id: docId,
        type: category,
        title,
        fileName: doc.fileName,
        fileSizeKb: doc.fileSizeKb,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        dimensions: inspected.width ? { width: inspected.width, height: inspected.height } : undefined,
        uploadedAt: doc.createdAt,
      });

      await loadStoredDocuments();
      showToast(`✅ "${title}" এনক্রিপ্টেড লোকাল ভল্টে সংরক্ষিত হয়েছে!`);
    } catch (err: any) {
      alert('ডকুমেন্ট সেভ করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    await deleteDocument(docId);
    onChangeProfile({
      ...profile,
      documents: (profile.documents || []).filter((d) => d.id !== docId),
    });
    await loadStoredDocuments();
    showToast('🗑️ ডকুমেন্ট ভল্ট থেকে মুছে ফেলা হয়েছে।');
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const activePhotoDoc = photoProcessed || photoOriginal;
  const photoValidation = activePhotoDoc
    ? DocumentValidator.validatePhoto(
        activePhotoDoc.width || 0,
        activePhotoDoc.height || 0,
        activePhotoDoc.fileSizeKb || 0,
        activePhotoDoc.mimeType
      )
    : null;

  const activeSigDoc = sigProcessed || sigOriginal;
  const sigValidation = activeSigDoc
    ? DocumentValidator.validateSignature(
        activeSigDoc.width || 0,
        activeSigDoc.height || 0,
        activeSigDoc.fileSizeKb || 0,
        activeSigDoc.mimeType
      )
    : null;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>📁</span>
            <span>Documents &amp; Images (ছবি, স্বাক্ষর ও সনদ)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            বাংলাদেশ সরকারি নিয়োগ পোর্টালের (টেলিটক, পেট্রোবাংলা ও বিপিএসসি) জন্য ছবি, স্বাক্ষর, NID, জন্ম নিবন্ধন ও সনদ সংরক্ষণ করুন।
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold shrink-0">
          <ShieldCheck className="w-4 h-4" />
          <span>AES-256-GCM Local Encrypted</span>
        </div>
      </div>

      {/* Standards Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold">নিরাপদ ডকুমেন্ট সংরক্ষণ নীতি (Original File Preservation):</div>
          <p>
            আপনার মূল আপলোড করা ফাইলটি কখনো পরিবর্তন বা ওভাররাইট করা হয় না। ওয়েবসাইটের স্ট্যান্ডার্ড অনুযায়ী (<strong>ছবি: ৩০০×৩০০ px, ≤ ১০০ KB</strong> এবং <strong>স্বাক্ষর: ৩০০×৮০ px, ≤ ৬০ KB</strong>) রিসাইজ করলে একটি আলাদা প্রক্রিয়াকৃত কপি তৈরি হয়ে সংরক্ষিত হয়।
          </p>
        </div>
      </div>

      {/* Photo and Signature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Photo Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-petro-600" />
              Applicant Photograph (আবেদনকারীর ছবি)
            </h3>
            <span className="text-[10.5px] font-mono text-petro-700 bg-petro-50 border border-petro-200 px-2 py-0.5 rounded">
              300 × 300 px
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-36 h-36 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
              {activePhotoDoc?.dataUrl ? (
                <img src={activePhotoDoc.dataUrl} alt="Applicant Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-3 text-slate-400">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                  <span className="text-[10px]">No Photo</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 bg-petro-600 hover:bg-petro-700 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm text-xs">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Photo
                  <input type="file" accept="image/jpeg,image/jpg,image/png" onChange={handlePhotoUpload} className="hidden" />
                </label>

                {photoOriginal?.dataUrl && (
                  <>
                    <button
                      type="button"
                      onClick={handleAutoFitPhoto}
                      title="Create separate 300x300 standard copy (original preserved)"
                      className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold px-2.5 py-1.5 rounded-lg transition-colors text-xs shadow-sm cursor-pointer"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Auto-Fit Copy
                    </button>

                    <button
                      type="button"
                      onClick={() => setCropTarget('photo')}
                      title="Interactive Zoom, Crop & Size Tuner (original preserved)"
                      className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1.5 rounded-lg transition-colors text-xs shadow-sm cursor-pointer"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      Crop
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadDataUrl(activePhotoDoc!.dataUrl, activePhotoDoc!.fileName)}
                      className="p-1.5 text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                      title="Download Photo"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              {photoOriginal && (
                <div className="text-[10.5px] text-slate-500 space-y-0.5 pt-1">
                  <div>
                    Original: <strong>{photoOriginal.fileName}</strong> ({photoOriginal.width}×{photoOriginal.height}px, {photoOriginal.fileSizeKb} KB)
                  </div>
                  {photoProcessed && (
                    <div className="text-emerald-700">
                      Processed Copy: <strong>{photoProcessed.fileName}</strong> ({photoProcessed.width}×{photoProcessed.height}px, {photoProcessed.fileSizeKb} KB)
                    </div>
                  )}
                </div>
              )}

              {activePhotoDoc && photoValidation && (
                <div className="pt-1">
                  <div
                    className={`text-[11px] font-semibold flex items-center gap-1 ${
                      photoValidation.isCompliant ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {photoValidation.isCompliant ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {photoValidation.isCompliant ? 'Standard Ready' : 'Needs Resize / Review'}
                    </span>
                  </div>
                  {photoValidation.errorsBn.map((err, eIdx) => (
                    <div key={eIdx} className="text-[10px] text-amber-700 mt-0.5">
                      • {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Signature Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-petro-600" />
              Applicant Signature (প্রার্থীর স্বাক্ষর)
            </h3>
            <span className="text-[10.5px] font-mono text-petro-700 bg-petro-50 border border-petro-200 px-2 py-0.5 rounded">
              300 × 80 px
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-48 h-20 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
              {activeSigDoc?.dataUrl ? (
                <img src={activeSigDoc.dataUrl} alt="Signature Preview" className="w-full h-full object-contain p-1 bg-white" />
              ) : (
                <div className="text-center text-slate-400">
                  <FileText className="w-6 h-6 mx-auto mb-0.5 opacity-50" />
                  <span className="text-[10px]">No Signature</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 bg-petro-600 hover:bg-petro-700 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm text-xs">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Signature
                  <input type="file" accept="image/jpeg,image/jpg,image/png" onChange={handleSigUpload} className="hidden" />
                </label>

                {sigOriginal?.dataUrl && (
                  <>
                    <button
                      type="button"
                      onClick={handleAutoFitSig}
                      title="Create separate 300x80 standard copy (original preserved)"
                      className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold px-2.5 py-1.5 rounded-lg transition-colors text-xs shadow-sm cursor-pointer"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Auto-Fit Copy
                    </button>

                    <button
                      type="button"
                      onClick={() => setCropTarget('signature')}
                      title="Interactive Crop & Clean White Paper Background"
                      className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1.5 rounded-lg transition-colors text-xs shadow-sm cursor-pointer"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      Crop & Clean
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadDataUrl(activeSigDoc!.dataUrl, activeSigDoc!.fileName)}
                      className="p-1.5 text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                      title="Download Signature"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              {sigOriginal && (
                <div className="text-[10.5px] text-slate-500 space-y-0.5 pt-1">
                  <div>
                    Original: <strong>{sigOriginal.fileName}</strong> ({sigOriginal.width}×{sigOriginal.height}px, {sigOriginal.fileSizeKb} KB)
                  </div>
                  {sigProcessed && (
                    <div className="text-emerald-700">
                      Processed Copy: <strong>{sigProcessed.fileName}</strong> ({sigProcessed.width}×{sigProcessed.height}px, {sigProcessed.fileSizeKb} KB)
                    </div>
                  )}
                </div>
              )}

              {activeSigDoc && sigValidation && (
                <div className="pt-1">
                  <div
                    className={`text-[11px] font-semibold flex items-center gap-1 ${
                      sigValidation.isCompliant ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {sigValidation.isCompliant ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span>{sigValidation.isCompliant ? 'Standard Ready' : 'Needs Resize / Review'}</span>
                  </div>
                  {sigValidation.errorsBn.map((err, eIdx) => (
                    <div key={eIdx} className="text-[10px] text-amber-700 mt-0.5">
                      • {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NID, Birth Certificate, Educational Certificates & Other Documents */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-800">
            Identity &amp; Academic Certificates (জাতীয় পরিচয়পত্র, জন্ম নিবন্ধন ও শিক্ষাগত সনদ)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {OTHER_DOC_CATEGORIES.map((cat) => {
            const catDocs = savedDocs.filter((d) => (d.documentType || d.type) === cat.type);
            return (
              <div key={cat.type} className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    {cat.icon}
                    <span>{cat.title}</span>
                    <span className="text-[10px] font-normal text-slate-500">({cat.titleBn})</span>
                  </div>
                  <label className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md cursor-pointer">
                    <Upload className="w-3 h-3" />
                    Add
                    <input
                      type="file"
                      accept={cat.accept}
                      onChange={(e) => handleOtherDocUpload(cat.type, cat.title, e)}
                      className="hidden"
                    />
                  </label>
                </div>

                {catDocs.length === 0 ? (
                  <div className="text-[11px] text-slate-400 italic">No saved {cat.title.toLowerCase()} yet.</div>
                ) : (
                  <div className="space-y-1.5">
                    {catDocs.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between bg-white border border-slate-200 px-2.5 py-1.5 rounded text-[11px]"
                      >
                        <div className="truncate pr-2">
                          <div className="font-semibold text-slate-700 truncate">{d.fileName}</div>
                          <div className="text-[10px] text-slate-400">
                            {d.mimeType} • {d.fileSizeKb} KB {d.width ? `• ${d.width}×${d.height}px` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => downloadDataUrl(d.dataUrl, d.fileName)}
                            className="p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(d.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {cropTarget && (cropTarget === 'photo' ? photoOriginal?.dataUrl : sigOriginal?.dataUrl) && (
        <ImageCropModal
          title={
            cropTarget === 'photo'
              ? 'Crop & Tune Photograph (300 × 300 px)'
              : 'Crop & Clean Signature (300 × 80 px)'
          }
          category={cropTarget}
          sourceDataUrl={cropTarget === 'photo' ? photoOriginal!.dataUrl : sigOriginal!.dataUrl}
          targetWidth={300}
          targetHeight={cropTarget === 'photo' ? 300 : 80}
          defaultMaxKb={cropTarget === 'photo' ? 100 : 60}
          onApply={handleApplyCropResult}
          onClose={() => setCropTarget(null)}
        />
      )}
    </div>
  );
};
