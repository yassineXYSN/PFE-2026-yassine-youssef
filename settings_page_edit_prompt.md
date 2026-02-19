# Settings Page Redesign Prompt

## 📝 Edit Request Overview

This prompt instructs you to **modify the existing Settings page** in the Candidate Dashboard. The current Settings page needs to be restructured into a cleaner, more organized layout with three distinct sections accessible via a simple tab/header navigation.

---

## 🎯 What to Change

### Current State
The Settings page currently has multiple sections displayed vertically on one page (Account Settings, Theme Settings, Language Settings, Keyboard Shortcuts, Notification Preferences).

### Desired State
Restructure the Settings page into **3 main tabs/sections** with a simple header navigation bar at the top allowing users to switch between them:

```
┌─────────────────────────────────────────────────────────────┐
│                      ⚙️ Settings                            │
├─────────────────────────────────────────────────────────────┤
│   [ General ]    [ Notifications ]    [ Security ]         │
│       ↑ Active tab indicator (purple underline/highlight)   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              Content changes based on selected tab          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Section 1: General Settings

**Tab Label**: General  
**Icon**: `fa-sliders-h` or `fa-cog`

This section contains everyday preferences the user might frequently adjust.

### 1.1 Theme Preference Card
- **Section Title**: "Appearance"
- **Three-Option Selector** (radio buttons or segmented control):
  | Option | Icon | Description |
  |--------|------|-------------|
  | System | `fa-desktop` | Follows operating system preference |
  | Light | `fa-sun` | Always use light theme |
  | Dark | `fa-moon` | Always use dark theme |
- **Visual Preview**: Small preview thumbnails showing how each theme looks
- **Currently Active**: Highlighted with purple border/accent and checkmark

### 1.2 Language Preference Card
- **Section Title**: "Language"
- **Dropdown/Select Input** with:
  - Flag icon next to each language option (optional but recommended)
  - Currently supported: English 🇬🇧, French 🇫🇷
  - Placeholder for future languages with "Coming soon" tooltip
- **Description Text**: "Choose the language for the interface. Some content from employers may remain in original language."

### 1.3 Currency Preference Card (NEW)
- **Section Title**: "Currency"
- **Dropdown/Select Input** with:
  | Currency | Symbol | Label |
  |----------|--------|-------|
  | USD | $ | US Dollar |
  | EUR | € | Euro |
  | GBP | £ | British Pound |
  | MAD | د.م. | Moroccan Dirham |
  | CAD | $ | Canadian Dollar |
  | AUD | $ | Australian Dollar |
  | CHF | Fr | Swiss Franc |
  | JPY | ¥ | Japanese Yen |
- **Description Text**: "Salary ranges and compensation will be displayed in your preferred currency. Conversions are approximate."
- **Auto-Detect Option**: "Use browser/location default" toggle

### 1.4 Regional Settings Card (Optional Enhancement)
- **Section Title**: "Regional"
- **Date Format Selector**:
  - DD/MM/YYYY (European)
  - MM/DD/YYYY (US)
  - YYYY-MM-DD (ISO)
- **Time Format Toggle**:
  - 12-hour (AM/PM)
  - 24-hour

---

## 📋 Section 2: Notifications Settings

**Tab Label**: Notifications  
**Icon**: `fa-bell`

This section gives users granular control over what notifications they receive and how.

### 2.1 Notification Channels Card
- **Section Title**: "How to Reach You"
- **Toggle Switches** for each channel:
  | Channel | Description | Default |
  |---------|-------------|---------|
  | **Push Notifications** | Browser/app push notifications | ON |
  | **Email Notifications** | Updates sent to your email | ON |
  | **SMS Notifications** | Text messages (if phone verified) | OFF |

### 2.2 Email Frequency Card
- **Section Title**: "Email Digest Frequency"
- **Radio Button Options**:
  | Option | Description |
  |--------|-------------|
  | Real-time | Receive emails as events happen |
  | Daily Digest | One summary email per day at 9 AM |
  | Weekly Summary | One summary email every Monday |
  | Never | No email notifications (not recommended) |
- **Preview Schedule**: Show example of when emails would arrive

### 2.3 Notification Categories Card
- **Section Title**: "What to Notify You About"
- **Category-Based Toggles**:

  #### Application Updates
  | Notification Type | Description | Default |
  |-------------------|-------------|---------|
  | Application Viewed | When employer views your application | ON |
  | Status Change | When application status updates | ON |
  | Interview Invite | When invited to interview | ON |
  | Offer Received | When you receive a job offer | ON |
  | Application Rejected | When application is declined | ON |

  #### Job Alerts
  | Notification Type | Description | Default |
  |-------------------|-------------|---------|
  | New Job Matches | Jobs matching your preferences | ON |
  | Saved Job Updates | Changes to saved jobs | ON |
  | Application Deadline | Reminders before deadlines | ON |
  | Company Updates | News from followed companies | OFF |

  #### Network & Community
  | Notification Type | Description | Default |
  |-------------------|-------------|---------|
  | Connection Requests | When someone wants to connect | ON |
  | Messages | New direct messages | ON |
  | Skill Endorsements | When skills are endorsed | ON |
  | Mentor Requests | Mentorship-related notifications | ON |

  #### Achievements & Progress
  | Notification Type | Description | Default |
  |-------------------|-------------|---------|
  | Badge Earned | When you unlock achievements | ON |
  | Level Up | When you reach new levels | ON |
  | Streak Reminders | Don't break your streak alerts | ON |
  | Weekly Progress | Summary of weekly activity | ON |

  #### System
  | Notification Type | Description | Default |
  |-------------------|-------------|---------|
  | Security Alerts | Important account security events | ON (locked) |
  | Product Updates | New features and improvements | ON |
  | Tips & Suggestions | Personalized improvement tips | ON |
  | Surveys & Feedback | Requests for your feedback | OFF |

### 2.4 Quiet Hours Card
- **Section Title**: "Do Not Disturb"
- **Enable Toggle**: Turn quiet hours on/off
- **Time Range Picker**: 
  - Start time (default: 10:00 PM)
  - End time (default: 8:00 AM)
- **Days Selector**: Checkboxes for which days quiet hours apply
- **Description Text**: "During quiet hours, you'll still receive notifications but they won't make sounds or appear as pop-ups."

### 2.5 Notification Preview Card
- **Section Title**: "Preview"
- **Test Notification Button**: "Send Test Notification" - sends a sample notification to verify settings
- **Recent Notifications Link**: Quick access to view notification history

---

## 📋 Section 3: Security Settings

**Tab Label**: Security  
**Icon**: `fa-shield-alt`

This section handles all security, privacy, and account protection settings.

### 3.1 Account Credentials Card
- **Section Title**: "Login Credentials"
- **Email Address Display**:
  - Current email shown (partially masked: y***e@gmail.com)
  - Verified badge ✓ (green) or "Verify" button (amber)
  - "Change Email" button
- **Password Section**:
  - Last changed: "6 months ago" (or similar relative time)
  - Password strength indicator if recently set
  - "Change Password" button (opens modal)
- **Phone Number** (optional):
  - Add/change phone number
  - Verification status
  - Used for SMS notifications and 2FA

### 3.2 Two-Factor Authentication Card
- **Section Title**: "Two-Factor Authentication (2FA)"
- **Enable/Disable Toggle** (prominent)
- **2FA Methods** (when enabled):
  | Method | Status | Action |
  |--------|--------|--------|
  | Authenticator App | Recommended | Setup/Configure |
  | SMS Verification | Available | Setup/Configure |
  | Email Code | Backup | Always enabled when 2FA is on |
- **Backup Codes Section**:
  - "Generate Backup Codes" button
  - Warning: "Store these in a safe place. Each code can only be used once."
  - Show remaining backup codes count
- **Trusted Devices List**:
  - List of devices that skip 2FA
  - Device name, last used, location
  - "Remove" button for each

### 3.3 Active Sessions Card
- **Section Title**: "Active Sessions"
- **Current Session** (highlighted):
  - Device/browser info
  - Location (city, country)
  - "This device" indicator
- **Other Sessions List**:
  | Info | Details |
  |------|---------|
  | Device | Browser + OS (e.g., "Chrome on Windows") |
  | Location | City, Country |
  | Last Active | Relative time |
  | IP Address | Partially masked |
  | Action | "Revoke" button |
- **"Sign Out All Other Sessions"** button (danger style)

### 3.4 Privacy Settings Card
- **Section Title**: "Privacy Controls"
- **Profile Visibility Toggle**:
  | Option | Description |
  |--------|-------------|
  | Public | Anyone can see your profile |
  | Recruiters Only | Only verified recruiters |
  | Connections Only | Only your connections |
  | Private | Profile hidden from search |
- **Additional Privacy Toggles**:
  | Setting | Description | Default |
  |---------|-------------|---------|
  | Show Email to Employers | Display email on applications | OFF |
  | Show Phone to Employers | Display phone on applications | OFF |
  | Appear in Search Results | Allow recruiters to find you | ON |
  | Show Online Status | Others can see when you're active | ON |
  | Show Profile Views | Notify you when profile is viewed | ON |
  | Anonymous Browsing | Browse jobs without leaving traces | OFF |

### 3.5 Connected Accounts Card
- **Section Title**: "Connected Accounts"
- **OAuth Connections**:
  | Service | Status | Actions |
  |---------|--------|---------|
  | Google | Connected as xyz@gmail.com | Disconnect |
  | LinkedIn | Not connected | Connect |
  | GitHub | Not connected | Connect |
- **Benefits List**: "Why connect?" expandable section explaining benefits (easier login, profile import, etc.)
- **Data Sync Options**: What data is synced from connected accounts

### 3.6 Login History Card
- **Section Title**: "Recent Login Activity"
- **List of Recent Logins** (last 10-20):
  | Column | Info |
  |--------|------|
  | Date/Time | When login occurred |
  | Device | Browser + OS |
  | Location | City, Country |
  | Status | Success ✓ / Failed ✗ |
  | IP | Partially masked |
- **"Something suspicious?"** link: Opens report form
- **Download Full History** button: Export login history

### 3.7 Data & Account Card
- **Section Title**: "Your Data"
- **Export My Data** button:
  - Description: "Download a copy of all your data (profile, applications, messages)"
  - Format options: JSON, CSV
  - Estimated time: "Ready in 24 hours"
- **Delete Account** section:
  - Warning banner (red/danger styling)
  - Description: "Permanently delete your account and all associated data. This action cannot be undone."
  - "Delete My Account" button (danger style, requires confirmation modal)
  - Confirmation modal requires:
    - Type "DELETE" to confirm
    - Enter password
    - Optional: Reason for leaving dropdown

### 3.8 Security Checkup Card (Optional Enhancement)
- **Section Title**: "Security Score"
- **Visual Score Display**: Circular progress or score out of 100
- **Checklist of Security Items**:
  | Item | Status | Impact |
  |------|--------|--------|
  | Email Verified | ✓ / ✗ | High |
  | Strong Password | ✓ / ✗ | High |
  | 2FA Enabled | ✓ / ✗ | High |
  | Phone Added | ✓ / ✗ | Medium |
  | Backup Codes Generated | ✓ / ✗ | Medium |
  | Recent Password Change | ✓ / ✗ | Low |
- **"Improve Security"** button: Opens guided flow to address gaps

---

## 🎨 Visual Design Guidelines

### Tab Navigation Design
```css
/* Tab Container */
.settings-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 2rem;
}

