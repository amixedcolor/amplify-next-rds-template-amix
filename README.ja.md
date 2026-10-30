# Amplify Gen 2 + RDS (Aurora PostgreSQL) Next.js テンプレート

[English](./README.md)

**リレーショナルデータベース**を使うフルスタックアプリを AWS 上で作るための、最小構成のスターターです。

- **フロントエンド**: Next.js (App Router) + React。AWS Amplify Hosting でホスティング
- **認証**: Amplify Gen 2 による Amazon Cognito と、Amplify UI の `<Authenticator>`
- **API + DB**: [AWS Blocks](https://github.com/aws-devtools-labs/aws-blocks)。Lambda + API Gateway 上の型付き RPC API で、DB は **Aurora Serverless v2 (PostgreSQL)**。スキーマは素の SQL マイグレーションで管理します

サンプルはユーザーごとの Todo リストです。サインインしたユーザーには自分の行だけが見えます。

```
ブラウザ ──(Cognito ID トークン)──▶ API Gateway ─▶ Lambda (aws-blocks/index.ts) ─▶ Aurora PostgreSQL
   │                                                 └─ Cognito User Pool でトークンを検証
   └──▶ Cognito (Amplify Auth)
```

## はじめかた

前提: Node.js 22 以上、[pnpm](https://pnpm.io/ja/installation)（バージョンは `package.json` の `packageManager` で固定）、AWS アカウント、ローカルの AWS 認証情報（[Amplify のセットアップ手順](https://docs.amplify.aws/nextjs/start/account-setup/)）。

1. GitHub の **Use this template** でリポジトリを作成し、clone します。
2. 依存パッケージをインストールします。
   ```bash
   pnpm install
   ```
3. 個人用のクラウドサンドボックス（Cognito、Lambda、API Gateway、Aurora）をデプロイします。完了すると `amplify_outputs.json` が生成されます。
   ```bash
   pnpm sandbox
   ```
   初回は Aurora クラスターを作成するため時間がかかります。
4. 別のターミナルでフロントエンドを起動し、http://localhost:3000 を開きます。
   ```bash
   pnpm dev
   ```

> `pnpm exec ampx ...` を直接実行せず、必ず `pnpm sandbox` / `pnpm sandbox:delete` を使ってください。これらのスクリプトは、AWS Blocks の synth に必要な `NODE_OPTIONS=--conditions=cdk` を設定します。

### 任意: API をローカルで動かす

`pnpm blocks:dev` を実行すると、`aws-blocks/index.ts` がローカルの PGlite データベース（`.bb-data/` に保存）を使って http://localhost:3001 で動きます。バックエンドを変更するたびに再デプロイする必要がなくなります。サインインには引き続きサンドボックスの Cognito User Pool を使います。

```bash
cp .env.example .env.local   # フロントエンドの接続先を http://localhost:3001 に切り替え
pnpm blocks:dev
pnpm dev
```

## Amplify Hosting へのデプロイ

1. Amplify コンソールで **新しいアプリを作成** を選び、リポジトリを接続します。
2. Amplify が [`amplify.yml`](./amplify.yml) を読み込み、`ampx pipeline-deploy` でバックエンドをデプロイしてから Next.js をビルドします。

CORS は、このアプリのすべてのブランチ（`https://<branch>.<appId>.amplifyapp.com`）に対して許可されています。カスタムドメインを使う場合は、Amplify の環境変数 `BLOCKS_ALLOWED_ORIGINS` に正規表現をカンマ区切りで設定してください（例: `^https://app\.example\.com$`）。

## ディレクトリ構成

```
amplify/
  backend.ts            Amplify バックエンド（auth + Blocks）
  auth/resource.ts      Cognito の設定
  blocks.ts             AWS Blocks を Amplify に組み込む（CORS、Cognito 設定、outputs）
aws-blocks/
  index.ts              API（ApiNamespace）と Database
  auth.ts               Cognito ID トークンの検証
  migrations/*.sql      DB スキーマ（ファイル名順に適用）
  amplify-client.js     フロントエンド用クライアント: `import { api } from 'aws-blocks'`
  index.cdk.ts          CDK エントリポイント（amplify/blocks.ts から呼び出し）
  index.handler.ts      Lambda エントリポイント
  scripts/              ローカル dev サーバー
app/                    Next.js App Router のページ
```

## カスタマイズ

- **スキーマを変更する**: `aws-blocks/migrations/002_add_due_date.sql` のように、連番の新しいファイルを追加します。適用済みのマイグレーションは編集しないでください。
- **API メソッドを追加する**: `aws-blocks/index.ts` の `api` にメソッドを追加します。フロントエンドからは `import { api } from 'aws-blocks'` で型付きのまま呼び出せます。サインインが必要なメソッドでは `requireUser(context)` を呼んでください。
- **ネームスペースを追加する**: `aws-blocks/index.ts` で新しい `ApiNamespace` を export し、対応するクライアントを `aws-blocks/amplify-client.js` から export します。
- **他の Building Block を使う**（KV ストア、ファイルバケット、cron ジョブなど）: `node_modules/@aws-blocks/blocks/README.md` を参照してください。
- **Amplify Data / Storage を追加する**: 通常どおり `amplify/` 配下で定義し、`amplify/backend.ts` の `defineBackend` に加えます。

## コストと後片付け

- Aurora Serverless v2 は `minCapacity: 0` で動いているため、アイドル時は自動で一時停止します。一時停止後の最初のクエリには数秒かかります。本番環境では `aws-blocks/index.ts` の `minCapacity` を上げてください。
- `pnpm sandbox:delete` でサンドボックスをデータベースごと削除できます。
- ブランチデプロイでは、スタックを更新してもデータが残るように、Aurora クラスターは**保持（Retain）**され、削除保護も有効になります。Amplify アプリを削除してもクラスターは残ります。削除するには RDS コンソールで削除保護を無効にしてから削除してください。

## ライセンス

[MIT-0](./LICENSE)。自由に利用でき、著作権表示も不要です。

[aws-samples/amplify-next-template](https://github.com/aws-samples/amplify-next-template)（MIT-0）と AWS Blocks の Amplify 連携を参考にしています。依存パッケージには、それぞれのライセンス（主に Apache-2.0 と MIT）が適用されます。
