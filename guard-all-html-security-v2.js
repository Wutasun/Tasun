// guard-all-html-security-v2.js
// One-click script: inject Tasun Security v2 guards into all HTML pages except index.html
// Run: node guard-all-html-security-v2.js
//
// Injects into <head> (no UI/CSS changes):
//  1) Inline guard (sync) checking sessionStorage token -> redirect to index.html?next=...
//  2) <script src="tasun-login-v2.js"></script>
//  3) <script src="tasun-guard-v2.js"></script>

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const INDEX = "index.html";
const SESSION_KEY = "tasunAuthSession_v2"; // from tasun-login-v2.js

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === ".git" || name === "node_modules") continue;
      walk(p, out);
    } else if (st.isFile() && name.toLowerCase().endsWith(".html")) {
      out.push(p);
    }
  }
  return out;
}

function inlineGuard(){
  return `  <script>
(function(){
  try{
    var KEY="${SESSION_KEY}";
    var s=sessionStorage.getItem(KEY);
    if(!s){
      var next=encodeURIComponent(location.pathname+location.search+location.hash);
      location.replace("${INDEX}?next="+next);
      return;
    }
    try{
      var o=JSON.parse(s);
      if(!o||!o.token||!o.user){
        var next2=encodeURIComponent(location.pathname+location.search+location.hash);
        location.replace("${INDEX}?next="+next2);
        return;
      }
      if(o.exp && Date.now()>Number(o.exp)){
        var next3=encodeURIComponent(location.pathname+location.search+location.hash);
        location.replace("${INDEX}?next="+next3);
        return;
      }
    }catch(e){
      var next4=encodeURIComponent(location.pathname+location.search+location.hash);
      location.replace("${INDEX}?next="+next4);
      return;
    }
  }catch(e){}
})();
</script>
`;
}

function scripts(){
  return `  <script src="tasun-login-v2.js"></script>
  <script src="tasun-guard-v2.js"></script>
`;
}

function hasAlready(html){
  const lower = html.toLowerCase();
  return lower.includes("tasun-login-v2.js") && lower.includes("tasun-guard-v2.js") && html.includes(SESSION_KEY);
}

function inject(html){
  if(hasAlready(html)) return { html, changed:false };

  const lower = html.toLowerCase();
  const headClose = lower.indexOf("</head>");
  if(headClose === -1) return { html, changed:false, warn:"no </head>" };

  const add = inlineGuard() + scripts();
  const out = html.slice(0, headClose) + add + html.slice(headClose);
  return { html: out, changed:true };
}

const files = walk(ROOT);
const targets = files.filter(f => path.basename(f).toLowerCase() !== INDEX.toLowerCase());

let changed = 0;
let warned = [];

for (const f of targets) {
  const raw = fs.readFileSync(f, "utf8");
  const r = inject(raw);
  if (r.changed) {
    fs.writeFileSync(f, r.html, "utf8");
    changed++;
    console.log("✔ guarded security v2:", f);
  } else if (r.warn) {
    warned.push({ file:f, warn:r.warn });
  }
}

console.log("\\nDone. Files changed:", changed);
if (warned.length) {
  console.log("\\nWarnings:");
  for (const w of warned) console.log("-", w.file, ":", w.warn);
}
