import {readResponse} from './readResponse';
test('preserves JSON error messages', async()=>{await expect(readResponse({ok:false,status:400,json:async()=>({message:'No creator slots available.'})})).rejects.toThrow('No creator slots available.');});
test('non-JSON errors have a useful status fallback', async()=>{await expect(readResponse({ok:false,status:503,json:async()=>{throw Error('HTML');}})).rejects.toThrow('HTTP 503');});
test('successful payload remains unchanged', async()=>{await expect(readResponse({ok:true,json:async()=>({success:true,wallet:{balance:15000}})})).resolves.toEqual({success:true,wallet:{balance:15000}});});
