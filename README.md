# 小k吉他练习

这个仓库用于根据截图或网页原谱制作吉他谱，并通过静态网页展示成品。

## 打开首页

直接用浏览器打开 [index.html](index.html)，即可使用曲名/歌手搜索、指弹/弹唱伴奏分类、更新时间/曲名排序，并打开曲谱；进入曲谱后，点击“打印 / 存为 PDF”后面的“下载 HTML”即可保存离线文件（本地打开也支持）。支持本地离线与 GitHub Pages，首页不依赖服务器、外部字体或 JavaScript 框架。

- `index.html`：首页结构。
- `assets/catalog.js`：独立曲谱清单，新增曲谱时在这里登记。
- `assets/home.js`、`assets/home.css`：首页交互和样式。
- `sheet_music/`：制作完成的独立 HTML 曲谱。
- [docs/制谱.html](docs/制谱.html)：实际制谱流程、工具及校核经验。

## 添加曲谱

1. 将完成的曲谱 HTML 放入 `sheet_music/`。
2. 在 `assets/catalog.js` 的 `window.GUITAR_SCORES` 数组中添加一条记录，使用唯一 `id`、真实曲名和更新时间。
3. 运行 `npm run test:home` 检查清单与首页，并实际打开新曲谱核对显示；发布时提交并推送相关文件。

当前条目示例：

```js
{
  id: 'pian-ai-fingerstyle',
  title: '《偏爱》指弹',
  type: 'fingerstyle',
  path: 'sheet_music/偏爱指弹.html',
  timeSignature: '4/4',
  capo: 2,
  bars: 61,
  updatedAt: '2026-09-16',
  description: '前奏至 G 段完整收录，含逐小节核对说明。'
}
```

`type` 为 `fingerstyle`（指弹）或 `accompaniment`（弹唱伴奏）；`updatedAt` 使用 `YYYY-MM-DD`。`artist`、`timeSignature`、`capo`、`bars` 和 `description` 可省略，未知信息不要补猜；`capo: 0` 表示无需变调夹。`path` 是相对仓库根目录的路径，不要以 `/` 开头。

首页不会自动扫描目录，也不需要构建；曲谱文件和清单一起维护。普通脚本加载清单，避免本地文件打开时 `fetch` JSON 的限制。`npm run build` 会重新生成《偏爱》《老男孩》《后来》《空心》《突然好想你》《卡农》及《卡农》版本2七份独立曲谱；`npm run build:laonanhai`、`npm run build:houlai`、`npm run build:kongxin`、`npm run build:turanhaoxiangni`、`npm run build:canon` 和 `npm run build:canon-v2` 分别只生成对应曲谱。

## 手机阅读

七份曲谱均支持“每行小节：自动 / 2 / 4”和“谱面大小：适应宽度 / 50% / 65% / 85% / 100% / 更大比例”。默认自动换行并适应可用宽度：窗口小于 700px 时每行两小节，其余为四小节。手动放大后可在谱面内横向滑动；固定百分比相对于所选行数的标准谱面宽度。

每份曲谱分别记住行数与缩放选项，横竖屏切换会重新计算自动布局。浏览器不允许本地存储时，当前页面仍可正常调整，只是不保留到下次。打印始终使用四小节并适应纸张，结束后恢复屏幕选项。共享逻辑在 `src/score-view.js`，构建时内嵌到七份 HTML，无需额外资源请求。《老男孩》《后来》《空心》《突然好想你》《卡农》及《卡农》版本2同时内嵌两种矢量排版，禁用 JavaScript 后仍可阅读四小节版。

## 自动滚动

七份曲谱右下角均提供固定的“滚／停”按钮，点击开始或停止自动向下滚动。手动拖动、滚轮、键盘翻页及段定位不会关闭运行状态；操作结束后从当前位置接着滚。滚到底部仍保持“停”，手动向上翻后继续滚动。

长按按钮约半秒或点击“速度：适中”可选很慢、慢、适中、快、很快（8／14／22／34／50像素每秒）。选择即时生效，每份曲谱分别记住速度，重新打开仍默认停止。点击面板外部或按Esc关闭速度选择。打印时按钮隐藏并暂停位移，打印结束后保留原运行状态。

