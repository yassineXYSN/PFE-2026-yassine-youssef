import { useState } from 'react';
import './MySubmissions.css';

const MySubmissions = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('last-updated');

  // Sample application data
  const applications = [
    {
      id: 1,
      company: 'TechFlow',
      logo: 'TF',
      logoColor: 'bg-slate-900',
      position: 'Senior Product Designer',
      location: 'San Francisco, CA (Hybrid)',
      appliedDate: 'Oct 24',
      salary: '$140k - $180k',
      status: 'interview',
      statusLabel: 'Interview Scheduled',
      statusColor: 'my-submissions__status--interview',
      progress: 60,
      progressColor: 'primary',
      timeline: [
        { label: 'Applied', active: true },
        { label: 'Review', active: true },
        { label: 'Interview', active: true, current: true },
        { label: 'Offer', active: false },
      ],
      insight: {
        icon: 'auto_awesome',
        iconFilled: true,
        title: 'High likelihood of reply today',
        description: 'Based on typical response times for this role.',
        iconClass: 'my-submissions__insight-icon--primary',
      },
    },
    {
      id: 2,
      company: 'Nexus Corp',
      logo: 'N',
      logoColor: 'bg-indigo-600',
      position: 'Frontend Developer',
      location: 'Remote',
      appliedDate: 'Nov 02',
      salary: '$120k - $150k',
      status: 'review',
      statusLabel: 'In Review',
      statusColor: 'my-submissions__status--review',
      progress: 33,
      progressColor: 'blue',
      timeline: [
        { label: 'Applied', active: true },
        { label: 'Review', active: true, current: true },
        { label: 'Interview', active: false },
        { label: 'Offer', active: false },
      ],
      insight: {
        icon: 'lightbulb',
        iconFilled: false,
        title: 'Avg. response time: 5 days',
        description: 'You should hear back by Nov 7.',
        iconClass: 'my-submissions__insight-icon--muted',
      },
    },
    {
      id: 3,
      company: 'Global Systems',
      logo: 'GS',
      logoColor: 'bg-orange-500',
      position: 'UX Researcher',
      location: 'New York, NY',
      appliedDate: 'Yesterday',
      salary: '$110k - $135k',
      status: 'applied',
      statusLabel: 'Applied',
      statusColor: 'my-submissions__status--applied',
      progress: 0,
      progressColor: 'slate',
      timeline: [
        { label: 'Applied', active: true, current: true },
        { label: 'Review', active: false },
        { label: 'Interview', active: false },
        { label: 'Offer', active: false },
      ],
      insight: {
        icon: 'schedule',
        iconFilled: false,
        title: 'Estimating...',
        description: 'Waiting for more data to generate prediction.',
        iconClass: 'my-submissions__insight-icon--muted',
      },
    },
  ];

  const stats = [
    {
      label: 'Total Applications',
      value: 24,
      icon: 'folder_open',
      subtext: '+2 this week',
      subtextColor: 'text-green-500',
      cardClass: '',
    },
    {
      label: 'Pending Review',
      value: 12,
      icon: 'hourglass_empty',
      subtext: null,
      cardClass: '',
    },
    {
      label: 'Interviews',
      value: 3,
      icon: 'groups',
      subtext: 'Action needed',
      subtextColor: 'text-primary dark:text-white',
      cardClass: 'border-primary/20 bg-primary/5 dark:bg-primary/10',
      highlight: true,
    },
    {
      label: 'Offers',
      value: 1,
      icon: 'celebration',
      subtext: '+1 new!',
      subtextColor: 'text-green-500',
      cardClass: '',
    },
  ];

  const filters = [
    { id: 'all', label: 'All', icon: 'view_list' },
    { id: 'pending', label: 'Pending', icon: 'schedule' },
    { id: 'interview', label: 'Interviewing', icon: 'groups' },
    { id: 'offer', label: 'Offers', icon: 'check_circle' },
  ];

  const filteredApplications = applications.filter((app) => {
    if (activeFilter === 'all') return true;
    return app.status === activeFilter;
  });

  return (
    <div className="my-submissions">
      {/* Header */}
      <div className="my-submissions__header">
        <h2 className="my-submissions__title">My Submissions</h2>
        <p className="my-submissions__subtitle">
          Track and manage your current job opportunities.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="my-submissions__stats">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`my-submissions__stat-card ${stat.cardClass} ${
              stat.highlight ? 'my-submissions__stat-card--highlight' : ''
            }`}
          >
            <div className="my-submissions__stat-header">
              <p
                className={`my-submissions__stat-label ${
                  stat.highlight ? 'text-primary dark:text-white' : ''
                }`}
              >
                {stat.label}
              </p>
              <span
                className={`material-symbols-outlined my-submissions__stat-icon ${
                  stat.highlight ? 'text-primary dark:text-white' : ''
                }`}
              >
                {stat.icon}
              </span>
            </div>
            <div className="my-submissions__stat-content">
              <p
                className={`my-submissions__stat-value ${
                  stat.highlight ? 'text-primary dark:text-white' : ''
                }`}
              >
                {stat.value}
              </p>
              {stat.subtext && (
                <p className={`my-submissions__stat-subtext ${stat.subtextColor}`}>
                  {stat.subtext}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Controls */}
      <div className="my-submissions__controls">
        {/* Tab Filters */}
        <div className="my-submissions__filters">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`my-submissions__filter-btn ${
                activeFilter === filter.id
                  ? 'my-submissions__filter-btn--active'
                  : ''
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {filter.icon}
              </span>
              <span className="text-sm font-medium">{filter.label}</span>
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div className="my-submissions__search-sort">
          <div className="my-submissions__search">
            <span className="material-symbols-outlined my-submissions__search-icon">
              search
            </span>
            <input
              type="text"
              placeholder="Search by company or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="my-submissions__search-input"
            />
          </div>
          <div className="my-submissions__sort">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="my-submissions__sort-select"
            >
              <option value="last-updated">Last Updated</option>
              <option value="date-applied">Date Applied</option>
              <option value="salary">Salary (High to Low)</option>
            </select>
            <span className="material-symbols-outlined my-submissions__sort-icon">
              expand_more
            </span>
          </div>
        </div>
      </div>

      {/* Application List */}
      <div className="my-submissions__list">
        {filteredApplications.map((app) => (
          <div
            key={app.id}
            className="my-submissions__card"
          >
            {/* Card Header */}
            <div className="my-submissions__card-header">
              <div className="my-submissions__card-info">
                <div
                  className={`my-submissions__company-logo ${app.logoColor}`}
                >
                  <span className="font-bold text-xl">{app.logo}</span>
                </div>
                <div>
                  <h3 className="my-submissions__position">{app.position}</h3>
                  <p className="my-submissions__company">
                    {app.company} • {app.location}
                  </p>
                  <div className="my-submissions__meta">
                    <span className="my-submissions__meta-item">
                      <span className="material-symbols-outlined text-[16px]">
                        calendar_today
                      </span>
                      Applied {app.appliedDate}
                    </span>
                    <span>•</span>
                    <span>{app.salary}</span>
                  </div>
                </div>
              </div>
              <div className="my-submissions__card-actions">
                <div className={`my-submissions__status ${app.statusColor}`}>
                  {app.statusLabel}
                </div>
                <button className="my-submissions__menu-btn">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="my-submissions__timeline-wrapper">
              <div className="my-submissions__timeline">
                <div className="my-submissions__timeline-track"></div>
                <div
                  className={`my-submissions__timeline-progress my-submissions__timeline-progress--${app.progressColor}`}
                  style={{
                    width: `${app.progress}%`,
                  }}
                ></div>
                <div className="my-submissions__timeline-steps">
                  {app.timeline.map((step, idx) => (
                    <div key={idx} className="my-submissions__timeline-step">
                      <div
                        className={`my-submissions__timeline-dot ${
                          step.active
                            ? step.current
                              ? app.progress === 0
                                ? `my-submissions__timeline-dot--current-initial my-submissions__timeline-dot--${app.progressColor}`
                                : `my-submissions__timeline-dot--current my-submissions__timeline-dot--${app.progressColor}`
                              : `my-submissions__timeline-dot--active my-submissions__timeline-dot--${app.progressColor}`
                            : 'my-submissions__timeline-dot--inactive'
                        }`}
                      ></div>
                      <span
                        className={`my-submissions__timeline-label ${
                          step.active
                            ? step.current
                              ? `my-submissions__timeline-label--current my-submissions__timeline-label--${app.progressColor}`
                              : `my-submissions__timeline-label--active my-submissions__timeline-label--${app.progressColor}`
                            : ''
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Insight Footer */}
            <div className="my-submissions__insight">
              <div className="my-submissions__insight-content">
                <span
                  className={`material-symbols-outlined ${app.insight.iconClass}`}
                  style={{
                    fontVariationSettings: app.insight.iconFilled
                      ? "'FILL' 1"
                      : "'FILL' 0",
                  }}
                >
                  {app.insight.icon}
                </span>
                <div>
                  <p className="my-submissions__insight-title">
                    {app.insight.title}
                  </p>
                  <p className="my-submissions__insight-description">
                    {app.insight.description}
                  </p>
                </div>
              </div>
              <button className="my-submissions__insight-btn">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MySubmissions;
