# Amplify Gen 2 + RDS (Aurora PostgreSQL) Next.js Template

[日本語](./README.ja.md)

A minimal starter for full-stack apps on AWS that need a **relational database**:

- **Frontend**: Next.js 16 (App Router) + React 19, hosted on AWS Amplify Hosting
- **Auth**: Amazon Cognito via Amplify Gen 2, with the Amplify UI `<Authenticator>`
- **API + DB**: [AWS Blocks](https://github.com/aws-devtools-labs/aws-blocks): a typed RPC API on Lambda + API Gateway, backed by **Aurora Serverless v2 (PostgreSQL)**, with plain SQL migrations and the [Kysely](https://kysely.dev) query builder

The sample app is a per-user Todo list: each signed-in user only sees their own rows.

```
Browser ──(Cognito ID token)──▶ API Gateway ─▶ Lambda (aws-blocks/index.ts) ─▶ Aurora PostgreSQL
   │                                              └─ verifies the token against the Cognito User Pool
   └──▶ Cognito (Amplify Auth)
```

## Getting started

Prerequisites: Node.js 22 or 24 (`.nvmrc` pins 22; Node.js 25 is not supported because the Amplify CLI crashes on it), [pnpm](https://pnpm.io/installation) (version pinned in `package.json` `packageManager`), an AWS account, and local AWS credentials ([Amplify setup guide](https://docs.amplify.aws/nextjs/start/account-setup/)).

1. Create your repository with **Use this template** on GitHub, then clone it. Before the first deploy, see [Naming before your first deploy](#naming-before-your-first-deploy).
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Deploy your personal cloud sandbox (Cognito, Lambda, API Gateway, Aurora). This writes `amplify_outputs.json`:
   ```bash
   pnpm sandbox
   ```
   The first deploy takes a while because it creates an Aurora cluster.
4. In another terminal, start the frontend and open http://localhost:3000:
   ```bash
   pnpm dev
   ```

> Always use `pnpm sandbox` / `pnpm sandbox:delete` rather than running `ampx` directly. The scripts set:
> - `NODE_OPTIONS=--conditions=cdk`, which AWS Blocks needs during synthesis.
> - `AMPLIFY_SANDBOX=true`, which marks the deployment as a sandbox. Without it, the database is deployed with production settings (retained and deletion-protected), so `sandbox:delete` can't remove it.

### Optional: run the API locally

`pnpm blocks:dev` runs `aws-blocks/index.ts` on http://localhost:3001 with a local PGlite database (stored in `.bb-data/`), so backend edits don't need a redeploy. Sign-in still uses your sandbox's Cognito User Pool, so run `pnpm sandbox` once first: the frontend and the local server both read `amplify_outputs.json`.

```bash
cp .env.example .env.local   # points the frontend at http://localhost:3001
pnpm blocks:dev
pnpm dev
```

## Deploying to Amplify Hosting

1. In the Amplify console, choose **Create new app** and connect your repository.
2. Amplify picks up [`amplify.yml`](./amplify.yml). The build installs Node.js 22 and pnpm, then runs `pnpm db:types --verify` and `pnpm typecheck:backend`. If those pass, it deploys the backend with `ampx pipeline-deploy` and then builds Next.js.

> **Next.js version**: the Amplify Hosting docs list official SSR support for Next.js 12 through 15 ([source](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html)). This template uses Next.js 16. If a Hosting build or SSR misbehaves, try Next.js 15.

CORS is open to every branch of the app (`https://<branch>.<appId>.amplifyapp.com`). If you use a custom domain, add an Amplify environment variable `BLOCKS_ALLOWED_ORIGINS` with comma-separated regular expressions, for example `^https://app\.example\.com$`. The patterns themselves must not contain commas (such as `{1,3}`).

## Project structure

```
amplify/
  backend.ts            Amplify backend: auth + Blocks
  auth/resource.ts      Cognito configuration
  blocks.ts             Wires AWS Blocks into Amplify (CORS, Cognito config, outputs)
aws-blocks/
  index.ts              The API (ApiNamespace) and Kysely queries
  db.generated.ts       Kysely table types, generated from the migrations (`pnpm db:types`)
  timestamp.ts          Timestamp type and ISO conversion
  auth.ts               Cognito ID-token verification
  validate.ts           Runtime validation of API arguments
  migrations/*.sql      Database schema, applied in order
  amplify-client.js     Frontend client: `import { api } from 'aws-blocks'`
  index.cdk.ts          CDK entry point (called from amplify/blocks.ts)
  index.handler.ts      Lambda entry point
  scripts/              Local dev server, DB type generator
app/                    Next.js App Router pages
```

## Naming before your first deploy

- Rename `name` in `package.json` and the page title in `app/layout.tsx`.
- Decide the database identifiers in `aws-blocks/index.ts` (`new Scope('app')`, the `'db'` id and `databaseName`). They name the AWS resources: changing them after a deploy creates a new, empty Aurora cluster. Branch deployments keep the old cluster, which keeps billing.

## Customizing

- **Change the schema**:
  1. Add a new numbered file such as `aws-blocks/migrations/002_add_due_date.sql`. Don't edit migrations that have already been applied.
  2. Run `pnpm db:types` to regenerate `aws-blocks/db.generated.ts`, and commit both files. Never edit the generated file by hand.

  `pnpm db:types --verify` fails if the generated types don't match the migrations. CI and the Amplify Hosting backend build run it (along with `pnpm typecheck:backend`) before anything is deployed.
- **Write queries**: use the type-safe `db` (Kysely) in `aws-blocks/index.ts`. For raw SQL, use Kysely's `sql` template tag. Timestamps come back as `Date` locally but as strings on AWS (RDS Data API), so normalize them with `toIsoString()` before returning. Affected-row counts (`numDeletedRows` and so on) are not reported; use `.returning(...)` to check whether a row was hit.
  Two things work locally but fail on AWS (RDS Data API):
  - **Typed parameters**: parameters are sent as text, so cast values compared with or written to `timestamp`, `date`, `uuid`, `json`/`jsonb` or `numeric` columns, e.g. ``sql<Date>`${value}::timestamptz` ``. See `aws-blocks/timestamp.ts`.
  - **Response size**: a response is capped at 1 MiB, so always bound list queries with `.limit(...)` and paginate.
- **Add an API method**: add a method to the `api` namespace in `aws-blocks/index.ts`. The frontend gets it fully typed through `import { api } from 'aws-blocks'`. In each method:
  - Call `requireUser(context)` when the method needs a signed-in user.
  - Start queries on user-owned tables from an owner-scoped helper like `todosOf(user)`, so the owner filter can't be forgotten. Blocks' Postgres RLS (`withRLS`) can't be combined with the Kysely adapter, so ownership is enforced in the app.
  - Validate every argument with `aws-blocks/validate.ts`. TypeScript types are not checked at runtime, and clients can send any JSON.
- **Add another namespace**: export a new `ApiNamespace` from `aws-blocks/index.ts`, and a matching client from `aws-blocks/amplify-client.js`.
- **Use more building blocks** (KV store, file bucket, cron jobs, …): see `node_modules/@aws-blocks/blocks/README.md`.
- **Add Amplify Data / Storage**: define them under `amplify/` as usual and add them to `defineBackend` in `amplify/backend.ts`.

## Costs and cleanup

- Aurora Serverless v2 runs with `minCapacity: 0`, so it auto-pauses after about 5 minutes idle and costs nothing for compute while paused. In exchange:
  - **First request after a pause**: it fails with `ConnectionFailedException` ("The database connection failed") while the cluster resumes. Resuming can take from several seconds to a few minutes; retrying after that succeeds. The sample app retries automatically (every 10 seconds for up to 3 minutes; see `app/retry-while-db-resumes.ts`) and shows a "waking up" status meanwhile.
  - **Deploys with migrations**: a deploy can fail on the first try when it runs migrations against a paused cluster, even though Blocks retries for about 2 minutes. Re-run the build (or `pnpm sandbox`) and it succeeds.
  - **Production**: raise `minCapacity` in `aws-blocks/index.ts` (for example to `0.5`) to keep the database always on. This is billed per ACU-hour.
- `pnpm sandbox:delete` deletes the sandbox, including its database.
- Branch deployments **retain** the Aurora cluster and enable deletion protection, so data survives stack updates. Deleting the Amplify app does not delete the cluster. To remove it, turn off deletion protection and delete it in the RDS console.

## Telemetry

The tools this template uses send anonymous usage data by default:
- **AWS Blocks** (dev server, synthesis): disable with `AWS_BLOCKS_DISABLE_TELEMETRY=1` or `npx blocks-telemetry --disable`.
- **Amplify CLI** (`ampx`): disable with `pnpm exec ampx configure telemetry disable`.

## License

[MIT-0](./LICENSE). Use it however you like; attribution is not required.

Inspired by [aws-samples/amplify-next-template](https://github.com/aws-samples/amplify-next-template) (MIT-0) and the AWS Blocks Amplify integration. Dependencies are distributed under their own licenses (mostly Apache-2.0 and MIT).
