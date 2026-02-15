# Dashboard Design Prompt for Job Candidate Platform

## 🎯 Project Overview

Design a comprehensive **Candidate Dashboard** for a job seeking platform. This dashboard serves as the main interface after a user completes their account setup. The design must seamlessly integrate with the existing application theme, maintaining visual consistency while providing an intuitive and professional user experience.

---

## 🎨 Existing Design System (MUST FOLLOW)

### Color Palette

#### Primary Colors
| Color Name | Hex Code | Usage |
|------------|----------|-------|
| **Primary Purple** | `#8b5cf6` | Main accent color, icons, links, focus states |
| **Primary Purple Dark** | `#7c3aed` | Hover states, button gradients |
| **Primary Purple Darkest** | `#6d28d9` | Active states, dark mode accents |
| **Primary Purple Light** | `#a78bfa` | Dark mode accent text |

#### Secondary/Accent Colors
| Color Name | Hex Code | Usage |
|------------|----------|-------|
| **Pink Accent** | `#ec4899` | Badges, hobby highlights, secondary accent |
| **Pink Accent Dark** | `#db2777` | Badge gradients |
| **Pink Light** | `#f472b6` | Dark mode pink elements |

#### Background Colors
| Mode | Color | Hex Code |
|------|-------|----------|
| Light | Page Background | `#f6f6f8` |
| Light | Card/Container | `#ffffff` |
| Light | Section Background | `#f9fafb` |
| Light | Input Background | `#f3f4f6` |
| Dark | Page Background | `#0b1020` |
| Dark | Card/Container | `#1f2937` |
| Dark | Section Background | `#111827` |
| Dark | Input Background | `#1f2937` |

#### Text Colors
| Mode | Type | Hex Code |
|------|------|----------|
| Light | Primary Text | `#0d101b` |
| Light | Secondary Text | `#4c599a` |
| Light | Muted Text | `#9ca3af` |
| Light | Subtle Text | `#6b7280` |
| Dark | Primary Text | `#e5e7eb` |
| Dark | Secondary Text | `#9ca3af` |
| Dark | Muted Text | `#6b7280` |
| Dark | Bright Text | `#f9fafb` |

#### Border Colors
| Mode | Hex Code |
|------|----------|
| Light | `#e5e7eb` |
| Light Alt | `#d1d5db` |
| Light Card Border | `#cfd3e7` |
| Dark | `#374151` |
| Dark Alt | `#4b5563` |

#### Status/Semantic Colors
| Status | Hex Code |
|--------|----------|
| Success/Green | `#10b981` |
| Error/Red | `#dc2626` / `#ef4444` |
| Warning/Amber | `#f59e0b` |
| Info/Blue | `#3b82f6` |

---

### Typography

- **Font Family**: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`
- **Font Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 900 (black for headings)
- **Font Sizes**:
  - H1 Titles: `1.875rem - 2rem`
  - H2 Section Titles: `1.35rem`
  - H3 Component Titles: `1.125rem`
  - Body Text: `0.95rem`
  - Labels: `0.875rem - 0.95rem`
  - Small/Caption: `0.75rem - 0.85rem`

---

### Border Radius Tokens

| Element | Radius |
|---------|--------|
| Large Cards/Containers | `1.5rem` (26px) |
| Medium Cards | `1rem` (16px) |
| Buttons/Inputs | `0.5rem - 0.75rem` |
| Small Elements/Tags | `0.25rem - 0.5rem` |
| Pills/Badges | `9999px` (full round) |
| Progress Bars | `9999px` |

---

### Shadows

```css
/* Light Mode Card Shadow */
box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);

/* Dark Mode Card Shadow */
box-shadow: 0 0 40px rgba(255, 255, 255, 0.03), 0 10px 25px rgba(0, 0, 0, 0.4);

/* Button Primary Shadow */
box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);

/* Button Hover Shadow */
box-shadow: 0 6px 16px rgba(124, 58, 237, 0.35);

