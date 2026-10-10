const test=require('node:test');
const vm=require('node:vm');
const fs=require('node:fs');
for(const file of ['汐東收發文明細表.html','汐東收發文登錄表.html','汐東文件統計表.html','汐東文件管理表.html'])test('embedded scripts parse: '+file,()=>{
 const html=fs.readFileSync(file,'utf8');let count=0;
 for(const [,attrs,body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(!body.trim()||/type\s*=\s*["']application\/(?:ld\+)?json/i.test(attrs))continue;
  new vm.Script(body,{filename:file+':script'+(++count)});
 }
 if(!count)throw new Error('No scripts inspected');
});
