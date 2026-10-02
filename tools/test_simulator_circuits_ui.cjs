const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1500,height:1000}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route(/\/js\/app\.js(?:\?|$)/,async route=>{
      const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
      await route.fulfill({contentType:'text/javascript',body:source+`
window.__circuitTest=()=>({unit:simulatorAtlasView.unit,keys:[...simulatorAtlasView.keys],parents:[...simulatorAtlasView.parentParties],zoom:state.map.getZoom(),center:[state.map.getCenter().lat,state.map.getCenter().lng],layers:simulatorAtlasView.layer.getLayers().map(l=>({id:l._leaflet_id,key:l.feature.properties.key,parent:l.feature.properties.partido_norm,fill:l.options.fillColor})),background:simulatorAtlasView.background?.getLayers().map(l=>({fill:l.options.fillColor,interactive:l.options.interactive}))});`});
    });
    await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
    await page.locator('#loading.is-hidden').waitFor({state:'attached'});
    await page.locator('#openSimulator').click();
    await page.locator('#simShare').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#simIncrease').check();
    await page.locator('#simTurnout').evaluate(el=>{el.value='80';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#simExplore').click();
    await page.locator('[data-party="06518"]').check();
    await page.locator('[data-party="06441"]').check();
    const potential=await page.locator('[data-progress-caption]').textContent();
    const newcomers=await page.locator('[data-new-votes]').textContent();
    await page.locator('#simCircuits').click();
    const snapshot=()=>page.evaluate(()=>window.__circuitTest());
    const before=await snapshot();
    assert.equal(before.unit,'circuit');
    assert.equal(before.parents.length,2);
    assert.ok(before.keys.length>2);
    assert.equal(await page.locator('[data-party-list] input:checked').count(),before.keys.length);
    assert.ok(before.layers.every(l=>before.parents.includes(l.parent)));
    assert.equal(before.background.length,135);
    assert.ok(before.background.every(l=>['white','#fff','#ffffff'].includes(l.fill)&&l.interactive===false));
    assert.equal(await page.locator('[data-progress-caption]').textContent(),potential);
    assert.equal(await page.locator('[data-new-votes]').textContent(),newcomers);
    const fills=await page.locator('.sim-territory-node').evaluateAll(nodes=>nodes.map(n=>({key:n.dataset.key,fill:n.querySelector('.sim-territory-point').style.getPropertyValue('--point-color')})));
    for(const point of fills) {const layer=before.layers.find(l=>l.key===point.key);if(layer)assert.equal(point.fill,layer.fill);}
    assert.ok(new Set(fills.map(p=>p.fill)).size>1);
    await page.locator(`[data-party="${before.keys[0]}"]`).uncheck();
    const after=await snapshot();
    assert.equal(after.keys.length,before.keys.length-1);
    assert.deepEqual(after.center,before.center);
    assert.equal(after.zoom,before.zoom);
    assert.deepEqual(after.layers.map(l=>l.id),before.layers.map(l=>l.id));
    assert.ok(!(await page.locator('body').textContent()).includes('Escala provincial fija. Contorno violeta'));
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'simulator-circuits-desktop.png')});
    await page.locator('#simParties').click();
    assert.deepEqual((await snapshot()).keys.sort(),['06441','06518']);
    await page.locator('#simCircuits').click();
    await page.setViewportSize({width:390,height:844});
    await page.locator('#simParties').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#simParties').isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'simulator-circuits-mobile.png')});
    await page.locator('#simMapReset').click();
    const reset=await snapshot();
    assert.equal(reset.unit,'party');assert.equal(reset.keys.length,0);assert.equal(reset.layers.length,135);
    await page.locator('#simEdit').click();
    assert.equal(await page.locator('#simShare').inputValue(),'65');
    assert.equal(await page.locator('#simTurnout').inputValue(),'80');
    assert.deepEqual(errors,[]);
    console.log('OK: circuit drilldown, white context, matching ADN colors, exact totals, stable map, back and reset.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
