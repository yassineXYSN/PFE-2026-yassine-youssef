import React from 'react';
import { CheckCircle2, AlertTriangle, Brain, Target, Eye, Activity } from 'lucide-react';
import './LiveInterview.css';

// ── Fake data ────────────────────────────────────────────────────────────────

const FACE_EMOTIONS = [
  { emo: 'happy',    emoji: '😊', label: 'Joie',      pct: 42 },
  { emo: 'neutral',  emoji: '😐', label: 'Neutre',    pct: 28 },
  { emo: 'surprise', emoji: '😲', label: 'Surprise',  pct: 12 },
  { emo: 'sad',      emoji: '😢', label: 'Tristesse', pct: 11 },
  { emo: 'angry',    emoji: '😡', label: 'Colère',    pct:  7 },
];

const VOICE_EMOTIONS = [
  { emo: 'joy',     emoji: '😊', label: 'joy',  pct: 39 },
  { emo: 'neutral', emoji: '😐', label: 'neu',  pct: 33 },
  { emo: 'sadness', emoji: '😢', label: 'sad',  pct: 17 },
  { emo: 'angry',   emoji: '😡', label: 'ang',  pct: 11 },
];

const AI_SUMMARY = {
  overall_score: 45,
  summary:
    "Yassine a mené un entretien de 34 minutes globalement correct mais insuffisant pour le niveau sénior visé. Il a présenté son parcours avec clarté — 3 ans d'expérience fullstack, stack React/Node.js, deux projets e-commerce en production — et a su répondre aux questions de base sur les hooks React et le cycle de vie des composants. Cependant, dès que les questions ont monté en complexité (optimisation de requêtes N+1, gestion de la concurrence, stratégie de cache distribué), les réponses sont devenues vagues et hésitantes. Sur le plan comportemental, l'affect neutre dominant (80 % des détections) combiné à un score d'engagement de 44/100 trahissent une nervosité contenue qui a probablement bridé sa capacité à se mettre en valeur. La distribution vocale, marquée par 33 % de tristesse, confirme des moments d'inconfort lors des questions techniques difficiles. Le score global de 45/100 reflète un profil junior-to-mid solide, pas encore prêt pour un poste sénior sans accompagnement.",
  strengths: [
    "Bonne maîtrise des fondamentaux React — hooks, useEffect, gestion d'état avec useState et useContext expliqués correctement avec des exemples de code concrets",
    "A décrit deux projets e-commerce déployés en production (Vercel + Railway), avec gestion des paiements Stripe et authentification JWT — preuve d'une expérience réelle end-to-end",
    "Communication structurée sur les questions ouvertes : introduction fluide, réponses organisées en contexte → action → résultat sur les questions comportementales"
  ],
  weaknesses: [
    "Difficultés marquées sur les questions d'architecture avancée — incapable d'expliquer le problème N+1 en GraphQL ou de proposer une stratégie de cache Redis sans guidage",
    "Aucune expérience de travail en équipe sur une base de code large (> 5 développeurs) — tous ses projets ont été menés seul ou en binôme, ce qui limite la vision systémique",
    "Réponses évasives sur les tests : a mentionné Jest mais n'a pas su décrire une stratégie de test cohérente (unitaire vs intégration vs e2e), ni son rapport à la couverture de code"
  ],
};

const engagementColor = (s) => s >= 70 ? '#22c55e' : s >= 45 ? '#f59e0b' : '#ef4444';

// ── Component ─────────────────────────────────────────────────────────────────

