import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyProfile } from '../../src/types/defaults';
import {
  analyzeSkillsGap,
  exploreCareerPaths,
  CareerGoalRepository,
} from '../../src/career/career-planner';
import type { NormalizedJobCircular } from '../../src/jobs/types/job.types';

describe('JobFill BD - Milestone 4: Career Path Planner & Skills Gap Analyzer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('refuses to fabricate career suitability on empty profiles and marks matched paths advisory only', () => {
    const empty = createEmptyProfile('Blank');
    const blankRes = exploreCareerPaths(empty);
    expect(blankRes.hasSufficientProfileData).toBe(false);
    expect(blankRes.paths).toHaveLength(0);

    const cseProfile = createEmptyProfile('Student CSE');
    cseProfile.careerProfile = {
      departmentOrSubject: 'CSE',
      skills: ['TypeScript', 'SQL'],
      languages: [],
      projects: [],
      achievements: [],
      careerInterests: ['Software Engineer'],
      preferredJobCategories: ['Government', 'IT'],
      preferredLocations: ['Dhaka'],
      internshipPreference: true,
      careerGoals: [],
    };
    const res = exploreCareerPaths(cseProfile);
    expect(res.hasSufficientProfileData).toBe(true);
    expect(res.paths.length).toBeGreaterThanOrEqual(1);
    expect(res.paths[0].isAdvisorySuggestionOnly).toBe(true);
    expect(res.paths[0].disclaimer).toContain('not a guarantee');
  });

  it('compares circular skills without inventing unlisted requirements and persists career goals', async () => {
    const prof = createEmptyProfile('Candidate');
    prof.careerProfile = {
      skills: ['MS Excel', 'Python'],
      languages: [],
      projects: [],
      achievements: [],
      careerInterests: [],
      preferredJobCategories: [],
      preferredLocations: [],
      internshipPreference: false,
      careerGoals: [],
    };

    const job = {
      id: 'sg_1',
      jobTitle: 'Assistant Programmer',
      organization: 'BPDB',
      qualification: 'BSc in CSE',
      description: 'Must know Python, SQL Database, and MS Excel spreadsheets.',
      requirements: ['Strong Python programming', 'SQL experience'],
    } as NormalizedJobCircular;

    const gap = analyzeSkillsGap(prof, job);
    expect(gap.noExplicitSkillsListed).toBe(false);
    expect(gap.existingMatchedSkills).toContain('Python');
    expect(gap.existingMatchedSkills).toContain('MS Excel / Spreadsheets');
    expect(gap.missingSkills).toContain('SQL / Databases');

    const noSkillsJob = {
      id: 'sg_2',
      jobTitle: 'General Officer',
      organization: 'Ministry',
      qualification: 'Honours',
      description: 'Apply online via portal.',
      requirements: [],
    } as NormalizedJobCircular;
    expect(analyzeSkillsGap(prof, noSkillsJob).noExplicitSkillsListed).toBe(true);

    const savedGoal = await CareerGoalRepository.save({
      id: 'g_sql',
      title: 'Learn PostgreSQL Queries',
      targetArea: 'Skills Gap',
      progressPercent: 40,
      completed: false,
    });
    expect(savedGoal.progressPercent).toBe(40);
    const list = await CareerGoalRepository.getAll();
    expect(list.some((g) => g.id === 'g_sql')).toBe(true);
    await CareerGoalRepository.remove('g_sql');
  });
});
