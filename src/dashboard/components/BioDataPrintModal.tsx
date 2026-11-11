import React, { useEffect, useState } from 'react';
import { Printer, X, FileText, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../../types/profile';
import { getDocumentsByProfile, StoredDocument } from '../../services/indexedDB';

interface BioDataPrintModalProps {
  profile: UserProfile;
  language?: 'bn' | 'en';
  onClose: () => void;
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPrintableBioDataHtml(
  profile: UserProfile,
  photoDataUrl?: string,
  signatureDataUrl?: string
): string {
  const p = profile.personal;
  const addrP = profile.address.present;
  const addrPerm = profile.address.sameAsPresent ? addrP : profile.address.permanent;

  const formatAddr = (a: typeof addrP) =>
    [a.careOf ? `C/O: ${a.careOf}` : '', a.house, a.road, a.village, a.postOffice, a.postCode ? `-${a.postCode}` : '', a.upazila, a.district, a.division]
      .filter(Boolean)
      .join(', ');

  const eduRows: Array<[string, string, string, string, string, string]> = [];
  if (profile.ssc?.board || profile.ssc?.rollNumber) {
    eduRows.push([
      profile.ssc.examination || 'SSC / Equivalent',
      profile.ssc.board || '-',
      profile.ssc.groupSubject || '-',
      profile.ssc.rollNumber || '-',
      profile.ssc.gpa || profile.ssc.resultType || '-',
      profile.ssc.passingYear || '-',
    ]);
  }
  if (profile.hsc?.board || profile.hsc?.rollNumber) {
    eduRows.push([
      profile.hsc.examination || 'HSC / Equivalent',
      profile.hsc.board || '-',
      profile.hsc.groupSubject || '-',
      profile.hsc.rollNumber || '-',
      profile.hsc.gpa || profile.hsc.resultType || '-',
      profile.hsc.passingYear || '-',
    ]);
  }
  if (profile.hasGraduation && profile.graduation) {
    eduRows.push([
      profile.graduation.examination || 'Graduation',
      profile.graduation.universityInstitute || '-',
      profile.graduation.subjectDegree || '-',
      profile.graduation.rollNumber || '-',
      profile.graduation.gpa || profile.graduation.resultType || '-',
      profile.graduation.passingYear || '-',
    ]);
  }
  if (profile.hasMasters && profile.masters) {
    eduRows.push([
      profile.masters.examination || 'Masters',
      profile.masters.universityInstitute || '-',
      profile.masters.subjectDegree || '-',
      profile.masters.rollNumber || '-',
      profile.masters.gpa || profile.masters.resultType || '-',
      profile.masters.passingYear || '-',
    ]);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${esc(p.applicantNameEn || profile.profileName)} - Applicant Bio-Data</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 18px; line-height: 1.45; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 14px; }
  .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
  .subtitle { font-size: 12px; color: #475569; margin-top: 2px; }
  .photo-box { width: 105px; height: 105px; border: 1px solid #cbd5e1; object-fit: cover; border-radius: 4px; }
  h3 { background: #f1f5f9; color: #0f766e; padding: 5px 10px; margin: 14px 0 8px; font-size: 12.5px; border-left: 3px solid #0f766e; text-transform: uppercase; letter-spacing: 0.4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-weight: 700; color: #334155; }
  .sig-wrap { margin-top: 24px; display: flex; justify-content: flex-end; }
  .sig-box { text-align: center; min-width: 180px; }
  .sig-box img { max-width: 165px; max-height: 48px; object-fit: contain; display: block; margin: 0 auto 4px; }
  .sig-line { border-top: 1px solid #334155; padding-top: 4px; font-weight: 600; font-size: 11px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${esc(p.applicantNameEn || 'Applicant Bio-Data')}</h1>
      ${p.applicantNameBn ? `<div class="subtitle">${esc(p.applicantNameBn)}</div>` : ''}
      <div class="subtitle">Mobile: ${esc(p.mobile || '-')} | Email: ${esc(p.email || '-')}</div>
      <div class="subtitle">NID: ${esc(p.nid || '-')} | DOB: ${esc(p.dob || '-')}</div>
    </div>
    ${photoDataUrl ? `<img class="photo-box" src="${esc(photoDataUrl)}" alt="Applicant Photo" />` : ''}
  </div>

  <h3>Personal & Family Information</h3>
  <table>
    <tr><th style="width:28%">Father's Name</th><td>${esc(p.fatherNameEn)} ${p.fatherNameBn ? `(${esc(p.fatherNameBn)})` : ''}</td></tr>
    <tr><th>Mother's Name</th><td>${esc(p.motherNameEn)} ${p.motherNameBn ? `(${esc(p.motherNameBn)})` : ''}</td></tr>
    <tr><th>Gender / Religion</th><td>${esc(p.gender || '-')} / ${esc(p.religion || '-')}</td></tr>
    <tr><th>Nationality / Marital Status</th><td>${esc(p.nationality || 'Bangladeshi')} / ${esc(p.maritalStatus || '-')}</td></tr>
    <tr><th>Quota / Departmental</th><td>${esc(p.quota || 'General')} / ${esc(p.departmentalStatus || 'No')}</td></tr>
  </table>

  <h3>Address Details</h3>
  <table>
    <tr><th style="width:28%">Present Address</th><td>${esc(formatAddr(addrP) || '-')}</td></tr>
    <tr><th>Permanent Address</th><td>${esc(formatAddr(addrPerm) || '-')}</td></tr>
  </table>

  <h3>Academic Qualifications</h3>
  <table>
    <thead><tr><th>Exam</th><th>Board / Institution</th><th>Group / Subject</th><th>Roll</th><th>GPA / Result</th><th>Year</th></tr></thead>
    <tbody>
      ${eduRows.length > 0 ? eduRows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') : '<tr><td colspan="6">No education records added</td></tr>'}
    </tbody>
  </table>

  ${
    profile.jobExperiences && profile.jobExperiences.length > 0
      ? `<h3>Work Experience</h3><table><thead><tr><th>Organization</th><th>Designation</th><th>Duration</th></tr></thead><tbody>${profile.jobExperiences
          .map((e) => `<tr><td>${esc(e.organization)}</td><td>${esc(e.designation)}</td><td>${esc(e.startDate)} - ${esc(e.currentlyWorking ? 'Present' : e.endDate || 'Present')}</td></tr>`)
          .join('')}</tbody></table>`
      : ''
  }

  <div class="sig-wrap">
    <div class="sig-box">
      ${signatureDataUrl ? `<img src="${esc(signatureDataUrl)}" alt="Signature" />` : '<div style="height:36px"></div>'}
      <div class="sig-line">Signature of Applicant</div>
    </div>
  </div>
</body>
</html>`;
}

export const BioDataPrintModal: React.FC<BioDataPrintModalProps> = ({
  profile,
  language = 'en',
  onClose,
}) => {
  const bn = language === 'bn';
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [sigUrl, setSigUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    getDocumentsByProfile(profile.id)
      .then((docs: StoredDocument[]) => {
        if (!active) return;
        const photo =
          docs.find((d) => (d.documentType || d.type) === 'photo' && d.isProcessedVariant) ||
          docs.find((d) => (d.documentType || d.type) === 'photo');
        const sig =
          docs.find((d) => (d.documentType || d.type) === 'signature' && d.isProcessedVariant) ||
          docs.find((d) => (d.documentType || d.type) === 'signature');
        if (photo?.dataUrl) setPhotoUrl(photo.dataUrl);
        if (sig?.dataUrl) setSigUrl(sig.dataUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [profile.id]);

  const previewHtml = buildPrintableBioDataHtml(profile, photoUrl, sigUrl);

  const handlePrintPdf = () => {
    const win = window.open('', '_blank', 'width=900,height=720');
    if (!win) {
      window.print();
      return;
    }
    win.document.open();
    win.document.write(previewHtml);
    win.document.close();
    win.focus();
    window.setTimeout(() => {
      win.print();
    }, 250);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-petro-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <FileText className="w-4 h-4" />
            <span>{bn ? 'প্রোফাইল বায়ো-ডাটা / সিভি শিট (Print / Save PDF)' : 'Applicant Bio-Data / CV Sheet (Print & PDF)'}</span>
          </div>
          <button type="button" onClick={onClose} className="hover:bg-white/15 rounded-lg p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>
            {bn
              ? '১০০% অফলাইন: আপনার লোকাল এনক্রিপ্টেড প্রোফাইল থেকে সরাসরি বায়ো-ডাটা তৈরি হয় এবং ব্রাউজার প্রিন্ট ডায়ালগ দিয়ে PDF সংরক্ষণ করা যায়।'
              : '100% Offline Generation: Built locally from your Vault profile. Use "Save as PDF" in your browser print dialog.'}
          </span>
        </div>

        <div className="p-4 flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950">
          <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            <iframe
              title="Applicant Bio-Data Preview"
              srcDoc={previewHtml}
              className="w-full h-[460px] border-0"
            />
          </div>
        </div>

        <div className="px-5 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            {bn ? 'বন্ধ করুন' : 'Close'}
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white shadow cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{bn ? 'প্রিন্ট / PDF সংরক্ষণ করুন' : 'Print / Save as PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