/* Elevated Card Shadow */
box-shadow: 0 24px 60px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(148, 163, 184, 0.35);
```

---

### Button Styles

#### Primary Button (Purple Gradient)
```css
background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
color: #ffffff;
border-radius: 0.5rem - 0.75rem;
padding: 0.75rem 1.5rem;
font-weight: 600;
box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
/* Hover: translateY(-2px), enhanced shadow */
```

#### Secondary/Ghost Button
```css
background-color: #f3f4f6; /* Dark: #374151 */
color: #374151; /* Dark: #d1d5db */
border: 1px solid #d1d5db; /* Dark: #4b5563 */
```

#### Danger/Delete Button
```css
color: #dc2626;
background: rgba(220, 38, 38, 0.1);
/* Dark: color #ef4444, background rgba(239, 68, 68, 0.15) */
```

---

### Input Styles
```css
padding: 0.75rem 1rem;
border: 1px solid #d1d5db; /* Dark: #4b5563 */
border-radius: 0.5rem;
background: #ffffff; /* Dark: #1f2937 */
font-size: 0.95rem;
/* Focus: border-color #8b5cf6, box-shadow 0 0 0 3px rgba(139, 92, 246, 0.1) */
```

---

### Icons
- **Library**: Font Awesome 6 (Solid: `fas`, brands: `fab`)
- **Common Icons Used**:
  - Navigation: `fa-home`, `fa-briefcase`, `fa-building`, `fa-paper-plane`, `fa-user`, `fa-bell`, `fa-cog`
  - Actions: `fa-plus`, `fa-edit`, `fa-trash-alt`, `fa-times`, `fa-check`, `fa-arrow-left`, `fa-arrow-right`
  - Content: `fa-graduation-cap`, `fa-certificate`, `fa-heart`, `fa-laptop-code`, `fa-language`, `fa-sliders-h`
  - Theme: `fa-sun`, `fa-moon`, `fa-desktop`
  - Files: `fa-file-upload`, `fa-cloud-upload-alt`, `fa-file-alt`
  - AI Features: `fa-robot`, `fa-magic`, `fa-brain`, `fa-lightbulb`, `fa-chart-line`, `fa-sparkles`
  - Social/Networking: `fa-users`, `fa-handshake`, `fa-comments`, `fa-share-alt`, `fa-user-plus`
  - Gamification: `fa-trophy`, `fa-medal`, `fa-star`, `fa-award`, `fa-fire`, `fa-gem`
  - Video: `fa-video`, `fa-play-circle`, `fa-microphone`, `fa-camera`

---

## 📐 Dashboard Layout Requirements

### Overall Structure
Design a **responsive dashboard** with the following layout:

```
┌─────────────────────────────────────────────────────┐
│  Header (optional - depends on design)              │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│  SIDEBAR │           MAIN CONTENT AREA              │
│   MENU   │                                          │
│          │                                          │
│  - Jobs  │     (Dynamic based on selected menu)     │
│  - Comp. │                                          │
│  - Subm. │                                          │
│  - AI    │                                          │
│  - Prof. │                                          │
│  - Inte. │                                          │
│  - Netw. │                                          │
│  - Anal. │                                          │
│  - Notif.│                                          │
│  - Sett. │                                          │
│  - Help  │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

### Responsive Breakpoints
- **Desktop**: > 1024px (Full sidebar visible)
- **Tablet**: 768px - 1024px (Collapsible sidebar with icons only)
- **Mobile**: < 768px (Bottom navigation or hamburger menu)

---

## 📋 Sidebar Navigation

### Design Specifications
- **Width**: 260-280px (desktop), 70-80px collapsed (tablet)
- **Background**: Match card background (`#ffffff` light / `#1f2937` dark)
- **Border**: Right border `1px solid #e5e7eb` (light) / `#374151` (dark)
- **Position**: Fixed or sticky

### Navigation Items

| Icon | Label | Description |
|------|-------|-------------|
| `fa-briefcase` | **Jobs** | Browse job listings, search jobs, saved jobs |
| `fa-building` | **Companies** | Browse companies, followed companies |
| `fa-paper-plane` | **My Submissions** | Application history, status tracking |
| `fa-robot` | **AI Assistant** | Smart recommendations, career insights |
| `fa-user` | **Profile** | View/edit profile information |
| `fa-video` | **Video Intro** | Record and manage video introductions |
| `fa-users` | **Network** | Connections, mentors, community |
| `fa-chart-line` | **Analytics** | Application performance insights |
| `fa-graduation-cap` | **Interview Prep** | Practice interviews, resources |
| `fa-trophy` | **Achievements** | Badges, milestones, gamification |
| `fa-bell` | **Notifications** | Application updates, messages, alerts |
| `fa-cog` | **Settings** | Account, theme, and language preferences |
| `fa-question-circle` | **Help & Support** | FAQ, tutorials, contact support |

### Navigation Item States
- **Default**: Muted color, no background
- **Hover**: Subtle background (`#f3f4f6` light / `#374151` dark)
- **Active**: Purple accent background (`rgba(139, 92, 246, 0.1)`), purple text and left border indicator
- **Badge/Count**: Pink background pill for notification counts
- **New Feature**: Small "NEW" badge in pink for recently added features

---

## 📄 Page Designs Required

### 1. Jobs Page (Home/Default View)

**Purpose**: Browse and search job opportunities

**Components**:
- Search bar with filters (job type, location, salary, industry)
- Job cards grid or list view toggle
- Each job card shows:
  - Company logo placeholder
  - Job title
  - Company name
  - Location (with remote/onsite/hybrid badge)
  - Salary range
  - Posted date
  - Quick apply button
  - Save/bookmark button
  - **AI Match Score** (percentage showing how well the job matches user profile)
  - **Application Deadline Countdown** (days remaining badge)
