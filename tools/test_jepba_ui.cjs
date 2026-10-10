// Serve Atlas on port 8765; NODE_PATH must contain Playwright.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const id = '2025_generales_legislatura_provincial_jepba_definitivo';
(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1500,height:1000}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/\/js\/app\.js(?:\?|$)/, async route => {
      const source = fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
      await route.fulfill({contentType:'text/javascript',body:source+`
window.__jepba = {
  snapshot: () => ({unit:currentUnit(), level:state.mapLevel, indicator:state.indicator,
    target:state.targetElection, base:state.baseElection, selectedParty:state.selectedParty,
    targetRows:currentScopeRows(currentUnit(),state.targetElection),
    baseRows:currentScopeRows(currentUnit(),state.baseElection),
    aggregate:aggregateRows(currentScopeRows(currentUnit(),state.targetElection)),
    ranked:rankedRows().length, metric:metricValue(aggregateRows(currentScopeRows(currentUnit(),state.targetElection))),
    continuity:state.continuityActive}),
  selectParty, clearMapSelection, exportReport,
  legacyIds: () => state.data.sources.filter(s => s.id !== '${id}').map(s => s.id)
};`});
    });
    await page.goto(process.env.ATLAS_URL || 'http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});
    await page.locator('#loading.is-hidden').waitFor({state:'attached'});
    const snap = () => page.evaluate(() => window.__jepba.snapshot());
    const legacy = (await snap()).target;
    await page.locator('#indicator').selectOption('participacion');
    assert.equal(await page.locator(`#targetElection option[value="${id}"]`).count(),0);
    await page.locator('#modeCompare').click();
    assert.equal(await page.locator(`#baseElection option[value="${id}"]`).count(),0);
    assert.equal(await page.locator(`#compareElection option[value="${id}"]`).count(),0);
    await page.locator('#indicator').selectOption('votos');
    assert.equal(await page.locator(`#compareElection option[value="${id}"]`).count(),1);
    await page.locator('#modeElection').click();
    await page.locator('#mapLevelCircuit').click();
    await page.evaluate(()=>window.__jepba.selectParty('06007'));
    await page.locator('#pinDrawer').click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.pinned-circuit-map').count(),1);
    await page.locator('#targetElection').selectOption(id);
    assert.equal(await page.locator('.pinned-circuit-map').count(),0);
    await page.evaluate(()=>window.__jepba.clearMapSelection());
    assert.equal((await snap()).unit,'party');
    assert.equal(await page.locator('#mapLevelCircuit').isVisible(),false);
    assert.equal(await page.locator('#mapLevelLocality').isVisible(),false);
    assert.match(await page.locator('#electionCoverageNote').textContent(),/definitivo/);
    assert.equal((await snap()).targetRows.length,135);
    assert.equal((await snap()).aggregate.participacion,null);
    assert.equal(await page.locator('#indicator option[value="participacion"]').count(),0);
    await page.locator('#indicator').selectOption('votos');
    await page.locator('#voteType').selectOption('blanco');
    assert.match(await page.locator('#metricDefinition').textContent(),/total publicado/);
    let s = await snap();
    assert.ok(Math.abs(s.metric-s.aggregate.blanco/s.aggregate.total_publicado)<1e-12);
    await page.evaluate(()=>window.__jepba.selectParty('06007'));
    s = await snap();
    assert.equal(s.targetRows.length,1);
    assert.equal(s.targetRows[0].total_publicado,8470);
    assert.equal(s.unit,'party');
    assert.equal(await page.locator('#circuitDrawer').isVisible(),false);
    await page.locator('#modeCompare').click();
    s = await snap();
    assert.equal(s.baseRows.length,1);
    assert.equal(s.targetRows.length,1);
    assert.equal(s.baseRows[0].partido_norm,s.targetRows[0].partido_norm);
    assert.equal(await page.locator('#voteType').inputValue(),'positivo');
    assert.equal(await page.locator('#voteType option[value="blanco"]').evaluate(o=>o.disabled),true);
    await page.locator('#baseElection').selectOption(id);
    await page.locator('#compareElection').selectOption(legacy);
    assert.equal((await snap()).unit,'party');
    await page.locator('#modeElection').click();
    await page.locator('#targetElection').selectOption(legacy);
    await page.evaluate(()=>window.__jepba.clearMapSelection());
    assert.equal(await page.locator('#mapLevelCircuit').isVisible(),true);
    await page.locator('#mapLevelLocality').click();
    assert.equal((await snap()).unit,'locality');
    await page.locator('#targetElection').selectOption(id);
    assert.equal((await snap()).unit,'party');
    await page.locator('#openScatter').click();
    assert.equal(await page.locator('#scatterElection').isDisabled(),true);
    assert.match(await page.locator('#scatterMeta').textContent(),/no interviene/);
    await page.locator('#scatterX').selectOption('electoral:blanco');
    await page.locator('#scatterElection').selectOption(id);
    assert.equal(await page.locator('#scatterUnit').inputValue(),'party');
    assert.equal(await page.locator('#scatterElection').isDisabled(),false);
    assert.match(await page.locator('#scatterMeta').textContent(),/Provinciales PBA/);
    await page.locator('#scatterElection').selectOption(legacy);
    const referenceLabel = await page.locator('#scatterElection option:checked').textContent();
    assert.ok((await page.locator('#scatterMeta').textContent()).startsWith(`Voto en blanco: ${referenceLabel}`));
    await page.locator('#scatterX').selectOption('electoral:participacion');
    assert.equal(await page.locator(`#scatterElection option[value="${id}"]`).count(),0);
    await page.locator('#closeScatter').click();
    await page.locator('#openContinuity').click();
    assert.equal((await snap()).unit,'party');
    assert.equal(await page.locator('#continuityUnit option[value="circuit"]').evaluate(o=>o.disabled),true);
    await page.locator('#closeContinuity').click();
    for (const previous of await page.evaluate(()=>window.__jepba.legacyIds())) {
      await page.locator('#targetElection').selectOption(previous);
      await page.locator('#mapLevelCircuit').click();
      assert.ok((await snap()).targetRows.length>0,'legacy circuit results');
      assert.equal((await snap()).unit,'circuit');
    }
    await page.locator('#targetElection').selectOption(id);
    await page.locator('#indicator').selectOption('votos');
    await page.locator('#voteType').selectOption('positivo');
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#exportData').click();
    const download = await downloadEvent;
    const csv = fs.readFileSync(await download.path(),'utf8');
    assert.equal(csv.split('\n').length,136);
    assert.ok(csv.split('\n').slice(1).every(line=>line.startsWith('"party"')));
    await page.evaluate(async()=>{
      window.print=()=>{};
      await window.__jepba.exportReport();
    });
    assert.match(await page.locator('#reportRoot').textContent(),/Junta Electoral/);
    assert.match(await page.locator('#reportRoot').textContent(),/Total publicado/);
    await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
    await page.waitForTimeout(400);
    const pixels = await page.locator('#map canvas').evaluateAll(canvases => canvases.map(c => {
      const data = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let count=0; for(let i=3;i<data.length;i+=4) if(data[i]) count++;
      return count;
    }));
    assert.ok(pixels.some(n=>n>1000),'party map canvas must be painted');
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'jepba-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(350);
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'jepba-mobile.png'),fullPage:true});
    assert.equal(await page.locator('#mapLevelCircuit').isVisible(),false);
    assert.equal(await page.locator('[data-id="blanco-nulo-participacion"]').count(),0);
    assert.equal(await page.locator('[data-id="socio-hacinamiento-participacion"]').count(),0);
    assert.equal(await page.locator('#scatterX option[value="blanco_delta"]').count(),1);
    assert.equal(await page.locator('#scatterX option[value="nulo_delta"]').count(),1);
    assert.equal(await page.locator('#scatterX option[value="socio:hacin_6P"]').count(),1);
    assert.deepEqual(errors,[]);
    console.log('PBA 2025 UI: levels, metrics, comparison, scatter, continuity, painted map, desktop/mobile OK');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
