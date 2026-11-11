# 📋 JobFill BD — Smart Bangladesh Government Job Application Assistant
### পূর্ণাঙ্গ টেকনিক্যাল ও ব্যবহার নির্দেশিকা (Complete Technical & User Documentation)

---

## ১. প্রজেক্ট পরিচিতি ও উদ্দেশ্য (Project Overview & Mission)

**JobFill BD** হলো একটি নিরাপদ, বুদ্ধিমান ও আধুনিক Chrome Extension (Manifest V3), যা বাংলাদেশের বিভিন্ন সরকারি ও স্বায়ত্তশাসিত প্রতিষ্ঠানের অনলাইন নিয়োগ আবেদন ফর্ম স্বয়ংক্রিয়ভাবে ও নির্ভুলভাবে পূরণ করার উদ্দেশ্যে তৈরি করা হয়েছে।

### মূল দর্শন (Core Philosophy)
1. **One-Time Profile:** চাকরিপ্রার্থী একবার নিজের ব্যক্তিগত, পারিবারিক, শিক্ষাগত, স্থায়ী/বর্তমান ঠিকানা, চাকরির অভিজ্ঞতা এবং প্রয়োজনীয় ডকুমেন্টের বিবরণ সংরক্ষণ করবেন।
2. **Smart Field Detection:** ফর্মের HTML নাম, আইডি, লেবেল (বাংলা ও ইংরেজি), প্লেসহোল্ডার ও সেকশন কনটেক্সট স্বয়ংক্রিয়ভাবে স্ক্যান ও বিশ্লেষণ করে সঠিক ফিল্ড শনাক্তকরণ।
3. **Strict Candidate Safety (নো অটো-সাবমিট নীতি):** এক্সটেনশন কোনো অবস্থাতেই **Final Submit**, **Pay Now** কিংবা অপরিবর্তনীয় কোনো অ্যাকশনে ক্লিক করবে না। তথ্য যাচাই ও চূড়ান্ত সাবমিটের সম্পূর্ণ নিয়ন্ত্রণ থাকবে প্রার্থীর হাতে।
4. **Local-First & Encrypted Privacy:** ডিফল্টভাবে সমস্ত প্রোফাইল ও ডকুমেন্ট ইউজারের ব্রাউজারের `IndexedDB`-তে Web Crypto API (AES-256-GCM + PBKDF2 বা non-extractable device key) দিয়ে এনক্রিপ্ট হয়ে সংরক্ষিত থাকে। পাবলিক জব সার্কুলার সিঙ্ক শুধুমাত্র `credentials: 'omit'` মোডে পড়ে এবং ঐচ্ছিক ক্লাউড সিঙ্ক কেবল E2EE এনক্রিপ্টেড প্রোফাইল ব্যাকআপ সমর্থন করে (ডকুমেন্ট লোকাল-অনলি থাকে)।

---

## ২. প্রযুক্তিগত বিবরণ (Technology Stack)

| কম্পোনেন্ট | প্রযুক্তি | ব্যবহার ও ভূমিকা |
|---|---|---|
| **Extension Platform** | Chrome Extension Manifest V3 | আধুনিক ও নিরাপদ এক্সটেনশন আর্কিটেকচার |
| **Frontend Framework** | React 18 + TypeScript | রি-ইউজেবল, টাইপ-সেফ ইউজার ইন্টারফেস |
| **Build Tool** | Vite | আল্ট্রা-ফাস্ট বান্ডলার ও ডেভেলপমেন্ট সার্ভার |
| **Styling** | Tailwind CSS | আধুনিক ও রেসপনসিভ পেট্রোবাংলা/টেলিটক থিম |
| **Icons** | Lucide Icons | প্রিমিয়াম আধুনিক আইকন সেট |
| **Extension Storage** | Chrome Storage API (`chrome.storage.local`) | প্রোফাইল ও প্রেফারেন্স সংরক্ষণ |
| **Media/File Storage** | IndexedDB | ছবি, স্বাক্ষর ও সনদের বাইনারি ফাইল সংরক্ষণ |
| **Encryption** | Web Crypto API (AES-256-GCM + PBKDF2) | লোকাল ভল্ট এনক্রিপশন ও পাসওয়ার্ড প্রটেকশন |

---

## ৩. ডিরেক্টরি কাঠামো (Project Structure)

