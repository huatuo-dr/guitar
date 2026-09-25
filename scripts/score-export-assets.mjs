import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
export async function scoreExportAssets(){
 const read=path=>readFile(new URL(path,root),'utf8');
 const [css,script,library,license]=await Promise.all([read('src/score-export.css'),read('src/score-export.js'),read('node_modules/html-to-image/dist/html-to-image.js'),read('node_modules/html-to-image/LICENSE')]);
 return {css,script:`/* html-to-image (MIT)\n${license.replaceAll('*/','* /')}\n*/\n${library.replace(/\/\/# sourceMappingURL=.*$/gm,'')}\n${script}`.replace(/<\/script/gi,'<\\/script')};
}
