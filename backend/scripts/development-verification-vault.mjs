// Windows-user-bound credential storage, never a plaintext fixture/default.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const vaultPath=fileURLToPath(new URL('../.local/development-auth-verification.dpapi',import.meta.url));
function protect(value,decrypt=false){
 if(process.platform!=='win32')throw new Error('This development vault requires Windows DPAPI');
 const prefix="[void][System.Reflection.Assembly]::LoadWithPartialName('System.Security');";
 const command=prefix+(decrypt?"$v=[Convert]::FromBase64String([Console]::In.ReadToEnd());[Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($v,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))":"$v=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd());[Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($v,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))");
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{input:value,encoding:'utf8',windowsHide:true});
 if(result.status!==0||!result.stdout)throw new Error('DPAPI credential protection failed');
 return result.stdout.trim();
}
export async function readVerificationAccounts(){return JSON.parse(protect(await fs.readFile(vaultPath,'utf8'),true));}
export async function writeVerificationAccounts(accounts){await fs.mkdir(path.dirname(vaultPath),{recursive:true});await fs.writeFile(vaultPath,protect(JSON.stringify(accounts)),{mode:0o600});}
export function verifyVault(){if(protect(protect('non-secret verification probe'),true)!=='non-secret verification probe')throw new Error('DPAPI verification failed');}
