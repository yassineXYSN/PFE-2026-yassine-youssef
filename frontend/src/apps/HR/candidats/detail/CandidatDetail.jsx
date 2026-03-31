import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SERVER_URL, apiFetch } from '../../../../core/api';
import { useTheme } from '../../context/ThemeContext';
import HRSidebar from '../../components/HRSidebar';
import './CandidatDetail.css';

const STATUS_ALIASES = {
  pending: 'new',
  reviewed: 'in_review',
  quiz: 'technical_test',
  offer: 'accepted',
};

const APPLICATION_STATUS_META = {
  new: { label: 'Nouveau', tone: 'neutral', icon: 'forward_to_inbox' },
  in_review: { label: 'En revue', tone: 'steady', icon: 'manage_search' },
  technical_test: { label: 'Test technique', tone: 'warm', icon: 'quiz' },
  interview: { label: 'Entretien', tone: 'strong', icon: 'groups' },
  accepted: { label: 'Offre acceptee', tone: 'success', icon: 'celebration' },
  rejected: { label: 'Rejete', tone: 'danger', icon: 'cancel' },
};

const DETAIL_TABS = [
  { id: 'profile', label: 'Profil', icon: 'person' },
  { id: 'journey', label: 'Parcours', icon: 'work_history' },
  { id: 'applications', label: 'Candidatures', icon: 'fact_check' },
  { id: 'analysis', label: 'Analyse IA', icon: 'auto_awesome' },
];

