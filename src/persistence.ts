import {PUBLIC_DEMO} from './runtime';
import {load,save,KEY,OLD_KEY,LEGACY_KEY,migrate,validateProject,type Project} from './data';
let queue=Promise.resolve();
const photoFiles=new Map<string,string>();
export function persist(p:Project){const snapshot=structuredClone(p);if(PUBLIC_DEMO){try{save(validateProject(snapshot));return Promise.resolve();}catch(e){return Promise.reject(e);}}queue=queue.catch(()=>{}).then(async()=>{await externalize(snapshot);save(snapshot);const r=await fetch('/api/project',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});if(!r.ok)throw Error((await r.json()).error);});return queue;}
async function externalize(p:Project){let changed=false;for(const item of [...p.observations,...p.tasks])if(item.photo?.startsWith('data:')){const original=item.photo;let url=photoFiles.get(original);if(!url){const blob=await (await fetch(original)).blob();const upload=await fetch('/api/upload?name='+encodeURIComponent(item.id)+'.'+blob.type.split('/')[1],{method:'POST',body:blob});if(!upload.ok)throw Error('Не удалось перенести фотографию');url=(await upload.json()).url as string;photoFiles.set(original,url);}item.photo=url;changed=true;}return changed;}
export async function bootstrap(){
 if(PUBLIC_DEMO)return;
 const r=await fetch('/api/project');if(!r.ok)throw Error('Серверное хранилище недоступно');const remote:Project|null=await r.json();let p=remote||load().project;let changed=!remote;
 for(const id of [OLD_KEY,LEGACY_KEY]){const raw=localStorage.getItem(id);if(!raw)continue;
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(v=>v.toString(16).padStart(2,'0')).join('');const receipt=id+':'+digest;
 if(p.migrationIds?.includes(receipt))continue;
 const archived=validateProject(JSON.parse(raw));await externalize(archived);
 const archive=await fetch('/api/archives',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:receipt,body:archived})});if(!archive.ok)throw Error('Не удалось сохранить архив');
 if(remote||id===LEGACY_KEY&&localStorage.getItem(OLD_KEY)){
 const imported=migrate(validateProject(JSON.parse(raw)),id===LEGACY_KEY);await externalize(imported);
 const add=<T extends {id:string}>(target:T[],items:T[])=>{const ids=new Map<string,string>();for(const original of items){const current=target.find(x=>x.id===original.id);if(current&&JSON.stringify(current)===JSON.stringify(original)){ids.set(original.id,current.id);continue;}const next={...original};if(current)next.id=original.id+'-import-'+digest.slice(0,6);ids.set(original.id,next.id);if(!target.some(x=>x.id===next.id))target.push(next);}return ids;};
 const trees=add(p.trees,imported.trees),plans=add(p.plans,imported.plans),surveys=add(p.surveys,imported.surveys.filter(s=>!['SEP-2026','DEC-2026'].includes(s.id)));
 const observations=imported.observations.map(o=>({...o,treeId:trees.get(o.treeId)||o.treeId,surveyId:surveys.get(o.surveyId)||o.surveyId}));
 const revisions=new Map<string,string>();for(const o of observations){const existing=p.observations.find(x=>x.treeId===o.treeId&&x.surveyId===o.surveyId);if(existing&&JSON.stringify(existing)!==JSON.stringify(o)){const source=p.surveys.find(s=>s.id===o.surveyId);if(source&&!revisions.has(source.id)){const id=source.id+'-import-'+digest.slice(0,6);p.surveys.push({...source,id,description:(source.description||'')+' · Сохранённая версия из прежнего проекта'});revisions.set(source.id,id);}}}
 add(p.observations,observations.map(o=>({...o,surveyId:revisions.get(o.surveyId)||o.surveyId})));
 add(p.tasks,imported.tasks.map(t=>({...t,target:trees.get(t.target)||plans.get(t.target)||t.target})));
 add(p.scenario.trees,imported.scenario.trees.filter(t=>!t.id.startsWith('F-C')));add(p.history,imported.history);
 }
 (p.migrationIds??=[]).push(receipt);changed=true;
 }
 changed=await externalize(p)||changed;if(changed)await persist(p);else localStorage.setItem(KEY,JSON.stringify(p));
}