```
D:\Job form Fill-up extension\
├── package.json               ← প্রজেক্ট ডিপেনডেন্সি ও স্ক্রিপ্ট
├── tsconfig.json              ← TypeScript কনফিগারেশন
├── vite.config.ts             ← Vite বিল্ড কনফিগারেশন
├── tailwind.config.js         ← Tailwind স্টাইল থিম
├── postcss.config.js          ← PostCSS প্লাগইন কনফিগ
├── DOCUMENTATION.md           ← এই বিস্তারিত ডকুমেন্টেশন
├── manifest.json              ← Manifest V3 কনফিগ
├── dashboard.html             ← ফুল-ট্যাব প্রোফাইল ড্যাশবোর্ড
├── icons\                     ← এক্সটেনশন আইকনসমূহ (16x16, 48x48, 128x128)
├── src\
│   ├── types\
│   │   ├── profile.ts         ← প্রোফাইল ডেটা মডেল ও ফিল্ড টাইপস
│   │   └── defaults.ts        ← ডিফল্ট ও ডেমো প্রোফাইল টেমপ্লেট
│   ├── utils\
│   │   └── crypto.ts          ← PBKDF2 + AES-GCM-256 এনক্রিপশন সার্ভিস
│   ├── services\
│   │   ├── indexedDB.ts       ← ছবি ও ডকুমেন্টের IndexedDB ডেটাবেজ
│   │   └── storage.ts         ← মাল্টি-প্রোফাইল স্টোরেজ ও অটো-লক ম্যানেজার
│   ├── engine\
│   │   ├── fieldDictionary.ts ← বাংলা-ইংরেজি দ্বিভাষিক ফিল্ড অভিধান
│   │   ├── scorer.ts          ← ওয়েটেড ম্যাচিং স্কোরিং অ্যালগরিদম
│   │   ├── contextDetector.ts ← সেকশন কনটেক্সট ডিসঅ্যাম্বিগ্যুয়েশন (SSC vs HSC ইত্যাদি)
│   │   ├── dropdownMatcher.ts ← ড্রপডাউন ভ্যালু ও ডিপেনডেন্ট ড্রপডাউন ট্রাভার্সাল
│   │   └── formScanner.ts     ← ওয়েবপেজ ফর্ম স্ক্যানার ও ফিলিং ইঞ্জিন
│   ├── adapters\
│   │   ├── petrobangla.ts     ← পেট্রোবাংলা / BOGMC স্পেসিফিক অ্যাডাপ্টার
│   │   ├── teletalk.ts        ← টেলিটক অলজবস ও স্ট্যান্ডার্ড পোর্টাল অ্যাডাপ্টার
│   │   ├── bpsc.ts            ← বিপিএসসি (BCS Form-1) অ্যাডাপ্টার
│   │   └── generic.ts         ← সার্বজনীন ফলব্যাক অ্যাডাপ্টার
│   ├── content\
│   │   ├── content.ts         ← পেজে ইনজেক্ট হওয়া ইন্টারেক্টিভ অ্যাসিস্ট্যান্ট
│   │   └── content.css        ← অ্যাসিস্ট্যান্ট উইজেটের স্টাইল
│   ├── background\
│   │   └── background.ts      ← সার্ভিস ওয়ার্কার (আইকন ক্লিকে ড্যাশবোর্ড ওপেন)
│   └── dashboard\             ← রিঅ্যাক্ট ড্যাশবোর্ড SPA (৭টি ক্যাটাগরি, ভ্যালিডেশন, ব্যাকআপ)
└── test-pages\                ← লোকাল টেস্টিং ফর্মসমূহ
    ├── petrobangla-form.html  ← পেট্রোবাংলার হুবহু ৪টি স্ক্রিনশট রেপ্লিকা ফর্ম
    ├── teletalk-form.html     ← টেলিটক সিভি ফর্ম
    ├── bpsc-bcs-form.html     ← বিসিএস ফরম-১ সিমুলেশন
    └── dependent-dropdown.html← বিভাগ -> জেলা -> উপজেলা ডাইনামিক ড্রপডাউন টেস্ট
```

---

## ৪. প্রোফাইল ডেটাবেজ ও ফিল্ড তালিকা (Comprehensive Profile Fields)

