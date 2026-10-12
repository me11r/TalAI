import {chromium,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const base=new URL(process.argv[2]).origin;
if(!base.startsWith('https://'))throw Error('Supply the deployed HTTPS URL');
const report={time:new Date().toISOString(),url:base,documents:[],errors:[],checks:[],passed:false};
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:.5}),page=await context.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>{window.__ownModels=0;const create=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.type==='model/gltf-binary')window.__ownModels++;return create.call(this,blob);};});
 for(const path of ['/privacy','/terms','/cookies','/contacts']){const response=await page.goto(base+path);expect(response.status()).toBe(200);await expect(page.locator('h1')).toBeVisible();report.documents.push(path);}
 const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.goto(base);await expect(page.getByRole('tab',{name:'Обследование',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Cookies и приватность'})).toBeVisible();expect(requests.filter(url=>/^https?:/.test(url)&&new URL(url).origin!==base)).toEqual([]);report.checks.push('Anonymous documents and workspace, no third-party requests before map choice');
 await page.getByRole('button',{name:'Принимаю · загрузить карту',exact:true}).click();await expect(page.locator('[data-map-state="ready"]')).toBeVisible({timeout:120000});await expect.poll(()=>page.evaluate(()=>window.__ownModels),{timeout:60000}).toBeGreaterThan(0);await page.waitForTimeout(15000);await expect(page.locator('.model-error')).toHaveCount(0);report.checks.push('Live 2GIS and own GLB loaded on production domain');await page.screenshot({path:'screenshots/talai-live.png',timeout:90000});
 expect(requests.some(url=>new URL(url).origin===base&&new URL(url).pathname.startsWith('/api/'))).toBe(false);expect(report.errors).toEqual([]);report.passed=true;
}finally{writeFileSync('screenshots/deployed-check.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
