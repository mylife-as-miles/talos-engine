import { describe,it,expect } from 'vitest';
import { parseMcpResult } from '../mcp/parseMcpResult.js';
describe('parseMcpResult',()=>{it('parses JSON text content',()=>{expect(parseMcpResult({content:[{type:'text',text:'{"runId":"1"}'}]})).toEqual({runId:'1'})}); it('throws plain text errors',()=>{expect(()=>parseMcpResult({isError:true,content:[{type:'text',text:'bad token xoxb-123'}]})).toThrow(/bad token \[REDACTED\]/)})});
