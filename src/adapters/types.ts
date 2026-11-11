// JobFill BD - Site Adapter Interface
import { UserProfile, FormScanReport, DocumentCategory } from '../types/profile';

export interface DocumentFieldMappingRule {
  canonicalKey: string; // e.g. 'profile.documents.photo' or 'profile.documents.signature'
  documentType: DocumentCategory;
  fieldNames: string[];
  fieldIds: string[];
  labelKeywords: string[];
  previewSelectors?: string[];
  errorSelectors?: string[];
}

export interface SiteAdapter {
  id: string;
  name: string;
  description: string;
  matchesUrl(url: string): boolean;
  detectSite(document: Document): boolean;
  preProcessForm?(document: Document): void;
  customScan?(profile: UserProfile): FormScanReport | null;
  postFill?(document: Document, profile: UserProfile): void;
  documentMappings?: DocumentFieldMappingRule[];
}
