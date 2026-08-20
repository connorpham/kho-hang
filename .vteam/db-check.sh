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
  // In DANH TÍNH server, không chỉ "kết nối được". Hai PostgreSQL cùng đòi cổng
  // 5432 (container và Homebrew) đã từng làm cả migration lẫn test chạy nhầm
  // server suốt một phiên: bind loopback cụ thể thắng bind wildcard, và
  // "SELECT 1" thì xanh với bất kỳ server nào. Xem KI-003.
  .then(() => c.query("SELECT version() v, current_database() d, current_setting($1) mc", ["max_connections"]))
  .then((r) => {
    const { v, d, mc } = r.rows[0];
    console.log(`DB reachable: ${v.split(" on ")[0]} · db=${d} · max_connections=${mc}`);
    return c.end();
  })
  .catch((e) => { console.error("DB unreachable:", e.message); process.exit(1); });
'
