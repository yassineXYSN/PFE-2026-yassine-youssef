# HumatiQ Modular Use Case Diagrams

This document contains detailed Use Case Diagrams for each module of the HumatiQ platform.

## 1. Authentication & Identity
Focuses on user access, registration, and security verification.

```plantuml
@startuml Authentication_Module
left to right direction
actor "Candidate" as C
actor "Recruiter" as R
actor "Admin / ARH" as A

rectangle "Authentication Module" {
    usecase "Login (Email/Pass)" as UC1.1
    usecase "Login (Google/LinkedIn)" as UC1.2
    usecase "Register Account" as UC1.3
    usecase "Verify Email" as UC1.4
    usecase "Reset Password" as UC1.5
    usecase "Logout" as UC1.6
}

C -- UC1.1
C -- UC1.2
C -- UC1.3
C -- UC1.4
C -- UC1.5
C -- UC1.6

R -- UC1.1
R -- UC1.2
R -- UC1.6

A -- UC1.1
A -- UC1.2
A -- UC1.6
@enduml
```

---

## 2. Security & Access Control (RBAC)
Focuses on system security, role management, and audit trails.

```plantuml
@startuml Security_Module
left to right direction
actor "Admin / ARH" as A
actor "User" as U

rectangle "Security & Access Module" {
    usecase "Enable MFA" as UC2.1
    usecase "Manage Roles (RBAC)" as UC2.2
    usecase "View Connection Logs" as UC2.3
    usecase "Revoke Device Access" as UC2.4
    usecase "Validate JWT Tokens" as UC2.5
}

U -- UC2.1
U -- UC2.4
A -- UC2.2
A -- UC2.3
A -- UC2.5
@enduml
```

---

## 3. Recruitment Management (RECRUIT)
The core recruitment engine including AI-powered parsing and scoring.

```plantuml
@startuml Recruitment_Module
left to right direction
actor "Recruiter" as R
actor "AI Engine" <<System>> as AI
actor "LinkedIn API" <<System>> as LNK

rectangle "Recruitment Module" {
    usecase "Manage Job Offers" as UC3.1
    usecase "View Candidate Kanban" as UC3.2
    usecase "Parse CV automatically" as UC3.3
    usecase "View AI Relevance Score" as UC3.4
    usecase "Analyze Soft Skills" as UC3.5
    usecase "Manual Override Ranking" as UC3.6
    usecase "Post Job to LinkedIn" as UC3.7
}

R -- UC3.1
R -- UC3.2
R -- UC3.4
R -- UC3.5
R -- UC3.6
R -- UC3.7

UC3.3 -- AI
UC3.4 ..> UC3.3 : <<include>>
UC3.5 ..> UC3.3 : <<extend>>
UC3.7 -- LNK
@enduml
```

---

## 4. Profile & Assessment (PROFILE)
Candidate profiles, interviews, and personality assessments.

```plantuml
@startuml Profile_Module
left to right direction
actor "Recruiter" as R
actor "Candidate" as C
actor "AI Engine" <<System>> as AI

rectangle "Profile & Assessment Module" {
    usecase "View 360 Profile" as UC4.1
    usecase "Analyze DISC Personality" as UC4.2
    usecase "Get Interview Transcription" as UC4.3
    usecase "Archive Interview History" as UC4.4
    usecase "Manage Company Profile" as UC4.5
    usecase "Setup Personal Profile" as UC4.6
}

R -- UC4.1
R -- UC4.2
R -- UC4.3
R -- UC4.4
R -- UC4.5
C -- UC4.6

UC4.2 -- AI
UC4.3 -- AI
@enduml
```

---

## 5. Analytics & Insights (INSIGHT)
Data visualization and intelligent dashboarding.

```plantuml
@startuml Insight_Module
left to right direction
actor "ARH / DRH" as A
actor "User" as U
actor "AI Engine" <<System>> as AI

rectangle "Analytics & Insights Module" {
    usecase "View Recruitment KPIs" as UC5.1
    usecase "Composite Score Visualization" as UC5.2
    usecase "Query AI Chatbot" as UC5.3
}

A -- UC5.1
A -- UC5.2
U -- UC5.3
UC5.3 -- AI
@enduml
```

---

## 6. Psychological Synergy (PSYNARIO)
Team dynamics and integration simulations.

```plantuml
@startuml Psynario_Module
left to right direction
actor "ARH" as A
actor "AI Engine" <<System>> as AI

rectangle "Psynario Module" {
    usecase "Analyze Team Composition" as UC6.1
    usecase "Simulate Integration Synergies" as UC6.2
    usecase "Predict Team Conflicts" as UC6.3
}

A -- UC6.1
A -- UC6.2
A -- UC6.3
UC6.2 -- AI
UC6.3 -- AI
@enduml
```

---

## 7. Career Growth (GROW)
Focus on candidate development and internal mobility.

```plantuml
@startuml Grow_Module
left to right direction
actor "Candidate" as C
actor "AI Engine" <<System>> as AI

rectangle "Career Growth Module" {
    usecase "View Competency Mapping" as UC7.1
    usecase "Receive AI Training Recs" as UC7.2
    usecase "View Internal Mobility" as UC7.3
}

C -- UC7.1
C -- UC7.2
C -- UC7.3
UC7.2 -- AI
@enduml
```

---

## 8. Candidate Portal
Direct interface for candidate interactions.

```plantuml
@startuml Portal_Module
left to right direction
actor "Candidate" as C
actor "AI Engine" <<System>> as AI

rectangle "Candidate Portal" {
    usecase "Track Applications" as UC8.1
    usecase "Search with Filters" as UC8.2
    usecase "Rec récapitulatif Dashboard" as UC8.3
    usecase "Analyze Market Skills" as UC8.4
}

C -- UC8.1
C -- UC8.2
C -- UC8.3
C -- UC8.4
UC8.2 -- AI
@enduml
```

---

## 9. Compliance & Privacy (RGPD)
Data protection and user rights.

```plantuml
@startuml RGPD_Module
left to right direction
actor "User" as U

rectangle "Compliance & RGPD Module" {
    usecase "Give Consent" as UC9.1
    usecase "Export Personal Data" as UC9.2
    usecase "Delete Data (Droit à l'oubli)" as UC9.3
}

U -- UC9.1
U -- UC9.2
U -- UC9.3
@enduml
```

---

## 10. Automated Notifications
Communication and alerting system.

```plantuml
@startuml Notifications_Module
left to right direction
actor "User" as U
actor "Candidate" as C
actor "Recruiter" as R
actor "AI Engine" <<System>> as AI

rectangle "Notifications Module" {
    usecase "Receive Security Alert" as UC10.1
    usecase "Receive Job Matching Alert" as UC10.2
    usecase "Receive Performance Report" as UC10.3
    usecase "Receive Expiry Alert" as UC10.4
}

U -- UC10.1
C -- UC10.2
R -- UC10.3
C -- UC10.4
UC10.2 -- AI
@enduml
```
