import re

with open(r"f:\Two Friends\src\template.html", "r", encoding="utf-8") as f:
    html = f.read()

# Replace class= with className=
html = html.replace('class="', 'className="')

# Fix self-closing tags
html = html.replace('<hr>', '<hr />')
html = html.replace('<br>', '<br />')

# Fix image tags
html = re.sub(r'(<img[^>]+)(?<!/)>', r'\1 />', html)

# Fix input tags
html = re.sub(r'(<input[^>]+)(?<!/)>', r'\1 />', html)

# Fix styles manually
html = html.replace('style="background:#fff;flex:0"', "style={{background:'#fff', flex:0}}")
html = html.replace('style="padding:4px"', "style={{padding:'4px'}}")
html = html.replace('style="display:none"', "style={{display:'none'}}")
html = html.replace('style="flex:1"', "style={{flex:1}}")
html = html.replace('style="width:40px"', "style={{width:'40px'}}")
html = html.replace('style="text-align:right"', "style={{textAlign:'right'}}")
html = html.replace('style="width:50px"', "style={{width:'50px'}}")
html = html.replace('style="width:80px"', "style={{width:'80px'}}")
html = html.replace('style="margin-top:8px"', "style={{marginTop:'8px'}}")
html = html.replace('style="color:var(--mu);font-size:12px;margin-top:6px"', "style={{color:'var(--mu)', fontSize:'12px', marginTop:'6px'}}")
html = html.replace('autocomplete="off"', "autoComplete=\"off\"")
html = html.replace('inputmode="decimal"', "inputMode=\"decimal\"")
html = html.replace('inputmode="numeric"', "inputMode=\"numeric\"")

# For label
html = html.replace('for=', 'htmlFor=')

jsx = f"""import React, {{ useEffect }} from 'react';
import './index.css';
import {{ initLogic }} from './logic';

function App() {{
  useEffect(() => {{
    initLogic();
  }}, []);

  return (
    <>
{html}
    </>
  );
}}

export default App;
"""

with open(r"f:\Two Friends\src\App.jsx", "w", encoding="utf-8") as f:
    f.write(jsx)
