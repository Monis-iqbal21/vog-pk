import 'server-only';
import {resolveAdminSettings} from './url-settings.js';
export const adminConfig=()=>resolveAdminSettings(process.env);
export const cookieOptions=secure=>({httpOnly:true,secure,sameSite:'strict',path:'/',priority:'high'});
