(() => {
  'use strict';
  const types={fingerstyle:'指弹',accompaniment:'弹唱伴奏',chorus:'仅副歌',tool:'工具'};
  const list=document.getElementById('score-list');
  const search=document.getElementById('search');
  const sort=document.getElementById('sort');
  const status=document.getElementById('catalog-status');
  const resultCount=document.getElementById('result-count');
  const empty=document.querySelector('.empty-state');
  const filters=[...document.querySelectorAll('[data-type]')];
  const catalog=window.GUITAR_SCORES;
  const tools=Array.isArray(window.GUITAR_TOOLS)?window.GUITAR_TOOLS:[];
  const queries={scores:'',tools:''};
  let selectedType=location.hash==='#tools'?'tools':'all';

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

  function card(score,index,isTool=false){
    const type=isTool?'tool':score.type;
    const article=element('article',isTool?'score-card tool-card':'score-card');
    if(isTool)article.dataset.toolId=score.id;
    else article.dataset.scoreId=score.id;
    const art=element('div',`score-art ${type}`);art.setAttribute('aria-hidden','true');
    art.append(element('span','',String(index+1).padStart(2,'0')));
    const info=element('div','score-info');
    const title=element('div','title-row');
    title.append(element('h3','score-title',score.title),element('span',`type-badge ${type}`,types[type]));
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
    if(score.path){
      const open=element('a','open-score',isTool?'查看内容':'打开曲谱');open.href=`./${score.path}`;open.setAttribute('aria-label',`打开${score.title}`);
      open.append(icon('M7 17 17 7M7 7h10v10'));actions.append(open);
    } else actions.append(element('span','entry-pending','待补充'));
    side.append(time,actions);article.append(art,info,side);
    return article;
  }

  function render(){
    const isTools=selectedType==='tools';
    const collection=isTools?tools:catalog;
    const name=isTools?'工具':'曲谱';
    const unit=isTools?'项':'份';
    const searchLabel=isTools?'搜索工具名称或关键词':'搜索曲名或歌手';
    search.placeholder=searchLabel;
    document.querySelector('label[for="search"]').textContent=searchLabel;
    document.querySelector('.list-heading h2').textContent=`${name}目录`;
    document.getElementById('library').setAttribute('aria-label',isTools?'工具目录':'曲谱库');
    sort.querySelector('[value="title"]').textContent=isTools?'名称排序':'曲名排序';
    document.getElementById('reset-filters').textContent=`查看全部${name} ↗`;
    const terms=search.value.trim().toLocaleLowerCase('zh-CN').split(/\s+/).filter(Boolean);
    const scores=collection.filter(score=>{
      const words=`${score.title} ${isTools?score.description||'':score.artist||''}`.toLocaleLowerCase('zh-CN');
      return (isTools||selectedType==='all'||score.type===selectedType)&&terms.every(term=>words.includes(term));
    }).sort((a,b)=>{
      const byTitle=a.title.localeCompare(b.title,'zh-CN',{numeric:true});
      return sort.value==='title'?byTitle:b.updatedAt.localeCompare(a.updatedAt)||byTitle;
    });
    list.replaceChildren(...scores.map((score,index)=>card(score,index,isTools)));
    resultCount.textContent=terms.length||(!isTools&&selectedType!=='all')?`找到 ${scores.length} ${unit} · 共 ${collection.length} ${unit}`:`共 ${collection.length} ${unit}${name}`;
    filters.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.type===selectedType)));
    empty.hidden=scores.length!==0;
    if(!scores.length){
      document.getElementById('empty-title').textContent=terms.length?`没有找到相关${name}`:isTools?'工具正在整理中':selectedType==='all'?'曲谱正在整理中':`暂时没有${types[selectedType]}谱`;
      document.getElementById('empty-description').textContent=isTools?(terms.length?'试试其他工具名称或关键词，或查看全部工具。':'吉他知识与练习工具会收录在这里。'):(terms.length?'试试其他曲名或歌手，或查看全部曲谱。':'制作完成后，会收录在这里。也可以先看看其他曲谱。');
    }
  }

  for(const count of document.querySelectorAll('[data-count]')){
    count.textContent=count.dataset.count==='tools'?tools.length:count.dataset.count==='all'?catalog.length:catalog.filter(score=>score.type===count.dataset.count).length;
  }
  filters.forEach(button=>button.addEventListener('click',()=>{
    const previous=selectedType==='tools'?'tools':'scores';
    queries[previous]=search.value;
    selectedType=button.dataset.type;
    search.value=queries[selectedType==='tools'?'tools':'scores'];
    render();
  }));
  search.addEventListener('input',render);
  sort.addEventListener('change',render);
  document.getElementById('reset-filters').addEventListener('click',()=>{search.value='';if(selectedType!=='tools')selectedType='all';render();search.focus();});
  status.hidden=true;
  render();
})();
