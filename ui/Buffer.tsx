import { Terminal, ITerminalOptions } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { debounce } from 'lodash';
import bel from './lib/bel';
import api from './api';
import {
  pokeTask, pokeBelt, getCursorPosition, writeToTerminal
} from './lib/utils'
import { Session } from './state';
import { useCallback, useEffect, useRef } from 'react';
import useTermState from './state';
import React from 'react';
import { Box, Col } from '@tlon/indigo-react';
import { makeTheme } from './lib/theme';
import { showBlit, csi, hasBell } from './lib/blit';
import { DEFAULT_SESSION, RESIZE_DEBOUNCE_MS, RESIZE_THRESHOLD_PX } from './constants';
import { retry } from './lib/retry';
import { Belt } from 'lib/types';

const termConfig: ITerminalOptions = {
  logLevel: 'warn',
  //
  convertEol: true,
  //
  rows: 24,
  cols: 80,
  scrollback: 10000,
  //
  fontFamily: '"Source Code Pro", "Roboto mono", "Courier New", monospace',
  fontWeight: 400,
  // NOTE  theme colors configured dynamically
  //
  bellStyle: 'sound',
  bellSound: bel,
  //
  //  allows text selection by holding modifier (option, or shift)
  macOptionClickForcesSelection: true,
  //  prevent insertion of simulated arrow keys on-altclick
  altClickMovesCursor: false
};

const onResize = async (name: string, session: Session) => {
  if (session) {
    session.fit.fit()
    useTermState.getState().set((state) => {
      state.sessions[name].pending++;
    });
    api.poke(pokeTask(name, { blew: { w: session.term.cols, h: session.term.rows } })).then(() => {
      useTermState.getState().set((state) => {
        state.sessions[name].pending--;
      });
    });
  }
};

interface BufferProps {
  name: string,
  selected: boolean,
  dark: boolean,
}

type EnqueuedBelts = {
  txt: string[],
  hit: { x: number, y: number } | null,
};

