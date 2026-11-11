// JobFill BD - Smart Dropdown & Dependent Dropdown Matcher
// Handles exact, case-insensitive, normalized, and bilingual English-Bengali equivalence.
// Supports cascading dependent dropdowns: Division -> District -> Upazila.

export const BILINGUAL_EQUIVALENTS: Record<string, string[]> = {
  // Genders
  male: ['male', 'পুরুষ', 'm'],
  female: ['female', 'মহিলা', 'নারী', 'f'],
  other: ['other', 'অন্যান্য', 'third gender', 'transgender'],

  // Marital Status
  single: ['single', 'unmarried', 'অবিবাহিত'],
  married: ['married', 'বিবাহিত'],
  divorced: ['divorced', 'তালাকপ্রাপ্ত'],
  widowed: ['widowed', 'বিধবা', 'বিপত্নীক'],

  // Religions
  islam: ['islam', 'ইসলাম', 'muslim'],
  hinduism: ['hinduism', 'হিন্দু', 'সনাতন', 'hindu'],
  christianity: ['christianity', 'খ্রিস্টান', 'christian'],
  buddhism: ['buddhism', 'বৌদ্ধ', 'buddhist'],
  other_religion: ['other', 'অন্যান্য'],

  // Education Boards
  dhaka: ['dhaka', 'ঢাকা'],
  chittagong: ['chittagong', 'chattogram', 'চট্টগ্রাম'],
  rajshahi: ['rajshahi', 'রাজশাহী'],
  khulna: ['khulna', 'খুলনা'],
  barisal: ['barisal', 'বরিশাল'],
  sylhet: ['sylhet', 'সিলেট'],
  comilla: ['comilla', 'কুমিল্লা'],
  jessore: ['jessore', 'যশোর'],
  dinajpur: ['dinajpur', 'দিনাজপুর'],
  mymensingh: ['mymensingh', 'ময়মনসিংহ'],
  madrasah: ['madrasah', 'madrasa', 'মাদ্রাসা', 'মাদ্রাসা বোর্ড'],
  technical: ['technical', 'কারিগরি', 'কারিগরি বোর্ড', 'bteb'],
  bteb: ['bteb', 'technical', 'বাংলাদেশ কারিগরি শিক্ষা বোর্ড'],

  // Groups
  science: ['science', 'বিজ্ঞান'],
  humanities: ['humanities', 'মানবিক', 'arts'],
  commerce: ['commerce', 'business studies', 'ব্যবসায় শিক্ষা', 'ব্যবসায় শাখা'],
  general: ['general', 'সাধারণ'],

  // Quotas
  general_quota: ['general', 'সাধারণ', 'non-quota', 'non quota'],
  freedom_fighter: ['freedom fighter', 'মুক্তিযোদ্ধা', 'মুক্তিযোদ্ধা কোটা', 'ff'],
  child_ff: ['child of freedom fighter', 'মুক্তিযোদ্ধার সন্তান', 'মুক্তিযোদ্ধা কোটা (সন্তান)'],
  grandchild_ff: ['grandchild of freedom fighter', 'মুক্তিযোদ্ধার নাতি-নাতনি'],
  district_quota: ['district', 'জেলা কোটা', 'district quota'],
  women_quota: ['women', 'মহিলা', 'মহিলা কোটা', 'female quota'],
  tribal_quota: ['tribal', 'ethnic minority', 'উপজাতি', 'ক্ষুদ্র নৃ-গোষ্ঠী'],
  disabled_quota: ['disabled', 'physically challenged', 'প্রতিবন্ধী', 'প্রতিবন্ধী কোটা'],
  ansar_quota: ['ansar', 'ansar vdp', 'আনসার ভিডিপি', 'আনসার ও ভিডিপি'],
  orphan_quota: ['orphan', 'এতিম', 'এতিম ও শারীরিক প্রতিবন্ধী'],

  // Departmental Status
  no_dept: ['no', 'না', 'none'],
  yes_dept: ['yes', 'হ্যাঁ', 'departmental', 'departmental candidate', 'বিভাগীয় প্রার্থী'],

  // Boolean / Presence Dropdowns (National ID, Birth Registration, Passport ID)
  yes_boolean: ['yes', 'y', 'হ্যাঁ'],
  no_boolean: ['no', 'n', 'না'],

  // Nationality
  bangladeshi: ['bangladeshi', 'বাংলাদেশী', 'bangladesh', 'বাংলাদেশ'],

  // SSC Examinations
  ssc: ['ssc', 's.s.c', 's.s.c.', 'secondary school certificate', 'secondary', 'এসএসসি', 'মাধ্যমিক', 's s c'],
  dakhil: ['dakhil', 'দাখিল'],
  ssc_vocational: ['ssc vocational', 's.s.c vocational', 's.s.c. vocational', 'ssc (vocational)', 's.s.c (vocational)', 'এসএসসি ভোকেশনাল', 'এসএসসি (ভোকেশনাল)'],
  o_level: ['o level', 'o-level', 'o level/cambridge', 'cambridge', 'gce o level'],
  ssc_equivalent: ['ssc equivalent', 's.s.c equivalent', 's.s.c. equivalent', 'সমমান (এসএসসি)'],
  dakhil_vocational: ['dakhil vocational', 'দাখিল ভোকেশনাল'],

  // HSC Examinations
  hsc: ['hsc', 'h.s.c', 'h.s.c.', 'higher secondary certificate', 'higher secondary', 'intermediate', 'এইচএসসি', 'উচ্চ মাধ্যমিক', 'h s c'],
  alim: ['alim', 'আলিম'],
  hsc_vocational: ['hsc vocational', 'h.s.c vocational', 'h.s.c. vocational', 'hsc (vocational)', 'h.s.c (vocational)', 'business management', 'hsc bm', 'এইচএসসি (বিএম)', 'এইচএসসি ভোকেশনাল', 'এইচএসসি (ভোকেশনাল)'],
  diploma_engineering: ['diploma in engineering', 'diploma-in-engineering', 'diploma', 'ডিপ্লোমা', 'ডিপ্লোমা ইন ইঞ্জিনিয়ারিং'],
  a_level: ['a level', 'a-level', 'a level/cambridge', 'gce a level'],
  hsc_equivalent: ['hsc equivalent', 'h.s.c equivalent', 'h.s.c. equivalent', 'সমমান (এইচএসসি)'],

  // Graduation Examinations / Degrees
  bsc_engineering: ['b.sc engineering', 'b.sc. engineering', 'bsc engineering', 'b.sc. in engineering', 'b.sc engg.', 'b.sc engg', 'engineering'],
  bsc_hons: ['b.sc (hons)', 'b.sc. (hons)', 'bsc hons', 'b.sc (honours)', 'bachelor of science'],
  bba: ['b.b.a', 'bba', 'b.b.a (hons)', 'bachelor of business administration'],
  ba_hons: ['b.a (hons)', 'b.a. (hons)', 'ba hons', 'bachelor of arts'],
  bcom: ['b.com (hons)', 'b.com', 'bcom', 'bachelor of commerce'],
  pass_course: ['degree (pass)', 'pass course', 'degree pass', 'বিএ পাস', 'বিএসএস পাস'],

  // Subjects
  cse: ['computer science and engineering', 'computer science & engineering', 'cse', 'computer science', 'কম্পিউটার সায়েন্স'],
  eee: ['electrical and electronic engineering', 'electrical & electronic engineering', 'eee', 'electrical engineering'],
  it: ['information technology', 'information and communication technology', 'ict', 'it'],

  // Universities
  du: ['university of dhaka', 'dhaka university', 'du', 'ঢাকা বিশ্ববিদ্যালয়', 'ঢাবি'],
  buet: ['bangladesh university of engineering and technology', 'buet', 'বুয়েট'],
  ru: ['rajshahi university', 'university of rajshahi', 'ru', 'রাজশাহী বিশ্ববিদ্যালয়'],
  cu: ['chittagong university', 'university of chittagong', 'cu', 'চট্টগ্রাম বিশ্ববিদ্যালয়'],
  ju: ['jahangirnagar university', 'ju', 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়'],
  ku: ['khulna university', 'ku', 'খুলনা বিশ্ববিদ্যালয়'],
  sust: ['shahjalal university of science and technology', 'sust', 'শাবিপ্রবি'],
  nu: ['national university', 'জাতীয় বিশ্ববিদ্যালয়', 'nu'],

  // Course Duration
  duration_4: ['4 years', '4 year', '4-years', '৪ বছর', '4'],
  duration_3: ['3 years', '3 year', '3-years', '৩ বছর', '3'],
  duration_5: ['5 years', '5 year', '5-years', '৫ বছর', '5'],

  // Employment Type
  private: ['private', 'বেসরকারি', 'private organization', 'private company'],
  govt: ['government', 'govt', 'সরকারি', 'revenue'],
  semi_govt: ['semi-government', 'semi government', 'আধা-সরকারি'],
  autonomous: ['autonomous', 'স্বায়ত্তশাসিত'],
};

export const EXAMINATION_EQUIVALENTS: Record<string, string[]> = {
  ssc: ['ssc', 's.s.c', 's.s.c.', 'secondary school certificate', 'secondary', 'এসএসসি', 'মাধ্যমিক', 's s c'],
  dakhil: ['dakhil', 'দাখিল'],
  ssc_vocational: ['ssc vocational', 's.s.c vocational', 's.s.c. vocational', 'ssc (vocational)', 's.s.c (vocational)', 'এসএসসি ভোকেশনাল', 'এসএসসি (ভোকেশনাল)'],
  o_level: ['o level', 'o-level', 'o level/cambridge', 'cambridge', 'gce o level'],
  ssc_equivalent: ['ssc equivalent', 's.s.c equivalent', 's.s.c. equivalent', 'সমমান (এসএসসি)'],
  dakhil_vocational: ['dakhil vocational', 'দাখিল ভোকেশনাল'],

  hsc: ['hsc', 'h.s.c', 'h.s.c.', 'higher secondary certificate', 'higher secondary', 'intermediate', 'এইচএসসি', 'উচ্চ মাধ্যমিক', 'h s c'],
  alim: ['alim', 'আলিম'],
  hsc_vocational: ['hsc vocational', 'h.s.c vocational', 'h.s.c. vocational', 'hsc (vocational)', 'h.s.c (vocational)', 'business management', 'hsc bm', 'এইচএসসি (বিএম)', 'এইচএসসি ভোকেশনাল', 'এইচএসসি (ভোকেশনাল)'],
  diploma_engineering: ['diploma in engineering', 'diploma-in-engineering', 'diploma', 'ডিপ্লোমা', 'ডিপ্লোমা ইন ইঞ্জিনিয়ারিং'],
  a_level: ['a level', 'a-level', 'a level/cambridge', 'gce a level'],
  hsc_equivalent: ['hsc equivalent', 'h.s.c equivalent', 'h.s.c. equivalent', 'সমমান (এইচএসসি)'],

  bsc_engineering: ['b.sc engineering', 'b.sc. engineering', 'bsc engineering', 'b.sc. in engineering', 'b.sc engg.', 'b.sc engg', 'engineering'],
  bsc_hons: ['b.sc (hons)', 'b.sc. (hons)', 'bsc hons', 'b.sc (honours)', 'bachelor of science'],
  bba: ['b.b.a', 'bba', 'b.b.a (hons)', 'bachelor of business administration'],
  ba_hons: ['b.a (hons)', 'b.a. (hons)', 'ba hons', 'bachelor of arts'],
  bcom: ['b.com (hons)', 'b.com', 'bcom', 'bachelor of commerce'],
  pass_course: ['degree (pass)', 'pass course', 'degree pass', 'বিএ পাস', 'বিএসএস পাস'],
};

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\s\-_.\/():,]+/g, '')
    .trim();
}

