import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('CI only');
await fs.mkdir('evidence',{recursive:true});
const browser=await chromium.launch();
try{
 for(const width of [1440,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:950}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8043');
  await page.locator('#status').filter({hasText:'本机引擎就绪'}).waitFor();
  await page.locator('#compile').click();
  await page.locator('#status').filter({hasText:'编译完成'}).waitFor();
  await page.getByRole('button',{name:'继续',exact:true}).click();
  await page.getByRole('button',{name:'继续',exact:true}).click();
  assert.match(await page.locator('#previewText').innerText(),/一起出发/);
  await page.getByRole('button',{name:'继续',exact:true}).click();
  await page.getByRole('button',{name:'一起出发',exact:true}).click();
  assert.match(await page.locator('#previewText').innerText(),/第一班列车/);
  const result=await page.evaluate(async()=>{const response=await fetch(document.querySelector('#downloadZip').getAttribute('href'));const bytes=new Uint8Array(await response.arrayBuffer());return {status:response.status,size:bytes.length,zip:bytes[0]===80&&bytes[1]===75}});
  assert.equal(result.status,200);assert(result.zip&&result.size>1000);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`evidence/desktop-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'切换明暗主题'}).click();
  await page.screenshot({path:`evidence/light-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'清空工作区'}).click();
  await page.getByText('故事在这里展开').waitFor();
  assert.deepEqual(errors,[]);await page.close();
 }
 await fs.writeFile('evidence/browser.json',JSON.stringify({real_cli:true,branch_read:true,export_zip:true,clear:true,widths:[1440,768,390,320]}));
}finally{await browser.close()}
