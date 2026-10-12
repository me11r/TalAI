import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import sharp from 'sharp';
export const VERSION='2026-10-12-review.1';
export function security(db,port){
 db.exec(`CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,expires INTEGER,consent TEXT); CREATE TABLE IF NOT EXISTS consents(id TEXT PRIMARY KEY,purpose TEXT,version TEXT,time TEXT,choice INTEGER,withdrawnAt TEXT); CREATE TABLE IF NOT EXISTS consent_choices(consent TEXT,purpose TEXT,version TEXT,choice INTEGER,time TEXT); CREATE TABLE IF NOT EXISTS consent_links(consent TEXT,record TEXT,action TEXT,time TEXT);`);
 const digest=s=>createHash('sha256').update(s).digest('hex');
 const secret=process.env.TALAI_OPERATOR_PASSWORD||'';const configured=secret.length>=32;
 const attempts=new Map();
 return async(req,res,url,body,json)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  const token=(req.headers.cookie||'').split('; ').find(x=>x.startsWith('talai_session='))?.slice(14)||'';
  db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
  const session=configured?db.prepare('SELECT * FROM sessions WHERE hash=? AND expires>?').get(digest(secret+token),Date.now()):null;
  const protectedPath=(url.pathname.startsWith('/api/')&&url.pathname!='/api/tree-model')||url.pathname.startsWith('/uploads/');
  if(protectedPath)res.setHeader('Cache-Control','no-store');
  if(protectedPath&&!['GET','HEAD'].includes(req.method)){
   const origins=process.env.TALAI_PUBLIC_ORIGIN?[process.env.TALAI_PUBLIC_ORIGIN]:[`http://127.0.0.1:${port}`,`http://localhost:${port}`];
   if(req.headers['x-talai-request']!=='1'||(req.headers.origin&&!origins.includes(req.headers.origin))){json(res,{error:'Запрос отклонён: источник не разрешён'},403);return true;}
  }
  if(url.pathname==='/api/session'&&req.method==='GET'){json(res,{authenticated:!!session,configured,version:VERSION});return true;}
  if(url.pathname==='/api/session'&&req.method==='POST'){
   if(!configured){json(res,{error:'Приём закрыт: владелец не настроил доступ'},503);return true;}
   const key=req.socket.remoteAddress||'local',a=attempts.get(key)||{count:0,until:Date.now()+60000};if(a.until<Date.now()){a.count=0;a.until=Date.now()+60000;}a.count++;attempts.set(key,a);if(a.count>8){json(res,{error:'Слишком много попыток. Повторите через минуту'},429);return true;}
   const v=JSON.parse(await body(req,4096));if(typeof v.password!=='string'||!timingSafeEqual(Buffer.from(digest(v.password)),Buffer.from(digest(secret)))){json(res,{error:'Неверный код доступа'},401);return true;}
   if(v.processing!==true||v.terms!==true||v.version!==VERSION){json(res,{error:'Нужны отдельные подтверждения обработки и условий актуальной версии'},422);return true;}
   const id=randomBytes(24).toString('hex'),sessionToken=randomBytes(32).toString('hex');
   db.prepare('INSERT INTO consents VALUES (?,?,?,?,?,NULL)').run(id,'Рабочий реестр: сохранение материалов, заметок и перенос прежних локальных записей; условия приняты отдельно',VERSION,new Date().toISOString(),1);
   for(const purpose of ['processing-workspace','accept-terms'])db.prepare('INSERT INTO consent_choices VALUES (?,?,?,?,?)').run(id,purpose,VERSION,1,new Date().toISOString());
   db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(secret+sessionToken),Date.now()+8*3600000,id);
   res.setHeader('Set-Cookie',`talai_session=${sessionToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.TALAI_PUBLIC_ORIGIN?.startsWith('https:')?'; Secure':''}`);json(res,{ok:true});return true;
  }
  if(url.pathname==='/api/session'&&req.method==='DELETE'){
   if(session){if(url.searchParams.get('withdraw')==='1')db.prepare('UPDATE consents SET withdrawnAt=? WHERE id=?').run(new Date().toISOString(),session.consent);db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(secret+token));}
   res.setHeader('Set-Cookie','talai_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');json(res,{ok:true});return true;
  }
  if(protectedPath&&!session){json(res,{error:'Требуется вход оператора. Демонстрационная роль не даёт прав доступа'},401);return true;}
  req.consent=session?.consent;
  return false;
 };
}
export async function validateUpload(bytes,ext){
 if(!bytes.length)throw Error('Пустой файл');
 if(['.png','.jpg','.jpeg','.webp','.tif','.tiff'].includes(ext)){
  const formats={'.png':'png','.jpg':'jpeg','.jpeg':'jpeg','.webp':'webp','.tif':'tiff','.tiff':'tiff'};
  const image=sharp(bytes,{limitInputPixels:40000000,failOn:'warning'});const meta=await image.metadata();if(meta.format!==formats[ext]||meta.pages>1)throw Error('Тип изображения не совпадает с расширением или файл многостраничный');await image.resize(1,1).raw().toBuffer();return;
 }
 let doc;
 if(ext==='.glb'){if(bytes.length<28||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a||bytes.readUInt32LE(12)>bytes.length-20)throw Error('Некорректный GLB');doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());}
 else doc=JSON.parse(bytes.toString());
 if(ext!=='.json'&&doc.asset?.version!=='2.0')throw Error('Требуется glTF 2.0');
 const check=v=>{if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){if(k==='uri')throw Error('Внешние и встроенные URI моделей запрещены. Используйте самодостаточный GLB');check(x);}};check(doc);
}
