# 小k吉他练习

这个仓库用于根据截图或网页原谱制作吉他谱，并通过静态网页展示成品。

## 打开首页

直接用浏览器打开 [index.html](index.html)，即可使用曲名/歌手搜索、指弹/弹唱伴奏分类、更新时间/曲名排序，并打开或下载曲谱。支持本地离线与 GitHub Pages，首页不依赖服务器、外部字体或 JavaScript 框架。

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

首页不会自动扫描目录，也不需要构建；曲谱文件和清单一起维护。普通脚本加载清单，避免本地文件打开时 `fetch` JSON 的限制。`npm run build` 会重新生成《偏爱》和《老男孩》两份独立曲谱；`npm run build:laonanhai` 仅生成《老男孩》。

## 手机阅读

两份曲谱均支持“每行小节：自动 / 2 / 4”和“谱面大小：适应宽度 / 50% / 65% / 85% / 100% / 更大比例”。默认自动换行并适应可用宽度：窗口小于 700px 时每行两小节，其余为四小节。手动放大后可在谱面内横向滑动；固定百分比相对于所选行数的标准谱面宽度。

每份曲谱分别记住行数与缩放选项，横竖屏切换会重新计算自动布局。浏览器不允许本地存储时，当前页面仍可正常调整，只是不保留到下次。打印始终使用四小节并适应纸张，结束后恢复屏幕选项。共享逻辑在 `src/score-view.js`，构建时内嵌到两份 HTML，无需额外资源请求。《老男孩》同时内嵌两种矢量排版，禁用 JavaScript 后仍可阅读四小节版。

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

`npm run test:browser` 同时检查两份曲谱和首页；`npm run test:home` 仅检查首页。可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定已有 Chromium。首页测试包含离线打开、搜索/分类/排序、手机适配、真实 HTML 下载和模拟 `/guitar/` 子路径发布；额外的排序样本仅作为测试夹具，不加入真实目录。

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
- `score/score.alphatex`：全曲 61 小节的完整文本乐谱。
- `score/intro.alphatex`：单独前奏的文本乐谱，供回归核对。
- `src/template.html`：页面及制谱设置。
- `scripts/build.mjs`：生成单文件 HTML。
- `scripts/alphatab-display.mjs`：对固定版本的谱面显示作局部调整，使延音滑音起点显示括号品号。
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

打印保持 A4 横向，当前为四页，C 段从第二页开始。打印样式将制谱库每行 SVG 的容器纳入正常文档流并避免行内分页，防止跨页绝对定位造成谱行重叠。

小节信息中 C 段为 17–28，D 段为 26–36，存在重叠。第 29 小节截图实际标注了 D 段，用户已确认按截图将 D 段定位为 29–36；26–28 不重复插入。

段定位范围：前奏 1–4、A 5–12、B 13–16、C 17–28、D 29–36、E 37–40、F 41–55、G 56–61。重复关系严格沿用小节信息：41–47=17–23、50–55=18–23、57–60=25–28。第 48 小节只将 3→5 记为连奏滑音，随后 3 重新拨弦；第 61 小节和弦只有首拍拨响，后面三拍为同音延音。
