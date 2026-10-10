import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const source=fs.readFileSync('.github/workflows/release-version.yml','utf8');
// This is a workflow contract check, not a replacement for GitHub integration tests.
test('release never changes Pages administrative configuration or rebases verified artifacts',()=>{
  assert.doesNotMatch(source,/gh api --method PUT/);
  assert.doesNotMatch(source,/enablement: true/);
  assert.doesNotMatch(source,/git pull --rebase/);
});
test('Pages preflight accepts workflow source and rejects legacy/unreadable source',t=>{
  const block=source.split('name: Require preconfigured GitHub Actions Pages source')[1]?.split('\n      - name:')[0];assert.ok(block);
  const script=block.split('run: |\n')[1].split('\n').map(l=>l.replace(/^          /,'')).join('\n');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tasun-gh-fixture-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  // Stub only the external GitHub API; execute the actual workflow shell.
  fs.writeFileSync(path.join(dir,'gh'),'#!/bin/sh\n[ "$MODE" != unavailable ] || exit 1\nprintf "%s\\n" "$MODE"\n',{mode:0o755});
  for(const [mode,ok] of [['workflow',true],['legacy',false],['unavailable',false]]){
    const r=spawnSync('bash',['-c',script],{encoding:'utf8',env:{...process.env,PATH:dir+':'+process.env.PATH,MODE:mode,GITHUB_REPOSITORY:'Wutasun/Tasun'}});
    assert.equal(r.status===0,ok,mode+' '+r.stdout+r.stderr);
  }
});
