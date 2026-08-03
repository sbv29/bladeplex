# BladePlex Deployment

BladePlex uses three distinct environments. Keep their ports and configuration
directories separate so testing cannot modify production data.

| Environment | Source | Runtime | Port | Configuration |
| --- | --- | --- | --- | --- |
| Development | Current working branch | `pnpm dev` | 5056 | Repository-local development config |
| Beta | Feature/testing branch | Docker (`bladeplex-beta`) | 5057 | `/opt/stacks/seerr-beta/config` |
| Production | `main` | Docker (`bladeplex`) | 5055 | `/opt/stacks/seerr/config` |

## Development

Develop changes on a feature branch using Node 22:

```bash
PORT=5056 pnpm dev
```

Open <http://192.168.2.135:5056>. Validate the change locally, commit it, and
push the feature branch before merging it into `main`.

## Beta

Beta is a Dockerized feature-branch environment with its own persistent data:

```bash
./scripts/deploy-beta.sh
```

The script rejects `main` by default. For an intentional main-branch beta
deployment, use `./scripts/deploy-beta.sh --allow-main`.

The beta container is `bladeplex-beta`, its image is `bladeplex:beta`, and it
maps host port 5057 to container port 5055. It creates
`/opt/stacks/seerr-beta/config` when missing. The image runs as UID/GID 1000,
so that directory must be writable by UID/GID 1000. If creation or the
permission check fails, create/fix it explicitly, for example:

```bash
sudo install -d -o 1000 -g 1000 /opt/stacks/seerr-beta/config
```

The intended hostname is `beta.sblade.io`. Cloudflare is not changed by the
script. When the tunnel is updated later, point beta to `localhost:5057`.
Never point beta and production at the same port long-term, and never share
their configuration directories.

## Production

Production must be deployed from a clean `main` branch:

```bash
./scripts/deploy-prod.sh
```

[`docker-compose.yml`](./docker-compose.yml) is the canonical production
Compose file. Production, beta, and production rollback scripts always select
it explicitly with `docker compose -f`; they never rely on Compose automatic
file discovery. `compose.dev.yaml` is the bind-mounted local development stack,
and `compose.postgres.yaml` is the separate local PostgreSQL development stack.
Neither development file is a production deployment path.

The script fetches `origin/main` and refuses to deploy if local `main` is
behind or has diverged. Use `./scripts/deploy-prod.sh --skip-fetch` only when
the remote is intentionally unavailable and the local remote-tracking ref is
known to be current.

Production uses:

- container `bladeplex`
- image `bladeplex:latest`
- port `127.0.0.1:5055:5055`
- configuration `/opt/stacks/seerr/config:/app/config`
- restart policy `unless-stopped`

Before replacing the container, the script tags its current image as
`bladeplex:rollback-<UTC timestamp>`. It does not overwrite or remove the
legacy `bladeplex-old` container, and it never prunes images or containers.

## Recommended workflow

```text
feature branch
  -> pnpm dev on 5056
  -> commit
  -> push feature branch
  -> merge to main after testing
  -> deploy beta on 5057 when desired
  -> deploy production on 5055
  -> verify
  -> retain rollback image
```

## Build metadata and reload prompts

`COMMIT_TAG` must be passed as a Docker **build argument**. Next.js embeds the
tag in the client build, while the Dockerfile writes the same value into
`/app/committag.json`. Supplying only a runtime environment variable can leave
the client and server with different versions, causing repeated reload
prompts.

The Compose file receives the build value from the shell:

```bash
COMMIT_TAG=<short-hash>-main docker compose -f docker-compose.yml build bladeplex
```

Verify an image before deployment:

```bash
docker inspect bladeplex:latest \
  --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^COMMIT_TAG='
docker run --rm --entrypoint cat bladeplex:latest /app/committag.json
```

Verify the running container:

```bash
docker inspect bladeplex \
  --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^COMMIT_TAG='
docker exec bladeplex cat /app/committag.json
```

## Health and logs

The Compose healthcheck accepts HTTP 2xx and 3xx responses without requiring
authentication. Check production with:

```bash
docker ps --filter name=bladeplex
docker inspect bladeplex --format '{{json .State.Health}}'
curl -I http://127.0.0.1:5055
docker logs --tail 100 bladeplex
```

Beta uses the same checks with container `bladeplex-beta` and port 5057.

## Rollback

List available rollback images:

```bash
docker image ls 'bladeplex:rollback-*'
```

Roll back to a specific image:

```bash
./scripts/rollback-prod.sh bladeplex:rollback-YYYYMMDDTHHMMSSZ
```

The rollback image is required; the script never guesses from the available
tags. Before production is touched, it resolves the supplied tag to an immutable
local image ID and verifies that the image `COMMIT_TAG` matches its parsed
`committag.json`. For non-interactive use, add `--yes`. The rollback script
preserves the image being replaced with a
`bladeplex:pre-rollback-<UTC timestamp>` tag. It replaces only the production
container and never deletes `/opt/stacks/seerr/config`.

## Cloudflare tunnel

Cloudflare changes are intentionally outside these scripts. When beta is ready
for external testing, update the `beta.sblade.io` tunnel target separately to
`http://localhost:5057`. Production remains on port 5055. Verify both local
ports before changing the tunnel, and keep beta and production targets
distinct.
