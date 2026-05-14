import { SERVER_URL } from '../../../../core/api';

export const parseJobDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && value.$date) return parseJobDate(value.$date);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isDeadlineActive = (deadline) => {
  const parsedDeadline = parseJobDate(deadline);
  if (!parsedDeadline) return true;
  return parsedDeadline.getTime() >= Date.now();
};

export const extractSalaryBounds = (salaryRange) => {
  if (salaryRange == null) {
    return { min: null, max: null };
  }

  if (typeof salaryRange === 'number') {
    return { min: salaryRange, max: salaryRange };
  }

  const raw = String(salaryRange);
  const matches = raw.match(/\d+(?:\.\d+)?/g) || [];
  const values = matches
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return { min: null, max: null };
  }

  if (values.length === 1) {
    return { min: values[0], max: values[0] };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
};

export const getSalaryFilterValue = (salaryFilter) => {
  if (!salaryFilter || salaryFilter === 'any') return null;
  const parsed = Number(salaryFilter);
  if (!Number.isFinite(parsed)) return null;

  if (parsed < 1000) {
    return parsed * 1000;
  }

  return parsed;
};

export const buildCandidateJobsQuery = ({
  page = 1,
  limit = 9,
  search = '',
  jobType = 'any',
  employmentType = 'any',
  department = 'any',
  experience = 'any',
  salaryFilter = 'any',
  savedOnly = false,
  sort = 'recent',
} = {}) => {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));

  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) params.set('search', trimmedSearch);
  if (jobType && jobType !== 'any') params.set('jobType', jobType);
  if (employmentType && employmentType !== 'any') params.set('employmentType', employmentType);
  if (department && department !== 'any') params.set('department', department);
  if (experience && experience !== 'any') params.set('experience', experience);
  if (sort) params.set('sort', sort);
  if (savedOnly) params.set('savedOnly', 'true');

  const salaryMin = getSalaryFilterValue(salaryFilter);
  if (salaryMin !== null) params.set('salaryMin', String(salaryMin));

  return params.toString();
};

const normalizeLogo = (logo) => {
  if (!logo) return 'https://placeholder.pics/svg/200';
  return logo.startsWith('/') ? `${SERVER_URL}${logo}` : logo;
};

const buildTags = (job) => {
  const candidateTags = [];

  if (Array.isArray(job.tags)) {
    candidateTags.push(...job.tags);
  }

  if (Array.isArray(job.skills)) {
    candidateTags.push(...job.skills);
  }

  if (Array.isArray(job.required_skills)) {
    candidateTags.push(...job.required_skills);
  }

  if (job.type) {
    candidateTags.push(job.type);
  }

  if (job.work_mode) {
    candidateTags.push(job.work_mode);
  }

  if (job.department) {
    candidateTags.push(job.department);
  }

  return [...new Set(candidateTags.map((tag) => String(tag).trim()).filter(Boolean))];
};

export const normalizeJob = (job, t, language = 'en') => {
  const createdAt = parseJobDate(job.created_at);
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const salaryBounds = extractSalaryBounds(job.salary_range);
  const salaryLabel = job.salary_range || 'Competitive';

  return {
    ...job,
    id: job._id || job.id,
    company: job.company || 'HumatiQ Partner',
    department: job.department || '',
    location: job.location || 'Remote',
    createdAtTs: createdAt?.getTime() || 0,
    jobType: job.work_mode
      || (['remote', 'hybrid', 'onsite'].includes(job.type?.toLowerCase()) ? job.type.toLowerCase() : 'onsite'),
    employmentType: String(job.type || '').toLowerCase() || 'cdi',
    salaryMin: salaryBounds.min || 0,
    salaryMax: salaryBounds.max || 0,
    salaryLabel,
    tags: buildTags(job),
    experienceLevel: job.experience_level || 'junior',
    match: job.match || '--%',
    matchTone: job.matchTone || 'muted',
    posted: job.posted || (createdAt
      ? `${t('jobs-posted-prefix')} ${createdAt.toLocaleDateString(locale)}`
      : t('jobs-posted-recently')),
    logo: normalizeLogo(job.logo),
    badgeIcon: job.badgeIcon || 'auto_awesome',
  };
};
