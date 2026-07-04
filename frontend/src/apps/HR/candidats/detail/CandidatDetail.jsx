import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SERVER_URL, apiFetch } from '../../../../core/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../../../core/useLanguage';
import HRSidebar from '../../components/HRSidebar';
import CVViewerModal from '../../components/CVViewerModal';
import './CandidatDetail.css';

const STATUS_ALIASES = {
  pending: 'new',
  reviewed: 'in_review',
  quiz: 'technical_test',
  offer: 'accepted',
};

const APPLICATION_STATUS_META = {
  new: { labelKey: 'hr-candid-status-new', tone: 'neutral', icon: 'forward_to_inbox' },
  in_review: { labelKey: 'hr-candid-status-in-review', tone: 'steady', icon: 'manage_search' },
  technical_test: { labelKey: 'hr-candid-status-technical-test', tone: 'warm', icon: 'quiz' },
  interview: { labelKey: 'hr-candid-status-interview', tone: 'strong', icon: 'groups' },
  accepted: { labelKey: 'hr-candid-status-accepted', tone: 'success', icon: 'celebration' },
  rejected: { labelKey: 'hr-candid-status-rejected', tone: 'danger', icon: 'cancel' },
};

const DETAIL_TABS = [
  { id: 'profile', labelKey: 'hr-candid-tab-profile', icon: 'person' },
  { id: 'journey', labelKey: 'hr-candid-tab-journey', icon: 'work_history' },
  { id: 'applications', labelKey: 'hr-candid-tab-applications', icon: 'fact_check' },
  { id: 'analysis', labelKey: 'hr-candid-tab-analysis', icon: 'auto_awesome' },
];

const HR_SCORE_OPTIONS = [
  { value: 1, label: '1/5', titleKey: 'hr-candid-score-weak-title', helperKey: 'hr-candid-score-weak-helper' },
  { value: 2, label: '2/5', titleKey: 'hr-candid-score-limited-title', helperKey: 'hr-candid-score-limited-helper' },
  { value: 3, label: '3/5', titleKey: 'hr-candid-score-correct-title', helperKey: 'hr-candid-score-correct-helper' },
  { value: 4, label: '4/5', titleKey: 'hr-candid-score-solid-title', helperKey: 'hr-candid-score-solid-helper' },
  { value: 5, label: '5/5', titleKey: 'hr-candid-score-priority-title', helperKey: 'hr-candid-score-priority-helper' },
];

const createEmptyQualificationCategorySummary = () => ({
  total_items: 0,
  with_proof: 0,
  verified: 0,
  rejected: 0,
  pending: 0,
  needs_proof: 0,
});

const buildEmptyQualificationSummary = () => ({
  total_items: 0,
  with_proof: 0,
  verified: 0,
  rejected: 0,
  pending: 0,
  needs_proof: 0,
  by_category: {
    experiences: createEmptyQualificationCategorySummary(),
    educations: createEmptyQualificationCategorySummary(),
    certificates: createEmptyQualificationCategorySummary(),
  },
});

const VERIFICATION_STATUS_META = {
  pending: { labelKey: 'hr-candid-verif-pending', tone: 'neutral', icon: 'hourglass_top' },
  verified: { labelKey: 'hr-candid-verif-verified', tone: 'strong', icon: 'verified' },
  rejected: { labelKey: 'hr-candid-verif-rejected', tone: 'careful', icon: 'gpp_bad' },
};

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value, fallback = '—') => {
  const parsed = toDate(value);
  if (!parsed) return fallback;
  return parsed.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value, fallback = '—') => {
  const parsed = toDate(value);
  if (!parsed) return fallback;
  return parsed.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// NOTE: formatDateRange cannot call t() as it's outside the component.
// The fallback strings here are intentionally kept as static values;
// callers inside JSX can use t('hr-candid-period-unknown') for the empty state.
const formatDateRange = (start, end, ongoing) => {
  const startLabel = start || '';
  const endLabel = ongoing ? '●' : end || '';
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel || endLabel || null;
};

const toSortableTimestamp = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value, 0, 1).getTime();
    }

    const normalized = `${value}`.trim();
    if (!normalized) {
      continue;
    }

    if (/^\d{4}$/.test(normalized)) {
      return new Date(Number(normalized), 0, 1).getTime();
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  return 0;
};

const sortExperiencesForJourney = (left, right) => {
  const leftCurrent = Boolean(left?.current || left?.ongoing);
  const rightCurrent = Boolean(right?.current || right?.ongoing);

  if (leftCurrent !== rightCurrent) {
    return leftCurrent ? -1 : 1;
  }

  const leftTime = toSortableTimestamp(
    left?.end_date,
    left?.endDate,
    left?.endYear,
    left?.end_year,
    left?.start_date,
    left?.startDate,
    left?.startYear,
    left?.start_year
  );
  const rightTime = toSortableTimestamp(
    right?.end_date,
    right?.endDate,
    right?.endYear,
    right?.end_year,
    right?.start_date,
    right?.startDate,
    right?.startYear,
    right?.start_year
  );

  return rightTime - leftTime;
};

const sortEducationsForJourney = (left, right) => {
  const leftCurrent = Boolean(left?.ongoing);
  const rightCurrent = Boolean(right?.ongoing);

  if (leftCurrent !== rightCurrent) {
    return leftCurrent ? -1 : 1;
  }

  const leftTime = toSortableTimestamp(
    left?.end_date,
    left?.endDate,
    left?.endYear,
    left?.year,
    left?.end_year,
    left?.start_date,
    left?.startDate,
    left?.startYear,
    left?.start_year
  );
  const rightTime = toSortableTimestamp(
    right?.end_date,
    right?.endDate,
    right?.endYear,
    right?.year,
    right?.end_year,
    right?.start_date,
    right?.startDate,
    right?.startYear,
    right?.start_year
  );

  return rightTime - leftTime;
};

const sortCertificatesForJourney = (left, right) =>
  toSortableTimestamp(
    right?.date,
    right?.issue_date,
    right?.issueDate,
    right?.year
  ) - toSortableTimestamp(
    left?.date,
    left?.issue_date,
    left?.issueDate,
    left?.year
  );

const getVerificationPercent = (completed, total) => {
  if (!total) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
};

const getJourneyCategoryTone = (summary = {}) => {
  if (summary.needs_proof > 0) return 'careful';
  if (summary.pending > 0) return 'warm';
  if (summary.verified > 0) return 'strong';
  return 'neutral';
};

const buildAssetUrl = (value) => {
  if (!value) return '';
  if (
    value.startsWith('http://')
    || value.startsWith('https://')
    || value.startsWith('data:')
    || value.startsWith('blob:')
  ) {
    return value;
  }
  return value.startsWith('/') ? `${SERVER_URL}${value}` : `${SERVER_URL}/${value}`;
};