### ক. ব্যক্তিগত তথ্য (Personal Information)
- **Applicant Name (English):** এসএসসির সনদ অনুযায়ী ক্যাপিটাল বা স্ট্যান্ডার্ড ফরম্যাট।
- **Applicant Name (Bangla):** আবেদনকারীর নাম বাংলায় (যেমন: মোঃ হাসান মাহমুদ)।
- **Father's Name (English & Bangla):** পিতার নাম ইংরেজি ও বাংলায়।
- **Mother's Name (English & Bangla):** মাতার নাম ইংরেজি ও বাংলায়।
- **Date of Birth:** জন্ম তারিখ (স্বয়ংক্রিয়ভাবে DD-MM-YYYY ও YYYY-MM-DD ফরম্যাটে কনভার্ট হয়)।
- **Gender:** Male (পুরুষ), Female (মহিলা), Other।
- **Nationality:** Bangladeshi (ডিফল্ট)।
- **Religion:** Islam, Hinduism, Christianity, Buddhism, Other।
- **National ID / Smart Card:** ১০, ১৩ বা ১৭ ডিজিটের এনআইডি নম্বর।
- **Birth Registration Number:** ১৭ ডিজিটের জন্ম নিবন্ধন নম্বর।
- **Passport Number & Expiry Date:** পাসপোর্ট নম্বর এবং মেয়াদ উত্তীর্ণের তারিখ।
- **Marital Status:** Single, Married, Divorced, Widowed।
- **Spouse Name (English & Bangla):** বিবাহিত হলে স্বামী/স্ত্রীর নাম উভয় ভাষায়।
- **Mobile Number:** ব্যক্তিগত মোবাইল নম্বর (টেলিটক বা অন্যান্য অপারেটর)।
- **Confirm Mobile Number:** ভুল এড়াতে কনফার্মেশন মোবাইল নম্বর।
- **Email Address:** প্রার্থীর সক্রিয় ইমেইল ঠিকানা।
- **Quota:** General (সাধারণ), Freedom Fighter (মুক্তিযোদ্ধা), Child/Grandchild of FF, District (জেলা), Women (মহিলা), Tribal (ক্ষুদ্র নৃ-গোষ্ঠী), Disabled (প্রতিবন্ধী), Ansar VDP, Orphan (এতিম)।
- **Departmental Status:** No, Yes (Government / Semi-Government / Autonomous Body)।
- **Employment Status:** প্রার্থীর বর্তমান চাকরির অবস্থা।

### খ. ঠিকানার বিবরণ (Address Information)
- **Present Address (বর্তমান ঠিকানা):**
  - Care Of (প্রযত্নে / অভিভাবকের নাম)
  - Village / Road / House / Flat (গ্রাম/সড়ক/বাড়ি/ফ্ল্যাট)
  - Division (বিভাগ)
  - District (জেলা)
  - Upazila / Police Station (উপজেলা / থানা)
  - Post Office (ডাকঘর)
  - Post Code (পোস্ট কোড)
- **Permanent Address (স্থায়ী ঠিকানা):**
  - "Same as Present Address" চেকবক্স (টিক দিলেই বর্তমান ঠিকানার সমস্ত তথ্য স্বয়ংক্রিয়ভাবে কপি ও লক হয়ে যাবে)।
  - আলাদা স্থায়ী ঠিকানা থাকলে স্বতন্ত্রভাবে পূরণযোগ্য।

### গ. শিক্ষাগত যোগ্যতা (Academic Qualifications)
1. **SSC / Equivalent (এসএসসি / সমমান):**
   - Examination (SSC, Dakhil, O Level, Vocational, Equivalent)
   - Board (Dhaka, Chittagong, Rajshahi, Khulna, Barisal, Sylhet, Comilla, Jessore, Dinajpur, Mymensingh, Madrasah, Technical, BTEB)
   - Roll Number
   - Registration Number
   - Group / Subject (Science, Humanities, Commerce, General)
   - Result Type (GPA out of 5, First Division, Second Division)
   - GPA (সংখ্যায়, যেমন: 5.00)
   - Passing Year (পাসের সন)
   - Institution Name (বিদ্যালয়ের নাম)

2. **HSC / Equivalent / Diploma-in-Engineering (এইচএসসি / ডিপ্লোমা):**
   - Examination (HSC, Alim, A Level, Diploma in Engineering, Equivalent)
   - Board / Technical Board
   - Roll, Registration, Group, Result/GPA, Passing Year, Institution Name।

3. **Graduation / Honours / Equivalent (স্নাতক / সমমান):**
   - Examination (B.Sc Engineering, B.Sc Hons, B.A Hons, B.B.A, B.S.S, Honours, Degree Pass, MBBS, B.Sc Agri)
   - Subject / Department / Major (যেমন: Computer Science & Engineering)
   - University / Institute (যেমন: University of Dhaka)
   - College / Faculty
   - Roll Number, Registration Number, Session
   - Result Type (CGPA out of 4, First Class, Second Class, Appeared)
   - CGPA (যেমন: 3.82)
   - Passing Year
   - Course Duration (3 Years, 4 Years, 5 Years)
   - Appeared Candidate Status (পরীক্ষা দিয়েছেন কিন্তু ফল প্রকাশ হয়নি কিনা)
   - Exam Start Date & End Date

