/* eslint-disable testing-library/no-unnecessary-act -- This suite uses React DOM createRoot directly, not Testing Library. */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Studios from './Studios';
import StudioWorkspace, { validateStudioFiles } from './StudioWorkspace';
import MyAds from './MyAds';
jest.mock('axios',()=>({get:jest.fn(),patch:jest.fn(),delete:jest.fn()}));
jest.mock('../components/QuickAdHistoryVideo',()=>()=> <div>Video preview</div>);
let host,root;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;process.env.REACT_APP_API_URL='https://api.test';host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);axios.get.mockReset();});
afterEach(()=>{act(()=>root.unmount());host.remove();jest.restoreAllMocks();});
// React DOM createRoot requires act; this suite does not use Testing Library render.
// eslint-disable-next-line testing-library/no-unnecessary-act
async function mountScreen(component){await act(async()=>root.render(<MemoryRouter><AuthContext.Provider value={{user:{id:'owner',role:'company'},token:'token'}}>{component}</AuthContext.Provider></MemoryRouter>));}
test('all five studios display with destinations and unavailable modes labelled',async()=>{axios.get.mockImplementation(url=>Promise.resolve({data:url.includes('catalog')?{modes:[{studio:'auto',mode:'auto_cinematic',available:false,credits:4}],models:[]}:{quickAdCredits:12}}));await mountScreen(<Studios/>);expect(host.querySelector('h1').textContent).toBe('What are you advertising today?');expect(host.querySelectorAll('.sf-studio-card')).toHaveLength(5);expect(host.textContent).toContain('12 credits available');expect(host.querySelector('a[href="/studios/auto"]').getAttribute('aria-label')).toBe('Coming soon');expect(host.querySelector('a[href="/studios/fashion"]')).not.toBeNull();});
test('client upload validation rejects oversize, empty, wrong types and excessive images',()=>{const f={type:'image/png',size:100};expect(validateStudioFiles([f])).toBe(true);expect(validateStudioFiles([])).toBe(false);expect(validateStudioFiles([{...f,size:9*1024*1024}])).toBe(false);expect(validateStudioFiles([{...f,type:'image/svg+xml'}])).toBe(false);expect(validateStudioFiles(Array(6).fill(f))).toBe(false);});
test('history filters request server filtering and deletion removes only the selected row',async()=>{axios.get.mockResolvedValue({data:{generations:[{generationId:'one',title:'Shoe ad',status:'completed',studioType:'product',duration:5,creditsUsed:1,createdAt:'2026-11-11',downloadable:true}]}});axios.delete.mockResolvedValue({data:{success:true}});jest.spyOn(window,'confirm').mockReturnValue(true);await mountScreen(<MyAds/>);expect(host.textContent).toContain('Shoe ad');await act(async()=>[...host.querySelectorAll('nav button')].find(b=>b.textContent==='Products').click());expect(axios.get.mock.calls.at(-1)[0]).toContain('studio=product');await act(async()=>host.querySelector('[aria-label="Delete advertisement"]').click());expect(axios.delete.mock.calls[0][0]).toContain('/generations/one');expect(host.textContent).not.toContain('Shoe ad');});


test('catalog failures keep studios explorable instead of claiming they are coming soon', async () => {
  axios.get.mockImplementation(url => url.includes('catalog') ? Promise.reject(new Error('Offline')) : Promise.resolve({data:{quickAdCredits:12}}));
  await mountScreen(<Studios />);
  expect(host.querySelector('a[href="/studios/auto"]').getAttribute('aria-label')).toBe('Explore studio');
  expect(host.textContent).not.toContain('Coming soon');
});

test('uploads can be removed and the chooser resets so the same photo can be selected again', async () => {
  const originalCreate=URL.createObjectURL, originalRevoke=URL.revokeObjectURL;
  URL.createObjectURL=jest.fn(()=> 'blob:preview'); URL.revokeObjectURL=jest.fn();
  axios.get.mockImplementation(url=>Promise.resolve({data:url.includes('catalog')?{modes:[{studio:'product',mode:'product_studio',available:true,credits:1,images:5,duration:5}],models:[]}:{quickAdCredits:12}}));
  try {
    await act(async()=>root.render(<MemoryRouter initialEntries={['/studios/product']}><AuthContext.Provider value={{user:{id:'owner',role:'company'},token:'token'}}><Routes><Route path="/studios/:studio" element={<StudioWorkspace />} /></Routes></AuthContext.Provider></MemoryRouter>));
    const input=host.querySelector('input[type="file"]');
    Object.defineProperty(input,'files',{configurable:true,value:[new File(['image'],'product.png',{type:'image/png'})]});
    await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
    expect(input.value).toBe('');
    expect(host.querySelector('button[type="submit"]').disabled).toBe(false);
    await act(async()=>host.querySelector('[aria-label="Remove uploaded view 1"]').click());
    expect(host.querySelector('[aria-label="Remove uploaded view 1"]')).toBeNull();
    expect(host.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(URL.revokeObjectURL.mock.calls[0][0]).toBe('blob:preview');
  } finally { await act(async()=>root.render(null));URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke; }
});
