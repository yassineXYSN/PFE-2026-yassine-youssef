import re

with open("src/apps/Candidat/Dashboard/MySubmissions/MySubmissions.css", "r", encoding="utf-8") as f:
    css = f.read()

# Replace hard-coded #xxx and rgba(...) colors with dashboard variables.

# Replace primary highlighting amber (#fcd34d) with var(--dashboard-accent) since dashboard uses purple mainly. 
# Although, yellow might represent active tabs. In the new theme, we'll map #fcd34d to var(--dashboard-accent) where it implies an active state.

css = re.sub(r'#fcd34d', 'var(--dashboard-accent)', css)
css = re.sub(r'rgba\(252, 211, 77, [0-9.]+\)', 'rgba(var(--dashboard-accent-rgb, 137, 90, 246), 0.3)', css)
css = re.sub(r'#0f172a', '#fff', css) # text on active buttons should likely be white per the dashboard accent

# Use standard text colors instead of generic #fff or #000 in structural elements which might be for dark mode
css = re.sub(r'background:\s*#fff;', 'background: var(--dashboard-surface);', css)

# Make status pill borders more standardized 
css = re.sub(r'background:\s*rgba\(137,\s*90,\s*246,\s*0\.1\);', 'background: var(--dashboard-accent-light);', css)
css = re.sub(r'#895af6', 'var(--dashboard-accent)', css)

# Standardize neutral text elements
css = re.sub(r'color:\s*var\(--dashboard-text-muted\)', 'color: var(--dashboard-muted)', css)

with open("src/apps/Candidat/Dashboard/MySubmissions/MySubmissions.css", "w", encoding="utf-8") as f:
    f.write(css)

print("CSS variables applied.")
