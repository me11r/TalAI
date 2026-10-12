import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {mkdirSync,writeFileSync} from 'node:fs';
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result='data:application/octet-stream;base64,'+Buffer.from(v).toString('base64');this.onloadend?.();});}};
const parts=[];const materials=[];
function add(g,color){if(g.index)g=g.toNonIndexed();const colors=[];for(let i=0;i<g.attributes.position.count;i++)colors.push(...new THREE.Color(color).toArray());materials.push(new THREE.MeshStandardMaterial({color,roughness:1}));g.deleteAttribute('uv');parts.push(g);}
function branch(a,b,r){const dir=b.clone().sub(a);const g=new THREE.CylinderGeometry(r*.5,r,dir.length(),7);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,'#78604a');}
branch(new THREE.Vector3(),new THREE.Vector3(.08,4.6,0),.17);
for(let i=0;i<13;i++){const a=i*2.39996,r=.65+(i%3)*.25,y=2.6+i*.16;const end=new THREE.Vector3(Math.cos(a)*r,y+.8,Math.sin(a)*r);branch(new THREE.Vector3(0,y-.7,0),end,.07);const g=new THREE.IcosahedronGeometry(.9,1);g.scale(1,.85+(i%4)*.12,.85);g.translate(...end.toArray());add(g,['#547746','#658949','#789851','#487040'][i%4]);}
const g=mergeGeometries(parts,true);g.computeBoundingBox();const b=g.boundingBox;g.translate(0,-b.min.y,0);g.scale(4/(b.max.x-b.min.x),6/(b.max.y-b.min.y),4/(b.max.z-b.min.z));
const mesh=new THREE.Mesh(g,materials);const scene=new THREE.Scene();scene.add(mesh);
const result=await new GLTFExporter().parseAsync(scene,{binary:true});mkdirSync('public/models',{recursive:true});writeFileSync('public/models/talai-tree.glb',Buffer.from(result));console.log('Own GLB',result.byteLength,'bytes');
