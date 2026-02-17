import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HRSidebar from "../../components/HRSidebar";
import { useTheme } from '../../context/ThemeContext';
import './DepartmentCreate.css';

const DepartmentCreate = () => {
    const { theme } = useTheme();
    const effectiveTheme = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;

    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        responsible: '',
        description: '',
        color: 'black',
        icon: 'group'
    });

    const [members, setMembers] = useState([
        { id: 1, name: 'Sarah Cohen', email: 'sarah.cohen@rh-ia.com', avatar: 'https://i.pravatar.cc/150?u=1' },
        { id: 2, name: 'Marc Dubois', email: 'marc.dubois@rh-ia.com', avatar: 'https://i.pravatar.cc/150?u=2' }
    ]);

    const [newMemberEmail, setNewMemberEmail] = useState('');

    const colors = [
        { name: 'black', class: 'black' },
        { name: 'blue', class: 'blue' },
        { name: 'purple', class: 'purple' },
        { name: 'emerald', class: 'emerald' },
        { name: 'orange', class: 'orange' },
        { name: 'rose', class: 'rose' }
    ];

    const icons = ['apartment', 'group', 'campaign', 'code', 'payments', 'support_agent'];

    const handleAddMember = () => {
        if (newMemberEmail.trim()) {
            setMembers([...members, {
                id: Date.now(),
                name: newMemberEmail.split('@')[0],
                email: newMemberEmail,
                avatar: `https://i.pravatar.cc/150?u=${Date.now()}`
            }]);
            setNewMemberEmail('');
        }
    };

    const handleRemoveMember = (id) => {
        setMembers(members.filter(m => m.id !== id));
    };

    return (
        <div className={`dept-create-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="dept-create-main">
                <div className="dept-create-content">
                    <header className="dept-create-header">


                        <div className="title-content-group">
                            <h1 className="page-title">Créer un Nouveau Département</h1>
                            <p className="page-subtitle">Organisez votre structure RH en ajoutant un nouveau département fonctionnel.</p>
                        </div>
                    </header>

                    <div className="dept-create-form-container card-glass">
                        {/* Section 1: Informations Générales */}
                        <section className="form-section">
                            <h2 className="section-title">Informations Générales</h2>
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label className="form-label">Nom du département</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="ex: Marketing Digital"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="form-group flex-1">
                                    <label className="form-label">Responsable du département</label>
                                    <div className="input-with-icon">
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Rechercher un membre..."
                                            value={formData.responsible}
                                            onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                                        />
                                        <span className="material-symbols-outlined search-icon">search</span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Décrivez les responsabilités et missions principales de ce département..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                ></textarea>
                            </div>
                        </section>

                        <div className="section-divider"></div>

                        {/* Section 2: Apparence */}
                        <section className="form-section appearance-section">
                            <h2 className="section-title">Identité visuelle</h2>
                            <div className="appearance-grid">
                                <div className="appearance-group">
                                    <p className="group-label">Couleur d'étiquette</p>
                                    <div className="color-options">
                                        {colors.map(c => (
                                            <button
                                                key={c.name}
                                                className={`color-btn ${c.class} ${formData.color === c.name ? 'active' : ''}`}
                                                onClick={() => setFormData({ ...formData, color: c.name })}
                                                aria-label={c.name}
                                            ></button>
                                        ))}
                                    </div>
                                </div>

                                <div className="appearance-group flex-1">
                                    <p className="group-label">Icône représentative</p>
                                    <div className="icon-options">
                                        {icons.map(icon => (
                                            <button
                                                key={icon}
                                                className={`icon-btn-choice ${formData.icon === icon ? 'active' : ''}`}
                                                onClick={() => setFormData({ ...formData, icon })}
                                            >
                                                <span className="material-symbols-outlined">{icon}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="section-divider"></div>

                        {/* Section 3: Inviter des membres */}
                        <section className="form-section members-section">
                            <h2 className="section-title">Inviter des membres</h2>
                            <div className="member-add-row">
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="Adresse email du collaborateur"
                                    value={newMemberEmail}
                                    onChange={(e) => setNewMemberEmail(e.target.value)}
                                />
                                <button className="btn-add" onClick={handleAddMember}>Ajouter</button>
                            </div>

                            <div className="members-list">
                                {members.map(member => (
                                    <div key={member.id} className="member-item group">
                                        <div className="member-info">
                                            <img src={member.avatar} alt={member.name} className="member-avatar" />
                                            <div className="member-text">
                                                <p className="member-name">{member.name}</p>
                                                <p className="member-email">{member.email}</p>
                                            </div>
                                        </div>
                                        <button className="btn-remove" onClick={() => handleRemoveMember(member.id)}>
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <footer className="form-footer">
                            <button className="btn-cancel" onClick={() => navigate('/hr/departement')}>Annuler</button>
                            <button className="btn-submit" onClick={() => navigate('/hr/departement')}>Créer le département</button>
                        </footer>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DepartmentCreate;
