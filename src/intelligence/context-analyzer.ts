// JobFill BD - Layer 2: Hierarchical Context Analyzer
// Implements Part F of Master Engineering Specification:
// Disambiguates identical labels (Roll, Result, Name, Board, Year, District)
// by inspecting surrounding section hierarchy and ancestor headings.

import { FieldEvidence } from '../content/field-extractor';

export type SectionCategory =
  | 'applicant'
  | 'father'
  | 'mother'
  | 'spouse'
  | 'present_address'
  | 'permanent_address'
  | 'ssc'
  | 'hsc'
  | 'graduation'
  | 'masters'
  | 'experience'
  | 'special'
  | 'unknown';

export interface ContextAnalysisResult {
  sectionCategory: SectionCategory;
  academicLevel?: 'ssc' | 'hsc' | 'graduation' | 'masters';
  addressType?: 'present' | 'permanent';
  personType?: 'applicant' | 'father' | 'mother' | 'spouse';
  confidence: number; // 0 - 100
  hierarchyPath: string;
}

export class ContextAnalyzer {
  public static analyze(evidence: FieldEvidence): ContextAnalysisResult {
    const rawContext = `${evidence.parentContextText} ${evidence.legend} ${evidence.tableHeader}`.toLowerCase();
    const nameId = `${evidence.name} ${evidence.id}`.toLowerCase();

    // 0. Explicit HTML Name / ID Prefix Signals (e.g. ssc_roll, hsc_roll, grad_exam)
    if (nameId.includes('ssc_') || nameId.startsWith('ssc') || nameId.includes('_ssc')) {
      return {
        sectionCategory: 'ssc',
        academicLevel: 'ssc',
        confidence: 100,
        hierarchyPath: 'Education > SSC (Field Signal)',
      };
    }
    if (nameId.includes('hsc_') || nameId.startsWith('hsc') || nameId.includes('_hsc')) {
      return {
        sectionCategory: 'hsc',
        academicLevel: 'hsc',
        confidence: 100,
        hierarchyPath: 'Education > HSC (Field Signal)',
      };
    }
    if (nameId.includes('grad_') || nameId.startsWith('grad') || nameId.includes('gra_') || nameId.includes('_grad')) {
      return {
        sectionCategory: 'graduation',
        academicLevel: 'graduation',
        confidence: 100,
        hierarchyPath: 'Education > Graduation (Field Signal)',
      };
    }
    if (nameId.includes('mast_') || nameId.startsWith('mast') || nameId.includes('mas_') || nameId.includes('_mast')) {
      return {
        sectionCategory: 'masters',
        academicLevel: 'masters',
        confidence: 100,
        hierarchyPath: 'Education > Masters (Field Signal)',
      };
    }

    // 1. Academic Qualification Hierarchy
    // Check Masters first
    if (
      rawContext.includes('masters') ||
      rawContext.includes('post graduate') ||
      rawContext.includes('মাস্টার্স') ||
      rawContext.includes('স্নাতকোত্তর')
    ) {
      return {
        sectionCategory: 'masters',
        academicLevel: 'masters',
        confidence: 95,
        hierarchyPath: 'Education > Masters',
      };
    }

    // Check Graduation / Honours / Bachelor
    if (
      rawContext.includes('graduation') ||
      rawContext.includes('bachelor') ||
      rawContext.includes('honours') ||
      rawContext.includes('undergraduate') ||
      rawContext.includes('স্নাতক')
    ) {
      return {
        sectionCategory: 'graduation',
        academicLevel: 'graduation',
        confidence: 95,
        hierarchyPath: 'Education > Graduation',
      };
    }

    // Check HSC / Diploma (Checked before SSC to prevent 'উচ্চ মাধ্যমিক' matching 'মাধ্যমিক')
    if (
      rawContext.includes('hsc') ||
      rawContext.includes('h s c') ||
      rawContext.includes('higher secondary') ||
      rawContext.includes('diploma') ||
      rawContext.includes('alim') ||
      rawContext.includes('উচ্চ মাধ্যমিক') ||
      rawContext.includes('এইচএসসি')
    ) {
      return {
        sectionCategory: 'hsc',
        academicLevel: 'hsc',
        confidence: 95,
        hierarchyPath: 'Education > HSC',
      };
    }

    // Check SSC / Equivalent
    if (
      rawContext.includes('ssc') ||
      rawContext.includes('s s c') ||
      rawContext.includes('secondary school') ||
      rawContext.includes('dakhil') ||
      rawContext.includes('o level') ||
      rawContext.includes('মাধ্যমিক') ||
      rawContext.includes('এসএসসি')
    ) {
      return {
        sectionCategory: 'ssc',
        academicLevel: 'ssc',
        confidence: 95,
        hierarchyPath: 'Education > SSC',
      };
    }

    // 2. Address Hierarchy (Present vs Permanent)
    if (
      rawContext.includes('permanent address') ||
      rawContext.includes('স্থায়ী ঠিকানা') ||
      evidence.name.toLowerCase().includes('permanent') ||
      evidence.id.toLowerCase().includes('permanent') ||
      evidence.name.toLowerCase().startsWith('perm_')
    ) {
      return {
        sectionCategory: 'permanent_address',
        addressType: 'permanent',
        confidence: 95,
        hierarchyPath: 'Address > Permanent',
      };
    }

    if (
      rawContext.includes('present address') ||
      rawContext.includes('mailing address') ||
      rawContext.includes('বর্তমান ঠিকানা') ||
      evidence.name.toLowerCase().includes('present') ||
      evidence.id.toLowerCase().includes('present') ||
      evidence.name.toLowerCase().startsWith('p_')
    ) {
      return {
        sectionCategory: 'present_address',
        addressType: 'present',
        confidence: 95,
        hierarchyPath: 'Address > Present',
      };
    }

    // 3. Job Experience Hierarchy
    if (
      rawContext.includes('job experiences') ||
      rawContext.includes('employment') ||
      rawContext.includes('service') ||
      rawContext.includes('অভিজ্ঞতা') ||
      rawContext.includes('চাকরি')
    ) {
      return {
        sectionCategory: 'experience',
        confidence: 90,
        hierarchyPath: 'Experience > Employment History',
      };
    }

    // 4. Special / Organization Choice
    if (
      rawContext.includes('organization choice') ||
      rawContext.includes('choice') ||
      rawContext.includes('preference') ||
      rawContext.includes('পছন্দক্রম')
    ) {
      return {
        sectionCategory: 'special',
        confidence: 90,
        hierarchyPath: 'Preferences > Organization Choice',
      };
    }

    // 5. Personal / Family Hierarchy Disambiguation
    const labelLower = evidence.label.toLowerCase();
    const nameLower = evidence.name.toLowerCase();

    if (labelLower.includes('father') || nameLower.includes('father') || labelLower.includes('পিতা')) {
      return {
        sectionCategory: 'father',
        personType: 'father',
        confidence: 95,
        hierarchyPath: 'Personal > Father',
      };
    }

    if (labelLower.includes('mother') || nameLower.includes('mother') || labelLower.includes('মাতা')) {
      return {
        sectionCategory: 'mother',
        personType: 'mother',
        confidence: 95,
        hierarchyPath: 'Personal > Mother',
      };
    }

    if (labelLower.includes('spouse') || nameLower.includes('spouse') || labelLower.includes('স্বামী') || labelLower.includes('স্ত্রী')) {
      return {
        sectionCategory: 'spouse',
        personType: 'spouse',
        confidence: 95,
        hierarchyPath: 'Personal > Spouse',
      };
    }

    if (
      rawContext.includes('basic information') ||
      rawContext.includes('personal') ||
      rawContext.includes('applicant') ||
      rawContext.includes('ব্যক্তিগত তথ্য')
    ) {
      return {
        sectionCategory: 'applicant',
        personType: 'applicant',
        confidence: 85,
        hierarchyPath: 'Personal > Applicant Info',
      };
    }

    return {
      sectionCategory: 'unknown',
      confidence: 30,
      hierarchyPath: 'Unknown',
    };
  }
}