- Pagination or infinite scroll
- Filters sidebar (on desktop) or slide-out (mobile)
- **Smart Search Suggestions**: AI-powered autocomplete based on user's profile and history
- **Recent Searches**: Quick access to previous search queries
- **Saved Filters**: Save frequently used filter combinations

**Visual Style**:
- Job cards with hover elevation effect
- Color-coded badges for job types (Full-time, Part-time, Contract, etc.)
- Company logos in rounded squares
- **Match score gradient**: Low (gray), Medium (blue), High (green), Perfect (purple with sparkle)

---

### 2. Companies Page

**Purpose**: Explore and follow companies

**Components**:
- Search and filter bar
- Company cards in grid layout
- Each card shows:
  - Company logo
  - Company name
  - Industry badge
  - Number of open positions
  - Follow/unfollow button
  - **Company Culture Score** (based on employee reviews)
  - **Hiring Activity Indicator** (actively hiring, occasionally hiring, not hiring)
  - **Quick Stats**: Company size, founded year, headquarters location
- Company size indicators
- Rating/reviews preview (if applicable)
- **Company Insights Section**: Work-life balance rating, growth opportunities, salary competitiveness
- **Similar Companies**: AI-suggested companies based on user interests

---

### 3. My Submissions Page

**Purpose**: Track all job applications

**Components**:
- Filter tabs: All, Pending, In Review, Interviewed, Accepted, Rejected
- Application cards/list with:
  - Job title and company
  - Applied date
  - Current status (with color-coded badge)
  - Status timeline/progress indicator
  - Actions: View details, Withdraw application
  - **Next Steps Indicator**: What action is expected next
  - **Response Time Estimate**: AI-predicted response timeframe
  - **Follow-up Reminder**: Option to set reminders for follow-up
- Status statistics cards at top (total applications, pending, interviews, offers)
- **Application Health Score**: Overall quality of applications submitted
- **Weekly/Monthly Application Goals**: Track submission targets

**Status Badge Colors**:
- Pending: Gray (`#6b7280`)
- In Review: Blue (`#3b82f6`)
- Interview Scheduled: Purple (`#8b5cf6`)
- Accepted/Offer: Green (`#10b981`)
- Rejected: Red (`#dc2626`)

---

### 4. Profile Page

**Purpose**: View and manage candidate profile (same data as account setup)

**Profile Information Sections** (with Add, Edit, Delete capabilities):

#### 4.1 Personal Information Card
- **Profile picture/avatar** (with upload option)
- **First Name** and **Last Name**
- **Birth Date**
- **Professional Title** (e.g., "Software Engineer")
- **Address**
- **LinkedIn URL** (clickable link)
- **Hobbies** (displayed as tags, max 3)
- Edit button for each section

#### 4.2 Skills & Languages Section
- **Skills** - List with proficiency progress bars (0-100%)
  - Display as cards with skill name and visual progress bar
  - Add new skill button
  - Edit/delete each skill
  - **AI Skill Suggestions**: Recommended skills based on target jobs
  - **Skill Endorsements Counter**: If connected users endorse skills
- **Languages** - Similar to skills with proficiency levels
  - Labels: Basic, Conversational, Fluent, Native

#### 4.3 Education Section
- List of education entries, each showing:
  - Institution name
  - Start Year - End Year (or "Ongoing")
  - Social link (if provided)
  - Certificate file indicator (if uploaded)
  - Edit and delete buttons
- Add new education button

#### 4.4 Experience Section
- List of work experience entries, each showing:
  - Company name
  - Job position/title
  - Start Year - End Year (or "Present" if ongoing)
  - Description text
  - Attached document indicator (if uploaded)
  - Edit and delete buttons
  - **Key Achievements**: Highlight notable accomplishments with metrics
- Add new experience button

#### 4.5 Certificates Section
- Grid/list of certificates with:
  - Certificate name
  - Issuing organization
  - Issue date
  - File preview/download link
  - Edit and delete buttons
  - **Verification Badge**: For verified certificates
- Add new certificate button

#### 4.6 Job Preferences Card
- **Job Type**: Full-time, Part-time, Contract, Freelance, Internship
- **Work Location**: On-site, Remote, Hybrid
- **Salary Expectation**: Range display
- **Availability**: Immediately, 2 weeks, 1 month, 2 months, 3+ months
- **Preferred Industries**: Industry tags
- **Willing to Relocate**: Yes/No indicator
- Edit preferences button

#### 4.7 Portfolio Showcase Section (NEW)
- **Project Cards** with:
  - Project title and description
  - Technologies used (as tags)
  - Project thumbnail/screenshot
  - Live demo link
  - GitHub/repository link
  - Date completed
- **Media Gallery**: Upload images, videos, or documents showcasing work
- **Featured Projects**: Pin top 3 projects to display prominently
- Drag-and-drop reordering

