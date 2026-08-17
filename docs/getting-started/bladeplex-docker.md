# Installing BladePlex with Docker

The published image at `ghcr.io/sbv29/bladeplex` is the recommended installation method. Images are built after tests pass on `main` and are published as both `latest` and the full Git commit SHA.

## Windows with Docker Desktop

Create a new folder, save the following as `compose.yaml`, and run the commands from that folder:

```yaml
services:
  bladeplex:
    image: ghcr.io/sbv29/bladeplex:latest
    container_name: bladeplex
    ports:
      - '127.0.0.1:5059:5055'
    volumes:
      - bladeplex-config:/app/config
    restart: unless-stopped

volumes:
  bladeplex-config:
```

```powershell
docker compose up --detach
```

Open <http://localhost:5059>. The named volume keeps SQLite and application settings inside Docker's Linux VM, where file locking works correctly.

To update:

```powershell
docker compose pull
docker compose up --detach
```

## Linux

The repository's `docker-compose.yml` binds the service to `127.0.0.1:5055` and stores configuration at `/opt/stacks/seerr/config`. Create the directory with ownership appropriate for container UID/GID 1000, then start it:

```bash
sudo install -d -o 1000 -g 1000 /opt/stacks/seerr/config
docker compose up --detach
```

For a different location or port, create `.env` beside `docker-compose.yml`:

```dotenv
BLADEPLEX_HOST_PORT=5059
BLADEPLEX_CONFIG_PATH=/path/to/bladeplex-config
```

To update an installation following `latest`:

```bash
docker compose pull
docker compose up --detach
```

Compose replaces the container while preserving the mounted configuration directory.

## Pinning and rollback

`latest` is convenient for personal installations. Production installations should set an exact image in `.env`:

```dotenv
BLADEPLEX_IMAGE=ghcr.io/sbv29/bladeplex:<full-commit-sha>
```

Deploy it with:

```bash
docker compose pull bladeplex
docker compose up --detach --no-build --force-recreate bladeplex
```

To roll back, restore the previous commit SHA and repeat those commands.

On the BladePlex production host, `scripts/deploy-prod.sh` performs the pull, metadata validation, health validation, and automatic rollback safeguards:

```bash
# Deploy the image published for origin/main
./scripts/deploy-prod.sh

# Or deploy a specific full SHA that belongs to origin/main
./scripts/deploy-prod.sh <full-commit-sha>
```

Pushing `main` publishes images but does not deploy production automatically.

## Local-build fallback

To build from a source checkout instead of pulling GHCR:

```bash
docker compose -f docker-compose.yml -f compose.build.yaml up --detach --build
```

The guarded production equivalent is:

```bash
./scripts/deploy-prod.sh --local-build
```

Both modes use the same configuration mount and health check.
