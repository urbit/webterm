import * as React from 'react';
import * as ReactDOM from 'react-dom';
import TermApp from './App';
import { preSig } from '@urbit/aura';
import cookies from 'browser-cookies';

function authRedirect() {
  document.location.href = `${document.location.protocol}//${document.location.host}`;
}

const session = cookies.get(`urbauth-~${window.ship}`);
if (!session) {
  fetch('/~/name')
    .then((res) => res.text())
    .then((name) => {
      if (name !== preSig(window.ship)) {
        authRedirect();
      }
    })
    .catch(() => {
      authRedirect();
    });
}

ReactDOM.render(<TermApp />, document.getElementById('root'));