**Profile Completeness**:
- Show a profile completeness progress bar (using purple gradient)
- Tips/prompts to complete missing sections
- **Profile Strength Score**: Overall profile quality rating with improvement tips
- **Compared to Similar Candidates**: "Your profile is stronger than 75% of candidates in your field"

---

### 5. Notifications Page

**Purpose**: View all notifications and alerts

**Components**:
- Filter tabs: All, Unread, Applications, Messages, System
- Mark all as read button
- Notification list items with:
  - Icon based on type
  - Title/summary
  - Timestamp (relative time: "2 hours ago")
  - Read/unread indicator (dot or background color)
  - Click to view details or navigate
- Empty state for no notifications
- **Notification Preferences Quick Access**: Link to customize what notifications to receive
- **Priority Notifications**: Highlight urgent items (interview invites, deadlines)
- **Group Similar Notifications**: Batch similar notifications for cleaner view

**Notification Types**:
- Application status updates
- New job matches
- Message from recruiter
- Profile view notifications
- System announcements
- **Interview reminders with calendar integration**
- **Achievement unlocked alerts**
- **Network connection requests**
- **Skills endorsement notifications**
- **Weekly digest summaries**

---

### 6. Settings Page

**Purpose**: Manage account, appearance, and language preferences

#### 6.1 Account Settings Section
- **Email address** (with verified badge)
- **Change password** button/link
- **Two-factor authentication** toggle
- **Connected accounts** (Google, LinkedIn)
- **Delete account** button (danger action)
- **Privacy settings** toggles:
  - Profile visibility
  - Show email to employers
  - Notification preferences
- **Data Export**: Download all personal data (GDPR compliance)
- **Session Management**: View and manage active sessions with device info

#### 6.2 Theme Settings Section
- Theme selector with three options:
  - **System** (follows OS preference) - Desktop icon
  - **Light** - Sun icon
  - **Dark** - Moon icon
- Visual preview of each theme option
- Currently active theme highlighted with purple border/accent

#### 6.3 Language Settings Section
- Language dropdown/selector
- Support for multiple languages (currently English, French based on codebase)
- Flag icons next to language options (optional)

#### 6.4 Keyboard Shortcuts Settings (NEW)
- List of available keyboard shortcuts
- Option to customize shortcuts
- Quick reference card/modal accessible via `?` key

#### 6.5 Notification Preferences Section (NEW)
- Granular control over each notification type
- Email notification frequency: Real-time, Daily Digest, Weekly Summary
- Push notification toggles
- Quiet hours setting (no notifications during specified times)

---

## 🤖 NEW SECTION: AI-Powered Features Hub

### 7. AI Assistant Page (NEW)

**Purpose**: Centralized AI-powered career assistance

**Components**:

#### 7.1 Smart Job Recommendations Card
- **AI Match Scores**: Jobs ranked by how well they match profile
- **Match Breakdown**: Visual explanation of why each job is recommended
  - Skills match percentage
  - Experience alignment score
  - Culture fit prediction
  - Salary compatibility
- **Daily Recommendations**: Fresh personalized job picks every day
- **"Why This Job?"** expandable explanation for each recommendation

#### 7.2 Skills Gap Analysis Widget
- **Current Skills vs. Required Skills**: Visual comparison chart
- **Recommended Skills to Learn**: Based on target job roles
- **Learning Resources**: Direct links to courses, tutorials (Coursera, Udemy, YouTube, etc.)
- **Skill Priority Matrix**: Most impactful skills to acquire first
- **Progress Tracking**: Track skill development over time

#### 7.3 Career Path Visualization
- **Interactive Career Map**: Visual timeline showing potential career progressions
- **Current Position Marker**: Where the user stands now
- **Potential Future Roles**: Based on skills and experience
- **Requirements for Each Step**: Skills, experience, certifications needed
- **Estimated Timeline**: How long each transition might take
- **Alternative Paths**: Multiple career trajectory options

#### 7.4 Resume/CV Optimizer
- **AI Resume Score**: Out of 100 with improvement suggestions
- **Keyword Optimization**: Missing keywords for target roles
- **ATS Compatibility Check**: Ensure resume passes applicant tracking systems
- **Section-by-Section Feedback**: Detailed improvement tips
- **Before/After Preview**: Show impact of suggested changes

#### 7.5 Cover Letter Generator
- **Template Selection**: Multiple professional templates
- **AI Draft Generation**: Based on job description and user profile
- **Customization Editor**: Edit and personalize generated content
- **Tone Selector**: Formal, Professional, Creative, Enthusiastic
- **Save Templates**: Save favorite cover letters for reuse

