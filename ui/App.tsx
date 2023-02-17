import React, {
  useCallback, useEffect
} from 'react';

import useTermState from './state';
import { useDark } from './lib/useDark';
import api from './api';

import { _dark, _light } from '@tlon/indigo-react';

import 'xterm/css/xterm.css';

import {
  scrySessions
} from '@urbit/api';

import { ThemeProvider } from 'styled-components';
import { Tabs } from './Tabs';
import Buffer from './Buffer';
import { DEFAULT_SESSION } from './constants';
import { showSlog } from './lib/blit';
import { InfoButton } from './InfoButton';

const initSessions = async () => {
  const response = await api.scry(scrySessions());

  useTermState.getState().set((state) => {
    state.names = response.sort();
  });
};

export default function TermApp() {
  const { names, selected } = useTermState();
  const dark = useDark();

  const setupSlog = useCallback(() => {
    console.log('slog: setting up...');
    let available = false;
    const slog = new EventSource('/~_~/slog', { withCredentials: true });

    slog.onopen = () => {
      console.log('slog: opened stream');
      available = true;
    };

    slog.onmessage = (e) => {
      const session = useTermState.getState().sessions[DEFAULT_SESSION];
      if (!session) {
        console.log('slog: default session mia!', 'msg:', e.data);
        console.log(Object.keys(useTermState.getState().sessions), session);
        return;
      }
      showSlog(session.term, e.data);
    };

    slog.onerror = (e) => {
      console.error('slog: eventsource error:', e);
      if (available) {
        window.setTimeout(() => {
          if (slog.readyState !== EventSource.CLOSED) {
            return;
          }
          console.log('slog: reconnecting...');
          setupSlog();
        }, 10000);
      }
    };

    useTermState.getState().set((state) => {
      state.slogstream = slog;
    });
  }, []);

  useEffect(() => {
    initSessions();
    setupSlog();
  }, []);

  return (
    <>
      <ThemeProvider theme={dark ? _dark : _light}>
        <div className="header">
          <Tabs />
          <InfoButton />
        </div>
        <div className="buffer-container">
          {names.map((name) => {
            return <Buffer key={name} name={name} selected={name === selected} dark={dark} />;
          })}
        </div>
      </ThemeProvider>
    </>
  );
}
