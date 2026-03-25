import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import HRSidebar from '../components/HRSidebar'
import { supabase } from '../../../core/supabaseClient'
import { apiFetch } from '../../../core/api'
import './Calendar.css'

function Calendar() {
    const { effectiveTheme } = useTheme()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    // Data State
    const [interviews, setInterviews] = useState([])
    const [googleEvents, setGoogleEvents] = useState([])
    const [isGoogleConnected, setIsGoogleConnected] = useState(false)
    const [companyId, setCompanyId] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    // Calendar Grid State
    const [currentMonthDate, setCurrentMonthDate] = useState(new Date())

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formName, setFormName] = useState('')
    const [formEmail, setFormEmail] = useState('')
    const [formType, setFormType] = useState('Technical Assessment')
    
    // Default the form time to next hour rounded
    const defaultTime = new Date()
    defaultTime.setHours(defaultTime.getHours() + 1, 0, 0, 0)
    
    const formatForInput = (date) => {
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
    }
    const [formStartTime, setFormStartTime] = useState(formatForInput(defaultTime))

    // Expanded Day State (for "more" popover)
    const [expandedDay, setExpandedDay] = useState(null)

    useEffect(() => {
        const fetchAllData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            try {
                // Fetch HR Interviews
                const profile = await apiFetch(`/profiles/${user.id}`)
                if (profile?.company_id) {
                    setCompanyId(profile.company_id)
                    const data = await apiFetch(`/interviews/company/${profile.company_id}`)
                    setInterviews(data || [])
                }

                // Fetch Google Sync Status
                const syncStatus = await apiFetch('/auth/google/status')
                setIsGoogleConnected(syncStatus?.connected || false)

                // Fetch Google Events if connected
                if (syncStatus?.connected) {
                    const gEvents = await apiFetch('/auth/google/events')
                    setGoogleEvents(gEvents || [])
                }
            } catch (error) {
                console.error("Error fetching calendar data:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchAllData()
    }, [])

    const handleSchedule = async (e) => {
        e.preventDefault()
        if (!companyId || !formName || !formEmail || !formStartTime) return

        try {
            const start = new Date(formStartTime)
            const end = new Date(start)
            end.setHours(start.getHours() + 1)

            const payload = {
                company_id: companyId,
                candidate_name: formName,
                candidate_email: formEmail,
                type: formType,
                start_time: start.toISOString(),
                end_time: end.toISOString()
            }
            
            const newInterview = await apiFetch('/interviews', {
                method: 'POST',
                body: JSON.stringify(payload)
            })
            
            setInterviews([...interviews, newInterview])
            
            // Re-center on the new event's month
            setCurrentMonthDate(new Date(start))
            
            // Reset and close modal
            setFormName('')
            setFormEmail('')
            setIsModalOpen(false)
        } catch (err) {
            console.error('Failed to schedule interview:', err)
        }
    }

    // View Navigators
    const prevMonth = () => {
        const d = new Date(currentMonthDate)
        d.setMonth(d.getMonth() - 1)
        setCurrentMonthDate(d)
    }

    const nextMonth = () => {
        const d = new Date(currentMonthDate)
        d.setMonth(d.getMonth() + 1)
        setCurrentMonthDate(d)
    }

    const goToToday = () => {
        setCurrentMonthDate(new Date())
    }

    // Generate exactly 42 days (6 weeks) starting from the Monday before (or on) the 1st of the month
    const getMonthGridDays = (date) => {
        const year = date.getFullYear()
        const month = date.getMonth()
        const firstDayOfMonth = new Date(year, month, 1)
        const dayOfWeek = firstDayOfMonth.getDay() // Sun=0, Mon=1...
        // If it starts on Sunday, go back 6 days to Monday. Otherwise, go back dayOfWeek - 1 days.
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        const startDate = new Date(year, month, 1 + diffToMonday)
        
        const days = []
        for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
            const d = new Date(startDate)
            d.setDate(startDate.getDate() + i)
            days.push(d)
        }
        return days
    }
    
    const gridDays = getMonthGridDays(currentMonthDate)

    const formatEventTime = (isoString) => {
        const d = new Date(isoString)
        const h = d.getHours()
        const m = d.getMinutes().toString().padStart(2, '0')
        const ampm = h >= 12 ? 'PM' : 'AM'
        const h12 = h % 12 || 12
        return `${h12}:${m} ${ampm}`
    }

    // Assign pastel colors based on interview types (approximating image colors)
    const getEventColorClass = (type) => {
        if (type.includes('HR')) return 'event-pink'
        if (type.includes('Technical')) return 'event-blue'
        if (type.includes('Portfolio')) return 'event-green'
        if (type.includes('Cultural')) return 'event-orange'
        return 'event-gray'
    }

    // Get current month/year range label for header (e.g. "Jan 1, 2025 - Jan 31, 2025")
    const getMonthRangeLabel = () => {
        const year = currentMonthDate.getFullYear()
        const month = currentMonthDate.getMonth()
        const d1 = new Date(year, month, 1)
        const dLast = new Date(year, month + 1, 0)
        return `${d1.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})} - ${dLast.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`
    }

    return (
        <div className={`calendar ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            {/* Sidebar */}
            <HRSidebar />

            {/* Main Content Area */}
            <main className="calendar-main-full">
                
                {/* Mobile Hamburger Header */}
                <div className="calendar-mobile-header">
                    <div className="mobile-header-content">
                        <div className="mobile-header-logo"></div>
                        <h1 className="mobile-header-title">Calendar</h1>
                    </div>
                    <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                </div>

                {/* Top App Header */}
                <header className="app-header">
                    <div className="header-top">
                        <h1 className="main-title">Calendar</h1>
                        <div className="search-wrapper">
                            <span className="material-symbols-outlined search-icon">search</span>
                            <input type="text" placeholder="Search" className="search-input" />
                            <span className="search-shortcut">⌘K</span>
                        </div>
                    </div>
                    
                    <div className="header-tabs">
                        <button className="tab active">All events</button>
                        <button className="tab">Shared</button>
                        <button className="tab">Public</button>
                        <button className="tab">Archived</button>
                    </div>
                </header>

                <div className="calendar-container">
                    {/* Calendar Toolbar Options */}
                    <div className="calendar-toolbar">
                        <div className="toolbar-left">
                            <div className="month-icon">
                                <span className="month-short">{currentMonthDate.toLocaleDateString('en-US', {month:'short'}).toUpperCase()}</span>
                                <span className="month-date">{currentMonthDate.getDate()}</span>
                            </div>
                            <div className="month-titles">
                                <h2>{currentMonthDate.toLocaleDateString('en-US', {month:'long', year:'numeric'})}</h2>
                                <p>{getMonthRangeLabel()}</p>
                            </div>
                        </div>

                        <div className="toolbar-controls">
                            {!isGoogleConnected ? (
                                <button className="btn-sync-google" onClick={() => window.location.href = '/hr/settings?tab=connexions'}>
                                    <span className="google-icon-sm">G</span>
                                    <span>Synchroniser</span>
                                </button>
                            ) : (
                                <div className="sync-status-badge">
                                    <span className="google-icon-sm">G</span>
                                    <span>Connecté</span>
                                </div>
                            )}
                            
                            <div className="nav-group">
                                <button className="btn-icon nav-left" onClick={prevMonth}>
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </button>
                                <button className="btn-today" onClick={goToToday}>Today</button>
                                <button className="btn-icon nav-right" onClick={nextMonth}>
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </button>
                            </div>

                            <div className="view-selector">
                                Month view
                                <span className="material-symbols-outlined">expand_more</span>
                            </div>

                            <button className="btn-add-event" onClick={() => setIsModalOpen(true)}>
                                <span className="material-symbols-outlined">add</span>
                                Add event
                            </button>
                        </div>
                    </div>

                    {/* Table-like Full Month Grid */}
                    <div className="month-grid">
                        {/* Day Names Header */}
                        <div className="grid-weekdays">
                            <div>Mon</div>
                            <div>Tues</div>
                            <div>Wed</div>
                            <div>Thu</div>
                            <div>Fri</div>
                            <div>Sat</div>
                            <div>Sun</div>
                        </div>

                        {/* 42 Day Cells */}
                        <div className="grid-cells">
                            {gridDays.map((date, idx) => {
                                // Find events falling on this day
                                const dayInterviews = interviews.filter(i => {
                                    const d = new Date(i.start_time)
                                    return d.getFullYear() === date.getFullYear() &&
                                           d.getMonth() === date.getMonth() &&
                                           d.getDate() === date.getDate()
                                }).map(i => ({ ...i, source: 'hr' }))

                                const dayGoogleEvents = googleEvents.filter(e => {
                                    const d = new Date(e.start)
                                    return d.getFullYear() === date.getFullYear() &&
                                           d.getMonth() === date.getMonth() &&
                                           d.getDate() === date.getDate()
                                }).map(e => ({
                                    _id: e.id,
                                    candidate_name: e.summary,
                                    start_time: e.start,
                                    type: 'Google Event',
                                    source: 'google'
                                }))

                                const dayEvents = [...dayInterviews, ...dayGoogleEvents]
                                
                                // Check if this cell is purely outside the current month (for styling differently)
                                const isCurrentMonth = date.getMonth() === currentMonthDate.getMonth()
                                // Check if today
                                const isToday = date.toDateString() === new Date().toDateString()

                                return (
                                    <div key={idx} className={`grid-cell ${isCurrentMonth ? '' : 'out-of-month'}`}>
                                        <div className="cell-header">
                                            <span className={`date-number ${isToday ? 'today-badge' : ''}`}>{date.getDate()}</span>
                                        </div>
                                        <div className="cell-events">
                                            {dayEvents.slice(0, 2).map(event => (
                                                <div key={event._id} className={`event-pill ${event.source === 'google' ? 'google-event' : getEventColorClass(event.type)}`}>
                                                    <span className="event-pill-title">
                                                        {event.source === 'google' && <span className="google-icon-sm">G</span>}
                                                        {event.candidate_name.split(' ')[0]}
                                                    </span>
                                                    <span className="event-pill-time">{formatEventTime(event.start_time)}</span>
                                                </div>
                                            ))}
                                            {dayEvents.length > 2 && (
                                                <button 
                                                    className="more-events-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setExpandedDay({ date, events: dayEvents })
                                                    }}
                                                >
                                                    {dayEvents.length - 2} more...
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div> {/* Closing calendar-container */}

                {/* Day Events Modal (Professional View) */}
                    {expandedDay && (
                        <div className="modal-overlay" onClick={() => setExpandedDay(null)}>
                            <div className="modal-card day-events-modal" onClick={e => e.stopPropagation()}>
                                <div className="modal-header">
                                    <div className="modal-header-info">
                                        <h3>Events for {expandedDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                                        <p className="modal-subtitle">{expandedDay.events.length} interviews scheduled</p>
                                    </div>
                                    <button className="close-btn" onClick={() => setExpandedDay(null)}>
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                                <div className="modal-body">
                                    <div className="day-events-list">
                                        {expandedDay.events.map((event, index) => (
                                            <div key={event._id || index} className="day-event-item">
                                                <div className={`event-indicator ${event.source === 'google' ? 'google-indicator' : getEventColorClass(event.type)}`}></div>
                                                <div className="event-details">
                                                    <div className="event-row">
                                                        <span className="event-name">
                                                            {event.source === 'google' && <span className="google-tag">External</span>}
                                                            {event.candidate_name}
                                                        </span>
                                                        <span className="event-time-badge">{formatEventTime(event.start_time)}</span>
                                                    </div>
                                                    <div className="event-meta">
                                                        <span className="event-type-label">{event.type}</span>
                                                        {event.candidate_email && (
                                                            <>
                                                                <span className="event-dot">•</span>
                                                                <span className="event-email">{event.candidate_email}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <button className="event-action-btn">
                                                    <span className="material-symbols-outlined">chevron_right</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                {isModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                        <div className="modal-card" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Quick Availability</h3>
                                <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="modal-body">
                                <p className="card-desc">Select a specific time and send an invite link to the candidate instantly.</p>

                                <form className="quick-form-modal" onSubmit={handleSchedule}>
                                    <div className="form-group">
                                        <label className="form-label">Candidate Name</label>
                                        <input 
                                            className="modal-input" 
                                            placeholder="e.g. Helena Troy" 
                                            type="text" 
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email Address</label>
                                        <input 
                                            className="modal-input" 
                                            placeholder="helena.t@design.co" 
                                            type="email" 
                                            value={formEmail}
                                            onChange={(e) => setFormEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Date & Time</label>
                                        <input 
                                            className="modal-input" 
                                            type="datetime-local" 
                                            value={formStartTime}
                                            onChange={(e) => setFormStartTime(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Interview Type</label>
                                        <select 
                                            className="modal-input modal-select"
                                            value={formType}
                                            onChange={(e) => setFormType(e.target.value)}
                                        >
                                            <option>Technical Assessment</option>
                                            <option>HR Screening</option>
                                            <option>Final Portfolio Review</option>
                                            <option>Cultural Fit</option>
                                        </select>
                                    </div>
                                    <div className="form-actions">
                                        <button className="btn-modal-submit" type="submit" disabled={!companyId}>
                                            <span className="material-symbols-outlined">event</span>
                                            Schedule Interview
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

export default Calendar
