import { ITheme } from 'xterm';

export const makeTheme = (dark: boolean): ITheme => {
  let fg, bg, sel: string;
  if (dark) {
    fg = 'white';
    bg = 'rgb(26,26,26)';
    sel = 'rgba(255,255,255,0.3)';
  } else {
    fg = 'black';
    bg = 'white';
    sel = 'rgba(0,0,0,0.25)';
  }
  // TODO  indigo colors.
  //      we can't pluck these from ThemeContext because they have transparency.
  //      technically xterm supports transparency, but it degrades performance.
  return {
    foreground: fg,
    background: bg,
    brightBlack: '#7f7f7f',  // NOTE  slogs
    cursor: fg,
    cursorAccent: bg,
    selectionBackground: sel
  };
};