const HR_SCORE_OPTIONS = [
  { value: 1, label: '1/5', title: 'Faible', helper: 'Profil peu aligne avec le besoin actuel.' },
  { value: 2, label: '2/5', title: 'Limite', helper: 'Quelques signaux existent mais le fit reste fragile.' },
  { value: 3, label: '3/5', title: 'Correct', helper: 'Base exploitable avec verification complementaire.' },
  { value: 4, label: '4/5', title: 'Solide', helper: 'Bon niveau de confiance pour poursuivre le process.' },
  { value: 5, label: '5/5', title: 'Priorite', helper: 'Profil a accelerer et presenter rapidement.' },
];

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value, fallback = 'Date inconnue') => {
  const parsed = toDate(value);
  if (!parsed) return fallback;
  return parsed.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateRange = (start, end, ongoing) => {
  const startLabel = start || '';
  const endLabel = ongoing ? 'Present' : end || '';
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel || endLabel || 'Periode non renseignee';
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
  return fullName || candidate?.email || 'Candidat';
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

  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [showFullAi, setShowFullAi] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [recruiterNote, setRecruiterNote] = useState('');
  const [recruiterScore, setRecruiterScore] = useState(0);
  const [noteSaved, setNoteSaved] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

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
          setError('Impossible de charger le profil de ce candidat.');
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
      window.alert('Erreur lors du telechargement du CV.');
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
      setReviewError('Choisissez une note RH entre 1 et 5 avant d enregistrer.');
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
      setReviewError(storageError.message || 'Impossible d enregistrer cette evaluation pour le moment.');
    } finally {
      setSavingReview(false);
    }
  };

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
        label: 'Coordonnees directes',
        detail: candidate?.email || candidate?.phone || 'Email ou telephone manquant',
        complete: Boolean(candidate?.email || candidate?.phone),
        icon: 'contact_mail',
      },
      {
        label: 'CV exploitable',
        detail: candidate?.cv ? 'Pret pour revue et partage' : 'CV non fourni',
        complete: Boolean(candidate?.cv),
        icon: 'description',
      },
      {
        label: 'Parcours professionnel',
        detail: profileData.experiences.length > 0
          ? `${profileData.experiences.length} experience${profileData.experiences.length > 1 ? 's' : ''} visible${profileData.experiences.length > 1 ? 's' : ''}`
          : 'Experience non renseignee',
        complete: profileData.experiences.length > 0,
        icon: 'work_history',
      },
      {
        label: 'Competences visibles',
        detail: profileData.skills.length > 0
          ? `${profileData.skills.length} competence${profileData.skills.length > 1 ? 's' : ''} identifiee${profileData.skills.length > 1 ? 's' : ''}`
          : 'Competences a completer',
        complete: profileData.skills.length > 0,
        icon: 'psychology',
      },
      {
        label: 'Candidature active',
        detail: latestApplication?.job_title || 'Aucune candidature rattachee',
        complete: Boolean(latestApplication),
        icon: 'fact_check',
      },
    ],
    [candidate, latestApplication, profileData.experiences.length, profileData.skills.length]
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

    if (candidate?.best_match_job && candidate.best_match_job !== 'Aucune candidature') {
      parts.push(`${profileData.displayName} ressort surtout sur ${candidate.best_match_job}.`);
    } else {
      parts.push(`${profileData.displayName} reste a qualifier pour le bon poste.`);
    }

    if (latestStatusMeta) {
      parts.push(`Le dossier est actuellement en ${latestStatusMeta.label.toLowerCase()}.`);
    }

    if (profileData.strengths[0]) {
      parts.push(`Signal fort: ${profileData.strengths[0]}.`);
    } else if (profileData.skills[0]) {
      parts.push(`Competence la plus visible en premiere lecture: ${profileData.skills[0]}.`);
    }

    if (!candidate?.cv) {
      parts.push('Le CV n est pas encore disponible.');
    } else if (profileData.weaknesses[0]) {
      parts.push(`Point a verifier: ${profileData.weaknesses[0]}.`);
    }

    return parts.join(' ');
  }, [candidate, latestStatusMeta, profileData]);

  if (loading) {
    return (
      <div className={`candidat-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
        <HRSidebar />
        <main className="main-content-area">
          <div className="cd-state-shell">
            <div className="cd-state-card">
              <span className="material-symbols-outlined">person_search</span>
              <h2>Chargement du profil</h2>
              <p>Nous preparons la vue complete du candidat.</p>
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
              <h2>{error || 'Profil introuvable'}</h2>
              <p>Retournez a la liste pour poursuivre votre revue des candidats.</p>
              <button type="button" className="cd-button cd-button--ghost" onClick={() => navigate('/hr/candidats')}>
                <span className="material-symbols-outlined">arrow_back</span>
                Retour a la liste
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
    ? 'Le dossier est bien structure et pret pour une revue rapide.'
    : dossierCompletion >= 60
      ? 'Le profil est exploitable mais quelques pieces restent a consolider.'
      : 'Plusieurs informations manquent encore pour fluidifier la decision.';
  const experienceSpanLabel = getExperienceSpanLabel(experiences);
  const heroMeta = [candidate.address || candidate.location, experienceSpanLabel].filter(Boolean).join(' - ');
  const profileApplications = applications.slice(0, 3);
  const featuredSkills = skills.slice(0, 4);
  const secondarySkills = skills.slice(4);
  const recruiterScoreMeta = HR_SCORE_OPTIONS.find((option) => option.value === recruiterScore) || null;
  const ratingsCount = Number(candidate?.ratings_count || 0);
  const ratingsAverage = candidate?.ratings_average;
  const currentExperience = experiences[0] || null;
  const leadEducation = educations[0] || null;
  const leadCertificate = certificates[0] || null;
  const openApplicationsCount = applications.filter((application) => {
    const normalizedStatus = normalizeApplicationStatus(application.status);
    return normalizedStatus !== 'accepted' && normalizedStatus !== 'rejected';
  }).length;
  const secondaryApplications = applications.slice(1);

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
              <p className="cd-profile-hero-role">{candidate.title || 'Profil a qualifier'}</p>
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
                  Inscrit le {formatDate(candidate.created_at)}
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
                {downloading ? 'Telechargement...' : 'Telecharger CV'}
              </button>
            ) : null}
            {candidate.email ? (
              <a href={`mailto:${candidate.email}`} className="cd-button cd-button--primary">
                <span className="material-symbols-outlined">mail</span>
                Contacter
              </a>
            ) : null}
            {candidate.email ? (
              <button type="button" className="cd-button cd-button--ghost" onClick={() => handleCopy(candidate.email, 'email')}>
                <span className="material-symbols-outlined">{copiedField === 'email' ? 'check' : 'content_copy'}</span>
                {copiedField === 'email' ? 'Email copie' : 'Copier email'}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="cd-profile-overview-grid" aria-label="Resume rapide du profil">
        <article className="cd-profile-card cd-profile-card--score">
          <div className="cd-profile-card-top">
            <span className="cd-profile-card-label">Adequation poste</span>
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
              <strong>{candidate.best_match_job || 'Aucun poste cible'}</strong>
              <p>{scoreMeta.summary}</p>
            </div>
          </div>
        </article>

        <article className="cd-profile-card cd-profile-card--completion">
          <div className="cd-profile-card-top">
            <span className="cd-profile-card-label">Completude du dossier</span>
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
            <span className="cd-profile-card-label">Etape actuelle</span>
            {latestStatusMeta ? (
              <span className={`cd-pill cd-pill--${latestStatusMeta.tone}`}>
                <span className="material-symbols-outlined">{latestStatusMeta.icon}</span>
                {latestStatusMeta.label}
              </span>
            ) : null}
          </div>

          <div className="cd-profile-stage-copy">
            <strong>{latestStatusMeta ? latestStatusMeta.label : 'Profil a qualifier'}</strong>
            <p>{primaryApplication?.job_title || 'Aucune candidature active rattachee'}</p>
          </div>

          {primaryApplication?.application_id ? (
            <button
              type="button"
              className="cd-button cd-button--ghost"
              onClick={() => navigate(`/hr/applications/${primaryApplication.application_id}`)}
            >
              <span className="material-symbols-outlined">open_in_new</span>
              Voir candidature
            </button>
          ) : (
            <button type="button" className="cd-button cd-button--ghost" onClick={() => setActiveTab('applications')}>
              <span className="material-symbols-outlined">fact_check</span>
              Voir les candidatures
            </button>
          )}
        </article>
      </section>

      <div className="cd-profile-columns">
        <div className="cd-profile-main-column">
          <section className="cd-profile-section">
            <h3 className="cd-profile-section-title">
              <span className="cd-profile-section-line"></span>
              A propos
            </h3>
            <div className="cd-profile-surface">
              <p className="cd-longform">
                {candidate.about || 'Aucune biographie n a ete ajoutee pour le moment. Utilisez les experiences, les competences et les candidatures pour qualifier le profil.'}
              </p>
            </div>
          </section>

          <div className="cd-profile-split-grid">
            <section className="cd-profile-section">
              <h3 className="cd-profile-section-title">
                <span className="cd-profile-section-line"></span>
                Competences
              </h3>
              {skills.length > 0 ? (
                <div className="cd-skill-showcase">
                  <div className="cd-skill-summary-card">
                    <p className="cd-profile-card-label">Lecture rapide</p>
                    <strong>{skills.length} competences detectees</strong>
                    <p className="cd-profile-card-text">
                      {skills[0]
                        ? `${displayName} met surtout en avant ${skills[0]} en premiere lecture.`
                        : 'Les competences principales sont disponibles pour la qualification.'}
                    </p>
                  </div>

                  <div className="cd-skill-highlight-grid">
                    {featuredSkills.map((skill, index) => (
                      <article key={skill} className="cd-skill-highlight-card">
                        <span className="cd-skill-rank">Top {index + 1}</span>
                        <strong>{skill}</strong>
                        <p>
                          {index === 0
                            ? 'Signal fort du profil'
                            : index === 1
                              ? 'Competence recurrente'
                              : index === 2
                                ? 'Point d appui utile'
                                : 'A valider en entretien'}
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
                <div className="cd-empty">Aucune competence technique renseignee.</div>
              )}
            </section>

            <section className="cd-profile-section">
              <h3 className="cd-profile-section-title">
                <span className="cd-profile-section-line"></span>
                Langues
              </h3>
              {languages.length > 0 ? (
                <div className="cd-profile-language-list">
                  {languages.map((language) => (
                    <div key={`${language.name}-${language.level}`} className="cd-profile-language-row">
                      <span>{language.name}</span>
                      <strong>{language.level || 'Niveau non renseigne'}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cd-empty">Aucune langue renseignee.</div>
              )}
            </section>
          </div>

          <section className="cd-profile-section">
            <h3 className="cd-profile-section-title">
              <span className="cd-profile-section-line"></span>
              Parcours professionnel
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
                        )}
                      </span>
                      <h4>{experience.title || experience.jobTitle || experience.position || 'Poste'}</h4>
                      <p className="cd-profile-timeline-meta">
                        {experience.company || experience.organization || 'Entreprise'}
                        {experience.location || experience.city ? ` - ${experience.location || experience.city}` : ''}
                      </p>
                      <p className="cd-item-description">
                        {experience.description || 'Aucune description complementaire pour cette experience.'}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="cd-empty">Aucune experience professionnelle renseignee.</div>
            )}
          </section>

          <div className="cd-profile-split-grid">
            <section className="cd-profile-section">
              <h3 className="cd-profile-section-title">
                <span className="cd-profile-section-line"></span>
                Formation
              </h3>
              {educations.length > 0 ? (
                <div className="cd-profile-stack-list">
                  {educations.map((education, index) => (
                    <article key={education.id || `${education.institution || 'education'}-${index}`} className="cd-profile-list-card">
                      <strong>{education.institution || education.school || education.university || 'Etablissement'}</strong>
                      <p>{education.degree || education.field || education.level || 'Diplome'}</p>
                      {(education.field_of_study || education.fieldOfStudy) ? (
                        <span>{education.field_of_study || education.fieldOfStudy}</span>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="cd-empty">Aucune formation renseignee.</div>
              )}
            </section>

            <section className="cd-profile-section">
              <h3 className="cd-profile-section-title">
                <span className="cd-profile-section-line"></span>
                Certifications
              </h3>
              {certificates.length > 0 ? (
                <div className="cd-profile-stack-list">
                  {certificates.map((certificate, index) => (
                    <article key={certificate.id || `${certificate.name || 'certificate'}-${index}`} className="cd-profile-cert-row">
                      <span className="material-symbols-outlined">verified</span>
                      <div>
                        <strong>{certificate.name || certificate.title || 'Certification'}</strong>
                        <p>{certificate.issuer || certificate.issuingOrganization || 'Organisme'}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="cd-empty">Aucune certification enregistree.</div>
              )}
            </section>
          </div>

          {hobbies.length > 0 ? (
            <section className="cd-profile-section">
              <h3 className="cd-profile-section-title">
                <span className="cd-profile-section-line"></span>
                Centres d interet
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
                <h3>Analyse IA decision</h3>
              </div>

              <button type="button" className="cd-link-button" onClick={() => setActiveTab('analysis')}>
                Analyse complete
              </button>
            </div>

            <div className="cd-profile-analysis-group">
              <div>
                <p className="cd-profile-analysis-label">Points forts</p>
                {strengths.length > 0 ? (
                  <ul className="cd-profile-bullet-list">
                    {strengths.slice(0, 3).map((strength) => (
                      <li key={strength} className="is-success">{strength}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="cd-empty-inline">Aucun point fort explicite isole pour le moment.</p>
                )}
              </div>

              <div>
                <p className="cd-profile-analysis-label">Risques potentiels</p>
                {weaknesses.length > 0 ? (
                  <ul className="cd-profile-bullet-list">
                    {weaknesses.slice(0, 3).map((weakness) => (
                      <li key={weakness} className="is-warning">{weakness}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="cd-empty-inline">Aucun point de vigilance detaille n a ete remonte.</p>
                )}
              </div>

              <div className="cd-profile-quote">
                <p>
                  {candidate.ai_justification
                    ? `"${candidate.ai_justification.slice(0, 230)}${candidate.ai_justification.length > 230 ? '...' : ''}"`
                    : 'Aucune justification IA detaillee n est disponible pour le moment.'}
                </p>
              </div>
            </div>
          </section>

          <section className="cd-profile-side-card">
            <div className="cd-profile-side-head">
              <div className="cd-profile-side-title">
                <span className="material-symbols-outlined">history</span>
                <h3>Historique des candidatures</h3>
              </div>

              <button type="button" className="cd-link-button" onClick={() => setActiveTab('applications')}>
                Voir tout
              </button>
            </div>

            {profileApplications.length > 0 ? (
              <div className="cd-profile-history-list">
                {profileApplications.map((application, index) => {
                  const applicationStatusMeta = getApplicationStatusMeta(application.status);
                  const applicationScore = Math.round(Number(application.ai_score || 0));

                  return (
                    <article
                      key={application.application_id || `${application.job_title || 'application'}-${index}`}
                      className={`cd-profile-history-card ${index > 0 ? 'is-secondary' : ''}`}
                    >
                      <div className="cd-profile-history-top">
                        <div>
                          <p className="cd-profile-history-title">{application.job_title || 'Poste non renseigne'}</p>
                          <p className="cd-profile-history-date">Poste le {formatDate(application.created_at)}</p>
                        </div>
                        <span className={`cd-pill cd-pill--${applicationStatusMeta.tone}`}>{applicationStatusMeta.label}</span>
                      </div>

                      <div className="cd-profile-history-bottom">
                        <span>{application.ai_score ? 'Score match' : 'Statut'}</span>
                        <strong>{application.ai_score ? `${applicationScore}/100` : applicationStatusMeta.label}</strong>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="cd-empty">Ce candidat n a pas encore de candidature rattachee a votre pipeline.</div>
            )}
          </section>

          <section className="cd-profile-side-card">
            <div className="cd-profile-side-head">
              <div className="cd-profile-side-title">
                <span className="material-symbols-outlined">edit_note</span>
                <h3>Evaluation recruteur</h3>
              </div>
              {noteSaved ? (
                <span className="cd-section-badge">Enregistree</span>
              ) : candidate?.current_user_rating ? (
                <span className="cd-section-badge">Votre note existe deja</span>
              ) : null}
            </div>

            <div className="cd-profile-rating-block">
              <div className="cd-profile-rating-head">
                <div>
                  <p className="cd-profile-analysis-label">Score RH</p>
                  <strong>{recruiterScoreMeta ? recruiterScoreMeta.label : 'Non note'}</strong>
                </div>
                {recruiterScoreMeta ? <span className="cd-section-badge">{recruiterScoreMeta.title}</span> : null}
              </div>

              <div className="cd-profile-rating-row" role="radiogroup" aria-label="Notation RH de 1 a 5">
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
                    <span className="cd-profile-rating-title">{option.title}</span>
                  </button>
                ))}
              </div>

              <p className="cd-profile-note-help">
                {recruiterScoreMeta
                  ? recruiterScoreMeta.helper
                  : 'Attribuez une note simple de 1 a 5 pour garder un avis recruteur rapide.'}
              </p>

              <div className="cd-profile-rating-meta">
                <span>{ratingsCount > 0 ? `${ratingsCount} note${ratingsCount > 1 ? 's' : ''} RH enregistree${ratingsCount > 1 ? 's' : ''}` : 'Aucune note RH enregistree pour le moment.'}</span>
                {ratingsAverage ? <strong>Moyenne {ratingsAverage}/5</strong> : null}
              </div>
            </div>

            <label className="cd-profile-note-label" htmlFor="candidate-note">
              Observation confidentielle
            </label>
            <textarea
              id="candidate-note"
              className="cd-profile-note-input"
              value={recruiterNote}
              onChange={(event) => {
                setRecruiterNote(event.target.value);
                setNoteSaved(false);
              }}
              placeholder="Ajouter une observation confidentielle..."
            />
            <p className="cd-profile-note-help">La note est enregistree localement sur ce navigateur.</p>
            {reviewError ? <p className="cd-profile-review-error">{reviewError}</p> : null}
            <button
              type="button"
              className="cd-button cd-button--primary"
              onClick={handleSaveRecruiterNote}
              disabled={savingReview}
            >
              <span className="material-symbols-outlined">{savingReview ? 'sync' : 'save'}</span>
              {savingReview ? 'Enregistrement...' : 'Enregistrer l evaluation'}
            </button>
          </section>
        </div>
      </div>
    </div>
  );

  const renderJourneyTab = () => (
    <div className="cd-journey-tab">
      <section className="cd-journey-overview-grid" aria-label="Resume du parcours">
        <article className="cd-journey-overview-card">
          <div className="cd-journey-overview-icon">
            <span className="material-symbols-outlined">work_history</span>
          </div>
          <div>
            <p className="cd-profile-card-label">Experience</p>
            <strong>{experiences.length} experience{experiences.length > 1 ? 's' : ''}</strong>
            <span>{experienceSpanLabel || 'Anciennete non renseignee'}</span>
          </div>
        </article>

        <article className="cd-journey-overview-card">
          <div className="cd-journey-overview-icon">
            <span className="material-symbols-outlined">badge</span>
          </div>
          <div>
            <p className="cd-profile-card-label">Poste recent</p>
            <strong>{currentExperience?.title || currentExperience?.jobTitle || currentExperience?.position || 'A completer'}</strong>
            <span>{currentExperience?.company || currentExperience?.organization || 'Entreprise non renseignee'}</span>
          </div>
        </article>

        <article className="cd-journey-overview-card">
          <div className="cd-journey-overview-icon">
            <span className="material-symbols-outlined">school</span>
          </div>
          <div>
            <p className="cd-profile-card-label">Formation</p>
            <strong>{educations.length} formation{educations.length > 1 ? 's' : ''}</strong>
            <span>{leadEducation?.institution || leadEducation?.school || leadEducation?.university || 'Aucune formation principale'}</span>
          </div>
        </article>

        <article className="cd-journey-overview-card">
          <div className="cd-journey-overview-icon">
            <span className="material-symbols-outlined">verified</span>
          </div>
          <div>
            <p className="cd-profile-card-label">Certifications</p>
            <strong>{certificates.length} certification{certificates.length > 1 ? 's' : ''}</strong>
            <span>{leadCertificate?.name || leadCertificate?.title || 'Aucune certification principale'}</span>
          </div>
        </article>
      </section>

      <div className="cd-journey-columns">
        <section className="cd-journey-panel cd-journey-panel--main">
          <div className="cd-journey-panel-head">
            <div>
              <p className="cd-profile-card-label">Parcours professionnel</p>
              <h3>Lecture chronologique du profil</h3>
            </div>
            <span className="cd-section-badge">{experiences.length} etapes</span>
          </div>

          {experiences.length > 0 ? (
            <div className="cd-journey-timeline">
              {experiences.map((experience, index) => {
                const isCurrentRole = Boolean(experience.current || experience.ongoing);
                const experienceDate = formatDateRange(
                  experience.start_date || experience.startDate || experience.startYear || experience.start_year,
                  experience.end_date || experience.endDate || experience.endYear || experience.end_year,
                  experience.current || experience.ongoing
                );

                return (
                  <article
                    key={experience.id || `${experience.company || 'experience'}-${index}`}
                    className={`cd-journey-experience-card ${isCurrentRole ? 'is-current' : ''}`}
                  >
                    <div className="cd-journey-marker">
                      <span>{index + 1}</span>
                    </div>

                    <div className="cd-journey-experience-body">
                      <div className="cd-journey-experience-top">
                        <div>
                          <div className="cd-journey-tag-row">
                            <span className={`cd-pill ${isCurrentRole ? 'cd-pill--strong' : 'cd-pill--neutral'}`}>
                              {isCurrentRole ? 'Actuel' : 'Parcours'}
                            </span>
                            {experience.type || experience.contract_type ? (
                              <span className="cd-pill cd-pill--neutral">{experience.type || experience.contract_type}</span>
                            ) : null}
                          </div>
                          <h4>{experience.title || experience.jobTitle || experience.position || 'Poste'}</h4>
                          <p className="cd-journey-experience-meta">
                            {experience.company || experience.organization || 'Entreprise'}
                          </p>
                        </div>

                        <div className="cd-journey-meta-stack">
                          <span className="cd-item-date">{experienceDate}</span>
                          {experience.location || experience.city ? (
                            <span className="cd-journey-inline-chip">
                              <span className="material-symbols-outlined">location_on</span>
                              {experience.location || experience.city}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <p className="cd-item-description">
                        {experience.description || 'Aucune description complementaire pour cette experience.'}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="cd-empty">Aucune experience professionnelle renseignee.</div>
          )}
        </section>

        <div className="cd-journey-side-column">
          <section className="cd-journey-panel">
            <div className="cd-journey-panel-head">
              <div>
                <p className="cd-profile-card-label">Lecture rapide</p>
                <h3>Points reperes du parcours</h3>
              </div>
            </div>

            <div className="cd-journey-summary-list">
              <div className="cd-journey-summary-item">
                <span>Dernier poste</span>
                <strong>{currentExperience?.title || currentExperience?.jobTitle || currentExperience?.position || 'Non renseigne'}</strong>
              </div>
              <div className="cd-journey-summary-item">
                <span>Societe recente</span>
                <strong>{currentExperience?.company || currentExperience?.organization || 'Non renseignee'}</strong>
              </div>
              <div className="cd-journey-summary-item">
                <span>Anciennete estimee</span>
                <strong>{experienceSpanLabel || 'A estimer'}</strong>
              </div>
              <div className="cd-journey-summary-item">
                <span>Niveau de dossier</span>
                <strong>{educations.length} formation{educations.length > 1 ? 's' : ''} - {certificates.length} certification{certificates.length > 1 ? 's' : ''}</strong>
              </div>
            </div>
          </section>

          <section className="cd-journey-panel">
            <div className="cd-journey-panel-head">
              <div>
                <p className="cd-profile-card-label">Formation</p>
                <h3>Base academique</h3>
              </div>
              <span className="cd-section-badge">{educations.length}</span>
            </div>

            {educations.length > 0 ? (
              <div className="cd-journey-stack-list">
                {educations.map((education, index) => (
                  <article key={education.id || `${education.institution || 'education'}-${index}`} className="cd-journey-stack-card">
                    <div className="cd-journey-stack-icon">
                      <span className="material-symbols-outlined">school</span>
                    </div>
                    <div className="cd-journey-stack-copy">
                      <strong>{education.degree || education.field || education.level || 'Diplome'}</strong>
                      <p>{education.institution || education.school || education.university || 'Etablissement'}</p>
                      {(education.field_of_study || education.fieldOfStudy) ? (
                        <span>{education.field_of_study || education.fieldOfStudy}</span>
                      ) : null}
                      <span className="cd-item-date">
                        {formatDateRange(
                          education.start_date || education.startDate || education.startYear || education.start_year,
                          education.end_date || education.endDate || education.endYear || education.year || education.end_year,
                          education.ongoing
                        )}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="cd-empty">Aucune formation renseignee.</div>
            )}
          </section>

          <section className="cd-journey-panel">
            <div className="cd-journey-panel-head">
              <div>
                <p className="cd-profile-card-label">Certifications</p>
                <h3>Preuves complementaires</h3>
              </div>
              <span className="cd-section-badge">{certificates.length}</span>
            </div>

            {certificates.length > 0 ? (
              <div className="cd-journey-stack-list">
                {certificates.map((certificate, index) => (
                  <article key={certificate.id || `${certificate.name || 'certificate'}-${index}`} className="cd-journey-stack-card">
                    <div className="cd-journey-stack-icon">
                      <span className="material-symbols-outlined">verified</span>
                    </div>
                    <div className="cd-journey-stack-copy">
                      <strong>{certificate.name || certificate.title || 'Certification'}</strong>
                      <p>{certificate.issuer || certificate.issuingOrganization || 'Organisme'}</p>
                      <span>{certificate.date || certificate.issue_date || certificate.issueDate || certificate.year || 'Date non renseignee'}</span>
                      {certificate.credential_id || certificate.url ? (
                        <div className="cd-inline-meta">
                          {certificate.credential_id ? <span>ID {certificate.credential_id}</span> : null}
                          {certificate.url ? (
                            <a href={certificate.url} target="_blank" rel="noreferrer">
                              Voir la preuve
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="cd-empty">Aucune certification enregistree.</div>
            )}
          </section>
        </div>
      </div>
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
                <p className="cd-profile-card-label">Total</p>
                <strong>{applications.length} candidature{applications.length > 1 ? 's' : ''}</strong>
                <span>Historique complet du pipeline</span>
              </div>
            </article>

            <article className="cd-applications-overview-card">
              <div className="cd-applications-overview-icon">
                <span className="material-symbols-outlined">pending_actions</span>
              </div>
              <div>
                <p className="cd-profile-card-label">En cours</p>
                <strong>{openApplicationsCount}</strong>
                <span>{applications.length - openApplicationsCount} cloturee{applications.length - openApplicationsCount > 1 ? 's' : ''}</span>
              </div>
            </article>

            <article className="cd-applications-overview-card">
              <div className="cd-applications-overview-icon">
                <span className="material-symbols-outlined">query_stats</span>
              </div>
              <div>
                <p className="cd-profile-card-label">Score moyen</p>
                <strong>{averageScore}%</strong>
                <span>Lecture consolidee sur les candidatures</span>
              </div>
            </article>

            <article className="cd-applications-overview-card">
              <div className="cd-applications-overview-icon">
                <span className="material-symbols-outlined">schedule</span>
              </div>
              <div>
                <p className="cd-profile-card-label">Derniere activite</p>
                <strong>{latestApplication ? formatDate(latestApplication.updated_at || latestApplication.created_at) : formatDate(candidate.created_at)}</strong>
                <span>{latestStatusMeta ? latestStatusMeta.label : 'Profil a qualifier'}</span>
              </div>
            </article>
          </section>

          {latestApplication ? (
            <section className="cd-applications-featured-card">
              <div className="cd-applications-featured-main">
                <div className="cd-applications-featured-head">
                  <div>
                    <p className="cd-profile-card-label">Candidature principale</p>
                    <h3>{latestApplication.job_title || 'Poste non renseigne'}</h3>
                    <p>
                      Deposee le {formatDate(latestApplication.created_at)}
                      {latestApplication.updated_at ? ` - Mise a jour ${formatDate(latestApplication.updated_at)}` : ''}
                    </p>
                  </div>

                  <div className="cd-applications-featured-side">
                    {latestStatusMeta ? (
                      <span className={`cd-pill cd-pill--${latestStatusMeta.tone}`}>
                        <span className="material-symbols-outlined">{latestStatusMeta.icon}</span>
                        {latestStatusMeta.label}
                      </span>
                    ) : null}
                    <span className="cd-applications-score-pill">{Math.round(Number(latestApplication.ai_score || 0)) || 0}%</span>
                  </div>
                </div>

                <p className="cd-applications-featured-summary">
                  {latestApplication.ai_justification
                    ? `${latestApplication.ai_justification.slice(0, 260)}${latestApplication.ai_justification.length > 260 ? '...' : ''}`
                    : 'Aucune justification IA detaillee pour cette candidature.'}
                </p>

                <div className="cd-applications-meta-row">
                  <span className="cd-journey-inline-chip">
                    <span className="material-symbols-outlined">work</span>
                    {latestApplication.job_title || 'Poste non renseigne'}
                  </span>
                  <span className="cd-journey-inline-chip">
                    <span className="material-symbols-outlined">schedule</span>
                    {latestApplication.updated_at ? `Maj ${formatDate(latestApplication.updated_at)}` : `Cree le ${formatDate(latestApplication.created_at)}`}
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
                    Ouvrir le tracking
                  </button>
                ) : null}
                <button type="button" className="cd-button cd-button--ghost" onClick={() => setActiveTab('analysis')}>
                  <span className="material-symbols-outlined">psychology</span>
                  Voir analyse IA
                </button>
              </div>
            </section>
          ) : null}

          {secondaryApplications.length > 0 ? (
            <section className="cd-applications-panel">
              <div className="cd-journey-panel-head">
                <div>
                  <p className="cd-profile-card-label">Historique</p>
                  <h3>Autres candidatures du profil</h3>
                </div>
                <span className="cd-section-badge">{secondaryApplications.length}</span>
              </div>

              <div className="cd-applications-grid">
                {secondaryApplications.map((application, index) => {
                  const statusMeta = getApplicationStatusMeta(application.status);
                  const applicationScoreMeta = getScoreMeta(Number(application.ai_score || 0), application.job_title);
                  const applicationScore = Math.round(Number(application.ai_score || 0));

                  return (
                    <article
                      key={application.application_id || `${application.job_title || 'application'}-${index}`}
                      className={`cd-application-card cd-application-card--rich cd-application-card--${statusMeta.tone}`}
                    >
                      <div className="cd-application-main">
                        <div className="cd-application-headline">
                          <div>
                            <h3>{application.job_title || 'Poste non renseigne'}</h3>
                            <p>
                              Deposee le {formatDate(application.created_at)}
                              {application.updated_at ? ` - Mise a jour ${formatDate(application.updated_at)}` : ''}
                            </p>
                          </div>

                          <div className="cd-application-side">
                            <span className={`cd-pill cd-pill--${statusMeta.tone}`}>
                              <span className="material-symbols-outlined">{statusMeta.icon}</span>
                              {statusMeta.label}
                            </span>
                            <strong style={{ color: applicationScoreMeta.color }}>
                              {application.ai_score ? `${applicationScore}%` : 'Non note'}
                            </strong>
                          </div>
                        </div>

                        <p className="cd-item-description">
                          {application.ai_justification
                            ? `${application.ai_justification.slice(0, 180)}${application.ai_justification.length > 180 ? '...' : ''}`
                            : 'Aucune justification IA detaillee pour cette candidature.'}
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
                            Ouvrir le tracking
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
        <div className="cd-empty">Ce candidat n a pas encore de candidature rattachee a votre pipeline.</div>
      )}
    </div>
  );

  const renderAnalysisTab = () => (
    <div className="cd-workspace">
      <SectionCard title="Synthese IA" icon="auto_awesome" className="cd-span-7">
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
              : 'Aucune justification IA disponible pour le moment.'}
          </p>
        </div>

        {candidate.ai_justification ? (
          <button type="button" className="cd-link-button" onClick={() => setShowFullAi((current) => !current)}>
            {showFullAi ? 'Voir moins' : 'Voir tout'}
          </button>
        ) : null}
      </SectionCard>

      <SectionCard title="Points forts" icon="check_circle" className="cd-span-5">
        {strengths.length > 0 ? (
          <div className="cd-token-group">
            {strengths.map((strength) => (
              <span key={strength} className="cd-token cd-token--success">
                {strength}
              </span>
            ))}
          </div>
        ) : (
          <div className="cd-empty">L analyse n a pas encore isole de points forts explicites.</div>
        )}
      </SectionCard>

      <SectionCard title="Points de vigilance" icon="warning" className="cd-span-5">
        {weaknesses.length > 0 ? (
          <div className="cd-token-group">
            {weaknesses.map((weakness) => (
              <span key={weakness} className="cd-token cd-token--warning">
                {weakness}
              </span>
            ))}
          </div>
        ) : (
          <div className="cd-empty">Aucun point de vigilance detaille n a ete remonte.</div>
        )}
      </SectionCard>

      <SectionCard title="Contexte de decision" icon="rule" className="cd-span-7">
        <div className="cd-facts-grid">
          <div className="cd-fact-card">
            <span className="cd-fact-label">Statut courant</span>
            <strong>{latestStatusMeta ? latestStatusMeta.label : 'Profil a qualifier'}</strong>
          </div>
          <div className="cd-fact-card">
            <span className="cd-fact-label">Poste principal</span>
            <strong>{candidate.best_match_job || 'Aucune candidature'}</strong>
          </div>
          <div className="cd-fact-card">
            <span className="cd-fact-label">Score moyen</span>
            <strong>{averageScore}%</strong>
          </div>
          <div className="cd-fact-card">
            <span className="cd-fact-label">Derniere activite</span>
            <strong>{latestApplication ? formatDate(latestApplication.updated_at || latestApplication.created_at) : formatDate(candidate.created_at)}</strong>
          </div>
        </div>
      </SectionCard>
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
                  Candidats
                </button>
                <span className="cd-breadcrumb-separator">/</span>
                <span className="cd-breadcrumb-current">Fiche detaillee</span>
              </div>

              <h1>{displayName}</h1>
              <p>{candidate.title || 'Profil a qualifier'} - Vue de decision RH construite pour qualifier rapidement le profil, le dossier et la suite du pipeline.</p>
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
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === 'profile' ? renderProfileTab() : null}
          {activeTab === 'journey' ? renderJourneyTab() : null}
          {activeTab === 'applications' ? renderApplicationsTab() : null}
          {activeTab === 'analysis' ? renderAnalysisTab() : null}
        </div>
      </main>
    </div>
  );
};

export default CandidatDetail;
