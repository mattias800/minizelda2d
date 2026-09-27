/**
 * The world. Each room occupies a rectangle of "screen cells" on the world
 * grid (a cell is exactly one 21x12 tile screen). Rooms connect implicitly:
 * walking off an open edge of a room enters whatever room occupies that spot
 * of the grid. The map screen is drawn from this same data.
 *
 * Map legend
 *   Tiles:     #  ground     /  slope up    \  slope down    -  one-way platform
 *              ^  thorns     *  bramble (burn with fire)      .  air
 *              L  solid foliage (drawn as leaves)
 *              &  background earth: scenery behind the playfield, not solid
 *   Entities:  P  player start      o  save stone      q  squirrel
 *              m  moblin    M  moblin brute    x  spear moblin    s  slime
 *              b  bat       w  spider          K  the guardian (boss)
 *              r  rupee     $  big rupee       j  magic jar       H  heart container
 *              c  chest (contents: RoomDef.chest)
 *              T  big tree  u  yellow mushroom  U  red mushroom    f  heart flower
 */

export const SCREEN_COLS = 21;
export const SCREEN_ROWS = 12;

export type Theme = 'forest' | 'cave' | 'canopy' | 'shrine' | 'hollow';
export type ItemId = 'feather' | 'fire';
export type MusicId = 'forest' | 'cave' | 'shrine' | 'boss';

export interface RoomDef {
  id: string;
  name: string;
  theme: Theme;
  music: MusicId;
  /** Position and size on the world grid, in screen cells. */
  gx: number;
  gy: number;
  map: string[];
  chest?: ItemId;
}

const rows = (s: string): string[] =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

export const ROOMS: RoomDef[] = [
  {
    id: 'clearing',
    name: 'Whispering Clearing',
    theme: 'forest',
    music: 'forest',
    gx: 0,
    gy: 1,
    map: rows(String.raw`
      LLLLL.....................................
      LLLLL.....................................
      LLLL..............................---.....
      LLLL......................................
      LLL................................r......
      ..**........u...................#######...
      ..**.....&&&&&&.................#######...
      ..**.....&&&&&&...........................
      ..**....f&&&&&&...........................
      ..**.o#######\&T...q.P..rr.m.U............
      ##########################################
      ##########################################
    `),
  },
  {
    id: 'path',
    name: 'Old Forest Path',
    theme: 'forest',
    music: 'forest',
    gx: 2,
    gy: 1,
    map: rows(String.raw`
      ........................................##
      ........................................##
      ........................................##
      ........................................##
      ..................................H.....##
      .................................###....##
      .................................###....##
      .............r.s..r..............###....##
      ...........########\.............###....##
      .....m..../##########\..s........###..x.##
      ###########################...############
      ###########################...############
    `),
  },
  {
    id: 'cavern',
    name: 'Mossy Cavern',
    theme: 'cave',
    music: 'cave',
    gx: 2,
    gy: 2,
    chest: 'feather',
    map: rows(String.raw`
      ###########################...############
      ###########################...############
      #####........#####.................#######
      ###............##.....................####
      ##........................-----.........##
      ##................b.................b...##
      #####...................................##
      #...*.........................####......##
      #...*.........................####......##
      #.H.*...c.....M.........s.....####..rrr.##
      ####################^^^###################
      ##########################################
    `),
  },
  {
    id: 'canopy',
    name: 'High Canopy',
    theme: 'canopy',
    music: 'forest',
    gx: 0,
    gy: 0,
    map: rows(String.raw`
      .......*................................##
      .......*....w...........................##
      .......*................................##
      ...H...*..............w.................##
      .######*....r...........................##
      .######...#####...........r...............
      ..........#####.........#####.............
      ..................r.....#####.............
      .................----..................###
      ...............................--------###
      ..........................................
      ..........................................
    `),
  },
  {
    id: 'shrine',
    name: 'Forgotten Shrine',
    theme: 'shrine',
    music: 'shrine',
    gx: 2,
    gy: 0,
    chest: 'fire',
    map: rows(String.raw`
      #####################
      #####################
      #...................#
      #...................#
      #...................#
      ....................#
      ....................#
      ...o......c..x......#
      ################...##
      ################...##
      ################...##
      ################...##
    `),
  },
  {
    id: 'hollow',
    name: 'Thorn Hollow',
    theme: 'hollow',
    music: 'cave',
    gx: -1,
    gy: 1,
    map: rows(String.raw`
      #####################
      #####################
      #####################
      ###......###......###
      ##..........b......##
      #...................#
      #........j..........#
      ........###..........
      ........###..........
      ...o....###.....s....
      #####^^^###^^^#######
      #####################
    `),
  },
  {
    id: 'lair',
    name: "Guardian's Lair",
    theme: 'hollow',
    music: 'boss',
    gx: -2,
    gy: 1,
    map: rows(String.raw`
      #####################
      #####################
      #...................#
      #...................#
      #...................#
      #...................#
      #..----.......----..#
      #....................
      #....................
      #.....K..............
      #####################
      #####################
    `),
  },
];

/** Width/height of a room in screen cells, derived from its map. */
export function roomCells(def: RoomDef): { w: number; h: number } {
  return { w: def.map[0].length / SCREEN_COLS, h: def.map.length / SCREEN_ROWS };
}

export function validateRooms(): void {
  for (const r of ROOMS) {
    const w = r.map[0].length;
    r.map.forEach((row, i) => {
      if (row.length !== w) throw new Error(`Room ${r.id} row ${i} has length ${row.length}, expected ${w}`);
    });
    if (w % SCREEN_COLS !== 0 || r.map.length % SCREEN_ROWS !== 0)
      throw new Error(`Room ${r.id} is ${w}x${r.map.length}, not a multiple of the screen size`);
  }
}

/** Finds the room covering world grid cell (cx, cy). */
export function roomAtCell(cx: number, cy: number): RoomDef | undefined {
  return ROOMS.find((r) => {
    const { w, h } = roomCells(r);
    return cx >= r.gx && cx < r.gx + w && cy >= r.gy && cy < r.gy + h;
  });
}

export function roomById(id: string): RoomDef {
  const r = ROOMS.find((x) => x.id === id);
  if (!r) throw new Error(`No room '${id}'`);
  return r;
}
