import {Injectable,OnModuleDestroy} from '@nestjs/common';
import {PrismaClient} from '../generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import './config.js';
export function createDatabase(url=process.env.DATABASE_URL){
 if(!url)throw new Error('DATABASE_URL is required');
 return new PrismaClient({adapter:new PrismaPg({connectionString:url,max:10})});
}
@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleDestroy {
 constructor(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');super({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL,max:10})});}
 async onModuleDestroy(){await this.$disconnect();}
}
