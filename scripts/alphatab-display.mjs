// alphaTab 1.8.4 normally omits a mid-bar tied fret number. A tied note that
// starts a legato slide needs a parenthesized fret, as in source bar 16.
// Extend only NoteNumberGlyph's display condition; keep tie/slide audio data.
// The readable patched source and upstream MPL notice are embedded in HTML.
export function showTiedSlideFrets(library) {
  const condition = '} else if (n.beat.index === 0 && this.renderer.settings.notation.notationMode === NotationMode.GuitarPro || (n.bendType === BendType.Bend || n.bendType === BendType.BendRelease)';
  if (library.split(condition).length !== 2) {
    throw new Error('alphaTab NoteNumberGlyph changed; review the tied-slide display adjustment before building.');
  }
  return library.replace(condition,
    '// Project display adjustment: show parenthesized tied legato-slide origins.\n' +
    condition.replace('else if (', 'else if (n.slideOutType === SlideOutType.Legato && n.slideTarget || '));
}
