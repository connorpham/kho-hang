#!/usr/bin/env bash
# DB leg cho vteam preflight — exit 0 khi DATABASE_URL kết nối được.
# Dùng driver pg đã có trong node_modules nên không cần psql trên PATH,
# chạy giống nhau cho cả Postgres local (brew) và container.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

node --env-file-if-exists=.env -e '
const { Client } = require("pg");
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL chưa cấu hình — xem .env.example"); process.exit(1); }
const c = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
c.connect()
  .then(() => c.query("SELECT 1"))
  .then(() => { console.log("DB reachable"); return c.end(); })
  .catch((e) => { console.error("DB unreachable:", e.message); process.exit(1); });
'
