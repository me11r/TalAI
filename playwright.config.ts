import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
const data=mkdtempSync('/tmp/talai-playwright-');
export default defineConfig({testDir:'./tests',workers:1,timeout:90000,use:{baseURL:'http://127.0.0.1:5194',headless:true,launchOptions:{executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader']},viewport:{width:1280,height:900}},webServer:{command:'npm run dev -- --port 5194',env:{TALAI_DATA_DIR:data},url:'http://127.0.0.1:5194',reuseExistingServer:false},reporter:'list'});
