//  outputs
//

export type TermUpdate =
  | Blit;

export type Tint =
  | null
  | 'r' | 'g' | 'b' | 'c' | 'm' | 'y' | 'k' | 'w'
  | { r: number, g: number, b: number };

export type Deco = null | 'br' | 'un' | 'bl';

export type Stye = {
  deco: Deco[],
  back: Tint,
  fore: Tint
};

export type Stub = {
  stye: Stye,
  text: string[]
}

export type Blit =
  | { bel: null }                                       //  make a noise
  | { clr: null }                                       //  clear the screen
  | { hop: number | { x: number, y: number } }          //  set cursor col/pos
  | { klr: Stub[] }                                     //  put styled
  | { mor: Blit[] }                                     //  multiple blits
  | { nel: null }                                       //  newline
  | { put: string[] }                                   //  put text at cursor
  | { sag: { path: string, file: string } }             //  save to jamfile
  | { sav: { path: string, file: string } }             //  save to file
  | { url: string }                                     //  activate url
  | { wyp: null }                                       //  wipe cursor line

//  inputs
//

export type Bolt =
  | string
  | { aro: 'd' | 'l' | 'r' | 'u' }
  | { bac: null }
  | { del: null }
  | { hit: { x: number, y: number } }
  | { ret: null }

export type Belt =
  | Bolt
  | { mod: { mod: 'ctl' | 'met' | 'hyp', key: Bolt } }
  | { txt: Array<string> }

export type Task =
  | { belt: Belt }
  | { blew: { w: number, h: number } }
  | { hail: null }
  | { open: { term: string, apps: Array<{ who: string, app: string }> } }
  | { shut: null }

export type SessionTask = { session: string } & Task
