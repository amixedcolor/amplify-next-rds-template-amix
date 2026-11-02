# Amplify Gen 2 + RDS (Aurora PostgreSQL) Next.js テンプレート

[English](./README.md)

**リレーショナルデータベース**を使うフルスタックアプリを AWS 上で作るための、最小構成のスターターです。

- **フロントエンド**: Next.js 16 (App Router) + React 19。AWS Amplify Hosting でホスティング
- **認証**: Amplify Gen 2 による Amazon Cognito と、Amplify UI の `<Authenticator>`
- **API + DB**: [AWS Blocks](https://github.com/aws-devtools-labs/aws-blocks)。Lambda + API Gateway 上の型付き RPC API で、DB は **Aurora Serverless v2 (PostgreSQL)**。スキーマは素の SQL マイグレーションで管理し、クエリは [Kysely](https://kysely.dev)（クエリビルダー）で書きます

サンプルはユーザーごとの Todo リストです。サインインしたユーザーには自分の行だけが見えます。

```
ブラウザ ──(Cognito ID トークン)──▶ API Gateway ─▶ Lambda (aws-blocks/index.ts) ─▶ Aurora PostgreSQL
   │                                                 └─ Cognito User Pool でトークンを検証
   └──▶ Cognito (Amplify Auth)
```

## はじめかた

前提: Node.js 22 または 24（`.nvmrc` では 22 を指定。Node.js 25 では Amplify CLI がクラッシュするため非対応）、[pnpm](https://pnpm.io/ja/installation)（バージョンは `package.json` の `packageManager` で固定）、AWS アカウント、ローカルの AWS 認証情報（[Amplify のセットアップ手順](https://docs.amplify.aws/nextjs/start/account-setup/)）。

1. GitHub の **Use this template** でリポジトリを作成し、clone します。最初のデプロイの前に、[最初のデプロイ前に決める名前](#最初のデプロイ前に決める名前) を確認してください。
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

> `ampx` を直接実行せず、必ず `pnpm sandbox` / `pnpm sandbox:delete` を使ってください。これらのスクリプトは次の2つを設定します。
> - `NODE_OPTIONS=--conditions=cdk`: AWS Blocks の synth に必要です。
> - `AMPLIFY_SANDBOX=true`: このデプロイがサンドボックスであることを示します。これがないと DB が本番用の設定（保持・削除保護あり）でデプロイされ、`sandbox:delete` で削除できなくなります。

### 任意: API をローカルで動かす

`pnpm blocks:dev` を実行すると、`aws-blocks/index.ts` がローカルの PGlite データベース（`.bb-data/` に保存）を使って http://localhost:3001 で動きます。バックエンドを変更するたびに再デプロイする必要がなくなります。サインインには引き続きサンドボックスの Cognito User Pool を使います。フロントエンドとローカルサーバーの両方が `amplify_outputs.json` を読むので、先に一度 `pnpm sandbox` を実行しておいてください。

```bash
cp .env.example .env.local   # フロントエンドの接続先を http://localhost:3001 に切り替え
pnpm blocks:dev
pnpm dev
```

## Amplify Hosting へのデプロイ

1. Amplify コンソールで **新しいアプリを作成** を選び、リポジトリを接続します。
2. Amplify が [`amplify.yml`](./amplify.yml) を読み込みます。ビルドでは Node.js 22 と pnpm を用意したあと、`pnpm db:types --verify` と `pnpm typecheck:backend` を実行します。これらが通れば `ampx pipeline-deploy` でバックエンドをデプロイし、最後に Next.js をビルドします。

> **Next.js のバージョンについて**: Amplify Hosting のドキュメントでは、SSR の公式サポートは Next.js 12〜15 とされています（[出典](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html)）。このテンプレートは Next.js 16 を使っています。Hosting でのビルドや SSR で問題が起きた場合は、Next.js 15 を試してください。

CORS は、このアプリのすべてのブランチ（`https://<branch>.<appId>.amplifyapp.com`）に対して許可されています。カスタムドメインを使う場合は、Amplify の環境変数 `BLOCKS_ALLOWED_ORIGINS` に正規表現をカンマ区切りで設定してください（例: `^https://app\.example\.com$`）。正規表現自体にはカンマ（`{1,3}` など）を含められません。

## ディレクトリ構成

```
amplify/
  backend.ts            Amplify バックエンド（auth + Blocks）
  auth/resource.ts      Cognito の設定
  blocks.ts             AWS Blocks を Amplify に組み込む（CORS、Cognito 設定、outputs）
aws-blocks/
  index.ts              API（ApiNamespace）と Kysely のクエリ
  db.generated.ts       Kysely 用のテーブル型。マイグレーションから自動生成（`pnpm db:types`）
  timestamp.ts          タイムスタンプの型と ISO 形式への変換
  auth.ts               Cognito ID トークンの検証
  validate.ts           API 引数の実行時検査
  migrations/*.sql      DB スキーマ（ファイル名順に適用）
  amplify-client.js     フロントエンド用クライアント: `import { api } from 'aws-blocks'`
  index.cdk.ts          CDK エントリポイント（amplify/blocks.ts から呼び出し）
  index.handler.ts      Lambda エントリポイント
  scripts/              ローカル dev サーバー、DB の型生成
app/                    Next.js App Router のページ
```

## 最初のデプロイ前に決める名前

- `package.json` の `name` と、`app/layout.tsx` のページタイトルを変更してください。
- `aws-blocks/index.ts` にある DB の識別子（`new Scope('app')`、ID の `'db'`、`databaseName`）を決めてください。これらは AWS リソースの名前になるため、デプロイ後に変えると、空の Aurora クラスターが新しく作られます。ブランチデプロイでは古いクラスターも残り、課金が続きます。

## カスタマイズ

- **スキーマを変更する**:
  1. `aws-blocks/migrations/002_add_due_date.sql` のように、連番の新しいファイルを追加します。適用済みのマイグレーションは編集しないでください。
  2. `pnpm db:types` を実行して `aws-blocks/db.generated.ts` を再生成し、両方のファイルをコミットします。生成されたファイルは手で編集しないでください。

  `pnpm db:types --verify` は、生成された型がマイグレーションと一致しないと失敗します。CI と Amplify Hosting のバックエンドビルドでは、デプロイ前にこのコマンドと `pnpm typecheck:backend` を実行します。
- **クエリを書く**: `aws-blocks/index.ts` の型付き `db`（Kysely）を使います。生の SQL が必要なときは Kysely の `sql` タグを使います。タイムスタンプはローカルでは `Date`、AWS（RDS Data API）では文字列で返るため、API から返す前に `toIsoString()` でそろえてください。また、影響を受けた行数（`numDeletedRows` など）は取得できないので、行が存在したかどうかは `.returning(...)` で確認します。
  次の2点は、ローカルでは動いても AWS（RDS Data API）では失敗します。
  - **型付きのパラメータ**: パラメータはテキストとして送られます。`timestamp`、`date`、`uuid`、`json`/`jsonb`、`numeric` のカラムと比較したり書き込んだりする値は、``sql<Date>`${value}::timestamptz` `` のように明示的にキャストしてください。詳しくは `aws-blocks/timestamp.ts` を参照してください。
  - **レスポンスのサイズ**: 1回のレスポンスは 1 MiB までなので、一覧のクエリには必ず `.limit(...)` を付け、ページングしてください。
- **API メソッドを追加する**: `aws-blocks/index.ts` の `api` にメソッドを追加します。フロントエンドからは `import { api } from 'aws-blocks'` で型付きのまま呼び出せます。各メソッドでは次の3点を守ってください。
  - サインインが必要なメソッドでは `requireUser(context)` を呼びます。
  - ユーザーが所有するテーブルへのクエリは、`todosOf(user)` のような所有者で絞り込み済みのヘルパーから始めます。こうすると所有者の条件を書き忘れることがありません。Blocks の Postgres RLS（`withRLS`）は Kysely アダプターと組み合わせられないため、所有者のチェックはアプリ側で行います。
  - 引数はすべて `aws-blocks/validate.ts` で検査します。TypeScript の型は実行時には検査されず、クライアントはどんな JSON でも送れるためです。
- **ネームスペースを追加する**: `aws-blocks/index.ts` で新しい `ApiNamespace` を export し、対応するクライアントを `aws-blocks/amplify-client.js` から export します。
- **他の Building Block を使う**（KV ストア、ファイルバケット、cron ジョブなど）: `node_modules/@aws-blocks/blocks/README.md` を参照してください。
- **Amplify Data / Storage を追加する**: 通常どおり `amplify/` 配下で定義し、`amplify/backend.ts` の `defineBackend` に加えます。

## コストと後片付け

- Aurora Serverless v2 は `minCapacity: 0` で動いているため、約5分アイドルが続くと自動で一時停止し、停止中のコンピュート料金はかかりません。そのかわり、次の点に注意してください。
  - **一時停止後の最初のリクエスト**: クラスターが復帰するまでの間、`ConnectionFailedException`（"The database connection failed"）で失敗します。復帰には数秒から数分かかり、復帰後に再試行すれば成功します。サンプルアプリでは、この場合に「再試行してください」というメッセージを表示します。
  - **マイグレーションを含むデプロイ**: 一時停止中のクラスターに対してマイグレーションを実行すると、Blocks が約2分間再試行するにもかかわらず、初回のデプロイが失敗することがあります。ビルド（または `pnpm sandbox`）を再実行すれば成功します。
  - **本番環境**: `aws-blocks/index.ts` の `minCapacity` を上げる（例: `0.5`）と、DB が常時起動した状態になります。その分 ACU 時間単位で課金されます。
- `pnpm sandbox:delete` でサンドボックスをデータベースごと削除できます。
- ブランチデプロイでは、スタックを更新してもデータが残るように、Aurora クラスターは**保持（Retain）**され、削除保護も有効になります。Amplify アプリを削除してもクラスターは残ります。削除するには RDS コンソールで削除保護を無効にしてから削除してください。

## テレメトリ

このテンプレートが使うツールは、デフォルトで匿名の利用データを送信します。
- **AWS Blocks**（dev サーバー、synth）: `AWS_BLOCKS_DISABLE_TELEMETRY=1` または `npx blocks-telemetry --disable` で無効にできます。
- **Amplify CLI**（`ampx`）: `pnpm exec ampx configure telemetry disable` で無効にできます。

## ライセンス

[MIT-0](./LICENSE)。自由に利用でき、著作権表示も不要です。

[aws-samples/amplify-next-template](https://github.com/aws-samples/amplify-next-template)（MIT-0）と AWS Blocks の Amplify 連携を参考にしています。依存パッケージには、それぞれのライセンス（主に Apache-2.0 と MIT）が適用されます。
