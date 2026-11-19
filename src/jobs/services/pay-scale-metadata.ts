/**
 * National Pay Scale 2015 (জাতীয় বেতন স্কেল ২০১৫) Metadata & Helper
 *
 * Defines official government pay grades from Grade 4 through Grade 20,
 * salary ranges (basic pay min/max in BDT), Bengali labels, and typical designations.
 * Grades 1-3 are constitutional/secretariat posts filled by promotion/appointment.
 */

export interface PayGradeMetadata {
  gradeNumber: number;
  banglaLabel: string;
  payScale: string;
  minBasic: number;
  maxBasic: number;
  typicalDesignation: string;
  typicalDesignationBn: string;
}

export const NATIONAL_PAY_SCALE_2015: Record<number, PayGradeMetadata> = {
  4: {
    gradeNumber: 4,
    banglaLabel: '৪র্থ গ্রেড',
    payScale: '৳৫০,০০০–৭১,২০০',
    minBasic: 50000,
    maxBasic: 71200,
    typicalDesignation: 'Professor / Director / Chief Scientific Officer',
    typicalDesignationBn: 'অধ্যাপক / পরিচালক / প্রধান বৈজ্ঞানিক কর্মকর্তা',
  },
  5: {
    gradeNumber: 5,
    banglaLabel: '৫ম গ্রেড',
    payScale: '৳৪৩,০০০–৬৯,৮৫০',
    minBasic: 43000,
    maxBasic: 69850,
    typicalDesignation: 'Associate Professor / Deputy Director / PSO',
    typicalDesignationBn: 'সহযোগী অধ্যাপক / উপ-পরিচালক',
  },
  6: {
    gradeNumber: 6,
    banglaLabel: '৬ষ্ঠ গ্রেড',
    payScale: '৳৩৫,৫০০–৬৭,০১০',
    minBasic: 35500,
    maxBasic: 67010,
    typicalDesignation: 'Executive Engineer / Senior Assistant Secretary',
    typicalDesignationBn: 'নির্বাহী প্রকৌশলী / সিনিয়র সহকারী সচিব',
  },
  7: {
    gradeNumber: 7,
    banglaLabel: '৭ম গ্রেড',
    payScale: '৳২৯,০০০–৬৩,৪১০',
    minBasic: 29000,
    maxBasic: 63410,
    typicalDesignation: 'Sub-Divisional Engineer / Assistant Professor / SSO',
    typicalDesignationBn: 'উপ-বিভাগীয় প্রকৌশলী / সহকারী অধ্যাপক',
  },
  8: {
    gradeNumber: 8,
    banglaLabel: '৮ম গ্রেড',
    payScale: '৳২৩,০০০–৫৫,৪৭০',
    minBasic: 23000,
    maxBasic: 55470,
    typicalDesignation: 'Senior Officer / Assistant Director (Promo)',
    typicalDesignationBn: 'সিনিয়র অফিসার / সহকারী পরিচালক',
  },
  9: {
    gradeNumber: 9,
    banglaLabel: '৯ম গ্রেড',
    payScale: '৳২২,০০০–৫৩,০৬০',
    minBasic: 22000,
    maxBasic: 53060,
    typicalDesignation: 'BCS Cadre / Sub-Registrar / Assistant Engineer / Officer',
    typicalDesignationBn: 'বিসিএস ক্যাডার / সাব-রেজিস্ট্রার / সহকারী প্রকৌশলী / কর্মকর্তা',
  },
  10: {
    gradeNumber: 10,
    banglaLabel: '১০ম গ্রেড',
    payScale: '৳১৬,০০০–৩৮,৬৪০',
    minBasic: 16000,
    maxBasic: 38640,
    typicalDesignation: '2nd Class Officer / Sub-Assistant Engineer / Staff Nurse',
    typicalDesignationBn: '২য় শ্রেণির কর্মকর্তা / উপ-সহকারী প্রকৌশলী / স্টাফ নার্স',
  },
  11: {
    gradeNumber: 11,
    banglaLabel: '১১তম গ্রেড',
    payScale: '৳১২,৫০০–৩০,২৩০',
    minBasic: 12500,
    maxBasic: 30230,
    typicalDesignation: 'Assistant Programmer (Diploma) / Primary Head Teacher',
    typicalDesignationBn: 'সহকারী প্রোগ্রামার (ডিপ্লোমা) / প্রধান শিক্ষক',
  },
  12: {
    gradeNumber: 12,
    banglaLabel: '১২তম গ্রেড',
    payScale: '৳১১,৩০০–২৭,৩০০',
    minBasic: 11300,
    maxBasic: 27300,
    typicalDesignation: 'Technical Assistant / Field Officer',
    typicalDesignationBn: 'কারিগরি সহকারী / মাঠ কর্মকর্তা',
  },
  13: {
    gradeNumber: 13,
    banglaLabel: '১৩তম গ্রেড',
    payScale: '৳১১,০০০–২৬,৫৯০',
    minBasic: 11000,
    maxBasic: 26590,
    typicalDesignation: 'Primary Assistant Teacher / Office Superintendent',
    typicalDesignationBn: 'সরকারি প্রাথমিক বিদ্যালয় সহকারী শিক্ষক',
  },
  14: {
    gradeNumber: 14,
    banglaLabel: '১৪তম গ্রেড',
    payScale: '৳১০,২০০–২৪,৬৮০',
    minBasic: 10200,
    maxBasic: 24680,
    typicalDesignation: 'Junior Assistant / Sub-Inspector / Auditor',
    typicalDesignationBn: 'জুনিয়র সহকারী / উপ-পরিদর্শক / অডিটর',
  },
  15: {
    gradeNumber: 15,
    banglaLabel: '১৫তম গ্রেড',
    payScale: '৳৯,৭০০–২৩,৪৯০',
    minBasic: 9700,
    maxBasic: 23490,
    typicalDesignation: 'Technician / Data Entry Operator / Compounder',
    typicalDesignationBn: 'টেকনিশিয়ান / ডাটা এন্ট্রি অপারেটর',
  },
  16: {
    gradeNumber: 16,
    banglaLabel: '১৬তম গ্রেড',
    payScale: '৳৯,৩০০–২২,৪৯০',
    minBasic: 9300,
    maxBasic: 22490,
    typicalDesignation: 'Office Assistant Cum Computer Typist (LDA) / Driver',
    typicalDesignationBn: 'অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক / ড্রাইভার',
  },
  17: {
    gradeNumber: 17,
    banglaLabel: '১৭তম গ্রেড',
    payScale: '৳৯,০০০–২১,৮০০',
    minBasic: 9000,
    maxBasic: 21800,
    typicalDesignation: 'Laboratory Attendant / Dispatch Rider',
    typicalDesignationBn: 'ল্যাবরেটরি অ্যাটেনডেন্ট / ডেসপাচ রাইডার',
  },
  18: {
    gradeNumber: 18,
    banglaLabel: '১৮তম গ্রেড',
    payScale: '৳৮,৮০০–২১,৩১০',
    minBasic: 8800,
    maxBasic: 21310,
    typicalDesignation: 'Forest Guard / Electrician Assistant / Tube-well Mechanic',
    typicalDesignationBn: 'ফরেস্ট গার্ড / সহকারী ইলেকট্রিশিয়ান',
  },
  19: {
    gradeNumber: 19,
    banglaLabel: '১৯তম গ্রেড',
    payScale: '৳৮,৫০০–২০,৫৭০',
    minBasic: 8500,
    maxBasic: 20570,
    typicalDesignation: 'Messenger / Lift Operator / Chainman',
    typicalDesignationBn: 'বার্তা বাহক / লিফট অপারেটর / চেইনম্যান',
  },
  20: {
    gradeNumber: 20,
    banglaLabel: '২০তম গ্রেড',
    payScale: '৳৮,২৫০–২০,০১০',
    minBasic: 8250,
    maxBasic: 20010,
    typicalDesignation: 'Office Support Staff (MLSS) / Security Guard / Cleaner',
    typicalDesignationBn: 'অফিস সহায়ক (এমএলএসএস) / নিরাপত্তা প্রহরী / পরিচ্ছন্নতা কর্মী',
  },
};

/**
 * Returns all public recruitment grades strictly in ascending order: 4, 5, 6, ..., 20.
 */
export function getAscendingPayGrades(): PayGradeMetadata[] {
  const grades: PayGradeMetadata[] = [];
  for (let g = 4; g <= 20; g++) {
    if (NATIONAL_PAY_SCALE_2015[g]) {
      grades.push(NATIONAL_PAY_SCALE_2015[g]);
    }
  }
  return grades;
}

/**
 * Formats a pay grade number into its official title, e.g. "৯ম গ্রেড (৳২২,০০০–৫৩,০৬০)".
 */
export function formatGradeWithPayScale(gradeNumber: number | null | undefined): string {
  if (!gradeNumber || gradeNumber < 1 || gradeNumber > 20) {
    return 'Non-Grade / Not Specified';
  }
  const meta = NATIONAL_PAY_SCALE_2015[gradeNumber];
  if (meta) {
    return `${meta.banglaLabel} (${meta.payScale})`;
  }
  return `Grade ${gradeNumber}`;
}
