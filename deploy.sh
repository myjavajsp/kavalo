#!/usr/bin/env bash
# One-shot deploy: build → start containers → wait for DB → seed.
# Run: ./deploy.sh   (requires Docker + a populated .env file)
set -e

cd "$(dirname "$0")"

# Load .env so this script can read DB_PASSWORD / PORT for the health wait.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

PORT="${PORT:-4321}"

echo "==> [1/4] Building the app…"
npm run build

echo "==> [2/4] Starting containers (db + app)…"
docker compose up -d

echo "==> [3/4] Waiting for MySQL to become healthy…"
READY=0
for i in $(seq 1 60); do
  if docker compose exec -T db mysqladmin ping -h localhost -p"${DB_PASSWORD}" --silent >/dev/null 2>&1; then
    READY=1
    echo "    ✔ database is ready."
    break
  fi
  printf "    …waiting for db (%s/60)\r" "$i"
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  echo "    ✖ database did not become healthy in time. Check 'docker compose logs db'."
  exit 1
fi

echo "==> [4/4] Seeding the database from Markdown…"
npm run seed

echo ""
echo "✔ Deploy complete. Open http://localhost:${PORT}"
