import nextEnv from '@next/env';
import {resolveAdminSettings} from '../src/lib/url-settings.js';
nextEnv.loadEnvConfig(process.cwd());
try{const cfg=resolveAdminSettings(process.env);console.log(cfg.preview&&!cfg.authEnabled?'Admin preview configuration validated; authentication and backend access are disabled.':'Admin URL and cookie configuration validated.');}
catch(error){console.error(error.message);process.exitCode=1;}
