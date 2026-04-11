import { useLanguage } from '../../../core/useLanguage'
import './Calendar.css'

function Calendar() {
    const { effectiveTheme } = useTheme()
    const { t } = useLanguage()
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

    const [isEditMode, setIsEditMode] = useState(false)
    const [selectedEventId, setSelectedEventId] = useState(null)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

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
                    console.log("DEBUG: Fetching Google events...")
                    const gEvents = await apiFetch('/auth/google/events')
                    console.log(`DEBUG: Received ${gEvents?.length || 0} Google events`)
                    setGoogleEvents(gEvents || [])
                } else {
                    console.log("DEBUG: Google not connected according to status")
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
            
            if (isEditMode && selectedEventId) {
                const updatedInterview = await apiFetch(`/interviews/${selectedEventId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload)
                })
                setInterviews(interviews.map(i => i._id === selectedEventId ? updatedInterview : i))
                
                // If the updated event is currently in expandedDay, update it there too
                if (expandedDay) {
                    setExpandedDay(prev => ({
                        ...prev,
                        events: prev.events.map(ev => ev._id === selectedEventId ? {...ev, ...updatedInterview} : ev)
                    }))
                }
            } else {
                const newInterview = await apiFetch('/interviews', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                })
                setInterviews([...interviews, newInterview])
            }
            
            // Re-center on the new/updated event's month
            setCurrentMonthDate(new Date(start))
            
            // Reset and close modal
            closeModal()
        } catch (err) {
            console.error('Failed to schedule/update interview:', err)
        }
    }
    
    const handleDelete = async () => {
        if (!selectedEventId) return
        
        try {
            await apiFetch(`/interviews/${selectedEventId}`, {
                method: 'DELETE'
            })
            setInterviews(interviews.filter(i => i._id !== selectedEventId))
            closeModal()
            if (expandedDay) {
                setExpandedDay(prev => ({
                    ...prev,
                    events: prev.events.filter(e => e._id !== selectedEventId)
                }))
            }
        } catch (err) {
            console.error('Failed to delete interview:', err)
        }
    }

    const openEditModal = (event) => {
        setIsEditMode(true)
        setSelectedEventId(event._id)
        setFormName(event.candidate_name)
        setFormEmail(event.candidate_email || '')
        setFormType(event.type)
        if (event.start_time) {
            const startDate = new Date(event.start_time)
            setFormStartTime(formatForInput(startDate))
        }
        setIsModalOpen(true)
    }

    const openCreateModal = () => {
        setIsEditMode(false)
        setSelectedEventId(null)
        setFormName('')
        setFormEmail('')
        setFormType('Technical Assessment')
        setFormStartTime(formatForInput(defaultTime))
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        setIsEditMode(false)
        setSelectedEventId(null)
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
        const locale = t('language') === 'fr' ? 'fr-FR' : 'en-US'
        return `${d1.toLocaleDateString(locale, {month: 'short', day: 'numeric', year: 'numeric'})} - ${dLast.toLocaleDateString(locale, {month: 'short', day: 'numeric', year: 'numeric'})}`
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
                        <h1 className="mobile-header-title">{t('hr-calendar-title')}</h1>
                    </div>
                    <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                </div>

                {/* Top App Header */}
                <header className="app-header">
                    <div className="header-top">
                        <h1 className="main-title">{t('hr-calendar-title')}</h1>
                        <div className="search-wrapper">
                            <span className="material-symbols-outlined search-icon">search</span>
                            <input type="text" placeholder={t('hr-jobs-search-placeholder')} className="search-input" />
                            <span className="search-shortcut">⌘K</span>
                        </div>
                    </div>
                    

                </header>

                <div className="calendar-layout-wrapper">
                    {/* Main Calendar View */}
                    <div className="calendar-container">
                        {/* Calendar Toolbar Options */}
                        <div className="calendar-toolbar">
                            <div className="toolbar-left">
                            <div className="month-icon">
                                <span className="month-short">{currentMonthDate.toLocaleDateString(t('language') === 'fr' ? 'fr-FR' : 'en-US', {month:'short'}).toUpperCase()}</span>
                                <span className="month-date">{currentMonthDate.getDate()}</span>
                            </div>
                            <div className="month-titles">
                                <h2>{currentMonthDate.toLocaleDateString(t('language') === 'fr' ? 'fr-FR' : 'en-US', {month:'long', year:'numeric'})}</h2>
                                <p>{getMonthRangeLabel()}</p>
                            </div>
                        </div>

                        <div className="toolbar-controls">
                            {!isGoogleConnected ? (
                                <button className="btn-sync-google" onClick={() => window.location.href = '/hr/settings?tab=connexions'}>
                                    <span className="google-icon-sm">G</span>
                                    <span>{t('hr-calendar-sync-google')}</span>
                                </button>
                            ) : (
                                <div className="sync-status-badge">
                                    <span className="google-icon-sm">G</span>
                                    <span>{t('hr-calendar-connected')}</span>
                                </div>
                            )}
                            
                            <div className="nav-group">
                                <button className="btn-icon nav-left" onClick={prevMonth}>
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </button>
                                <button className="btn-today" onClick={goToToday}>{t('hr-calendar-today')}</button>
                                <button className="btn-icon nav-right" onClick={nextMonth}>
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </button>
                            </div>

                            <button className="btn-add-event" onClick={openCreateModal}>
                                <span className="material-symbols-outlined">add</span>
                                {t('hr-calendar-add-event')}
                            </button>
                        </div>
                    </div>

                    {/* Table-like Full Month Grid */}
                    <div className="month-grid">
                        {/* Day Names Header */}
                        <div className="grid-weekdays">
                            <div>{t('hr-calendar-mon')}</div>
                            <div>{t('hr-calendar-tue')}</div>
                            <div>{t('hr-calendar-wed')}</div>
                            <div>{t('hr-calendar-thu')}</div>
                            <div>{t('hr-calendar-fri')}</div>
                            <div>{t('hr-calendar-sat')}</div>
                            <div>{t('hr-calendar-sun')}</div>
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
                                            {dayEvents.slice(0, 1).map(event => (
                                                <div 
                                                    key={event._id} 
                                                    className={`event-pill ${event.source === 'google' ? 'google-event' : getEventColorClass(event.type)}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setExpandedDay({ date, events: dayEvents })
                                                    }}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <span className="event-pill-title">
                                                        {event.source === 'google' && <span className="google-icon-sm">G</span>}
                                                        {event.candidate_name.split(' ')[0]}
                                                    </span>
                                                    <span className="event-pill-time">{formatEventTime(event.start_time)}</span>
                                                </div>
                                            ))}
                                            {dayEvents.length > 1 && (
                                                <button 
                                                    className="more-events-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setExpandedDay({ date, events: dayEvents })
                                                    }}
                                                >
                                                    {t('hr-calendar-more', { count: dayEvents.length - 1 })}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div> {/* Closing month-grid */}
                </div> {/* Closing calendar-container */}

                {/* Right Side Panel: Upcoming Events */}
                <div className="upcoming-events-panel">
                    <div className="upcoming-header">
                        <h2>{t('hr-calendar-upcoming')}</h2>
                    </div>
                    
                    <div className="upcoming-list">
                        {(() => {
                            // Combine and sort events
                            const now = new Date()
                            now.setHours(0, 0, 0, 0) // Start of today

                            const allMappableInterviews = interviews.map(i => ({ ...i, source: 'hr' }))
                            const allMappableGoogle = googleEvents.map(e => ({
                                _id: e.id,
                                candidate_name: e.summary,
                                start_time: e.start,
                                end_time: e.end,
                                type: 'Google Event',
                                source: 'google'
                            }))

                            const combined = [...allMappableInterviews, ...allMappableGoogle]
                                .filter(e => new Date(e.start_time) >= now)
                                .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

                            if (combined.length === 0) {
                                return (
                                    <div className="upcoming-empty">
                                        <span className="material-symbols-outlined">event_available</span>
                                        <p>{t('hr-calendar-no-upcoming')}</p>
                                    </div>
                                )
                            }

                            // Group by date
                            const grouped = combined.reduce((acc, event) => {
                                const locale = t('language') === 'fr' ? 'fr-FR' : 'en-US'
                                const dStr = new Date(event.start_time).toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })
                                if (!acc[dStr]) acc[dStr] = []
                                acc[dStr].push(event)
                                return acc
                            }, {})

                            return Object.keys(grouped).slice(0, 7).map((dateStr, idx) => ( // Show next 7 active days max
                                <div key={idx} className="upcoming-day-group">
                                    <h4 className="upcoming-day-title">{dateStr}</h4>
                                    <div className="upcoming-day-events">
                                        {grouped[dateStr].map((event, eIdx) => (
                                            <div 
                                                key={eIdx} 
                                                className={`upcoming-event-card ${event.source === 'google' ? 'google-upcoming' : ''}`}
                                                onClick={() => {
                                                    if (event.source === 'hr') {
                                                        openEditModal(event)
                                                    }
                                                }}
                                                style={{ cursor: event.source === 'hr' ? 'pointer' : 'default' }}
                                                title={event.source === 'hr' ? t('hr-modal-edit-event') : t('google_connect_error')}
                                            >
                                                <div className={`upcoming-indicator ${event.source === 'google' ? 'indicator-google' : getEventColorClass(event.type)}`}></div>
                                                <div className="upcoming-details">
                                                    <div className="upcoming-time">{formatEventTime(event.start_time)}</div>
                                                    <div className="upcoming-name">
                                                        {event.source === 'google' && <span className="google-icon-sm">G</span>}
                                                        {event.candidate_name}
                                                    </div>
                                                    <div className="upcoming-type">{event.type}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        })()}
                    </div>
                </div> {/* Closing upcoming-panel */}
            </div> {/* Closing layout-wrapper */}

                {/* Day Events Modal (Professional View) */}
                    {expandedDay && (
                        <div className="modal-overlay" onClick={() => setExpandedDay(null)}>
                            <div className="modal-card day-events-modal" onClick={e => e.stopPropagation()}>
                                <div className="modal-header">
                                    <div className="modal-header-info">
                                        <h3>{t('hr-modal-date-time')} {expandedDay.date.toLocaleDateString(t('language') === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                                        <p className="modal-subtitle">{expandedDay.events.length} {t('hr-calendar-upcoming')}</p>
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
                                                            {event.source === 'google' && <span className="google-tag">{t('hr-calendar-external-tag')}</span>}
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
                                                {event.source === 'hr' ? (
                                                    <button className="event-action-btn" onClick={() => openEditModal(event)} title={t('hr-modal-edit-event')}>
                                                        <span className="material-symbols-outlined">edit</span>
                                                    </button>
                                                ) : (
                                                    <button className="event-action-btn" disabled title={t('google_connect_error')} style={{opacity: 0.5, cursor: 'not-allowed'}}>
                                                        <span className="material-symbols-outlined">lock</span>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                {isModalOpen && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-card" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>{isEditMode ? t('hr-modal-edit-event') : t('hr-modal-quick-info')}</h3>
                                <button className="close-btn" onClick={closeModal}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="modal-body">
                                <p className="card-desc">
                                    {isEditMode 
                                        ? t('hr-modal-delete-confirm') 
                                        : t('hr-modal-quick-info')}
                                </p>

                                <form className="quick-form-modal" onSubmit={handleSchedule}>
                                    <div className="form-group">
                                        <label className="form-label">{t('hr-modal-candidate-name')}</label>
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
                                        <label className="form-label">{t('hr-modal-email')}</label>
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
                                        <label className="filter-label">{t('hr-modal-date-time')}</label>
                                        <input 
                                            className="modal-input" 
                                            type="datetime-local" 
                                            value={formStartTime}
                                            onChange={(e) => setFormStartTime(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="filter-label">{t('hr-modal-interview-type')}</label>
                                        <select 
                                            className="modal-input modal-select"
                                            value={formType}
                                            onChange={(e) => setFormType(e.target.value)}
                                        >
                                            <option>{t('analytics-interview')}</option>
                                            <option>{t('hr-jobs-status-draft')}</option>
                                            <option>{t('hr-jobs-status-internal')}</option>
                                            <option>{t('hr-jobs-status-published')}</option>
                                        </select>
                                    </div>
                                    <div className="form-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                        <button className="btn-modal-submit" type="submit" disabled={!companyId} style={{ marginTop: 0, flex: 1 }}>
                                            <span className="material-symbols-outlined">{isEditMode ? 'save' : 'event'}</span>
                                            {isEditMode ? t('hr-modal-save') : t('hr-modal-schedule')}
                                        </button>
                                        {isEditMode && (
                                            <button 
                                                type="button" 
                                                className="btn-modal-submit" 
                                                onClick={() => setIsDeleteConfirmOpen(true)}
                                                style={{ marginTop: 0, flex: 1, backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}
                                            >
                                                <span className="material-symbols-outlined">delete</span>
                                                {t('hr-jobs-delete-btn')}
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
                {isDeleteConfirmOpen && (
                    <div className="modal-overlay" style={{ zIndex: 1100 }}>
                        <div className="modal-card" style={{ width: '400px', textAlign: 'center', padding: '2.5rem 2rem' }}>
                            <div style={{ marginBottom: '1.5rem', color: '#ef4444' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '3.5rem' }}>error</span>
                            </div>
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '800' }}>{t('hr-modal-delete-title')}</h3>
                            <p style={{ margin: '0 0 2rem 0', color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: '1.5' }}>
                                {t('hr-modal-delete-confirm')}
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setIsDeleteConfirmOpen(false)}
                                    style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontWeight: '700', color: 'var(--color-text-main)' }}
                                >
                                    {t('hr-filter-reset')}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setIsDeleteConfirmOpen(false)
                                        handleDelete()
                                    }}
                                    style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: '700' }}
                                >
                                    {t('hr-jobs-delete-btn')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

export default Calendar
