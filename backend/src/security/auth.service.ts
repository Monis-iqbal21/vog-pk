import {Inject,Injectable,UnauthorizedException,HttpException,HttpStatus} from '@nestjs/common';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import * as argon2 from 'argon2';
import {DatabaseService} from './database.js';
import {securityConfig} from './config.js';
import {safeIdentity,userGraph} from './roles.js';

export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export const hashPassword=(password:string)=>argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
@Injectable()
export class AuthService {
 private dummyHash:Promise<string>|undefined;
 constructor(@Inject(DatabaseService) private readonly db:DatabaseService){}
 async audit(action:string,actorId?:string,metadata?:{[key:string]:string|number|boolean}){await this.db.auditLog.create({data:{action,actorId,resource:'security',metadata}});}
 async limitLogin(email:string,ip:string){
  const {secret}=securityConfig(),bucket=Math.floor(Date.now()/900000),expiresAt=new Date((bucket+2)*900000);
  const account=createHmac('sha256',secret).update(email).digest('hex');
  for(const [kind,value,limit] of [['network',ip,40],['account',email,10]] as const){
   const key=`${kind}:${createHmac('sha256',secret).update(value).digest('hex')}:${bucket}`;
   const record=await this.db.loginThrottle.upsert({where:{key},create:{key,expiresAt},update:{attempts:{increment:1}}});
   if(record.attempts>limit){if(record.attempts===limit+1)await this.audit('auth.rate_limited',undefined,{loginKey:account});throw new HttpException('Too many sign-in attempts. Try again later.',HttpStatus.TOO_MANY_REQUESTS);}
  }
  return account;
 }
 async login(email:string,password:string,ip:string){
  const loginKey=await this.limitLogin(email,ip),user=await this.db.adminUser.findUnique({where:{email},include:userGraph});
  this.dummyHash??=hashPassword(randomBytes(32).toString('hex'));
  const verified=await argon2.verify(user?.active?user.passwordHash:await this.dummyHash,password);
  if(!user?.active||!verified){await this.audit('auth.login_failed',undefined,{loginKey});throw new UnauthorizedException('Invalid email or password.');}
  const token=randomBytes(32).toString('hex'),now=new Date(),expiresAt=new Date(now.getTime()+securityConfig().absoluteMs);
  const current=await this.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201901)`;
   const current=await tx.adminUser.findUnique({where:{id:user.id},include:userGraph});
   if(!current?.active||current.passwordHash!==user.passwordHash)throw new UnauthorizedException('Invalid email or password.');
   await tx.adminSession.create({data:{userId:user.id,tokenHash:hashToken(token),expiresAt,lastActivityAt:now}});
   await tx.adminUser.update({where:{id:user.id},data:{lastLoginAt:now}});
   await tx.auditLog.create({data:{actorId:user.id,action:'auth.login_succeeded',resource:'session'}});
   return safeIdentity(current);
  });
  return {token,expiresAt:expiresAt.toISOString(),user:current};
 }
 async authenticate(token:string){
  if(!/^[a-f0-9]{64}$/.test(token))throw new UnauthorizedException('Authentication required.');
  const session=await this.db.adminSession.findUnique({where:{tokenHash:hashToken(token)},include:{user:{include:userGraph}}});
  const now=new Date(),cutoff=new Date(now.getTime()-securityConfig().idleMs);
  if(!session||session.revokedAt||session.expiresAt<=now||session.lastActivityAt<cutoff||!session.user.active){
   if(session&&!session.revokedAt)await this.db.adminSession.updateMany({where:{id:session.id,revokedAt:null},data:{revokedAt:now}});
   throw new UnauthorizedException('Authentication required.');
  }
  const refreshed=await this.db.adminSession.updateMany({where:{id:session.id,revokedAt:null,expiresAt:{gt:now},lastActivityAt:{gte:cutoff},user:{active:true}},data:{lastActivityAt:now}});
  if(!refreshed.count)throw new UnauthorizedException('Authentication required.');
  return {user:safeIdentity(session.user),sessionId:session.id};
 }
 async logout(sessionId:string,actorId:string){await this.db.$transaction(async tx=>{await tx.adminSession.updateMany({where:{id:sessionId,userId:actorId,revokedAt:null},data:{revokedAt:new Date()}});await tx.auditLog.create({data:{actorId,action:'auth.logout',resource:'session',resourceId:sessionId}});});}
}
