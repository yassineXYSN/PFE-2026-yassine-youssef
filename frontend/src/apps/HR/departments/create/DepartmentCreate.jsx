import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HRSidebar from "../../components/HRSidebar";
import { useTheme } from '../../context/ThemeContext';
import { apiFetch } from '../../../../core/api';
import { supabase } from '../../../../core/supabaseClient';
import './DepartmentCreate.css';

const DepartmentCreate = () => {
    const { effectiveTheme } = useTheme();

    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        responsible: '',
        description: '',
        color: 'black',
        icon: 'group'
    });

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const userProfile = await apiFetch(`/profiles/${session.user.id}`);
                    setProfile(userProfile);
                }
            } catch (err) {
                console.error("Error fetching user data:", err);
            }
        };
        fetchUserData();
    }, []);

    const [members, setMembers] = useState([]);
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

    const handleSubmit = async () => {
        if (!formData.name) {
            setError("Le nom du département est requis.");
            return;
        }

        if (!profile?.company_id) {
            setError("Impossible d'associer le département à une entreprise. Profil non trouvé.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await apiFetch('/departments/', {
                method: 'POST',
                body: JSON.stringify({
                    name: formData.name,
                    company_id: profile.company_id,
                    description: formData.description,
                    manager_id: formData.responsible || null,
                    color: formData.color,
                    icon: formData.icon
                })
            });
            navigate('/hr/departement');
        } catch (err) {
            console.error("Error creating department:", err);
            setError("Erreur lors de la création du département : " + err.message);
        } finally {
            setLoading(false);
        }
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

                    {error && (
                        <div className="error-banner card-glass" style={{ color: '#ef4444', padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid #ef4444' }}>
                            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}>error</span>
                            {error}
                        </div>
                    )}

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
                                        disabled={loading}
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
                                            disabled={loading}
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
                                    disabled={loading}
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
                                                disabled={loading}
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
                                                disabled={loading}
                                            >
                                                <span className="material-symbols-outlined">{icon}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="section-divider"></div>

                        {/* Section 3: Inviter des membres (Visual only for now) */}
                        <section className="form-section members-section">
                            <h2 className="section-title">Inviter des membres</h2>
                            <div className="member-add-row">
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="Adresse email du collaborateur"
                                    value={newMemberEmail}
                                    onChange={(e) => setNewMemberEmail(e.target.value)}
                                    disabled={loading}
                                />
                                <button className="btn-add" onClick={handleAddMember} disabled={loading}>Ajouter</button>
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
                                        <button className="btn-remove" onClick={() => handleRemoveMember(member.id)} disabled={loading}>
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <footer className="form-footer">
                            <button className="btn-cancel" onClick={() => navigate('/hr/departement')} disabled={loading}>Annuler</button>
                            <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
                                {loading ? 'Création en cours...' : 'Créer le département'}
                            </button>
                        </footer>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DepartmentCreate;
