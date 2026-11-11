import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Studios from './Studios';
import { validateStudioFiles } from './StudioWorkspace';
import MyAds from './MyAds';
jest.mock('axios',()=>({get:jest.fn(),patch:jest.fn(),delete:jest.fn()}));
jest.mock('../components/QuickAdHistoryVideo',()=>()=> <div>Video preview</div>);
let host,root;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;process.env.REACT_APP_API_URL='https://api.test';host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);axios.get.mockReset();});
afterEach(()=>{act(()=>root.unmount());host.remove();jest.restoreAllMocks();});
async function render(component){await act(async()=>root.render(<MemoryRouter><AuthContext.Provider value={{user:{id:'owner',role:'company'},token:'token'}}>{component}</AuthContext.Provider></MemoryRouter>));}
test('all five studios display with destinations and unavailable modes labelled',async()=>{axios.get.mockImplementation(url=>Promise.resolve({data:url.includes('catalog')?{modes:[{studio:'auto',mode:'auto_cinematic',available:false,credits:4}],models:[]}:{quickAdCredits:12}}));await render(<Studios/>);expect(host.querySelector('h1').textContent).toBe('What are you advertising today?');expect(host.querySelectorAll('.sf-studio-card')).toHaveLength(5);expect(host.textContent).toContain('12 credits available');expect(host.querySelector('a[href="/studios/auto"]').textContent).toBe('Coming soon');expect(host.querySelector('a[href="/studios/fashion"]')).not.toBeNull();});
test('client upload validation rejects oversize, empty, wrong types and excessive images',()=>{const f={type:'image/png',size:100};expect(validateStudioFiles([f])).toBe(true);expect(validateStudioFiles([])).toBe(false);expect(validateStudioFiles([{...f,size:9*1024*1024}])).toBe(false);expect(validateStudioFiles([{...f,type:'image/svg+xml'}])).toBe(false);expect(validateStudioFiles(Array(6).fill(f))).toBe(false);});
test('history filters request server filtering and deletion removes only the selected row',async()=>{axios.get.mockResolvedValue({data:{generations:[{generationId:'one',title:'Shoe ad',status:'completed',studioType:'product',duration:5,creditsUsed:1,createdAt:'2026-11-11',downloadable:true}]}});axios.delete.mockResolvedValue({data:{success:true}});jest.spyOn(window,'confirm').mockReturnValue(true);await render(<MyAds/>);expect(host.textContent).toContain('Shoe ad');await act(async()=>[...host.querySelectorAll('nav button')].find(b=>b.textContent==='Products').click());expect(axios.get.mock.calls.at(-1)[0]).toContain('studio=product');await act(async()=>host.querySelector('[aria-label="Delete advertisement"]').click());expect(axios.delete.mock.calls[0][0]).toContain('/generations/one');expect(host.textContent).not.toContain('Shoe ad');});
