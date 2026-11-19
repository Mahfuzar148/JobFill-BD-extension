// JobFill BD - Local ATS-Friendly A4 HTML & Print/PDF CV Renderer
// Uses local system fonts (Bengali + English Unicode safe), clean spacing, no external requests,
// explicit HTML escaping, and A4 @page rules with clean page-break guards.

import type { CvDocumentRecord } from './cv-repository';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LABELS = {
  en: {
    objective: 'Career Objective',
    personal: 'Personal & Family Details',
    father: "Father's Name",
    mother: "Mother's Name",
    dob: 'Date of Birth',
    nationality: 'Nationality',
    presentAddr: 'Present Address',
    permAddr: 'Permanent Address',
    education: 'Academic Qualifications',
    degree: 'Exam / Degree',
    institution: 'Board / Institution',
    subject: 'Group / Subject',
    year: 'Year',
    result: 'Result / GPA',
    experience: 'Work Experience',
    skills: 'Technical & Core Skills',
    training: 'Professional Training',
    certifications: 'Certifications',
    languages: 'Language Proficiency',
    projects: 'Projects & Portfolio',
    references: 'References',
    signature: 'Signature',
  },
  bn: {
    objective: 'ক্যারিয়ার উদ্দেশ্য (Career Objective)',
    personal: 'ব্যক্তিগত ও পারিবারিক তথ্য',
    father: 'পিতার নাম',
    mother: 'মাতার নাম',
    dob: 'জন্ম তারিখ',
    nationality: 'জাতীয়তা',
    presentAddr: 'বর্তমান ঠিকানা',
    permAddr: 'স্থায়ী ঠিকানা',
    education: 'শিক্ষাগত যোগ্যতা',
    degree: 'পরীক্ষা / ডিগ্রি',
    institution: 'বোর্ড / প্রতিষ্ঠান',
    subject: 'বিভাগ / বিষয়',
    year: 'পাসের সন',
    result: 'ফলাফল / জিপিএ',
    experience: 'চাকরির অভিজ্ঞতা',
    skills: 'দক্ষতা (Skills)',
    training: 'প্রশিক্ষণ',
    certifications: 'সার্টিফিকেশন ও ডিপ্লোমা',
    languages: 'ভাষাগত দক্ষতা',
    projects: 'প্রজেক্ট ও পোর্টফোলিও',
    references: 'রেফারেন্স (References)',
    signature: 'স্বাক্ষর',
  },
} as const;