4. **Masters / Equivalent (স্নাতকোত্তর / সমমান):**
   - স্নাতক বিভাগের অনুরূপ কাঠামো + কোর্স ডিউরেশন (১ বছর, ১.৫ বছর, ২ বছর)।

5. **PhD / Post-Doctorate & Professional Certifications:**
   - পিএইচডি বিষয়, বিশ্ববিদ্যালয়, সন ও দেশ।
   - প্রফেশনাল ট্রেনিং ও আইটি স্কিলস (PMP, CCNA, Oracle, IELTS ইত্যাদি)।

### ঘ. চাকরির অভিজ্ঞতা (Job Experience)
একাধিক চাকরির তথ্য যোগ করার সুবিধা:
- Employed On (Government, Semi-Government, Autonomous, Private, NGO, Contractual)
- Organization Name (প্রতিষ্ঠানের নাম)
- Designation / Post (পদবী)
- Organization Address (অফিসের ঠিকানা)
- Service From & Service To (চাকরির মেয়াদ শুরুর ও শেষের তারিখ)
- Currently Working Checkbox (বর্তমানে কর্মরত কিনা)
- Salary (বর্তমান বা শেষ বেতন)
- Job Description (কাজের সংক্ষিপ্ত বিবরণ, ৩০০ অক্ষরের মধ্যে)

### ঙ. বিশেষ তথ্য ও বিসিএস ফিল্ড (Special & BCS Fields)
- Height (cm), Weight (kg), Chest (cm)
- Blood Group (A+, B+, O+, AB+ ইত্যাদি)
- Examination Centre (পরীক্ষা কেন্দ্র)
- Question Version (Bangla / English)
- Cadre Preference & Non-Cadre Preference
- Post Related Subject Code
- Freedom Fighter Certificate & Gazette Number
- Disability Type, Percentage & Certificate No.
- Organization Choice (পেট্রোবাংলার ক্ষেত্রে প্রথম ও দ্বিতীয় পছন্দ)

### চ. রেফারেন্স (References)
- Reference 1 & 2: নাম, পদবী, প্রতিষ্ঠান, মোবাইল নম্বর, ইমেইল ও ঠিকানা।

---

## ৫. স্মার্ট ফিল্ড ডিটেকশন ও ম্যাচিং ইঞ্জিন (Smart Matching Engine)

### ফিল্ড শনাক্তকরণের স্তরসমূহ (Multi-Layer Detection)
এক্সটেনশন পেজের যেকোনো ইনপুট ফিল্ডকে নিম্নোক্ত প্যারামিটার দ্বারা স্ক্যান করে:
1. `name` এবং `id` অ্যাট্রিবিউট
2. অ্যাসোসিয়েটেড `<label for="...">` টেক্সট
3. প্যারেন্ট বা পূর্ববর্তী কনটেইনারের টেক্সট ও হেডিং
4. `placeholder` এবং `aria-label`
5. ড্রপডাউনের `<option>` ভ্যালু ও টেক্সট
6. সেকশন কনটেক্সট (Section Boundary Context)

### ওয়েটেড স্কোরিং সিস্টেম (Weighted Scoring Matrix)
| ম্যাচিং টাইপ | স্কোরিং পয়েন্ট |
|---|---|
| হুবহু HTML name ম্যাচ | **১০০** |
| হুবহু HTML id ম্যাচ | **১০০** |
| হুবহু Label টেক্সট ম্যাচ | **৯৫** |
| দ্বিভাষিক (বাংলা/ইংরেজি) অ্যালিয়াস ম্যাচ | **৯৫** |
| Placeholder টেক্সট ম্যাচ | **৮৫** |
| ARIA Label ম্যাচ | **৮৫** |
| প্যারেন্ট সেকশন কনটেক্সট ভেরিফিকেশন | **৭৫** |
| নিকটস্থ টেক্সট / লিজেন্ড ম্যাচ | **৬৫** |

