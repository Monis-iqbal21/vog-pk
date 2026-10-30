import {Controller,Get,Header,Inject,ServiceUnavailableException} from '@nestjs/common';
import {Public} from './security/guards.js';
import {DatabaseService} from './security/database.js';

// A slow database cannot accumulate a new query on every monitoring request.
@Controller('health')
export class ReadinessController {
 private pending:Promise<unknown>|undefined;
 constructor(@Inject(DatabaseService) private readonly db:DatabaseService){}
 @Get('ready') @Public()
 @Header('Cache-Control','no-store')
 @Header('X-Robots-Tag','noindex, nofollow')
 async ready(){
  if(!this.pending){
   this.pending=Promise.resolve().then(()=>this.db.$queryRaw`SELECT 1`);
   const current=this.pending;
   void current.finally(()=>{if(this.pending===current)this.pending=undefined;}).catch(()=>{});
  }
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   await Promise.race([this.pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Readiness timeout')),3000);})]);
   return {status:'ok'};
  }catch{throw new ServiceUnavailableException('Service is not ready.');}
  finally{if(timer)clearTimeout(timer);}
 }
}
