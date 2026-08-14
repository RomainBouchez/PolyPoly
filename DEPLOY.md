# Deploying to the Raspberry Pi 5

The Pi is arm64, and `node:22-alpine` is a multi-arch image, so the simplest
path is to build directly on the Pi rather than cross-compiling.

Repo: https://github.com/RomainBouchez/PolyPoly

## First deploy

```sh
# on the Pi, with Docker + Docker Compose installed
git clone https://github.com/RomainBouchez/PolyPoly.git polypoly
cd polypoly
docker compose up -d --build
```

The server listens inside the container on port 4000 and is published on the
host as **3018** (see `docker-compose.yml`). It serves the built web app
itself — no separate web server needed. Find the Pi's LAN IP (`hostname -I`)
and open `http://<pi-ip>:3018` from the shared PC, `http://<pi-ip>:3018/board`
for the shared board display, `http://<pi-ip>:3018/admin` for the admin
panel, and have phones join the same `http://<pi-ip>:3018`.

Game state survives container restarts via the `polypoly-data` named volume
(`/data/room.snapshot.json` inside the container).

## Updating after a code change

```sh
cd polypoly
git pull
docker compose up -d --build
```

## Useful commands

```sh
docker compose logs -f      # tail server logs
docker compose down         # stop
docker compose down -v      # stop and wipe the saved game (fresh start)
```