/* Tab Button */
.settings-tab {
  padding: 1rem 1.5rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

/* Active Tab */
.settings-tab.active {
  color: var(--primary-purple);
}

.settings-tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--primary-purple);
  border-radius: 2px 2px 0 0;
}

/* Tab Hover */
.settings-tab:hover:not(.active) {
  color: var(--text-primary);
}
```

### Settings Card Design
- Each settings card should follow the existing card pattern
- Title with icon on the left
- Optional description text in muted color below title
- Content area with appropriate spacing
- Consistent padding: `1.5rem`

### Toggle Switch Design
- Use consistent toggle switches across all sections
- Purple accent when enabled
- Gray when disabled
- Smooth transition animation
- Clear labels on both sides or just left side

### Mobile Considerations
- Tabs should scroll horizontally on mobile or convert to a dropdown
- Cards stack vertically with full width
- Touch-friendly toggle sizes (minimum 44x44px tap targets)

---

## ⚠️ Important Implementation Notes

1. **State Persistence**: Remember which tab the user was on when they return to Settings
2. **Unsaved Changes Warning**: If user switches tabs with unsaved changes, show confirmation
3. **Auto-Save Option**: Consider auto-saving preferences without explicit save button
4. **Loading States**: Show skeleton loaders when fetching current settings
5. **Success Feedback**: Toast/notification when settings are saved successfully
6. **Error Handling**: Clear error messages if settings fail to save
7. **Accessibility**: Ensure keyboard navigation between tabs works correctly

---

## 🔄 Migration Notes

When implementing this change:
- Keep any existing functionality from the current settings page
- Move Account Settings content to the Security tab
- Move Theme Settings to General tab
- Move Language Settings to General tab
- Move Notification Preferences to Notifications tab
- Add the new Currency settings to General tab
- Keyboard Shortcuts can be a sub-section in General or its own collapsible section

---

*This redesign creates a cleaner, more intuitive Settings experience that scales well as more settings are added in the future. The three-tab organization follows common UX patterns and makes it easy for users to find what they're looking for.*