const getDisplayName = (candidate) => {
  const fullName = `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim();
  return fullName || candidate?.email || '—';
};

const getInitials = (value) =>
  value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

const normalizeApplicationStatus = (status) => {
  const normalized = `${status || 'new'}`.toLowerCase();
  return STATUS_ALIASES[normalized] || normalized;
};

const getApplicationStatusMeta = (status) =>
  APPLICATION_STATUS_META[normalizeApplicationStatus(status)] || APPLICATION_STATUS_META.new;

const extractBulletContent = (value) =>
  value
    .split(/[\n-]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 6);

const parseStrengths = (justification) => {
  if (!justification) return [];
  const match = justification.match(/points?\s*forts?\s*[:\-]?\s*([\s\S]*?)(?=points?\s*(de\s*)?vigilance|$)/i);
  if (match?.[1]) return extractBulletContent(match[1]).slice(0, 5);
  return justification
    .split('.')
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 30)
    .slice(0, 3);
};

const parseWeaknesses = (justification) => {
  if (!justification) return [];
  const match = justification.match(/points?\s*(de\s*)?vigilance\s*[:\-]?\s*([\s\S]*?)$/i);
  if (match?.[2]) return extractBulletContent(match[2]).slice(0, 4);
  return [];
};

const getSkillNames = (skills) =>
  (Array.isArray(skills) ? skills : [])
    .map((skill) => (typeof skill === 'string' ? skill : skill?.name || skill?.label))
    .filter(Boolean);

const getLanguageEntries = (languages) =>
  (Array.isArray(languages) ? languages : [])
    .map((language) => {
      if (typeof language === 'string') {
        return { name: language, level: '' };
      }

      return {
        name: language?.name || language?.language || '',
        level: language?.level || language?.proficiency || '',
      };
    })
    .filter((language) => language.name);

const getHobbyNames = (hobbies) =>
  (Array.isArray(hobbies) ? hobbies : [])
    .map((hobby) => (typeof hobby === 'string' ? hobby : hobby?.name))
    .filter(Boolean);

const getExperienceSpanLabel = (experiences) => {
  const startDates = (Array.isArray(experiences) ? experiences : [])
    .map((experience) =>
      toDate(
        experience?.start_date
        || experience?.startDate
        || (experience?.startYear ? `${experience.startYear}-01-01` : '')
        || (experience?.start_year ? `${experience.start_year}-01-01` : '')
      )
    )
    .filter(Boolean);

  if (startDates.length === 0) {
    return '';
  }

  const earliest = new Date(Math.min(...startDates.map((date) => date.getTime())));
  const totalYears = Math.max(
    1,
    Math.floor((Date.now() - earliest.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  );

  return `${totalYears} an${totalYears > 1 ? 's' : ''} d experience`;
};

const getScoreMeta = (score, bestMatchJob) => {
  if (score >= 85) {
    return {
      tone: 'strong',
      label: 'Top match',
      color: '#15803d',
      summary: bestMatchJob
        ? `Excellente adequation pour ${bestMatchJob}. Ce profil peut passer rapidement en revue approfondie.`
        : 'Excellente adequation. Profil a prioriser.',
    };
  }

  if (score >= 65) {
    return {
      tone: 'warm',
      label: 'Solide',
      color: '#b45309',
      summary: bestMatchJob
        ? `Bonne compatibilite avec ${bestMatchJob}. Une validation RH ou manager ferait gagner du temps.`
        : 'Bonne compatibilite. Le profil semble coherent avec plusieurs besoins.',
    };
  }

  if (score >= 45) {
    return {
      tone: 'steady',
      label: 'A explorer',
      color: '#1d4ed8',
      summary: bestMatchJob
        ? `Correspondance intermediaire avec ${bestMatchJob}. A verifier avec le parcours et les experiences.`
        : 'Correspondance intermediaire. Quelques zones meritent verification.',
    };
  }

  return {
    tone: 'careful',
    label: 'A verifier',
    color: '#b91c1c',
    summary: bestMatchJob
      ? `Faible correspondance detectee pour ${bestMatchJob}. Le profil demande une verification manuelle.`
      : 'Faible correspondance. Le profil demande une lecture plus attentive.',
  };
};

const getCompletionTone = (value) => {
  if (value >= 80) return 'strong';
  if (value >= 60) return 'warm';
  if (value >= 40) return 'steady';
  return 'careful';
};

const getVerificationStatusMeta = (status) =>
  VERIFICATION_STATUS_META[`${status || 'pending'}`.toLowerCase()] || VERIFICATION_STATUS_META.pending;

const getProofSummaryLabel = (proof, tFn) => {
  if (proof?.has_file && proof?.has_link) return tFn('hr-candid-proof-doc-and-link');
  if (proof?.has_file) return tFn('hr-candid-proof-doc-only');
  if (proof?.has_link) return tFn('hr-candid-proof-link-only');
  if (proof?.missing_file) return tFn('hr-candid-proof-file-not-found');
  return tFn('hr-candid-proof-no-attachment');
};

const getVerificationActionMessage = (status, tFn) => {
  if (status === 'verified') return tFn('hr-candid-verif-action-verified');
  if (status === 'rejected') return tFn('hr-candid-verif-action-rejected');
  return tFn('hr-candid-verif-action-pending');
};

const SectionCard = ({ title, icon, badge, action, className = '', children }) => (
  <section className={`cd-section-card ${className}`.trim()}>
    <div className="cd-section-head">
      <h2 className="cd-section-title">
        <span className="material-symbols-outlined">{icon}</span>
        {title}
      </h2>
      {badge ? <span className="cd-section-badge">{badge}</span> : action}
    </div>
    {children}
  </section>
);

const CandidatDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { effectiveTheme } = useTheme();
  const { t } = useLanguage();

  // Resolve translated label on top of raw meta objects
  const resolvedAppMeta = (status) => {
    const raw = getApplicationStatusMeta(status);
    return { ...raw, label: t(raw.labelKey) };
  };
  const resolvedVerifMeta = (status) => {
    const raw = getVerificationStatusMeta(status);
    return { ...raw, label: t(raw.labelKey) };
  };

  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [showFullAi, setShowFullAi] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [cnnData, setCnnData] = useState(null);
  const [cnnLoading, setCnnLoading] = useState(false);
  const [recruiterNote, setRecruiterNote] = useState('');
  const [recruiterScore, setRecruiterScore] = useState(0);
  const [noteSaved, setNoteSaved] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [verificationNotes, setVerificationNotes] = useState({});
  const [expandedQualificationKeys, setExpandedQualificationKeys] = useState({});
  const [savingVerificationKey, setSavingVerificationKey] = useState('');
  const [verificationFeedback, setVerificationFeedback] = useState({ tone: '', message: '' });
  const [documentViewer, setDocumentViewer] = useState({
    isOpen: false,
    endpoint: '',
    title: '',
    subtitle: '',
    emptyMessage: '',
  });

  useEffect(() => {
    let isActive = true;

    const fetchCandidate = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiFetch(`/candidates/${id}`);
        if (isActive) {
          setCandidate(data);
        }
      } catch (fetchError) {
        console.error('Error fetching candidate:', fetchError);
        if (isActive) {
          setCandidate(null);
          setError(t('hr-candid-load-error'));
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    if (id) {
      void fetchCandidate();
    }

    return () => {
      isActive = false;
    };
  }, [id]);

  useEffect(() => {
    setActiveTab('profile');
    setShowFullAi(false);
    setVerificationNotes({});
    setSavingVerificationKey('');
    setVerificationFeedback({ tone: '', message: '' });
    setDocumentViewer({
      isOpen: false,
      endpoint: '',
      title: '',
      subtitle: '',
      emptyMessage: '',
    });
  }, [id]);

  useEffect(() => {
    try {
      const legacyNoteKey = `hr-candidate-note-${id}`;
      const storedNote = window.localStorage.getItem(legacyNoteKey) || '';
      setRecruiterNote(storedNote);
      setNoteSaved(false);
      setReviewError('');
    } catch (storageError) {
      console.error('Unable to read recruiter note:', storageError);
      setRecruiterNote('');
      setNoteSaved(false);
      setReviewError('');
    }
  }, [id]);

  useEffect(() => {
    const persistedRate = Number(candidate?.current_user_rating?.rate || 0);
    setRecruiterScore(persistedRate >= 1 && persistedRate <= 5 ? persistedRate : 0);
  }, [candidate?.current_user_rating?.rate, id]);

  useEffect(() => {
    if (!verificationFeedback.message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setVerificationFeedback({ tone: '', message: '' });
    }, 2800);

    return () => window.clearTimeout(timeoutId);
  }, [verificationFeedback]);

  useEffect(() => {
    setExpandedQualificationKeys({});
  }, [id]);

  useEffect(() => {
    if (activeTab !== 'analysis' || cnnData || cnnLoading || !candidate) return;
    const candidateId = candidate._id || candidate.user_id;
    if (!candidateId) return;

    let active = true;
    setCnnLoading(true);

    apiFetch(`/ai-analysis/candidate/${candidateId}`)
      .then((data) => { if (active) setCnnData(data); })
      .catch(() => {})
      .finally(() => { if (active) setCnnLoading(false); });

    return () => { active = false; };
  }, [activeTab, candidate, cnnData, cnnLoading]);

  const handleDownloadCV = async () => {
    try {
      setDownloading(true);
      const response = await apiFetch(`/candidates/${id}/cv/download`, {}, true);
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileName = candidate?.cv?.filename || `${getDisplayName(candidate).replace(/\s+/g, '_')}_CV.pdf`;

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (downloadError) {
      console.error('Error downloading CV:', downloadError);
      window.alert(t('hr-candid-download-error'));
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async (value, key) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      window.setTimeout(() => setCopiedField(''), 1800);
    } catch (copyError) {
      console.error('Copy failed:', copyError);
    }
  };

  const handleSaveRecruiterNote = async () => {
    if (!recruiterScore || recruiterScore < 1 || recruiterScore > 5) {
      setReviewError(t('hr-candid-score-required'));
      return;
    }

    try {
      setSavingReview(true);
      setReviewError('');

      const ratingResponse = await apiFetch(`/candidates/${id}/rating`, {
        method: 'PUT',
        body: JSON.stringify({ rate: recruiterScore }),
      });

      window.localStorage.setItem(`hr-candidate-note-${id}`, recruiterNote);
      setCandidate((current) => (current ? { ...current, ...ratingResponse } : current));
      setNoteSaved(true);
      window.setTimeout(() => setNoteSaved(false), 1800);
    } catch (storageError) {
      console.error('Unable to save recruiter review:', storageError);
      setReviewError(storageError.message || t('hr-candid-save-error'));
    } finally {
      setSavingReview(false);
    }
  };

  const buildQualificationKey = (category, itemId) => `${category}:${itemId}`;

  const getVerificationNoteValue = (category, item) => {
    const itemId = item?.id;
    const key = buildQualificationKey(category, itemId);
    return Object.prototype.hasOwnProperty.call(verificationNotes, key)
      ? verificationNotes[key]
      : item?.verification?.note || '';
  };

  const handleVerificationNoteChange = (category, itemId, value) => {
    const key = buildQualificationKey(category, itemId);
    setVerificationNotes((current) => ({ ...current, [key]: value }));
  };

  const isQualificationExpanded = (category, itemId) =>
    Boolean(expandedQualificationKeys[buildQualificationKey(category, itemId)]);

  const toggleQualificationExpanded = (category, itemId) => {
    const key = buildQualificationKey(category, itemId);
    setExpandedQualificationKeys((current) => (current[key] ? {} : { [key]: true }));
  };

  const handleOpenQualificationProof = (category, item) => {
    const proof = item?.proof;
    const itemId = item?.id;
    const downloadUrl = proof?.download_url;
    if (!downloadUrl || !itemId) {
      return;
    }

    const endpoint = downloadUrl.startsWith('/api') ? downloadUrl.slice(4) : downloadUrl;
    const titles = {
      experiences: item?.position || item?.jobTitle || item?.title || t('hr-candid-journey-section-experiences'),
      educations: item?.degree || item?.institution || t('hr-candid-journey-section-educations'),
      certificates: item?.name || item?.title || t('hr-candid-journey-section-certificates'),
    };
    const subtitles = {
      experiences: t('hr-candid-proof-doc-only'),
      educations: t('hr-candid-proof-doc-only'),
      certificates: t('hr-candid-proof-doc-only'),
    };

    setDocumentViewer({
      isOpen: true,
      endpoint,
      title: titles[category] || t('hr-candid-proof-internal-doc'),
      subtitle: subtitles[category] || t('hr-candid-proof-internal-doc'),
      emptyMessage: t('hr-candid-proof-waiting-msg'),
    });
  };

  const handleQualificationVerification = async (category, item, status) => {
    const itemId = item?.id;
    if (!itemId) {
      return;
    }

    const requestKey = buildQualificationKey(category, itemId);
    const note = getVerificationNoteValue(category, item);

    try {
      setSavingVerificationKey(requestKey);
      setVerificationFeedback({ tone: '', message: '' });

      const response = await apiFetch(`/candidates/${id}/qualifications/${category}/${itemId}/verification`, {
        method: 'PUT',
        body: JSON.stringify({ status, note }),
      });

      setCandidate((current) => {
        if (!current) {
          return current;
        }

        const items = Array.isArray(current[category]) ? current[category] : [];
        return {
          ...current,
          [category]: items.map((entry) => (
            `${entry?.id || ''}` === `${itemId}`
              ? { ...entry, verification: response.verification }
              : entry
          )),
          qualification_verification_summary:
            response.qualification_verification_summary || current.qualification_verification_summary,
        };
      });

      setVerificationNotes((current) => ({
        ...current,
        [requestKey]: response?.verification?.note || '',
      }));
      setVerificationFeedback({
        tone: 'success',
        message: getVerificationActionMessage(status, t),
      });
    } catch (verificationError) {
      console.error('Error saving qualification verification:', verificationError);
      setVerificationFeedback({
        tone: 'error',
        message: verificationError.message || t('hr-candid-verif-save-error'),
      });
    } finally {
      setSavingVerificationKey('');
    }
  };

  // Resolve translated label for application status meta
  const profileData = useMemo(() => {
    const resolvedCandidate = candidate || {};
    const displayName = getDisplayName(resolvedCandidate);
    const score = Math.max(0, Math.min(100, Number(resolvedCandidate.best_score || 0) || 0));
    const experiences = Array.isArray(resolvedCandidate.experiences) ? resolvedCandidate.experiences : [];
    const educations = Array.isArray(resolvedCandidate.educations) ? resolvedCandidate.educations : [];
    const certificates = Array.isArray(resolvedCandidate.certificates) ? resolvedCandidate.certificates : [];
    const applications = Array.isArray(resolvedCandidate.applications) ? resolvedCandidate.applications : [];
    const skills = getSkillNames(resolvedCandidate.skills);
    const languages = getLanguageEntries(resolvedCandidate.languages);
    const hobbies = getHobbyNames(resolvedCandidate.hobbies);
    const qualificationSummary = resolvedCandidate.qualification_verification_summary || buildEmptyQualificationSummary();
    const strengths = parseStrengths(resolvedCandidate.ai_justification);
    const weaknesses = parseWeaknesses(resolvedCandidate.ai_justification);
    const avatarUrl = buildAssetUrl(
      resolvedCandidate.profileImage || resolvedCandidate.profilePicture || resolvedCandidate.avatar || ''
    );
    const scoreMeta = getScoreMeta(score, resolvedCandidate.best_match_job);
    const sortedApplications = [...applications].sort(
      (first, second) =>
        (toDate(second.updated_at || second.created_at)?.getTime() || 0)
        - (toDate(first.updated_at || first.created_at)?.getTime() || 0)
    );
    const latestApplication = sortedApplications[0] || null;
    const averageScore = sortedApplications.length > 0
      ? Math.round(
        sortedApplications.reduce((sum, application) => sum + (Number(application.ai_score || 0) || 0), 0)
        / sortedApplications.length
      )
      : score;
    const latestStatusMeta = latestApplication ? getApplicationStatusMeta(latestApplication.status) : null;

    return {
      displayName,
      initials: getInitials(displayName),
      score,
      scoreMeta,
      averageScore,
      avatarUrl,
      experiences,
      educations,
      certificates,
      qualificationSummary,
      applications: sortedApplications,
      latestApplication,
      latestStatusMeta,
      skills,
      languages,
      hobbies,
      strengths,
      weaknesses,
    };
  }, [candidate]);

  const socialLinks = useMemo(
    () =>
      [
        { key: 'linkedin', label: 'LinkedIn', icon: 'link', href: candidate?.linkedinUrl },
        { key: 'github', label: 'GitHub', icon: 'code', href: candidate?.github },
        { key: 'website', label: 'Portfolio', icon: 'public', href: candidate?.website },
        { key: 'twitter', label: 'Twitter', icon: 'alternate_email', href: candidate?.twitter },
      ].filter((item) => item.href),
    [candidate]
  );

  const latestApplication = profileData.latestApplication;
  const latestStatusMeta = profileData.latestStatusMeta;

  const dossierChecklist = useMemo(
    () => [
      {
        label: t('hr-candid-checklist-contact'),
        detail: candidate?.email || candidate?.phone || t('hr-candid-checklist-contact-missing'),
        complete: Boolean(candidate?.email || candidate?.phone),
        icon: 'contact_mail',
      },
      {
        label: t('hr-candid-checklist-cv'),
        detail: candidate?.cv ? t('hr-candid-checklist-cv-ready') : t('hr-candid-checklist-cv-missing'),
        complete: Boolean(candidate?.cv),
        icon: 'description',
      },
      {
        label: t('hr-candid-checklist-career'),
        detail: profileData.experiences.length > 0
          ? `${profileData.experiences.length} experience${profileData.experiences.length > 1 ? 's' : ''}`
          : t('hr-candid-checklist-career-missing'),
        complete: profileData.experiences.length > 0,
        icon: 'work_history',
      },
      {
        label: t('hr-candid-checklist-skills'),
        detail: profileData.skills.length > 0
          ? `${profileData.skills.length} ${t('hr-candid-skills-section').toLowerCase()}`
          : t('hr-candid-checklist-skills-missing'),
        complete: profileData.skills.length > 0,
        icon: 'psychology',
      },
      {
        label: t('hr-candid-checklist-application'),
        detail: latestApplication?.job_title || t('hr-candid-checklist-application-missing'),
        complete: Boolean(latestApplication),
        icon: 'fact_check',
      },
    ],
    [candidate, latestApplication, profileData.experiences.length, profileData.skills.length, t]
  );

  const dossierCompletion = useMemo(
    () => (
      dossierChecklist.length > 0
        ? Math.round((dossierChecklist.filter((item) => item.complete).length / dossierChecklist.length) * 100)
        : 0
    ),
    [dossierChecklist]
  );

  const recruiterBrief = useMemo(() => {
    const parts = [];

    if (candidate?.best_match_job && candidate.best_match_job !== t('hr-candid-analysis-no-application')) {
      parts.push(`${profileData.displayName} — ${candidate.best_match_job}.`);
    } else {
      parts.push(`${profileData.displayName}.`);
    }

    if (latestStatusMeta) {
      parts.push(t(latestStatusMeta.labelKey));
    }

    if (profileData.strengths[0]) {
      parts.push(profileData.strengths[0]);
    } else if (profileData.skills[0]) {
      parts.push(profileData.skills[0]);
    }

    return parts.filter(Boolean).join(' · ');
  }, [candidate, latestStatusMeta, profileData, t]);

  if (loading) {
    return (
      <div className={`candidat-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
        <HRSidebar />
        <main className="main-content-area">
          <div className="cd-state-shell">
            <div className="cd-state-card">
              <span className="material-symbols-outlined">person_search</span>
              <h2>{t('hr-candid-loading-title')}</h2>
              <p>{t('hr-candid-loading-desc')}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className={`candidat-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
        <HRSidebar />
        <main className="main-content-area">
          <div className="cd-state-shell">
            <div className="cd-state-card cd-state-card--error">
              <span className="material-symbols-outlined">error</span>
              <h2>{error || t('hr-candid-error-default')}</h2>
              <p>{t('hr-candid-error-desc')}</p>
              <button type="button" className="cd-button cd-button--ghost" onClick={() => navigate('/hr/candidats')}>
                <span className="material-symbols-outlined">arrow_back</span>
                {t('hr-candid-error-back')}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const {
    displayName,
    initials,
    score,
    scoreMeta,
    averageScore,
    avatarUrl,
    experiences,
    educations,
    certificates,
    qualificationSummary,
    applications,
    latestApplication: primaryApplication,
    skills,
    languages,
    hobbies,
    strengths,
    weaknesses,
  } = profileData;

  const dossierTone = getCompletionTone(dossierCompletion);
  const completedChecklistCount = dossierChecklist.filter((item) => item.complete).length;
  const dossierSummary = dossierCompletion >= 80
    ? t('hr-candid-dossier-strong')
    : dossierCompletion >= 60
      ? t('hr-candid-dossier-medium')
      : t('hr-candid-dossier-weak');
  const experienceSpanLabel = getExperienceSpanLabel(experiences);
  const heroMeta = [candidate.address || candidate.location, experienceSpanLabel].filter(Boolean).join(' - ');
  const profileApplications = applications.slice(0, 3);
  const featuredSkills = skills.slice(0, 4);
  const secondarySkills = skills.slice(4);
  const recruiterScoreRaw = HR_SCORE_OPTIONS.find((option) => option.value === recruiterScore) || null;
  const recruiterScoreMeta = recruiterScoreRaw
    ? { ...recruiterScoreRaw, title: t(recruiterScoreRaw.titleKey), helper: t(recruiterScoreRaw.helperKey) }
    : null;
  const ratingsCount = Number(candidate?.ratings_count || 0);
  const ratingsAverage = candidate?.ratings_average;
  const sortedJourneyExperiences = [...experiences].sort(sortExperiencesForJourney);
  const sortedJourneyEducations = [...educations].sort(sortEducationsForJourney);
  const sortedJourneyCertificates = [...certificates].sort(sortCertificatesForJourney);
  const currentExperience = sortedJourneyExperiences[0] || null;
  const leadEducation = sortedJourneyEducations[0] || null;
  const leadCertificate = sortedJourneyCertificates[0] || null;
  const experienceVerificationSummary =
    qualificationSummary?.by_category?.experiences || createEmptyQualificationCategorySummary();
  const educationVerificationSummary =
    qualificationSummary?.by_category?.educations || createEmptyQualificationCategorySummary();
  const certificateVerificationSummary =
    qualificationSummary?.by_category?.certificates || createEmptyQualificationCategorySummary();
  const verificationOverviewCards = [
    {
      label: t('hr-candid-verif-overview-tracked'),
      value: qualificationSummary.total_items,
      detail: t('hr-candid-verif-with-proof', { count: qualificationSummary.with_proof }),
      icon: 'inventory_2',
      tone: qualificationSummary.total_items > 0 ? 'steady' : 'neutral',
    },
    {
      label: t('hr-candid-verif-overview-verified'),
      value: qualificationSummary.verified,
      detail: qualificationSummary.total_items > 0
        ? t('hr-candid-verif-remaining', { count: qualificationSummary.total_items - qualificationSummary.verified })
        : t('hr-candid-verif-none-items'),
      icon: 'verified',
      tone: qualificationSummary.verified > 0 ? 'strong' : 'neutral',
    },
    {
      label: t('hr-candid-verif-overview-pending'),
      value: qualificationSummary.pending,
      detail: qualificationSummary.pending > 0 ? t('hr-candid-verif-needs-review') : t('hr-candid-verif-none-pending'),
      icon: 'hourglass_top',
      tone: qualificationSummary.pending > 0 ? 'warm' : 'neutral',
    },
    {
      label: t('hr-candid-verif-overview-missing-proof'),
      value: qualificationSummary.needs_proof,
      detail: qualificationSummary.needs_proof > 0 ? t('hr-candid-verif-cannot-confirm') : t('hr-candid-verif-all-have-proof'),
      icon: 'hide_source',
      tone: qualificationSummary.needs_proof > 0 ? 'careful' : 'strong',
    },
  ];
  const journeyFocusTone = qualificationSummary.needs_proof > 0
    ? 'careful'
    : qualificationSummary.pending > 0
      ? 'warm'
      : qualificationSummary.verified > 0
        ? 'strong'
        : 'neutral';
  const journeyFocusIcon = qualificationSummary.needs_proof > 0
    ? 'hide_source'
    : qualificationSummary.pending > 0
      ? 'hourglass_top'
      : qualificationSummary.verified > 0
        ? 'verified'
        : 'rule';
  const journeyFocusTitle = qualificationSummary.needs_proof > 0
    ? t('hr-candid-verif-cannot-confirm')
    : qualificationSummary.pending > 0
      ? t('hr-candid-verif-needs-review')
      : qualificationSummary.verified > 0
        ? t('hr-candid-verif-overview-verified')
        : t('hr-candid-btn-verify');
  const journeyFocusCopy = qualificationSummary.needs_proof > 0
    ? t('hr-candid-verif-cannot-confirm')
    : qualificationSummary.pending > 0
      ? t('hr-candid-verif-needs-review')
      : qualificationSummary.verified > 0
        ? t('hr-candid-verif-all-have-proof')
        : t('hr-candid-verif-none-items');
  const journeySpotlightSummary = currentExperience
    ? `${displayName} — ${currentExperience.title || currentExperience.jobTitle || currentExperience.position || ''} @ ${currentExperience.company || currentExperience.organization || ''}`
    : `${displayName}`;
  const journeyHighlightCards = [
    {
      label: t('hr-candid-journey-section-experiences'),
      icon: 'badge',
      title: currentExperience?.title || currentExperience?.jobTitle || currentExperience?.position || '',
      detail: currentExperience?.company || currentExperience?.organization || '',
    },
    {
      label: t('hr-candid-education-section'),
      icon: 'school',
      title: leadEducation?.degree || leadEducation?.field || leadEducation?.level || '',
      detail: leadEducation?.institution || leadEducation?.school || leadEducation?.university || '',
    },
    {
      label: t('hr-candid-certifications-section'),
      icon: 'workspace_premium',
      title: leadCertificate?.name || leadCertificate?.title || '',
      detail: leadCertificate?.issuer || leadCertificate?.issuingOrganization || '',
    },
  ];
  const journeyReviewCards = [
    {
      key: 'experiences',
      label: t('hr-candid-journey-section-experiences'),
      icon: 'work_history',
      count: sortedJourneyExperiences.length,
      lead: currentExperience?.title || currentExperience?.jobTitle || currentExperience?.position || t('hr-candid-journey-empty-experiences'),
      helper: experienceVerificationSummary.needs_proof > 0
        ? t('hr-candid-verif-cannot-confirm')
        : experienceVerificationSummary.pending > 0
          ? t('hr-candid-verif-needs-review')
          : t('hr-candid-verif-all-have-proof'),
      summary: experienceVerificationSummary,
      tone: getJourneyCategoryTone(experienceVerificationSummary),
    },
    {
      key: 'educations',
      label: t('hr-candid-journey-section-educations'),
      icon: 'school',
      count: sortedJourneyEducations.length,
      lead: leadEducation?.institution || leadEducation?.school || leadEducation?.university || t('hr-candid-journey-empty-educations'),
      helper: educationVerificationSummary.needs_proof > 0
        ? t('hr-candid-verif-cannot-confirm')
        : educationVerificationSummary.pending > 0
          ? t('hr-candid-verif-needs-review')
          : t('hr-candid-verif-all-have-proof'),
      summary: educationVerificationSummary,
      tone: getJourneyCategoryTone(educationVerificationSummary),
    },
    {
      key: 'certificates',
      label: t('hr-candid-journey-section-certificates'),
      icon: 'verified',
      count: sortedJourneyCertificates.length,
      lead: leadCertificate?.name || leadCertificate?.title || t('hr-candid-journey-empty-certificates'),
      helper: certificateVerificationSummary.needs_proof > 0
        ? t('hr-candid-verif-cannot-confirm')
        : certificateVerificationSummary.pending > 0
          ? t('hr-candid-verif-needs-review')
          : t('hr-candid-verif-all-have-proof'),
      summary: certificateVerificationSummary,
      tone: getJourneyCategoryTone(certificateVerificationSummary),
    },
  ].map((card) => ({
    ...card,
    verificationRate: getVerificationPercent(card.summary.verified, card.summary.total_items || card.count),
    proofRate: getVerificationPercent(card.summary.with_proof, card.summary.total_items || card.count),
  }));
  const overallVerificationRate = getVerificationPercent(
    qualificationSummary.verified,
    qualificationSummary.total_items
  );
  const overallProofRate = getVerificationPercent(
    qualificationSummary.with_proof,
    qualificationSummary.total_items
  );
  const journeySnapshotCards = [
    {
      label: t('hr-candid-journey-section-experiences'),
      icon: 'badge',
      title: currentExperience?.title || currentExperience?.jobTitle || currentExperience?.position || '',
      detail: currentExperience?.company || currentExperience?.organization || '',
      meta: currentExperience
        ? formatDateRange(
          currentExperience.start_date || currentExperience.startDate || currentExperience.startYear || currentExperience.start_year,
          currentExperience.end_date || currentExperience.endDate || currentExperience.endYear || currentExperience.end_year,
          currentExperience.current || currentExperience.ongoing
        ) || t('hr-candid-period-unknown')
        : t('hr-candid-career-empty'),
    },
    {
      label: t('hr-candid-education-section'),
      icon: 'school',
      title: leadEducation?.degree || leadEducation?.field || leadEducation?.level || '',
      detail: leadEducation?.institution || leadEducation?.school || leadEducation?.university || '',
      meta: leadEducation
        ? formatDateRange(
          leadEducation.start_date || leadEducation.startDate || leadEducation.startYear || leadEducation.start_year,
          leadEducation.end_date || leadEducation.endDate || leadEducation.endYear || leadEducation.year || leadEducation.end_year,
          leadEducation.ongoing
        ) || t('hr-candid-period-unknown')
        : t('hr-candid-education-empty'),
    },
    {
      label: t('hr-candid-certifications-section'),
      icon: 'workspace_premium',
      title: leadCertificate?.name || leadCertificate?.title || '',
      detail: leadCertificate?.issuer || leadCertificate?.issuingOrganization || '',
      meta: leadCertificate?.date || leadCertificate?.issue_date || leadCertificate?.issueDate || leadCertificate?.year || t('hr-candid-date-unknown'),
    },
    {
      label: t('hr-candid-journey-status'),
      icon: journeyFocusIcon,
      title: journeyFocusTitle,
      detail: journeyFocusCopy,
      meta: t('hr-candid-verif-overview-tracked'),
    },
  ];
  const openApplicationsCount = applications.filter((application) => {
    const normalizedStatus = normalizeApplicationStatus(application.status);
    return normalizedStatus !== 'accepted' && normalizedStatus !== 'rejected';
  }).length;
  const secondaryApplications = applications.slice(1);

  const renderQualificationVerification = (category, item) => {
    const itemId = item?.id;
    if (!itemId) {
      return null;
    }

    const proof = item?.proof || {};
    const verification = item?.verification || {};
    const statusMeta = resolvedVerifMeta(verification.status);
    const requestKey = buildQualificationKey(category, itemId);
    const noteValue = getVerificationNoteValue(category, item);
    const isSavingThisItem = savingVerificationKey === requestKey;
    const reviewerName = verification?.reviewed_by?.name;
    const updatedAt = verification?.updated_at;
    const proofLabel = proof?.has_file
      ? t('hr-candid-proof-internal-doc')
      : proof?.has_link
        ? t('hr-candid-proof-external-link')
        : proof?.missing_file
          ? t('hr-candid-proof-missing-file')
          : t('hr-candid-proof-none');

    return (
      <div className="cd-journey-row-workspace">
        <div className="cd-journey-proof-workbench">
          <p className="cd-journey-workspace-label">{t('hr-candid-proof-label')}</p>
          <div className={`cd-journey-proof-preview ${proof?.available ? 'is-ready' : 'is-missing'}`}>
            <div className="cd-journey-proof-preview-icon">
              <span className="material-symbols-outlined">
                {proof?.has_file ? 'description' : proof?.has_link ? 'link' : 'hide_source'}
              </span>
            </div>
            <div className="cd-journey-proof-preview-copy">
              <strong>{proofLabel}</strong>
              <span>{getProofSummaryLabel(proof, t)}</span>
            </div>
          </div>

          <div className="cd-verification-actions">
            {proof?.has_file ? (
              <button
                type="button"
                className="cd-proof-action"
                onClick={() => handleOpenQualificationProof(category, item)}
              >
                <span className="material-symbols-outlined">visibility</span>
                {t('hr-candid-see-document')}
              </button>
            ) : null}
            {proof?.has_link ? (
              <a
                href={proof.external_url}
                target="_blank"
                rel="noreferrer"
                className="cd-proof-action"
              >
                <span className="material-symbols-outlined">open_in_new</span>
                {t('hr-candid-open-link')}
              </a>
            ) : null}
          </div>

          {proof?.missing_file && !proof?.has_link ? (
            <p className="cd-proof-empty">{t('hr-candid-proof-file-missing-msg')}</p>
          ) : null}
          {!proof?.available && !proof?.missing_file ? (
            <p className="cd-proof-empty">{t('hr-candid-proof-waiting-msg')}</p>
          ) : null}

          <p className="cd-verification-meta">
            {reviewerName || updatedAt
              ? reviewerName
                ? t('hr-candid-last-decision', { name: reviewerName, date: formatDateTime(updatedAt) })
                : t('hr-candid-last-decision-hr', { date: formatDateTime(updatedAt) })
              : t('hr-candid-no-decision')}
          </p>
        </div>

        <div className="cd-journey-review-workbench">
          <label className="cd-verification-note-block">
            <span>{t('hr-candid-verif-note-label')}</span>
            <textarea
              className="cd-verification-note"
              rows={4}
              value={noteValue}
              onChange={(event) => handleVerificationNoteChange(category, itemId, event.target.value)}
              placeholder={t('hr-candid-verif-note-placeholder')}
            />
          </label>

          <div className="cd-verification-decision-row">
            <button
              type="button"
              className={`cd-verification-choice ${verification?.status === 'rejected' ? 'is-active is-rejected' : ''}`}
              disabled={isSavingThisItem}
              onClick={() => handleQualificationVerification(category, item, 'rejected')}
            >
              <span className="material-symbols-outlined">gpp_bad</span>
              {t('hr-candid-btn-reject')}
            </button>
            <button
              type="button"
              className={`cd-verification-choice ${verification?.status === 'pending' ? 'is-active is-pending' : ''}`}
              disabled={isSavingThisItem}
              onClick={() => handleQualificationVerification(category, item, 'pending')}
            >
              <span className="material-symbols-outlined">
                {isSavingThisItem ? 'sync' : 'restart_alt'}
              </span>
              {isSavingThisItem ? t('hr-candid-saving') : t('hr-candid-btn-pending')}
            </button>
            <button
              type="button"
              className={`cd-verification-choice ${verification?.status === 'verified' ? 'is-active is-verified' : ''}`}
              disabled={isSavingThisItem || !proof?.available}
              onClick={() => handleQualificationVerification(category, item, 'verified')}
            >
              <span className="material-symbols-outlined">verified</span>
              {t('hr-candid-btn-verify')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getJourneyRowConfig = (category) => ({
    experiences: {
      sectionLabel: t('hr-candid-journey-section-experiences'),
      emptyLabel: t('hr-candid-journey-empty-experiences'),
      icon: 'work',
      getTitle: (item) => item?.title || item?.jobTitle || item?.position || t('hr-candid-app-no-title'),
      getMeta: (item) => [
        item?.company || item?.organization || '',
        formatDateRange(
          item?.start_date || item?.startDate || item?.startYear || item?.start_year,
          item?.end_date || item?.endDate || item?.endYear || item?.end_year,
          item?.current || item?.ongoing
        ) || t('hr-candid-period-unknown'),
      ].filter(Boolean).join(' - '),
    },
    educations: {
      sectionLabel: t('hr-candid-journey-section-educations'),
      emptyLabel: t('hr-candid-journey-empty-educations'),
      icon: 'school',
      getTitle: (item) => item?.degree || item?.field || item?.level || '',
      getMeta: (item) => [
        item?.institution || item?.school || item?.university || '',
        formatDateRange(
          item?.start_date || item?.startDate || item?.startYear || item?.start_year,
          item?.end_date || item?.endDate || item?.endYear || item?.year || item?.end_year,
          item?.ongoing
        ) || t('hr-candid-period-unknown'),
      ].filter(Boolean).join(' - '),
    },
    certificates: {
      sectionLabel: t('hr-candid-journey-section-certificates'),
      emptyLabel: t('hr-candid-journey-empty-certificates'),
      icon: 'military_tech',
      getTitle: (item) => item?.name || item?.title || '',
      getMeta: (item) => [
        item?.issuer || item?.issuingOrganization || '',
        item?.date || item?.issue_date || item?.issueDate || item?.year || t('hr-candid-date-unknown'),
      ].filter(Boolean).join(' - '),
    },
  }[category]);

  const renderJourneyReviewSection = (category, items = []) => {
    const config = getJourneyRowConfig(category);
    if (!config) {
      return null;
    }

    return (
      <section className="cd-journey-compact-section">
        <div className="cd-journey-compact-head">
          <h3>{config.sectionLabel}</h3>
          <span>{items.length} element{items.length > 1 ? 's' : ''}</span>
        </div>

        {items.length > 0 ? (
          <div className="cd-journey-compact-list">
            {items.map((item, index) => {
              const itemId = item?.id || `${category}-${index}`;
              const rowKey = buildQualificationKey(category, itemId);
              const proof = item?.proof || {};
              const verification = item?.verification || {};
              const statusMeta = resolvedVerifMeta(verification.status);
              const isExpanded = Boolean(item?.id) && isQualificationExpanded(category, item.id);
              const noteValue = getVerificationNoteValue(category, item);
              const notePreview = `${noteValue || verification?.note || ''}`.trim();

              return (
                <article key={rowKey} className={`cd-journey-compact-row ${isExpanded ? 'is-expanded' : ''}`}>
                  <button
                    type="button"
                    className="cd-journey-compact-row-toggle"
                    onClick={() => item?.id && toggleQualificationExpanded(category, item.id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="cd-journey-compact-row-main">
                      <div className="cd-journey-compact-row-icon">
                        <span className="material-symbols-outlined">{config.icon}</span>
                      </div>
                      <div className="cd-journey-compact-row-copy">
                        <strong>{config.getTitle(item)}</strong>
                        <span>{config.getMeta(item)}</span>
                        {notePreview && !isExpanded ? (
                          <small>{notePreview.length > 120 ? `${notePreview.slice(0, 120)}...` : notePreview}</small>
                        ) : null}
                      </div>
                    </div>

                    <div className="cd-journey-compact-row-side">
                      <div className="cd-journey-compact-proof-icons" aria-hidden="true">
                        {proof?.has_file ? (
                          <span className="material-symbols-outlined">description</span>
                        ) : null}
                        {proof?.has_link ? (
                          <span className="material-symbols-outlined">link</span>
                        ) : null}
                      </div>
                      <span className={`cd-pill cd-pill--${statusMeta.tone}`}>
                        <span className="material-symbols-outlined">{statusMeta.icon}</span>
                        {statusMeta.label}
                      </span>
                      <span className={`cd-verification-proof-badge ${proof?.available ? 'is-ready' : 'is-missing'}`}>
                        <span className="material-symbols-outlined">
                          {proof?.available ? 'attach_file' : 'hide_source'}
                        </span>
                        {getProofSummaryLabel(proof, t)}
                      </span>
                      <span className="material-symbols-outlined">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </button>

                  {isExpanded ? renderQualificationVerification(category, item) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="cd-empty">{config.emptyLabel}</div>
        )}
      </section>
    );
  };

  const renderProfileTab = () => (
    <div className="cd-profile-tab">
      <section className="cd-profile-hero">
        <div className="cd-profile-hero-main">
          <div className="cd-profile-hero-head">
            <div className="cd-profile-hero-avatar">
              {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{initials}</span>}
            </div>

            <div className="cd-profile-hero-copy">
              <h2>{displayName}</h2>
              <p className="cd-profile-hero-role">{candidate.title || t('hr-candid-profile-to-qualify')}</p>
              {heroMeta ? <p className="cd-profile-hero-meta">{heroMeta}</p> : null}
              <p className="cd-profile-hero-brief">{recruiterBrief}</p>

              <div className="cd-profile-chip-row">
                {candidate.email ? (
                  <span className="cd-meta-chip">
                    <span className="material-symbols-outlined">mail</span>
                    {candidate.email}
                  </span>
                ) : null}
                {candidate.phone ? (
                  <span className="cd-meta-chip">
                    <span className="material-symbols-outlined">call</span>
                    {candidate.phone}
                  </span>
                ) : null}
                {candidate.address || candidate.location ? (
                  <span className="cd-meta-chip">
                    <span className="material-symbols-outlined">location_on</span>
                    {candidate.address || candidate.location}
                  </span>
                ) : null}
                <span className="cd-meta-chip">
                  <span className="material-symbols-outlined">schedule</span>
                  {t('hr-candid-registered-on', { date: formatDate(candidate.created_at) })}
                </span>
              </div>

              {socialLinks.length > 0 ? (
                <div className="cd-social-row">
                  {socialLinks.map((link) => (
                    <a key={link.key} href={link.href} target="_blank" rel="noreferrer" className="cd-social-link">
                      <span className="material-symbols-outlined">{link.icon}</span>
                      {link.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="cd-profile-hero-actions">
            {candidate.cv ? (
              <button type="button" className="cd-button cd-button--ghost" onClick={handleDownloadCV} disabled={downloading}>
                <span className="material-symbols-outlined">{downloading ? 'sync' : 'download'}</span>
                {downloading ? t('hr-candid-downloading') : t('hr-candid-download-cv')}
              </button>
            ) : null}
            {candidate.email ? (
              <a href={`mailto:${candidate.email}`} className="cd-button cd-button--primary">
                <span className="material-symbols-outlined">mail</span>
                {t('hr-candid-contact')}
              </a>
            ) : null}
            {candidate.email ? (
              <button type="button" className="cd-button cd-button--ghost" onClick={() => handleCopy(candidate.email, 'email')}>
                <span className="material-symbols-outlined">{copiedField === 'email' ? 'check' : 'content_copy'}</span>
                {copiedField === 'email' ? t('hr-candid-email-copied') : t('hr-candid-copy-email')}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="cd-profile-overview-grid" aria-label="Resume rapide du profil">
        <article className="cd-profile-card cd-profile-card--score">
          <div className="cd-profile-card-top">
            <span className="cd-profile-card-label">{t('hr-candid-card-match')}</span>
            <span className={`cd-pill cd-pill--${scoreMeta.tone}`}>{scoreMeta.label}</span>
          </div>

          <div className="cd-profile-score-wrap">
            <div className="cd-profile-score-ring" aria-hidden="true">
              <svg viewBox="0 0 88 88">
                <circle className="cd-profile-score-track" cx="44" cy="44" r="36" />
                <circle
                  className="cd-profile-score-fill"
                  cx="44"
                  cy="44"
                  r="36"
                  style={{
                    stroke: scoreMeta.color,
                    strokeDasharray: `${2 * Math.PI * 36}`,
                    strokeDashoffset: `${2 * Math.PI * 36 * (1 - score / 100)}`,
                  }}
                />
              </svg>
              <span>{score}%</span>
            </div>

            <div className="cd-profile-score-copy">
              <strong>{candidate.best_match_job || t('hr-candid-no-target-job')}</strong>
              <p>{scoreMeta.summary}</p>
            </div>
          </div>
        </article>

        <article className="cd-profile-card cd-profile-card--completion">
          <div className="cd-profile-card-top">
            <span className="cd-profile-card-label">{t('hr-candid-card-completion')}</span>
            <span className={`cd-pill cd-pill--${dossierTone}`}>
              {completedChecklistCount}/{dossierChecklist.length}
            </span>
          </div>

          <strong className="cd-profile-card-metric">{dossierCompletion}%</strong>
          <div className="cd-progress-bar" aria-hidden="true">
            <span style={{ width: `${dossierCompletion}%` }}></span>
          </div>
          <p className="cd-profile-card-text">{dossierSummary}</p>

          <div className="cd-profile-check-grid">
            {dossierChecklist.map((item) => (
              <div key={item.label} className={`cd-profile-check-line ${item.complete ? 'is-complete' : ''}`}>
                <span className="material-symbols-outlined">
                  {item.complete ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="cd-profile-card cd-profile-card--stage">
          <div className="cd-profile-card-top">
            <span className="cd-profile-card-label">{t('hr-candid-card-stage')}</span>
            {latestStatusMeta ? (
              <span className={`cd-pill cd-pill--${latestStatusMeta.tone}`}>
                <span className="material-symbols-outlined">{latestStatusMeta.icon}</span>
                {t(latestStatusMeta.labelKey)}
              </span>
            ) : null}
          </div>

          <div className="cd-profile-stage-copy">
            <strong>{latestStatusMeta ? t(latestStatusMeta.labelKey) : t('hr-candid-profile-to-qualify')}</strong>
            <p>{primaryApplication?.job_title || t('hr-candid-no-active-application')}</p>
          </div>

          {primaryApplication?.application_id ? (
            <button
              type="button"
              className="cd-button cd-button--ghost"
              onClick={() => navigate(`/hr/applications/${primaryApplication.application_id}`)}
            >
              <span className="material-symbols-outlined">open_in_new</span>
              {t('hr-candid-see-application')}
            </button>
          ) : (
            <button type="button" className="cd-button cd-button--ghost" onClick={() => setActiveTab('applications')}>
              <span className="material-symbols-outlined">fact_check</span>
              {t('hr-candid-see-applications')}
            </button>
          )}
        </article>
      </section>

      <div className="cd-profile-columns">
        <div className="cd-profile-main-column">
          <section className="cd-profile-section">
            <h3 className="cd-profile-section-title">
              <span className="cd-profile-section-line"></span>
              {t('hr-candid-about-section')}
            </h3>
            <div className="cd-profile-surface">
              <p className="cd-longform">
                {candidate.about || t('hr-candid-about-empty')}
              </p>
            </div>
          </section>

          <div className="cd-profile-split-grid">
            <section className="cd-profile-section">
              <h3 className="cd-profile-section-title">
                <span className="cd-profile-section-line"></span>
                {t('hr-candid-skills-section')}
              </h3>
              {skills.length > 0 ? (
                <div className="cd-skill-showcase">
                  <div className="cd-skill-summary-card">
                    <p className="cd-profile-card-label">{t('hr-candid-skill-quick-read')}</p>
                    <strong>{t('hr-candid-skills-detected', { count: skills.length })}</strong>
                    <p className="cd-profile-card-text">
                      {skills[0]
                        ? `${displayName} — ${skills[0]}`
                        : t('hr-candid-skills-section')}
                    </p>
                  </div>

                  <div className="cd-skill-highlight-grid">
                    {featuredSkills.map((skill, index) => (
                      <article key={skill} className="cd-skill-highlight-card">
                        <span className="cd-skill-rank">Top {index + 1}</span>
                        <strong>{skill}</strong>
                        <p>
                          {index === 0
                            ? t('hr-candid-skill-signal')
                            : index === 1
                              ? t('hr-candid-skill-recurring')
                              : index === 2
                                ? t('hr-candid-skill-support')
                                : t('hr-candid-skill-to-validate')}
                        </p>
                      </article>
                    ))}
                  </div>

                  {secondarySkills.length > 0 ? (
                    <div className="cd-skill-chip-wrap">
                      {secondarySkills.map((skill) => (
                        <span key={skill} className="cd-profile-pill">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="cd-empty">{t('hr-candid-skills-empty')}</div>
              )}
            </section>

            <section className="cd-profile-section">
              <h3 className="cd-profile-section-title">
                <span className="cd-profile-section-line"></span>
                {t('hr-candid-languages-section')}
              </h3>
              {languages.length > 0 ? (
                <div className="cd-profile-language-list">
                  {languages.map((language) => (
                    <div key={`${language.name}-${language.level}`} className="cd-profile-language-row">
                      <span>{language.name}</span>
                      <strong>{language.level || t('hr-candid-language-level-unknown')}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cd-empty">{t('hr-candid-languages-empty')}</div>
              )}
            </section>
          </div>

          <section className="cd-profile-section">
            <h3 className="cd-profile-section-title">
              <span className="cd-profile-section-line"></span>
              {t('hr-candid-career-section')}
            </h3>
            {experiences.length > 0 ? (
              <div className="cd-profile-timeline">
                {experiences.map((experience, index) => (
                  <article key={experience.id || `${experience.company || 'experience'}-${index}`} className="cd-profile-timeline-item">
                    <div className={`cd-profile-timeline-dot ${index === 0 ? 'is-current' : ''}`}></div>
                    <div className="cd-profile-timeline-copy">
                      <span className={`cd-profile-timeline-date ${index === 0 ? 'is-current' : ''}`}>
                        {formatDateRange(
                          experience.start_date || experience.startDate || experience.startYear || experience.start_year,
                          experience.end_date || experience.endDate || experience.endYear || experience.end_year,
                          experience.current || experience.ongoing
                        ) || t('hr-candid-period-unknown')}
                      </span>
                      <h4>{experience.title || experience.jobTitle || experience.position || ''}</h4>
                      <p className="cd-profile-timeline-meta">
                        {experience.company || experience.organization || ''}
                        {experience.location || experience.city ? ` - ${experience.location || experience.city}` : ''}
                      </p>
                      <p className="cd-item-description">
                        {experience.description || t('hr-candid-experience-no-desc')}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="cd-empty">{t('hr-candid-career-empty')}</div>
            )}
          </section>

          <div className="cd-profile-split-grid">
            <section className="cd-profile-section">
              <h3 className="cd-profile-section-title">
                <span className="cd-profile-section-line"></span>
                {t('hr-candid-education-section')}
              </h3>
              {educations.length > 0 ? (
                <div className="cd-profile-stack-list">
                  {educations.map((education, index) => (
                    <article key={education.id || `${education.institution || 'education'}-${index}`} className="cd-profile-list-card">
                      <strong>{education.institution || education.school || education.university || ''}</strong>
                      <p>{education.degree || education.field || education.level || ''}</p>
                      {(education.field_of_study || education.fieldOfStudy) ? (
                        <span>{education.field_of_study || education.fieldOfStudy}</span>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="cd-empty">{t('hr-candid-education-empty')}</div>
              )}
            </section>

            <section className="cd-profile-section">
              <h3 className="cd-profile-section-title">
                <span className="cd-profile-section-line"></span>
                {t('hr-candid-certifications-section')}
              </h3>
              {certificates.length > 0 ? (
                <div className="cd-profile-stack-list">
                  {certificates.map((certificate, index) => (
                    <article key={certificate.id || `${certificate.name || 'certificate'}-${index}`} className="cd-profile-cert-row">
                      <span className="material-symbols-outlined">verified</span>
                      <div>
                        <strong>{certificate.name || certificate.title || ''}</strong>
                        <p>{certificate.issuer || certificate.issuingOrganization || ''}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="cd-empty">{t('hr-candid-certifications-empty')}</div>
              )}
            </section>
          </div>

          {hobbies.length > 0 ? (
            <section className="cd-profile-section">
              <h3 className="cd-profile-section-title">
                <span className="cd-profile-section-line"></span>
                {t('hr-candid-hobbies-section')}
              </h3>
              <div className="cd-token-group">
                {hobbies.map((hobby) => (
                  <span key={hobby} className="cd-profile-pill">
                    {hobby}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="cd-profile-side-column">
          <section className="cd-profile-side-card cd-profile-side-card--highlight">
            <div className="cd-profile-side-head">
              <div className="cd-profile-side-title">
                <span className="material-symbols-outlined">psychology</span>
                <h3>{t('hr-candid-ai-analysis-title')}</h3>
              </div>

              <button type="button" className="cd-link-button" onClick={() => setActiveTab('analysis')}>
                {t('hr-candid-ai-full-analysis')}
              </button>
            </div>

            <div className="cd-profile-analysis-group">
              <div>
                <p className="cd-profile-analysis-label">{t('hr-candid-strengths')}</p>
                {strengths.length > 0 ? (
                  <ul className="cd-profile-bullet-list">
                    {strengths.slice(0, 3).map((strength) => (
                      <li key={strength} className="is-success">{strength}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="cd-empty-inline">{t('hr-candid-strengths-empty')}</p>
                )}
              </div>

              <div>
                <p className="cd-profile-analysis-label">{t('hr-candid-risks')}</p>
                {weaknesses.length > 0 ? (
                  <ul className="cd-profile-bullet-list">
                    {weaknesses.slice(0, 3).map((weakness) => (
                      <li key={weakness} className="is-warning">{weakness}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="cd-empty-inline">{t('hr-candid-risks-empty')}</p>
                )}
              </div>

              <div className="cd-profile-quote">
                <p>
                  {candidate.ai_justification
                    ? `"${candidate.ai_justification.slice(0, 230)}${candidate.ai_justification.length > 230 ? '...' : ''}"`
                    : t('hr-candid-ai-no-justification')}
                </p>
              </div>
            </div>
          </section>

          <section className="cd-profile-side-card">
            <div className="cd-profile-side-head">
              <div className="cd-profile-side-title">
                <span className="material-symbols-outlined">history</span>
                <h3>{t('hr-candid-app-history-title')}</h3>
              </div>

              <button type="button" className="cd-link-button" onClick={() => setActiveTab('applications')}>
                {t('hr-candid-app-history-see-all')}
              </button>
            </div>

            {profileApplications.length > 0 ? (
              <div className="cd-profile-history-list">
                {profileApplications.map((application, index) => {
                  const applicationStatusMeta = resolvedAppMeta(application.status);
                  const applicationDisplayScore = application.llm_score ?? application.ai_score;
                  const applicationScore = Math.round(Number(applicationDisplayScore || 0));

                  return (
                    <article
                      key={application.application_id || `${application.job_title || 'application'}-${index}`}
                      className={`cd-profile-history-card ${index > 0 ? 'is-secondary' : ''}`}
                    >
                      <div className="cd-profile-history-top">
                        <div>
                          <p className="cd-profile-history-title">{application.job_title || t('hr-candid-app-no-title')}</p>
                          <p className="cd-profile-history-date">{t('hr-candid-app-posted-on', { date: formatDate(application.created_at) })}</p>
                        </div>
                        <span className={`cd-pill cd-pill--${applicationStatusMeta.tone}`}>{applicationStatusMeta.label}</span>
                      </div>

                      <div className="cd-profile-history-bottom">
                        <span>{applicationDisplayScore ? t('hr-candid-app-score-label') : t('hr-candid-app-status-label')}</span>
                        <strong>{applicationDisplayScore ? `${applicationScore}/100` : applicationStatusMeta.label}</strong>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="cd-empty">{t('hr-candid-app-history-empty')}</div>
            )}
          </section>

          <section className="cd-profile-side-card">
            <div className="cd-profile-side-head">
              <div className="cd-profile-side-title">
                <span className="material-symbols-outlined">edit_note</span>
                <h3>{t('hr-candid-recruiter-eval-title')}</h3>
              </div>
              {noteSaved ? (
                <span className="cd-section-badge">{t('hr-candid-eval-saved')}</span>
              ) : candidate?.current_user_rating ? (
                <span className="cd-section-badge">{t('hr-candid-eval-exists')}</span>
              ) : null}
            </div>

            <div className="cd-profile-rating-block">
              <div className="cd-profile-rating-head">
                <div>
                  <p className="cd-profile-analysis-label">{t('hr-candid-hr-score')}</p>
                  <strong>{recruiterScoreMeta ? recruiterScoreMeta.label : t('hr-candid-not-rated')}</strong>
                </div>
                {recruiterScoreMeta ? <span className="cd-section-badge">{recruiterScoreMeta.title}</span> : null}
              </div>

              <div className="cd-profile-rating-row" role="radiogroup" aria-label={t('hr-candid-hr-score')}>
                {HR_SCORE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    className={`cd-profile-rating-button ${recruiterScore === option.value ? 'is-active' : ''}`}
                    onClick={() => {
                      setRecruiterScore(option.value);
                      setNoteSaved(false);
                      setReviewError('');
                    }}
                    aria-checked={recruiterScore === option.value}
                  >
                    <span className="cd-profile-rating-value">{option.value}</span>
                    <span className="cd-profile-rating-title">{t(option.titleKey)}</span>
                  </button>
                ))}
              </div>

              <p className="cd-profile-note-help">
                {recruiterScoreMeta
                  ? recruiterScoreMeta.helper
                  : t('hr-candid-score-helper-default')}
              </p>

              <div className="cd-profile-rating-meta">
                <span>{ratingsCount > 0 ? t('hr-candid-ratings-count', { count: ratingsCount }) : t('hr-candid-no-ratings')}</span>
                {ratingsAverage ? <strong>{t('hr-candid-ratings-average', { avg: ratingsAverage })}</strong> : null}
              </div>
            </div>

            <label className="cd-profile-note-label" htmlFor="candidate-note">
              {t('hr-candid-observation-label')}
            </label>
            <textarea
              id="candidate-note"
              className="cd-profile-note-input"
              value={recruiterNote}
              onChange={(event) => {
                setRecruiterNote(event.target.value);
                setNoteSaved(false);
              }}
              placeholder={t('hr-candid-observation-placeholder')}
            />
            <p className="cd-profile-note-help">{t('hr-candid-note-local')}</p>
            {reviewError ? <p className="cd-profile-review-error">{reviewError}</p> : null}
            <button
              type="button"
              className="cd-button cd-button--primary"
              onClick={handleSaveRecruiterNote}
              disabled={savingReview}
            >
              <span className="material-symbols-outlined">{savingReview ? 'sync' : 'save'}</span>
              {savingReview ? t('hr-candid-saving') : t('hr-candid-save-eval')}
            </button>
          </section>
        </div>
      </div>
    </div>
  );

  const renderJourneyTab = () => (
    <div className="cd-journey-tab">
      <section className="cd-journey-hero-banner">
        <div className="cd-journey-hero-main">
          <div className="cd-journey-hero-profile">
            <div className="cd-journey-hero-avatar">
              {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{initials}</span>}
              <div className={`cd-journey-hero-verified ${qualificationSummary.verified > 0 ? 'is-visible' : ''}`}>
                <span className="material-symbols-outlined">verified</span>
              </div>
            </div>

            <div className="cd-journey-hero-copy">
              <h2>{displayName}</h2>
              <p>
                {candidate.title || t('hr-candid-profile-to-qualify')}
                {(candidate.address || candidate.location) ? ` - ${candidate.address || candidate.location}` : ''}
              </p>
              <span>{journeySpotlightSummary}</span>
            </div>
          </div>

          <div className="cd-journey-hero-stats">
            <div className="cd-journey-hero-stat">
              <span>{t('hr-candid-journey-score-match')}</span>
              <strong>{score}%</strong>
            </div>
            <div className="cd-journey-hero-stat">
              <span>{t('hr-candid-journey-seniority')}</span>
              <strong>{experienceSpanLabel || t('hr-candid-journey-to-confirm')}</strong>
            </div>
            <div className="cd-journey-hero-stat">
              <span>{t('hr-candid-journey-status')}</span>
              <strong>{latestStatusMeta ? t(latestStatusMeta.labelKey) : t('hr-candid-profile-to-qualify')}</strong>
            </div>
            <div className="cd-journey-hero-stat">
              <span>{t('hr-candid-journey-verification')}</span>
              <strong>{qualificationSummary.verified}/{qualificationSummary.total_items || 0}</strong>
            </div>
          </div>
        </div>
      </section>

      {verificationFeedback.message ? (
        <div className={`cd-verification-feedback cd-verification-feedback--${verificationFeedback.tone || 'success'}`}>
          <span className="material-symbols-outlined">
            {verificationFeedback.tone === 'error' ? 'error' : 'check_circle'}
          </span>
          <span>{verificationFeedback.message}</span>
        </div>
      ) : null}

      <section className="cd-journey-summary-strip">
        {verificationOverviewCards.map((card) => (
          <article key={card.label} className={`cd-journey-summary-chip cd-journey-summary-chip--${card.tone}`}>
            <span className="material-symbols-outlined">{card.icon}</span>
            <div>
              <strong>{card.value}</strong>
              <span>{card.label}</span>
            </div>
          </article>
        ))}
      </section>

      {renderJourneyReviewSection('experiences', sortedJourneyExperiences)}
      {renderJourneyReviewSection('educations', sortedJourneyEducations)}
      {renderJourneyReviewSection('certificates', sortedJourneyCertificates)}
    </div>
  );

  const renderApplicationsTab = () => (
    <div className="cd-applications-tab">
      {applications.length > 0 ? (
        <>
          <section className="cd-applications-overview-grid" aria-label="Vue pipeline du candidat">
            <article className="cd-applications-overview-card">
              <div className="cd-applications-overview-icon">
                <span className="material-symbols-outlined">fact_check</span>
              </div>
              <div>
                <p className="cd-profile-card-label">{t('hr-candid-apps-total')}</p>
                <strong>{applications.length}</strong>
                <span>{t('hr-candid-apps-pipeline-history')}</span>
              </div>
            </article>

            <article className="cd-applications-overview-card">
              <div className="cd-applications-overview-icon">
                <span className="material-symbols-outlined">pending_actions</span>
              </div>
              <div>
                <p className="cd-profile-card-label">{t('hr-candid-apps-ongoing')}</p>
                <strong>{openApplicationsCount}</strong>
                <span>{t('hr-candid-apps-closed', { count: applications.length - openApplicationsCount })}</span>
              </div>
            </article>

            <article className="cd-applications-overview-card">
              <div className="cd-applications-overview-icon">
                <span className="material-symbols-outlined">query_stats</span>
              </div>
              <div>
                <p className="cd-profile-card-label">{t('hr-candid-apps-avg-score')}</p>
                <strong>{averageScore}%</strong>
                <span>{t('hr-candid-apps-consolidated-reading')}</span>
              </div>
            </article>

            <article className="cd-applications-overview-card">
              <div className="cd-applications-overview-icon">
                <span className="material-symbols-outlined">schedule</span>
              </div>
              <div>
                <p className="cd-profile-card-label">{t('hr-candid-apps-last-activity')}</p>
                <strong>{latestApplication ? formatDate(latestApplication.updated_at || latestApplication.created_at) : formatDate(candidate.created_at)}</strong>
                <span>{latestStatusMeta ? t(latestStatusMeta.labelKey) : t('hr-candid-profile-to-qualify')}</span>
              </div>
            </article>
          </section>

          {latestApplication ? (
            <section className="cd-applications-featured-card">
              <div className="cd-applications-featured-main">
                <div className="cd-applications-featured-head">
                  <div>
                    <p className="cd-profile-card-label">{t('hr-candid-apps-main-application')}</p>
                    <h3>{latestApplication.job_title || t('hr-candid-app-no-title')}</h3>
                    <p>
                      {t('hr-candid-apps-filed-on', { date: formatDate(latestApplication.created_at) })}
                      {latestApplication.updated_at ? ` - ${t('hr-candid-apps-updated', { date: formatDate(latestApplication.updated_at) })}` : ''}
                    </p>
                  </div>

                  <div className="cd-applications-featured-side">
                    {latestStatusMeta ? (
                      <span className={`cd-pill cd-pill--${latestStatusMeta.tone}`}>
                        <span className="material-symbols-outlined">{latestStatusMeta.icon}</span>
                        {t(latestStatusMeta.labelKey)}
                      </span>
                    ) : null}
                    <span className="cd-applications-score-pill">{Math.round(Number(latestApplication.llm_score ?? latestApplication.ai_score ?? 0)) || 0}%</span>
                  </div>
                </div>

                <p className="cd-applications-featured-summary">
                  {latestApplication.ai_justification
                    ? `${latestApplication.ai_justification.slice(0, 260)}${latestApplication.ai_justification.length > 260 ? '...' : ''}`
                    : t('hr-candid-apps-no-ai-justification')}
                </p>

                <div className="cd-applications-meta-row">
                  <span className="cd-journey-inline-chip">
                    <span className="material-symbols-outlined">work</span>
                    {latestApplication.job_title || t('hr-candid-app-no-title')}
                  </span>
                  <span className="cd-journey-inline-chip">
                    <span className="material-symbols-outlined">schedule</span>
                    {latestApplication.updated_at
                      ? t('hr-candid-apps-updated', { date: formatDate(latestApplication.updated_at) })
                      : t('hr-candid-apps-created-on', { date: formatDate(latestApplication.created_at) })}
                  </span>
                  {latestApplication.application_id ? (
                    <span className="cd-journey-inline-chip">
                      <span className="material-symbols-outlined">tag</span>
                      ID {latestApplication.application_id}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="cd-applications-featured-actions">
                {latestApplication.application_id ? (
                  <button
                    type="button"
                    className="cd-button cd-button--primary"
                    onClick={() => navigate(`/hr/applications/${latestApplication.application_id}`)}
                  >
                    <span className="material-symbols-outlined">open_in_new</span>
                    {t('hr-candid-apps-open-tracking')}
                  </button>
                ) : null}
                <button type="button" className="cd-button cd-button--ghost" onClick={() => setActiveTab('analysis')}>
                  <span className="material-symbols-outlined">psychology</span>
                  {t('hr-candid-apps-view-ai')}
                </button>
              </div>
            </section>
          ) : null}

          {secondaryApplications.length > 0 ? (
            <section className="cd-applications-panel">
              <div className="cd-journey-panel-head">
                <div>
                  <p className="cd-profile-card-label">{t('hr-candid-apps-history-label')}</p>
                  <h3>{t('hr-candid-apps-other-title')}</h3>
                </div>
                <span className="cd-section-badge">{secondaryApplications.length}</span>
              </div>

              <div className="cd-applications-grid">
                {secondaryApplications.map((application, index) => {
                  const statusMeta = resolvedAppMeta(application.status);
                  const applicationDisplayScore = application.llm_score ?? application.ai_score;
                  const applicationScoreMeta = getScoreMeta(Number(applicationDisplayScore || 0), application.job_title);
                  const applicationScore = Math.round(Number(applicationDisplayScore || 0));

                  return (
                    <article
                      key={application.application_id || `${application.job_title || 'application'}-${index}`}
                      className={`cd-application-card cd-application-card--rich cd-application-card--${statusMeta.tone}`}
                    >
                      <div className="cd-application-main">
                        <div className="cd-application-headline">
                          <div>
                            <h3>{application.job_title || t('hr-candid-app-no-title')}</h3>
                            <p>
                              {t('hr-candid-apps-filed-on', { date: formatDate(application.created_at) })}
                              {application.updated_at ? ` - ${t('hr-candid-apps-updated', { date: formatDate(application.updated_at) })}` : ''}
                            </p>
                          </div>

                          <div className="cd-application-side">
                            <span className={`cd-pill cd-pill--${statusMeta.tone}`}>
                              <span className="material-symbols-outlined">{statusMeta.icon}</span>
                              {statusMeta.label}
                            </span>
                            <strong style={{ color: applicationScoreMeta.color }}>
                              {applicationDisplayScore ? `${applicationScore}%` : t('hr-candid-apps-not-rated')}
                            </strong>
                          </div>
                        </div>

                        <p className="cd-item-description">
                          {application.ai_justification
                            ? `${application.ai_justification.slice(0, 180)}${application.ai_justification.length > 180 ? '...' : ''}`
                            : t('hr-candid-apps-no-ai-justification')}
                        </p>
                      </div>

                      <div className="cd-application-actions">
                        {application.application_id ? (
                          <button
                            type="button"
                            className="cd-button cd-button--ghost"
                            onClick={() => navigate(`/hr/applications/${application.application_id}`)}
                          >
                            <span className="material-symbols-outlined">open_in_new</span>
                            {t('hr-candid-apps-open-tracking')}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <div className="cd-empty">{t('hr-candid-app-history-empty')}</div>
      )}
    </div>
  );

  const renderAnalysisTab = () => (
    <div className="cd-workspace">
      <SectionCard title={t('hr-candid-analysis-synthesis')} icon="auto_awesome" className="cd-span-7">
        <div className="cd-reading-block">
          <div className="cd-reading-header">
            <strong>{scoreMeta.label}</strong>
            <span className={`cd-pill cd-pill--${scoreMeta.tone}`}>{score}%</span>
          </div>
          <p className="cd-longform">
            {candidate.ai_justification
              ? showFullAi
                ? candidate.ai_justification
                : `${candidate.ai_justification.slice(0, 520)}${candidate.ai_justification.length > 520 ? '...' : ''}`
              : t('hr-candid-analysis-no-justification')}
          </p>
        </div>

        {candidate.ai_justification ? (
          <button type="button" className="cd-link-button" onClick={() => setShowFullAi((current) => !current)}>
            {showFullAi ? t('hr-candid-analysis-see-less') : t('hr-candid-analysis-see-all')}
          </button>
        ) : null}
      </SectionCard>

      <SectionCard title={t('hr-candid-analysis-strengths')} icon="check_circle" className="cd-span-5">
        {strengths.length > 0 ? (
          <div className="cd-token-group">
            {strengths.map((strength) => (
              <span key={strength} className="cd-token cd-token--success">
                {strength}
              </span>
            ))}
          </div>
        ) : (
          <div className="cd-empty">{t('hr-candid-analysis-strengths-empty')}</div>
        )}
      </SectionCard>

      <SectionCard title={t('hr-candid-analysis-warnings')} icon="warning" className="cd-span-5">
        {weaknesses.length > 0 ? (
          <div className="cd-token-group">
            {weaknesses.map((weakness) => (
              <span key={weakness} className="cd-token cd-token--warning">
                {weakness}
              </span>
            ))}
          </div>
        ) : (
          <div className="cd-empty">{t('hr-candid-analysis-warnings-empty')}</div>
        )}
      </SectionCard>

      <SectionCard title={t('hr-candid-analysis-context')} icon="rule" className="cd-span-7">
        <div className="cd-facts-grid">
          <div className="cd-fact-card">
            <span className="cd-fact-label">{t('hr-candid-analysis-current-status')}</span>
            <strong>{latestStatusMeta ? t(latestStatusMeta.labelKey) : t('hr-candid-profile-to-qualify')}</strong>
          </div>
          <div className="cd-fact-card">
            <span className="cd-fact-label">{t('hr-candid-analysis-main-job')}</span>
            <strong>{candidate.best_match_job || t('hr-candid-analysis-no-application')}</strong>
          </div>
          <div className="cd-fact-card">
            <span className="cd-fact-label">{t('hr-candid-analysis-avg-score')}</span>
            <strong>{averageScore}%</strong>
          </div>
          <div className="cd-fact-card">
            <span className="cd-fact-label">{t('hr-candid-analysis-last-activity')}</span>
            <strong>{latestApplication ? formatDate(latestApplication.updated_at || latestApplication.created_at) : formatDate(candidate.created_at)}</strong>
          </div>
        </div>
      </SectionCard>

      {/* CNN Model Analysis */}
      {cnnLoading && (
        <SectionCard title={t('hr-candid-cnn-loading-title')} icon="auto_awesome" className="cd-span-12">
          <div className="cd-cnn-loading">
            <span className="material-symbols-outlined cd-cnn-spin">hourglass_empty</span>
            <span>{t('hr-candid-cnn-loading')}</span>
          </div>
        </SectionCard>
      )}

      {cnnData && !cnnLoading && (
        <>
          <SectionCard title={t('hr-candid-cnn-profiles-title')} icon="travel_explore" className="cd-span-7">
            <div className="cd-cnn-profiles">
              {(cnnData.profile_recommendation || []).slice(0, 4).map((item) => {
                const pct = Math.round((item.confidence || 0) * 100);
                return (
                  <div key={item.profile} className="cd-cnn-profile-row">
                    <span className="cd-cnn-profile-name">{item.profile.replace(/_/g, ' ')}</span>
                    <div className="cd-cnn-bar-track">
                      <div className="cd-cnn-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="cd-cnn-pct">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title={t('hr-candid-cnn-skills-title')} icon="star" className="cd-span-5">
            <div className="cd-token-group">
              {(cnnData.skill_importance || []).slice(0, 8).map((item) => (
                <span key={item.skill} className="cd-token cd-token--success">{item.skill}</span>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={t('hr-candid-cnn-liaison-title')} icon="hub" className="cd-span-12">
            <div className="cd-token-group">
              {(cnnData.skill_liaison || []).slice(0, 12).map((item) => (
                <span key={item.skill} className="cd-token cd-token--warning">{item.skill}</span>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );

  return (
    <div className={`candidat-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
      <HRSidebar />

      <main className="main-content-area">
        <div className="cd-shell">
          <header className="cd-page-header">
            <div className="cd-page-heading">
              <div className="cd-breadcrumbs" aria-label="Navigation de la page candidat">
                <button type="button" className="cd-breadcrumb-btn" onClick={() => navigate('/hr/candidats')}>
                  <span className="material-symbols-outlined">arrow_back</span>
                  {t('hr-candid-breadcrumb-list')}
                </button>
                <span className="cd-breadcrumb-separator">/</span>
                <span className="cd-breadcrumb-current">{t('hr-candid-breadcrumb-current')}</span>
              </div>

              <h1>{displayName}</h1>
              <p>{candidate.title || t('hr-candid-profile-to-qualify')} - {t('hr-candid-header-desc')}</p>
            </div>
          </header>

          <nav className="cd-tabbar" aria-label="Navigation des sections">
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`cd-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                {t(tab.labelKey)}
              </button>
            ))}
          </nav>

          {activeTab === 'profile' ? renderProfileTab() : null}
          {activeTab === 'journey' ? renderJourneyTab() : null}
          {activeTab === 'applications' ? renderApplicationsTab() : null}
          {activeTab === 'analysis' ? renderAnalysisTab() : null}
        </div>

        <CVViewerModal
          isOpen={documentViewer.isOpen}
          onClose={() => setDocumentViewer((current) => ({ ...current, isOpen: false }))}
          documentEndpoint={documentViewer.endpoint}
          documentTitle={documentViewer.title}
          documentSubtitle={documentViewer.subtitle}
          emptyMessage={documentViewer.emptyMessage}
          candidateName={displayName}
        />
      </main>
    </div>
  );
};

export default CandidatDetail;
