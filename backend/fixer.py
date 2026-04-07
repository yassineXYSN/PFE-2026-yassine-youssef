import re

def fix():
    path = "../frontend/src/apps/Candidat/Dashboard/Notifications/Notifications.jsx"
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()

    # The pattern matches from the header-meta to the placeholder empty state.
    pattern = r'<div className="notif-detail__header-meta">.*?</div>\s*</div>\s*\)\s*:\s*\('

    replacement = """<div className="notif-detail__header-meta">
                  <span className="notif-cat-badge">{selectedNotification.categoryLabel}</span>
                  <span className="notif-detail__time">{formatTime(selectedNotification.created_at, true)}</span>
                </div>
                <h2>{selectedNotification.titleText}</h2>
                <div className="notif-detail__separator" />

                {(selectedNotification.metadata?.company_name || selectedNotification.metadata?.job_title) && (
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
                )}

                <p className="notif-detail__message">{selectedNotification.messageText}</p>

                {selectedNotification.link && (
                  <button
                    className="notif-detail__action"
                    onClick={() => navigate(selectedNotification.link)}
                  >
                    <span className="material-symbols-outlined">open_in_new</span>
                    {selectedNotification.category === 'quiz' ? t('notif.action.take_quiz') : t('notif.action.view_details')}
                  </button>
                )}
              </div>
            </div>
          ) : ("""

    new_text = re.sub(pattern, replacement, text, flags=re.DOTALL)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_text)

fix()
print("Fixed!")