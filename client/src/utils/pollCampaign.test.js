import {pollCampaign} from './pollCampaign';
beforeEach(()=>jest.useFakeTimers());afterEach(()=>jest.useRealTimers());
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
test.each(['reject','hang'])('deadline ends polling when requests %s',async kind=>{
 const expired=jest.fn(),confirmed=jest.fn();const check=jest.fn(()=>kind==='reject'?Promise.reject(Error('offline')):new Promise(()=>{}));
 pollCampaign({check,onExpired:expired,onConfirmed:confirmed,interval:10,timeout:100,immediate:true});
 for(let i=0;i<12;i++){jest.advanceTimersByTime(10);await flush();}
 expect(expired).toHaveBeenCalledTimes(1);expect(confirmed).not.toHaveBeenCalled();expect(jest.getTimerCount()).toBe(0);
});
test('cancellation ignores a late response',async()=>{let resolve;const confirmed=jest.fn();const cancel=pollCampaign({check:()=>new Promise(r=>resolve=r),onExpired:jest.fn(),onConfirmed:confirmed,immediate:true});jest.advanceTimersByTime(1);cancel();resolve({success:true,campaignCreated:true,campaign:{id:'paid'}});await flush();expect(confirmed).not.toHaveBeenCalled();expect(jest.getTimerCount()).toBe(0);});
test('confirmation runs once and clears the deadline',async()=>{const confirmed=jest.fn();pollCampaign({check:async()=>({success:true,campaignCreated:true,campaign:{id:'paid'}}),onExpired:jest.fn(),onConfirmed:confirmed,immediate:true});jest.advanceTimersByTime(1);await flush();expect(confirmed).toHaveBeenCalledWith({id:'paid'});expect(jest.getTimerCount()).toBe(0);});
