// inject-index-login-v3.js
// Helper script: minimally patch index.html to use TasunAuthV3 login without changing UI/CSS.
// Run: node inject-index-login-v3.js
//
// What it does:
// - Adds <script src="tasun-auth-v3.js"></script> and <script src="tasun-cloudwrap-v3.js"></script> into <head> if missing.
// - Adds small glue at end of body that hooks common login form ids/classes if found.
//   If not found, it still exposes window.TasunAuthV3 for manual wiring.
// - After login, redirects to ?next=... if present, else stays.

const fs = require("fs");
const path = require("path");

const INDEX = path.join(process.cwd(), "index.html");

if (!fs.existsSync(INDEX)) {
  console.error("index.html not found in current directory.");
  process.exit(1);
}

let html = fs.readFileSync(INDEX, "utf8");
const lower = html.toLowerCase();

function ensureInHead(src){
  if(lower.includes(src.toLowerCase())) return;
  const i = lower.indexOf("</head>");
  if(i<0) return;
  html = html.slice(0,i) + `  <script src="${src}"></script>\n` + html.slice(i);
}

ensureInHead("tasun-auth-v3.js");
ensureInHead("tasun-cloudwrap-v3.js");

if(!lower.includes("tasun_login_glue_v3")){
  const glue = `\n<script id="tasun_login_glue_v3">\n(function(){\n  try{\n    // You can set worker base here if not provided elsewhere\n    if(!window.TASUN_WORKER_BASE){\n      // TODO: set your worker base once (example):\n      // window.TASUN_WORKER_BASE = "https://tasun-worker.wutasun.workers.dev";\n    }\n\n    function qs(n){ return new URLSearchParams(location.search).get(n); }\n\n    // Try to find common login controls (do not change UI):\n    var u = document.querySelector('#username, input[name="username"], #user, input[name="user"]');\n    var p = document.querySelector('#password, input[name="password"], #pass, input[name="pass"]');\n    var btn = document.querySelector('#loginBtn, button[data-action="login"], button.login, .login-btn');\n\n    async function doLogin(){\n      if(!window.TasunAuthV3) throw new Error('TasunAuthV3 missing');\n      var username = u ? u.value.trim() : '';\n      var password = p ? p.value : '';\n      if(!username || !password){ alert('請輸入帳號/密碼'); return; }\n      try{\n        await window.TasunAuthV3.login(username, password);\n        window.TasunAuthV3.applyRoleButtons();\n        var next = qs('next');\n        if(next){ location.replace(decodeURIComponent(next)); }\n      }catch(e){\n        alert('登入失敗：' + (e && e.message ? e.message : e));\n      }\n    }\n\n    if(btn){\n      btn.addEventListener('click', function(ev){ ev.preventDefault(); doLogin(); });\n    }\n\n    // If already logged in, apply role buttons immediately\n    try{ window.TasunAuthV3.applyRoleButtons(); }catch(e){}\n\n  }catch(e){}\n})();\n</script>\n`;
  const lower2 = html.toLowerCase();
  const j = lower2.lastIndexOf("</body>");
  if(j>=0){
    html = html.slice(0,j) + glue + html.slice(j);
  }else{
    html += glue;
  }
}

fs.writeFileSync(INDEX, html, "utf8");
console.log("✔ index.html patched for Tasun Security v3 (glue injected).");
