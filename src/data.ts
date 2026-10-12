import {BOUNDARY,ringPoint,DEMO_TREES} from './territory';
import {demoLocations} from './siteGeometry';
export const DEMO = 'Демонстрационные данные — не результаты обследования';
export const SPECIES = ['Берёза','Сосна','Вяз','Тополь','Не определена'];
export const CONDITIONS = ['Не оценено','Требуется осмотр','Без замечаний по осмотру','Проблема подтверждена специалистом'];
export const TASK_STATES = ['Назначена','В работе','Выполнена','Принята заказчиком'] as const;
export type Role = 'Заказчик' | 'Подрядчик';
export type Coord = { latitude:number; longitude:number };
export type PlantingLocation = Coord & {id:string; species:string; uncertainty:number|null};
export type Tree = Coord & {createdAt?:string; demo?:boolean; id:string; species:string; coordinateType:'Ствол'|'Оценка центра кроны'; source:string; uncertainty:number|null; condition:string; replaces?:string};
export type Material = {id:string;name:string;url:string;mime:string;size:number;uploadedAt:string;kind:'rgb'|'thermal'|'ortho'|'model'|'detections';previewUrl?:string;corners?:[number,number][];coordinates?:[number,number];scale?:number};
export type Survey = {id:string; date:string; source:string; territoryId?:string; captureAt?:string; uploadedAt?:string; status?:'запланировано'|'загружено'|'обрабатывается'|'готово'|'ошибка'; description?:string; demo?:boolean; materials?:Material[]; confirmedChanges?:string[]};
export type Observation = Coord & {date?:string;status?:string;source?:string;method?:string;measurements?:Record<string,number>;id:string; treeId:string; surveyId:string; uncertainty:number|null; visibility:string; note:string; photo?:string};
export type InspectionTask = {id:string; target:string; reason:string; description:string; assignee:string; due:string; priority:string; status:typeof TASK_STATES[number]; comment:string; result:string; photo?:string};
export type FutureTree = Coord & {id:string; species:string; height:number; crown:number};
export type PlantingScenario = {id:string; name:string; trees:FutureTree[]; savedAt?:string};
export type ChangeLog = {id:string; time:string; role:Role; action:string; target:string};
export type Match = {planId:string; observationId:string; manual:boolean};
export type Project = {migrationIds?:string[];territories?:{id:string;name:string;parent?:string;boundary?:[number,number][]}[];version:1; name:string; demo:string; plans:PlantingLocation[]; trees:Tree[]; surveys:Survey[]; observations:Observation[]; tasks:InspectionTask[]; scenario:PlantingScenario; history:ChangeLog[]; matches:Record<string,Match[]>; tolerance:number};
// Deliberately virtual local site: coordinates are an interchange reference, not a surveyed land parcel.
export const ORIGIN = {latitude:51.10, longitude:71.30};
export const XY = (p:Coord):[number,number] => [(p.longitude-ORIGIN.longitude)*111320*Math.cos(ORIGIN.latitude*Math.PI/180),(p.latitude-ORIGIN.latitude)*111320];
export const coord = (x:number,y:number):Coord => ({longitude:ORIGIN.longitude+x/(111320*Math.cos(ORIGIN.latitude*Math.PI/180)),latitude:ORIGIN.latitude+y/111320});
export function distance(a:Coord,b:Coord){const r=Math.PI/180; const dlat=(b.latitude-a.latitude)*r, dlng=(b.longitude-a.longitude)*r;const h=Math.sin(dlat/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(dlng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
export function assessment(d:number,u:number|null,t:number){return u===null?'Точность неизвестна':d+u<=t?'В допуске':d-u>t?'Возможное превышение':'Требуется уточнение';}
export function automaticMatches(p:Project,surveyId:string):Match[]{
 const obs=p.observations.filter(o=>o.surveyId===surveyId); const radius=Math.max(12,p.tolerance*3);
 const candidates=p.plans.map(plan=>({plan,near:obs.map(o=>({o,d:distance(plan,o)})).filter(v=>v.d<=radius).sort((a,b)=>a.d-b.d)}));
 const unique=candidates.filter(c=>c.near.length===1 || (c.near.length>1 && c.near[1].d-c.near[0].d>3));
 return unique.filter(c=>!candidates.some(other=>other!==c && other.near[0]?.o.id===c.near[0]?.o.id)).filter(c=>c.near.length).map(c=>({planId:c.plan.id,observationId:c.near[0].o.id,manual:false}));
}
export type Discrepancy = {id:string; target:string; status:string; distance:number|null; uncertainty:number|null; observationId?:string; planId?:string; manual?:boolean};
export function results(p:Project,surveyId:string):Discrepancy[]{
 const obs=p.observations.filter(o=>o.surveyId===surveyId), matches=p.matches[surveyId]||[];
 const out:Discrepancy[]=p.plans.map(plan=>{const m=matches.find(x=>x.planId===plan.id), o=obs.find(x=>x.id===m?.observationId);
 if(!o)return {id:plan.id,target:plan.id,planId:plan.id,status:obs.some(x=>distance(plan,x)<=Math.max(12,p.tolerance*3))?'Неоднозначное сопоставление':'Не найдено соответствие',distance:null,uncertainty:null};
 const d=distance(plan,o),u=plan.uncertainty===null||o.uncertainty===null?null:plan.uncertainty+o.uncertainty;
 return {id:plan.id,target:o.treeId,planId:plan.id,observationId:o.id,status:assessment(d,u,p.tolerance),distance:d,uncertainty:u,manual:m?.manual};});
 obs.filter(o=>!matches.some(m=>m.observationId===o.id)).forEach(o=>out.push({id:o.id,target:o.treeId,observationId:o.id,status:'Наблюдение вне плана',distance:null,uncertainty:o.uncertainty}));return out;
}
export function pair(p:Project,sid:string,planId:string,observationId:string){if(!p.plans.some(x=>x.id===planId)||!p.observations.some(x=>x.id===observationId&&x.surveyId===sid))throw Error('Выберите место и наблюдение'); p.matches[sid]=(p.matches[sid]||[]).filter(m=>m.planId!==planId&&m.observationId!==observationId);p.matches[sid].push({planId,observationId,manual:true});}
export function legacySeed():Project {
 const p:Project={version:1,name:'Астана · учебный участок',demo:DEMO,plans:[],trees:[],surveys:[{id:'S1',date:'2026-05-18',source:'Синтетический набор · учебная генерация'},{id:'S2',date:'2026-06-22',source:'Синтетический набор · учебная генерация'}],observations:[],tasks:[],scenario:{id:'SC1',name:'Вариант 01 · новые посадки',trees:[]},history:[],matches:{},tolerance:3};
 const locations=demoLocations();
 for(let i=0;i<60;i++){const [x,y]=locations[i]; const id=`P-${String(i+1).padStart(3,'0')}`;p.plans.push({id,...coord(x,y),species:SPECIES[i%4],uncertainty:.3});if(i>=56)continue;
 const dx=i===0?1.7:i===1?-1.7:i%13===0?7:i%9===0?2.5:.5; const t:Tree={id:`T-${String(i+1).padStart(3,'0')}`,...coord(x+dx,y+.4),species:SPECIES[i%4],coordinateType:i%3?'Ствол':'Оценка центра кроны',source:'Синтетические координаты',uncertainty:i===19?null:.6,condition:i%9===0?'Требуется осмотр':'Не оценено'};p.trees.push(t);
 }
 for(let i=56;i<60;i++)p.trees.push({id:`T-${i+1}`,...coord(16+(i-56)*68,155+(i%2)*5),species:'Не определена',coordinateType:'Оценка центра кроны',source:'Синтетические координаты',uncertainty:1.2,condition:'Не оценено'});
 for(const s of p.surveys)p.trees.forEach((t,i)=>{const [x,y]=XY(t);p.observations.push({id:`O-${s.id}-${t.id}`,treeId:t.id,surveyId:s.id,...coord(x+(s.id==='S1'?.2:0),y),uncertainty:t.uncertainty,visibility:i===19?'Частично перекрыто':'Наблюдается',note:s.id==='S2'&&i%9===0?'Изменение цвета кроны. Возможна сезонность; требуется наземный осмотр.':'Условное наблюдение. Состояние по изображению не диагностируется.'});});
 p.tasks=[{id:'TASK-001',target:'T-010',reason:'Изменение видимого состояния',description:'Проверить крону на месте, зафиксировать наблюдения.',assignee:'Учебная бригада №1',due:'2026-06-28',priority:'Высокий',status:'Назначена',comment:'',result:''},{id:'TASK-002',target:'T-014',reason:'Проверка положения',description:'Уточнить координату ствола.',assignee:'Учебная бригада №1',due:'2026-06-30',priority:'Средний',status:'В работе',comment:'',result:''},{id:'TASK-003',target:'T-020',reason:'Уточнение наблюдаемости',description:'Проверить перекрытое дерево.',assignee:'Учебная бригада №2',due:'2026-06-25',priority:'Средний',status:'Выполнена',comment:'Учебный пример',result:'Дерево присутствует'},{id:'TASK-004',target:'T-006',reason:'Наземный осмотр',description:'Учебный пример принятой работы.',assignee:'Учебная бригада №2',due:'2026-06-20',priority:'Низкий',status:'Принята заказчиком',comment:'Результат проверен в деморежиме',result:'Без замечаний по осмотру'}];p.trees[5].condition='Без замечаний по осмотру';
 p.surveys.forEach(s=>p.matches[s.id]=automaticMatches(p,s.id));return p;
}
// Separate geographical demonstration; the legacy site is not georeferenced.
export function syntheticSeed():Project {
 const p=legacySeed();
 p.name='Астана · Ботанический сад';
 // Fictional rows on the garden's western green area. These are not surveyed trees.
 const anchors=p.plans.map((_,i)=>({longitude:71.4130+(i%10)*0.00022,latitude:51.1066+Math.floor(i/10)*0.00022}));
 // Keep two deliberately ambiguous places for the comparison demonstration.
 anchors[1]={...anchors[0],longitude:anchors[0].longitude+0.00006};
 const oldPlans=p.plans.map(t=>({...t}));
 p.plans.forEach((t,i)=>Object.assign(t,anchors[i]));
 p.trees.forEach((t,i)=>{
  const old={...t};const base=i<56?oldPlans[i]:old;
  const target=i<56?anchors[i]:{longitude:71.413+(i-56)*0.00044,latitude:51.1081};
  const next={longitude:target.longitude+(old.longitude-base.longitude),latitude:target.latitude+(old.latitude-base.latitude)};
  p.observations.filter(o=>o.treeId===t.id).forEach(o=>Object.assign(o,{longitude:next.longitude+(o.longitude-old.longitude),latitude:next.latitude+(o.latitude-old.latitude)}));
  Object.assign(t,next,{source:'Демонстрационный объект в Ботаническом саду; не обследован'});
 });
 p.surveys.forEach(s=>p.matches[s.id]=automaticMatches(p,s.id));return p;
}
export function seed():Project {
 const p=legacySeed();p.name='Ботанический сад — центральный участок';p.plans=[];p.trees=DEMO_TREES.map(([longitude,latitude],i)=>({id:'D-C'+(i+1),longitude,latitude,species:'Не определена',createdAt:'2026-10-12T00:00:00Z',demo:true,source:'Демонстрационная разметка по базовой карте',coordinateType:'Оценка центра кроны',uncertainty:null,condition:'Не оценено'}));p.observations=[];p.tasks=[];p.matches={};p.history=[];
 p.territories=[{id:'garden',name:'Ботанический сад'},{id:'central',name:p.name,parent:'garden',boundary:BOUNDARY}];
 p.surveys=[{id:'SEP-2026',date:'2026-09-15',territoryId:'central',status:'запланировано',description:'Демонстрационный слот истории. Дата съёмки не подтверждена, материалы не загружены.',source:'Демонстрационный план обследования',demo:true,materials:[]},{id:'DEC-2026',date:'2026-12-15',territoryId:'central',status:'запланировано',description:'Будущее обследование. Съёмка ещё не выполнена.',source:'План обследования',demo:true,materials:[]}];
 p.scenario={id:'SC-central',name:'Демонстрационный вариант вдоль дуги',trees:Array.from({length:10},(_,i)=>({id:'F-C'+String(i+1).padStart(2,'0'),...ringPoint(140,100+i*1.666666667),species:'Не определена',height:4,crown:2.5}))};return p;
}
export const LEGACY_KEY='greenwatch.project.v1';
export const OLD_KEY='greenwatch.project.astana.v2';
export const KEY='talai.project.v3';
export function migrate(old:Project,local=false):Project {
 const p=seed(),base=local?legacySeed():syntheticSeed();
 // Only exact, unchanged generated records are excluded. Edited/user records retain coordinates.
 const keep=<T extends {id:string}>(items:T[],defaults:T[])=>items.filter(t=>JSON.stringify(t)!==JSON.stringify(defaults.find(d=>d.id===t.id)));
 p.trees.push(...keep(old.trees,base.trees));p.plans=keep(old.plans,base.plans);p.observations=keep(old.observations,base.observations);
 for(const o of p.observations)if(!p.trees.some(t=>t.id===o.treeId)){const t=old.trees.find(t=>t.id===o.treeId);if(t)p.trees.push(t);}
 p.tasks=keep(old.tasks,base.tasks);for(const t of p.tasks){if(!p.trees.some(x=>x.id===t.target)&&!p.plans.some(x=>x.id===t.target)){const tree=old.trees.find(x=>x.id===t.target);const plan=old.plans.find(x=>x.id===t.target);if(tree)p.trees.push(tree);else if(plan)p.plans.push(plan);}}
 p.surveys.push(...old.surveys.filter(s=>p.observations.some(o=>o.surveyId===s.id)||JSON.stringify(s)!==JSON.stringify(base.surveys.find(x=>x.id===s.id))));if(old.scenario.trees.length)p.scenario={...old.scenario,trees:[...p.scenario.trees,...old.scenario.trees]};p.history=old.history;return p;
}
export function load():{project:Project;error:string}{try{const raw=localStorage.getItem(KEY);if(raw)return {project:validateProject(JSON.parse(raw)),error:''};const geo=localStorage.getItem(OLD_KEY),old=geo||localStorage.getItem(LEGACY_KEY);return {project:old?migrate(validateProject(JSON.parse(old)),!geo):seed(),error:old?'Старый набор сохранён в архиве. Пользовательские изменения перенесены.':''};}catch{return {project:seed(),error:'Не удалось прочитать сохранение. Исходные ключи оставлены без изменений.'};}}
export function save(p:Project){localStorage.setItem(KEY,JSON.stringify(p));}
export function uid(prefix:string){return `${prefix}-${crypto.randomUUID().slice(0,8)}`;}
export function validCoord(p:Coord){return Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;}
export function validateProject(raw:unknown):Project{
 const p=raw as Project;const fail=()=>{throw Error('Некорректный проект: проверьте версию, поля, уникальные ID, координаты и связи.');};
 if(!p||p.version!==1||typeof p.name!=='string'||!Number.isFinite(p.tolerance)||p.tolerance<=0||!p.scenario||!Array.isArray(p.scenario.trees)||!p.matches||typeof p.matches!=='object')fail();
 const arrays=[p.plans,p.trees,p.observations,p.surveys,p.tasks,p.history,p.scenario.trees];for(const a of arrays){if(!Array.isArray(a)||a.length>20000)fail();const ids=new Set();for(const x of a){if(!x||typeof x.id!=='string'||!x.id||ids.has(x.id))fail();ids.add(x.id);}}
 const str=(x:object,keys:string[])=>keys.every(k=>typeof (x as Record<string,unknown>)[k]==='string');const uncertainty=(u:unknown)=>u===null||(typeof u==='number'&&Number.isFinite(u)&&u>=0);
 for(const x of [...p.plans,...p.trees,...p.observations,...p.scenario.trees])if(!validCoord(x))fail();
 for(const x of p.plans)if(!str(x,['species'])||!uncertainty(x.uncertainty))fail();
 for(const t of p.trees)if(!str(t,['species','source','condition'])||!CONDITIONS.includes(t.condition)||!['Ствол','Оценка центра кроны'].includes(t.coordinateType)||!uncertainty(t.uncertainty)||(t.replaces&&!p.trees.some(x=>x.id===t.replaces&&x.id!==t.id)))fail();
 for(const s of p.surveys){
 if(Date.parse(s.date+'T00:00:00Z')>Date.now()&&((s.status&&s.status!=='запланировано')||s.materials?.length))fail();
 if(s.materials?.length&&!s.captureAt)fail();
 if(s.status&&!['запланировано','загружено','обрабатывается','готово','ошибка'].includes(s.status))fail();
 if(s.captureAt&&(!Number.isFinite(Date.parse(s.captureAt))||(Date.parse(s.captureAt)>Date.now()&&(s.status!=='запланировано'||s.materials?.length))))fail();
 if(s.materials){if(!Array.isArray(s.materials))fail();for(const m of s.materials){if(!m.id||!m.name||!m.url.startsWith('/uploads/')||!['rgb','thermal','ortho','model','detections'].includes(m.kind))fail();if(m.coordinates&&!validCoord({longitude:m.coordinates[0],latitude:m.coordinates[1]}))fail();if(m.scale!==undefined&&(!Number.isFinite(m.scale)||m.scale<=0))fail();if(m.corners&&(m.kind!=='ortho'||m.corners.length!==2||m.corners.some(c=>!validCoord({longitude:c[0],latitude:c[1]}))||m.corners[0][0]>=m.corners[1][0]||m.corners[0][1]>=m.corners[1][1]))fail();}}
 }
 for(const s of p.surveys)if(!str(s,['date','source'])||!/^\d{4}-\d{2}-\d{2}$/.test(s.date))fail();if(!p.surveys.length)fail();
 const photo=(s?:string)=>s===undefined||(typeof s==='string'&&(/^(data:image\/(png|jpeg|webp);base64,|\/uploads\/)/.test(s))&&s.length<3000000);
 for(const o of p.observations)if(!str(o,['treeId','surveyId','visibility','note'])||!p.trees.some(t=>t.id===o.treeId)||!p.surveys.some(s=>s.id===o.surveyId)||!uncertainty(o.uncertainty)||!photo(o.photo))fail();
 for(const o of p.observations){const s=p.surveys.find(s=>s.id===o.surveyId);if(s&&new Date(s.date+'T00:00:00Z').getTime()>Date.now())fail();}
 if(new Set(p.observations.map(o=>o.treeId+'|'+o.surveyId)).size!==p.observations.length)fail();
 for(const t of p.tasks)if(!str(t,['target','reason','description','assignee','due','priority','comment','result'])||!TASK_STATES.includes(t.status)||!['Высокий','Средний','Низкий'].includes(t.priority)||!photo(t.photo)||![...p.trees,...p.plans].some(x=>x.id===t.target))fail();
 for(const t of p.scenario.trees)if(!str(t,['species'])||!Number.isFinite(t.height)||t.height<=0||t.height>40||!Number.isFinite(t.crown)||t.crown<=0||t.crown>20)fail();
 if(!str(p.scenario,['id','name']))fail();for(const h of p.history)if(!str(h,['time','action','target'])||!['Заказчик','Подрядчик'].includes(h.role))fail();
 for(const [sid,ms] of Object.entries(p.matches)){if(!p.surveys.some(s=>s.id===sid)||!Array.isArray(ms))fail();const a=new Set(),b=new Set();for(const m of ms){if(!p.plans.some(v=>v.id===m.planId)||!p.observations.some(v=>v.id===m.observationId&&v.surveyId===sid)||a.has(m.planId)||b.has(m.observationId)||typeof m.manual!=='boolean')fail();a.add(m.planId);b.add(m.observationId);}}
 return {...p,demo:DEMO};
}
export function download(name:string,body:string,type='text/csv;charset=utf-8'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([type.startsWith('text/csv')?'\uFEFF':'',body],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
export function csv(rows:Record<string,unknown>[]){if(!rows.length)return 'demo\n'+DEMO;const keys=Object.keys(rows[0]);const escape=(v:unknown)=>'"'+(typeof v==='string'?v.replace(/^[=+@-]/,"'$&"):String(v??'')).replaceAll('"','""')+'"';return [...[keys.join(',')],...rows.map(r=>keys.map(k=>escape(r[k])).join(','))].join('\r\n');}
export function parseCSV(text:string):string[][]{const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;const s=text.replace(/^\uFEFF/,'');for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}if(quoted)throw Error('Незакрытая кавычка в CSV');if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}return rows.filter(r=>r.some(v=>v.trim()));}
export function importCSV(text:string,kind:'plans'|'observations',p:Project):{rows:Record<string,string>[];errors:string[]}{
 const table=parseCSV(text),headers=table.shift()?.map(s=>s.trim())||[]; const required=kind==='plans'?['id','species','latitude','longitude','uncertainty']:['id','treeId','surveyId','latitude','longitude','uncertainty','visibility','note'];const errors:string[]=[];required.forEach(k=>{if(!headers.includes(k))errors.push(`Заголовок: отсутствует ${k}`);});if(new Set(headers).size!==headers.length)errors.push('Повтор заголовка');
 const seen=new Set(p[kind].map(x=>x.id)),obsKeys=new Set(p.observations.map(o=>o.treeId+'|'+o.surveyId));const rows=table.map((vals,i)=>{const r=Object.fromEntries(headers.map((h,j)=>[h,vals[j]?.trim()??'']));const error=(s:string)=>errors.push(`Строка ${i+2}: ${s}`);if(vals.length!==headers.length)error('число столбцов не совпадает');if(!r.id||seen.has(r.id))error('пустой или повторяющийся ID');seen.add(r.id);if(!r.latitude||!r.longitude||!validCoord({latitude:Number(r.latitude),longitude:Number(r.longitude)}))error('некорректные WGS84 координаты');if(r.uncertainty!==''&&(!Number.isFinite(Number(r.uncertainty))||Number(r.uncertainty)<0))error('ошибка координат должна быть ≥ 0 или пустой');if(kind==='plans'&&!r.species)error('не указана порода');if(kind==='observations'){if(!p.trees.some(t=>t.id===r.treeId))error('treeId отсутствует в реестре');if(!p.surveys.some(s=>s.id===r.surveyId))error('surveyId отсутствует');const key=r.treeId+'|'+r.surveyId;if(obsKeys.has(key))error('наблюдение дерева на эту дату уже существует');obsKeys.add(key);if(!r.visibility)error('укажите наблюдаемость');}return r;});if(!rows.length)errors.push('Нет строк данных');return {rows,errors};
}

export function statusAt(p:Project,treeId:string,surveyId:string){return p.observations.find(o=>o.treeId===treeId&&o.surveyId===surveyId)?.status||'Не оценено';}