实现位于 `src/auto-scroll.js` 与 `src/auto-scroll.css`，构建时内嵌到独立HTML；不依赖网络。`tests/auto-scroll.mjs` 已纳入 `npm run test:browser`，覆盖长按、手机触摸、连续位移、底部恢复、五档速度、存储与打印。

## 发布到 GitHub Pages

1. 将网站文件提交并推送到 GitHub 仓库的 `master` 分支。
2. 打开仓库 **Settings → Pages**。
3. 在 **Build and deployment → Source** 选择 **Deploy from a branch**。
4. 选择 **master** 和 **/ (root)**，点击 **Save**。
5. 等待 Pages 部署完成，打开 `https://huatuo-dr.github.io/guitar/`（采用默认域名时）。

根目录已包含 `.nojekyll`，按普通静态文件发布。站内链接使用相对路径，适配 `/guitar/` 前缀；不要选择 `/docs` 发布目录。HTML 曲谱本身仍可下载后离线打开。本次代码配置不代表远端 Pages 已启用。

参见 [GitHub Pages 发布源配置](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)和[静态站点入口说明](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)。

## 验证

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

`npm run test:browser` 同时检查七份曲谱和首页；`npm run test:home` 仅检查首页。可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定已有 Chromium。首页测试包含离线打开、搜索/分类/排序、手机适配和模拟 `/guitar/` 子路径发布；下载测试另行验证七份曲谱在本地和网站上的保存、离线重开与再次下载；额外的排序样本仅作为测试夹具，不加入真实目录。

## 已完成曲谱：《卡农》指弹·版本2

打开 [sheet_music/卡农指弹版本2.html](sheet_music/卡农指弹版本2.html)。根据用户提供的一张手机截图制作，与原有56小节版独立保存。本版为9小节的单旋律练习，C调、4/4、每分钟60拍，共113个单音，无和弦图、低音伴奏、技法标记或反复；未补猜作者、编配者与变调夹。

第1–8小节各14音，八分及十六分音符混合；第3与第7小节相同。第9小节二弦1品为全音符，保留圈形品位和无符干画法，简谱为高音1延续四拍。六线谱与简谱逐音对应，原图黄色高亮作为显示标记省略。无和弦图时省去速查入口和谱行上方空白。

`score/canon-v2.json` 与 `score/canon-v2-vocal.json` 保存六线谱和简谱，`npm run build:canon-v2` 生成独立HTML。支持每行2/4小节、缩放、定位、自动滚动、打印、下载与离线。`tests/canon-v2.test.mjs` 验证拍数、113音及两个声部音高相符，`tests/canon-v2-browser.mjs` 检查完整品数、全音符、手机、离线和曲谱库入口。

## 已完成曲谱：《卡农》指弹

打开 [sheet_music/卡农指弹.html](sheet_music/卡农指弹.html)。依据用户提供的深蓝雨吉他三页截图重绘，共56个书写小节，保留六线谱、和弦指法和独立旋律简谱。原谱为C调、4/4，建议每分钟60–65拍，视频录制速度64拍；未标变调夹，页面不补猜品位。原谱说明为参考网络并适当修改的指弹教学版。

`score/canon.json` 保存逐弦品位、节奏、和弦、段落和反复，`score/canon-vocal.json` 保存原图旋律简谱（本曲无歌词）；`npm run build:canon` 调用共享SVG绘谱程序生成单文件HTML。界面沿用已有曲谱风格，支持离线、2/4小节、缩放、段定位、自动滚动、打印与下载。新增的 `fretted` 事件按同列显示同时弹响的音符，H/P/S逐弦记录，不根据和弦图补出原谱没有的音符。

演奏路线为 **1–16 → 13–15 → 17–21 → 18–19 → 22–27 → 24–27 → 28–51 → 48–51 → 52–56**。第一组第一房子16、第二房子17；第二组第一房子20–21、第二房子22–23；24–27与48–51分别反复。小节号沿用原图，段名为阅读辅助。

第14小节一弦3→5为滑音；第18、28、44小节包含勾弦，其他H击弦按图保留。第25小节第二拍的四弦2→3击弦与下方简谱2→3不对应，本版将两谱分别照录并注明，不自行改写。第42–46小节保留高把位品数；第56小节仅首拍5弦至2弦琶音，后面延续三拍。

