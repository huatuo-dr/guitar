// Add completed scores here. Paths are relative to the repository root.
// Optional fields: artist, timeSignature, capo (0 = no capo), bars, description.
window.GUITAR_SCORES = [
  {
    id: 'jiayibingding-chorus',
    title: '《甲乙丙丁》仅副歌',
    artist: '李佳薇',
    type: 'chorus',
    path: 'sheet_music/甲乙丙丁仅副歌.html',
    timeSignature: '4/4',
    capo: 5,
    bars: 15,
    updatedAt: '2026-10-16',
    description: '原调 F · C 指法，从“是你”接入副歌，含所选器乐收尾。'
  },
  {
    id: 'tong-nian-accompaniment',
    title: '《童年》弹唱伴奏',
    artist: '罗大佑',
    type: 'accompaniment',
    path: 'sheet_music/童年弹唱伴奏.html',
    timeSignature: '4/4',
    bars: 26,
    updatedAt: '2026-09-25',
    description: 'G 调弹唱，含前奏、扫弦、五段歌词与跳尾，简易谱按演唱顺序展开。'
  },
  {
    id: 'pian-ai-fingerstyle',
    title: '《偏爱》指弹',
    type: 'fingerstyle',
    path: 'sheet_music/偏爱指弹.html',
    timeSignature: '4/4',
    capo: 2,
    bars: 61,
    updatedAt: '2026-09-17',
    description: '前奏至 G 段完整收录，含逐小节核对说明。'
  },
  {
    id: 'lao-nan-hai-accompaniment',
    title: '《老男孩》弹唱伴奏',
    artist: '筷子兄弟',
    type: 'accompaniment',
    path: 'sheet_music/老男孩弹唱伴奏.html',
    timeSignature: '4/4 · 2/4',
    bars: 55,
    updatedAt: '2026-09-17',
    description: 'C 调弹唱，含简谱、歌词、和弦指法与完整反复路线。'
  },
  {
    id: 'hou-lai-accompaniment',
    title: '《后来》弹唱伴奏',
    artist: '刘若英',
    type: 'accompaniment',
    path: 'sheet_music/后来弹唱伴奏.html',
    timeSignature: '4/4',
    capo: 3,
    bars: 69,
    updatedAt: '2026-09-23',
    description: 'C 调指法、变调夹 3 品，新版前奏与间奏搭配旧版演唱伴奏，含简谱歌词。'
  },
  {
    id: 'kong-xin-accompaniment',
    title: '《空心》弹唱伴奏',
    artist: '光泽',
    type: 'accompaniment',
    path: 'sheet_music/空心弹唱伴奏.html',
    timeSignature: '4/4',
    bars: 47,
    updatedAt: '2026-09-17',
    description: 'C 调指法，含扫弦、琶音、简谱、双行歌词与反复跳尾。'
  },
  {
    id: 'tu-ran-hao-xiang-ni-accompaniment',
    title: '《突然好想你》弹唱伴奏',
    artist: '五月天',
    type: 'accompaniment',
    path: 'sheet_music/突然好想你弹唱伴奏.html',
    timeSignature: '4/4',
    capo: 2,
    bars: 55,
    updatedAt: '2026-09-18',
    description: '革命吉他编配，C 调指法、变调夹 2 品，含前奏、分解和弦、扫弦与简谱歌词。'
  },
  {
    id: 'canon-fingerstyle',
    title: '《卡农》指弹',
    artist: '深蓝雨吉他',
    type: 'fingerstyle',
    path: 'sheet_music/卡农指弹.html',
    timeSignature: '4/4',
    bars: 56,
    updatedAt: '2026-09-17',
    description: 'C 调指弹，含旋律简谱、和弦指法、击勾弦、滑音和反复跳尾。'
  },
  {
    id: 'canon-v2-fingerstyle',
    title: '《卡农》指弹·版本 2',
    type: 'fingerstyle',
    path: 'sheet_music/卡农指弹版本2.html',
    timeSignature: '4/4',
    bars: 9,
    updatedAt: '2026-09-17',
    description: 'C 调单旋律练习版，60 拍/分钟，含六线谱和对应简谱。'
  }
];

// Knowledge and practice tools are separate from the score collection.
// Add a relative path when the content page is ready; omit it for planned entries.
window.GUITAR_TOOLS = [
  {
    id: 'chord-charts',
    path: 'tools/各调和弦图.html',
    title: '各调和弦图',
    description: '各调常用和弦与吉他指法速查。',
    updatedAt: '2026-09-29'
  },
  {
    id: 'fretboard-scales',
    path: 'tools/各调指板音阶.html',
    title: '各调指板音阶',
    description: '七个大调的吉他指板音级与音名，空弦至第 15 品。',
    updatedAt: '2026-09-29'
  }
];
