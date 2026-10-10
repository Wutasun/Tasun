const fs=require('node:fs');
const vm=require('node:vm');
function source(file){return fs.readFileSync(file,'utf8');}
// Parse candidate endings with V8: do not approximate brace nesting inside regex/strings.
function declaration(text,name){
 const start=text.indexOf('function '+name+'(');if(start<0)throw new Error('missing function '+name);
 for(let end=text.indexOf('}',start);end>=0;end=text.indexOf('}',end+1)){
  const candidate=text.slice(start,end+1);
  try{new vm.Script('('+candidate+')');return candidate;}catch{}
 }
 throw new Error('unparseable function '+name);
}
module.exports={source,declaration};
