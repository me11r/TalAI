// One metric scene definition consumed by the 2D map and the 3D planner.
export type Point2 = [number, number];
export type Area = {id:string; points:Point2[]; color:string; name?:string; label?:Point2};
export const SITE_BOUNDARY:Point2[] = [[7,15],[25,5],[220,5],[246,23],[250,142],[234,174],[40,176],[8,148]];
export const LAWNS:Area[] = [
 {id:'west',points:[[17,28],[54,19],[87,30],[95,55],[88,92],[52,106],[19,88]],color:'#c6d2ad',name:'БЕРЁЗОВАЯ РОЩА',label:[48,57]},
 {id:'north',points:[[30,122],[74,107],[119,113],[139,148],[123,165],[49,166],[23,145]],color:'#bdcba5',name:'ТИХИЙ САД',label:[85,142]},
 {id:'east',points:[[159,103],[175,99],[234,104],[239,141],[225,163],[168,159],[153,135]],color:'#c8d3b5',name:'СОСНОВЫЙ САД',label:[197,143]},
 {id:'south',points:[[149,19],[205,16],[233,32],[230,76],[188,86],[154,71],[140,42]],color:'#c2d0a7',name:'НОВЫЕ ПОСАДКИ',label:[196,44]},
];
export const PATHS:{id:string;points:Point2[];width:number}[]=[
 {id:'promenade',points:[[-15,107],[21,112],[51,109],[91,96],[123,90],[158,91],[192,93],[232,91],[272,100]],width:7},
 {id:'crossing',points:[[116,-15],[121,29],[123,60],[123,90],[139,118],[147,146],[153,191]],width:6},
 {id:'loop',points:[[33,13],[16,35],[14,76],[19,112],[20,145],[43,166],[98,169],[151,169],[221,169],[241,148],[244,109],[241,62],[236,31],[217,14],[162,12],[116,13],[70,11],[33,13]],width:3},
 {id:'garden',points:[[139,118],[166,117],[182,111],[207,116],[235,131]],width:2.8},
];
export const BUILDINGS:Area[]=[{id:'context-a',points:[[-41,29],[-22,29],[-22,73],[-41,73]],color:'#c7c9c2'},{id:'context-b',points:[[275,27],[302,27],[302,67],[275,67]],color:'#c7c9c2'},{id:'context-c',points:[[278,126],[296,126],[296,157],[278,157]],color:'#c7c9c2'}];
export const BEDS:Area[]=[{id:'flowers-a',points:[[109,71],[115,67],[117,82],[112,85]],color:'#acb28a'},{id:'flowers-b',points:[[130,98],[137,97],[141,108],[135,108]],color:'#bcb391'},{id:'flowers-c',points:[[205,96],[223,94],[223,98],[207,101]],color:'#aab389'}];
export const BENCHES:Point2[] = [[97,103],[162,85],[82,101],[128,44],[221,84],[143,150]];
export function demoLocations():Point2[]{
 // Deliberate clusters and avenue rows. No random generation.
 return [
 [34,42],[38,42],[57,34],[77,44],[30,64],[53,71],[73,64],[33,86],[66,89],[85,80],
 [40,133],[55,150],[71,129],[88,157],[106,138],[116,156],[32,151],[63,116],
 [171,133],[189,125],[209,133],[229,143],[175,154],[197,155],[219,154],[221,116],
 ...Array.from({length:10},(_,i)=>[32+i*21,122-i*1.9] as Point2),
 ...Array.from({length:10},(_,i)=>[35+i*21,99-i*.9] as Point2),
 [109,27],[108,45],[108,64],[139,27],[140,47],[140,68],
 [168,32],[190,29],[216,39],[175,60],[201,63],[224,62],[159,76],[223,81],
 ];
}
export function treeShape(t:{id:string;species:string}){
 const n=[...t.id].reduce((a,c)=>a*31+c.charCodeAt(0),0)>>>0;
 const young=n%11===0; const conifer=t.species==='Сосна';const column=t.species==='Тополь';
 return {height:young?3.2:conifer?10+n%4:column?12+n%5:7+n%5,crown:young?3.6:conifer?7+n%3:column?5+n%2:8+n%5,form:conifer?'conifer':column?'column':'round',color:['#547c52','#648958','#73915e','#5e8353'][n%4],young};
}
export function crownOutline(x:number,y:number,radius:number,form='round'):Point2[]{return Array.from({length:32},(_,i)=>{const a=i/32*Math.PI*2;const r=radius*(form==='conifer'?(i%2?.84:1):1+Math.sin(a*6)*.07);return [x+Math.cos(a)*r,y+Math.sin(a)*r] as Point2;});}
export function ribbon(points:Point2[],width:number):Point2[]{const side=(sign:number)=>points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return [p[0]-dy/l*width/2*sign,p[1]+dx/l*width/2*sign] as Point2;});return [...side(1),...side(-1).reverse()];}
export type Viewport = {x:number;y:number;span:number;bearing:number};
export const DEFAULT_VIEW:Viewport = {x:126,y:90,span:300,bearing:0};
