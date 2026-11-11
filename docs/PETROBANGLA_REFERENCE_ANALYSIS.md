# 📋 PetroBangla Reference Form Visual & Structural Analysis
**Document:** `docs/PETROBANGLA_REFERENCE_ANALYSIS.md`  
**Project:** JobFill BD — Smart Bangladesh Government Job Application Assistant  
**Reference Material:** 4 High-Resolution Screenshots of PetroBangla / BOGMC Application Form (`bogmc.teletalk.com.bd`)

---

## 1. Overview & Visual Layout Philosophy

The PetroBangla (BOGMC - Bangladesh Oil, Gas & Mineral Corporation) application form is a classic example of a modernised Teletalk-powered Bangladesh Government recruitment portal. It incorporates:
1. **Container Styling:** Soft green pill-shaped section headers (`#5f9a7c` / `#4d8468`) with clean white borders and red boundary highlighting for unvalidated / active form inputs.
2. **Two-Column Responsive Layouts:** For education levels, addresses, and physical details.
3. **Progressive Disclosure (Conditional Sections):** Higher degrees (`Graduation/Equivalent Level`, `Masters/Equivalent Level`) and `Job Experiences` are completely disabled (grayed out) until the applicant explicitly checks an `[ ] If Applicable` checkbox.
4. **Dependent Cascading Dropdowns:** Address sections require Division ➔ District ➔ Upazila cascading AJAX population.
5. **Exact Character Bounds:** The Job Experience description includes an explicit client-side 300-character counter.

---

## 2. Screenshot-by-Screenshot Field Inventory

### Screenshot 1: Basic Information Header & Demographics
- **Section Heading:** `Basic Information` (Green rounded container header)
- **Visual Border:** Light border with red active input outlines.

| # | Visible Field Label | HTML Control Type | Required / Status | Expected Data Format | Canonical Profile ID | Notes & Observations |
|---|---|---|---|---|---|---|
| 1 | `Applicant's Name` | `input[type="text"]` | Required | English UPPERCASE | `applicant.fullName.english` | Left-aligned, full width |
| 2 | `আবেদনকারীর নাম (বাংলায়)` | `input[type="text"]` | Required | Bengali Unicode | `applicant.fullName.bangla` | Placeholder matches label |
| 3 | `Father's Name` | `input[type="text"]` | Required | English UPPERCASE | `family.father.name.english` | Standard Teletalk format |
| 4 | `পিতার নাম (বাংলায়)` | `input[type="text"]` | Required | Bengali Unicode | `family.father.name.bangla` | Placeholder matches label |
| 5 | `Mother's Name` | `input[type="text"]` | Required | English UPPERCASE | `family.mother.name.english` | Standard Teletalk format |
| 6 | `মাতার নাম (বাংলায়)` | `input[type="text"]` | Required | Bengali Unicode | `family.mother.name.bangla` | Placeholder matches label |
| 7 | `Date of Birth` | `input[type="text"]` / `date` | Required | `DD-MM-YYYY` | `applicant.dateOfBirth` | Calendar picker icon on right |
| 8 | `Nationality` | `select` | Required | Enum (`Bangladeshi`) | `applicant.nationality` | Defaults to "Bangladeshi" |
| 9 | `Religion` | `select` | Required | Enum (`Islam`, `Hinduism`, etc.) | `applicant.religion` | Default option "Select" |
| 10 | `Gender` | `select` | Required | Enum (`Male`, `Female`, `Other`) | `applicant.gender` | Default option "Select" |
| 11 | `National ID` | `select` | Required | Yes/No dropdown | `identity.nationalId` | Selecting "Yes" opens text field |
| 12 | `Birth Registration` | `select` | Optional | Yes/No dropdown | `identity.birthRegistration` | Selecting "Yes" opens text field |
| 13 | `Passport ID` | `select` | Optional | Yes/No dropdown | `identity.passportNumber` | Selecting "Yes" opens text field |
| 14 | `Marital Status` | `select` | Required | Enum (`Single`, `Married`, etc.) | `applicant.maritalStatus` | Married reveals spouse name |
| 15 | `Mobile Number` | `input[type="text"]` | Required | 11-digit `01XXXXXXXXX` | `contact.mobile` | English numerals required |
| 16 | `Confirm Mobile Number` | `input[type="text"]` | Required | Must match mobile | `contact.confirmMobile` | Cross-field equality check |
| 17 | `Email` | `input[type="email"]` | Optional | Standard email address | `contact.email` | Lowercase email |
| 18 | `Quota` | `select` | Required | Enum (`Non-Quota`, `Freedom Fighter`, etc.) | `special.quota` | Default option "Select" |

---

### Screenshot 2: Departmental Status & Side-by-Side Address Containers
- **Section Heading 1:** `Basic Information` (Continued)
- **Section Heading 2:** `Present Address (বর্তমান ঠিকানা)` & `Permanent Address (স্থায়ী ঠিকানা)`
- **Special Control:** `[ ] Same as Present Address` checkbox positioned right above Permanent Address.

