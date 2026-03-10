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
      logoColor: 'background: linear-gradient(135deg, #0f172a, #334155)',
      position: 'Senior Product Designer',
      location: 'San Francisco, CA (Hybrid)',
      appliedDate: 'Oct 24',
      salary: '$140k - $180k',
      status: 'interview',
      statusLabel: 'Interview Scheduled',
      statusColor: 'my-submissions__status--interview',
      progress: 60,
      progressColorClass: 'color-primary',
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
      logoColor: 'background: linear-gradient(135deg, #4f46e5, #6366f1)',
      position: 'Frontend Developer',
      location: 'Remote',
      appliedDate: 'Nov 02',
      salary: '$120k - $150k',
      status: 'review',
      statusLabel: 'In Review',
      statusColor: 'my-submissions__status--review',
      progress: 33,
      progressColorClass: 'color-blue',
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
        iconClass: 'my-submissions__insight-icon--primary',
      },
    },
    {
      id: 3,
      company: 'Global Systems',
      logo: 'GS',
      logoColor: 'background: linear-gradient(135deg, #f97316, #fb923c)',
      position: 'UX Researcher',
      location: 'New York, NY',
      appliedDate: 'Yesterday',
      salary: '$110k - $135k',
      status: 'applied',
      statusLabel: 'Applied',
      statusColor: 'my-submissions__status--applied',
      progress: 0,
      progressColorClass: 'color-slate',
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
      subtextStyle: { color: '#22c55e' },
      isHighlight: false,
    },
    {
      label: 'Pending Review',
      value: 12,
      icon: 'hourglass_empty',
      subtext: null,
      isHighlight: false,
    },
    {
      label: 'Interviews',
      value: 3,
      icon: 'groups',
      subtext: 'Action needed',
      subtextStyle: { color: 'var(--dashboard-accent)' },
      isHighlight: true,
    },
    {
      label: 'Offers',
      value: 1,
      icon: 'celebration',
      subtext: '+1 new!',
      subtextStyle: { color: '#22c55e' },
      isHighlight: false,
    },
  ];

  const filters = [
    { id: 'all', label: 'All', icon: 'view_list' },
    { id: 'applied', label: 'Applied', icon: 'schedule' },
    { id: 'review', label: 'In Review', icon: 'clock_loader_40' },
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
          Track, manage, and accelerate your active job opportunities.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="my-submissions__stats">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`my-submissions__stat-card ${stat.isHighlight ? 'my-submissions__stat-card--highlight' : ''}`}
          >
            <div className="my-submissions__stat-header">
              <span className="my-submissions__stat-label">{stat.label}</span>
              <span className="material-symbols-outlined my-submissions__stat-icon">
                {stat.icon}
              </span>
            </div>
            <div className="my-submissions__stat-content">
              <span className="my-submissions__stat-value">{stat.value}</span>
              {stat.subtext && (
                <span className="my-submissions__stat-subtext" style={stat.subtextStyle}>
                  {stat.subtext}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Controls */}
      <div className="my-submissions__controls">
        <div className="my-submissions__filters">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`my-submissions__filter-btn ${activeFilter === filter.id ? 'my-submissions__filter-btn--active' : ''}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
                {filter.icon}
              </span>
              <span>{filter.label}</span>
            </button>
          ))}
        </div>

        <div className="my-submissions__search-sort">
          <div className="my-submissions__search">
            <span className="material-symbols-outlined my-submissions__search-icon">search</span>
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
            <span className="material-symbols-outlined my-submissions__sort-icon">expand_more</span>
          </div>
        </div>
      </div>

      {/* Application List */}
      <div className="my-submissions__list">
        {filteredApplications.map((app) => (
          <div key={app.id} className="my-submissions__card">

            <div className="my-submissions__card-header">
              <div className="my-submissions__card-info">
                <div
                  className="my-submissions__company-logo"
                  style={{ cssText: app.logoColor }}
                >
                  {app.logo}
                </div>
                <div>
                  <h3 className="my-submissions__position">{app.position}</h3>
                  <p className="my-submissions__company">
                    {app.company} • {app.location}
                  </p>
                  <div className="my-submissions__meta">
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>calendar_today</span>
                    <span>Applied {app.appliedDate}</span>
                    <span style={{ color: 'var(--dashboard-border)' }}>|</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>payments</span>
                    <span>{app.salary}</span>
                  </div>
                </div>
              </div>

              <div className="my-submissions__card-actions">
                <div className={`my-submissions__status ${app.statusColor}`}>
                  {app.status === 'interview' && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>event_available</span>}
                  {app.status === 'review' && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>rate_review</span>}
                  {app.status === 'applied' && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>forward_to_inbox</span>}
                  {app.statusLabel}
                </div>
                <button className="my-submissions__menu-btn">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
            </div>

            {/* Timeline element */}
            <div className="my-submissions__timeline-wrapper">
              <div className="my-submissions__timeline">
                <div className="my-submissions__timeline-track"></div>
                <div
                  className={`my-submissions__timeline-progress ${app.progressColorClass}`}
                  style={{ width: `${app.progress}%` }}
                ></div>
                <div className="my-submissions__timeline-steps">
                  {app.timeline.map((step, idx) => (
                    <div key={idx} className="my-submissions__timeline-step">
                      <div
                        className={`my-submissions__timeline-dot ${app.progressColorClass} ${step.active
                            ? step.current
                              ? 'my-submissions__timeline-dot--current'
                              : 'my-submissions__timeline-dot--active'
                            : ''
                          }`}
                      ></div>
                      <span
                        className={`my-submissions__timeline-label ${app.progressColorClass} ${step.active
                            ? step.current
                              ? 'my-submissions__timeline-label--current'
                              : 'my-submissions__timeline-label--active'
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

            {/* Insight Footer */}
            <div className="my-submissions__insight">
              <div className="my-submissions__insight-content">
                <span
                  className={`material-symbols-outlined my-submissions__insight-icon ${app.insight.iconClass}`}
                  style={{
                    fontVariationSettings: app.insight.iconFilled ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {app.insight.icon}
                </span>
                <div>
                  <h4 className="my-submissions__insight-title">{app.insight.title}</h4>
                  <p className="my-submissions__insight-description">{app.insight.description}</p>
                </div>
              </div>
              <button className="my-submissions__insight-btn">
                View Details
              </button>
            </div>

          </div>
        ))}

        {filteredApplications.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--dashboard-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>inbox</span>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--dashboard-text)', margin: '0 0 0.5rem 0' }}>No applications found</h3>
            <p>There are no applications matching your current filters or search query.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MySubmissions;
