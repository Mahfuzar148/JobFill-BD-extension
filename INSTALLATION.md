# 🇧🇩 JobFill BD — Chrome Local Installation Guide

**Product:** JobFill BD — Smart Bangladesh Government Job Application Assistant  
**Platform:** Google Chrome (Manifest V3)  
**Target Environment:** 100% Free / Local Development & Personal Use  
**No Chrome Web Store Registration or $5 Fee Required**  

---

## 📍 Exact Installation Folder Path

The exact unpacked production folder to select in Chrome is:

```text
D:\Job form Fill-up extension\dist
```

---

## 🚀 Step-by-Step Installation Instructions

### ধাপ ১: গুগল ক্রোম ওপেন করুন
আপনার কম্পিউটারে Google Chrome ব্রাউজারটি ওপেন করুন।

### ধাপ ২: Extensions পেজে যান
ক্রোম অ্যাড্রেস বারে নিচের লিংকটি টাইপ করে **Enter** চাপুন:
```text
chrome://extensions
```

### ধাপ ৩: Developer Mode অন করুন
পৃষ্ঠার একদম উপরের ডান কোণায় **"Developer mode"** (ডেভেলপার মোড) টগল সুইচটি চালু (ON) করে দিন।

### ধাপ ৪: Load unpacked-এ ক্লিক করুন
পৃষ্ঠার উপরের বাম কোণায় আবির্ভূত হওয়া **"Load unpacked"** (লোড আনপ্যাকড) বাটনে ক্লিক করুন।

### ধাপ ৫: `dist` ফোল্ডার নির্বাচন করুন
ফোল্ডার সিলেক্ট করার উইন্ডো আসলে নিচের পাথটি কপি করে পেস্ট করুন অথবা ব্রাউজ করে নির্বাচন করুন:
```text
D:\Job form Fill-up extension\dist
```
এরপর **"Select Folder"** বাটনে ক্লিক করুন।

### ধাপ ৬: টুলবারে Pin করুন
- ক্রোমের উপরের ডান কোণায় থাকা এক্সটেনশন পাজল আইকনে (🧩) ক্লিক করুন।
- **"JobFill BD — Smart Job Application Assistant"**-এর পাশে থাকা **Pin** (📌) আইকনে ক্লিক করে এটিকে ব্রাউজারের টুলবারে পিন করে রাখুন।

---

## 🎯 Verification & First Run (যাচাই ও প্রথম ব্যবহার)

1. **Dashboard ওপেন করুন:**
   - ব্রাউজারের টুলবারে পিন করা **JobFill BD** আইকনে ক্লিক করুন। সরাসরি সম্পূর্ণ SaaS ড্যাশবোর্ড (`dashboard.html`) একটি নতুন ট্যাবে খুলে যাবে।
2. **প্রোফাইল সেটআপ করুন:**
   - Onboarding Wizard সম্পন্ন করুন। আপনার ব্যক্তিগত তথ্য, বর্তমান ও স্থায়ী ঠিকানা, এসএসসি/এইচএসসি/স্নাতক তথ্য পূরণ করে **"Save Profile"**-এ ক্লিক করুন।
3. **মক ফর্মে টেস্ট করুন:**
   - ড্যাশবোর্ডের মেনু থেকে **"Mock Forms"**-এ যান অথবা সরাসরি ব্রাউজারে খুলুন:
     ```text
     file:///D:/Job%20form%20Fill-up%20extension/dist/test-pages/petrobangla-form.html
     ```
   - ফর্ম পেজের নিচে ডান কোণায় **"JobFill BD Assistant"** ফ্লোটিং পপআপ দেখতে পাবেন।
   - **"Scan Form"** ও **"Approve & Fill Form"** ক্লিক করে স্বয়ংক্রিয় ফর্ম পূরণের জাদু দেখুন!

---

## 🔒 Privacy, Security & Safety Policy

- **১০০% অফলাইন ও লোকাল স্টোরেজ:** আপনার কোনো তথ্য সার্ভারে পাঠানো হয় না। সবকিছু আপনার ব্রাউজারের Web Crypto AES-256-GCM এনক্রিপ্টেড IndexedDB-তে সুরক্ষিত থাকে।
- **নিরাপদ অটো-ফিল:** এক্সটেনশনটি কখনোই নিজে থেকে ফর্মে সাবমিট (`submit()`) বা পেমেন্ট গেটওয়েতে ক্লিক করে না। এটি শুধু নির্ধারিত ফিল্ডগুলো নিখুঁতভাবে পূরণ করে যাতে আপনি যাচাই করার সুযোগ পান।
- **ক্যাপচা ও ওটিপি:** ক্যাপচা বা এসএমএস ওটিপি ব্যবহারকারী নিজে হাতে পূরণ করবেন—কোনো অনৈতিক বাইপাস নেই।

---

## 🔄 Updating / Reloading after Code Changes

যদি পরবর্তীতে কোনো সোর্স কোড পরিবর্তন করা হয়:
1. টার্মিনালে `cd "D:\Job form Fill-up extension"` লিখে `npm run build` রান করুন।
2. Chrome-এ `chrome://extensions`-এ গিয়ে JobFill BD কার্ডের **Reload** (🔄) আইকনে ক্লিক করুন।
