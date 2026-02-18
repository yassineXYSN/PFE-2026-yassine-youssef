import React, { useState } from 'react'
import { useTheme } from '../../context/ThemeContext' // Assuming this exists from other files
import HRSidebar from '../../components/HRSidebar' // Assuming standard sidebar
import { useNavigate } from 'react-router-dom'
import StatCard from '../../components/StatCard'
import './CandidatsList.css'

function CandidatsList() {
    const navigate = useNavigate()
    const { effectiveTheme } = useTheme()
    // Mock data based on HTML
    const candidates = [
        { id: 1, name: 'Alice Dubois', email: 'alice.d@example.com', date: '14 Oct 2023', dept: 'Design', score: 92, match: 'Excellent Match', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDe4jB3eHMjfSAX1DiMpabgiCzKM9VTG8xhLscANwTlm1m93tCcZKJJMy9Cg30fjdi2vtHCRYgQ2eFP4QcpgmQJrS_tDnG_Z53RgByLe6Hl7RCylczBNxTkPGtYb5QBbu-aTpPwfyA5ygSsfpTIQP9yJbORFqQ1bXT_d8XLwNMlz-GRpZCg69mOfibVUHuoeTYNlqoh0I1uT8kaehyBaP_QNalEJOxr627F912VLDTWLpx9bYBMvkiuUh2a8NJPHOOMUHf2q5tQDg' },
        { id: 2, name: 'Marc Lefebvre', email: 'marc.l@example.com', date: '13 Oct 2023', dept: 'Produit', score: 78, match: 'Bon Match', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBOlBWA9VzbTAmT76iS1HxdV0Ov54RtnjbNN8QX9lbtl2_4tNMiqJmc7BcNb6BZ2JPymwo-tXRYpDvOQnA4-sUKVUiSBP9ZKyx7rkAbkqUkhpqsOSDXvomGk-4KS8F5gpXz3uABGUD7i8sPRcPy8o4-LMaT-AezK3znn10jSmkdmIzheVnRO6otwjNjiFQBg4Fz5Vfj718ytSwplrAqUJMJ8rwR4Qilpn7b71YE51-_slw9OT96a_r5r_sK_EXuJhLI1MAKqT5IwA' },
        { id: 3, name: 'Sophie Martin', email: 'sophie.m@example.com', date: '12 Oct 2023', dept: 'Design', score: 85, match: 'Excellent Match', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBO5N9kYVobI8jVHb5x7EGJZ6hUPsOweNz7ggf2nTv_e7iceDgtq0eMnT0CfwTdfsXJEhqjWEl9xAWGgNky7uoYugIg67ox6Y-db_8D7dZ9BT4yLhT8ln14WSVQtJI4kafXVi8pGJS-wE5ZdXLI_8SCic1M0eTiJtdsvvFRk7TYRi4sVRtI0Xqa9Q_2KTtJUelDJkXq-xhOFeaLNtTDAAO9JBeu_N3LcgfifJkiuqRcSCREglhLoBKYlz4G-ZBJ7lO23azZJwObBQ' },
        { id: 4, name: 'Jean Dupont', email: 'jean.d@example.com', date: '10 Oct 2023', dept: 'Marketing', score: 64, match: 'Moyen Match', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6DHDXJp2bJHZoCxXL70nDoBkwZu5WeJSNV__DsydUrmyOFF6VFJB7oSw9VZFvbTPSvowB1lRx5KUXG3wnIN4z5nHRkUZSBs2QQ6kCRsF4eab6eWLa1uALOII83phKIs6hSkg-juaOwo1CLakJMR20dvKo_Ot7ujWUA2PLPYbsYsE4XwVfMnQL4P8XWWmm4EJOz21wGo8P483qLkjt0S3SiEr0HK_IM9-ENmnv2rRoAl8Wtf3J-aNuP2HD0YQsk-ye5Ue9TPTK-g' },
        { id: 5, name: 'Claire Fontaine', email: 'claire.f@example.com', date: '09 Oct 2023', dept: 'Design', score: 45, match: 'Faible Match', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsCLmXb3LvTRzNKohDet8d2qZ2PktSjPDLZ9m8utvcystO_MMRcQOMGEuwzht3TP66QyAiZkxUgAL38wv-2Cb0XrD67I1VGhI1ZsXqQnpii66a4wMEmj6YxG5wACDrSw44xTpYUx2e4AMxcCKtDffnvIZaYSinxx7KQyf3_LsFDXBhxRVp8sVvs459PYIGXglxRpU8ypj4CYZkICNXArI5rh6oxx0PrfnKRaGSS42bs0LvXwz-Ley7fFzcZ5C5ZSTDMpXuHDicxg' },
    ]

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-success bg-green-500' // Using css classes/variables mapping
        if (score >= 50) return 'text-warning bg-yellow-500'
        return 'text-danger bg-red-500'
    }

    const getScoreTextColor = (score) => {
        if (score >= 80) return 'text-success'
        if (score >= 50) return 'text-warning'
        return 'text-danger'
    }

    const getDeptBadge = (dept) => {
        switch (dept) {
            case 'Design': return 'badge-purple'
            case 'Produit': return 'badge-blue'
            default: return 'badge-gray'
        }
    }

    return (
        <div className={`candidats-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="candidats-main">
                {/* Header removed as requested */}


                <div className="candidats-content">


                    {/* Page Header */}
                    <div className="page-header-row">
                        <div className="page-header-text-group">
                            <h1 className="page-title">Liste des Candidats</h1>
                            <p className="page-subtitle">Vue d'ensemble des profils analysés par l'IA pour le poste de Product Designer Senior.</p>
                        </div>
                        <div className="action-group">

                            <button className="btn-primary">
                                <span className="material-symbols-outlined">person_add</span> Ajouter un candidat
                            </button>
                        </div>
                    </div>


                    {/* KPI Grid */}
                    <div className="stats-grid">
                        <StatCard
                            icon="group"
                            label="Total Candidats"
                            value="856"
                            colorTheme="blue"
                        />
                        <StatCard
                            icon="verified"
                            label="Top Match"
                            value="127"
                            colorTheme="green"
                        />
                        <StatCard
                            icon="star_half"
                            label="Moyen"
                            value="584"
                            colorTheme="yellow"
                        />
                        <StatCard
                            icon="schedule"
                            label="En attente"
                            value="145"
                            colorTheme="purple"
                        />
                    </div>

                    {/* Main Layout */}
                    <div className="candidats-layout">
                        {/* List Section */}
                        <div className="list-section">
                            {/* Search Local */}
                            <div className="search-bar" style={{ width: '100%', marginBottom: '1rem' }}>
                                <span className="material-symbols-outlined">search</span>
                                <input type="text" className="search-input" placeholder="Rechercher un candidat à Sfax, Java, ..." />
                            </div>

                            {/* Table */}
                            <div className="table-container">
                                <div className="table-scroll">
                                    <table className="candidats-table">
                                        <thead>
                                            <tr>
                                                <th>Nom du Candidat</th>
                                                <th>Date</th>
                                                <th>Département</th>
                                                <th>Score de Matching IA</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {candidates.map(candidate => (
                                                <tr key={candidate.id}>
                                                    <td>
                                                        <div className="candidate-info">
                                                            <div className="user-avatar" style={{ backgroundImage: `url("${candidate.avatar}")` }}></div>
                                                            <div>
                                                                <div className="candidate-name">{candidate.name}</div>
                                                                <div className="candidate-email">{candidate.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>{candidate.date}</td>
                                                    <td>
                                                        <span className={`badge ${getDeptBadge(candidate.dept)}`}>{candidate.dept}</span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <span className={`candidate-name ${getScoreTextColor(candidate.score)}`}>{candidate.score}%</span>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{candidate.match}</span>
                                                            </div>
                                                            <div className="score-bar-bg">
                                                                <div className="score-bar-fill" style={{ width: `${candidate.score}%`, backgroundColor: candidate.score >= 80 ? '#22c55e' : (candidate.score >= 50 ? '#eab308' : '#ef4444') }}></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button
                                                            className="btn-secondary"
                                                            style={{ display: 'inline-flex' }}
                                                            onClick={() => navigate(`/hr/candidats/${candidate.id}`)}
                                                        >
                                                            Voir profil
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Pagination */}
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
                                    <button className="pagination-number">12</button>
                                </div>
                                <button className="pagination-btn">
                                    Suivant
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        </div>

                        {/* Filters Sidebar */}
                        <aside className="filters-sidebar">
                            <div className="filters-header">
                                <span className="filters-title">
                                    <span className="material-symbols-outlined">tune</span> Filtres Avancés
                                </span>
                                <button style={{ border: 'none', background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Réinitialiser</button>
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">Score IA Minimum</label>
                                <input type="range" className="range-slider" min="0" max="100" defaultValue="50" />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                                    <span>0%</span>
                                    <span style={{ fontWeight: 'bold', color: 'var(--color-text-main)' }}>50%</span>
                                    <span>100%</span>
                                </div>
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">Date de candidature</label>
                                <div className="select-wrapper">
                                    <select className="filter-select">
                                        <option>Tout le temps</option>
                                        <option>Cette semaine</option>
                                        <option>Ce mois</option>
                                        <option>3 derniers mois</option>
                                    </select>
                                </div>
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">Département</label>
                                <div className="checkbox-group">
                                    <label className="checkbox-item">
                                        <input type="checkbox" defaultChecked /> Design (24)
                                    </label>
                                    <label className="checkbox-item">
                                        <input type="checkbox" /> Produit (15)
                                    </label>
                                    <label className="checkbox-item">
                                        <input type="checkbox" /> Marketing (8)
                                    </label>
                                </div>
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">Compétences</label>
                                <div className="tags-group">
                                    <span className="tag-item">Figma</span>
                                    <span className="tag-item">React</span>
                                    <span className="tag-item">UX Research</span>
                                </div>
                            </div>

                            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                                Appliquer les filtres
                            </button>
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default CandidatsList
