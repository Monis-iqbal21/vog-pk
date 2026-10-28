import nextEnv from '@next/env';
import {resolveAdminSettings} from '../src/lib/url-settings.js';
nextEnv.loadEnvConfig(process.cwd());
try{resolveAdminSettings(process.env);console.log('Admin URL and cookie configuration validated.');}
catch(error){console.error(error.message);process.exitCode=1;}
