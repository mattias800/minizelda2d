// Verifies every channel of every song loops at the same length (in beats).
const mod = await import('../src/game/music.ts');
for (const id of ['forest', 'cave', 'shrine', 'boss', 'title', 'ending']) {
  const s = mod.song(id);
  const lens = s.channels.map((c) =>
    c.notes.trim().split(/\s+/).reduce((sum, tok) => sum + 4 / parseFloat(tok.split('/')[1] ?? '4'), 0),
  );
  console.log(id.padEnd(8), lens.map((l) => l.toFixed(2)).join('  '), new Set(lens.map((l) => l.toFixed(3))).size === 1 ? 'OK' : 'MISMATCH');
}
