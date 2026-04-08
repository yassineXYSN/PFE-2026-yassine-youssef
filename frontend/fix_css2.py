import re

with open("src/apps/Candidat/Dashboard/Notifications/Notifications.css", "r", encoding="utf-8") as f:
    text = f.read()

badges_css = """
/* Category Badges */
.notif-category-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
  padding: 0 0 1rem 0;
  border-bottom: 1px solid var(--notif-border);
}

.notif-badge-filter {
  background: var(--dashboard-nav-bg);
  border: 1px solid transparent;
  color: var(--notif-text-muted);
  padding: 0.5rem 1.25rem;
  border-radius: 2rem;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.notif-badge-filter:hover {
  background: var(--notif-bg-alt);
  color: var(--notif-text);
  border-color: var(--dashboard-border);
}

.notif-badge-filter.is-active {
  background: var(--dashboard-accent);
  color: #fff;
  border-color: var(--dashboard-accent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}
"""

# Replace anything from "/* Pane 1: Categories */" up to "/* Pane 2: List */"
text = re.sub(r'/\* Pane 1: Categories \*/.*?(/\* Pane 2: List \*/)', badges_css + r'\n\1', text, flags=re.DOTALL)

with open("src/apps/Candidat/Dashboard/Notifications/Notifications.css", "w", encoding="utf-8") as f:
    f.write(text)

print("Done CSS!")
