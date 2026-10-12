// Own GLB, resized locally for the static demo. The trunk origin stays on the ground.
let original:Promise<ArrayBuffer>|undefined;
const variants=new Map<string,Promise<string>>();
export function demoTreeModel(height:number,crown:number):Promise<string>{
 if(!(height>0&&height<=40&&crown>0&&crown<=20))return Promise.reject(Error('Некорректный размер модели'));
 const key=height+':'+crown;
 if(!variants.has(key)){
  original??=fetch('/models/talai-tree.glb').then(r=>{if(!r.ok)throw Error('Модель недоступна');return r.arrayBuffer();}).catch(e=>{original=undefined;throw e;});
  const result=original.then(buffer=>{
   const view=new DataView(buffer),length=view.getUint32(12,true);
   const doc=JSON.parse(new TextDecoder().decode(buffer.slice(20,20+length)));
   doc.nodes[0].scale=[crown/4,height/6,crown/4];
   const json=new TextEncoder().encode(JSON.stringify(doc)),padded=Math.ceil(json.length/4)*4;
   const out=new Uint8Array(20+padded+buffer.byteLength-20-length);
   out.set(new Uint8Array(buffer,0,20));out.fill(32,20,20+padded);out.set(json,20);out.set(new Uint8Array(buffer,20+length),20+padded);
   const header=new DataView(out.buffer);header.setUint32(8,out.length,true);header.setUint32(12,padded,true);
   return URL.createObjectURL(new Blob([out],{type:'model/gltf-binary'}));
  }).catch(e=>{variants.delete(key);throw e;});
  variants.set(key,result);
 }
 return variants.get(key)!;
}
// URLs remain valid while the plugin may reference them; release with the page.
window.addEventListener('pagehide',(event)=>{if(event.persisted)return;for(const url of variants.values())void url.then(URL.revokeObjectURL,()=>{});variants.clear();});
