import re

with open(r"f:\Two Friends\src\logic.js", "r", encoding="utf-8") as f:
    js = f.read()

# Make it an exported function
# And import firebase modules
new_js = """import { auth, fdb, firebaseApp } from './firebase.js';

export function initLogic() {
  if (window._logicInitialized) return;
  window._logicInitialized = true;

""" + js + "\n}\n"

# The original JS has an IIFE at the bottom
# (function(){if(typeof firebase=="undefined"){gate("Cannot load Firebase. Check the internet connection and reload.");return}
# if(typeof FIREBASE_CONFIG=="undefined"||!FIREBASE_CONFIG.apiKey||!FIREBASE_CONFIG.projectId){gate("Setup needed: add your Firebase keys to firebase-config.js, then upload the folder to Netlify again.");return}
# firebase.initializeApp(FIREBASE_CONFIG);auth=firebase.auth();fdb=firebase.firestore();
# auth.onAuthStateChanged(u=>{if(creating)return;u?enter(u):showLogin()})})();

# Let's replace that IIFE entirely.
new_js = re.sub(r'\(function\(\)\s*\{[\s\S]*?\}\)\(\);', """
  auth.onAuthStateChanged(u=>{if(window.creating)return;u?enter(u):showLogin()});
""", new_js)

# Original JS uses `auth`, `fdb` which we import. But it reassigns them in IIFE. We removed the reassignment.
# We also need to fix `const $=s=>document.querySelector(s)` to be available. It is.
# Wait, `creating` is declared? `creating=true;` without var/let. In strict mode (module), this throws!
# So we need to define `window.creating` or just `let creating=false;`. Let's add `window.creating`.
new_js = new_js.replace("creating=true", "window.creating=true")
new_js = new_js.replace("creating=false", "window.creating=false")
new_js = new_js.replace("if(creating)", "if(window.creating)")

with open(r"f:\Two Friends\src\logic.js", "w", encoding="utf-8") as f:
    f.write(new_js)
