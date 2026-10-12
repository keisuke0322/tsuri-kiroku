import type {Position} from './fishing-position';
export type LocationVisibility='area'|'exact'|'private';
export type PublicArea={latitude:number;longitude:number;radius:number};
export type LocationEntry={id:number;location:string;position:Position|null;publicArea:PublicArea|null;locationVisibility:LocationVisibility;locationHidden:boolean};
export function parseVisibility(value:unknown):LocationVisibility|null {
 return value==='area'||value==='exact'||value==='private'?value:null;
}
// A fixed 0.1-degree cell has a diagonal below 16 km, even at the equator.
// Publish its center only, never the actual position as the circle center.
export function approximateArea(position:Position):PublicArea {
 const center=(value:number,offset:number)=>Number((Math.min(Math.floor((value+offset)*10+1e-9),offset*20-1)/10-offset+0.05).toFixed(2));
 return {latitude:center(position.latitude,90),longitude:center(position.longitude,180),radius:8000};
}