### কনটেক্সচুয়াল ডিসঅ্যাম্বিগ্যুয়েশন (Contextual Disambiguation)
- **"Name" ফিল্ডের বৈচিত্র্য:** ফর্মের কোনো ফিল্ডে শুধু `Name` থাকলে এক্সটেনশন সরাসরি আবেদনকারীর নাম বসাবে না। সে পরীক্ষা করবে এটি পিতা, মাতা, অভিভাবক নাকি প্রতিষ্ঠানের নাম সেকশনে অবস্থিত।
- **"Roll / Result" ফিল্ডের বিভাজন:** এসএসসির সেকশনের রোল নম্বর যেন কোনোভাবেই এইচএসসি বা অনার্সের রোলে না বসে, তার জন্য সেকশন হেডার (`SSC/Equivalent`, `HSC/Equivalent`, `Graduation Level`) কঠোরভাবে যাচাই করা হয়।

### কনফিডেন্স লেভেল (Confidence Tiers)
- 🟢 **HIGH (উচ্চ আস্থা - ৮৫+ স্কোর):** ফিল্ড ও সেকশন দুটোই নিশ্চিত হলে প্রি-অ্যাপ্রুভড হিসেবে দেখাবে।
- 🟡 **MEDIUM (মাঝারি আস্থা - ৬৫-৮৪ স্কোর):** কিছুটা অস্পষ্টতা থাকলে রিভিউ মডালে প্রার্থীর দৃষ্টি আকর্ষণ করবে।
- 🔴 **LOW (স্বল্প আস্থা - ৬৫ এর নিচে):** কোনো অনুমান করবে না; ম্যানুয়াল ড্রপডাউন সিলেকশন দেবে।

---

## ৬. ড্রপডাউন ও ডিপেনডেন্ট ড্রপডাউন হ্যান্ডলিং (Dropdown Matching)

### বাংলা-ইংরেজি ইকুইভ্যালেন্স ম্যাপিং:
- শিক্ষা বোর্ড: `Dhaka` = `ঢাকা`, `Chittagong` = `চট্টগ্রাম` ইত্যাদি।
- লিঙ্গ: `Male` = `পুরুষ`, `Female` = `মহিলা`।
- বৈবাহিক অবস্থা: `Single` = `অবিবাহিত` = `Unmarried`, `Married` = `বিবাহিত`।
- কোটা: `Freedom Fighter` = `মুক্তিযোদ্ধা`, `General` = `সাধারণ`।
- জেলা: বাংলাদেশের ৬৪টি জেলার ইংরেজি ও বাংলা উভয় নামেই স্মার্ট নরমালাইজড ম্যাচিং।

### ডিপেনডেন্ট ড্রপডাউন (Dependent Cascading Dropdowns):
- **ক্রম:** বিভাগ (Division) ➔ জেলা (District) ➔ উপজেলা/থানা (Upazila/Thana)।
- **কার্যপদ্ধতি:** বিভাগ সিলেক্ট করে `change` ইভেন্ট ট্রিগার করা হয়। এরপর DOM আপডেট হওয়ার জন্য অপেক্ষা করে সংশ্লিষ্ট জেলার ড্রপডাউন পপুলেট হলে জেলা নির্বাচন করা হয়। একই প্রক্রিয়ায় পরবর্তী ড্রপডাউন পূরণ হয়।

---

## ৬.১ অ্যাডাপ্টিভ ম্যাপিং মেমরি ও কন্ডিশনাল রিভিল (Adaptive Memory & Dynamic Reveals)

### ক. অ্যাডাপ্টিভ ম্যাপিং মেমরি (Adaptive Mapping Memory — Part L):
- অপরিচিত বা কাস্টম পোর্টালে কোনো ফিল্ড ইউজার রিভিউ মডালে একবার কনফার্ম বা এডিট করলে এক্সটেনশনটি ফিল্ডের কাঠামোগত ফিঙ্গারপ্রিন্ট (`domain::section::tagName:type::normalizedLabel`) ব্রাউজারে মেমরি হিসেবে সেভ করে।
- পরবর্তী সময়ে ঐ ওয়েবসাইটের ফর্মে আসলে এক্সটেনশন ১০০% কনফিডেন্স স্কোর দিয়ে সাথে সাথে ম্যাচ করে।
- **জিরো পার্সোনাল ডেটা নীতি:** ম্যাপিং মেমরিতে প্রার্থীর কোনো নাম, ফোন বা সংবেদনশীল ডেটা থাকে না—শুধুমাত্র ফিল্ডের কাঠামোগত লিংক সংরক্ষিত হয়।

