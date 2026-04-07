import sys

with open("src/apps/Candidat/Dashboard/Notifications/Notifications.jsx", "r", encoding="utf-8") as f:
    text = f.read()

import re

# 1. Remove the entire <aside> section
new_text = re.sub(
    r'\{/\* ── Pane 1: Categories ── \*/\}(.*?)</aside>',
    '',
    text,
    flags=re.DOTALL
)

# 2. Add badges above the search field inside list-controls
badges_html = """
            {/* Category Badges directly above the list */}
            <div className="notif-category-badges" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button
                className={`notif-badge-filter ${categoryFilter === 'all' && visibilityFilter !== 'unread' ? 'is-active' : ''}`}
                onClick={() => { setCategoryFilter('all'); setVisibilityFilter('all'); }}
              >
                {t('notif.filters.category_all')} ({localizedNotifications.length})
              </button>
              <button
                className={`notif-badge-filter ${visibilityFilter === 'unread' ? 'is-active' : ''}`}
                onClick={() => { setCategoryFilter('all'); setVisibilityFilter('unread'); }}
              >
                {t('notif.filter.unread')} {unreadCount > 0 && `(${unreadCount})`}
              </button>
              <button
                className={`notif-badge-filter ${categoryFilter === 'application' && visibilityFilter !== 'unread' ? 'is-active' : ''}`}
                onClick={() => { setCategoryFilter('application'); setVisibilityFilter('all'); }}
              >
                {t('notif.cat.app')}
              </button>
              <button
                className={`notif-badge-filter ${categoryFilter === 'quiz' && visibilityFilter !== 'unread' ? 'is-active' : ''}`}
                onClick={() => { setCategoryFilter('quiz'); setVisibilityFilter('all'); }}
              >
                {t('notif.cat.quiz')}
              </button>
            </div>
"""

new_text = new_text.replace(
    '<div className="notif-center__list-controls">',
    '<div className="notif-center__list-controls">\n' + badges_html
)

# 3. Simplify detailed notification
old_detailed = """                {(selectedNotification.metadata?.company_name || selectedNotification.metadata?.job_title) && (
                  <div style={{ marginBottom: '1.5rem', color: 'var(--notif-text)' }}>
                    {selectedNotification.metadata?.job_title && (
                      <p style={{ margin: '0.25rem 0' }}>
                        <strong style={{ color: 'var(--notif-text)' }}>Poste :</strong> {selectedNotification.metadata.job_title}
                      </p>
                    )}
                    {selectedNotification.metadata?.company_name && (
                      <p style={{ margin: '0.25rem 0' }}>
                        <strong style={{ color: 'var(--notif-text)' }}>Entreprise :</strong> {selectedNotification.metadata.company_name}
                      </p>
                    )}
                  </div>
                )}"""

new_detailed = """                {(selectedNotification.metadata?.company_name || selectedNotification.metadata?.job_title) && (
                  <div className="notif-detail__inline-meta" style={{ display: 'flex', gap: '1rem', color: 'var(--notif-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    {selectedNotification.metadata?.company_name && (
                      <span style={{display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
                        <span className="material-symbols-outlined" style={{fontSize: '1.1rem'}}>business</span>
                        {selectedNotification.metadata.company_name}
                      </span>
                    )}
                    {selectedNotification.metadata?.job_title && (
                      <span style={{display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
                        <span className="material-symbols-outlined" style={{fontSize: '1.1rem'}}>work</span>
                        {selectedNotification.metadata.job_title}
                      </span>
                    )}
                  </div>
                )}"""

# Handle variant where it runs as block with var(--dashboard-nav-bg)
old_detailed_2 = """                {(selectedNotification.metadata?.company_name || selectedNotification.metadata?.job_title) && (
                  <div style={{
                    marginBottom: '2rem',
                    background: 'var(--dashboard-nav-bg)',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    borderLeft: '4px solid var(--dashboard-accent)'
                  }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--dashboard-accent)', fontSize: '1.1rem' }}>
                      Détails de l'opportunité
                    </h4>
                    {selectedNotification.metadata?.job_title && (
                      <p style={{ margin: '0 0 0.5rem 0', color: 'var(--notif-text)' }}>
                        <strong style={{ color: '#fff' }}>Poste :</strong> {selectedNotification.metadata.job_title}
                      </p>
                    )}
                    {selectedNotification.metadata?.company_name && (
                      <p style={{ margin: '0', color: 'var(--notif-text-muted)' }}>
                        <strong style={{ color: '#fff' }}>Entreprise :</strong> {selectedNotification.metadata.company_name}
                      </p>
                    )}
                  </div>
                )}"""

if old_detailed_2 in new_text:
    new_text = new_text.replace(old_detailed_2, new_detailed)
elif old_detailed in new_text:
    new_text = new_text.replace(old_detailed, new_detailed)

with open("src/apps/Candidat/Dashboard/Notifications/Notifications.jsx", "w", encoding="utf-8") as f:
    f.write(new_text)

print("Replacement script OK")
