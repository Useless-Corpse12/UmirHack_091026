const fs = require('fs');
const path = require('path');
const ts = require('typescript');
let count=0, errors=0;
function walk(dir){ for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,ent.name);
  if(ent.isDirectory()) walk(file);
  else if(/\.(ts|tsx)$/.test(file)) {
    count++;
    const src=fs.readFileSync(file,'utf8');
    const result=ts.transpileModule(src,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
    for(const diag of result.diagnostics||[]){ if(diag.category===ts.DiagnosticCategory.Error){ errors++; console.error(file,ts.flattenDiagnosticMessageText(diag.messageText,' '));}}
  }
}}
walk(path.join(__dirname,'../src')); console.log(`TS/TSX syntax files ${count}, errors ${errors}`); process.exit(errors?1:0);
