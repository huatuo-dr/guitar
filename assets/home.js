(() => {
  'use strict';
  const types={fingerstyle:'指弹',accompaniment:'弹唱伴奏'};
  const list=document.getElementById('score-list');
  const search=document.getElementById('search');
  const sort=document.getElementById('sort');
  const status=document.getElementById('catalog-status');
  const resultCount=document.getElementById('result-count');
  const empty=document.querySelector('.empty-state');
  const filters=[...document.querySelectorAll('[data-type]')];
  const catalog=window.GUITAR_SCORES;
  let selectedType='all';

  // Catalog scripts are local and intentionally use classic scripts, so file:// works.
  if(!Array.isArray(catalog)){
    status.textContent='未能加载曲谱目录，请刷新页面后重试。';
    search.disabled=true;sort.disabled=true;filters.forEach(button=>button.disabled=true);
    return;
  }

  function element(tag,className,text){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  }

  function icon(path){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const shape=document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',path);svg.append(shape);
    return svg;
  }

  function card(score,index){
    const article=element('article','score-card');
    article.dataset.scoreId=score.id;
    const art=element('div',`score-art ${score.type}`);art.setAttribute('aria-hidden','true');
    art.append(element('span','',String(index+1).padStart(2,'0')));
    const info=element('div','score-info');
    const title=element('div','title-row');
    title.append(element('h3','score-title',score.title),element('span',`type-badge ${score.type}`,types[score.type]));
    info.append(title);
    if(score.artist)info.append(element('p','score-artist',score.artist));
    const metadata=element('p','score-meta');
    const values=[];
    if(score.timeSignature)values.push(`${score.timeSignature} 拍`);
    if(Number.isInteger(score.capo))values.push(score.capo===0?'无需变调夹':`变调夹第 ${score.capo} 品`);
    if(score.bars)values.push(`${score.bars} 小节`);
    values.forEach(value=>metadata.append(element('span','',value)));
    if(values.length)info.append(metadata);
    if(score.description)info.append(element('p','score-description',score.description));
    const side=element('div','score-side');
    const time=element('time','score-date',`${score.updatedAt.replaceAll('-','.')} 更新`);time.dateTime=score.updatedAt;
    const actions=element('div','score-actions');
    const open=element('a','open-score','打开曲谱');open.href=`./${score.path}`;open.setAttribute('aria-label',`打开${score.title}`);
    open.append(icon('M7 17 17 7M7 7h10v10'));
    actions.append(open);side.append(time,actions);article.append(art,info,side);
    return article;
  }

  function render(){
    const terms=search.value.trim().toLocaleLowerCase('zh-CN').split(/\s+/).filter(Boolean);
    const scores=catalog.filter(score=>{
      const words=`${score.title} ${score.artist||''}`.toLocaleLowerCase('zh-CN');
      return (selectedType==='all'||score.type===selectedType)&&terms.every(term=>words.includes(term));
    }).sort((a,b)=>{
      const byTitle=a.title.localeCompare(b.title,'zh-CN',{numeric:true});
      return sort.value==='title'?byTitle:b.updatedAt.localeCompare(a.updatedAt)||byTitle;
    });
    list.replaceChildren(...scores.map(card));
    resultCount.textContent=terms.length||selectedType!=='all'?`找到 ${scores.length} 份 · 共 ${catalog.length} 份`:`共 ${catalog.length} 份曲谱`;
    filters.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.type===selectedType)));
    empty.hidden=scores.length!==0;
    if(!scores.length){
      document.getElementById('empty-title').textContent=terms.length?'没有找到相关曲谱':selectedType==='all'?'曲谱正在整理中':`暂时没有${types[selectedType]}谱`;
      document.getElementById('empty-description').textContent=terms.length?'试试其他曲名或歌手，或查看全部曲谱。':'制作完成后，会收录在这里。也可以先看看其他曲谱。';
    }
  }

  for(const count of document.querySelectorAll('[data-count]')){
    count.textContent=count.dataset.count==='all'?catalog.length:catalog.filter(score=>score.type===count.dataset.count).length;
  }
  filters.forEach(button=>button.addEventListener('click',()=>{selectedType=button.dataset.type;render();}));
  search.addEventListener('input',render);
  sort.addEventListener('change',render);
  document.getElementById('reset-filters').addEventListener('click',()=>{search.value='';selectedType='all';render();search.focus();});
  status.hidden=true;
  render();
})();
