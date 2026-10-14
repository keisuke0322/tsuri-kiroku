import {ApiError} from '../access';

export function guestPublicInput(body:Record<string,unknown>,fallback=false):boolean {
 if(!Object.hasOwn(body,'guestPublic'))return fallback;
 if(typeof body.guestPublic!=='boolean')throw new ApiError(400,'ゲストへの公開設定を確認してください。');
 return body.guestPublic;
}