export function matchDropdownOption(
  selectElement: HTMLSelectElement,
  targetValue: string
): HTMLOptionElement | null {
  if (!targetValue) return null;

  const targetNorm = normalize(targetValue);
  const options = Array.from(selectElement.options);

  // 1. Exact value or text match
  for (const opt of options) {
    if (normalize(opt.value) === targetNorm || normalize(opt.text) === targetNorm) {
      return opt;
    }
  }

  // 2. Case-insensitive & trimmed partial match
  for (const opt of options) {
    const valNorm = normalize(opt.value);
    const textNorm = normalize(opt.text);
    if (
      (valNorm && (valNorm.includes(targetNorm) || targetNorm.includes(valNorm))) ||
      (textNorm && (textNorm.includes(targetNorm) || targetNorm.includes(textNorm)))
    ) {
      return opt;
    }
  }

  // 3. Known Bilingual Equivalence Match
  for (const [_key, aliases] of Object.entries(BILINGUAL_EQUIVALENTS)) {
    const targetMatchesAlias = aliases.some((a) => normalize(a) === targetNorm);
    if (targetMatchesAlias) {
      for (const opt of options) {
        const valNorm = normalize(opt.value);
        const textNorm = normalize(opt.text);
        if (
          aliases.some((a) => normalize(a) === valNorm || normalize(a) === textNorm)
        ) {
          return opt;
        }
      }
    }
  }

  return null;
}

