import React from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step8.css';

const Step8 = ({ formData = {} }) => {
  const { t } = useLanguage();
  
  const experiences = formData.experiences || [];
  const educations = formData.educations || [];
  const skills = formData.skills || [];
  const certificates = formData.certificates || [];
  const jobPreferences = formData.jobPreferences || {};

  const getMetricIcon = (type) => {
    const icons = {
      exp: 'fa-briefcase',
      edu: 'fa-graduation-cap',
      skill: 'fa-brain-circuit',
      cert: 'fa-certificate'
    };
    return icons[type] || 'fa-atom';
  };

  return (
    <div className="step8-wrapper intelligence-dashboard-step">
      <div className="intelligence-layout">
        {/* TOP: IDENTITY CORE */}
        <section className="identity-core-lab">
          <div className="identity-orb">
            <div className="orb-glow" />
            <div className="orb-content">
              <i className="fas fa-microchip" />
              <div className="orb-text">
                <h2>{formData.firstName || 'Candidate'}'s Profile</h2>
                <p>Intelligence Matrix Ready</p>
              </div>
            </div>
          </div>

          <div className="intelligence-metrics">
            <div className="metric-chip">
              <i className={`fas ${getMetricIcon('exp')}`} />
              <div className="metric-val">
                <strong>{experiences.length}</strong>
                <span>{t('account-setup-step-5-title')}</span>
              </div>
            </div>
            <div className="metric-chip">
              <i className={`fas ${getMetricIcon('edu')}`} />
              <div className="metric-val">
                <strong>{educations.length}</strong>
                <span>{t('account-setup-step-4-title')}</span>
              </div>
            </div>
            <div className="metric-chip">
              <i className={`fas ${getMetricIcon('skill')}`} />
              <div className="metric-val">
                <strong>{skills.length}</strong>
                <span>{t('account-setup-step-3-title')}</span>
              </div>
            </div>
            <div className="metric-chip">
              <i className={`fas ${getMetricIcon('cert')}`} />
              <div className="metric-val">
                <strong>{certificates.length}</strong>
                <span>Certificates</span>
              </div>
            </div>
          </div>
        </section>

        {/* BOTTOM: CRYSTAL SUMMARY GRIDS */}
        <div className="summary-grids">
          <section className="lab-panel crystal-panel summary-card">
            <div className="panel-tag"><i className="fas fa-compass" /> Preference Compass</div>
            <div className="pref-summary">
              <div className="pref-item">
                <span>Location</span>
                <strong>{jobPreferences.workLocation || 'Anywhere'}</strong>
              </div>
              <div className="pref-item">
                <span>Availability</span>
                <strong>{jobPreferences.availability || 'Immediate'}</strong>
              </div>
              <div className="pref-item">
                <span>Targeting</span>
                <strong>{jobPreferences.jobTypes || 'Consulting'}</strong>
              </div>
            </div>
          </section>

          <section className="lab-panel crystal-panel summary-card">
            <div className="panel-tag"><i className="fas fa-briefcase" /> Top Experiences</div>
            <div className="mini-list">
              {experiences.slice(0, 2).map((exp, i) => (
                <div key={i} className="mini-item">
                  <strong>{exp.position}</strong>
                  <span>{exp.company}</span>
                </div>
              ))}
              {experiences.length === 0 && <p className="empty-hint">No experience logged</p>}
            </div>
          </section>

          <section className="lab-panel crystal-panel summary-card">
            <div className="panel-tag"><i className="fas fa-brain" /> Core Competencies</div>
            <div className="mini-tags">
              {skills.slice(0, 6).map((skill, i) => (
                <span key={i} className="mini-tag">{skill.name}</span>
              ))}
              {skills.length === 0 && <p className="empty-hint">No skills logged</p>}
            </div>
          </section>
        </div>

        <div className="submission-pulse">
          <div className="pulse-orb" />
          <p>Everything looks perfect. Ready to launch your career laboratory?</p>
        </div>
      </div>
    </div>
  );
};

export default Step8;