### খ. ডাইনামিক ফিল্ড রিভিল ও কন্ডিশনাল চেকবক্স (Conditional Field Reveals):
- প্রার্থীর প্রোফাইলে স্নাতক, স্নাতকোত্তর বা চাকরির অভিজ্ঞতা থাকলে পেট্রোবাংলা/টেলিটক পেজের "If Applicable" চেকবক্সগুলো স্বয়ংক্রিয়ভাবে সক্রিয় হয়ে লুকানো ফিল্ডগুলো উন্মোচন করে।
- "Do you have NID? / Birth Reg? / Passport?" ড্রপডাউনে "Yes" সেট করে টেক্সট ইনপুট দৃশ্যমান করে।
- পেট্রোবাংলা "Organization Choice" ১ম ও ২য় পছন্দ স্বয়ংক্রিয়ভাবে ম্যাপ করে।

---

## ৬.২ অটোমেটেড ইউনিট টেস্ট সুইট (Automated Unit & Integration Test Suite)

প্রজেক্টের মূল ইঞ্জিনসমূহ এবং ৮টি অ্যাডভান্সড ইন্টেলিজেন্স মডিউলের নির্ভুলতা প্রমাণের জন্য ৯টি টেস্ট ফাইলে মোট **৪৩টি স্বয়ংক্রিয় টেস্ট** তৈরি করা হয়েছে:
- `tests/unit/canonicalSchema.test.ts`: Zod স্কিমা ভ্যালিডেশন ও পার্মানেন্ট বনাম সার্কুলার তথ্যের পৃথকীকরণ।
- `tests/unit/valueNormalizer.test.ts`: বাংলা সংখ্যা (`০-৯` -> `0-9`), ফোন ও সরকারি ডেট ফরম্যাটিং।
- `tests/unit/fiveLayers.test.ts`: বুদ্ধিমত্তার ৫টি স্তরের (Semantic, Context, Matching, Dynamic, Verification) সমন্বিত টেস্ট।
- `tests/unit/finalIntelligenceExpansion.test.ts`: নতুন ৮টি ইন্টেলিজেন্স মডিউলের এন্ড-টু-এন্ড টেস্ট (Cross-field, Graph, Schema, Multi-pass, Transaction, Change detection, Error analyzer, Calibration)।
- `tests/unit/scorer.test.ts`: ১০০ পয়েন্ট ম্যাচিং ও সেকশন কনটেক্সট পেনাল্টি যাচাই।
- `tests/unit/contextDetector.test.ts`: বাংলা ও ইংরেজি হেডার ক্লাসিফিকেশন (SSC, HSC, অনার্স, ঠিকানা, অভিজ্ঞতা)।
- `tests/unit/dropdownMatcher.test.ts`: দ্বিভাষিক অপশন ম্যাচিং ও নেটিভ ইভেন্ট ডিসপ্যাচ।
- `tests/unit/crypto.test.ts`: PBKDF2 (100,000 Iterations) ও AES-256-GCM এনক্রিপশন/ডিক্রিপশন রাউন্ডট্রিপ।
- `tests/unit/mappingMemory.test.ts`: ফিঙ্গারপ্রিন্ট জেনারেশন ও কনফার্মেশন রিট্রিভাল।

কমান্ড চালিয়ে টেস্ট দেখার নিয়ম:
```bash
npm run test
```
*(বর্তমানে ৪৩/৪৩টি টেস্টই সফলভাবে পাস করেছে।)*

---

