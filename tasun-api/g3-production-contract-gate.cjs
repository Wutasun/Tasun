'use strict';
/**
 * LOCAL REVIEW ONLY. Compare safe, static Cloudflare evidence with this PR's
 * G3 implementation and the formal entrypoint. No network, write, or secret read.
 * Run: node tasun-api/g3-production-contract-gate.cjs SAFE_EVIDENCE.json SAFE_SOURCE_ROUTE_MATCH.json
 * No 'GO' outcome is possible from substring evidence alone.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function review(evidence, routes, root = path.resolve(__dirname, '..')) {
  const worker = fs.readFileSync(path.join(root, 'tasun-api/tasun-worker-stable-v4.js'), 'utf8');
  const formal = fs.readFileSync(path.join(root, 'tasun-api/wrangler.toml'), 'utf8');
  const matches = routes && routes.route_marker_found || {};
  const identifiers = routes && routes.identifier_marker_found || {};
  const version = evidence?.active_versions?.find(item => item.percentage === 100);
  const bindingNames = version?.binding_names_and_types || [];
  const binding = name => bindingNames.find(b => b.name === name);
  const issues = [];
  const add = (code, note) => issues.push({ code, note });
  const requiredRoutes = [
    '/api/tasun/health', '/api/tasun/login', '/api/tasun/me',
    '/api/tasun/auth/read', '/api/tasun/auth/upsert',
    '/api/tasun/users/upsert', '/api/tasun/read', '/api/tasun/merge',
  ];
  const equivalentRouteMarkers = requiredRoutes.every(x => matches[x] === true && worker.includes(x));
  if (!version || evidence.worker_name !== 'tasun-worker' || routes.worker_name !== evidence.worker_name ||
      version.version_id !== routes.version_id || routes.percentage !== 100 ||
      evidence.source_matches_active_version !== 'ETAG_EQUAL_ACTIVE_100_PERCENT' ||
      routes.source_association !== evidence.source_matches_active_version ||
      routes.verified_raw_container_sha256 !== evidence.downloaded_latest_source?.sha256) {
    add('ACTIVE_SOURCE_EVIDENCE_UNCONFIRMED','Active deployment and saved source association must agree.');
  }
  if (!equivalentRouteMarkers) add('G3_ROUTE_MARKERS_UNCONFIRMED','Required G3 route substrings do not align.');
  if (!binding('DB') || binding('DB').type !== 'd1') {
    add('ACTIVE_D1_BINDING_UNCONFIRMED','Expected DB D1 binding is not established.');
  }
  if (identifiers.AUTH_SECRET && !binding('AUTH_SECRET')) {
    add('AUTH_SECRET_BINDING_MISSING','Candidate requires AUTH_SECRET; active bindings do not list it. Never use SESSION_SECRET as a fallback.');
  } else if (identifiers.AUTH_SECRET && binding('AUTH_SECRET')?.type !== 'secret_text') {
    add('AUTH_SECRET_BINDING_TYPE_UNVERIFIED','AUTH_SECRET must be backed by a secret binding before release.');
  }
  if (binding('SESSION_SECRET')?.type === 'plain_text') {
    add('LEGACY_SESSION_SECRET_EXPOSURE_REVIEW','SESSION_SECRET is a plain-text binding; do not echo or reuse its value.');
  }
  const integrationMarkers = ['GH_TOKEN','GITHUB_TOKEN'].filter(x => identifiers[x] === true && !worker.includes(x));
  if (integrationMarkers.length) {
    add('GITHUB_INTEGRATION_NOT_PRESERVED', 'Active source contains GitHub integration markers absent from candidate; equivalence is not established.');
  }
  const entry = /\bmain\s*=\s*"([^"\r\n]+)"/.exec(formal)?.[1] || '';
  if (!entry || !fs.existsSync(path.join(root, 'tasun-api',entry))) {
    add('FORMAL_DEPLOY_ENTRY_UNRESOLVED','Formal Wrangler main points to a missing file. Do not change it to the candidate before contract preservation.');
  }
  add('FUNCTIONAL_EQUIVALENCE_UNPROVEN','Static substring evidence cannot verify runtime API behavior or pre-existing GitHub integration.');
  add('D1_SCHEMA_READBACK_PENDING','Marker names do not prove that the production D1 schema matches G3.');
  return {
    schema:'tasun-g3-local-contract-review-v1',
    decision:'NO_GO',
    production_changes:false,
    worker:evidence?.worker_name === 'tasun-worker' ? 'tasun-worker' : 'UNCONFIRMED',
    confirmed_100_percent_active_version:version?.version_id === routes?.version_id,
    route_marker_contract: equivalentRouteMarkers ? 'STATIC_MATCH_ONLY' : 'UNCONFIRMED',
    candidate_worker_sha256:crypto.createHash('sha256').update(worker).digest('hex'),
    issues,
    note:'LOCAL READ ONLY. No production worker source, binding values, credentials, or D1 records stored.'
  };
}
if (require.main === module) {
  if (process.argv.length !== 4) {
    process.stderr.write('Usage: node tasun-api/g3-production-contract-gate.cjs SAFE_EVIDENCE.json SAFE_SOURCE_ROUTE_MATCH.json\n');
    process.exitCode = 2;
  } else {
    try {
      const input = f => JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
      const result = review(input(process.argv[2]), input(process.argv[3]));
      process.stdout.write(JSON.stringify(result,null,2)+'\n');
      // This program intentionally NEVER returns a deployment-ready verdict.
      process.exitCode = 2;
    } catch(e) {
      process.stderr.write('ERROR: cannot validate offline evidence: '+e.message+'\n');
      process.exitCode = 2;
    }
  }
}
module.exports = { review };
