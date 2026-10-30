import {listenOptions} from './listen-options.js';
describe('API binding',()=>{
 it('keeps production on loopback without an environment change',()=>expect(listenOptions({NODE_ENV:'production'})).toEqual({host:'127.0.0.1',port:4000}));
 it('preserves explicit local network development',()=>expect(listenOptions({NODE_ENV:'development'}).host).toBe('0.0.0.0'));
 it('supports an explicit binding and port',()=>expect(listenOptions({HOST:'::1',PORT:'4100'})).toEqual({host:'::1',port:4100}));
 it('rejects malformed binding values',()=>{for(const HOST of ['','https://localhost','127.0.0.1:4000','example.com'])expect(()=>listenOptions({HOST})).toThrow();});
 it('rejects malformed/out-of-range ports',()=>{for(const PORT of ['','0','65536','4e3','4000/path','-1'])expect(()=>listenOptions({PORT})).toThrow();});
});
