# 《偏爱》指弹六线谱

直接用浏览器打开 [sheet_music/偏爱指弹.html](sheet_music/偏爱指弹.html)。生成的曲谱统一存放在 `sheet_music/` 目录。文件内嵌脚本、字体与乐谱，离线可用，无需启动服务器。可缩放、按段定位、打印或存为 PDF；窄屏可在谱面内横向滚动。

已完成全曲第 1–61 小节，含前奏及 A–G 段，重复小节完整展开。每行四小节，共十六行，最后一行一个结尾小节；演奏记号说明在曲谱之前，延音/装饰音解释另起一行。用户已确认红色虚线只是练习标记，保留整小节。品位、节奏及技巧按原图转录；变调夹第 2 品。曲名由用户提供，没有自行添加速度、和弦名或力度标记。

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
