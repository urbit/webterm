# Webterm

Interactive web mirror of your Urbit's text interface. Speaks the dill protocol as proxied through `/app/herm`, which comes bundled with the base distribution.

Emulates a terminal using XTerm.js, and simply mimics vere's behavior inside of that for drawing dill blits. Slogs (printfs) get pulled in from vere's `/~_~/slog` endpoint, and rendered in similar fashion. Supports multiple sessions through simple tabs.

## Getting started

The usual suspects: in the `/ui` directory, `npm install`, then `npm run dev` to start the dev server. This pulls the ship URL to proxy to from a `/ui/.env.local` file, which should contain a `VITE_SHIP_URL='http://localhost:8080'` or similar. `npm run build` to build a bundle. Glob as normal.

## Deploying

[[ interested? your gh automation here! ]]

