const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const temp=require('node:os').tmpdir();
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await browser.newPage({viewport:{width:1500,height:1000}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route(/\/js\/app\.js(?:\?|$)/,async route=>{
      await route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8')+`
window.__adn={snapshot:()=>({unit:currentUnit(),domain:metricDomain(),rows:rankedRows(),label:metricLabel(),
  scatter:scatterPoints(), score:valueFor('06518','party'), color:colorFor(valueFor('06518','party'))}),
  profile:openSocioProfile, selectParty, clearMapSelection, axisTickLabel, exportReport};`});
    });
    await page.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});
    await page.locator('#loading.is-hidden').waitFor({state:'attached'});
    const snap=()=>page.evaluate(()=>window.__adn.snapshot());
    await page.locator('#indicator').selectOption('adn');
    const initial=await snap();
    assert.equal(initial.label,'Afinidad Socioelectoral');
    assert.equal(initial.rows.length,135);
    assert.match(await page.locator('#legend').textContent(),/Afinidad/);
    assert.match(await page.locator('#legend').textContent(),/25,3 %/);
    for(const [button,count] of [['#mapLevelLocality',219],['#mapLevelCircuit',1149],['#mapLevelParty',135]]) {
      await page.locator(button).click();
      assert.equal((await snap()).rows.length,count);
      assert.deepEqual((await snap()).domain,initial.domain);
    }
    await page.evaluate(()=>window.__adn.selectParty('06518'));
    assert.equal((await snap()).score,initial.score);
    assert.equal((await snap()).color,initial.color);
    await page.evaluate(()=>window.__adn.clearMapSelection());
    await page.evaluate(()=>window.__adn.profile('06518','party'));
    assert.equal(await page.locator('.profile-kpis .profile-kpi').count(),5);
    assert.match(await page.locator('.profile-kpi-adn').textContent(),/Afinidad Socioelectoral.*Afinidad/);
    assert.match(await page.locator('.profile-kpi-adn strong').textContent(),/^\d+,\d %$/);
    assert.equal(await page.locator('.profile-panel-adn').count(),0);
    await page.screenshot({path:path.join(temp,'atlas-adn-profile.png')});
    await page.locator('#closeTerritoryModal').click();
    await page.locator('#openScatter').click();
    await page.locator('#scatterX').selectOption('socio:adn');
    await page.locator('#scatterY').selectOption('electoral:fuerza');
    assert.equal((await snap()).scatter.xMetric.format,'index');
    assert.equal(await page.evaluate(()=>window.__adn.axisTickLabel(.425,{format:'index'})),'42,5 %');
    assert.equal((await snap()).scatter.points.length,135);
    await page.screenshot({path:path.join(temp,'atlas-adn-scatter.png')});
    await page.locator('#closeScatter').click();
    await page.locator('#targetElection').selectOption('2025_generales_legislatura_provincial_jepba_definitivo');
    assert.equal((await snap()).unit,'party');
    assert.equal((await snap()).score,initial.score);
    await page.locator('#modeCompare').click();
    assert.equal(await page.locator('#indicator option[value="adn"]').count(),0);
    await page.locator('#modeElection').click();
    await page.locator('#indicator').selectOption('adn');
    const downloadEvent=page.waitForEvent('download');
    await page.locator('#exportData').click();
    const download=await downloadEvent;
    const csv=fs.readFileSync(await download.path(),'utf8');
    assert.equal(csv.split('\n').length,136);
    assert.match(csv,/Censo 2022/);
    await page.evaluate(async()=>{window.print=()=>{};await window.__adn.exportReport();});
    assert.match(await page.locator('#reportRoot').textContent(),/puntaje precalculado/);
    await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
    await page.screenshot({path:path.join(temp,'atlas-adn-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(300);
    await page.screenshot({path:path.join(temp,'atlas-adn-mobile.png'),fullPage:true});
    assert.ok(await page.locator('#map canvas').evaluateAll(cs=>cs.some(c=>{
      const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;
      return n>1000;
    })));
    // Rename in memory only: the single configuration must drive all UI surfaces.
    await page.route('**/js/indicator-config.mjs',async route=>{
      const code=fs.readFileSync(path.join(__dirname,'../js/indicator-config.mjs'),'utf8').replace("ADN_NAME = 'Afinidad Socioelectoral'","ADN_NAME = 'Indice de prueba'");
      await route.fulfill({contentType:'text/javascript',body:code});
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#loading.is-hidden').waitFor({state:'attached'});
    await page.locator('#indicator').selectOption('adn');
    assert.equal((await snap()).label,'Indice de prueba');
    assert.equal((await snap()).score,initial.score);
    assert.match(await page.locator('#legend').textContent(),/Afinidad/);
    assert.match(await page.locator('#scatterX option[value="socio:adn"]').textContent(),/Indice de prueba/);
    await page.evaluate(()=>window.__adn.profile('06518','party'));
    assert.match(await page.locator('.profile-kpi-adn').textContent(),/Indice de prueba/);
    assert.deepEqual(errors,[]);
    console.log('ADN UI: map 3 levels, fixed scores/colors, profiles, scatter, PBA2025, desktop/mobile, single-place rename OK');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