`tests/canon.test.mjs` 检查全曲时值、品数、技法和反复路线，`tests/canon-browser.mjs` 检查两种换行、手机、打印和离线交互。`tests/fretted-score.test.mjs` 验证同时发声音符及逐弦技法，并拒绝重复弦位和缺失技法终点。

## 已完成曲谱：《突然好想你》弹唱伴奏

打开 [sheet_music/突然好想你弹唱伴奏.html](sheet_music/突然好想你弹唱伴奏.html)。依据用户提供的“弦心距”音乐四页截图重绘，共62个书写小节。五月天演唱，原调D、C调指法、变调夹第2品、4/4。保留前奏与尾奏旋律、简谱、双行歌词、分解和弦、扫弦、琶音及17种指法；原谱将间奏电吉他SOLO改为扫弦，本版沿用该改编。

`score/turanhaoxiangni.json` 保存伴奏、指法、段落与路线，`score/turanhaoxiangni-vocal.json` 保存逐音简谱和歌词；`npm run build:turanhaoxiangni` 生成独立HTML。支持离线、2/4小节、缩放、段定位、自动滚动、打印与下载。

演奏路线为 **1–12 → 5–11 → 13–62**。第12小节为第一房子，13为第二房子。第14小节另有反复起号，但其后原图未见对应终止，按图保留并在页面说明，路线不臆补重复。

第11、28、52、56小节首音为双附点四分音符；第12小节为三弦0→2击弦，第13小节含八分休止和六弦12→0滑音；第17、41小节保留扫弦延音，第56→57小节旋律和伴奏均跨小节延音。前后奏的升5、降6、括号和无词部分按原图保留。G与G′、Fm与Fm′分别保存不同指法，G(3)为第3把位。小节编号、段名为阅读辅助，未补猜速度。

`tests/turanhaoxiangni.test.mjs` 检查62小节各声部时值、指法、歌词、技法与路线；`tests/turanhaoxiangni-browser.mjs` 检查实际排版和手机交互。`tests/accompaniment-ornaments.test.mjs` 覆盖共享绘谱程序新增的双附点、休止、滑音与跨小节伴奏延音。

## 已完成曲谱：《空心》弹唱伴奏

打开 [sheet_music/空心弹唱伴奏.html](sheet_music/空心弹唱伴奏.html)。根据用户提供的三页截图重绘，共47个书写小节，包含和弦指法、扫弦与琶音、简谱、双行歌词及反复跳尾。原谱为光泽演唱，姚若龙作词、光泽作曲，皋尚艺琴行（六安）编配，原调与选调均为C、4/4。变调夹保留男声5–7品、女声0–2品建议，不另设固定品位或速度。

`score/kongxin.json` 保存伴奏、段落、指法与路线，`score/kongxin-vocal.json` 保存简谱和逐音歌词；`npm run build:kongxin` 使用共享SVG绘谱程序生成独立HTML。支持离线阅读、每行2/4小节、缩放、段定位、自动滚动、打印与下载。原图没有小节号，编号及段名为阅读辅助。

演奏路线为 **1–30 → 5–29 → 31–47**，第30小节为第一房子，第31小节为开放的第二房子。第4、12小节保留扫弦延音及第四拍G琶音，第21小节保留低音扫弦与十六分节奏；第20小节含装饰音，第24小节含十六分三连音，第46–47小节保留跨小节长延音。Fmaj7按原图保留 `003210` 指法。`tests/kongxin.test.mjs` 和 `tests/kongxin-browser.mjs` 检查转录数据、特殊技法与实际显示。

## 已完成曲谱：《后来》弹唱伴奏

打开 [sheet_music/后来弹唱伴奏.html](sheet_music/后来弹唱伴奏.html)。依据用户提供的无限延音三页截图重绘，共49个书写小节。原谱标注刘若英演唱、1=E♭、变调夹第3品、C调指法；不另补速度。前奏品位与击勾弦、分解和弦叉号、扫弦、简谱和双行歌词均为矢量绘制，支持手机每行2或4小节、缩放、段定位、打印和离线阅读。

