/*
 * HumatiQ AI — Terms of Use & Privacy Policy content (FR / EN).
 *
 * Drafted to comply with the EU/French RGPD (GDPR). It reflects the data the
 * platform actually processes:
 *   - identity & account data, authentication (email/password + Google,
 *     LinkedIn, GitHub OAuth, optional 2FA);
 *   - uploaded CVs and their AI parsing;
 *   - profile data (education, experience, skills, languages, etc.);
 *   - quiz / test results;
 *   - AI-assisted video interviews, which include REAL-TIME facial emotion
 *     recognition, voice emotion analysis and attention / gaze (head-pose)
 *     tracking, a speech-to-text transcript, and an automated AI report.
 *     The derived emotion / attention data is streamed to the recruiter live
 *     and stored (raw audio/video is NOT persisted; only the derived data,
 *     transcript and analysis are). Because emotion recognition and behavioural
 *     analysis are sensitive, they are disclosed prominently here and require
 *     explicit, informed consent with a right to object (RGPD Art. 9, 13, 22 /
 *     EU AI Act).
 */

export const termsContent = {
  fr: {
    back: 'Retour',
    title: "Conditions Générales d'Utilisation & Politique de Confidentialité",
    lastUpdated: 'Dernière mise à jour : 1 juin 2026',
    intro:
      "Bienvenue sur HumatiQ AI, une plateforme de recrutement assistée par intelligence artificielle. En créant un compte candidat, vous reconnaissez avoir lu, compris et accepté les présentes Conditions Générales d'Utilisation ainsi que la Politique de Confidentialité ci-dessous, conformément au Règlement Général sur la Protection des Données (RGPD - Règlement UE 2016/679). Veuillez prêter une attention particulière à la section 6, relative aux entretiens vidéo assistés par IA et à l'analyse comportementale.",
    sections: [
      {
        heading: '1. Objet et acceptation',
        paragraphs: [
          "Les présentes conditions régissent l'utilisation de la plateforme HumatiQ AI (« la Plateforme ») par les candidats. L'acceptation de ces conditions est obligatoire et constitue un préalable indispensable à la création d'un compte et à l'utilisation de nos services.",
          "Si vous n'acceptez pas ces conditions, vous ne devez pas créer de compte ni utiliser la Plateforme.",
        ],
      },
      {
        heading: '2. Responsable du traitement',
        paragraphs: [
          "HumatiQ AI agit en qualité de responsable du traitement des données personnelles collectées via la Plateforme. Pour toute question relative à la protection de vos données, vous pouvez contacter notre Délégué à la Protection des Données (DPO) à l'adresse : privacy@humatiq.ai.",
        ],
      },
      {
        heading: '3. Données personnelles collectées',
        paragraphs: [
          'Dans le cadre de votre utilisation de la Plateforme, nous collectons et traitons les catégories de données suivantes :',
        ],
        list: [
          "Données d'identité et de compte : nom, prénom, adresse e-mail, mot de passe (chiffré), photo de profil éventuelle.",
          "Données de candidature : curriculum vitae (CV) téléversé et les informations extraites automatiquement par notre IA (formation, expériences professionnelles, compétences, langues, certifications, centres d'intérêt, coordonnées).",
          "Données d'évaluation : réponses aux quiz et tests, résultats et scores.",
          "Données d'entretien (voir section 6) : transcription textuelle de l'entretien (reconnaissance vocale), indicateurs d'émotions faciales et vocales détectés en temps réel par l'IA, indicateurs d'attention et de regard (orientation de la tête, regard porté ou non vers l'écran), ainsi que le rapport d'analyse automatisé généré à l'issue de l'entretien.",
          "Données de connexion et techniques : adresse IP, type de navigateur, journaux de connexion, données d'authentification à deux facteurs (2FA).",
          "Données d'authentification tierce : lorsque vous vous connectez via Google, LinkedIn ou GitHub, nous recevons les informations de base de votre profil auprès de ces fournisseurs.",
        ],
      },
      {
        heading: '4. Finalités et bases légales du traitement',
        paragraphs: [
          'Vos données sont traitées pour les finalités suivantes, chacune reposant sur une base légale prévue par le RGPD :',
        ],
        list: [
          "Création et gestion de votre compte candidat — base légale : exécution du contrat (art. 6.1.b).",
          "Mise en relation avec des offres d'emploi et des recruteurs, matching de profils — base légale : exécution du contrat et consentement.",
          "Analyse de CV, de quiz et d'entretiens assistée par IA, y compris l'analyse des émotions et de l'attention, afin d'évaluer l'adéquation aux postes — base légale : consentement explicite (art. 6.1.a et, le cas échéant, art. 9.2.a).",
          "Amélioration et sécurité de la Plateforme, prévention de la fraude — base légale : intérêt légitime (art. 6.1.f).",
          "Respect de nos obligations légales et réglementaires — base légale : obligation légale (art. 6.1.c).",
        ],
      },
      {
        heading: '5. Décisions automatisées et profilage',
        paragraphs: [
          "La Plateforme utilise des algorithmes d'intelligence artificielle pour analyser votre CV, vos quiz, vos entretiens (y compris vos émotions et votre attention) et pour calculer un score d'adéquation avec les offres d'emploi (profilage au sens de l'article 22 du RGPD).",
          "Ces traitements ont une finalité d'aide à la décision : aucune décision produisant des effets juridiques ou vous affectant de manière significative n'est prise sur le seul fondement d'un traitement automatisé. Un recruteur humain conserve la maîtrise de la décision finale.",
          "Vous disposez du droit d'obtenir une intervention humaine, d'exprimer votre point de vue et de contester toute évaluation automatisée en contactant privacy@humatiq.ai.",
        ],
      },
      {
        heading: '6. Entretiens vidéo assistés par IA et analyse comportementale',
        highlight: true,
        paragraphs: [
          "Lorsque vous participez à un entretien vidéo sur la Plateforme, et uniquement pendant la durée de l'entretien avec votre caméra et votre microphone activés, nos modèles d'intelligence artificielle réalisent en temps réel les traitements suivants :",
        ],
        list: [
          "Reconnaissance des émotions faciales à partir du flux de votre caméra (émotion dominante détectée).",
          "Analyse des émotions vocales à partir du flux de votre microphone.",
          "Suivi de l'attention et du regard : orientation de la tête et estimation du fait que vous regardez ou non l'écran.",
          "Transcription automatique de la conversation (reconnaissance vocale).",
        ],
        list2: [
          "Ces indicateurs sont transmis en temps réel au recruteur pendant l'entretien et sont conservés, avec la transcription et le rapport d'analyse, pour les besoins du processus de recrutement.",
          "Nous n'enregistrons pas et ne conservons pas le flux audio ou vidéo brut de l'entretien : seules les données dérivées (émotions, attention, transcription) et le rapport d'analyse sont conservés.",
          "Ces traitements reposent sur votre consentement explicite et préalable. Vous pouvez refuser l'analyse comportementale en désactivant votre caméra et/ou votre microphone, ou vous y opposer en contactant privacy@humatiq.ai ; nous proposerons alors, dans la mesure du possible, une modalité d'entretien alternative. Le retrait du consentement n'affecte pas la licéité des traitements antérieurs.",
          "Conformément au principe de transparence (art. 13 du RGPD) et au cadre applicable à l'intelligence artificielle, vous êtes informé que ces analyses se déroulent automatiquement en arrière-plan. Elles constituent une aide à la décision et ne se substituent pas à l'appréciation d'un recruteur humain.",
        ],
      },
      {
        heading: '7. Destinataires des données',
        paragraphs: [
          'Vos données peuvent être communiquées aux destinataires suivants, dans la stricte mesure nécessaire :',
        ],
        list: [
          "Les recruteurs et entreprises auxquels vous postulez ou qui consultent votre profil et vos entretiens sur la Plateforme.",
          "Nos sous-traitants techniques (hébergement, fournisseurs d'authentification, services d'IA), liés par des engagements de confidentialité et de conformité RGPD.",
          "Les autorités compétentes lorsque la loi l'exige.",
        ],
      },
      {
        heading: '8. Transferts hors Union européenne',
        paragraphs: [
          "Lorsque certains de nos prestataires sont situés en dehors de l'Espace économique européen, ces transferts sont encadrés par des garanties appropriées (clauses contractuelles types de la Commission européenne ou décision d'adéquation), conformément aux articles 44 et suivants du RGPD.",
        ],
      },
      {
        heading: '9. Durée de conservation',
        paragraphs: [
          "Vos données de compte et de profil sont conservées pendant toute la durée de vie de votre compte. En cas d'inactivité prolongée, elles sont conservées pendant un maximum de deux (2) ans à compter de votre dernière activité, puis supprimées ou anonymisées.",
          "Les données d'entretien (transcription, indicateurs d'émotions et d'attention, rapport d'analyse) sont conservées pour la durée nécessaire au processus de recrutement concerné, puis supprimées ou anonymisées. Vous pouvez demander leur suppression à tout moment.",
        ],
      },
      {
        heading: '10. Vos droits (RGPD)',
        paragraphs: [
          'Conformément aux articles 15 à 22 du RGPD, vous disposez des droits suivants concernant vos données personnelles :',
        ],
        list: [
          "Droit d'accès : obtenir une copie des données que nous détenons sur vous.",
          'Droit de rectification : corriger des données inexactes ou incomplètes.',
          "Droit à l'effacement (« droit à l'oubli ») : demander la suppression de vos données.",
          "Droit à la limitation du traitement de vos données.",
          "Droit à la portabilité : recevoir vos données dans un format structuré et lisible par machine.",
          "Droit d'opposition au traitement fondé sur l'intérêt légitime, et droit de vous opposer à l'analyse comportementale lors des entretiens.",
          "Droit de retirer votre consentement à tout moment, sans que cela n'affecte la licéité du traitement effectué avant ce retrait.",
          "Droit d'introduire une réclamation auprès d'une autorité de contrôle (en France, la CNIL — www.cnil.fr).",
        ],
      },
      {
        heading: '11. Exercice de vos droits',
        paragraphs: [
          "Vous pouvez exercer ces droits directement depuis les paramètres de votre compte ou en écrivant à privacy@humatiq.ai. Nous nous engageons à répondre à votre demande dans un délai d'un (1) mois, conformément à l'article 12 du RGPD.",
        ],
      },
      {
        heading: '12. Sécurité des données',
        paragraphs: [
          "Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données : chiffrement des mots de passe, connexions sécurisées (HTTPS), authentification à deux facteurs (2FA) optionnelle et contrôle des accès.",
        ],
      },
      {
        heading: '13. Obligations du candidat',
        paragraphs: [
          "Vous vous engagez à fournir des informations exactes et à jour, à ne pas usurper l'identité d'un tiers et à utiliser la Plateforme conformément aux lois en vigueur. Vous êtes responsable de la confidentialité de vos identifiants.",
        ],
      },
      {
        heading: '14. Modification des conditions',
        paragraphs: [
          "Nous pouvons modifier les présentes conditions afin de refléter des évolutions légales ou fonctionnelles. En cas de modification substantielle, vous en serez informé et, le cas échéant, un nouveau consentement vous sera demandé.",
        ],
      },
    ],
    footer: '© 2026 HumatiQ AI. Tous droits réservés.',
  },

  en: {
    back: 'Back',
    title: 'Terms of Use & Privacy Policy',
    lastUpdated: 'Last updated: June 1, 2026',
    intro:
      'Welcome to HumatiQ AI, an AI-assisted recruitment platform. By creating a candidate account, you acknowledge that you have read, understood and accepted these Terms of Use and the Privacy Policy below, in accordance with the EU General Data Protection Regulation (GDPR — Regulation EU 2016/679). Please pay particular attention to Section 6, regarding AI-assisted video interviews and behavioural analysis.',
    sections: [
      {
        heading: '1. Purpose and acceptance',
        paragraphs: [
          'These terms govern the use of the HumatiQ AI platform (the "Platform") by candidates. Accepting these terms is mandatory and is a prerequisite for creating an account and using our services.',
          'If you do not accept these terms, you must not create an account or use the Platform.',
        ],
      },
      {
        heading: '2. Data controller',
        paragraphs: [
          'HumatiQ AI acts as the data controller for the personal data collected through the Platform. For any question regarding the protection of your data, you may contact our Data Protection Officer (DPO) at: privacy@humatiq.ai.',
        ],
      },
      {
        heading: '3. Personal data collected',
        paragraphs: [
          'As part of your use of the Platform, we collect and process the following categories of data:',
        ],
        list: [
          'Identity and account data: first name, last name, email address, password (encrypted), optional profile picture.',
          'Application data: uploaded résumé (CV) and the information automatically extracted by our AI (education, work experience, skills, languages, certifications, interests, contact details).',
          'Assessment data: quiz and test answers, results and scores.',
          'Interview data (see Section 6): a text transcript of the interview (speech recognition), facial and voice emotion indicators detected in real time by the AI, attention and gaze indicators (head orientation, whether or not you are looking at the screen), and the automated analysis report generated at the end of the interview.',
          'Connection and technical data: IP address, browser type, connection logs, two-factor authentication (2FA) data.',
          'Third-party authentication data: when you sign in via Google, LinkedIn or GitHub, we receive basic profile information from those providers.',
        ],
      },
      {
        heading: '4. Purposes and legal bases of processing',
        paragraphs: [
          'Your data is processed for the following purposes, each relying on a legal basis provided by the GDPR:',
        ],
        list: [
          'Creating and managing your candidate account — legal basis: performance of a contract (Art. 6.1.b).',
          'Matching you with job offers and recruiters, profile matching — legal basis: performance of a contract and consent.',
          'AI-assisted analysis of CVs, quizzes and interviews, including emotion and attention analysis, to assess suitability for positions — legal basis: explicit consent (Art. 6.1.a and, where applicable, Art. 9.2.a).',
          'Improving and securing the Platform, fraud prevention — legal basis: legitimate interest (Art. 6.1.f).',
          'Compliance with our legal and regulatory obligations — legal basis: legal obligation (Art. 6.1.c).',
        ],
      },
      {
        heading: '5. Automated decisions and profiling',
        paragraphs: [
          'The Platform uses artificial intelligence algorithms to analyze your CV, quizzes, interviews (including your emotions and attention) and to compute a suitability score against job offers (profiling within the meaning of Article 22 of the GDPR).',
          'These processes are decision-support only: no decision producing legal effects or significantly affecting you is taken solely on the basis of automated processing. A human recruiter retains control over the final decision.',
          'You have the right to obtain human intervention, to express your point of view and to contest any automated assessment by contacting privacy@humatiq.ai.',
        ],
      },
      {
        heading: '6. AI-assisted video interviews and behavioural analysis',
        highlight: true,
        paragraphs: [
          'When you take part in a video interview on the Platform, and only for the duration of the interview while your camera and microphone are enabled, our artificial intelligence models perform the following processing in real time:',
        ],
        list: [
          'Facial emotion recognition from your camera feed (detected dominant emotion).',
          'Voice emotion analysis from your microphone feed.',
          'Attention and gaze tracking: head orientation and an estimate of whether or not you are looking at the screen.',
          'Automatic transcription of the conversation (speech recognition).',
        ],
        list2: [
          'These indicators are transmitted to the recruiter in real time during the interview and are retained, together with the transcript and the analysis report, for the purposes of the recruitment process.',
          'We do not record or retain the raw audio or video stream of the interview: only the derived data (emotions, attention, transcript) and the analysis report are kept.',
          'This processing relies on your prior, explicit consent. You may refuse the behavioural analysis by disabling your camera and/or microphone, or object to it by contacting privacy@humatiq.ai; where possible we will then offer an alternative interview method. Withdrawing consent does not affect the lawfulness of prior processing.',
          'In accordance with the transparency principle (Art. 13 of the GDPR) and the applicable AI framework, you are informed that these analyses run automatically in the background. They are decision-support only and do not replace the assessment of a human recruiter.',
        ],
      },
      {
        heading: '7. Recipients of the data',
        paragraphs: [
          'Your data may be shared with the following recipients, strictly as necessary:',
        ],
        list: [
          'The recruiters and companies to which you apply or who view your profile and interviews on the Platform.',
          'Our technical sub-processors (hosting, authentication providers, AI services), bound by confidentiality and GDPR compliance commitments.',
          'Competent authorities where required by law.',
        ],
      },
      {
        heading: '8. Transfers outside the European Union',
        paragraphs: [
          'Where some of our providers are located outside the European Economic Area, such transfers are governed by appropriate safeguards (European Commission standard contractual clauses or an adequacy decision), in accordance with Articles 44 et seq. of the GDPR.',
        ],
      },
      {
        heading: '9. Retention period',
        paragraphs: [
          'Your account and profile data is kept for the entire lifetime of your account. In the event of prolonged inactivity, it is kept for a maximum of two (2) years from your last activity, then deleted or anonymized.',
          'Interview data (transcript, emotion and attention indicators, analysis report) is kept for the time necessary for the relevant recruitment process, then deleted or anonymized. You may request its deletion at any time.',
        ],
      },
      {
        heading: '10. Your rights (GDPR)',
        paragraphs: [
          'In accordance with Articles 15 to 22 of the GDPR, you have the following rights regarding your personal data:',
        ],
        list: [
          'Right of access: obtain a copy of the data we hold about you.',
          'Right to rectification: correct inaccurate or incomplete data.',
          'Right to erasure ("right to be forgotten"): request the deletion of your data.',
          'Right to restriction of the processing of your data.',
          'Right to data portability: receive your data in a structured, machine-readable format.',
          'Right to object to processing based on legitimate interest, and the right to object to behavioural analysis during interviews.',
          'Right to withdraw your consent at any time, without affecting the lawfulness of processing carried out before withdrawal.',
          'Right to lodge a complaint with a supervisory authority (in France, the CNIL — www.cnil.fr).',
        ],
      },
      {
        heading: '11. Exercising your rights',
        paragraphs: [
          'You may exercise these rights directly from your account settings or by writing to privacy@humatiq.ai. We undertake to respond to your request within one (1) month, in accordance with Article 12 of the GDPR.',
        ],
      },
      {
        heading: '12. Data security',
        paragraphs: [
          'We implement appropriate technical and organizational measures to protect your data: password encryption, secure connections (HTTPS), optional two-factor authentication (2FA) and access control.',
        ],
      },
      {
        heading: '13. Candidate obligations',
        paragraphs: [
          'You undertake to provide accurate and up-to-date information, not to impersonate a third party, and to use the Platform in accordance with applicable laws. You are responsible for keeping your credentials confidential.',
        ],
      },
      {
        heading: '14. Changes to the terms',
        paragraphs: [
          'We may amend these terms to reflect legal or functional changes. In the event of a substantial change, you will be informed and, where applicable, asked for renewed consent.',
        ],
      },
    ],
    footer: '© 2026 HumatiQ AI. All rights reserved.',
  },
};
