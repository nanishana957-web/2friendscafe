import re
import os

with open(r"f:\Two Friends\old-src\index.html", "r", encoding="utf-8") as f:
    content = f.read()

# Extract CSS
css_match = re.search(r"<style>(.*?)</style>", content, re.DOTALL)
if css_match:
    with open(r"f:\Two Friends\src\index.css", "w", encoding="utf-8") as f:
        f.write(css_match.group(1))

# Extract JS
js_match = re.search(r"<script>(.*?)</script>", content, re.DOTALL)
if js_match:
    with open(r"f:\Two Friends\src\logic.js", "w", encoding="utf-8") as f:
        f.write(js_match.group(1))

# Extract HTML
html_match = re.search(r"</style></head>(.*?)<script src", content, re.DOTALL)
if html_match:
    with open(r"f:\Two Friends\src\template.html", "w", encoding="utf-8") as f:
        f.write(html_match.group(1).strip())