const InterviewResultPreview = () => {
  const totalDetections = 16;
  const avgAttention = 80;
  const lookPct = 24;
  const engagement = 44;

  return (
    <div
      className="hr-interview-page"
      data-theme="dark"
      style={{
        /* force dark palette regardless of global theme */
        '--hi-bg':           '#09090b',
        '--hi-surface':      '#18181b',
        '--hi-surface-alt':  '#1c1c1f',
        '--hi-text':         '#fafafa',
        '--hi-muted':        '#a1a1aa',
        '--hi-border':       '#27272a',
        '--hi-primary':      '#eab308',
        '--hi-primary-fg':   '#000000',
        '--hi-primary-soft': 'rgba(234,179,8,0.10)',
        '--hi-primary-glow': 'rgba(234,179,8,0.28)',
        '--hi-shadow':       '0 4px 16px rgba(0,0,0,0.4)',
        '--hi-shadow-lg':    '0 20px 40px rgba(0,0,0,0.55)',
        '--hi-red':          '#ef4444',
        '--hi-green':        '#22c55e',
        '--hi-blue':         '#3b82f6',
      }}
    >
      <div className="post-interview">
        <div className="post-card">

          {/* ── Header ── */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{
              width: '70px', height: '70px', borderRadius: '50%',
              background: 'var(--hi-primary-soft)',
              border: '2px solid var(--hi-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <CheckCircle2 size={34} color="var(--hi-primary)" />
            </div>
            <h2 style={{ fontSize: '30px', fontWeight: '900', color: 'var(--hi-text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
              Entretien Terminé
            </h2>
            <p style={{ color: 'var(--hi-muted)', fontSize: '14px', marginBottom: '4px' }}>
              Les données ont été sécurisées.
            </p>
            <p style={{ color: 'var(--hi-muted)', fontSize: '12px' }}>
              Yassine Store · Développeur Fullstack · 7 juin 2026
            </p>
          </div>

          {/* ── Behavioral data ── */}
          <div style={{
            background: 'var(--hi-primary-soft)',
            border: '1px solid rgba(234,179,8,0.2)',
            borderRadius: '18px', padding: '24px',
            marginBottom: '24px',
          }}>
            <h4 style={{
              color: 'var(--hi-primary)', fontSize: '11px', fontWeight: '700',
              marginBottom: '18px', display: 'flex', alignItems: 'center',
              gap: '7px', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <Brain size={14} /> Données comportementales — {totalDetections} détections
            </h4>

            {/* KPI grid */}
            <div className="post-kpi-grid">
              {[
                { icon: <Target size={14} />, label: 'Attention moy.',  value: `${avgAttention}%`, color: '#3b82f6' },
                { icon: <Eye    size={14} />, label: 'Regard actif',    value: `${lookPct}%`,      color: '#22c55e' },
                { icon: <Activity size={14} />, label: 'Engagement',    value: `${engagement}/100`, color: engagementColor(engagement) },
              ].map(({ icon, label, value, color }) => (
                <div key={label} className="post-kpi-card">
                  <div style={{ color, marginBottom: '7px', display: 'flex', justifyContent: 'center' }}>{icon}</div>
                  <div className="post-kpi-value" style={{ color }}>{value}</div>
                  <div className="post-kpi-label">{label}</div>
                </div>
              ))}
            </div>

            {/* Face emotion distribution */}
            <div style={{
              fontSize: '10px', color: 'var(--hi-muted)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: '10px',
            }}>
              Distribution émotions visage ({totalDetections} mesures)
            </div>
            {FACE_EMOTIONS.map(({ emo, emoji, label, pct }) => (
              <div key={emo} className="post-emo-row">
                <span style={{ fontSize: '14px', width: '16px', textAlign: 'center' }}>{emoji}</span>
                <span style={{ fontSize: '11px', color: 'var(--hi-muted)', width: '68px' }}>{label}</span>
                <div className="post-emo-bar-track">
                  <div className="post-emo-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--hi-muted)', width: '28px', textAlign: 'right' }}>{pct}%</span>
              </div>
            ))}

            {/* Voice emotion distribution */}
            <div style={{
              fontSize: '10px', color: 'var(--hi-muted)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: '10px', marginTop: '14px',
            }}>
              Distribution émotions voix WAV2VEC2
            </div>
            {VOICE_EMOTIONS.map(({ emo, emoji, label, pct }) => (
              <div key={emo} className="post-emo-row">
                <span style={{ fontSize: '14px', width: '16px', textAlign: 'center' }}>{emoji}</span>
                <span style={{ fontSize: '11px', color: 'var(--hi-muted)', width: '68px' }}>{label}</span>
                <div className="post-emo-bar-track">
                  <div style={{ height: '100%', borderRadius: '3px', background: '#60a5fa', transition: 'width 0.6s ease', width: `${pct}%` }} />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--hi-muted)', width: '28px', textAlign: 'right' }}>{pct}%</span>
              </div>
            ))}
          </div>

          {/* ── AI Summary ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '18px',
            marginBottom: '24px',
            background: 'var(--hi-primary-soft)',
            padding: '22px', borderRadius: '14px',
            borderLeft: '3px solid var(--hi-primary)',
          }}>
            <div style={{
              width: '68px', height: '68px', borderRadius: '50%',
              background: 'var(--hi-surface-alt)',
              border: '2px solid rgba(234,179,8,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: 'var(--hi-primary)', fontSize: '24px', fontWeight: '800' }}>
                {AI_SUMMARY.overall_score}
              </span>
            </div>
            <div>
              <h3 style={{ color: 'var(--hi-text)', fontSize: '17px', fontWeight: '700', marginBottom: '7px' }}>
                Bilan Synthétique
              </h3>
              <p style={{ color: 'var(--hi-muted)', fontSize: '13px', lineHeight: '1.65', margin: 0 }}>
                {AI_SUMMARY.summary}
              </p>
            </div>
          </div>

          {/* ── Strengths / Weaknesses ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
            {[
              { title: 'Points Forts',         icon: <CheckCircle2  size={16} />, items: AI_SUMMARY.strengths,  color: 'var(--hi-primary)' },
              { title: "Axes d'Amélioration",  icon: <AlertTriangle size={16} />, items: AI_SUMMARY.weaknesses, color: 'var(--hi-muted)'   },
            ].map(({ title, icon, items, color }) => (
              <div key={title} style={{
                background: 'var(--hi-surface-alt)',
                border: '1px solid var(--hi-border)',
                borderRadius: '14px', padding: '20px',
              }}>
                <h4 style={{ color, fontSize: '13px', fontWeight: '600', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {icon} {title}
                </h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items.map((s, i) => (
                    <li key={i} style={{ color: 'var(--hi-muted)', fontSize: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start', lineHeight: '1.6' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: color, marginTop: '7px', flexShrink: 0 }} />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* ── Back button ── */}
          <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'center' }}>
            <button
              className="back-btn"
              onClick={() => window.location.href = '/hr/candidats'}
            >
              Retour à mes candidats
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default InterviewResultPreview;
