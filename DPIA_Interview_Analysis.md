# Data Protection Impact Assessment (DPIA)
## AI-Assisted Video Interview Analysis — HumatiQ AI

> **Status:** Draft for review · **Version:** 1.0 · **Date:** 2026-06-01
> **Author:** Engineering team · **Owner / approver:** Data Protection Officer (DPO)
>
> This DPIA is **required** under RGPD Article 35 because the processing involves
> (a) systematic evaluation of individuals based on automated processing/profiling,
> (b) large-scale processing of behavioural/emotion data, and (c) innovative use of
> AI technology (facial emotion recognition) in a recruitment context. It must be
> reviewed and signed off by the DPO before the feature runs in production, and
> revisited whenever the processing changes.

---

## 1. Description of the processing

### 1.1 What the system does
During a video interview conducted on the HumatiQ AI platform, and **only while the
candidate's camera/microphone are enabled**, AI models run in real time and produce:

| Output | Source | Storage |
|---|---|---|
| Dominant **facial emotion** | Webcam video frames | Stored (derived label only) |
| **Voice emotion** indicator | Microphone audio | Stored (derived label only) |
| **Attention / gaze** (head yaw/pitch, "looking at screen") | Webcam video frames | Stored (derived metrics) |
| **Transcript** (speech-to-text) | Microphone audio | Stored |
| **AI report** (summary, strengths, weaknesses, 0–100 score) | Transcript + emotions | Stored |

The derived emotion/attention indicators are **streamed live to the recruiter** during
the interview and logged every ~5s for the end-of-call report.

### 1.2 What is NOT stored
The **raw audio/video stream is not recorded or persisted** (WebRTC peer-to-peer; no
media recorder). Only the derived data, transcript and report are retained.

### 1.3 Technical references (code)
- `frontend/src/apps/Candidat/Interviews/InterviewRoom.jsx` — capture, live streaming, end-of-call log
- `frontend/src/hooks/useInterviewAnalysis.js`, `useAudioAnalyzer.js`, `useVoiceTranscription.js`
- `backend/utils/interview_analyzer.py` — report generation (transcript + emotions → LLM)
- `backend/utils/interview_detection_ai/face_analyzer.py` — facial analysis
- `backend/models/interview.py` — stored fields: `emotion_history`, `transcript`, `ai_analysis`

### 1.4 Parties and data flows
- **Data controller:** HumatiQ AI.
- **Data subjects:** job candidates (potentially including minors/young graduates).
- **Recipients:** recruiters/companies the candidate applies to.
- **Processors / third parties:** hosting provider; LLM inference provider
  (HuggingFace Router API — `backend/utils/interview_analyzer.py` — receives the
  **transcript** for analysis), which may be **outside the EEA**.

---

## 2. Necessity and proportionality

| Question | Assessment |
|---|---|
| **Lawful basis** | Explicit consent (RGPD Art. 6(1)(a); Art. 9(2)(a) if treated as special-category). **Risk:** consent in recruitment may not be "freely given" (Art. 7, power imbalance). |
| **Purpose limitation** | Purpose = assist recruiter evaluation. Emotion/attention data must not be reused for other purposes. |
| **Data minimisation** | Raw A/V is correctly not stored. **Question whether emotion/attention analysis is necessary at all**, vs. transcript-only. |
| **Accuracy** | Emotion recognition and attention inference are **scientifically contested** and culturally/neurodivergence biased — high risk of inaccurate inferences. |
| **Storage limitation** | Retention not yet technically enforced (no TTL/cleanup job). |
| **Transparency** | Addressed via Terms §6 + pre-interview consent notice; previously the capture was "silent". |

---

## 3. Risks to the rights and freedoms of data subjects

