import {config} from 'dotenv';
import {defineConfig} from 'prisma/config';
config({path:'.env.local',quiet:true});
export default defineConfig({schema:'prisma/schema.prisma',migrations:{path:'prisma/migrations',seed:'tsx prisma/seed.ts'},datasource:{url:process.env.DATABASE_URL??'postgresql://unconfigured@localhost:5432/vog_admin_unconfigured'}});
