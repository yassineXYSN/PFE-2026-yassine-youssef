import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import HRSidebar from "../../components/HRSidebar";
import { useTheme } from '../../context/ThemeContext';
import { apiFetch } from '../../../../core/api';
import './DepartmentEdit.css';

const DepartmentEdit = () => {
    const { id } = useParams();
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: '',
        responsible: '',
        description: '',
        color: 'black',
        icon: 'group'
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDept = async () => {
            try {
                const data = await apiFetch(`/departments/${id}`);
                setFormData({
                    name: data.name,
                    responsible: data.manager_id || '',
                    description: data.description || '',
                    color: data.color || 'black',
                    icon: data.icon || 'group'
                });
            } catch (err) {
                console.error("Error fetching department:", err);
                setError("Impossible de charger le département.");
            } finally {
                setLoading(false);
            }
        };
        fetchDept();
    }, [id]);

    const colors = [
        { name: 'black', class: 'black' },
        { name: 'blue', class: 'blue' },
        { name: 'purple', class: 'purple' },
        { name: 'emerald', class: 'emerald' },
        { name: 'orange', class: 'orange' },
        { name: 'rose', class: 'rose' }
    ];

    const icons = ['apartment', 'group', 'campaign', 'code', 'payments', 'support_agent'];

    const handleSubmit = async () => {
        if (!formData.name) {
            setError("Le nom du département est requis.");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            await apiFetch(`/departments/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description,
                    manager_id: formData.responsible || null,
                    color: formData.color,
                    icon: formData.icon
                })
            });
            navigate(`/hr/departement/${id}`);
        } catch (err) {
            console.error("Error updating department:", err);
            setError("Erreur lors de la mise à jour : " + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className={`dept-edit-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="dept-edit-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loading-spinner">Chargement...</div>
                </main>
            </div>
        );
    }

    return (
        <div className={`dept-edit-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="dept-edit-main">
                <div className="dept-edit-content">
                    <header className="dept-edit-header">
                        <div className="title-content-group">
                            <h1 className="page-title">Modifier le Département</h1>
                            <p className="page-subtitle">Mettez à jour les informations et l'apparence de votre équipe.</p>
                        </div>
                    </header>

                    {error && (
                        <div className="error-banner card-glass" style={{ color: '#ef4444', padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid #ef4444' }}>
                            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}>error</span>
                            {error}
                        </div>
                    )}

                    <div className="dept-edit-form-container card-glass">
                        <section className="form-section">
                            <h2 className="section-title">Informations Générales</h2>
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label className="form-label">Nom du département</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        disabled={saving}
                                    />
                                </div>
                                <div className="form-group flex-1">
                                    <label className="form-label">Responsable</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.responsible}
                                        onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                                        disabled={saving}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-textarea"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    disabled={saving}
                                ></textarea>
                            </div>
                        </section>

                        <div className="section-divider"></div>

                        <section className="form-section appearance-section">
                            <h2 className="section-title">Identité visuelle</h2>
                            <div className="appearance-grid">
                                <div className="appearance-group">
                                    <p className="group-label">Couleur</p>
                                    <div className="color-options">
                                        {colors.map(c => (
                                            <button
                                                key={c.name}
                                                className={`color-btn ${c.class} ${formData.color === c.name ? 'active' : ''}`}
                                                onClick={() => setFormData({ ...formData, color: c.name })}
                                                disabled={saving}
                                            ></button>
                                        ))}
                                    </div>
                                </div>

                                <div className="appearance-group flex-1">
                                    <p className="group-label">Icône</p>
                                    <div className="icon-options">
                                        {icons.map(icon => (
                                            <button
                                                key={icon}
                                                className={`icon-btn-choice ${formData.icon === icon ? 'active' : ''}`}
                                                onClick={() => setFormData({ ...formData, icon })}
                                                disabled={saving}
                                            >
                                                <span className="material-symbols-outlined">{icon}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <footer className="form-footer">
                            <button className="btn-cancel" onClick={() => navigate(`/hr/departement/${id}`)} disabled={saving}>Annuler</button>
                            <button className="btn-submit" onClick={handleSubmit} disabled={saving}>
                                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                            </button>
                        </footer>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DepartmentEdit;
