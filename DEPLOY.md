# Catan Online — Deployment Guide

## Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Docker (Local)

```bash
# Build
docker build -t catan-online .

# Run
docker run -p 3000:3000 catan-online

# With custom port
docker run -p 8080:3000 -e PORT=3000 catan-online
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` (prod) / `localhost` (dev) | Bind address |
| `NODE_ENV` | `development` | Set to `production` for optimized builds |

## Fly.io Deployment

### Architecture

```
GitHub Actions → fly deploy → Fly.io (Docker) → catan.olincb.me
catan.olincb.me → Route 53 A record → Fly.io Proxy (SSL) → Docker :3000
```

Estimated cost: $0–2/month (free tier covers 1 shared-cpu-1x 256MB VM).

> **Important:** Game state is in-memory, so all players must connect to the same machine.
> Scale to exactly 1 machine: `fly scale count 1`

### Prerequisites

1. [Fly.io account](https://fly.io/app/sign-up) with credit card on file
2. [Fly CLI](https://fly.io/docs/flyctl/install/) installed and authenticated (`fly auth login`)

### Configuration

The `fly.toml` is already committed to the repo. Key settings:

```toml
app = 'olincb-catan'
primary_region = 'ewr'

[env]
  NODE_ENV = 'production'
  PORT = '3000'

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'off'   # Don't stop VM — kills WebSocket connections + game state
  min_machines_running = 1     # Always keep 1 VM running

[[vm]]
  memory = '512mb'
  cpus = 1
```

- `auto_stop_machines = 'off'` — Fly normally stops idle VMs, which would kill active games
- `force_https = true` — Redirects HTTP → HTTPS; Socket.IO uses `wss://` automatically

### Deploy

```bash
fly deploy
fly status        # Check VM status
fly logs          # Stream logs
fly open          # Open in browser
```

### Custom Domain (`catan.olincb.me`)

```bash
# Register with Fly.io
fly certs add catan.olincb.me
```

Add DNS records in Route 53 (hosted zone for `olincb.me`):

| Record name | Type | Value | TTL |
|-------------|------|-------|-----|
| `catan` | A | *(IP from `fly certs add` output)* | 300 |
| `catan` | AAAA | *(IPv6 from `fly certs add` output)* | 300 |

Verify:
```bash
fly certs check catan.olincb.me
curl -I https://catan.olincb.me
```

### GitHub Actions CI/CD

1. Create a deploy token:
   ```bash
   fly tokens create deploy -x 999999h
   ```

2. Add to GitHub: Repo → Settings → Secrets → `FLY_API_TOKEN`

3. The workflow is already at `.github/workflows/deploy.yml` — it runs lint + tests, then deploys on push to `main`.

### Useful Commands

```bash
fly status                    # App and VM status
fly logs                      # Stream live logs
fly ssh console               # SSH into the running VM
fly scale memory 512          # Increase RAM
fly releases                  # List deployments
fly releases rollback         # Rollback to previous release
fly restart                   # Restart the app
```

### What Fly.io Handles

- **SSL certificates** — auto-provisioned via Let's Encrypt
- **WebSocket upgrade** — native support, no Nginx needed
- **Health checks** — uses Dockerfile HEALTHCHECK; auto-restarts on failure
- **Zero-downtime deploys** — new VM starts, health check passes, traffic shifts

## Health Check

```bash
curl http://localhost:3000/
```

Returns the game lobby page. The Docker healthcheck pings this every 30s.