#### 7.6 Salary Insights Dashboard
- **Market Rate Analysis**: Compare expected salary to market data
- **Location Adjustments**: How salary varies by location
- **Experience-Based Projections**: Expected salary progression
- **Negotiation Tips**: AI-generated negotiation talking points
- **Company Salary Ranges**: Known salary ranges for specific companies (if available)

---

## 🎬 NEW SECTION: Video Introduction Feature

### 8. Video Introduction Page (NEW)

**Purpose**: Create compelling video introductions to stand out to employers

**Components**:

#### 8.1 Video Recording Studio
- **Built-in Camera/Microphone Access**: Native browser recording
- **Recording Timer**: Recommended 30-90 seconds
- **Teleprompter Mode**: Display prepared script while recording
- **Background Options**:
  - Blur background
  - Virtual backgrounds (professional settings)
  - No modification
- **Recording Tips Overlay**: Guidance on eye contact, lighting, audio

#### 8.2 Video Management
- **Video Library**: All recorded videos with thumbnails
- **Preview and Playback**: Watch before publishing
- **Edit Options**:
  - Trim start/end
  - Add captions/subtitles
  - Adjust brightness/contrast
- **Set Primary Video**: Default video for applications
- **Video Analytics**: Views, completion rate, employer engagement

#### 8.3 Sharing Options
- **Attach to Applications**: Include video with specific job applications
- **Profile Featured Video**: Display on public profile
- **Direct Link Sharing**: Generate shareable link
- **Privacy Controls**: Who can view (Public, Recruiters Only, Private)

---

## 👥 NEW SECTION: Networking & Community Features

### 9. Network Page (NEW)

**Purpose**: Build professional connections and find mentors

**Components**:

#### 9.1 Connections Dashboard
- **My Connections**: List of connected professionals
- **Pending Requests**: Incoming and outgoing connection requests
- **Suggested Connections**: AI-recommended based on industry, skills, location
- **Connection Strength Indicator**: Active, Occasional, Dormant

#### 9.2 Mentorship Program
- **Find a Mentor**: Browse available mentors filtered by expertise
- **Become a Mentor**: Option to offer mentorship to others
- **Mentorship Requests**: Track requests sent/received
- **Meeting Scheduler**: Built-in scheduling for mentorship sessions
- **Mentor Profiles**: Expertise areas, availability, bio

#### 9.3 Community Feed
- **Industry News**: Curated articles relevant to user's field
- **Success Stories**: Candidates who landed jobs (inspiration content)
- **Tips & Advice**: Career advice from professionals
- **Discussion Threads**: Engage with community on topics
- **Polls & Surveys**: Participate in industry surveys

#### 9.4 Messaging System
- **Direct Messages**: Private conversations with connections
- **Message Templates**: Quick response templates
- **Read Receipts**: Know when messages are read
- **File Sharing**: Share documents, portfolios within messages
- **Search Messages**: Find past conversations

---

## 📊 NEW SECTION: Analytics Dashboard

### 10. Analytics Page (NEW)

**Purpose**: Understand application performance and profile visibility

**Components**:

#### 10.1 Application Analytics
- **Application Funnel Visualization**:
  - Total applications → Viewed by employer → Shortlisted → Interview → Offer
- **Weekly/Monthly Application Trends**: Line chart of applications over time
- **Average Response Time**: How long companies take to respond
- **Best Performing Applications**: Which applications got furthest
- **Industry Breakdown**: Applications by industry pie chart

#### 10.2 Profile Analytics
- **Profile Views Over Time**: Line graph showing visitor trends
- **Who Viewed Profile**: Anonymized company/industry data
- **Search Appearances**: How often profile appears in recruiter searches
- **Top Keywords**: What search terms led to profile discovery
- **Profile Engagement Rate**: Actions taken after viewing

#### 10.3 Skills Analytics
- **Most In-Demand Skills**: Skills employers search for in your field
- **Your Skills vs. Market Demand**: Gap analysis chart
- **Trending Skills**: Skills gaining popularity
- **Skill Comparison**: How your skills compare to successful candidates

#### 10.4 Goal Tracking
- **Set Goals**: Weekly application targets, interviews, connections
- **Progress Visualization**: Progress bars and completion percentages
- **Streaks**: Consecutive days of activity (gamification element)
- **Milestone Celebrations**: Confetti animation when goals are met

---

## 🎓 NEW SECTION: Interview Preparation Hub

### 11. Interview Prep Page (NEW)

**Purpose**: Prepare candidates for successful interviews

**Components**:

#### 11.1 Practice Interview Mode
- **Question Bank**: Common interview questions by role/industry
- **Video Practice**: Record yourself answering questions
- **AI Feedback**: Analysis of recorded answers (keywords, clarity, confidence)
- **Timer Mode**: Practice with time constraints
- **Company-Specific Prep**: Known interview questions from specific companies