## ৬.৩ ফাইনাল ইন্টেলিজেন্স সংযোজন (Final Intelligence Add-ons)
1. **Cross-Field Consistency:** বয়স ও জন্মতারিখের সংগতি (১৮-৪৫ বছর), মোবাইল ও কনফার্ম মোবাইল সমতা, এবং শিক্ষাগত পাসের সনের কালানুক্রমিক ধারা (`SSC < HSC < Graduation < Masters`) যাচাই করে অসংগতিতে সতর্কতা প্রদর্শন।
2. **Field Relationship Graph:** ক্যানোনিকাল ফিল্ডসমূহের মধ্যে প্যারেন্ট গ্রুপ ও ডিপেনডেন্সি গ্রাফ (`belongs_to`, `depends_on`) তৈরি করে অ্যারে ইনডেক্সের ভ্রান্তি রোধ।
3. **Full Form Schema Engine:** সমগ্র ফর্মের স্ট্রাকচারাল ব্লুপ্রিন্ট (মেইন সেকশন, বাধ্যতামূলক বনাম ঐচ্ছিক ফিল্ড, শর্তসাপেক্ষ লুকানো ফিল্ড) বিশ্লেষণ।
4. **Multi-Pass Detection:** ৭টি সুনির্দিষ্ট ধাপে (এলিমেন্ট আবিষ্কার ➔ ১২টি প্রমাণ নিষ্কাশন ➔ কনটেক্সট ➔ সিম্যান্টিক ম্যাচ ➔ দ্ব্যর্থবোধকতা সমাধান ➔ ভ্যালিডেশন ➔ অডিট রিপোর্ট) সম্পূর্ণ ফর্ম স্ক্যান।
5. **Transactional Form Filling & Rollback:** ডিপেনডেন্সি অর্ডারে আণবিক ট্রানজ্যাকশন হিসেবে ফিল্ড পূরণ, আইডেম্পোটেন্সি চেক এবং এক ক্লিকে সম্পূর্ণ ফর্মে আগের আসল মান অক্ষতভাবে পুনরুদ্ধার (Rollback)।
6. **Website Schema Change Detection:** সংরক্ষিত ফিঙ্গারপ্রিন্টের সাথে লাইভ DOM তুলনা করে ওয়েবসাইটের স্ট্রাকচারাল ড্রিফট চিহ্নিত করে পুরনো ম্যাপিং স্থগিতকরণ।
7. **Site Validation Error Intelligence:** রিক্রুটমেন্ট ওয়েবসাইটের ক্লায়েন্ট-সাইড এরর মেসেজ স্ক্যান করে আক্রান্ত ফিল্ডের কারণ ও সমাধানের সুপারিশ প্রদান।
8. **Quality Calibration Engine:** প্রিসিশন, রিকল ও একিউরেসি স্কোর ট্র্যাকিং।

---

## ৭. ছবি ও স্বাক্ষর আপলোড নীতিমালা (Photo & Signature Specifications)

| বিষয় | পাসপোর্ট সাইজ ছবি (Photo) | প্রার্থীর স্বাক্ষর (Signature) |
|---|---|---|
| **স্ট্যান্ডার্ড ডাইমেনশন** | **300 × 300 পিক্সেল** | **300 × 80 পিক্সেল** |
| **সর্বোচ্চ ফাইল সাইজ** | **100 KB** (অনূর্ধ্ব) | **60 KB** (অনূর্ধ্ব) |
| **অনুমোদিত ফরম্যাট** | `.jpg`, `.jpeg` | `.jpg`, `.jpeg` |
| **ব্যাকগ্রাউন্ড** | পরিষ্কার সাদা / হালকা একরঙা | সাদা কাগজে কালো/নীল কালির স্পষ্ট স্বাক্ষর |

> [!IMPORTANT]
> ব্রাউজার সিকিউরিটি পলিসি অনুযায়ী কোনো এক্সটেনশন ব্যবহারকারীর অনুমোদন ছাড়া সিস্টেমে সংরক্ষিত ফাইল নিজে থেকে আপলোড করতে পারে না। JobFill BD প্রার্থীর সেভ করা ফটো/সিগনেচারের সাইজ ও মাপ স্বয়ংক্রিয়ভাবে যাচাই করে দেবে এবং প্রার্থীর নিশ্চিতকরণের পরই ফাইল ইনপুটে বসাবে।

---

## ৮. নিরাপত্তা, এনক্রিপশন ও গোপনীয়তা (Security & Privacy Model)

1. **লোকাল-ফার্স্ট স্টোরেজ (Local-First Vault):** আপনার ব্যক্তিগত প্রোফাইল, শিক্ষা/অভিজ্ঞতা ও ডকুমেন্ট ব্রাউজারের লোকাল IndexedDB-তে AES-256-GCM এনক্রিপশনে থাকে। পাবলিক জব সার্কুলার আনতে ইন্টারনেট সংযোগ প্রয়োজন (শুধু পঠনযোগ্য `GET`, কোনো ব্যক্তিগত তথ্য ছাড়া)। Microsoft Edge Store r2.0.0 রিলিজে ঐচ্ছিক ক্লাউড সিঙ্ক নিষ্ক্রিয় রাখা হয়েছে।
2. **মাস্টার পাসওয়ার্ড এনক্রিপশন:**
   - অ্যালগরিদম: **AES-256-GCM** (Galois/Counter Mode)।
   - কী-ডেরাইভেশন: **PBKDF2** (100,000 ইটারেশন, SHA-256 হ্যাশিং, ইউনিক ১৬-বাইট সল্ট)।
