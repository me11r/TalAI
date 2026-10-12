import type {Coord} from './data';
export const CENTER:Coord={longitude:71.41631235712714,latitude:51.1063265326224};
export const local=(east:number,north:number):Coord=>({longitude:CENTER.longitude+east/(111320*Math.cos(CENTER.latitude*Math.PI/180)),latitude:CENTER.latitude+north/111320});
// North-west sector of the central circular garden. WGS84, never screen coordinates.
export const ringPoint=(radius:number,angle:number)=>local(Math.cos(angle*Math.PI/180)*radius,Math.sin(angle*Math.PI/180)*radius);
// Vertices checked against the current 2GIS view: lawn and a narrow adjoining tree strip.
export const BOUNDARY:[number,number][]=[[71.415193,51.107581],[71.416195,51.107581],[71.415928,51.107231],[71.415677,51.107193],[71.415393,51.107361]];
export const DEMO_TREES:[number,number][]=[[71.4154092,51.1074043],[71.4155422,51.1073327],[71.4156510,51.1072890],[71.4159291,51.1072915]];
export const SITE_BOUNDS={southWest:[Math.min(...BOUNDARY.map(c=>c[0])),Math.min(...BOUNDARY.map(c=>c[1]))],northEast:[Math.max(...BOUNDARY.map(c=>c[0])),Math.max(...BOUNDARY.map(c=>c[1]))]};
export function inside(c:Coord){let yes=false;for(let i=0,j=BOUNDARY.length-1;i<BOUNDARY.length;j=i++){const a=BOUNDARY[i],b=BOUNDARY[j];if((a[1]>c.latitude)!==(b[1]>c.latitude)&&c.longitude<(b[0]-a[0])*(c.latitude-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
