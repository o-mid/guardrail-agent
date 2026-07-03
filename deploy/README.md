# Deploy

```bash
cp ../.env.example ../.env
docker compose -f docker-compose.yml up --build
```

Use `--profile full` when you need Anvil and the Solana test validator.
