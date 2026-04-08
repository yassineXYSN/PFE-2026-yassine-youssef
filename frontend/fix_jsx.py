import re

with open("src/apps/Candidat/Dashboard/MySubmissions/MySubmissions.jsx", "r", encoding="utf-8") as f:
    text = f.read()

# Fix inline colors
text = re.sub(r'color:\s*\'#fcd34d\'', "color: 'var(--dashboard-accent)'", text)
text = re.sub(r'var\(--dashboard-primary, #895af6\)', "var(--dashboard-accent)", text)
text = re.sub(r'background:\s*\'#fcd34d\'', "background: 'var(--dashboard-accent)'", text)
text = re.sub(r'color:\s*\'#0f172a\'', "color: '#fff'", text)

# Ensure the class names in JSX use the correct accent classes or generic variables
text = re.sub(r'color-primary', 'color-accent', text)

with open("src/apps/Candidat/Dashboard/MySubmissions/MySubmissions.jsx", "w", encoding="utf-8") as f:
    f.write(text)

with open("src/apps/Candidat/Dashboard/MySubmissions/MySubmissions.css", "r", encoding="utf-8") as f:
    css = f.read()

css = re.sub(r'\.color-primary', '.color-accent', css)

with open("src/apps/Candidat/Dashboard/MySubmissions/MySubmissions.css", "w", encoding="utf-8") as f:
    f.write(css)

print("JSX colors fixed")