#### 11.2 Interview Resources Library
- **Interview Guides**: By role and experience level
- **Video Tutorials**: Body language, virtual interview tips, STAR method
- **Checklists**: Pre-interview preparation checklists
- **Salary Negotiation Scripts**: Templates for negotiation conversations
- **Thank You Note Templates**: Post-interview follow-up templates

#### 11.3 Mock Interview Scheduling
- **Book with Mentor**: Schedule mock interviews with connections/mentors
- **AI Mock Interview**: Automated interview simulation with AI
- **Feedback History**: Past mock interview performance records
- **Progress Tracking**: Improvement over multiple sessions

#### 11.4 Company Research Cards
- **Company Quick Facts**: For upcoming interviews
- **Recent News**: Latest company updates
- **Glassdoor Integration**: Employee reviews summary
- **Questions to Ask**: Suggested questions for the interviewer
- **Custom Notes**: User's own research notes

---

## 🏆 NEW SECTION: Gamification & Achievements

### 12. Achievements Page (NEW)

**Purpose**: Motivate engagement through gamification

**Components**:

#### 12.1 Achievement Badges Gallery
- **Profile Badges**:
  - Profile Pioneer: Complete 50% of profile
  - Profile Pro: Complete 100% of profile
  - Verified Identity: Email/phone verified
  - LinkedUp: Connect LinkedIn account
- **Application Badges**:
  - First Step: Submit first application
  - Active Seeker: 10 applications submitted
  - Persistent: 50 applications submitted
  - Quick Draw: Apply within 1 hour of job posting
- **Networking Badges**:
  - Social Butterfly: 10 connections
  - Community Leader: 50 connections
  - Mentor Achievement: Become a mentor
- **Skill Badges**:
  - Skill Builder: Add 5 skills
  - Polyglot: 3+ languages added
  - Certified: Upload 3 certificates
- **Interview Badges**:
  - Interview Ready: Complete 5 practice interviews
  - Interview Master: 10 successful interviews
- **Engagement Badges**:
  - Daily Visitor: 7-day login streak
  - Weekly Warrior: Active every day for 30 days
  - Early Adopter: Account created in first month

#### 12.2 Progress Levels
- **Level System**: XP-based progression (Level 1-100)
- **XP Earning Activities**:
  - Complete profile section: +50 XP
  - Submit application: +10 XP
  - Get interview: +100 XP
  - Make connection: +25 XP
  - Daily login: +5 XP
- **Level Rewards**: Unlock features or cosmetic items at certain levels
- **Leaderboard**: Optional ranking among connections (privacy respected)

#### 12.3 Weekly Challenges
- **Challenge Cards**: New challenges each week
  - "Apply to 3 jobs in a new industry"
  - "Connect with 2 professionals"
  - "Complete a mock interview"
- **Rewards**: Bonus XP, special badges
- **Challenge History**: Past challenges and completion status

#### 12.4 Streak Tracking
- **Current Streak**: Days of consecutive activity
- **Longest Streak**: Personal record
- **Streak Rewards**: Special badges for milestone streaks (7, 30, 100 days)
- **Streak Saver**: One mulligan per week to preserve streak

---

## ❓ NEW SECTION: Help & Support Center

### 13. Help & Support Page (NEW)

**Purpose**: Provide self-service support and assistance

**Components**:

#### 13.1 FAQ Accordion
- **Categorized Questions**: Account, Applications, Profile, Technical Issues
- **Search FAQs**: Find answers quickly
- **Most Common Questions**: Featured at top
- **Was This Helpful?**: Feedback buttons on each answer

#### 13.2 Interactive Tutorials
- **Onboarding Tour**: Replayable guided tour of the dashboard
- **Feature Tutorials**: Short videos/animations for each feature
- **Step-by-Step Guides**: Text-based walkthroughs
- **Progress Tracking**: Mark tutorials as completed

#### 13.3 Contact Support
- **Live Chat Widget**: Real-time support (if available)
- **Support Ticket Form**: Submit detailed issues
- **Email Support**: Direct email option
- **Estimated Response Time**: Set expectations

#### 13.4 Community Help
- **Community Forum Link**: Access to user community discussions
- **Popular Discussions**: Top community threads
- **Ask the Community**: Post questions for peer support

#### 13.5 Status Page
- **System Status Indicator**: Current platform health
- **Scheduled Maintenance**: Upcoming maintenance windows
- **Incident History**: Past issues and resolutions

---

## 🔧 STANDARD APP FUNCTIONALITIES

### Global Search & Command Palette

**Quick Access Search** (Accessible via `Ctrl/Cmd + K`):
- **Universal Search Bar**: Search across jobs, companies, messages, settings
- **Recent Searches**: Quick access to past queries
- **Quick Actions**: Navigate to pages, toggle settings, start new application
- **Fuzzy Matching**: Find items even with typos
- **Keyboard Navigation**: Navigate results with arrow keys

### Onboarding & Feature Discovery

