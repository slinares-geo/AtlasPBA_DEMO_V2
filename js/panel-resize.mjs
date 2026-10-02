const STORAGE_KEY = 'atlas-panel-layout-v1';

export function setupPanelResize({onResize}) {
  const shell = document.querySelector('.app-shell');
  const column = document.querySelector('.map-column');
  const pane = document.querySelector('.map-pane');
  let settings = {}, drag = null, frame = 0;
  try { settings = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { /* Optional browser persistence. */ }
  if (typeof settings !== 'object' || Array.isArray(settings)) settings = {};
  for (const key of ['left','right','bottom']) {
    if (!Number.isFinite(settings[key]) || settings[key] <= 0 || settings[key] >= 1) delete settings[key];
  }
  const handles = ['left','right','bottom'].map(key => {
    const handle = document.createElement('div');
    handle.className = `panel-resizer panel-resizer-${key}`;
    handle.dataset.resize = key;
    handle.tabIndex = 0;
    handle.setAttribute('role','separator');
    handle.setAttribute('aria-orientation',key === 'bottom' ? 'horizontal' : 'vertical');
    handle.setAttribute('aria-label', {left:'Ancho del panel izquierdo',right:'Ancho del panel derecho',bottom:'Altura del panel inferior'}[key]);
    handle.title = 'Arrastrar para ajustar; doble clic para restablecer';
    document.body.append(handle);
    return handle;
  });
  const active = () => innerWidth > 1180 && !document.body.classList.contains('is-scatter-page') && !document.body.classList.contains('is-continuity-mode');
  const save = () => { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(settings)); } catch { /* Storage may be disabled. */ } };
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  const bottomMinimum = () => document.body.classList.contains('is-simulator-exploring') ? 260 : 180;
  function apply() {
    shell.style.removeProperty('grid-template-columns');
    column.style.removeProperty('grid-template-rows');
    if (!active()) return;
    const width = shell.clientWidth - 2 * parseFloat(getComputedStyle(shell).columnGap || 0);
    if (settings.left || settings.right) {
      let left = clamp((settings.left || .19)*width,240,width-830);
      let right = clamp((settings.right || .15)*width,210,width-left-620);
      shell.style.setProperty('grid-template-columns',`${left}px minmax(0,1fr) ${right}px`,'important');
    }
    if (settings.bottom) {
      const height = column.clientHeight - parseFloat(getComputedStyle(column).rowGap || 0);
      column.style.setProperty('grid-template-rows',`minmax(0,1fr) ${clamp(settings.bottom*height,bottomMinimum(),Math.max(bottomMinimum(),height-240))}px`,'important');
    }
  }
  function place() {
    const enabled = active();
    handles.forEach(h => { h.hidden = !enabled; });
    if (!enabled) return;
    const rect = column.getBoundingClientRect(), map = pane.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(shell).columnGap || 0);
    for (const handle of handles) {
      const bottom = handle.dataset.resize === 'bottom';
      Object.assign(handle.style, bottom ? {left:`${rect.left}px`,top:`${map.bottom}px`,width:`${rect.width}px`,height:'12px'} : {
        left:`${handle.dataset.resize === 'left' ? rect.left-gap/2-5 : rect.right+gap/2-5}px`,top:`${rect.top}px`,width:'10px',height:`${rect.height}px`,
      });
      handle.setAttribute('aria-valuenow',String(Math.round(bottom ? rect.bottom-map.bottom : handle.dataset.resize === 'left' ? rect.left-shell.getBoundingClientRect().left : shell.getBoundingClientRect().right-rect.right)));
    }
  }
  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame=0; place(); onResize(); });
  }
  function adjust(key,delta,start) {
    const width = shell.clientWidth-2*parseFloat(getComputedStyle(shell).columnGap || 0);
    if (key === 'bottom') settings.bottom = clamp(start.bottom-delta,bottomMinimum(),Math.max(bottomMinimum(),start.height-240))/start.height;
    else {
      const left = key === 'left' ? clamp(start.left+delta,240,width-start.right-620) : start.left;
      const right = key === 'right' ? clamp(start.right-delta,210,width-start.left-620) : start.right;
      settings.left=left/width; settings.right=right/width;
    }
    apply(); schedule();
  }
  function snapshot() {
    const s=shell.getBoundingClientRect(), c=column.getBoundingClientRect(), p=pane.getBoundingClientRect();
    const gap=parseFloat(getComputedStyle(shell).columnGap || 0), rowGap=parseFloat(getComputedStyle(column).rowGap || 0);
    return {left:c.left-s.left-gap,right:s.right-c.right-gap,bottom:c.bottom-p.bottom-rowGap,height:c.height-rowGap};
  }
  for (const h of handles) {
    h.addEventListener('pointerdown',e => {
      if (e.button !== 0 || !active()) return;
      drag={id:e.pointerId,key:h.dataset.resize,start:snapshot(),x:e.clientX,y:e.clientY};
      h.setPointerCapture(e.pointerId); document.body.classList.add('is-panel-resizing'); e.preventDefault();
    });
    h.addEventListener('pointermove',e => {
      if (!drag || drag.id !== e.pointerId) return;
      adjust(drag.key,drag.key === 'bottom' ? e.clientY-drag.y : e.clientX-drag.x,drag.start);
    });
    const stop=()=>{if (!drag) return; drag=null; document.body.classList.remove('is-panel-resizing'); save(); schedule();};
    h.addEventListener('pointerup',stop); h.addEventListener('pointercancel',stop); h.addEventListener('lostpointercapture',stop);
    h.addEventListener('dblclick',()=>{delete settings[h.dataset.resize]; apply(); save(); schedule();});
    h.addEventListener('keydown',e=>{
      if (!active()) return;
      if (e.key === 'Home') {delete settings[h.dataset.resize];apply();save();schedule();e.preventDefault();return;}
      const keys=h.dataset.resize==='bottom'?['ArrowUp','ArrowDown']:['ArrowLeft','ArrowRight'];
      if (!keys.includes(e.key)) return;
      adjust(h.dataset.resize,(e.key===keys[0]?-1:1)*(e.shiftKey?30:10),snapshot());save();e.preventDefault();
    });
  }
  new ResizeObserver(schedule).observe(column);
  new MutationObserver(()=>{apply();schedule();}).observe(document.body,{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',()=>{apply();schedule();});
  window.addEventListener('scroll',schedule,{passive:true});
  apply();schedule();
}
