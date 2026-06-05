import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../../core/api';
import { fetchPasswordPolicy, validatePassword, generateCompliantPassword } from '../../../../core/passwordPolicy';
import HRSidebar from '../../components/HRSidebar';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../../../core/useLanguage';
import './TeamManagement.css';

const TeamManagement = () => {
    const { effectiveTheme } = useTheme();
    const { t } = useLanguage();
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
    const [passwordPolicy, setPasswordPolicy] = useState(null);
    const [passwordError, setPasswordError] = useState('');

    useEffect(() => {
        fetchData();
        fetchPasswordPolicy().then(setPasswordPolicy);
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
            setError(t('hr-team-load-error'));
        } finally {
            setLoading(false);
        }
    };

    const generateTempPassword = () => {
        const pwd = generateCompliantPassword(passwordPolicy);
        setInviteData({ ...inviteData, temporary_password: pwd });
        setPasswordError('');
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        const pwdErr = validatePassword(inviteData.temporary_password, passwordPolicy);
        if (pwdErr) { setPasswordError(pwdErr); return; }
        setPasswordError('');
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
            setError(err.message || t('hr-team-invite-error'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleMemberDelete = async (memberId, memberName) => {
        if (!window.confirm(t('hr-team-confirm-delete', { name: memberName }))) {
            return;
        }

        try {
            await apiFetch(`/profiles/${memberId}`, {
                method: 'DELETE'
            });
            fetchData();
        } catch (err) {
            console.error('Error deleting member:', err);
            setError(t('hr-team-delete-error'));
        }
    };

    const getRoleBadge = (role) => {
        const roles = {
            admin:            { label: t('hr-team-role-admin'),      class: 'badge-admin' },
            recruiter:        { label: t('hr-team-role-recruiter'),   class: 'badge-recruiter' },
            chef_departement: { label: t('hr-team-role-chef'),        class: 'badge-chef' },
            superadmin:       { label: t('hr-team-role-superadmin'),  class: 'badge-super' }
        };
        const r = roles[role] || { label: role, class: 'badge-default' };
        return <span className={`team-role-badge ${r.class}`}>{r.label}</span>;
    };

    if (loading) {
        return (
            <div className={`team-management-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="team-main">
                    <div className="team-loading">{t('hr-team-loading')}</div>
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
                    <h1 className="mobile-header-title">{t('hr-team-mobile-title')}</h1>
                </div>

                <div className="team-container">
            <div className="team-header">
                <div>
                    <h1>{t('hr-team-title')}</h1>
                    <p className="subtitle">{t('hr-team-subtitle')}</p>
                </div>
                <button className="btn-invite" onClick={() => setShowInviteModal(true)}>
                    <span className="material-symbols-outlined">person_add</span>
                    {t('hr-team-btn-invite')}
                </button>
            </div>

            {error && <div className="team-error-banner">{error}</div>}

            <div className="team-list-card">
                <table className="team-table">
                    <thead>
                        <tr>
                            <th>{t('hr-team-col-member')}</th>
                            <th>{t('hr-team-col-role')}</th>
                            <th>{t('hr-team-col-department')}</th>
                            <th>{t('hr-team-col-status')}</th>
                            <th className="text-center">{t('hr-team-col-actions')}</th>
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
                                        departments.find(d => d._id === member.department_id)?.name || t('hr-team-dept-unknown')
                                        : '-'
                                    }
                                </td>
                                <td>
                                    <span className={`status-pill ${member.status}`}>
                                        {member.status === 'invited' ? t('hr-team-status-invited') : t('hr-team-status-active')}
                                    </span>
                                </td>
                                <td className="text-center">
                                    <div className="member-actions">
                                        <button
                                            className="btn-icon-delete"
                                            title={t('hr-team-btn-delete-title')}
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
                            <h2>{t('hr-team-modal-title')}</h2>
                            <button className="btn-close" onClick={() => setShowInviteModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleInvite}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t('hr-team-label-firstname')}</label>
                                    <input
                                        type="text"
                                        required
                                        value={inviteData.first_name}
                                        onChange={e => setInviteData({...inviteData, first_name: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('hr-team-label-lastname')}</label>
                                    <input
                                        type="text"
                                        required
                                        value={inviteData.last_name}
                                        onChange={e => setInviteData({...inviteData, last_name: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>{t('hr-team-label-email')}</label>
                                <input
                                    type="email"
                                    required
                                    value={inviteData.email}
                                    onChange={e => setInviteData({...inviteData, email: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('hr-team-label-role')}</label>
                                <select
                                    value={inviteData.role}
                                    onChange={e => setInviteData({...inviteData, role: e.target.value})}
                                >
                                    <option value="recruiter">{t('hr-team-role-recruiter')}</option>
                                    <option value="chef_departement">{t('hr-team-role-chef')}</option>
                                </select>
                            </div>

                            {inviteData.role === 'chef_departement' && (
                                <div className="form-group">
                                    <label>{t('hr-team-label-department')}</label>
                                    <select
                                        required
                                        value={inviteData.department_id}
                                        onChange={e => setInviteData({...inviteData, department_id: e.target.value})}
                                    >
                                        <option value="">{t('hr-team-dept-placeholder')}</option>
                                        {departments.map(d => (
                                            <option key={d._id} value={d._id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group">
                                <label>{t('hr-team-label-temp-pwd')}</label>
                                <div className="pwd-input-group">
                                    <input
                                        type="text"
                                        placeholder={`Min. ${passwordPolicy?.minPasswordLength ?? 16} caractères`}
                                        value={inviteData.temporary_password}
                                        onChange={e => {
                                            setInviteData({...inviteData, temporary_password: e.target.value});
                                            setPasswordError('');
                                        }}
                                        style={passwordError ? { borderColor: '#ef4444' } : {}}
                                    />
                                    <button type="button" className="btn-generate" onClick={generateTempPassword}>
                                        {t('hr-team-btn-generate')}
                                    </button>
                                </div>
                                {passwordError
                                    ? <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '4px' }}>{passwordError}</p>
                                    : <p className="field-hint">{t('hr-team-pwd-hint')}</p>
                                }
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowInviteModal(false)}>{t('hr-team-btn-cancel')}</button>
                                <button type="submit" className="btn-primary" disabled={submitting}>
                                    {submitting ? t('hr-team-btn-sending') : t('hr-team-btn-send-invite')}
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