| # | Visible Field Label | HTML Control Type | Required / Status | Expected Data Format | Canonical Profile ID | Notes & Observations |
|---|---|---|---|---|---|---|
| 19 | `Departmental Status` | `select` | Required | Enum (`Govt`, `Semi-Govt`, `Autonomous`, `None`) | `special.departmentalStatus` | Default option "Select" |
| 20 | `Care Of` (Present) | `input[type="text"]` | Required | Text (Father/Guardian/Self) | `address.present.careOf` | In Left Address box |
| 21 | `Village/ Road/ House/ Flat` (Present) | `textarea` / `text` | Required | Multi-line or detailed text | `address.present.village` | Multi-line text field |
| 22 | `District` (Present) | `select` | Required | District Name (e.g. Dhaka) | `address.present.district` | Triggers AJAX for Upazila |
| 23 | `Upazila/P.S.` (Present) | `select` | Required | Upazila Name (e.g. Dhanmondi) | `address.present.upazila` | Populated dynamically |
| 24 | `Post Office` (Present) | `input[type="text"]` | Required | Text (e.g. Dhanmondi) | `address.present.postOffice` | Alphanumeric |
| 25 | `Post Code` (Present) | `input[type="text"]` | Required | 4-digit numeric (e.g. 1209) | `address.present.postCode` | Leading zeros preserved |
| 26 | `Care Of` (Permanent) | `input[type="text"]` | Required | Text | `address.permanent.careOf` | In Right Address box |
| 27 | `Village/ Road/ House/ Flat` (Permanent) | `textarea` / `text` | Required | Multi-line text | `address.permanent.village` | Multi-line text field |
| 28 | `District` (Permanent) | `select` | Required | District Name | `address.permanent.district` | Triggers AJAX for Upazila |
| 29 | `Upazila/P.S.` (Permanent) | `select` | Required | Upazila Name | `address.permanent.upazila` | Populated dynamically |
| 30 | `Post Office` (Permanent) | `input[type="text"]` | Required | Text | `address.permanent.postOffice` | Alphanumeric |
| 31 | `Post Code` (Permanent) | `input[type="text"]` | Required | 4-digit numeric | `address.permanent.postCode` | Leading zeros preserved |

---

### Screenshot 3: SSC, HSC, and Graduation Qualifications
- **Section Heading 1:** `SSC/Equivalent Level`
- **Section Heading 2:** `HSC/Equivalent Level/Diploma-in-Engineering`
- **Section Heading 3:** `Graduation/Equivalent Level` (Governed by `[ ] If Applicable` checkbox)

| # | Visible Field Label | Section Context | HTML Control Type | Required / Status | Expected Data Format | Canonical Profile ID |
|---|---|---|---|---|---|---|
| 32 | `Examination` | SSC | `select` | Required | Enum (`S.S.C`, `Dakhil`, `Vocational`) | `education.ssc.examination` |
| 33 | `Board` | SSC | `select` | Required | Enum (`Dhaka`, `Rajshahi`, `Technical`) | `education.ssc.board` |
| 34 | `Roll No` | SSC | `input[type="text"]` | Required | Numeric string (e.g. `142857`) | `education.ssc.roll` |
| 35 | `Result` | SSC | `select` | Required | Enum (`GPA (out of 5)`, `Div 1`) | `education.ssc.resultType` |
| 36 | `Group/Subject` | SSC | `select` | Required | Enum (`Science`, `Humanities`, `Commerce`) | `education.ssc.group` |
| 37 | `Passing Year` | SSC | `select` | Required | 4-digit year (e.g. `2014`) | `education.ssc.passingYear` |
| 38 | `Examination` | HSC | `select` | Required | Enum (`H.S.C`, `Alim`, `Diploma`) | `education.hsc.examination` |
| 39 | `Board` | HSC | `select` | Required | Enum (`Dhaka`, `Cumilla`, etc.) | `education.hsc.board` |
| 40 | `Roll No` | HSC | `input[type="text"]` | Required | Numeric string | `education.hsc.roll` |
| 41 | `Result` | HSC | `select` | Required | Enum (`GPA (out of 5)`) | `education.hsc.resultType` |
| 42 | `Group/Subject` | HSC | `select` | Required | Enum (`Science`, `Commerce`, etc.) | `education.hsc.group` |
| 43 | `Passing Year` | HSC | `select` | Required | 4-digit year (e.g. `2016`) | `education.hsc.passingYear` |
| 44 | `If Applicable` (Graduation) | Graduation | `input[type="checkbox"]` | Conditional Toggle | Boolean | `profile.hasGraduation` |
| 45 | `Examination` | Graduation | `select` | Conditional | Enum (`B.Sc Engineering`, `Honours`) | `education.graduation.examination` |
| 46 | `Subject/Degree` | Graduation | `select` | Conditional | Enum (`Computer Science`, `EEE`) | `education.graduation.subject` |
| 47 | `University/Inst.` | Graduation | `select` | Conditional | Enum (`Dhaka University`, `BUET`, etc.) | `education.graduation.university` |
| 48 | `Result` | Graduation | `select` | Conditional | Enum (`CGPA (out of 4)`) | `education.graduation.resultType` |
| 49 | `Passing Year` | Graduation | `select` | Conditional | 4-digit year (e.g. `2021`) | `education.graduation.passingYear` |
| 50 | `Course Duration` | Graduation | `select` | Conditional | Enum (`4 Years`, `3 Years`) | `education.graduation.courseDuration` |