// Returns the matched option value or null
export function findBestOption(
  selectElement: HTMLSelectElement,
  targetValue: string
): string | null {
  const opt = matchDropdownOption(selectElement, targetValue);
  return opt ? opt.value : null;
}

// Safely sets a select element's value and fires change/input events
export function setSelectValue(
  selectElement: HTMLSelectElement,
  targetValue: string
): boolean {
  const matched = matchDropdownOption(selectElement, targetValue);
  if (!matched || matched.index === 0) return false;

  selectElement.value = matched.value;
  selectElement.selectedIndex = matched.index;

  // Dispatch events to inform reactive forms (React/Vue/Angular)
  selectElement.dispatchEvent(new Event('input', { bubbles: true }));
  selectElement.dispatchEvent(new Event('change', { bubbles: true }));
  selectElement.dispatchEvent(new Event('blur', { bubbles: true }));

  return true;
}

// Cascading Dependent Dropdowns Driver
export async function handleCascadingDropdowns(
  divisionEl: HTMLSelectElement | null,
  districtEl: HTMLSelectElement | null,
  upazilaEl: HTMLSelectElement | null,
  divisionVal: string,
  districtVal: string,
  upazilaVal: string
): Promise<{ divisionSet: boolean; districtSet: boolean; upazilaSet: boolean }> {
  let divisionSet = false;
  let districtSet = false;
  let upazilaSet = false;

  // Step 1: Select Division
  if (divisionEl && divisionVal) {
    divisionSet = setSelectValue(divisionEl, divisionVal);
    // Wait for DOM mutation or timeout
    await new Promise((r) => setTimeout(r, 350));
  }

  // Step 2: Select District
  if (districtEl && districtVal) {
    districtSet = setSelectValue(districtEl, districtVal);
    await new Promise((r) => setTimeout(r, 350));
  }

  // Step 3: Select Upazila
  if (upazilaEl && upazilaVal) {
    upazilaSet = setSelectValue(upazilaEl, upazilaVal);
  }

  return { divisionSet, districtSet, upazilaSet };
}
