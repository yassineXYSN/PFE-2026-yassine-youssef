export const DEFAULT_QUIZ_DIFFICULTY = 'medium';

export const QUIZ_DIFFICULTY_OPTIONS = [
    { value: 'easy', label: 'Easy', mix: { easy: 0.8, medium: 0.2, hard: 0 } },
    { value: 'medium', label: 'Balanced', mix: { easy: 0.4, medium: 0.4, hard: 0.2 } },
    { value: 'hard', label: 'Hard', mix: { easy: 0, medium: 0.2, hard: 0.8 } }
];

export const createEmptyQuizConfig = () => ({
    id: `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    document_id: '',
    document_title: '',
    total_questions: 10,
    duration_minutes: 10,
    weight_percentage: '',
    difficulty: DEFAULT_QUIZ_DIFFICULTY,
    deadline_mode: 'absolute',
    deadline_at: ''
});

export const createDefaultAIAutomation = () => ({
    enabled: true,
    trigger_mode: 'deadline',
    execution_enabled: false,
    vector_filter: {
        enabled: true,
        top_x_candidates: 25
    },
    ai_score_filter: {
        enabled: true,
        top_y_candidates: 10
    },
    quiz_stage: {
        enabled: false,
        approve_top_z_to_interview: 5,
        quizzes: []
    }
});

const getDifficultyFromMix = (mix) => {
    if (!mix || typeof mix !== 'object') return DEFAULT_QUIZ_DIFFICULTY;
    if ((mix.hard || 0) >= 0.7) return 'hard';
    if ((mix.easy || 0) >= 0.7) return 'easy';
    return 'medium';
};

const toPositiveInt = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
};

export const hydrateAIAutomation = (rawConfig) => {
    const defaults = createDefaultAIAutomation();
    if (!rawConfig || typeof rawConfig !== 'object') return defaults;

    return {
        ...defaults,
        ...rawConfig,
        execution_enabled: false,
        vector_filter: {
            ...defaults.vector_filter,
            ...(rawConfig.vector_filter || {})
        },
        ai_score_filter: {
            ...defaults.ai_score_filter,
            ...(rawConfig.ai_score_filter || {})
        },
        quiz_stage: {
            ...defaults.quiz_stage,
            ...(rawConfig.quiz_stage || {}),
            quizzes: Array.isArray(rawConfig.quiz_stage?.quizzes)
                ? rawConfig.quiz_stage.quizzes.map((quiz, index) => ({
                    ...createEmptyQuizConfig(),
                    ...quiz,
                    id: quiz.id || `saved-quiz-${index}`,
                    weight_percentage: quiz.weight_percentage ?? 100,
                    deadline_at: quiz.deadline_at || '',
                    difficulty: getDifficultyFromMix(quiz.difficulty_mix)
                }))
                : defaults.quiz_stage.quizzes
        }
    };
};

export const validateAIAutomation = (config) => {
    const errors = {};
    if (!config?.enabled) return errors;

    const profileMatchCount = toPositiveInt(config.vector_filter?.top_x_candidates);
    const aiReviewCount = toPositiveInt(config.ai_score_filter?.top_y_candidates);
    const interviewCount = toPositiveInt(config.quiz_stage?.approve_top_z_to_interview);

    if (!profileMatchCount || profileMatchCount <= 0) {
        errors.top_x_candidates = 'Initial shortlist must be a positive integer.';
    }
    if (!aiReviewCount || aiReviewCount <= 0) {
        errors.top_y_candidates = 'AI-reviewed shortlist must be a positive integer.';
    }
    if (!errors.top_x_candidates && !errors.top_y_candidates && profileMatchCount <= aiReviewCount) {
        errors.top_x_candidates = 'Initial shortlist must stay greater than the AI-reviewed shortlist.';
        errors.top_y_candidates = 'AI-reviewed shortlist must stay below the initial shortlist.';
    }

    if (config.quiz_stage?.enabled) {
        if (!interviewCount || interviewCount <= 0) {
            errors.top_z_candidates = 'Interview shortlist must be a positive integer.';
        }
        if (!errors.top_y_candidates && !errors.top_z_candidates && aiReviewCount <= interviewCount) {
            errors.top_z_candidates = 'Interview shortlist must stay below the AI-reviewed shortlist.';
        }
        if (!Array.isArray(config.quiz_stage.quizzes) || config.quiz_stage.quizzes.length === 0) {
            errors.quizzes = 'Add at least one quiz when the quiz stage is enabled.';
        }

        let totalWeight = 0;
        (config.quiz_stage.quizzes || []).forEach((quiz, index) => {
            const prefix = `quiz_${index}`;
            const questionCount = toPositiveInt(quiz.total_questions);
            const duration = toPositiveInt(quiz.duration_minutes);
            const weight = toPositiveInt(quiz.weight_percentage);

            if (!quiz.title?.trim()) errors[`${prefix}_title`] = 'Quiz title is required.';
            if (!quiz.document_id) errors[`${prefix}_document`] = 'Upload or select a source document.';
            if (!questionCount || questionCount <= 0) errors[`${prefix}_questions`] = 'Questions count must be a positive integer.';
            if (!duration || duration <= 0) errors[`${prefix}_duration`] = 'Duration must be a positive integer.';
            if (!weight || weight <= 0 || weight > 100) errors[`${prefix}_weight`] = 'Weight must be between 1 and 100.';
            if (!quiz.deadline_at) errors[`${prefix}_deadline_at`] = 'Quiz deadline is required.';

            totalWeight += weight || 0;
        });

        if ((config.quiz_stage.quizzes || []).length > 0 && totalWeight !== 100) {
            errors.quiz_weights = 'Quiz weights must add up to 100%.';
        }
    }

    return errors;
};

export const buildAIAutomationPayload = (config) => {
    const defaults = createDefaultAIAutomation();
    const next = hydrateAIAutomation(config || defaults);

    if (!next.enabled) {
        return {
            enabled: false,
            trigger_mode: next.trigger_mode || 'deadline',
            execution_enabled: false,
            vector_filter: {
                enabled: false,
                top_x_candidates: toPositiveInt(next.vector_filter.top_x_candidates) || defaults.vector_filter.top_x_candidates
            },
            ai_score_filter: {
                enabled: false,
                top_y_candidates: toPositiveInt(next.ai_score_filter.top_y_candidates) || defaults.ai_score_filter.top_y_candidates
            },
            quiz_stage: {
                enabled: false,
                approve_top_z_to_interview: null,
                quizzes: []
            }
        };
    }

    return {
        enabled: Boolean(next.enabled),
        trigger_mode: next.trigger_mode || 'deadline',
        execution_enabled: false,
        vector_filter: {
            enabled: true,
            top_x_candidates: toPositiveInt(next.vector_filter.top_x_candidates) || defaults.vector_filter.top_x_candidates
        },
        ai_score_filter: {
            enabled: true,
            top_y_candidates: toPositiveInt(next.ai_score_filter.top_y_candidates) || defaults.ai_score_filter.top_y_candidates
        },
        quiz_stage: {
            enabled: Boolean(next.quiz_stage.enabled),
            approve_top_z_to_interview: next.quiz_stage.enabled
                ? (toPositiveInt(next.quiz_stage.approve_top_z_to_interview) || defaults.quiz_stage.approve_top_z_to_interview)
                : null,
            quizzes: next.quiz_stage.enabled
                ? next.quiz_stage.quizzes.map((quiz) => {
                    const difficultyOption = QUIZ_DIFFICULTY_OPTIONS.find((option) => option.value === quiz.difficulty) || QUIZ_DIFFICULTY_OPTIONS[1];
                    return {
                        title: quiz.title.trim(),
                        document_id: quiz.document_id,
                        document_title: quiz.document_title || '',
                        total_questions: toPositiveInt(quiz.total_questions) || 10,
                        duration_minutes: toPositiveInt(quiz.duration_minutes) || 10,
                        weight_percentage: toPositiveInt(quiz.weight_percentage) || 1,
                        difficulty_mix: difficultyOption.mix,
                        deadline_mode: 'absolute',
                        deadline_at: quiz.deadline_at || ''
                    };
                })
                : []
        }
    };
};
