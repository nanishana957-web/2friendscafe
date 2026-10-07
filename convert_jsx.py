import re

with open(r"f:\Two Friends\src\template.html", "r", encoding="utf-8") as f:
    html = f.read()

# Replace class= with className=
html = html.replace('class="', 'className="')

# Replace style="..." with style={{...}}
def style_replacer(match):
    style_str = match.group(1)
    # very naive conversion: just wrap it if we want to be safe we can skip style conversion
    # wait, inline styles in this HTML are simple
    # e.g. style="margin-top:8px" -> style={{ marginTop: '8px' }}
    return 'style={{' + style_str + '}}' # this is bad, let's do a basic conversion
# It's safer to use dangerouslySetInnerHTML

jsx = f"""import React, {{ useEffect }} from 'react';
import './index.css';
import {{ initLogic }} from './logic';

function App() {{
  useEffect(() => {{
    initLogic();
  }}, []);

  return (
    <div dangerouslySetInnerHTML={{{{ __html: `{html.replace('`', '\\`')}` }}}} />
  );
}}

export default App;
"""

with open(r"f:\Two Friends\src\App.jsx", "w", encoding="utf-8") as f:
    f.write(jsx)