- `score/houlai.json`：和弦指法、逐小节伴奏、段落和反复路线。
- `score/houlai-vocal.json`：数字简谱与逐音歌词。
- `scripts/build-houlai.mjs`：单独构建入口；与《老男孩》共用 `scripts/build-accompaniment.mjs`、SVG绘谱程序及页面模板。
- `tests/houlai.test.mjs`、`tests/houlai-browser.mjs`：拍数、技法、路线、简谱、歌词与实际浏览器显示校验。

六线谱中的×表示按当前和弦拨响指定弦，指法图顶端的×表示该弦不弹，两者位置与含义不同。前奏F〈5〉保留第5把位指法，六弦至一弦为 `5 8 7 5 6 5`。第4小节包含三十二分击勾弦；第23小节保留临时降6，第27、29小节末拍为八分三连音。第8→9、第13→14保留跨小节延音，第38→39按图不补同样连线。

演奏路线为 **1–28 → 13–26 → 29–43 → 31–41 → 44–49**。第一组反复的第一房子为27–28、第二房子29；第二组第一房子42–43、第二房子44。跳至29时保留从26承接的入弧。原始截图在忽略的 `tmp/` 中，构建和阅读仅依赖已转录的数据与生成HTML。

## 已完成曲谱：《老男孩》弹唱伴奏

