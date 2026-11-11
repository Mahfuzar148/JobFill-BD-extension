// JobFill BD - Unified Document & Media Storage Service Bridge
// Delegates encrypted persistence cleanly to DocumentRepository (IndexedDB + AES-256-GCM)
// while preserving original UI helper functions.

import { DocumentRepository } from '../database/document-repository';
import { inferDocumentMimeType } from '../documents/document-requirement-validator';
import { DocumentCategory, DocumentMetadata } from '../types/profile';

export interface StoredDocument {
  id: string;
  documentId?: string;
  profileId: string;
  type: DocumentCategory;
  documentType?: DocumentCategory;
  title: string;
  fileName: string;
  fileSize?: number;
  fileSizeKb: number;
  mimeType: string;
  width?: number;
  height?: number;
  dataUrl: string; // Decrypted in-memory copy; stored encrypted at rest
  createdAt: string;
  isProcessedVariant?: boolean;
  parentDocumentId?: string;
}

export async function saveDocument(doc: StoredDocument): Promise<DocumentMetadata> {
  return DocumentRepository.saveDocument({
    ...doc,
    id: doc.id,
    documentId: doc.documentId || doc.id,
    documentType: (doc.documentType || doc.type || 'other') as DocumentCategory,
    fileSize: doc.fileSize ?? Math.round((doc.fileSizeKb || 0) * 1024),
  });
}

export async function saveProcessedDocumentVariant(
  parentOriginalId: string,
  doc: StoredDocument
): Promise<DocumentMetadata> {
  return DocumentRepository.saveProcessedVariant(parentOriginalId, {
    profileId: doc.profileId,
    documentType: (doc.documentType || doc.type || 'other') as DocumentCategory,
    title: doc.title,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize ?? Math.round((doc.fileSizeKb || 0) * 1024),
    width: doc.width || 0,
    height: doc.height || 0,
    dataUrl: doc.dataUrl,
  });
}

export async function getDocumentById(id: string): Promise<StoredDocument | null> {
  return DocumentRepository.getDocumentById(id);
}

export async function getDocumentsByProfile(profileId: string): Promise<StoredDocument[]> {
  return DocumentRepository.getDocumentsByProfile(profileId);
}

export async function getDocumentMetadataByProfile(profileId: string): Promise<DocumentMetadata[]> {
  return DocumentRepository.getDocumentMetadataByProfile(profileId);
}

export async function deleteDocument(id: string): Promise<void> {
  return DocumentRepository.deleteDocument(id);
}

// Client-side inspection of Image or PDF files
export function inspectDocumentFile(file: File): Promise<{
  width: number;
  height: number;
  fileSize: number;
  sizeKb: number;
  mimeType: string;
  dataUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const fileSize = file.size;
      const sizeKb = Number((fileSize / 1024).toFixed(2));
      const mimeType = inferDocumentMimeType(file.name, file.type);

      if (!mimeType.startsWith('image/')) {
        resolve({ width: 0, height: 0, fileSize, sizeKb, mimeType, dataUrl });
        return;
      }

      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          fileSize,
          sizeKb,
          mimeType,
          dataUrl,
        });
      };
      img.onerror = () => reject(new Error('Failed to load image for dimension measurement.'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Legacy alias kept for UI compatibility
export function inspectImageFile(file: File): Promise<{
  width: number;
  height: number;
  fileSize: number;
  sizeKb: number;
  mimeType: string;
  dataUrl: string;
}> {
  return inspectDocumentFile(file);
}

// Bangladesh Government Photo & Signature Standard Specs
export const BD_IMAGE_SPECS = {
  photo: {
    recommendedWidth: 300,
    recommendedHeight: 300,
    maxSizeKb: 100,
    allowedFormats: ['image/jpeg', 'image/jpg', 'image/png'],
    label: 'Passport Size Photograph (300×300 px, Max 100 KB)',
  },
  signature: {
    recommendedWidth: 300,
    recommendedHeight: 80,
    maxSizeKb: 60,
    allowedFormats: ['image/jpeg', 'image/jpg', 'image/png'],
    label: 'Applicant Signature (300×80 px, Max 60 KB)',
  },
};
