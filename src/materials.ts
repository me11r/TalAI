import {PUBLIC_DEMO,DEMO_UPLOAD_NOTICE} from './runtime';
import type {Material} from './data';
export async function uploadOriginal(file:File):Promise<Omit<Material,'kind'>>{
 if(PUBLIC_DEMO)throw Error(DEMO_UPLOAD_NOTICE);
 const send=async(blob:Blob,name:string)=>{const r=await fetch('/api/upload?name='+encodeURIComponent(name),{method:'POST',body:blob});const data=await r.json();if(!r.ok)throw Error(data.error);return data;};
 const original=await send(file,file.name);
 if(['image/jpeg','image/png','image/webp'].includes(file.type)){
  // A separate derivative; never modify or replace the uploaded original.
  try{const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const scale=Math.min(1,480/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.8));if(blob)original.previewUrl=(await send(blob,'preview-'+file.name.replace(/\.[^.]+$/,'')+'.webp')).url;}catch{/* Original remains available when a preview cannot be decoded. */}
 }
 return original;
}
export async function exportCleanImage(url:string){
 const r=await fetch(url);if(!r.ok)throw Error('Нет доступа к оригиналу');const bitmap=await createImageBitmap(await r.blob());const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d')!.drawImage(bitmap,0,0);bitmap.close();const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Не удалось подготовить копию');const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='talai-export.png';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}
