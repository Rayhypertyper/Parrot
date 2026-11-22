# Parrot · Crew Radio

Run the phone and board against the same PostgreSQL database from a clean checkout. Use Node.js 24.22.1 or newer, npm, and a running local PostgreSQL server. The commands below assume a local database role matching your OS username with permission to create databases.

```sh
npm install --global @wasp.sh/wasp-cli@0.26.1
wasp install
createdb parrot_demo
printf 'DATABASE_URL=postgresql://%s@localhost:5432/parrot_demo\n' "$(id -un)" > .env.server
wasp db migrate-dev
wasp db seed seedDemo
wasp start
```

If you already have a local demo database, use its connection URL in `.env.server` and skip `createdb`. Run the seed before starting the dev server. For later sessions, run `wasp start`.

Open the [phone](http://localhost:3000/?crew=demo) or the [board](http://localhost:3000/board?crew=demo). Join with crew code `demo` and a profile code of `jo`, `alex`, `maya`, or `jules`. The server runs at `http://localhost:3001`.

Joining, creating typed requests, and viewing the feed work with the local database. Live voice and automated offers use the server-side settings described in the [crew API setup](src/server/crew/README.md) and [planner setup](services/planner/README.md).
