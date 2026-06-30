import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import HRSidebar from "../../components/HRSidebar";
import { useTheme } from '../../context/ThemeContext';
import { apiFetch } from '../../../../core/api';
import { getStoredUserId } from '../../../../core/apiClient';
import { useLanguage } from '../../../../core/useLanguage';
import './DepartmentCreate.css';

const DepartmentCreate = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: 'black',
        icon: 'group'
    });

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Responsible (manager) search
    const [employees, setEmployees] = useState([]);
    const [responsibleSearch, setResponsibleSearch] = useState('');
    const [selectedResponsible, setSelectedResponsible] = useState(null);
    const [showResponsibleDropdown, setShowResponsibleDropdown] = useState(false);
    const responsibleRef = useRef(null);

    // Members
    const [members, setMembers] = useState([]);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [memberError, setMemberError] = useState('');
    const [addingMember, setAddingMember] = useState(false);

    const colors = [
        { name: 'black', class: 'black' },
        { name: 'blue', class: 'blue' },
        { name: 'purple', class: 'purple' },
        { name: 'emerald', class: 'emerald' },
        { name: 'orange', class: 'orange' },
        { name: 'rose', class: 'rose' }
    ];

    const icons = ['apartment', 'group', 'campaign', 'code', 'payments', 'support_agent'];

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userId = getStoredUserId();
                if (userId) {
                    const userProfile = await apiFetch(`/profiles/${userId}`);
                    setProfile(userProfile);
                }
            } catch (err) {
                console.error("Error fetching user data:", err);
            }
        };
        fetchUserData();
    }, []);

    // Load company employees once company_id is known
    useEffect(() => {
        if (!profile?.company_id) return;
        const fetchEmployees = async () => {
            try {
                const data = await apiFetch(`/profiles/?company_id=${profile.company_id}`);
                setEmployees(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Error fetching employees:", err);
            }
        };
        fetchEmployees();
    }, [profile?.company_id]);

    // Close responsible dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (responsibleRef.current && !responsibleRef.current.contains(e.target)) {
                setShowResponsibleDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredEmployees = responsibleSearch.trim()
        ? employees.filter(emp => {
            const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
            const email = (emp.email || '').toLowerCase();
            const query = responsibleSearch.toLowerCase();
            return (fullName.trim() && fullName.includes(query)) || email.includes(query);
        })
        : [];

    const handleResponsibleInputChange = (e) => {
        setResponsibleSearch(e.target.value);
        setSelectedResponsible(null);
        setShowResponsibleDropdown(true);
    };

    const handleSelectResponsible = (emp) => {
        setSelectedResponsible(emp);
        setResponsibleSearch(`${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email);
        setShowResponsibleDropdown(false);
    };

    const handleAddMember = async () => {
        const email = newMemberEmail.trim();
        if (!email) return;

        if (members.some(m => m.email === email)) {
            setMemberError(t('hr-dept-member-already-added'));
            return;
        }

        setAddingMember(true);
        setMemberError('');
        try {
            const found = await apiFetch(`/profiles/by-email/${encodeURIComponent(email)}`);
            setMembers(prev => [...prev, {
                id: found.id,
                name: `${found.first_name || ''} ${found.last_name || ''}`.trim() || email,
                email: found.email || email,
                avatar: found.avatar_url || null
            }]);
            setNewMemberEmail('');
        } catch {
            setMemberError(t('hr-dept-member-not-found'));
        } finally {
            setAddingMember(false);
        }
    };

    const handleRemoveMember = (id) => {
        setMembers(members.filter(m => m.id !== id));
    };

    const handleSubmit = async () => {
        if (!formData.name) {
            setError(t('hr-dept-error-name-required'));
            return;
        }

        if (!profile?.company_id) {
            setError(t('hr-dept-error-no-company'));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const created = await apiFetch('/departments/', {
                method: 'POST',
                body: JSON.stringify({
                    name: formData.name,
                    company_id: profile.company_id,
                    description: formData.description,
                    manager_id: selectedResponsible?.id || null,
                    color: formData.color,
                    icon: formData.icon
                })
            });

            // Assign department_id to each invited member
            if (members.length > 0 && created?.id) {
                await Promise.all(
                    members.map(member =>
                        apiFetch(`/profiles/${member.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ department_id: created.id })
                        }).catch(err => console.error(`Failed to assign dept to ${member.email}:`, err))
                    )
                );
            }

            navigate('/hr/departement');
        } catch (err) {
            console.error("Error creating department:", err);
            setError(t('hr-dept-error-create', { message: err.message }));
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
                            <h1 className="page-title">{t('hr-dept-create-title')}</h1>
                            <p className="page-subtitle">{t('hr-dept-create-subtitle')}</p>
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
                            <h2 className="section-title">{t('hr-dept-section-general')}</h2>
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label className="form-label">{t('hr-dept-label-name')}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder={t('hr-dept-placeholder-name')}
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        disabled={loading}
                                    />
                                </div>
                                <div className="form-group flex-1" ref={responsibleRef}>
                                    <label className="form-label">{t('hr-dept-label-responsible')}</label>
                                    <div className="input-with-icon" style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder={t('hr-dept-placeholder-responsible')}
                                            value={responsibleSearch}
                                            onChange={handleResponsibleInputChange}
                                            onFocus={() => responsibleSearch.trim() && setShowResponsibleDropdown(true)}
                                            disabled={loading}
                                        />
                                        <span className="material-symbols-outlined search-icon">
                                            {selectedResponsible ? 'check_circle' : 'search'}
                                        </span>
                                        {showResponsibleDropdown && filteredEmployees.length > 0 && (
                                            <div className="responsible-dropdown">
                                                {filteredEmployees.map(emp => (
                                                    <div
                                                        key={emp.id}
                                                        className="dropdown-item"
                                                        onMouseDown={() => handleSelectResponsible(emp)}
                                                    >
                                                        <div className="dropdown-item-avatar">
                                                            {emp.avatar_url
                                                                ? <img src={emp.avatar_url} alt="" />
                                                                : <span>{(emp.first_name?.[0] || emp.email?.[0] || '?').toUpperCase()}</span>
                                                            }
                                                        </div>
                                                        <div className="dropdown-item-info">
                                                            <p className="dropdown-item-name">
                                                                {`${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email}
                                                            </p>
                                                            <p className="dropdown-item-email">{emp.email}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {showResponsibleDropdown && responsibleSearch.trim() && filteredEmployees.length === 0 && (
                                            <div className="responsible-dropdown">
                                                <div className="dropdown-empty">{t('hr-dept-no-employee-found')}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('hr-dept-label-description')}</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder={t('hr-dept-placeholder-description')}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    disabled={loading}
                                ></textarea>
                            </div>
                        </section>

                        <div className="section-divider"></div>

                        {/* Section 2: Apparence */}
                        <section className="form-section appearance-section">
                            <h2 className="section-title">{t('hr-dept-section-appearance')}</h2>
                            <div className="appearance-grid">
                                <div className="appearance-group">
                                    <p className="group-label">{t('hr-dept-label-color')}</p>
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
                                    <p className="group-label">{t('hr-dept-label-icon')}</p>
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

                        {/* Section 3: Inviter des membres */}
                        <section className="form-section members-section">
                            <h2 className="section-title">{t('hr-dept-section-members')}</h2>
                            <div className="member-add-row">
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder={t('hr-dept-placeholder-member-email')}
                                    value={newMemberEmail}
                                    onChange={(e) => { setNewMemberEmail(e.target.value); setMemberError(''); }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                                    disabled={loading || addingMember}
                                />
                                <button className="btn-add" onClick={handleAddMember} disabled={loading || addingMember}>
                                    {addingMember ? t('hr-dept-btn-adding') : t('hr-dept-btn-add')}
                                </button>
                            </div>

                            {memberError && (
                                <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '-1rem', marginBottom: '0.5rem' }}>
                                    {memberError}
                                </p>
                            )}

                            <div className="members-list">
                                {members.map(member => (
                                    <div key={member.id} className="member-item group">
                                        <div className="member-info">
                                            {member.avatar
                                                ? <img src={member.avatar} alt={member.name} className="member-avatar" />
                                                : (
                                                    <div className="member-avatar member-avatar-initial">
                                                        {(member.name?.[0] || member.email?.[0] || '?').toUpperCase()}
                                                    </div>
                                                )
                                            }
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
                            <button className="btn-cancel" onClick={() => navigate('/hr/departement')} disabled={loading}>{t('hr-dept-btn-cancel')}</button>
                            <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
                                {loading ? t('hr-dept-btn-creating') : t('hr-dept-btn-create')}
                            </button>
                        </footer>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DepartmentCreate;
