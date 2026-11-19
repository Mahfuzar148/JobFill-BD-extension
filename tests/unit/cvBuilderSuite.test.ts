import { describe, it, expect, beforeEach } from 'vitest';
import {
  CvRepository,
  createCvDraftFromProfile,
} from '../../src/cv/cv-repository';
import { buildAtsCvHtml } from '../../src/cv/cv-renderer';
import { createEmptyProfile, sampleDemoProfile } from '../../src/types/defaults';

describe('Phase 5 — Local-First Multi-Version CV Builder Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    await CvRepository.clearAll();
  });

  it('1. Generates independent English and Bengali CV versions from profile without fabricating missing items', async () => {
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.applicantNameEn = 'MD. TARIQUL ISLAM CHOWDHURY SHAHINUR';
    profile.personal.applicantNameBn = 'মোঃ তারিকুল ইসলাম চৌধুরী';
    profile.hasGraduation = true;
    profile.hasMasters = true;
    profile.masters.universityInstitute = 'University of Dhaka';
    profile.masters.gpa = '3.88';

    const enDraft = createCvDraftFromProfile(profile, {
      language: 'en',
      template: 'ats_classic',
      versionTitle: 'Govt IT CV',
    });
    const bnDraft = createCvDraftFromProfile(profile, {
      language: 'bn',
      template: 'academic_bd',
      versionTitle: 'বাংলা বায়ো-ডাটা',
    });

    await CvRepository.save(enDraft);
    await CvRepository.save(bnDraft);

    const saved = await CvRepository.getAll(profile.id);
    expect(saved).toHaveLength(2);

    const htmlEn = buildAtsCvHtml(enDraft);
    const htmlBn = buildAtsCvHtml(bnDraft);

    expect(htmlEn).toContain('MD. TARIQUL ISLAM CHOWDHURY SHAHINUR');
    expect(htmlEn).toContain('@page { size: A4; margin: 14mm; }');
    expect(htmlEn).toContain('University of Dhaka');
    expect(htmlEn).toContain('break-inside: avoid');

    expect(htmlBn).toContain('lang="bn"');
    expect(htmlBn).toContain('মোঃ তারিকুল ইসলাম চৌধুরী');
    expect(htmlBn).toContain('শিক্ষাগত যোগ্যতা');
    expect(htmlBn).toContain('Noto Sans Bengali');
  });

  it('2. Hides optional sections cleanly and never fabricates empty profile records', () => {
    const empty = createEmptyProfile('Sparse User');
    const draft = createCvDraftFromProfile(empty, { language: 'en' });
    expect(draft.education).toHaveLength(0);
    expect(draft.experiences).toHaveLength(0);
    expect(draft.projects).toHaveLength(0);

    const profile = structuredClone(sampleDemoProfile);
    const hiddenDraft = createCvDraftFromProfile(profile, { language: 'en' });
    hiddenDraft.visibleSections.photo = false;
    hiddenDraft.visibleSections.familyInfo = false;
    hiddenDraft.visibleSections.references = false;

    const html = buildAtsCvHtml(hiddenDraft, 'data:image/jpeg;base64,PHOTO', 'data:image/jpeg;base64,SIG');
    expect(html).not.toContain('data:image/jpeg;base64,PHOTO');
    expect(html).not.toContain('Personal & Family Details');
    expect(html).not.toContain('References');
    // Still escapes unsafe input cleanly
    hiddenDraft.careerObjective = 'Looking for growth <script>bad()</script>';
    const escapedHtml = buildAtsCvHtml(hiddenDraft);
    expect(escapedHtml).toContain('&lt;script&gt;bad()&lt;/script&gt;');
    expect(escapedHtml).not.toContain('<script>bad()</script>');
  });
});
