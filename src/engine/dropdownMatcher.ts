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
  chittagong: ['chittagong', 'chattogram', 'চট্টগ্রাম', 'চিটাগাং'],
  rajshahi: ['rajshahi', 'রাজশাহী'],
  khulna: ['khulna', 'খুলনা'],
  barisal: ['barisal', 'barishal', 'বরিশাল'],
  sylhet: ['sylhet', 'সিলেট'],
  comilla: ['comilla', 'cumilla', 'কুমিল্লা'],
  jessore: ['jessore', 'jashore', 'যশোর'],
  dinajpur: ['dinajpur', 'দিনাজপুর'],
  mymensingh: ['mymensingh', 'ময়মনসিংহ', 'ময়মনসিংহ'],
  madrasah: ['madrasah', 'madrasa', 'মাদ্রাসা', 'মাদ্রাসা বোর্ড', 'madrasah board'],
  technical: ['technical', 'কারিগরি', 'কারিগরি বোর্ড', 'bteb', 'technical board'],
  bteb: ['bteb', 'technical', 'বাংলাদেশ কারিগরি শিক্ষা বোর্ড', 'bteb board'],
  bou: ['bou', 'bangladesh open university', 'open university', 'বাংলাদেশ উন্মুক্ত বিশ্ববিদ্যালয়', 'উন্মুক্ত বিশ্ববিদ্যালয়', 'উন্মুক্ত'],

  // Bangladesh 64 Districts (Bilingual & Transliteration Equivalence)
  dist_dhaka: ['dhaka', 'ঢাকা'],
  dist_gazipur: ['gazipur', 'গাজীপুর'],
  dist_kishoreganj: ['kishoreganj', 'kishorganj', 'কিশোরগঞ্জ'],
  dist_manikganj: ['manikganj', 'মানিকগঞ্জ'],
  dist_munshiganj: ['munshiganj', 'মুন্সীগঞ্জ', 'মুন্সিগঞ্জ'],
  dist_narayanganj: ['narayanganj', 'নারায়ণগঞ্জ', 'নারায়নগঞ্জ'],
  dist_narsingdi: ['narsingdi', 'নরসিংদী'],
  dist_tangail: ['tangail', 'টাঙ্গাইল'],
  dist_faridpur: ['faridpur', 'ফরিদপুর'],
  dist_gopalganj: ['gopalganj', 'গোপালগঞ্জ'],
  dist_madaripur: ['madaripur', 'মাদারীপুর'],
  dist_rajbari: ['rajbari', 'রাজবাড়ী', 'রাজবাড়ি'],
  dist_shariatpur: ['shariatpur', 'শরীয়তপুর', 'শরীয়তপুর'],
  dist_chattogram: ['chattogram', 'chittagong', 'চট্টগ্রাম', 'চিটাগাং'],
  dist_coxsbazar: ["cox's bazar", 'coxsbazar', 'coxs bazar', 'কক্সবাজার'],
  dist_cumilla: ['cumilla', 'comilla', 'কুমিল্লা'],
  dist_feni: ['feni', 'ফেনী'],
  dist_brahmanbaria: ['brahmanbaria', 'ব্রাহ্মণবাড়িয়া', 'ব্রাহ্মণবাড়িয়া'],
  dist_rangamati: ['rangamati', 'রাঙ্গামাটি', 'রাঙামাটি'],
  dist_noakhali: ['noakhali', 'নোয়াখালী', 'নোয়াখালী'],
  dist_chandpur: ['chandpur', 'চাঁদপুর'],
  dist_lakshmipur: ['lakshmipur', 'laxmipur', 'লক্ষ্মীপুর'],
  dist_khagrachhari: ['khagrachhari', 'khagrachari', 'খাগড়াছড়ি', 'খাগড়াছড়ি'],
  dist_bandarban: ['bandarban', 'বান্দরবান'],
  dist_rajshahi: ['rajshahi', 'রাজশাহী'],
  dist_bogura: ['bogura', 'bogra', 'বগুড়া', 'বগুড়া'],
  dist_joypurhat: ['joypurhat', 'jaipurhat', 'জয়পুরহাট', 'জয়পুরহাট'],
  dist_naogaon: ['naogaon', 'নওগাঁ'],
  dist_natore: ['natore', 'নাটোর'],
  dist_chapainawabganj: ['chapainawabganj', 'chapai nawabganj', 'nawabganj', 'চাঁপাইনবাবগঞ্জ'],
  dist_pabna: ['pabna', 'পাবনা'],
  dist_sirajganj: ['sirajganj', 'সিরাজগঞ্জ'],
  dist_khulna: ['khulna', 'খুলনা'],
  dist_bagerhat: ['bagerhat', 'বাগেরহাট'],
  dist_chuadanga: ['chuadanga', 'চুয়াডাঙ্গা', 'চুয়াডাঙ্গা'],
  dist_jashore: ['jashore', 'jessore', 'যশোর'],
  dist_jhenaidah: ['jhenaidah', 'ঝিনাইদহ'],
  dist_kushtia: ['kushtia', 'কুষ্টিয়া', 'কুষ্টিয়া'],
  dist_magura: ['magura', 'মাগুরা'],
  dist_meherpur: ['meherpur', 'মেহেরপুর'],
  dist_narail: ['narail', 'নড়াইল', 'নড়াইল'],
  dist_satkhira: ['satkhira', 'সাতক্ষীরা'],
  dist_barishal: ['barishal', 'barisal', 'বরিশাল'],
  dist_barguna: ['barguna', 'বরগুনা'],
  dist_bhola: ['bhola', 'ভোলা'],
  dist_jhalokathi: ['jhalokathi', 'jhalakati', 'ঝালকাঠি'],
  dist_patuakhali: ['patuakhali', 'পটুয়াখালী', 'পটুয়াখালী'],
  dist_pirojpur: ['pirojpur', 'পিরোজপুর'],
  dist_sylhet: ['sylhet', 'সিলেট'],
  dist_habiganj: ['habiganj', 'হবিগঞ্জ'],
  dist_moulvibazar: ['moulvibazar', 'maulvibazar', 'মৌলভীবাজার'],
  dist_sunamganj: ['sunamganj', 'সুনামগঞ্জ'],
  dist_rangpur: ['rangpur', 'রংপুর'],
  dist_dinajpur: ['dinajpur', 'দিনাজপুর'],
  dist_gaibandha: ['gaibandha', 'গাইবান্ধা'],
  dist_kurigram: ['kurigram', 'কুড়িগ্রাম', 'কুড়িগ্রাম'],
  dist_lalmonirhat: ['lalmonirhat', 'লালমনিরহাট'],
  dist_nilphamari: ['nilphamari', 'নীলফামারী'],
  dist_panchagarh: ['panchagarh', 'পঞ্চগড়', 'পঞ্চগড়'],
  dist_thakurgaon: ['thakurgaon', 'ঠাকুরগাঁও'],
  dist_mymensingh: ['mymensingh', 'ময়মনসিংহ', 'ময়মনসিংহ'],
  dist_jamalpur: ['jamalpur', 'জামালপুর'],
  dist_netrokona: ['netrokona', 'netrakona', 'নেত্রকোণা', 'নেত্রকোনা'],
  dist_sherpur: ['sherpur', 'শেরপুর'],

  // Common Upazilas & Thanas
  thana_motihar: ['motihar', 'মতিহার', 'motihar thana', 'মতিহার থানা'],
  thana_boalia: ['boalia', 'বোয়ালিয়া', 'boalia thana', 'বোয়ালিয়া'],
  thana_sadar: ['sadar', 'সদর', 'kotwali', 'কোতোয়ালী', 'কোতয়ালী', 'sadar thana'],
  thana_dhanmondi: ['dhanmondi', 'ধানমন্ডি', 'ধানমণ্ডি'],
  thana_gulshan: ['gulshan', 'গুলশান'],
  thana_mirpur: ['mirpur', 'মিরপুর'],
  thana_uttara: ['uttara', 'উত্তরা'],
  thana_savar: ['savar', 'সাভার'],
  thana_tongi: ['tongi', 'টঙ্গী'],
  thana_bogra_sadar: ['bogra sadar', 'bogura sadar', 'বগুড়া সদর', 'বগুড়া সদর'],
  thana_puthia: ['puthia', 'পুঠিয়া', 'পুঠিয়া'],
  thana_bagmara: ['bagmara', 'বাগমারা'],
  thana_godagari: ['godagari', 'গোদাগাড়ী', 'গোদাগাড়ী'],
  thana_tanore: ['tanore', 'তানোর'],
  thana_mohanpur: ['mohanpur', 'মোহনপুর'],
  thana_charghat: ['charghat', 'চারঘাট'],
  thana_durgapur: ['durgapur', 'দুর্গাপুর'],

  // Results & GPA Scales
  result_gpa_5: [
    'gpa (out of 5.00)',
    'gpa (out of 5)',
    'gpa out of 5',
    'gpa-5',
    'gpa 5',
    'gpa 5.00',
    'scale 5',
    '5.00',
    'জিপিএ (৫.০০ এর মধ্যে)',
    'জিপিএ ৫',
    'gpa (scale 5.00)',
    'gpa(out of 5)',
  ],
  result_gpa_4: [
    'gpa (out of 4.00)',
    'gpa (out of 4)',
    'gpa out of 4',
    'gpa-4',
    'gpa 4',
    'gpa 4.00',
    'cgpa (out of 4.00)',
    'cgpa (out of 4)',
    'scale 4',
    '4.00',
    'সিজিপিএ (৪.০০ এর মধ্যে)',
    'জিপিএ ৪',
    'cgpa (scale 4.00)',
    'gpa(out of 4)',
  ],
  result_first_division: [
    'first division',
    '1st division',
    'প্রথম বিভাগ',
    'first class',
    '1st class',
    'প্রথম শ্রেণী',
    'first',
  ],
  result_second_division: [
    'second division',
    '2nd division',
    'দ্বিতীয় বিভাগ',
    'second class',
    '2nd class',
    'দ্বিতীয় শ্রেণী',
    'second',
  ],
  result_third_division: [
    'third division',
    '3rd division',
    'তৃতীয় বিভাগ',
    'third class',
    '3rd class',
    'তৃতীয় শ্রেণী',
    'third',
  ],
  result_passed: ['passed', 'pass', 'উত্তীর্ণ', 'pass course', 'degree pass'],

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
  if (!matched) return false;

  try {
    const prototype = window.HTMLSelectElement?.prototype;
    const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null;
    if (descriptor && descriptor.set) {
      descriptor.set.call(selectElement, matched.value);
    } else {
      selectElement.value = matched.value;
    }
  } catch {
    selectElement.value = matched.value;
  }

  selectElement.selectedIndex = matched.index;
  matched.selected = true;

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
