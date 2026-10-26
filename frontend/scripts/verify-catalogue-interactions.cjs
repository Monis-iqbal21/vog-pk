const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const desktop=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  await desktop.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
  const track=desktop.locator('#featured-track');await track.scrollIntoViewIfNeeded();await track.evaluate(t=>t.scrollLeft=0);
  const otherBefore=await desktop.locator('#new-arrivals-track').evaluate(t=>t.scrollLeft);
  const r=await track.boundingBox();
  await desktop.mouse.move(r.x+r.width*.7,r.y+100);await desktop.mouse.down();await desktop.mouse.move(r.x+r.width*.3,r.y+100,{steps:14});await desktop.mouse.up();await desktop.waitForTimeout(150);
  const dragOffset=await track.evaluate(t=>t.scrollLeft);assert.ok(dragOffset>0,'Desktop drag must advance carousel');
  assert.equal(await desktop.locator('#new-arrivals-track').evaluate(t=>t.scrollLeft),otherBefore,'Carousels must scroll independently');
  assert.equal(new URL(desktop.url()).pathname,'/','Dragging must suppress product link clicks');
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await mobile.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
  const mobileTrack=mobile.locator('#featured-track');await mobileTrack.scrollIntoViewIfNeeded();
  const m=await mobileTrack.boundingBox(),cdp=await mobile.context().newCDPSession(mobile);
  const y=Math.max(100,Math.min(700,m.y+110));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:340,y}]});
  for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:340-i*21,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(600);
  const swipeOffset=await mobileTrack.evaluate(t=>t.scrollLeft);assert.ok(swipeOffset>0,'Native touch swipe must advance carousel');
  const result={checkedAt:'2026-10-27',desktopDrag:{width:1440,passed:true,offset:dragOffset},independentCarousels:true,dragClickSuppression:true,mobileTouchSwipe:{width:390,passed:true,offset:swipeOffset}};
  fs.writeFileSync(path.resolve(__dirname,'../docs/catalogue-interaction-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
