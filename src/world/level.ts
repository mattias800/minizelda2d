import { RoomDef } from './rooms';
import { TILE, Tile, TileMap } from './tilemap';

export interface Spawn {
  kind: string;
  /** Tile coordinates of the legend character. */
  cx: number;
  cy: number;
  /** Feet position in pixels: bottom-center of the tile. */
  x: number;
  y: number;
}

const TILE_CHARS: Record<string, Tile> = {
  '#': Tile.Solid,
  '/': Tile.SlopeUp,
  '\\': Tile.SlopeDown,
  '-': Tile.OneWay,
  '^': Tile.Thorns,
};

export interface ParsedRoom {
  map: TileMap;
  spawns: Spawn[];
}

export function parseRoom(def: RoomDef): ParsedRoom {
  const rows = def.map;
  const map = new TileMap(rows[0].length, rows.length);
  const spawns: Spawn[] = [];
  rows.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) {
      const ch = row[cx];
      const t = TILE_CHARS[ch];
      if (t !== undefined) map.set(cx, cy, t);
      else if (ch !== '.') spawns.push({ kind: ch, cx, cy, x: cx * TILE + TILE / 2, y: (cy + 1) * TILE });
    }
  });
  return { map, spawns };
}
