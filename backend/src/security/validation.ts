import {BadRequestException} from '@nestjs/common';
import {z} from 'zod';
const email=z.string().trim().toLowerCase().email().max(254);
export const passwordSchema=z.string().min(16).max(128).refine(value=>/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/\d/.test(value)&&/[^\w\s]/.test(value)&&!/(password|qwerty|letmein|admin123)/i.test(value),'Use 16–128 characters with upper/lower case, a number and a symbol; avoid common passwords.');
export const loginSchema=z.object({email,password:z.string().min(1).max(128)}).strict();
const roleCodes=z.array(z.string().regex(/^[A-Z_]+$/)).min(1).max(10).refine(values=>new Set(values).size===values.length);
export const createStaffSchema=z.object({name:z.string().trim().min(2).max(100),email,password:passwordSchema,roles:roleCodes}).strict();
export const updateStaffSchema=z.object({active:z.boolean().optional(),roles:roleCodes.optional()}).strict().refine(value=>value.active!==undefined||value.roles!==undefined);
export function validate<T>(schema:z.ZodType<T>,body:unknown):T{const result=schema.safeParse(body);if(!result.success)throw new BadRequestException('Invalid request. Check the supplied fields.');return result.data;}
export const validId=(id:string)=>validate(z.uuid(),id);
