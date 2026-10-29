import {Test} from '@nestjs/testing';
import type {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {vi} from 'vitest';
import {AppModule} from '../src/app.module.js';
import {DatabaseService} from '../src/security/database.js';

describe('Public readiness HTTP contract',()=>{
 let app:INestApplication;
 const query=vi.fn();
 beforeAll(async()=>{
  const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(DatabaseService).useValue({$queryRaw:query}).compile();
  app=module.createNestApplication();app.setGlobalPrefix('api');await app.init();
 });
 afterAll(async()=>{await app.close();});
 it('returns uncached generic success when the database answers',async()=>{
  query.mockResolvedValueOnce([{privateData:'not returned'}]);
  const response=await request(app.getHttpServer()).get('/api/health/ready').expect(200).expect({status:'ok'});
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['x-robots-tag']).toContain('noindex');
 });
 it('returns 503 without connection diagnostics when the database fails',async()=>{
  query.mockRejectedValueOnce(new Error('private database connection diagnostic'));
  const response=await request(app.getHttpServer()).get('/api/health/ready').expect(503);
  expect(response.body.message).toBe('Service is not ready.');
  expect(response.text).not.toContain('private database');
 });
});
