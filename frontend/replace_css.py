import re

with open("src/apps/Candidat/Dashboard/Notifications/Notifications.css", "r", encoding="utf-8") as f:
    text = f.read()

# Replace .notif-center__categories and .notif-cat-btn blocks with the new badge styles
badges_css = """
  /* Category Badges */
  .notif-category-badges {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 1rem;
    padding: 0 0 1rem 0;
    border-bottom: 1px solid var(--notif-border);
  }

  .notif-badge-filter {
    background: transparent;
    border: 1px solid var(--notif-border);
    color: var(--notif-text-muted);
    padding: 0.35rem 1rem;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .notif-badge-filter:hover {
    background: var(--dashboard-nav-bg);
    color: var(--notif-text);
  }

  .notif-badge-filter.is-active {
    background: var(--dashboard-accent);
    color: #fff;
    border-color: var(--dashboard-accent);
  }
"""

text = re.sub(r'/\* Pane 1: Categories \*/.*?\/\* ── Pane 2: List ── \*/', '/* ── Pane 2: List ── */\n' + badges_css, text, flags=re.DOTALL)

with open("src/apps/Candidat/Dashboard/Notifications/Notifications.css", "w", encoding="utf-8") as f:
    f.write(text)

print("CSS updated")