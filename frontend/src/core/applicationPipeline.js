const PIPELINE_DEFINITION = [
  {
    id: 'new',
    labelKey: 'app.track.step.new',
    descriptionKey: 'app.track.step.received',
    icon: 'fiber_new',
  },
  {
    id: 'in_review',
    labelKey: 'app.track.step.in_review',
    descriptionKey: 'app.track.step.in_review',
    icon: 'visibility',
  },
  {
    id: 'technical_test',
    labelKey: 'app.track.step.technical_test',
    descriptionKey: 'app.track.step.technical_test',
    icon: 'terminal',
  },
  {
    id: 'interview',
    labelKey: 'app.track.step.interview',
    descriptionKey: 'app.track.step.interview',
    icon: 'person_search',
  },
  {
    id: 'accepted',
    labelKey: 'app.track.step.accepted',
    descriptionKey: 'app.track.step.accepted',
    icon: 'hourglass_empty',
  },
];

export const PIPELINE_STAGE_IDS = PIPELINE_DEFINITION.map((step) => step.id);

export const LEGACY_APPLICATION_STATUS_MAP = {
  pending: 'new',
  reviewed: 'in_review',
  quiz: 'technical_test',
  offer: 'accepted',
};

export const normalizeApplicationStatus = (status) => {
  const value = `${status || 'new'}`.toLowerCase();
  return LEGACY_APPLICATION_STATUS_MAP[value] || value;
};

export const getApplicationPipelineSteps = (t) =>
  PIPELINE_DEFINITION.map((step) => ({
    ...step,
    label: t(step.labelKey),
    desc: t(step.descriptionKey),
  }));

export const getApplicationStageIndex = (status) =>
  PIPELINE_STAGE_IDS.indexOf(normalizeApplicationStatus(status));