export default function Buffer({ name, selected, dark }: BufferProps) {

  let cursorPosition: { x: number, y: number } = { x: 0, y: 0 };
  let debounceTimer: NodeJS.Timeout | null = null;
  let debounceQueue: Belt[] = [];
  let enqueuedBelts: EnqueuedBelts = { txt: [], hit: null };
  let sentCache: string[] = [];
  let terminalContent: string = '';
  let updateQueue: string[] = [];
  let processing = false;

  // handles answer from the backend
  const handleTerminalUpdate = (term: Terminal, val: string) => {

    updateQueue.push(val);

    if (!processing) {
      processing = true;
      processUpdateQueue(term);
    }
  }

  const processUpdateQueue = (term: Terminal) => {

    if (updateQueue.length === 0) {
      processing = false;
      return;
    }

    const val = updateQueue.shift()!;

    if (val == '\x07') {  // bel
      term.write(val);
      sentCache = [];
      processUpdateQueue(term);
      return;
    }

    if (sentCache.length > 0) {
      //  xpos means its an update to the position
      //  check only the x position here
      //  cause the y is screwed by the slogging
      let xpos = val.match(/\x1B\[\d+;(\d+)H\x1b\[s/);
      const cached = xpos ?
        sentCache[0].match(/\x1B\[\d+;(\d+)H\x1b\[s/)
        : sentCache[0];

      //  if the val is cached (already on the screen)
      //  do nothing
      if (xpos ? (cached && (cached[1] === xpos[1])) : (cached === val)) {
        sentCache.shift();
        processUpdateQueue(term);
        return;
      }
    }
    //  if its an update to the text
    //  e.g. ~sampel-palnet:dojo>  text
    const updateToText = val.match(/\x1B\[0m(.*?)(?=\x1B\[0m|$)/u);

    // wipe the line and write
    if (updateToText
      || val[0] === '>'
      || terminalContent === '') {

      const write = () => {
        const moveToBottom = csi('H', term.rows, 1) + csi('s');
        const wipeLine = csi('H') + csi('u');

        term.write(moveToBottom, () => {
          term.write(wipeLine, () => {
            term.write(val, () => {
              if (updateToText) {
                terminalContent = val;
              }
              sentCache = [];
              cursorPosition = getCursorPosition(term);
              processUpdateQueue(term);
              return;
            })
          });
        });
      };

      // some tricks to prevent the text
      // from appearing in the middle 
      // of the screen on the first update 
      setTimeout(() => {
        if (terminalContent === '') {
          const fit = new FitAddon();
          term.loadAddon(fit);
          fit.fit();
        }
        write();
      }, 0);
    }
    else {  // just write without wipping the line
      term.write(val, () => {
        if (updateToText) {
          terminalContent = val;
        }
        cursorPosition = getCursorPosition(term);
        sentCache = [];
        processUpdateQueue(term);
        return;
      });
    }
  }

  // updates the sentCache with the Belt b
  const cacheBelt = (b: Belt) => {
    if (typeof b === 'string') {
      sentCache.push(csi('H', cursorPosition.y, 1) + csi('s'));
      sentCache.push('\r' + csi('K') + csi('u'));
      const newTermContent = terminalContent.slice(0, cursorPosition.x + 4)
        + b
        + terminalContent.slice(cursorPosition.x + 4);
      sentCache.push(newTermContent);
      sentCache.push(csi('H', cursorPosition.y, cursorPosition.x + 2)
        + csi('s'));
      terminalContent = newTermContent;
      cursorPosition.x += 1;
      cursorPosition.y += 1;
    }
    else if ('txt' in b) {
      const val = b.txt.join('');
      sentCache.push(csi('H', cursorPosition.y, 1) + csi('s'));
      sentCache.push('\r' + csi('K') + csi('u'));
      const newTermContent =
        terminalContent.slice(0, cursorPosition.x + 4)
        + val
        + terminalContent.slice(cursorPosition.x + 4);
      sentCache.push(newTermContent);
      sentCache.push(
        csi('H', cursorPosition.y, cursorPosition.x + val.length + 1)
        + csi('s'));
      terminalContent = newTermContent;
      cursorPosition.x += val.length;
      cursorPosition.y += 1;
    }
    else if ('bac' in b) {
      const emptyTerm = terminalContent.split(' ')[0] + ' ';
      const isEmpty = cursorPosition.x === emptyTerm.length;
      const isMultilining = emptyTerm[emptyTerm.length - 2] === '<';
      if (cursorPosition.x > emptyTerm.length || (isMultilining && isEmpty)) {
        if (!isEmpty) {
          cursorPosition.x--;
        }
        cursorPosition.y++;
        sentCache.push(csi('H', cursorPosition.y, 1) + csi('s'));
        sentCache.push('\r' + csi('K') + csi('u'));
        const newTermContent = (isMultilining && isEmpty) ?
          emptyTerm.slice(0, -2) + '> ' +
          csi('m', 0) + csi('m', 0) + csi('u') :
          terminalContent.slice(0, cursorPosition.x + 4)
          + terminalContent.slice(cursorPosition.x + 5)
        sentCache.push(newTermContent);
        sentCache.push(csi('H', cursorPosition.y, cursorPosition.x + 1) +
          csi('s'));
        terminalContent = newTermContent;
      }
    }
    else if ('aro' in b) {
      if (b.aro === 'u' || b.aro === 'd') {
        const emptyTerm = terminalContent.split(' ')[0] + ' ';
        const newTermContent = emptyTerm + csi('m') + csi('m') + + csi('u');
        terminalContent = newTermContent;
        cursorPosition.x = emptyTerm.length + 1;
        cursorPosition.y += 1;
      }
    }
    else if ('hit' in b) {
      sentCache.push(csi('H', b.hit.y, b.hit.x + 1) + csi('s'));
      cursorPosition.x = b.hit.x;
      cursorPosition.y = b.hit.y;
    }

    return b;
  }

  const blockInputs = 'block';

  const readInput = (term: Terminal, e: string): Belt[] => {
    const isMultiline = e.includes(String.fromCharCode(13));
    const belts: Belt[] = [];
    let strap = '';

    // block subsequents inputs if there is an up/down/ret pending
    // only allow more up/down presses
    if (
      sentCache.length > 0
      && sentCache[sentCache.length - 1] === blockInputs
      && (e !== csi('B') && e !== csi('A'))
    ) {
      return belts;
    }

    while (e.length > 0) {
      let c = e.charCodeAt(0);

      //  text input
      //
      if (c >= 32 && c !== 127) {
        const char = String.fromCharCode(c);
        // don't write if pasting multiline text
        !isMultiline &&
          writeToTerminal(term, csi('h', 4) + char + csi('l', 4));
        strap += e[0];
        e = e.slice(1);  //TODO  revisit wrt (list @c) & unicode characters
        continue;
      } else if ('' !== strap) {
        belts.push({ txt: strap.split('') });
        strap = '';
      }

      //  special keys/characters
      //
      if (0 === c) {
        writeToTerminal(term, '\x07');  //  bel
      } else if (8 === c || 127 === c) {
        const xpos = getCursorPosition(term).x;
        const emptyTerm = terminalContent.split(' ')[0] + " ";
        if (xpos > emptyTerm.length) {
          writeToTerminal(term, csi('D') + csi('P', 1));
        }
        //  if the term looks like ~zod:dojo<
        //  and we press bac
        //  then change it to ~zod:dojo>
        else if (xpos === emptyTerm.length
          && emptyTerm[emptyTerm.length - 2] === "<") {
          writeToTerminal(term,
            csi('D') + csi('P', 1) + csi('D') + csi('P', 1) + '> ');
        }
        belts.push({ bac: null });
      } else if (13 === c) {
        belts.push({ ret: null });
        sentCache.push(blockInputs);
      } else if (c <= 26) {
        const k = String.fromCharCode(96 + c);
        //NOTE  prevent remote shut-downs
        if ('d' !== k) {
          belts.push({ mod: { mod: 'ctl', key: k } });
        }
      }

      //  escape sequences
      //
      if (27 === c) {  //  ESC
        e = e.slice(1);
        c = e.charCodeAt(0);
        if (91 === c || 79 === c) {  //  [ or O
          e = e.slice(1);
          c = e.charCodeAt(0);
          /* eslint-disable max-statements-per-line */
          switch (c) {
            case 65: {
              belts.push({ aro: 'u' });
              sentCache.push(blockInputs);
              break;
            }
            case 66: {
              belts.push({ aro: 'd' });
              sentCache.push(blockInputs);
              break;
            }
            case 67: {
              const pos = getCursorPosition(term);
              if (pos.x < terminalContent.length - 11) {
                belts.push({
                  hit: {
                    x: pos.x + 1,
                    y: pos.y
                  }
                });
                writeToTerminal(term, csi('C'));
              }
              break;
            }
            case 68: {
              const pos = getCursorPosition(term);
              if (pos.x >
                (terminalContent.split(' ')[0]).length + 1) {
                belts.push({
                  hit: {
                    x: pos.x - 1,
                    y: pos.y
                  }
                });
                writeToTerminal(term, csi('D'));
              }
              break;
            }
            //
            case 77: {
              const m = e.charCodeAt(1) - 31;
              if (1 === m) {
                let c = e.charCodeAt(2) - 32;
                const minC = terminalContent.split(' ')[0].length + 2;
                const maxC = terminalContent.length - 10;
                if (c < minC) {
                  c = minC;
                }
                else if (c > maxC) {
                  c = maxC;
                }
                if (c - 1 !== getCursorPosition(term).x) {
                  writeToTerminal(term, csi('H', term.rows, c));
                  belts.push({ hit: { y: term.rows, x: c - 1 } });
                }
              }
              e = e.slice(3);
              break;
            }
            //
            default: {
              writeToTerminal(term, '\x07'); break;  //  bel
            }
          }
        } else if (c >= 97 && c <= 122) {  //  a <= c <= z
          belts.push({ mod: { mod: 'met', key: e[0] } });
        } else if (c === 46) {  //  .
          belts.push({ mod: { mod: 'met', key: '.' } });
        } else if (c === 8 || c === 127) {
          belts.push({ mod: { mod: 'met', key: { bac: null } } });
        } else {
          writeToTerminal(term, '\x07'); break;  //  bel
        }
      }

      e = e.slice(1);
    }
    if ('' !== strap) {
      if (1 === strap.length) {
        belts.push(strap);
      } else {
        belts.push({ txt: strap.split('') });
      }
      strap = '';
    }
    return belts;
  };

  const addEnqueuedHitToDebounce = () => {
    if (enqueuedBelts.hit) {
      debounceQueue.push(cacheBelt({ hit: enqueuedBelts.hit }));
      enqueuedBelts.hit = null;
    }
  }

  const addEnqueuedTxtToDebounce = () => {
    if (enqueuedBelts.txt.length > 0) {
      debounceQueue.push(cacheBelt({ txt: enqueuedBelts.txt }));
      enqueuedBelts.txt = [];
    }
  }

  // enqueue belts to be sent to the backend
  const enqueueBelts = (belts: Belt[]) => {

    for (const b of belts) {

      const isString = typeof b === 'string';

      // enqueue consecutive belts to send then all at once
      if (isString) {
        addEnqueuedHitToDebounce();
        enqueuedBelts.txt.push(b);
      }
      else if ('hit' in b) {
        addEnqueuedTxtToDebounce();
        enqueuedBelts.hit = { x: b.hit.x, y: b.hit.y };
      }
      else {
        addEnqueuedTxtToDebounce();
        addEnqueuedHitToDebounce();
        debounceQueue.push(cacheBelt(b));
      }

      //  if timer is up
      //  and b is a debounceable key
      //  reset timer
      if (debounceTimer && (isString || 'hit' in b)) {
        clearTimeout(debounceTimer);
      }
      else {
        addEnqueuedTxtToDebounce();
        addEnqueuedHitToDebounce();
        processDebounceQueue();
      }

      debounceTimer = setTimeout(() => {
        addEnqueuedTxtToDebounce();
        addEnqueuedHitToDebounce();
        processDebounceQueue();
        debounceTimer = null;
      }, 300);
    }
  };

  // sends everything from debounceQueue to the backend
  const processDebounceQueue = () => {
    if (debounceQueue.length === 0) {
      return;
    }

    const batch = debounceQueue.slice();
    debounceQueue = [];

    batch.forEach((b) => {
      useTermState.getState().set((state) => {
        state.sessions[name].pending++;
      });
      api.poke(pokeBelt(name, b)).then(() => {
        useTermState.getState().set((state) => {
          state.sessions[name].pending--;
        });
      });
    })

  };

  const containerRef = useRef<HTMLDivElement | null>(null);

  const session: Session = useTermState(s => s.sessions[name]);

  const onInput = (name: string, session: Session, e: string) => {
    if (!session) {
      return;
    }

    const term = session.term;

    const belts = readInput(term, e);

    enqueueBelts(belts);
  };

  const initSession = useCallback(async (name: string, dark: boolean) => {
    console.log('setting up', name === DEFAULT_SESSION ? 'default' : name);

    //  set up xterm terminal
    //
    const term = new Terminal(termConfig);
    term.options.theme = makeTheme(dark);
    const fit = new FitAddon();
    term.loadAddon(fit);
    fit.fit();
    term.focus();

    //  start mouse reporting
    //
    term.write(csi('?9h'));

    const ses: Session = {
      term,
      fit,
      hasBell: false,
      pending: 0,
      subscriptionId: null
    };

    //  set up event handlers
    //
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      //NOTE  ctrl+shift keypresses never make it into term.onData somehow,
      //      so we handle them specially ourselves.
      //      we may be able to remove this once xterm.js fixes #3382 & co.
      if (e.shiftKey
        && e.ctrlKey
        && e.type === 'keydown'
        && e.key.length === 1
      ) {
        api.poke(pokeBelt(name, { mod: { mod: 'ctl', key: e.key } }));
        return false;
      }
      return true;
    });
    term.onData(e => onInput(name, ses, e));
    term.onBinary(e => onInput(name, ses, e));

    //  open subscription
    //
    const initSubscription = async () => {
      const subscriptionId = await api.subscribe({
        app: 'herm', path: '/session/' + name + '/view',
        event: (e) => {
          showBlit(ses.term, e, handleTerminalUpdate);
          //NOTE  getting selected from state because selected prop is stale
          if (hasBell(e) && (useTermState.getState().selected !== name)) {
            useTermState.getState().set((state) => {
              state.sessions[name].hasBell = true;
            });
          }
          //TODO  should handle %bye on this higher level though, for deletion
        },
        err: (e, id) => {
          console.log(`subscription error, id ${id}:`, e);
        },
        quit: async () => {  //  quit
          console.error('quit, reconnecting...');
          try {
            const newSubscriptionId = await retry(initSubscription, () => {
              console.log('attempting to reconnect ...');
            }, 5);
            useTermState.getState().set((state) => {
              state.sessions[name].subscriptionId = newSubscriptionId;
            });
          } catch (error) {
            console.log('unable to reconnect', error);
          }
        }
      });

      return subscriptionId;
    };

    ses.subscriptionId = await initSubscription();

    useTermState.getState().set((state) => {
      state.sessions[name] = ses;
    });
  }, []);

  const shouldResize = useCallback(() => {
    if (!session) {
      return false;
    }

    const containerHeight = document.querySelector('.buffer-container')?.clientHeight || Infinity;
    const terminalHeight = session.term.element?.clientHeight || 0;

    return (containerHeight - terminalHeight) >= RESIZE_THRESHOLD_PX;
  }, [session]);

  const onSelect = useCallback(async () => {
    if (session && selected && shouldResize()) {
      session.fit.fit();
      await api.poke(pokeTask(name, { blew: { w: session.term.cols, h: session.term.rows } }));
      session.term.focus();
    }
  }, [session?.term, selected]);

  // Effects
  // init session
  useEffect(() => {
    if (session) {
      return;
    }

    initSession(name, dark);
  }, [name]);

  // attach to DOM when ref is available
  useEffect(() => {
    if (session && containerRef.current && !session.term.element) {
      session.term.open(containerRef.current);
    }
  }, [session, containerRef]);

  //  initialize resize listeners
  //
  useEffect(() => {
    if (!session) {
      return;
    }

    // TODO: use ResizeObserver for improved performance?
    const debouncedResize = debounce(() => onResize(name, session), RESIZE_DEBOUNCE_MS);
    window.addEventListener('resize', debouncedResize);

    return () => {
      window.removeEventListener('resize', debouncedResize);
    };
  }, [session]);

  //  on dark mode change, change terminals' theme
  //
  useEffect(() => {
    const theme = makeTheme(dark);
    if (session) {
      session.term.options.theme = theme;
    }
    if (containerRef.current) {
      containerRef.current.style.backgroundColor = theme.background || '';
    }
  }, [session, dark]);

  // On select, resize, focus, and poke herm with updated cols and rows
  useEffect(() => {
    onSelect();
  }, [onSelect]);

  return (
    !session && !selected ?
      <p>Loading...</p>
      :
      <Box
        width='100%'
        height='100%'
        bg='white'
        fontFamily='mono'
        overflow='hidden'
        className="terminal-container"
        style={selected ? { zIndex: 999 } : {}}
      >
        <Col
          width='100%'
          height='100%'
          minHeight='0'
          px={['0', '2']}
          pb={['0', '2']}
          ref={containerRef}
        >
        </Col>
      </Box>
  );
}