| # | Risk | Likelihood | Severity | Inherent rating |
|---|---|---|---|---|
| R1 | **Unfair/biased evaluation** from inaccurate emotion/attention inference (bias against neurodivergent people, disabilities, cultures, ethnicities) | High | High | **Critical** |
| R2 | **Invalid consent** (power imbalance) → entire processing unlawful | Medium | High | High |
| R3 | **Excessive intrusion** (emotion recognition perceived as surveillance) | High | Medium | High |
| R4 | **Function creep** — emotion data reused beyond hiring | Medium | High | High |
| R5 | **Cross-border transfer** of transcript to non-EEA AI provider without safeguards | Medium | High | High |
| R6 | **Inability to honour data-subject rights** (erasure/access) if not implemented | Low* | High | Medium |
| R7 | **Automated decision-making** affecting candidates without meaningful human review | Medium | High | High |
| R8 | **Security breach** exposing sensitive behavioural profiles | Low | High | Medium |

\*Lowered after implementing export/erasure endpoints (see §4).

---

## 4. Measures to address the risks

### Implemented
- ✅ **Transparency at point of capture** — pre-interview consent modal disclosing exactly what is analysed (`InterviewRoom.jsx`), plus Terms & Privacy Policy §6.
- ✅ **Granular, separable consent** — interview AI/emotion analysis consent is a **separate, optional** checkbox at signup, not a precondition of registration (`LoginPage.jsx`).
- ✅ **Runtime control** — candidate can disable camera/microphone at any time, stopping the analysis.
- ✅ **Right of access & portability (Art. 15/20)** — `GET /api/candidat/export-data`.
- ✅ **Right to erasure (Art. 17)** — `DELETE /api/candidat/account` (data + auth account).
- ✅ **Data minimisation of raw media** — no raw A/V recording/storage.
- ✅ **Auditable consent records** — `terms_accepted_at`, `ai_analysis_consent_at`, `interview_ai_notice_dismissed_at`.

### Required before production (open actions)
- ⛔ **R1 / EU AI Act — emotion recognition in the workplace/recruitment is _prohibited_
  (Art. 5) and otherwise high-risk.** **Action:** obtain DPO + legal sign-off on whether
  the emotion/attention feature may run at all in target jurisdictions. Default
  recommendation: **disable emotion & attention analysis**; keep transcript + human review.
- ☐ **R2** — re-examine lawful basis; provide a genuine, penalty-free alternative
  interview path for candidates who decline AI analysis, and enforce that the
  signup/interview consent actually gates the processing server-side.
- ☐ **R5** — sign a **DPA + SCCs** with the LLM provider, or move inference in-region /
  self-hosted (Ollama path already exists in `interview_analyzer.py`).
- ☐ **R4 / storage limitation** — implement automated **retention/TTL** and deletion of
  interview data after the recruitment process.
- ☐ **R7** — document and enforce **meaningful human review**; ensure no candidate is
  rejected solely on an automated score; log human override.
- ☐ **R1 bias** — bias testing/validation of the emotion & scoring models; document
  accuracy limitations; allow candidates to contest results (Art. 22(3)).
- ☐ **R8** — access controls and encryption-at-rest for `emotion_history` / `ai_analysis`.

---

## 5. Residual risk and conclusion

After the **implemented** measures, transparency, consent granularity and data-subject
rights are substantially improved. However, the **core residual risk (R1) remains
Critical**: facial **emotion recognition in a recruitment context is likely prohibited
under the EU AI Act** and rests on a contested scientific basis.

**Conclusion:** This processing **must not go to production** in its current form without
DPO/legal sign-off. The recommended path is to **disable emotion and attention
recognition** and retain only transcript-based, human-reviewed assistance — which removes
most of the high/critical risks while preserving the product value.

---

## 6. Consultation & sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| DPO | _TBD_ | ☐ Approve ☐ Approve with conditions ☐ Reject | |
| Engineering lead | _TBD_ | | |
| Legal | _TBD_ | | |

> If high residual risk cannot be reduced, **prior consultation with the supervisory
> authority (CNIL) is required** under RGPD Art. 36.

*This document is an engineering-prepared draft to support a compliance review. It is not
legal advice; a qualified DPO/legal review is required.*
