import {validateProject} from './src/data.ts';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const root=process.env.TALAI_DATA_DIR||'storage';mkdirSync(root+'/uploads',{recursive:true});
const db=new DatabaseSync(root+'/talai.sqlite');db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS archives(id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, name TEXT, mime TEXT, size INTEGER, uploadedAt TEXT, url TEXT);');
for(const table of ['territories','trees','surveys','observations'])db.exec(`CREATE TABLE IF NOT EXISTS ${table}(id TEXT PRIMARY KEY, body TEXT NOT NULL)`);
const args=process.argv;const port=Number(process.env.PORT||args[args.indexOf('--port')+1])||5173;
const vite=args.includes('--production')?null:await (await import('vite')).createServer({server:{middlewareMode:true,hmr:{port:port+1},watch:process.env.TALAI_TEST_MODE?null:undefined},appType:'spa'});
async function body(req,max=20*1024*1024){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('Файл слишком большой');chunks.push(chunk);}return Buffer.concat(chunks);}
const json=(res,v,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/tree-model'){
  const height=Number(url.searchParams.get('height')),crown=Number(url.searchParams.get('crown'));if(!(height>0&&height<=40&&crown>0&&crown<=20))throw Error('Некорректный размер');
  const glb=readFileSync('public/models/talai-tree.glb'),len=glb.readUInt32LE(12);const doc=JSON.parse(glb.subarray(20,20+len).toString());doc.nodes[0].scale=[crown/4,height/6,crown/4];const str=JSON.stringify(doc);const data=Buffer.from(str+' '.repeat((4-Buffer.byteLength(str)%4)%4));const bin=glb.subarray(20+len);const out=Buffer.alloc(20+data.length+bin.length);glb.copy(out,0,0,20);out.writeUInt32LE(out.length,8);out.writeUInt32LE(data.length,12);data.copy(out,20);bin.copy(out,20+data.length);res.setHeader('Content-Type','model/gltf-binary');return res.end(out);
 }
 if(url.pathname==='/api/project'){
  if(req.method==='GET')return json(res,JSON.parse(db.prepare('SELECT body FROM projects WHERE id=?').get('main')?.body||'null'));
  if(req.method==='PUT'){const p=validateProject(JSON.parse(await body(req)));if(p.version!==1||!Array.isArray(p.trees)||!Array.isArray(p.surveys)||!p.scenario)throw Error('Некорректный проект');
   for(const item of [...p.observations,...p.tasks])if(item.photo?.startsWith('data:'))throw Error('Сначала загрузите оригинал в файловое хранилище');
   for(const s of p.surveys){if(s.captureAt&&new Date(s.captureAt)>new Date()&&s.status!=='запланировано')throw Error('Будущее обследование может быть только запланировано');}
   db.exec('BEGIN');try{db.prepare('INSERT OR REPLACE INTO projects VALUES (?,?)').run('main',JSON.stringify(p));for(const table of ['territories','trees','surveys','observations']){db.exec(`DELETE FROM ${table}`);for(const x of p[table]||[])db.prepare(`INSERT INTO ${table} VALUES (?,?)`).run(x.id,JSON.stringify(x));}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return json(res,{ok:true});}
 }
 if(url.pathname==='/api/archives'&&req.method==='POST'){const a=JSON.parse(await body(req));db.prepare('INSERT OR IGNORE INTO archives VALUES (?,?)').run(a.id,JSON.stringify(a.body));return json(res,{ok:true});}
 if(url.pathname==='/api/upload'&&req.method==='POST'){
  const name=path.basename(url.searchParams.get('name')||'file');const ext=path.extname(name).toLowerCase();const types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.tif':'image/tiff','.tiff':'image/tiff','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.json':'application/json'};if(!types[ext])throw Error('Неподдерживаемый формат');
  const bytes=await body(req,100*1024*1024);const id=randomUUID(),fileUrl='/uploads/'+id+ext;writeFileSync(root+fileUrl,bytes,{flag:'wx'});const f={id,name,mime:types[ext],size:bytes.length,uploadedAt:new Date().toISOString(),url:fileUrl};db.prepare('INSERT INTO files VALUES (?,?,?,?,?,?)').run(id,name,f.mime,f.size,f.uploadedAt,fileUrl);return json(res,f);
 }
 if(url.pathname.startsWith('/uploads/')){const f=db.prepare('SELECT * FROM files WHERE url=?').get(url.pathname);if(!f)return json(res,{error:'Файл не найден'},404);res.writeHead(200,{'Content-Type':f.mime,'X-Content-Type-Options':'nosniff','Content-Disposition':'inline'});return res.end(readFileSync(root+f.url));}
 if(url.pathname.startsWith('/api/'))return json(res,{error:'Не найдено'},404);
 if(vite)return vite.middlewares(req,res);
 const rel=decodeURIComponent(url.pathname);const file=path.resolve('dist','.'+rel);if(!file.startsWith(path.resolve('dist')+'/'))return res.end(readFileSync('dist/index.html'));const target=existsSync(file)&&path.extname(file)?file:'dist/index.html';const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary'};res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(readFileSync(target));
 }catch(e){json(res,{error:e.message},400);}}).listen(port,'127.0.0.1',()=>console.log(`TalAI http://127.0.0.1:${port}`));
