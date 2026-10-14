import type {LocationEntry} from './location-privacy';
export type CatchPhoto={id:number;species:string;src?:string};
export type CatchEntry=LocationEntry&{
 id:number;date:string;location:string;fish:{id?:number;species:string;count:number;length:number|null}[];
 photos:CatchPhoto[];featured_photo_id:number|null;method:string;memo:string;created_at:string;
 owner_id?:string;authorName:string;likeCount:number;liked:boolean;guestPublic:boolean;
};
