import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import HRSidebar from '../components/HRSidebar'
import './Calendar.css'

function Calendar() {
    const { effectiveTheme } = useTheme()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    return (
        <div className={`calendar ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            {/* Sidebar */}
            <HRSidebar />

            {/* Main Content */}
            <main className="calendar-main">
                {/* Mobile Header */}
                <div className="calendar-mobile-header">
                    <div className="mobile-header-content">
                        <div className="mobile-header-logo"></div>
                        <h1 className="mobile-header-title">Humatiq</h1>
                    </div>
                    <button
                        className="mobile-menu-btn"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                </div>

                {/* Page Header */}
                <div className="page-header">
                    <div className="page-title-group">
                        <h2 className="page-title">Calendar Management</h2>
                        <span className="sync-badge">Sync Active</span>
                    </div>
                </div>

                {/* Two Column Layout */}
                <div className="calendar-layout">
                    {/* LEFT PANEL: Large Calendar View */}
                    <div className="calendar-left-panel">
                        <div className="calendar-card">
                            <div className="calendar-card-header">
                                <div>
                                    <h3 className="calendar-month">March 2024</h3>
                                    <p className="calendar-subtitle">Architecture & Engineering Vertical</p>
                                </div>
                                <div className="calendar-nav">
                                    <button className="cal-nav-btn">
                                        <span className="material-symbols-outlined">chevron_left</span>
                                    </button>
                                    <button className="cal-today-btn">Today</button>
                                    <button className="cal-nav-btn">
                                        <span className="material-symbols-outlined">chevron_right</span>
                                    </button>
                                </div>
                            </div>

                            {/* Calendar Header */}
                            <div className="calendar-header-grid">
                                <div className="tz-label">GMT-5</div>
                                <div className="day-header"><span className="day-name">Mon</span><span className="day-number">11</span></div>
                                <div className="day-header"><span className="day-name">Tue</span><span className="day-number">12</span></div>
                                <div className="day-header active"><span className="day-name">Wed</span><span className="day-number">13</span></div>
                                <div className="day-header"><span className="day-name">Thu</span><span className="day-number">14</span></div>
                                <div className="day-header"><span className="day-name">Fri</span><span className="day-number">15</span></div>
                            </div>

                            {/* Calendar Rows (Time slots) */}
                            <div className="calendar-body">
                                {/* 09:00 Row */}
                                <div className="time-row">
                                    <div className="time-label">09:00 AM</div>
                                    <div className="slot"><div className="slot-empty"><span className="slot-available">Available</span></div></div>
                                    <div className="slot">
                                        <div className="slot-event">
                                            <p className="event-time">09:00 - 10:00</p>
                                            <p className="event-title">Julian Vane (Senior Arch)</p>
                                        </div>
                                    </div>
                                    <div className="slot"></div>
                                    <div className="slot"><div className="slot-empty"></div></div>
                                    <div className="slot"></div>
                                </div>

                                {/* 10:00 Row */}
                                <div className="time-row">
                                    <div className="time-label">10:00 AM</div>
                                    <div className="slot"></div>
                                    <div className="slot">
                                        <div className="slot-pending">
                                            <p className="event-time" style={{color: 'var(--color-amber-700)'}}>Pending</p>
                                            <p className="event-title" style={{color: 'var(--color-text-main)'}}>Sarah Chen</p>
                                        </div>
                                    </div>
                                    <div className="slot"><div className="slot-empty"></div></div>
                                    <div className="slot"></div>
                                    <div className="slot">
                                        <div className="slot-event" style={{marginTop: '40px'}} /* simulate 10:30 */>
                                            <p className="event-time">10:30 - 11:30</p>
                                            <p className="event-title">Tech Interview #4</p>
                                        </div>
                                    </div>
                                </div>

                                {/* 11:00 Row */}
                                <div className="time-row">
                                    <div className="time-label">11:00 AM</div>
                                    <div className="slot"><div className="slot-empty"><span className="slot-available">Available</span></div></div>
                                    <div className="slot"></div>
                                    <div className="slot">
                                        <div className="slot-event">
                                            <p className="event-time">11:00 - 12:00</p>
                                            <p className="event-title">Final Selection: Board</p>
                                        </div>
                                    </div>
                                    <div className="slot"><div className="slot-empty"></div></div>
                                    <div className="slot"></div>
                                </div>
                            </div>
                        </div>

                        {/* BOTTOM SECTION: Upcoming Interviews */}
                        <div className="upcoming-section">
                            <div className="upcoming-header">
                                <h3 className="upcoming-title">Confirmed Interviews</h3>
                                <button className="view-all-btn">View All Schedule</button>
                            </div>

                            <div className="interview-list">
                                {/* List Item 1 */}
                                <div className="interview-item">
                                    <div className="candidate-info">
                                        <div className="avatar jv">JV</div>
                                        <div>
                                            <p className="candidate-name">Julian Vane</p>
                                            <p className="interview-details">Technical Interview • Today, 09:00 AM</p>
                                        </div>
                                    </div>
                                    <div className="interview-actions">
                                        <span className="status-badge status-confirmed">Confirmed</span>
                                        <button className="btn-join">
                                            <span className="material-symbols-outlined">video_call</span>
                                            Join Interview
                                        </button>
                                    </div>
                                </div>

                                {/* List Item 2 */}
                                <div className="interview-item">
                                    <div className="candidate-info">
                                        <div className="avatar mb">MB</div>
                                        <div>
                                            <p className="candidate-name">Marcus Broady</p>
                                            <p className="interview-details">Final Round • Tomorrow, 02:30 PM</p>
                                        </div>
                                    </div>
                                    <div className="interview-actions">
                                        <span className="status-badge status-pending">Pending</span>
                                        <button className="btn-reschedule">
                                            Reschedule
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL: Configuration & Sending */}
                    <div className="calendar-right-panel">
                        <div className="quick-form-card">
                            <div className="card-glow"></div>
                            <div className="card-content">
                                <div className="card-header-flex">
                                    <span className="material-symbols-outlined card-icon">send_time_extension</span>
                                    <h3 className="card-header-title">Quick Availability</h3>
                                </div>
                                <p className="card-desc">Select slots on the calendar and send an invite link to the candidate instantly.</p>

                                <form className="quick-form" onSubmit={(e) => e.preventDefault()}>
                                    <div className="form-group">
                                        <label className="form-label">Candidate Name</label>
                                        <input className="form-input" placeholder="e.g. Helena Troy" type="text" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email Address</label>
                                        <input className="form-input" placeholder="helena.t@design.co" type="email" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Interview Type</label>
                                        <select className="form-select">
                                            <option>Technical Assessment</option>
                                            <option>HR Screening</option>
                                            <option>Final Portfolio Review</option>
                                            <option>Cultural Fit</option>
                                        </select>
                                    </div>
                                    <div className="form-actions">
                                        <button className="btn-send">
                                            <span className="material-symbols-outlined">forward_to_inbox</span>
                                            Send Availability
                                        </button>
                                        <p className="form-hint">Candidate will receive a magic link</p>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* MINI STATS/INFO CARD */}
                        <div className="stats-mini-card">
                            <h4 className="stats-header-title">Capacity Overview</h4>
                            
                            <div className="stats-stack">
                                <div className="stat-row">
                                    <div>
                                        <p className="stat-val">12</p>
                                        <p className="stat-label">Interviews this week</p>
                                    </div>
                                    <div className="progress-bar">
                                        <div className="progress-fill"></div>
                                    </div>
                                </div>

                                <div className="stat-row">
                                    <div>
                                        <p className="stat-val">84%</p>
                                        <p className="stat-label">Attendance Rate</p>
                                    </div>
                                    <span className="material-symbols-outlined stat-icon">trending_up</span>
                                </div>
                            </div>

                            <div className="sync-info">
                                <div className="sync-box">
                                    <span className="material-symbols-outlined sync-icon">info</span>
                                    <p className="sync-text">Syncing with <strong>Google Calendar</strong> and Outlook 365.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default Calendar
