import {PUBLIC_DEMO} from './runtime';
import {demoTreeModel} from './treeModel';
import {mapAllowed,chooseMap} from './Privacy';
import {GltfPlugin} from '@2gis/mapgl-gltf';
import {BOUNDARY,SITE_BOUNDS} from './territory';
import {useEffect,useRef,useState} from 'react';
import {load} from '@2gis/mapgl';
import type {Map as GLMap,HtmlMarker,Polyline} from '@2gis/mapgl/types';
import {LocateFixed,Minus,Plus,Compass} from 'lucide-react';
import {results,statusAt,type Project,type Coord} from './data';
export {SITE_BOUNDS};
export type Camera={center:number[];zoom:number;pitch:number;rotation:number};
type Props={camera?:Camera;onCamera?:(c:Camera)=>void;materialSurvey?:string;p:Project;survey:string;selected:string;onSelect:(id:string)=>void;ids?:string[];comparison?:boolean;focus?:string;onPlace?:(c:Coord)=>void;view?:'2d'|'3d';draft?:Coord|null;layers?:{trees:boolean;plans:boolean;future:boolean}};
let sdkPromise:ReturnType<typeof load>|undefined;
const sdk=()=>sdkPromise??=load().catch(e=>{sdkPromise=undefined;throw e;});
export default function SiteMap(props:Props){return mapAllowed()?<EnabledMap {...props}/>:<div className="site-map map-privacy"><strong>Карта 2ГИС выключена</strong><p>Загрузка передаст 2ГИС сетевые сведения и область просмотра. Страны обработки не подтверждены. Реестр доступен без карты.</p><a href="/privacy">Подробнее о передаче</a><div className="actions"><button onClick={()=>chooseMap(true)}>Загрузить карту</button><button onClick={()=>chooseMap(false)}>Оставить выключенной</button></div></div>;}
function EnabledMap(props:Props){
 const {p,survey,selected,ids,comparison=false,view='2d',draft,layers={trees:true,plans:true,future:true}}=props;
 const el=useRef<HTMLDivElement>(null),map=useRef<GLMap|null>(null),latest=useRef(props);latest.current=props;
 const plugin=useRef<GltfPlugin|null>(null);
 const modelSpecs=useRef(new Map<string,string>());
 const [modelError,setModelError]=useState('');
 const objects=useRef<(HtmlMarker|Polyline)[]>([]),[ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[zoom,setZoom]=useState(15);
 const fit=()=>{const m=map.current;if(!m)return;m.fitBounds(SITE_BOUNDS,{padding:{top:40,bottom:90,left:35,right:60},animation:{duration:350}});m.setPitch(latest.current.view==='3d'?40:0);};
 useEffect(()=>{
  let disposed=false,fatal=false,observer:ResizeObserver|undefined,m:GLMap|undefined;setReady(false);setError('');
  const timer=setTimeout(()=>{if(!disposed)setError('Карта 2ГИС не загрузилась. Проверьте соединение, ключ и доступ к Map Tiles API. Реестр и задачи доступны.');},25000);
  const key=import.meta.env.VITE_2GIS_API_KEY;
  if(!key){clearTimeout(timer);setError('Не задан VITE_2GIS_API_KEY в .env.local. Данные доступны в реестре.');return;}
  sdk().then(api=>{
   if(disposed||!el.current)return;
   m=new api.Map(el.current,{key,center:[71.4153,51.107],zoom:18,pitch:0,rotation:0,zoomControl:false,scaleControl:true,lang:'ru',graphicsPreset:'normal'});map.current=m;if(import.meta.env.DEV)(el.current as HTMLDivElement & {talaiMap?:GLMap}).talaiMap=m;
   plugin.current=new GltfPlugin(m);if(import.meta.env.DEV)(el.current as HTMLDivElement & {talaiPlugin?:GltfPlugin}).talaiPlugin=plugin.current;plugin.current.on('click',e=>{if(latest.current.onPlace)return;if(e.target.type==='model')latest.current.onSelect(e.target.modelId);});
   m.on('moveend',()=>{if(m)latest.current.onCamera?.({center:m.getCenter(),zoom:m.getZoom(),pitch:m.getPitch(),rotation:m.getRotation()});});
   m.on('error',e=>{if(disposed)return;fatal=true;clearTimeout(timer);setError(e.type==='invalidtilekey'?'2ГИС отклонил ключ. Проверьте разрешение Map Tiles API, срок действия и ограничения домена.':'Ошибка загрузки карты 2ГИС. Проверьте сеть и настройки ключа. Реестр остаётся доступен.');});
   m.once('styleload',()=>{if(!disposed){clearTimeout(timer);setReady(true);}});
   m.on('styleloaderror',()=>{if(!disposed){fatal=true;clearTimeout(timer);setError('Не удалось загрузить стиль 2ГИС. Проверьте сеть и доступ ключа.');}});
   m.once('idle',()=>{if(!disposed){clearTimeout(timer);if(!fatal)setError('');setReady(true);}});
   m.on('zoomend',()=>{if(!disposed&&m)setZoom(m.getZoom());});
   m.on('click',e=>{const current=latest.current;if(!current.onPlace&&(e.originalEvent.target as Element)?.closest?.('.gw-marker'))return;if(current.onPlace){current.onPlace({longitude:e.lngLat[0],latitude:e.lngLat[1]});return;}
    // Small GLB crowns are difficult to pick on touch/software WebGL. Supplement the
    // plugin event with a screen-space hit tolerance for our own records only.
    if(current.view==='3d'&&current.layers?.future!==false&&m){const pitch=m.getPitch()*Math.PI/180;const hits=current.p.scenario.trees.map(t=>{const xy=m!.project([t.longitude,t.latitude]);const metersPerPixel=156543.03392*Math.cos(t.latitude*Math.PI/180)/2**m!.getZoom();const radius=Math.max(12,t.crown/2/metersPerPixel);const crownY=xy[1]-t.height*.68*Math.sin(pitch)/metersPerPixel;const d=Math.hypot(e.point[0]-xy[0],e.point[1]-crownY);return {id:t.id,d,radius};}).filter(t=>t.d<=t.radius).sort((a,b)=>a.d-b.d);if(hits[0])current.onSelect(hits[0].id);}
});
   fit();observer=new ResizeObserver(()=>{m?.invalidateSize();const current=latest.current;const t=current.p.trees.find(t=>t.id===current.selected)||current.p.scenario.trees.find(t=>t.id===current.selected);if(t)m?.setCenter([t.longitude,t.latitude]);else fit();});observer.observe(el.current);
  }).catch(()=>{if(!disposed){clearTimeout(timer);setError('Не удалось запустить 2ГИС. Проверьте доступ к mapgl.2gis.com и поддержку WebGL.');}});
  return()=>{disposed=true;clearTimeout(timer);observer?.disconnect();objects.current.forEach(o=>o.destroy());objects.current=[];plugin.current?.destroy();plugin.current=null;modelSpecs.current.clear();m?.destroy();map.current=null;};
 },[attempt]);
 useEffect(()=>{map.current?.patchStyleState({graphicsPreset:view==='3d'?'immersive':'normal'});map.current?.setPitch(view==='3d'?40:0,{duration:350});},[view,ready]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready)return;let disposed=false;
  objects.current.forEach(o=>o.destroy());objects.current=[];
  sdk().then(api=>{if(disposed)return;
   objects.current.push(new api.Polyline(m,{coordinates:[...BOUNDARY,BOUNDARY[0]],width:2,color:'#297c76'}));
   const add=(c:Coord,id:string,symbol:string,kind:string,title:string)=>{const button=document.createElement('button');button.style.pointerEvents=props.onPlace?'none':'auto';button.className='gw-marker '+kind+(id===selected?' selected':'');button.textContent=symbol;button.title=title;button.setAttribute('aria-label',title);button.dataset.objectId=id;button.onclick=e=>{if(latest.current.onPlace)return;e.stopPropagation();if(id!=='draft')latest.current.onSelect(id);};
    objects.current.push(new api.HtmlMarker(m,{coordinates:[c.longitude,c.latitude],html:button,anchor:[9,9],minZoom:id===selected||id==='draft'?0:kind==='future'?14:16,preventMapInteractions:!props.onPlace,zIndex:id===selected?5:2}));};
   const group=p.trees.filter(t=>!ids||ids.includes(t.id));
   if(layers.trees&&group.length){const button=document.createElement('button');button.className='gw-marker group';button.textContent=String(group.length);button.setAttribute('aria-label','Показать деревья: '+group.length);button.title='Деревья TalAI — приблизить';button.onclick=e=>{e.stopPropagation();m.setCenter([group.reduce((s,t)=>s+t.longitude,0)/group.length,group.reduce((s,t)=>s+t.latitude,0)/group.length]);m.setZoom(18,{duration:350});};objects.current.push(new api.HtmlMarker(m,{coordinates:[group.reduce((s,t)=>s+t.longitude,0)/group.length,group.reduce((s,t)=>s+t.latitude,0)/group.length],html:button,anchor:[19,19],maxZoom:16,preventMapInteractions:true}));}
   if(layers.trees)p.trees.filter(t=>!ids||ids.includes(t.id)).forEach(t=>{const o=p.observations.find(o=>o.treeId===t.id&&o.surveyId===survey);const condition=statusAt(p,t.id,survey);const problem=condition==='Проблема подтверждена специалистом',check=condition==='Требуется осмотр'||o?.visibility==='Частично перекрыто';add(o||t,t.id,problem?'×':check?'!':'•',problem?'problem':check?'check':'existing','Дерево '+t.id+' · '+condition);});
   if(comparison&&layers.plans){p.plans.forEach(t=>add(t,t.id,'□','plan','План '+t.id));if(layers.trees)(p.matches[survey]||[]).forEach(pair=>{const a=p.plans.find(t=>t.id===pair.planId),b=p.observations.find(o=>o.id===pair.observationId);if(a&&b&&(!ids||ids.includes(b.treeId)))objects.current.push(new api.Polyline(m,{coordinates:[[a.longitude,a.latitude],[b.longitude,b.latitude]],width:2,color:results(p,survey).find(r=>r.planId===a.id)?.status==='В допуске'?'#28754d':'#b77815',minZoom:14}));});}
   if(layers.future&&view==='2d')p.scenario.trees.forEach(t=>add(t,t.id,'+','future','Запланировано '+t.id));if(draft)add(draft,'draft','+','draft','Место новой посадки');
  });return()=>{disposed=true;};
 },[p,survey,selected,ids?.join('|'),comparison,ready,attempt,draft,!!props.onPlace,layers.trees,layers.plans,layers.future,view]);
 useEffect(()=>{const key=props.focus||selected;const t=p.observations.find(o=>o.treeId===key&&o.surveyId===survey)||p.trees.find(t=>t.id===key)||p.plans.find(t=>t.id===key)||p.scenario.trees.find(t=>t.id===key);if(t&&ready){map.current?.setCenter([t.longitude,t.latitude],{duration:300});if(map.current!.getZoom()<17)map.current?.setZoom(17,{duration:300});}},[selected,props.focus,survey,ready]);
 useEffect(()=>{const gl=plugin.current;if(!gl||!ready)return;let disposed=false;setModelError('');
 const models=layers.future?p.scenario.trees.map(t=>({modelId:t.id,modelUrl:`/api/tree-model?height=${t.height}&crown=${t.crown}`,coordinates:[t.longitude,t.latitude] as [number,number],interactive:true})):[];
 const materialModels=(p.surveys.find(s=>s.id===props.materialSurvey)?.materials||[]).filter(f=>f.kind==='model'&&f.coordinates).map(f=>({modelId:f.id,modelUrl:f.url,coordinates:f.coordinates!,scale:f.scale||1,interactive:false}));
 const all=[...models,...materialModels];
 void (async()=>{
  const resolved=await Promise.all(all.map(async t=>{const tree=p.scenario.trees.find(v=>v.id===t.modelId);return PUBLIC_DEMO&&tree?{...t,modelUrl:await demoTreeModel(tree.height,tree.crown)}:t;}));
  if(disposed)return;
  const desired=new Map(resolved.map(t=>[t.modelId,JSON.stringify(t)]));
  const removed=[...modelSpecs.current.keys()].filter(id=>modelSpecs.current.get(id)!==desired.get(id));
  if(removed.length)gl.removeModels(removed);
  const changed=resolved.filter(t=>modelSpecs.current.get(t.modelId)!==desired.get(t.modelId));modelSpecs.current=desired;
  if(changed.length)try{await gl.addModels(changed);}catch(e){for(const t of changed)if(modelSpecs.current.get(t.modelId)===desired.get(t.modelId))modelSpecs.current.delete(t.modelId);throw e;}
 })().catch(e=>{if(!disposed)setModelError('Не удалось загрузить 3D-модели: '+String(e));});
 return()=>{disposed=true;};
 },[ready,JSON.stringify(p.scenario.trees),layers.future,props.materialSurvey,JSON.stringify(p.surveys)]);
 useEffect(()=>{if(!ready||!map.current||!props.camera)return;const m=map.current,c=props.camera;if(Math.abs(m.getCenter()[0]-c.center[0])>1e-8||Math.abs(m.getCenter()[1]-c.center[1])>1e-8)m.setCenter(c.center);if(Math.abs(m.getZoom()-c.zoom)>1e-6)m.setZoom(c.zoom);if(m.getPitch()!==c.pitch)m.setPitch(c.pitch);if(m.getRotation()!==c.rotation)m.setRotation(c.rotation);},[props.camera,ready]);
 useEffect(()=>{const m=map.current;if(!m||!ready)return;let cancelled=false;const rasters:{destroy:()=>void}[]=[];sdk().then(api=>{if(cancelled)return;for(const f of p.surveys.find(s=>s.id===props.materialSurvey)?.materials||[]){if(f.kind==='ortho'&&f.corners?.length===2&&['image/png','image/jpeg','image/webp'].includes(f.mime))rasters.push(new api.Raster(m,{bounds:{southWest:f.corners[0],northEast:f.corners[1]},image:{url:f.url},opacity:.85}));}});return()=>{cancelled=true;rasters.forEach(r=>r.destroy());};},[props.materialSurvey,JSON.stringify(p.surveys),ready]);
 return <div className={'site-map gis-map'+(props.onPlace?' placing':'')} data-map-state={error?'error':ready?'ready':'loading'}><div ref={el} className="map-canvas"/>{modelError&&<div className="model-error" role="alert">{modelError}</div>}{(!ready||error)&&<div className="map-state" role={error?'alert':'status'}><strong>{error?'Карта недоступна':'Загрузка карты 2ГИС…'}</strong><p>{error||'Астана · Ботанический сад'}</p>{error&&<button onClick={()=>setAttempt(x=>x+1)}>Повторить загрузку</button>}</div>}
 <div className="terrain-tools"><button aria-label="Приблизить" onClick={()=>map.current?.setZoom(map.current.getZoom()+1)}><Plus size={18}/></button><button aria-label="Отдалить" onClick={()=>map.current?.setZoom(map.current.getZoom()-1)}><Minus size={18}/></button><button aria-label="Весь участок" title="Вернуться к Ботаническому саду" onClick={fit}><LocateFixed size={18}/></button><button aria-label="Север сверху" onClick={()=>map.current?.setRotation(0,{duration:300})}><Compass size={18}/></button><button aria-label="Повернуть карту" title="Повернуть на 30°" onClick={()=>map.current?.setRotation(map.current.getRotation()+30,{duration:300})}>↻</button></div>{ready&&zoom<16&&<div className="zoom-hint">Приблизьте карту для просмотра объектов TalAI</div>}</div>;
}
