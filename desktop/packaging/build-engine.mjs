// CI-only: embed the existing CLI, not a second story compiler.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Build only in GitHub Actions');
const output=path.resolve('desktop/bin');fs.mkdirSync(output,{recursive:true});
const bundle=path.join(output,'cli.cjs');
await build({entryPoints:['bin/letsgal-ai.js'],outfile:bundle,bundle:true,platform:'node',format:'cjs',target:'node22'});
const blob=path.join(output,'sea.blob');
const config=path.join(output,'sea.json');
fs.writeFileSync(config,JSON.stringify({main:bundle,output:blob,disableExperimentalSEAWarning:true,useCodeCache:false,useSnapshot:false}));
const binary=path.join(output,'letsgal-ai'+(process.platform==='win32'?'.exe':''));
function run(command,args){const r=spawnSync(command,args,{stdio:'inherit'});if(r.status!==0)throw Error('Engine build command failed');}
run(process.execPath,['--experimental-sea-config',config]);
fs.copyFileSync(process.execPath,binary);fs.chmodSync(binary,0o755);
run(process.execPath,['node_modules/postject/dist/cli.js',binary,'NODE_SEA_BLOB',blob,'--sentinel-fuse','NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2']);
run(binary,['--help']);
for(const file of [bundle,blob,config])fs.unlinkSync(file);
