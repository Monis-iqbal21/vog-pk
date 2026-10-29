import {vi} from 'vitest';
import {ReadinessController} from './readiness.controller.js';
import type {DatabaseService} from './security/database.js';
describe('Database readiness',()=>{
 it('checks the database without returning internal details',async()=>{
  const query=vi.fn().mockResolvedValue([{secret:'must not render'}]);
  expect(await new ReadinessController({$queryRaw:query} as unknown as DatabaseService).ready()).toEqual({status:'ok'});
  expect(query).toHaveBeenCalledOnce();
 });
 it('returns a generic 503 on database failure',async()=>{
  const controller=new ReadinessController({$queryRaw:vi.fn().mockRejectedValue(new Error('private connection details'))} as unknown as DatabaseService);
  await expect(controller.ready()).rejects.toMatchObject({status:503,message:'Service is not ready.'});
 });
 it('bounds response time and shares an outstanding slow query',async()=>{
  vi.useFakeTimers();
  try{
   const query=vi.fn().mockReturnValue(new Promise(()=>{}));
   const controller=new ReadinessController({$queryRaw:query} as unknown as DatabaseService);
   const first=expect(controller.ready()).rejects.toMatchObject({status:503});
   const second=expect(controller.ready()).rejects.toMatchObject({status:503});
   await vi.advanceTimersByTimeAsync(3000);await Promise.all([first,second]);
   expect(query).toHaveBeenCalledOnce();
  }finally{vi.useRealTimers();}
 });
});