**First-Time User Experience**:
- **Welcome Modal**: Brief introduction after first login
- **Interactive Tour**: Highlight key features with tooltips
- **Progressive Disclosure**: Introduce features gradually
- **Skip/Resume Option**: User control over onboarding pace
- **Completion Reward**: Badge for completing onboarding

**Feature Announcements**:
- **What's New Modal**: Show new features after updates
- **Feature Spotlight**: Subtle highlight on new features
- **Changelog Link**: Access to full update history

### Data Management

**Export Capabilities**:
- **Export Profile as PDF**: Generate resume/CV from profile
- **Export Application History**: CSV download of all applications
- **Export Analytics Data**: Download insights data
- **Export Portfolio**: Download portfolio as PDF/ZIP

**Import Capabilities**:
- **Import from LinkedIn**: Sync profile data
- **Import Resume**: Parse PDF/DOCX to auto-fill profile
- **Bulk Upload**: Import multiple certificates/documents

### Activity & Audit Log

**Activity History Page**:
- **All Actions Log**: Chronological list of user actions
- **Filter by Type**: Applications, Profile Updates, Settings Changes
- **Undo Actions**: Restore recent changes where possible
- **Export Activity Log**: Download for personal records

### Real-Time Features

**Live Updates**:
- **Real-Time Notifications**: Instant notification delivery
- **Live Application Status**: Status changes reflected immediately
- **Presence Indicators**: Show if recruiters are online (if applicable)
- **Auto-Refresh**: Lists update without manual refresh

**Offline Support**:
- **Offline Indicator**: Clear banner when offline
- **Cached Content**: View previously loaded jobs/profile offline
- **Queue Actions**: Applications queue when offline, send when back online
- **Sync Status**: Show pending sync items

### Accessibility & Customization

**Accessibility Features**:
- **Screen Reader Support**: Full ARIA labels
- **Keyboard Navigation**: Complete keyboard accessibility
- **Focus Indicators**: Clear focus states
- **High Contrast Mode**: Optional enhanced contrast
- **Reduced Motion**: Option to disable animations
- **Font Size Adjustment**: Increase/decrease text size

### Security Features

**Enhanced Security**:
- **Login Alerts**: Email notification on new device login
- **Session Management**: View/revoke active sessions
- **Password Strength Meter**: Visual feedback when setting passwords
- **Security Audit**: "Security Checkup" feature showing account health
- **Inactivity Timeout**: Auto logout after period of inactivity (configurable)

---

## 🎭 UI Component Patterns

### Card Component
```
┌─────────────────────────────────────┐
│ ┌─────┐                             │
│ │ Icon│  Title              Action  │
│ └─────┘  Subtitle/Meta              │
│─────────────────────────────────────│
│                                     │
│  Content Area                       │
│                                     │
│─────────────────────────────────────│
│  Footer Actions                     │
└─────────────────────────────────────┘
```

### AI Feature Card (NEW)
```
┌─────────────────────────────────────┐
│ ✨ AI-Powered              Badge    │
│─────────────────────────────────────│
│ ┌─────────────────────────────────┐ │
│ │  Main Insight/Recommendation    │ │
│ │  with explanation               │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Learn More]  [Apply] [Dismiss]     │
└─────────────────────────────────────┘
```

### Score/Rating Component (NEW)
```
┌──────────────────────────┐
│    ┌───────────┐         │
│    │    85     │  Match  │
│    │   /100    │  Score  │
│    └───────────┘         │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░       │
│  Skills • Experience     │
└──────────────────────────┘
```

### Tag/Badge Component
- Pill shaped (border-radius: 999px)
- Colored left border for category indication
- Small font (0.75-0.875rem)
- Remove button (X) for editable tags

### Progress Bar
- Full width with rounded ends
- Purple gradient fill: `linear-gradient(to right, #8b5cf6, #7c3aed)`
- Height: 0.5rem for main progress, 0.375rem for smaller indicators

### Empty State
- Centered container
- Large muted icon (2-3rem)
- Descriptive text in secondary color
- Call-to-action button if applicable

### Modal/Dialog
- Centered overlay with backdrop blur
- Card-style container
- Header with title and close button
- Body content
- Footer with action buttons

### Achievement Badge Component (NEW)
```
┌──────────────────────────┐
│      🏆                  │
│   Badge Name             │
│   Description text       │
│   ───────────────        │
│   Earned: Jan 15, 2026   │
└──────────────────────────┘
```

### Video Card Component (NEW)
```
┌──────────────────────────┐
│  ┌────────────────────┐  │
│  │       ▶️           │  │
│  │    Video           │  │
│  │    Thumbnail       │  │
│  └────────────────────┘  │
│  Title          Duration │
│  Recorded date           │
│  [Edit] [Share] [Delete] │
└──────────────────────────┘
```

---

## 📱 Mobile Considerations