export function buildAtsCvHtml(
  cv: CvDocumentRecord,
  photoDataUrl?: string,
  signatureDataUrl?: string
): string {
  const L = LABELS[cv.language] || LABELS.en;
  const accent =
    cv.template === 'academic_bd'
      ? '#0f766e'
      : cv.template === 'modern_compact'
        ? '#1d4ed8'
        : '#0f172a';
  const bodySize = cv.template === 'modern_compact' ? '11pt' : '11.5pt';

  const displayName =
    cv.language === 'bn' && cv.personal.fullNameBn
      ? `${cv.personal.fullNameBn}${cv.personal.fullName ? ` (${cv.personal.fullName})` : ''}`
      : cv.personal.fullName || cv.personal.fullNameBn || 'Curriculum Vitae';

  const contactLine = [
    cv.personal.mobile ? `${cv.personal.mobile}` : '',
    cv.personal.email ? `${cv.personal.email}` : '',
    cv.personal.presentAddress ? `${cv.personal.presentAddress}` : '',
  ]
    .filter(Boolean)
    .map(esc)
    .join(' &nbsp;|&nbsp; ');

  const renderBulletSection = (title: string, items: string[]) => {
    const clean = items.map((s) => s.trim()).filter(Boolean);
    if (clean.length === 0) return '';
    return `<section class="cv-section"><h2>${esc(title)}</h2><ul>${clean
      .map((i) => `<li>${esc(i)}</li>`)
      .join('')}</ul></section>`;
  };

  const eduRows = cv.education.filter((e) => e.level || e.institution || e.result);
  const expRows = cv.experiences.filter((e) => e.organization || e.designation);
  const projRows = cv.projects.filter((p) => p.name || p.details);
  const refRows = cv.references.filter((r) => r.name || r.contact);

  return `<!DOCTYPE html>
<html lang="${cv.language === 'bn' ? 'bn' : 'en'}">
<head>
<meta charset="UTF-8" />
<title>${esc(displayName)} - CV</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Noto Sans Bengali', 'Kalpurush', 'SolaimanLipi', 'Segoe UI', Arial, sans-serif;
    font-size: ${bodySize};
    line-height: 1.48;
    color: #0f172a;
    margin: 0;
    padding: 20px;
    background: #ffffff;
    overflow-wrap: break-word;
  }
  .cv-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    border-bottom: 2px solid ${accent};
    padding-bottom: 12px;
    margin-bottom: 14px;
  }
  .cv-name {
    font-size: 20pt;
    font-weight: 800;
    margin: 0 0 4px 0;
    color: ${accent};
    word-break: break-word;
  }
  .cv-contact { font-size: 10pt; color: #334155; }
  .cv-photo { width: 92px; height: 92px; object-fit: cover; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0; }
  .cv-section { margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
  h2 {
    font-size: 11.5pt;
    font-weight: 700;
    color: ${accent};
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 3px;
    margin: 0 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-weight: 700; color: #1e293b; }
  ul { margin: 4px 0 0 18px; padding: 0; }
  li { margin-bottom: 3px; }
  .cv-exp-item { margin-bottom: 8px; }
  .cv-exp-head { display: flex; justify-content: space-between; font-weight: 700; font-size: 10.5pt; }
  .cv-sig-wrap { margin-top: 24px; display: flex; justify-content: flex-end; break-inside: avoid; }
  .cv-sig-box { text-align: center; min-width: 170px; }
  .cv-sig-box img { max-width: 155px; max-height: 44px; object-fit: contain; display: block; margin: 0 auto 4px; }
  .cv-sig-line { border-top: 1px solid #334155; padding-top: 4px; font-size: 9.5pt; font-weight: 600; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <header class="cv-header">
    <div style="flex:1;min-width:0;">
      <h1 class="cv-name">${esc(displayName)}</h1>
      ${contactLine ? `<div class="cv-contact">${contactLine}</div>` : ''}
    </div>
    ${
      cv.visibleSections.photo && photoDataUrl
        ? `<img class="cv-photo" src="${esc(photoDataUrl)}" alt="Photo" />`
        : ''
    }
  </header>

  ${
    cv.visibleSections.careerObjective && cv.careerObjective.trim()
      ? `<section class="cv-section"><h2>${esc(L.objective)}</h2><p style="margin:0;">${esc(cv.careerObjective.trim())}</p></section>`
      : ''
  }

  ${
    cv.visibleSections.education && eduRows.length > 0
      ? `<section class="cv-section"><h2>${esc(L.education)}</h2><table><thead><tr><th>${esc(L.degree)}</th><th>${esc(L.institution)}</th><th>${esc(L.subject)}</th><th>${esc(L.year)}</th><th>${esc(L.result)}</th></tr></thead><tbody>${eduRows
          .map(
            (e) =>
              `<tr><td>${esc(e.level)}</td><td>${esc(e.institution || '-')}</td><td>${esc(e.subject || '-')}</td><td>${esc(e.year || '-')}</td><td>${esc(e.result || '-')}</td></tr>`
          )
          .join('')}</tbody></table></section>`
      : ''
  }

  ${
    cv.visibleSections.experience && expRows.length > 0
      ? `<section class="cv-section"><h2>${esc(L.experience)}</h2>${expRows
          .map(
            (ex) =>
              `<div class="cv-exp-item"><div class="cv-exp-head"><span>${esc(ex.designation)}${ex.organization ? ` — ${esc(ex.organization)}` : ''}</span><span>${esc(ex.duration)}</span></div>${ex.details ? `<div style="font-size:10pt;color:#334155;margin-top:2px;">${esc(ex.details)}</div>` : ''}</div>`
          )
          .join('')}</section>`
      : ''
  }

  ${cv.visibleSections.skills ? renderBulletSection(L.skills, cv.skills) : ''}
  ${cv.visibleSections.training ? renderBulletSection(L.training, cv.training) : ''}
  ${cv.visibleSections.certifications ? renderBulletSection(L.certifications, cv.certifications) : ''}

  ${
    cv.visibleSections.projects && projRows.length > 0
      ? `<section class="cv-section"><h2>${esc(L.projects)}</h2><ul>${projRows
          .map(
            (p) =>
              `<li><strong>${esc(p.name)}</strong>${p.role ? ` (${esc(p.role)})` : ''}${p.details ? `: ${esc(p.details)}` : ''}</li>`
          )
          .join('')}</ul></section>`
      : ''
  }

  ${cv.visibleSections.languages ? renderBulletSection(L.languages, cv.languages) : ''}

  ${
    cv.visibleSections.familyInfo &&
    (cv.personal.fatherName || cv.personal.motherName || cv.personal.dob || cv.personal.permanentAddress)
      ? `<section class="cv-section"><h2>${esc(L.personal)}</h2><table><tbody>${
          cv.personal.fatherName ? `<tr><th style="width:28%">${esc(L.father)}</th><td>${esc(cv.personal.fatherName)}</td></tr>` : ''
        }${
          cv.personal.motherName ? `<tr><th>${esc(L.mother)}</th><td>${esc(cv.personal.motherName)}</td></tr>` : ''
        }${
          cv.personal.dob ? `<tr><th>${esc(L.dob)}</th><td>${esc(cv.personal.dob)}</td></tr>` : ''
        }${
          cv.personal.nationality ? `<tr><th>${esc(L.nationality)}</th><td>${esc(cv.personal.nationality)}</td></tr>` : ''
        }${
          cv.personal.permanentAddress ? `<tr><th>${esc(L.permAddr)}</th><td>${esc(cv.personal.permanentAddress)}</td></tr>` : ''
        }</tbody></table></section>`
      : ''
  }

  ${
    cv.visibleSections.references && refRows.length > 0
      ? `<section class="cv-section"><h2>${esc(L.references)}</h2><ul>${refRows
          .map(
            (r) =>
              `<li><strong>${esc(r.name)}</strong>${r.designation ? `, ${esc(r.designation)}` : ''}${r.organization ? ` (${esc(r.organization)})` : ''}${r.contact ? ` — ${esc(r.contact)}` : ''}</li>`
          )
          .join('')}</ul></section>`
      : ''
  }

  ${
    signatureDataUrl
      ? `<div class="cv-sig-wrap"><div class="cv-sig-box"><img src="${esc(signatureDataUrl)}" alt="Signature" /><div class="cv-sig-line">${esc(L.signature)}</div></div></div>`
      : ''
  }
</body>
</html>`;
}
