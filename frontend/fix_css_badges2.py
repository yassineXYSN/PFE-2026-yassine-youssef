import re

with open("src/apps/Candidat/Dashboard/Notifications/Notifications.css", "r", encoding="utf-8") as f:
    text = f.read()

better_badges = """
/* Category Badges */
.notif-category-badges {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 1.2rem;
  padding-bottom: 0.5rem;
}

.notif-badge-filter {
  background: transparent;
  border: 1px solid var(--dashboard-border);
  color: var(--notif-text-muted);
  padding: 0.4rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.notif-badge-filter:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--notif-text);
  border-color: var(--notif-text-muted);
}

.notif-badge-filter.is-active {
  background: var(--dashboard-accent);
  color: #111;
  font-weight: 600;
  border-color: var(--dashboard-accent);
  box-shadow: 0 0 10px rgba(var(--dashboard-accent-rgb), 0.3);
}
"""

text = re.sub(r'/\* Category Badges \*/.*?(/\* Pane 2: List \*/)', better_badges + r'\n\1', text, flags=re.DOTALL)

with open("src/apps/Candidat/Dashboard/Notifications/Notifications.css", "w", encoding="utf-8") as f:
    f.write(text)

print("Badges properly styled.")