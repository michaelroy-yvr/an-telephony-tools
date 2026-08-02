# an-telephony-tools

Open-source, self-hosted toolset for call-center calling, voice broadcasting, and P2P texting —
an alternative to CallHub. Starting module: P2P texting. See [ARCHITECTURE.md](./ARCHITECTURE.md)
for the full design.

## Getting started

```bash
cp infra/.env.example infra/.env
cp apps/api/.env.example apps/api/.env
docker compose -f infra/docker-compose.yml up -d
npm install
npm run db:generate
npm run db:migrate
npm run dev:api
npm run dev:web
```

API runs on `http://localhost:3001`, web on `http://localhost:3000`.
