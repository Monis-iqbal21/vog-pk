import {createDatabase} from '../src/security/database.js';
const db=createDatabase();
try{
 const now=new Date(),retention=new Date(now.getTime()-30*86400000);
 const throttles=await db.loginThrottle.deleteMany({where:{expiresAt:{lt:now}}});
 const sessions=await db.adminSession.deleteMany({where:{expiresAt:{lt:retention}}});
 console.log(`Removed ${throttles.count} expired throttle buckets and ${sessions.count} old expired sessions. Audit records retained.`);
}finally{await db.$disconnect();}