### Bottom Navigation (Mobile)
- Fixed at bottom of screen
- 5 main items: Jobs, Companies, Submissions, Profile, Menu (for Settings/Notifications)
- Active state with purple accent
- Notification badge on relevant items

### Touch Targets
- Minimum 44x44px for interactive elements
- Adequate spacing between tappable elements

### Gestures
- Swipe to delete/archive notifications
- Pull to refresh on lists
- **Swipe left/right on job cards** to save/dismiss
- **Long press** for quick actions context menu

### Mobile-Specific Features
- **Quick Apply**: Streamlined one-tap application flow
- **Save for Later**: Offline-friendly job saving
- **Push Notifications**: Native mobile push support
- **Camera Integration**: Easy photo/video capture for profile

---

## ✨ Animations & Transitions

### Micro-interactions
- Button hover lift: `transform: translateY(-2px)`
- Card hover: Subtle shadow enhancement
- Page transitions: Fade in/slide
- Progress bar: Smooth width transition (0.4s ease)
- Icon rotations (settings gear, loading spinners)
- **Confetti animation**: For achievements and milestones
- **Pulse animation**: For notifications and alerts
- **Shimmer effect**: AI features "thinking" state
- **Count-up animation**: For stats and scores

### Loading States
- Skeleton screens matching content layout
- Spinner with purple color
- Shimmer effect on loading cards
- **AI Thinking State**: Animated brain/sparkle icon
- **Progress Percentage**: For long operations

### Success/Celebration States
- **Checkmark Animation**: On successful actions
- **Confetti Burst**: Achievement unlocked, milestone reached
- **Level Up Animation**: XP threshold reached
- **Streak Flame Animation**: Streak milestones

---

## 🔔 Additional Design Notes

1. **Consistency**: Every element must feel like it belongs in the same design system
2. **Accessibility**: Sufficient color contrast, focus indicators, ARIA labels
3. **Dark Mode**: Every component must work equally well in both light and dark themes
4. **Whitespace**: Generous padding within cards (1.5-2rem) and between sections
5. **Hierarchy**: Clear visual hierarchy through size, weight, and color
6. **Feedback**: All interactive elements should have visible state changes
7. **AI Transparency**: Always explain why AI made certain recommendations
8. **Privacy First**: Clear privacy controls for all features
9. **Progressive Complexity**: Simple by default, advanced features discoverable
10. **Celebration**: Acknowledge user achievements and progress

---

## 📐 Expected Deliverables

1. **Main Dashboard Overview** (Jobs page as home)
2. **Company Listing Page**
3. **My Submissions/Applications Page**
4. **AI Assistant Hub Page**
5. **Profile Page** with all sections including Portfolio
6. **Video Introduction Page**
7. **Network/Community Page**
8. **Analytics Dashboard Page**
9. **Interview Preparation Page**
10. **Achievements Page**
11. **Notifications Page**
12. **Settings Page** with all subsections
13. **Help & Support Page**
14. **Responsive Mobile Views** for key pages
15. **Component Library Sheet** (buttons, cards, inputs, badges, etc.)
16. **Onboarding Flow Mockups**
17. **Empty States & Error States**
18. **Animation/Interaction Specifications**

---

## 🎯 Design Priority

1. Maintain strict consistency with existing theme
2. Professional, modern, and trustworthy feel
3. Intuitive navigation and clear information hierarchy
4. Delightful micro-interactions and polish
5. Mobile-first responsiveness
6. **AI features that genuinely help, not gimmicks**
7. **Gamification that motivates without being childish**
8. **Privacy-respecting community features**
9. **Accessibility as a first-class consideration**
10. **Performance and smooth experience on all devices**

---

## 🌟 Competitive Differentiators Summary

This dashboard stands out from typical job platforms through:

| Feature | Why It's Special |
|---------|------------------|
| **AI Match Scores** | Candidates immediately see how well they match, saving time and targeting efforts |
| **Video Introductions** | Personal touch that helps candidates stand out beyond text resumes |
| **Career Path Visualization** | Interactive journey mapping that provides career direction and motivation |
| **Skills Gap Analysis** | Actionable insights with learning resources, not just identification of gaps |
| **Gamification System** | Makes job hunting engaging rather than demoralizing |
| **Interview Prep Hub** | All-in-one preparation center with AI feedback |
| **Application Analytics** | Data-driven insights into what's working and what's not |
| **Mentorship Network** | Community-driven career development beyond just job listings |
| **Portfolio Showcase** | True showcase of work, not just a resume bullet point |
| **Salary Insights** | Transparency and negotiation confidence |

---

*This dashboard will be the primary interface for job candidates to manage their professional profile and job search journey. The design should inspire confidence and make the job hunting process feel organized, achievable, and even enjoyable. With AI-powered insights, gamification elements, video capabilities, and a supportive community, this platform transforms from a simple job board into a comprehensive career development companion.*
