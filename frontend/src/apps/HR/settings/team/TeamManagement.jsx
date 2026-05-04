import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../../core/api';
import HRSidebar from '../../components/HRSidebar';
import { useTheme } from '../../context/ThemeContext';
import './TeamManagement.css';

const TeamManagement = () => {
    const { effectiveTheme } = useTheme();
    const [members, setMembers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [inviteData, setInviteData] = useState({
        email: '',
        first_name: '',
        last_name: '',
        role: 'recruiter',
        department_id: '',
        temporary_password: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [membersData, deptsData] = await Promise.all([
                apiFetch('/team/members'),
                apiFetch('/departments')
            ]);
            setMembers(membersData || []);
            setDepartments(deptsData || []);
        } catch (err) {
            console.error('Error fetching team data:', err);
            setError('Impossible de charger les données de l\'équipe.');
        } finally {
            setLoading(false);
        }
    };

    const generateTempPassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let pwd = "";
        for (let i = 0; i < 12; i++) {
            pwd += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setInviteData({ ...inviteData, temporary_password: pwd });
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await apiFetch('/team/invite', {
                method: 'POST',
                body: JSON.stringify(inviteData)
            });
            setShowInviteModal(false);
            setInviteData({ email: '', first_name: '', last_name: '', role: 'recruiter', department_id: '' });
            fetchData();
        } catch (err) {
            setError(err.message || 'Erreur lors de l\'envoi de l\'invitation.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleMemberDelete = async (memberId, memberName) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${memberName} de l'équipe ?`)) {
            return;
        }

        try {
            await apiFetch(`/profiles/${memberId}`, {
                method: 'DELETE'
            });
            fetchData(); // Refresh list
        } catch (err) {
            console.error('Error deleting member:', err);
            setError('Erreur lors de la suppression du membre.');
        }
    };

    const getRoleBadge = (role) => {
        const roles = {
            admin: { label: 'Admin', class: 'badge-admin' },
            recruiter: { label: 'Recruteur', class: 'badge-recruiter' },
            chef_departement: { label: 'Chef de Dép.', class: 'badge-chef' },
            superadmin: { label: 'Super Admin', class: 'badge-super' }
        };
        const r = roles[role] || { label: role, class: 'badge-default' };
        return <span className={`team-role-badge ${r.class}`}>{r.label}</span>;
    };

    if (loading) {
        return (
            <div className={`team-management-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="team-main">
                    <div className="team-loading">Chargement de l'équipe...</div>
                </main>
            </div>
        );
    }

    return (
        <div className={`team-management-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />
            
            <main className="team-main">
                {/* Mobile Header */}
                <div className="team-mobile-header">
                    <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <h1 className="mobile-header-title">Équipe</h1>
                </div>

                <div className="team-container">
            <div className="team-header">
                <div>
                    <h1>Gestion de l'équipe</h1>
                    <p className="subtitle">Gérez les accès et invitez vos collaborateurs.</p>
                </div>
                <button className="btn-invite" onClick={() => setShowInviteModal(true)}>
                    <span className="material-symbols-outlined">person_add</span>
                    Inviter un membre
                </button>
            </div>

            {error && <div className="team-error-banner">{error}</div>}

            <div className="team-list-card">
                <table className="team-table">
                    <thead>
                        <tr>
                            <th>Membre</th>
                            <th>Rôle</th>
                            <th>Département</th>
                            <th>Statut</th>
                            <th className="text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.map(member => (
                            <tr key={member._id}>
                                <td>
                                    <div className="member-info">
                                        <div className="member-avatar">
                                            {member.first_name?.[0]}{member.last_name?.[0]}
                                        </div>
                                        <div>
                                            <div className="member-name">{member.first_name} {member.last_name}</div>
                                            <div className="member-email">{member.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>{getRoleBadge(member.role)}</td>
                                <td>
                                    {member.department_id ? 
                                        departments.find(d => d._id === member.department_id)?.name || 'Département inconnu' 
                                        : '-'
                                    }
                                </td>
                                <td>
                                    <span className={`status-pill ${member.status}`}>
                                        {member.status === 'invited' ? 'Invité' : 'Actif'}
                                    </span>
                                </td>
                                <td className="text-center">
                                    <div className="member-actions">
                                        <button 
                                            className="btn-icon-delete" 
                                            title="Supprimer le membre"
                                            onClick={() => handleMemberDelete(member._id, `${member.first_name} ${member.last_name}`)}
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showInviteModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Inviter un collaborateur</h2>
                            <button className="btn-close" onClick={() => setShowInviteModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleInvite}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Prénom</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={inviteData.first_name}
                                        onChange={e => setInviteData({...inviteData, first_name: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Nom</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={inviteData.last_name}
                                        onChange={e => setInviteData({...inviteData, last_name: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Email professionnel</label>
                                <input 
                                    type="email" 
                                    required 
                                    value={inviteData.email}
                                    onChange={e => setInviteData({...inviteData, email: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Rôle</label>
                                <select 
                                    value={inviteData.role}
                                    onChange={e => setInviteData({...inviteData, role: e.target.value})}
                                >
                                    <option value="recruiter">Recruteur</option>
                                    <option value="chef_departement">Chef de Département</option>
                                </select>
                            </div>

                            {inviteData.role === 'chef_departement' && (
                                <div className="form-group">
                                    <label>Département rattaché</label>
                                    <select 
                                        required
                                        value={inviteData.department_id}
                                        onChange={e => setInviteData({...inviteData, department_id: e.target.value})}
                                    >
                                        <option value="">Sélectionner un département</option>
                                        {departments.map(d => (
                                            <option key={d._id} value={d._id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Mot de passe temporaire (Optionnel)</label>
                                <div className="pwd-input-group">
                                    <input 
                                        type="text" 
                                        placeholder="Laissez vide pour invitation standard"
                                        value={inviteData.temporary_password}
                                        onChange={e => setInviteData({...inviteData, temporary_password: e.target.value})}
                                    />
                                    <button type="button" className="btn-generate" onClick={generateTempPassword}>
                                        Générer
                                    </button>
                                </div>
                                <p className="field-hint">Si saisi, le compte sera créé immédiatement et l'utilisateur pourra se connecter avec.</p>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowInviteModal(false)}>Annuler</button>
                                <button type="submit" className="btn-primary" disabled={submitting}>
                                    {submitting ? 'Envoi...' : 'Envoyer l\'invitation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
                </div>
            </main>
        </div>
    );
};

export default TeamManagement;