3. **অটো-লক মেকানিজম:** নিষ্ক্রিয়তার নির্দিষ্ট সময় পর (যেমন: ১৫ মিনিট) ভল্ট স্বয়ংক্রিয়ভাবে লক হয়ে যায়।
4. **ব্যাকআপ ও রিস্টোর:** এনক্রিপ্টেড বা প্লেইনটেক্সট ফরম্যাটে JSON ফাইল হিসেবে সম্পূর্ণ প্রোফাইল ব্যাকআপ ডাউনলোড ও যেকোনো সময় রিস্টোর করা যায়।
5. **কমপ্লিট পার্জ অপশন:** এক ক্লিকে ব্রাউজারে সংরক্ষিত সমস্ত ডেটা স্থায়ীভাবে মুছে ফেলা সম্ভব।

---

## ৯. ক্যাপচা (CAPTCHA) ও ওটিপি (OTP) সংক্রান্ত নিরাপত্তা নীতি

- এক্সটেনশনটি কোনো প্রকার **CAPTCHA সমাধান করবে না** এবং **Bypass করার চেষ্টা করবে না**।
- এসএমএস **OTP কোড** প্রার্থীকে নিজে যাচাই করে টাইপ করতে হবে।
- সরকারি চাকরির ওয়েবসাইটের নিরাপত্তা ব্যবস্থায় কোনো ধরনের হস্তক্ষেপ করা হয় না।

---

## ১০. কীভাবে ইনস্টল ও রান করবেন (Installation & Setup Guide)

### ধাপ ১: রিপোজিটরি বিল্ড করা
প্রজেক্ট ফোল্ডারে টার্মিনাল খুলে কমান্ড রান করুন:
```bash
cd "D:\Job form Fill-up extension"
npm install
npm run build
```
এটি `dist` ডিরেক্টরিতে কমপ্লিট অপটিমাইজড এক্সটেনশন বান্ডল তৈরি করবে।

### ধাপ ২: Chrome-এ এক্সটেনশন লোড করা
1. গুগল ক্রোম ব্রাউজার ওপেন করুন।
2. অ্যাড্রেস বারে যান: `chrome://extensions/`
3. উপরে ডান পাশে **Developer mode** টগলটি **ON** করুন।
4. **Load unpacked** বাটনে ক্লিক করুন।
5. এই ফোল্ডারটি সিলেক্ট করুন:
   ```
   D:\Job form Fill-up extension\dist
   ```
   *(অথবা ডেভেলপমেন্ট চলাকালীন সরাসরি `D:\Job form Fill-up extension`)*
6. ক্রোম টুলবারে পাজল আইকন (🧩) থেকে **JobFill BD** পিন করুন।

### ধাপ ৩: প্রোফাইল তৈরি ও ব্যবহার
1. এক্সটেনশন আইকনে ক্লিক করলেই সম্পূর্ণ ড্যাশবোর্ড নতুন ট্যাবে খুলবে (`dashboard.html`)।
2. আপনার তথ্যগুলো একবার পূরণ করে **Save Profile** চাপুন।
3. যেকোনো চাকরির আবেদন পেজে যান (বা আমাদের তৈরি টেস্ট পেজে যান)।
4. পেজের নিচে-ডানে **JobFill BD Assistant** ভাসমান উইজেট দেখতে পাবেন।
5. **Scan & Fill Application** এ চাপ দিন ➔ রিভিউ স্ক্রিনে অনুমোদিত ফিল্ডগুলো দেখে **Fill Approved Fields** চাপুন!

---

## ১১. অন্তর্নির্মিত টেস্ট পেজসমূহ (Included Local Test Suite)

এক্সটেনশনের নির্ভুলতা যাচাইয়ের জন্য `test-pages/` ফোল্ডারে নিম্নলিখিত ডেমো ফর্মগুলো দেওয়া আছে:
- `petrobangla-form.html`: পেট্রোবাংলা নিয়োগ বিজ্ঞপ্তির হুবহু ৪টি স্ক্রিনশটের ফর্ম।
- `teletalk-form.html`: টেলিটক অলজবস স্ট্যান্ডার্ড ফর্ম।
- `bpsc-bcs-form.html`: বিসিএস ৪৭তম ফরম-১ সিমুলেশন।
- `dependent-dropdown.html`: বিভাগ ➔ জেলা ➔ উপজেলা রিয়েল-টাইম ক্যাসকেডিং ড্রপডাউন টেস্ট।

---
*JobFill BD — উন্নত ও আধুনিক বাংলাদেশ বিনির্মাণে চাকরিপ্রার্থীদের জন্য একটি নিরাপদ ও নির্ভরযোগ্য ডিজিটাল সহকারী।*
