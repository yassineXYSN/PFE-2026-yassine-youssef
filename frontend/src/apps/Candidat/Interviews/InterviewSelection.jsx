import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../core/api';
import './InterviewSelection.css';

const InterviewSelection = () => {
    const { applicationId } = useParams();
    const navigate = useNavigate();
    const [proposal, setProposal] = useState(null);
    const [busySlots, setBusySlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const fetchProposal = async () => {
            try {
                const data = await apiFetch(`/interviews/proposals/application/${applicationId}`);
                console.debug("[InterviewSelection] Proposal fetched:", data);
                console.debug("[InterviewSelection] Slots:", data?.slots);
                console.debug("[InterviewSelection] Slots count:", data?.slots?.length || 0);
                setProposal(data);
                
                // Fetch recruiter's busy slots to filter out slots taken since proposal was sent
                if (!data.already_confirmed && data.recruiter_id) {
                    try {
                        const busyData = await apiFetch(`/interviews/busy-slots/${data.recruiter_id}`);
                        console.debug("[InterviewSelection] Busy slots fetched:", busyData);
                        setBusySlots(busyData || []);
                    } catch (e) {
                        console.error("Could not fetch busy slots", e);
                    }
                }

                // If the slot was already confirmed, surface the confirmed slot immediately
                if (data.already_confirmed && data.selected_slot) {
                    setSelectedSlot(data.selected_slot);
                    setSuccess(true);
                }
            } catch (err) {
                console.error("Error fetching proposal:", err);
                setError("Impossible de charger la proposition d'entretien. Elle a peut-être déjà été traitée.");
            } finally {
                setLoading(false);
            }
        };
        fetchProposal();
    }, [applicationId]);

    const groupedSlots = useMemo(() => {
        if (!proposal?.slots) {
            console.debug("[InterviewSelection] No slots in proposal");
            return {};
        }
        console.debug("[InterviewSelection] Grouping slots:", proposal.slots);
        const grouped = proposal.slots.reduce((acc, slot) => {
            const date = new Date(slot);
            const dayKey = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            if (!acc[dayKey]) acc[dayKey] = [];
            acc[dayKey].push(slot);
            return acc;
        }, {});
        console.debug("[InterviewSelection] Grouped result:", grouped);
        return grouped;
    }, [proposal]);

    const handleConfirm = async () => {
        if (!selectedSlot) return;
        setSubmitting(true);
        try {
            await apiFetch('/interviews/proposals/confirm', {
                method: 'POST',
                body: JSON.stringify({
                    proposal_id: proposal._id,
                    selected_slot: selectedSlot
                })
            });
            setSuccess(true);
        } catch (err) {
            console.error("Error confirming slot:", err);
            alert("Une erreur est survenue lors de la confirmation. Veuillez réessayer.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="is-page">
            <div className="is-spinner"></div>
            <p className="is-loading-text">Préparation de votre invitation...</p>
        </div>
    );

    if (error) return (
        <div className="is-page">
            <div className="is-success-card is-error-card">
                <span className="material-symbols-outlined is-error-icon">error</span>
                <h2>Oups !</h2>
                <p>{error}</p>
                <button className="is-btn-submit" onClick={() => navigate('/candidat/dashboard')}>Retour au tableau de bord</button>
            </div>
        </div>
    );

    if (success) {
        const isLocked = proposal?.already_confirmed;
        return (
            <div className="is-page">
                <div className="is-success-card">
                    <div className="is-success-icon">
                        <span className="material-symbols-outlined">check</span>
                    </div>
                    <h2 className="is-success-title">
                        {isLocked ? 'Créneau déjà confirmé' : 'Félicitations !'}
                    </h2>
                    <p className="is-success-msg">
                        {isLocked
                            ? 'Vous avez déjà sélectionné un créneau pour cet entretien. Il ne vous est plus possible de modifier votre choix.'
                            : 'Votre entretien est officiellement planifié. Un e-mail de confirmation vous a été envoyé et des rappels vous seront envoyés 24h et 1h avant le rendez-vous.'}
                    </p>
                    
                    <div className="is-summary-box">
                        <p className="is-summary-label">Créneau sélectionné</p>
                        <p className="is-summary-day">
                            {new Date(selectedSlot).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <p className="is-summary-time">
                            {new Date(selectedSlot).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>

                    <button className="is-btn-submit" onClick={() => navigate('/candidat/dashboard')}>Retour au tableau de bord</button>
                </div>
            </div>
        );
    }

    if (!proposal) return null;

    return (
        <div className="is-page">
            <div className="is-card-hub">
                <header className="is-header">
                    <div className="is-logo">HumatiQ Recruitment</div>
                    <div className="is-header-content">
                        <h1>Invitation à un entretien</h1>
                        <p>Votre candidature a retenu toute notre attention. Choisissez dès maintenant le créneau qui vous convient le mieux.</p>
                    </div>
                </header>

                <main className="is-body">
                    <div className="is-invitation-grid">
                        <section className="is-left-panel">
                            <h2>Détails de l'invitation</h2>
                            <div className="is-recruiter-preview">
                                <span className="material-symbols-outlined is-quote-icon">format_quote</span>
                                <p className="is-quote-text">
                                    {proposal.message || "Nous sommes impatients de discuter de votre profil et de vos aspirations au sein de notre équipe."}
                                </p>
                                <div className="is-recruiter-footer">
                                    <span className="material-symbols-outlined is-verify-icon">verified_user</span>
                                    <span>L'équipe HumatiQ</span>
                                </div>
                            </div>

                            <div className="is-details-col">
                                <div className="is-detail">
                                    <span className="material-symbols-outlined">timer</span>
                                    <span>Durée estimée : {proposal.duration_minutes} minutes</span>
                                </div>
                                <div className="is-detail">
                                    <span className="material-symbols-outlined">video_call</span>
                                    <span>Format : {proposal.interview_type}</span>
                                </div>
                            </div>
                        </section>

                        <section className="is-right-panel">
                            <h2>Sélectionnez un créneau</h2>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
                                {Object.entries(groupedSlots).map(([day, slots]) => (
                                    <div key={day} className="is-day-group">
                                        <div className="is-day-header">
                                            <span className="material-symbols-outlined">calendar_today</span>
                                            {day}
                                        </div>
                                        <div className="is-slots-list">
                                            {slots.map((slot, i) => {
                                                const slotStart = new Date(slot);
                                                const duration = proposal.duration_minutes || 45;
                                                const slotEnd = new Date(slotStart.getTime() + duration * 60000);
                                                
                                                const isPast = slotStart <= new Date();

                                                const isBusy = busySlots.some(busy => {
                                                    if (busy.proposal_id === proposal._id) return false;
                                                    const bStart = new Date(busy.start);
                                                    const bEnd = new Date(busy.end);
                                                    return (slotStart < bEnd && slotEnd > bStart);
                                                });

                                                const isUnavailable = isBusy || isPast;

                                                return (
                                                    <button
                                                        key={i}
                                                        className={`is-slot-button ${selectedSlot === slot ? 'active' : ''} ${isUnavailable ? 'unavailable' : ''}`}
                                                        style={isUnavailable ? { opacity: 0.5, cursor: 'not-allowed', backgroundColor: 'var(--tf-surface-low)', borderColor: 'var(--tf-outline-variant)' } : {}}
                                                        onClick={() => !isUnavailable && setSelectedSlot(slot)}
                                                        disabled={isUnavailable}
                                                        title={isBusy ? "Créneau déjà réservé par un autre candidat" : isPast ? "Créneau passé" : ""}
                                                    >
                                                        {new Date(slot).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                        {isBusy && <span style={{display: 'block', fontSize: '10px', marginTop: '4px', fontWeight: 600, color: 'var(--tf-error)'}}>INDISPONIBLE</span>}
                                                        {isPast && !isBusy && <span style={{display: 'block', fontSize: '10px', marginTop: '4px', fontWeight: 600, color: 'var(--tf-on-surface-variant)'}}>PASSÉ</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <footer className="is-confirm-footer">
                        <button 
                            className="is-btn-submit"
                            disabled={!selectedSlot || submitting}
                            onClick={handleConfirm}
                        >
                            {submitting ? "Finalisation..." : "Confirmer mon rendez-vous"}
                        </button>
                        <p className="is-footer-note">
                            Une confirmation sera envoyée à {proposal.candidate_email}
                        </p>
                    </footer>
                </main>
            </div>
        </div>
    );
};

export default InterviewSelection;