打开 [sheet_music/老男孩弹唱伴奏.html](sheet_music/老男孩弹唱伴奏.html)。根据[吉他寻谱网页原图](https://www.jitaxp.com/jitatanchangpu/403.html)整理 55 个书写小节、和弦指法、扫弦、击弦过门与琶音，并依据用户提供的三张截图补充简谱和逐音歌词。支持每行两或四小节、段定位、缩放、打印和离线打开。

本谱采用构建时生成的原生 SVG，保留箭头扫弦记法，无需外部库、字体或网络，禁用 JavaScript 后仍能阅读。`score/laonanhai.json` 保存和弦与节奏模式、逐小节引用、演奏路线和核对说明；`scripts/accompaniment-svg.mjs` 负责时值校验、和弦图和六线谱绘制；`scripts/build-laonanhai.mjs` 与 `src/accompaniment.html` 生成单文件成品。

`score/laonanhai-vocal.json` 保存简谱音级、八度、时值、附点、装饰音、连线与歌词字位；`scripts/numbered-notation.mjs` 校验并绘制简谱。简谱与伴奏共用拍点位置，按歌词行数调整谱行高度；跨小节延音线在换行后仍保留。原图中的双行歌词分别保留两段演唱，器乐旋律也按截图转录。构建只依赖已转录的 JSON，不依赖被忽略的 `tmp/` 截图。

第 18、43 小节依据用户确认的新参考谱统一为 **2/4**，第 19、44 小节恢复 **4/4**，六线谱与简谱均标出变拍。F、G 分别从第 1、2 拍开始，两声部时值严格一致。第 43 小节延音后的高音 2 按新谱记为一个八分音符；不加倍旋律时值或补休止。

Dm7、A7、G7 采用图中的 `x00211`、`002223`、`300001` 指法；原谱只写名称的 G/B 补充 `x20003`，用 † 标为参考。未补猜速度与变调夹。小节编号和段名为阅读辅助。

保留第 1 房子 28–29、第 2 房子 30，完整路线为 **1–29 → 7–27 → 30–45 → 21–26 → 46–47 → 21–27 → 48–55**。两次 D.S. 均返回 21：第一次在 27 之前跳至 46，第二次在 28 之前跳至 48。`tests/accompaniment.test.mjs` 检查时值、过门、指法与路线；`tests/accompaniment-browser.mjs` 检查离线、段定位、缩放、打印和首页集成。

## 已完成曲谱：《偏爱》指弹

直接用浏览器打开 [sheet_music/偏爱指弹.html](sheet_music/偏爱指弹.html)。生成的曲谱统一存放在 `sheet_music/` 目录。文件内嵌脚本、字体与乐谱，离线可用，无需启动服务器。可缩放、按段定位、打印或存为 PDF；窄屏可在谱面内横向滚动。

已完成全曲第 1–61 小节，含前奏及 A–G 段，重复小节完整展开。每行四小节时共十六行，最后一行一个结尾小节；手机自动切换为每行两小节。演奏记号说明在曲谱之前，延音/装饰音解释另起一行。用户已确认红色虚线只是练习标记，保留整小节。品位、节奏及技巧按原图转录；变调夹第 2 品。曲名由用户提供，没有自行添加速度、和弦名或力度标记。

- `score/intro.json`：已审查前奏的逐小节转录，弦号从最细的一弦开始。
- `score/a-section.json`：A 段逐小节转录；包含延音与装饰音。
- `score/b-section.json`：B 段逐小节转录；包含琶音、连奏滑音及延音滑音。
- `score/c-section.json`：C 段逐小节转录；包含三连音、连续延音、滑音、泛音与星号。
- `score/remaining.json`：D–G 段新增转录及 `repeatOf` 来源引用，构建时展开。
- `score/pianai-lyrics.json`：依据用户提供的两页带词参考谱，保存逐音歌词、重复段映射和改编位置说明；不修改原始指弹音符。
- `score/score.alphatex`：全曲 61 小节的完整文本乐谱。
- `score/intro.alphatex`：单独前奏的文本乐谱，供回归核对。
- `src/template.html`：页面及制谱设置。
- `scripts/build.mjs`：生成单文件 HTML。
- `scripts/alphatab-display.mjs`：对固定版本的谱面显示作局部调整，使延音滑音起点显示括号品号。
- `scripts/pianai-lyrics.mjs`：校验歌词落点与复制来源，在构建时附加到对应音符。
- `tests/`：转录与浏览器检查。

开发命令：

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

若使用已有 Chromium，可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定可执行文件。所有 npm 依赖与额外 skill 均安装在项目内。

渲染使用 alphaTab 1.8.4；完整许可证及 Bravura 字体许可已内嵌到 HTML 的「开源许可」中。`artifacts/` 保存检查截图及打印样张，不是打开 HTML 所需的依赖。

第 16 小节的 `(2)` 是延音终点兼连奏滑音起点。alphaTab 默认省略小节中间的延音品号，因此构建时在其 NoteNumberGlyph 中补充这一显示条件。保持原始延音、滑音和非幽灵音属性。修改后的可读库源码与许可一同内嵌到 HTML；若升级库导致匹配条件变化，构建会停止以便复核。

C 段的星号（*）表示打板，含义经用户确认；按原图保存为 beat text。页面在固定版本的 `Environment.defaultRenderers` 中将 `TextEffectInfo` 的 effect band 置于谱下（`SharedBottom = 3`），由制谱库布局和绘制。其他演奏记号与音符语义不变。三连音使用 AlphaTex `tu 3 2`，装饰音不另占标称节拍。语法依据 [alphaTab 文档](https://alphatab.net/docs/alphatex/document-structure)。

歌词使用 AlphaTex 的逐音符 `lyrics` 属性，原生 `LyricsEffectInfo` 排在谱下，并预留与节拍线、打板标记的间距。每行两/四小节、缩放、打印和下载均包含歌词。参考谱为29小节带反复版本，当前61小节按旋律对应关系展开；19/20及其重复、24–25、34、48、56–57等改编位置的对齐依据见页面“原谱对照与整理说明 → 歌词对齐说明”，供审查。前奏和没有新歌词的尾奏留空，装饰音及延音不重复填字。`tests/pianai-lyrics.test.mjs` 校验字位与原始音符不变，`tests/pianai-lyrics-browser.mjs` 检查全曲歌词在各布局下不丢失、不重叠或裁切。

打印保持 A4 横向，歌词版当前为四页。打印样式将制谱库每行 SVG 的容器纳入正常文档流并避免行内分页，防止跨页绝对定位造成谱行重叠。

小节信息中 C 段为 17–28，D 段为 26–36，存在重叠。第 29 小节截图实际标注了 D 段，用户已确认按截图将 D 段定位为 29–36；26–28 不重复插入。

段定位范围：前奏 1–4、A 5–12、B 13–16、C 17–28、D 29–36、E 37–40、F 41–55、G 56–61。重复关系严格沿用小节信息：41–47=17–23、50–55=18–23、57–60=25–28。第 48 小节只将 3→5 记为连奏滑音，随后 3 重新拨弦；第 61 小节和弦只有首拍拨响，后面三拍为同音延音。
