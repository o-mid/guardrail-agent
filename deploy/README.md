# Deploy

## Local

```bash
cp ../.env.example ../.env
docker compose -f docker-compose.yml up --build
```

Use `--profile full` when you need Anvil and the Solana test validator.

## Hosted (Railway + Vercel)

- Vercel serves `apps/web` (root directory `apps/web`).
- Railway runs MongoDB, `policy`, `vault`, `anvil`, and `api` from `deploy/docker/Dockerfile.*`.
- Dockerfiles and `railway.*.toml` live under `deploy/docker/`.
- Anvil entrypoint deploys Foundry mocks on boot (`deploy/anvil/entrypoint.sh`).
- API seeds the demo user when `SEED_ON_BOOT=1`.
