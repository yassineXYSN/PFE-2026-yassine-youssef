import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import HRSidebar from '../../components/HRSidebar';
import './JobOverview.css';

const JobOverview = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();

    const jobs = [
        {
            id: 1,
            title: 'Senior Frontend Developer',
            location: 'Remote • Full-time',
            department: 'Engineering',
            created: '24 Oct, 2023',
            candidates: [
                'https://lh3.googleusercontent.com/aida-public/AB6AXuD1z_GOqMqFPULIAlOq9OnU91bwyd0rwSMJL-_wsONh8nlsvBEQ9L8rXAgDXzkB3DeetCyYq9_DM0lsMYq7H1bkm1sSeRZG2Xyaxf3loMgAr6egV8whpa4eOmzSELtsmvPKL4zSzvmsDQDDvARRbMkEGWNU36r-Pqaf7sAS6WknWCCquzgoRaLkf8xqbDZ_Sbl9BYz577umoqx74LWOyorcwA6mrvzEXOaCS3P0DzpYYvXtro6MeAL6j5Ka9jM_1nwTNpE07tHCNQ',
                'https://lh3.googleusercontent.com/aida-public/AB6AXuDoMiClUik2GTsGwyfnMiMNovddwlXW5TsFgbfTzFr5CD-KFzt7daL6Gs6v9w4-hnd9F3rWuaRRsn6bme_3w04U77tnXSCt8nixGdKWLiEbYB-mZtExdGdw_IjMnE5T5o9DEiLgJjdC0h7sLnmRAE7x-3XZJIYVCeVE_5Hs5-5JbMFkG0e0lzRsE_fMz186C67c6hQdbV0FxftHo2VsjHWPP7r6Rh4dOvM7QnGtYjd2ldWl_-SArP6QgJPWEBgq3H8pCC9NAmUoqg',
                'https://lh3.googleusercontent.com/aida-public/AB6AXuCHv9d0NCxkXrJt0U9XD7nHiVXTFbFKgNH-mk8f6Ho20ZJ4GmIe3BJpnp3WvHqheMPpLy4jQoN8XlKlmMrsDkl46ySilwvXtAzs1N93HHmZAKKsD7F3-yeCKbvdN2eJEg_OZ8zX5QNTSCfudOgbHsL7gS0NFQoWBJwjzoRLiVKdz8e3qKAJ3aRuGae8SiF3U0GHD48spDojCKYysDQ8HLsqZyFLgnjj-ZUGN0ODiX35FSBe5MagE6mSJv6USb7AGaImZ8baZ9tU3g'
            ],
            candidateCount: 39,
            aiScore: 98,
            status: 'Ouvert',
            statusClass: 'open'
        },
        {
            id: 2,
            title: 'Product Manager',
            location: 'Paris • On-site',
            department: 'Product',
            created: '20 Oct, 2023',
            candidates: [
                'https://lh3.googleusercontent.com/aida-public/AB6AXuBQL9KzAzu1KyWaxVcylP1qqRyrqPsUvl_zkNOLGT7d3__mj1y08tzF7i4vmK2_m_YGSl858AbVrNu8TgBQOIzn-OsV8f-WfFxQ4wvOfja4V4l8quVNRo5jF7PPyHUGjHpq2hyCHkMcwVPg2EnjyqvBZ1wk5YqdrP_Xj1O7SSsEmqJypCgsjMslHIJcNLtdVsAiRftsyj3omWuKDxjswFrGbuMXs4DMK40XiYhsuu-SsGiD90yvXMwrCcxKUWj9p6zgiBvG7uD9FQ',
                'https://lh3.googleusercontent.com/aida-public/AB6AXuBTKou7WE1t3bdOzxVuO5JUgPq06Pn7scX1TcTn37ceYO6YiBp8RffDTqfObofKAbMhKYorUM5VqMJPa22oly_Qwih0Bka4e1SCE6K4KBPZgBXn5oG8Tna25B7GUWQkJ89lmH4O4UIUsmwhk4SW9i83HHnc4JnFItulYPZovZXsQjIYEpJZiaex_E70uRSDoZTerkArTw8BOTHDVfxzagIGP2mUe7UsEH7oU6ezcoWIcqaR1wWJZhU94V9VUq9leei4XKdgEGPwwQ'
            ],
            candidateCount: 16,
            aiScore: 85,
            status: 'Ouvert',
            statusClass: 'open'
        },
        {
            id: 3,
            title: 'UX Designer',
            location: 'Hybrid • Full-time',
            department: 'Design',
            created: '15 Oct, 2023',
            candidates: [],
            candidateCount: 35,
            aiScore: 92,
            status: 'Fermé',
            statusClass: 'closed'
        },
        {
            id: 4,
            title: 'Data Scientist',
            location: 'Remote • Contract',
            department: 'Data',
            created: '10 Oct, 2023',
            candidates: [
                'https://lh3.googleusercontent.com/aida-public/AB6AXuAlk_04wm0fq5FHQuG2Mkp0ACf5krnqwOLXX3ygP9sFp_1CHUQqsATqZ-7vZFieWwS7fgbl_9J5nfURA9lYIi1QWs2J_HngGpNb4G9t4OKb_YXsMD5-j4RuDum7Flp6jByk7Ht0ZG3eZTxwqXxYVYkUNdvUD75lcu-NY8du1Dbf3T2S1yf1qfcnVcfr_s_s0jA_V-Q-vyfZdeIl5jvJgglWBiW79AW4HxbhO3UhXAXb5B-abP04m3A_XtrcXc-AsPEEQ87S0LVVZA'
            ],
            candidateCount: 11,
            aiScore: 76,
            status: 'Ouvert',
            statusClass: 'open'
        },
        {
            id: 5,
            title: 'Sales Executive',
            location: 'London • Full-time',
            department: 'Sales',
            created: '05 Oct, 2023',
            candidates: [],
            candidateCount: 56,
            aiScore: 88,
            status: 'Fermé',
            statusClass: 'closed'
        }
    ];

    return (
        <div className={`job-overview-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="job-overview-main">
                <div className="job-overview-container">
                    {/* Header similar to Dashboard/CandidatsList */}
                    <div className="page-header">
                        <div className="page-header-text">

                            <h2 className="page-title">Vue d'ensemble des Jobs</h2>
                            <p className="page-subtitle">Gérez vos offres d'emploi actives et suivez les performances de recrutement IA en temps réel.</p>
                        </div>

                    </div>

                    <div className="search-bar-container">
                        <div className="search-box">
                            <span className="material-symbols-outlined search-icon">search</span>
                            <input
                                className="search-input"
                                type="text"
                                placeholder="Rechercher une offre à Tunis, Sfax..."
                            />
                        </div>
                        <div className="action-buttons">
                            <button className="btn btn-secondary">
                                <span className="material-symbols-outlined">filter_list</span>
                                <span>Filtres</span>
                            </button>
                            <button className="btn btn-primary" onClick={() => navigate('/hr/offres/new')}>
                                <span className="material-symbols-outlined">add</span>
                                <span>Ajouter une offre</span>
                            </button>
                        </div>
                    </div>

                    <div className="job-content-card">
                        <table className="jobs-table">
                            <thead>
                                <tr>
                                    <th>Titre du Job</th>
                                    <th>Département</th>
                                    <th>Date de création</th>
                                    <th>Candidats</th>
                                    <th>
                                        <div className="th-with-icon">
                                            Performance IA
                                            <span className="material-symbols-outlined info-icon" title="Meilleur score de matching">info</span>
                                        </div>
                                    </th>
                                    <th>Statut</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map(job => (
                                    <tr
                                        key={job.id}
                                        className={`job-row ${job.statusClass}`}
                                        onClick={() => navigate(`/hr/offres/${job.id}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>
                                            <div className="job-info">
                                                <div className="job-title">{job.title}</div>
                                                <div className="job-location">{job.location}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="department-badge">
                                                {job.department}
                                            </span>
                                        </td>
                                        <td className="job-date">{job.created}</td>
                                        <td>
                                            <div className="candidates-stack">
                                                {job.candidates.length > 0 ? (
                                                    <div className="avatar-group">
                                                        {job.candidates.map((url, i) => (
                                                            <div key={i} className="avatar-wrapper">
                                                                <img src={url} alt="Candidate" className="candidate-avatar" />
                                                            </div>
                                                        ))}
                                                        <div className="more-candidates">+{job.candidateCount}</div>
                                                    </div>
                                                ) : (
                                                    <span className="no-candidates">{job.candidateCount} candidats</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="ai-performance">
                                                <div className={`score-badge ${job.aiScore >= 90 ? 'high' : job.aiScore >= 70 ? 'mid' : 'low'}`}>
                                                    {job.aiScore}%
                                                </div>
                                                {job.status === 'Ouvert' && <span className="top-match-label">Top Match</span>}
                                            </div>
                                            {job.status === 'Ouvert' && (
                                                <div className="progress-track">
                                                    <div
                                                        className="progress-fill"
                                                        style={{ width: `${job.aiScore}%` }}
                                                    ></div>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${job.statusClass}`}>
                                                <span className="status-dot"></span>
                                                {job.status}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <button className="btn-icon">
                                                <span className="material-symbols-outlined">more_horiz</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="pagination-container">
                            <button className="pagination-btn" disabled>
                                <span className="material-symbols-outlined">chevron_left</span>
                                Précédent
                            </button>
                            <div className="pagination-numbers">
                                <button className="pagination-number active">1</button>
                                <button className="pagination-number">2</button>
                                <button className="pagination-number">3</button>
                                <span className="pagination-dots">...</span>
                                <button className="pagination-number">6</button>
                            </div>
                            <button className="pagination-btn">
                                Suivant
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default JobOverview;
