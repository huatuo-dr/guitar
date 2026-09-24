---
name: guitar-score-workflow
description: Use when creating, transcribing, remaking, or correcting guitar scores in the 小k吉他练习 repository from screenshots or source links, including 指弹、弹唱、简谱歌词、反复路线 and 简易谱. Not for unrelated homepage styling or general audio-library research.
---

# 小k吉他制谱

为本仓库制作可维护、可离线打开的独立 HTML 曲谱。原图提供依据，`score/` 保存音乐内容，构建脚本生成谱面；截图不作为成品谱面的拼图。

这是项目内 skill，存于 `.agents/skills/guitar-score-workflow/`。下文路径相对仓库根目录；先确认所在目录。当前用户要求优先于这里的默认约定。

## 选对修改入口

| 任务 | 入口 |
| --- | --- |
| 修改《偏爱》 | `score/intro.json`、`a-section.json`、`b-section.json`、`c-section.json`、`remaining.json`；歌词见 `score/pianai-lyrics.json` |
| 新建弹唱或原生 SVG 指弹谱 | 参考最近似的 `score/<id>.json`、`score/<id>-vocal.json`，复用 `scripts/build-accompaniment.mjs` |
| 完整谱布局、技法绘制 | `src/accompaniment.html`、`scripts/accompaniment-svg.mjs`、`scripts/numbered-notation.mjs` |
| 简易谱 | `simpleScore` 配置、`scripts/simple-score.mjs`、`src/simple-score.js`、`src/simple-score.css` |
| 《偏爱》布局 | `src/template.html`、`scripts/build.mjs`、`scripts/alphatab-display.mjs` |

共享构建链也服务《卡农》指弹，不要仅凭曲目类型另建渲染器。修改生成的 HTML 或 AlphaTex 无法经受下一次构建，改动应落在源数据或模板。

## 读取与转录

1. 清点本次 `tmp/`、`截图/` 或链接中的实际材料。记录页序、小节范围、曲名、署名、拍号、原调、指法调与变调夹；未知参数不补猜。网页必须打开谱图，不能以文章标题或封面代替查看原谱。
2. 按实际小节线读完整小节。已确认的练习红框不是裁剪边界；新材料的标记若有歧义，再核实。截图与文字目录冲突时先查用户已有确认，仍影响制谱的疑点再明确提出，同时继续清晰部分。
3. 逐事件识读弦品、节奏、同时发音、弧线和歌词落点。放大预览可放 `artifacts/`；从源数据重建不应依赖这些预览或原截图。
4. 改版时按乐句和事件对齐新旧版本，不按页码或小节号直接替换。用户指定保留的前奏、间奏、伴奏或旋律应分别保留；将对应关系记入曲目 `notes`。

录入前按需要阅读 [记谱与数据约定](references/notation.md)。包含简易谱或修改页面时阅读 [简易谱与阅读界面](references/simple-and-ui.md)。

## 接入与交付

- 新曲新增独立曲目数据和薄构建入口，登记 `assets/catalog.js`，接入 `package.json` 的总构建及相关测试入口。区分同名不同版本；只有明确要求替换时才替换旧谱。
- 首页使用相对路径和普通脚本清单，适配本地文件与 GitHub Pages 子路径。脚本、谱面和必要字体内嵌，避免引入打开页面时必须联网的资源。
- 用户指定先审查或记法尚未确定时，可先做小范围样稿；格式明确且要求全曲时，完成已授权范围，不增加分段审批。
- 按 [校核与构建](references/verification.md) 验证。数据与渲染一致只说明转换一致，仍要对照原图。
- 交付可打开的 HTML、完成范围和实际验证结果，说明尚未确认的音符或来源差异。默认不提交、不 push；已有授权覆盖本轮时直接执行。

## 资料时效与范围

`docs/制谱.html` 是历史实践记录，含旧版《后来》结构、早期曲目数量和横向打印描述。确认当前行为时优先看现行源数据、模板、测试和用户最新要求。

播放功能目前处于方案调研阶段。不要把“可以接入 alphaTab 播放”写成已经具备的能力，也不要在普通制谱任务中自动添加播放器、全局依赖或其他 skill。