---

### Screenshot 4: Masters, Job Experiences & Organization Choices
- **Section Heading 1:** `Masters/Equivalent Level` (Governed by `[ ] If Applicable` checkbox)
- **Section Heading 2:** `Job Experiences` (Governed by `[ ] If Applicable` checkbox and `[+ ADD MORE]` button)
- **Section Heading 3:** `Organization Choice` (BOGMC specific cadre/company choice)

| # | Visible Field Label | Section Context | HTML Control Type | Required / Status | Expected Data Format | Canonical Profile ID |
|---|---|---|---|---|---|---|
| 51 | `If Applicable` (Masters) | Masters | `input[type="checkbox"]` | Conditional Toggle | Boolean | `profile.hasMasters` |
| 52 | `Examination` | Masters | `select` | Conditional | Enum (`M.Sc`, `M.A`, `MBA`) | `education.masters.examination` |
| 53 | `Subject/Degree` | Masters | `select` | Conditional | Enum (`Computer Science`) | `education.masters.subject` |
| 54 | `University/Inst.` | Masters | `select` | Conditional | Enum (`DU`, `BUET`, etc.) | `education.masters.university` |
| 55 | `Result` | Masters | `select` | Conditional | Enum (`CGPA (out of 4)`) | `education.masters.resultType` |
| 56 | `Passing Year` | Masters | `select` | Conditional | 4-digit year (e.g. `2023`) | `education.masters.passingYear` |
| 57 | `Course Duration` | Masters | `select` | Conditional | Enum (`1 Year`, `2 Years`) | `education.masters.courseDuration` |
| 58 | `If Applicable` (Experience) | Experience | `input[type="checkbox"]` | Conditional Toggle | Boolean | `profile.hasJobExperience` |
| 59 | `+ ADD MORE` | Experience | `button` | Dynamic Action | Adds repeating row | Dynamic DOM |
| 60 | `Employed on` | Experience | `select` | Conditional | Enum (`Govt`, `Semi-Govt`, `Private`) | `experience[0].jobType` |
| 61 | `Organization` | Experience | `input[type="text"]` | Conditional | Company / Dept Name | `experience[0].organization` |
| 62 | `Designation/Post` | Experience | `input[type="text"]` | Conditional | Title (e.g. Assistant Engineer) | `experience[0].designation` |
| 63 | `Address` | Experience | `input[type="text"]` | Conditional | Work Location Address | `experience[0].address` |
| 64 | `Length of Service (From)` | Experience | `input[type="text"]` | Conditional | `DD-MM-YY` | `experience[0].startDate` |
| 65 | `Length of Service (To)` | Experience | `input[type="text"]` | Conditional | `DD-MM-YY` | `experience[0].endDate` |
| 66 | `CurrentlyWorking` | Experience | `input[type="checkbox"]`| Conditional | Boolean | `experience[0].currentlyWorking` |
| 67 | `Job Description` | Experience | `textarea` (300 char max)| Conditional | Text description | `experience[0].description` |
| 68 | `Organization Choice` | Preferences | `select` / `input` | Circular Specific | Preference Order 1, 2 | `circular.orgChoice1`, `circular.orgChoice2` |

---

## 3. Critical Architectural Takeaways

1. **Section Isolation Is Essential:**
   Fields like `Roll No`, `Examination`, `Board`, `Result`, and `Passing Year` exist under SSC, HSC, Graduation, and Masters with almost identical HTML labels. An engine matching solely on label text will cross-contaminate SSC and HSC data. The **Hierarchical Section Classifier (Layer 2)** is mandatory to isolate academic levels.

2. **Conditional Activation (Progressive Disclosure):**
   Before attempting to autofill Graduation, Masters, or Experience, the extension must programmatically verify whether the applicant has valid profile data for that section, and if so, click the `If Applicable` toggle to render the inputs active.

3. **Leading Zeros in Identifiers:**
   Roll numbers, registration numbers, postal codes, and mobile numbers frequently begin with zero (`0`). All storage and normalizers must treat these as strict strings, never converting them to JavaScript Numbers.

4. **Character Limit Guards:**
   The `Job Description` textarea has a hard 300-character ceiling. Any text exceeding 300 characters will cause server-side validation rejection on PetroBangla. The verification engine must enforce `slice(0, 300)` and warn the user.
