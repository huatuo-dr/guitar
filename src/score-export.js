// Shared by every standalone score; the image renderer and fonts are embedded.
function setupScoreExport({barCount}={}) {
  const menu=document.querySelector('.export-menu');
  const trigger=menu.querySelector('summary');
  const closeMenu=()=>{menu.open=false;};
  document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))closeMenu();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&menu.open){closeMenu();trigger.focus({preventScroll:true});}
  });
  menu.addEventListener('click',event=>{if(event.target.closest('button'))closeMenu();});
  document.getElementById('export-image').addEventListener('click',()=>exportScoreImages(trigger,barCount?.()));
}

async function exportScoreImages(trigger,barCount) {
  if(document.querySelector('.export-dialog'))return;
  const dialog=document.createElement('dialog');
  dialog.className='export-dialog';dialog.dataset.state='loading';
  dialog.setAttribute('aria-labelledby','export-title');
  dialog.innerHTML='<div class="export-dialog-header"><h2 id="export-title">导出图片</h2><button type="button" class="export-close">关闭</button></div><p class="export-progress" role="status">正在生成曲谱图片…</p><div class="export-images"></div>';
  document.body.append(dialog);
  const progress=dialog.querySelector('.export-progress');
  const urls=[];let cancelled=false;let stage;
  dialog.querySelector('.export-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    cancelled=true;stage?.remove();dialog.remove();
    // A save that has just started still needs its object URL briefly.
    setTimeout(()=>urls.forEach(url=>URL.revokeObjectURL(url)),60000);
    trigger.focus({preventScroll:true});
  });
  dialog.showModal();
  try {
    if(document.body.dataset.renderState!=='ready')throw new Error('曲谱还在排版，请稍后再试。');
    await document.fonts.ready;
    if(cancelled)return;
    stage=document.createElement('div');stage.className='export-stage';stage.setAttribute('aria-hidden','true');
    document.body.append(stage);
    const pageWidth=1200,maxHeight=1800;
    const score=document.getElementById('score');
    const heading=document.querySelector('.sheet-heading');
    const clean=node=>{
      const clone=node.cloneNode(true);
      for(const el of [clone,...clone.querySelectorAll('*')]){
        el.removeAttribute('id');el.removeAttribute('tabindex');
        el.classList?.remove('current','player-current','at-highlight');
      }
      clone.querySelectorAll('.at-cursors,.playback-cursor').forEach(el=>el.remove());
      return clone;
    };
    const makePage=()=>{
      const page=document.createElement('div');page.className='export-page';
      page.append(clean(heading));
      const content=document.createElement('div');content.className='export-content';page.append(content);
      const footer=document.createElement('p');footer.className='export-page-number';page.append(footer);
      stage.append(page);return {node:page,content,footer,bars:[]};
    };
    const pages=[];let current=makePage();pages.push(current);
    // Clone once so playback/scrolling can continue without entering the image.
    let units;
    if(score.querySelector('.at-surface')){
      let nextBar=1;
      const rows=Number(score.dataset.barsPerRow)||4;
      units=[...score.querySelectorAll('.at-surface>div')].map(row=>{
        const svg=row.querySelector('svg');
        if(!svg)throw new Error('部分谱行还未显示，请稍后再试。');
        const clone=clean(svg);
        const width=parseFloat(svg.getAttribute('width')),height=parseFloat(svg.getAttribute('height'));
        clone.setAttribute('viewBox',`0 0 ${width} ${height}`);
        clone.style.cssText=`display:block;width:1140px;height:${height*1140/width}px;`;
        const node=document.createElement('div');node.className='at-surface at';node.append(clone);
        const bars=Array.from({length:Math.min(rows,barCount-nextBar+1)},()=>`bar-${nextBar++}`);
        return {node,bars};
      });
    } else {
      units=[...score.querySelectorAll('.score-system,.simple-line,.simple-section-heading')].map(node=>({
        node:clean(node),bars:[...node.querySelectorAll('.measure')].map(bar=>bar.id)
      }));
    }
    if(!units.length)throw new Error('没有可导出的曲谱内容。');
    for(const unit of units){
      current.content.append(unit.node);
      if(current.node.offsetHeight>maxHeight&&current.content.children.length>1){
        unit.node.remove();current=makePage();pages.push(current);current.content.append(unit.node);
      }
      current.bars.push(...unit.bars);
      if(current.node.offsetHeight>maxHeight)throw new Error('单行内容过长，请调整每行小节数后重试。');
    }
    // html-to-image clones SVG subtrees without their computed child styles,
    // and its font discovery visits HTML elements only. Preserve both explicitly.
    const svgProperties=['display','fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','font-family','font-size','font-weight','font-style','text-anchor','dominant-baseline','letter-spacing','white-space','paint-order','opacity','visibility','vector-effect'];
    for(const svg of stage.querySelectorAll('svg')){
      for(const node of [svg,...svg.querySelectorAll('*')]){
        const style=getComputedStyle(node);
        for(const property of svgProperties)node.style.setProperty(property,style.getPropertyValue(property));
      }
    }
    // Keep the browser's exact lyric/chord positions. Reflowing nested flex
    // spans in the serialized SVG can otherwise change line breaks and overlap.
    for(const line of stage.querySelectorAll('.simple-line')){
      const origin=line.getBoundingClientRect();
      const cells=[...line.querySelectorAll('.simple-cell')].map(node=>({node,rect:node.getBoundingClientRect()}));
      line.style.cssText=`position:relative;display:block;height:${origin.height}px;`;
      line.replaceChildren(...cells.map(({node,rect})=>{
        node.style.cssText=`position:absolute;left:${rect.left-origin.left}px;top:${rect.top-origin.top}px;width:${rect.width}px;height:${rect.height}px;`;
        return node;
      }));
    }
    const fontEmbedCSS=[...document.styleSheets].flatMap(sheet=>[...sheet.cssRules])
      .filter(rule=>rule.type===CSSRule.FONT_FACE_RULE).map(rule=>rule.cssText).join('\n');
    const baseName=document.getElementById('download').dataset.filename.replace(/\.html$/i,'');
    for(const [index,page] of pages.entries()){
      if(cancelled)return;
      progress.textContent=`正在生成第 ${index+1} / ${pages.length} 张…`;
      page.footer.textContent=`${document.body.dataset.scoreMode==='simple'?'简易谱 · ':''}${index+1} / ${pages.length}`;
      const height=page.node.offsetHeight;
      const blob=await htmlToImage.toBlob(page.node,{width:pageWidth,height,pixelRatio:1,canvasWidth:1600,canvasHeight:Math.ceil(height*1600/pageWidth),backgroundColor:'#fffefa',fontEmbedCSS});
      if(cancelled)return;
      if(!blob)throw new Error('浏览器未能生成图片，请重试或使用 PDF 导出。');
      const url=URL.createObjectURL(blob);urls.push(url);
      const figure=document.createElement('figure');figure.dataset.bars=JSON.stringify(page.bars);
      const img=new Image();img.alt=`${baseName}，第 ${index+1} 张`;img.src=url;
      await img.decode();
      if(cancelled)return;
      const caption=document.createElement('figcaption');
      const label=document.createElement('span');label.textContent=`第 ${index+1} / ${pages.length} 张`;
      const save=document.createElement('a');save.href=url;save.download=`${baseName}${document.body.dataset.scoreMode==='simple'?'-简易谱':''}-${String(index+1).padStart(2,'0')}.png`;save.textContent='保存 PNG';
      caption.append(label,save);figure.append(img,caption);dialog.querySelector('.export-images').append(figure);
      page.node.remove();
    }
    progress.textContent=`已生成 ${pages.length} 张图片。点击保存 PNG，手机也可长按图片保存。`;
    dialog.dataset.state='ready';
  } catch(error) {
    if(!cancelled){progress.textContent='图片导出失败：'+(error.message||'请稍后重试。');dialog.dataset.state='error';}
  } finally {stage?.remove();}
}
