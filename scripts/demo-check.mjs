import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base='http://127.0.0.1:5197';
const report={time:new Date().toISOString(),checks:[],accessibility:[],errors:[],passed:false};
if(!process.argv.includes('--skip-build'))await new Promise((resolve,reject)=>{const build=spawn('npm',['run','build:demo'],{stdio:'inherit'});build.once('exit',code=>code===0?resolve():reject(Error('Demo build failed')));});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5197','--strictPort'],{stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('5197'))resolve();});server.stderr.on('data',d=>console.error(String(d)));server.once('exit',()=>reject(Error('Preview failed')));});
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 await context.addInitScript(()=>{if(!localStorage.getItem('greenwatch.project.v1'))localStorage.setItem('greenwatch.project.v1','legacy-preservation-sentinel');window.__modelBlobs=[];const original=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.type==='model/gltf-binary')window.__modelBlobs.push(blob);return original.call(this,blob);};});
 const page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
 const requests=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base);await expect(page.getByRole('tab',{name:'Обследование',exact:true})).toBeVisible();await expect(page.getByLabel('Код доступа оператора')).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Cookies и приватность'})).toBeVisible();
 await page.screenshot({path:'screenshots/talai-jury-start.png'});
 const scan=async(name)=>{const r=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();report.accessibility.push({name,violations:r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});};
 await scan('demo first visit');
 await page.getByRole('button',{name:'Без внешней карты',exact:true}).click();await expect(page.getByRole('region',{name:'Cookies и приватность'})).toHaveCount(0);await page.reload();
 expect(requests.filter(url=>url.startsWith('http')&&!url.startsWith(base))).toEqual([]);expect(await context.cookies()).toEqual([]);report.checks.push('Direct workspace, no login, refusal persists, zero third-party requests or cookies');
 await page.getByRole('button',{name:'Настройки приватности',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Настройки приватности',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'3D-планирование',exact:true}).click();await page.getByRole('button',{name:'Добавить дерево',exact:true}).click();await page.getByLabel('Широта новой посадки').fill('51.10742');await page.getByLabel('Долгота новой посадки').fill('71.4157');await page.getByRole('button',{name:'Подтвердить посадку'}).focus();await page.keyboard.press('Enter');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('talai.demo.project.v1')||'null')?.scenario.trees.length)).toBe(11);await page.reload();
 expect(await page.evaluate(()=>localStorage.getItem('greenwatch.project.v1'))).toBe('legacy-preservation-sentinel');expect(await page.evaluate(()=>localStorage.getItem('talai.project.v3'))).toBeNull();report.checks.push('Keyboard planting creation and browser persistence, legacy/operator data isolated');
 await page.getByRole('button',{name:'История',exact:true}).first().click();await page.getByRole('button',{name:'Создать обследование'}).click();await page.locator('input[name=date]').fill('2026-12-20');await page.locator('input[name=description]').fill('План демонстрационного обследования');await page.locator('input[name=demo]').check();await page.getByRole('button',{name:'Сохранить обследование'}).click();
 await expect(page.getByText('Материалы отсутствуют. Результаты не получены.',{exact:true})).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('talai.demo.project.v1')).surveys.at(-1).status)).toBe('запланировано');
 for(const input of await page.locator('input[type=file]').all())await expect(input).toBeDisabled();await scan('demo history');report.checks.push('Survey creation and future date without invented materials; uploads disabled');
 for(const path of ['/privacy','/terms','/cookies','/contacts']){await page.goto(base+path);await expect(page.locator('h1')).toBeVisible();await scan(path);}report.checks.push('All documents open without login');
 if(process.argv.includes('--map')){
  await page.goto(base);await page.getByRole('button',{name:'Настройки приватности',exact:true}).click();await page.getByRole('button',{name:'Разрешить карту',exact:true}).click();await expect(page.locator('[data-map-state="ready"]')).toBeVisible({timeout:120000});
  await expect.poll(()=>page.evaluate(()=>window.__modelBlobs.length),{timeout:60000}).toBeGreaterThan(0);
  const glb=await page.evaluate(async()=>{const b=await window.__modelBlobs[0].arrayBuffer(),v=new DataView(b);return {magic:v.getUint32(0,true),length:v.getUint32(8,true),actual:b.byteLength,scale:JSON.parse(new TextDecoder().decode(b.slice(20,20+v.getUint32(12,true)))).nodes[0].scale};});
  expect(glb.magic).toBe(0x46546c67);expect(glb.length).toBe(glb.actual);expect(glb.scale).toEqual([.625,4/6,.625]);await page.waitForTimeout(15000);await expect(page.locator('.model-error')).toHaveCount(0);await page.screenshot({path:'screenshots/talai-jury-map.png'});report.checks.push('Live 2GIS ready, own locally resized GLB, no model errors');
  await page.getByRole('button',{name:'Настройки приватности',exact:true}).click();await page.getByRole('button',{name:'Отключить карту',exact:true}).click();await expect(page.locator('.map-privacy')).toBeVisible();requests.length=0;await page.waitForTimeout(1500);expect(requests.filter(url=>url.startsWith('http')&&!url.startsWith(base))).toEqual([]);report.checks.push('Map withdrawal stops subsequent third-party requests');
 }
 expect(requests.filter(url=>new URL(url).pathname.startsWith('/api/'))).toEqual([]);expect(report.errors).toEqual([]);expect(report.accessibility.flatMap(r=>r.violations)).toEqual([]);report.checks.push('No server API calls, zero JS errors, zero automated accessibility violations');report.passed=true;
}finally{writeFileSync('screenshots/demo-check.json',JSON.stringify(report,null,2));await browser?.close();server.kill();}
console.log(JSON.stringify(report,null,2));
