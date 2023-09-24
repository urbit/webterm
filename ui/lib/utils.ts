import { Poke, Scry } from '@urbit/http-api';
import { Belt, Task, SessionTask } from './types';
import { Terminal } from 'xterm';

export const pokeTask = (session: string, task: Task): Poke<SessionTask> => ({
  app: 'herm',
  mark: 'herm-task',
  json: { session, ...task }
});

export const pokeBelt = (
  session: string,
  belt: Belt
): Poke<SessionTask> => pokeTask(session, { belt });

//NOTE  scry will return string[]
export const scrySessions = (): Scry => ({
  app: 'herm',
  path: `/sessions`
});

export const getCursorPosition = (term: Terminal): { x: number, y: number } => {
  // ts complains about term._core not existing
  // but it does :)
  // @ts-ignore
  return { x: term._core.buffer.x, y: term._core.buffer.y };
}

// prints a value to the terminal (frontend only)
export const writeToTerminal = (term: Terminal, val: string) => {
  const moveToBottom =
    `\x1b[${term.rows};${getCursorPosition(term).x + 1}H` + `\x1b[s`;
  term.write(moveToBottom, () => {
    term.write(val);
  });
}