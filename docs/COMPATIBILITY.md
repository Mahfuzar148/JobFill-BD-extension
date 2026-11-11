# 🌐 JobFill BD — Website Compatibility & Portal Matrix
**Document:** `docs/COMPATIBILITY.md`  
**Version:** 2.0.0  
**Target:** Bangladesh Government Recruitment Ecosystem  

---

## 1. Recruitment Portal Compatibility Matrix

| Recruitment Portal / Authority | Primary Domain Pattern | Adapter Engine | Tested Status | Key Capabilities & Notes |
|---|---|---|---|---|
| **Petrobangla / BOGMC** | `bogmc.teletalk.com.bd`, `petrobangla.org.bd` | `PetroBanglaAdapter` | **TESTED SUPPORT** | 2-Choice organization ranking, 300-char experience limits, If Applicable toggles. |
| **Titas Gas T&D Co. Ltd.** | `titasgas.teletalk.com.bd` | `PetroBanglaAdapter` | **TESTED SUPPORT** | Energy sector field signatures, qualification cascades. |
| **BGFCL / SGFL / RPGCL / BAPEX** | `*.teletalk.com.bd` | `PetroBanglaAdapter` | **TESTED SUPPORT** | Oil & gas company post selection, reference contact matching. |
| **Teletalk Alljobs Recruitment** | `alljobs.teletalk.com.bd` | `TeletalkAdapter` | **TESTED SUPPORT** | Cascading Division ➔ District ➔ Upazila, Alljobs ID detection, Quota handling. |
| **BPSC (Public Service Commission)** | `bpsc.teletalk.com.bd` | `BPSCAdapter` | **TESTED SUPPORT** | Cadre / Non-cadre preference, Physical measurements (height, weight, chest), exam centre selection. |
| **Government Ministries & Directorates** | `*.gov.bd`, `*.teletalk.com.bd` | `TeletalkAdapter` / `GenericAdapter` | **COMPATIBLE** | Ministry-specific recruitment forms auto-classified via 12-evidence scanner. |
| **Autonomous & Semi-Autonomous Bodies** | Various `.org.bd` / `.ac.bd` | `GenericAdapter` | **COMPATIBLE** | University and statutory corporation recruitment pages. |
| **Browser Internal Pages (`chrome://*`, Web Store)** | `chrome://*`, `chrome.google.com` | N/A | **RESTRICTED** | Browser security prohibits content scripts. Clear unsupported notice shown. |

---

## 2. Frontend Framework Compatibility

Bangladesh recruitment portals utilize various legacy and modern web frameworks. JobFill BD is engineered to support all of them:

1. **Standard HTML5 / Server-Rendered PHP Forms:**  
   Standard input fields, tables, and native selects (e.g. traditional Teletalk portals).
2. **React Controlled Inputs:**  
   Bypasses React's internal synthetic event cache using native prototype descriptor setters (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`), followed by bubbled `input` and `change` dispatch.
3. **Vue.js / Angular Controlled Forms:**  
   Dispatches standard input events to trigger two-way `v-model` and `[(ngModel)]` updates.
4. **AJAX / jQuery Cascading Dropdowns:**  
   Uses `MutationObserver` with debounced timers to wait for server responses before selecting child dropdown options (e.g., District loading Upazilas).

---

## 3. Supported & Unsupported Capabilities

### Fully Supported:
- Identification of Bengali Unicode, English, and Romanized labels.
- Resolution of ambiguous fields using enclosing section headers.
- Automatic checking of `[ ] If Applicable` toggles when applicant profile contains data.
- Detection of pre-existing values to prevent silent overwriting.
- Conversion of Bengali digits (`০-৯`) to English (`0-9`) for numeric fields.
- Non-destructive session undo and rollback.

### Strictly Unsupported (By Safety Philosophy):
- Automated clicking of "Final Submit" or "Submit Application" buttons.
- Automated payment of application fees via bKash, Rocket, or Teletalk SMS.
- Automated solving or bypassing of CAPTCHA images or mathematical challenges.
- Automated processing or intercepting of SMS OTP codes.
- Guessing or inventing missing personal information not provided by the user.
