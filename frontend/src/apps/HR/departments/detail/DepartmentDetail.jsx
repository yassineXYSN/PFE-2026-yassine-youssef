import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import HRSidebar from "../../components/HRSidebar";
import { useTheme } from '../../context/ThemeContext';
import StatCard from '../../components/StatCard';
import './DepartmentDetail.css';

const DepartmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { effectiveTheme } = useTheme();

    const department = {
        name: 'Département IT',
        responsible: 'Jean Dupont',
        stats: {
            activeJobs: 8,
            newJobsLastMonth: 2,
            totalCandidates: 245,
            matchingScore: '87%'
        }
    };

    const jobs = [
        { id: 1, title: 'Senior Frontend Developer', location: 'Remote • Paris', status: 'Actif', statusClass: 'active', candidates: 42, hasNew: true, date: '12 Oct 2023' },
        { id: 2, title: 'Backend Engineer', location: 'Hybride • Lyon', status: 'Actif', statusClass: 'active', candidates: 18, hasNew: false, date: '15 Oct 2023' },
        { id: 3, title: 'Data Scientist', location: 'Sur site • Paris', status: 'Pause', statusClass: 'paused', candidates: 65, hasNew: false, date: '01 Sept 2023' },
        { id: 4, title: 'Product Manager', location: 'Remote', status: 'Fermé', statusClass: 'closed', candidates: 120, hasNew: false, date: '20 Aug 2023' }
    ];

    const [currentPage, setCurrentPage] = useState(1);
    const jobsPerPage = 5;
    const totalPages = Math.ceil(jobs.length / jobsPerPage);

    const indexOfLastJob = currentPage * jobsPerPage;
    const indexOfFirstJob = indexOfLastJob - jobsPerPage;
    const currentJobs = jobs.slice(indexOfFirstJob, indexOfLastJob);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const team = [
        { name: 'Alice Martin', role: 'Recruteur Senior', status: 'online', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZrF2Y1d_qDJpouUmo1peS-PnFdgYO4quW91jJKyZgQ3tnRzOiMGBLTHZcDbdsneC1MRkVdt8L-b_TIIc1Q2dxU7TCoF2yVkP7dSZmOJAvM6n1iU6oHD4u9m3GDR9KX4Gbb_XraJp2PLTvk8_KTZo6ctY6mkAvOiNPF4IJPX5ZzD8IpfP9SKTO2nIlfhucOqlWfEqqoh1TCj_4gCJHPo6I7FrZvGzhxyWCwYWVd6sc0o3_KcMpLEV3HFaiuEL4838WyeYlb3Js4A' },
        { name: 'Thomas Bernard', role: 'Sourcing Specialist', status: 'offline', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCtSCGmGFW5uoRsyLCiLgGAqPpjHgI96BhSaUOVP7kznV4gGvokyjC4hYS52rHQ65ikVjlqal_B-2qtJdaJyQBD_niTuUHJ8GkENHqe_hUhMdTnF9oyf0WRBrODwvnEPohtUZct-xf4rzd-qgAjW7QmU9Wt63q_SFMEk2KSEsTvAEwq1kjv84b9at3njm_ciB4m6p5WNzq3gYpYOVc3_YrtoPB5M5DKpN052zfp9F80YlGlSHJPjlX6eplm6_f8PCaEVT2b4LiPRQ' },
        { name: 'Sophie Petit', role: 'Coordinatrice RH', status: 'online', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcjj2eRg_1eHr7GMxVDLfx5c_nQAMpLOAm5C_gqBoQF4YvzGUgSOp_H_VcEg90bDdT9QaWTVYhInAurzWJF68k-ybhs4zuMmyDcER-8t6nteXnAsTirF2Z-_FjZnEa1IGdE_Ib4Wn_jijfx7_RAty400ltTfgKofPhQ_FCLEHWxoor8fbwQGVcdGBo-v6kXDL__VX22zJ-Kapa_HzGOOQc9YswTzWPZAl94FtB4DsWWRHvi41k6m9S6FfSWO6wa6YVex0FKBZNUg' },
        { name: 'Marc Dubois', role: 'Consultant Ext.', status: 'offline', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCDdo-0yCP15uMpFmYc-ZFmstbBy8Wk9MC1lnAaUcObMATX5UicVvtoLF3SkrIqrzccohiJvlCejfCAETe5iuJFlFveHq_2h_PjzVn2SAKgAeAfDB-g041R9k5ICH-TfhbL2uq1SukhY_D2-nn0mdxVj9GUK5DtlxzrXRCG_XKDMYAkhqxVke08ftI_rUw7CwAVLKGPUZkyAxSm02MWIMh7uqaQCKqmpjRg_lCo-Tr4Rrj18QYgCFvvIZ7bMiUZmSp5LsadF7MzUA' }
    ];

    return (
        <div className={`dept-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="dept-detail-main">
                <div className="dept-detail-container">
                    {/* Header Section */}
                    <header className="dept-detail-header">
                        <div className="header-info">

                            <h1 className="page-title">{department.name}</h1>
                            <div className="responsible-row">
                                <span className="material-symbols-outlined">badge</span>
                                <span>Responsable : {department.responsible}</span>
                            </div>
                        </div>
                        <button className="btn btn-primary glow-effect">
                            <span className="material-symbols-outlined">manage_accounts</span>
                            Gérer les membres
                        </button>
                    </header>

                    {/* KPI Stats Grid */}
                    <section className="stats-grid">
                        <StatCard
                            icon="work_outline"
                            label="Jobs Actifs"
                            value={department.stats.activeJobs}
                            trend={`+${department.stats.newJobsLastMonth}`}
                            trendType="success"
                        />
                        <StatCard
                            icon="groups"
                            label="Total Candidats"
                            value={department.stats.totalCandidates}
                        />
                        <StatCard
                            icon="hub"
                            label="Score de matching"
                            value={department.stats.matchingScore}
                            trend="Moyenne haute"
                            trendType="success"
                        />
                    </section>

                    {/* AI Insights Banner */}
                    <div className="ai-insights-banner glass-card">
                        <div className="ai-icon-wrapper">
                            <span className="material-symbols-outlined">auto_awesome</span>
                        </div>
                        <div className="ai-content">
                            <h3 className="ai-title">IA Insights</h3>
                            <p className="ai-text">Le département IT a besoin de renforcer ses compétences en Backend. Une hausse des candidatures est prévue le mois prochain.</p>
                        </div>
                        <button className="btn-analyze-banner">
                            Analyser
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>

                    <div className="detail-layout">
                        {/* Main Content: Jobs Table */}
                        <div className="main-content">
                            <div className="section-header">
                                <h2 className="section-title">Postes Ouverts</h2>
                                <button className="text-btn">Voir tout</button>
                            </div>

                            <div className="table-container glass-card">
                                <table className="jobs-table">
                                    <thead>
                                        <tr>
                                            <th>Intitulé du poste</th>
                                            <th>Statut</th>
                                            <th className="text-center">Candidats</th>
                                            <th className="text-right">Création</th>
                                            <th className="action-col"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentJobs.map(job => (
                                            <tr key={job.id}>
                                                <td>
                                                    <div className="job-info-cell">
                                                        <span className="job-name">{job.title}</span>
                                                        <span className="job-loc">{job.location}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${job.statusClass}`}>
                                                        {job.status}
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    <div className="candidates-cell">
                                                        <span className="candidate-count">{job.candidates}</span>
                                                        {job.hasNew && <span className="new-dot"></span>}
                                                    </div>
                                                </td>
                                                <td className="text-right date-cell">{job.date}</td>
                                                <td className="action-col">
                                                    <button className="btn-icon-soft">
                                                        <span className="material-symbols-outlined">more_vert</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="table-pagination">
                                    <button
                                        className="pagination-btn"
                                        disabled={currentPage === 1}
                                        onClick={() => paginate(currentPage - 1)}
                                    >
                                        <span className="material-symbols-outlined">chevron_left</span>
                                    </button>
                                    <div className="pagination-numbers">
                                        {[...Array(totalPages)].map((_, i) => (
                                            <button
                                                key={i}
                                                className={`page-num ${currentPage === i + 1 ? 'active' : ''}`}
                                                onClick={() => paginate(i + 1)}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        className="pagination-btn"
                                        disabled={currentPage === totalPages}
                                        onClick={() => paginate(currentPage + 1)}
                                    >
                                        <span className="material-symbols-outlined">chevron_right</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar: Team */}
                        <aside className="detail-sidebar">
                            <div className="section-header">
                                <h2 className="section-title">Équipe RH</h2>
                                <button className="btn-icon-circle">
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                            </div>

                            <div className="team-list glass-card">
                                {team.map((member, idx) => (
                                    <div key={idx} className="team-item">
                                        <div className="avatar-wrapper">
                                            <img src={member.avatar} alt={member.name} className={`avatar ${member.status === 'offline' ? 'grayscale' : ''}`} />
                                            <span className={`status-dot ${member.status}`}></span>
                                        </div>
                                        <div className="member-meta">
                                            <span className="member-name">{member.name}</span>
                                            <span className="member-role">{member.role}</span>
                                        </div>
                                        <button className="btn-message">
                                            <span className="material-symbols-outlined">chat</span>
                                        </button>
                                    </div>
                                ))}
                                <button className="btn-view-team">Voir toute l'équipe</button>
                            </div>
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DepartmentDetail;
