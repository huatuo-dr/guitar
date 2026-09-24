import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
export async function accompanimentPlayerAssets(playback) {
  const [library,font,soundFont,license,fontLicense,soundLicense]=await Promise.all([
    readFile(new URL('node_modules/@coderline/alphatab/dist/alphaTab.js',root),'utf8'),
    readFile(new URL('node_modules/@coderline/alphatab/dist/font/Bravura.woff2',root)),
    readFile(new URL('node_modules/@coderline/alphatab/dist/soundfont/sonivox.sf2',root)),
    readFile(new URL('node_modules/@coderline/alphatab/LICENSE',root),'utf8'),
    readFile(new URL('node_modules/@coderline/alphatab/dist/font/Bravura-OFL.txt',root),'utf8'),
    readFile(new URL('node_modules/@coderline/alphatab/dist/soundfont/LICENSE',root),'utf8')
  ]);
  const payload=JSON.stringify({...playback,font:font.toString('base64'),soundFont:soundFont.toString('base64')}).replaceAll('<','\\u003c');
  const licenses=[license,fontLicense,soundLicense].join('\n\n').replace(/[\t ]+$/gm,'').replaceAll('&','&amp;').replaceAll('<','&lt;');
  const script=library.replace(/\/\/# sourceMappingURL=.*$/gm,'').replace(/[\t ]+$/gm,'').replace(/<\/script/gi,'<\\/script');
  return {
    assets:`<div id="accompaniment-audio" hidden aria-hidden="true"></div><script id="accompaniment-audio-library">${script}</script><script type="application/json" id="accompaniment-playback-data">${payload}</script><script>let accompanimentPlayer;</script>`,
    licenses:`<details class="verification player-licenses"><summary>播放组件开源许可</summary><pre>${licenses}</pre></details>`,
    controls:`<div class="player-controls" aria-label="伴奏播放"><button type="button" id="player-play" disabled>播放</button><button type="button" id="player-stop" disabled>停止</button><label class="label" for="player-speed">练习速度</label><select id="player-speed">${[30,40,50,60,70,80,90,100,120].map(bpm=>`<option value="${bpm}"${bpm===60?' selected':''}>${bpm} BPM</option>`).join('')}</select><span id="player-status" role="status">正在准备音色…</span></div>`
  };
}
