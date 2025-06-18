# Lambda Migration Guide

このブランチ（`feature/lambda-migration`）では、Express.jsサーバーをAWS Lambda関数に移行しました。

## 変更内容

### 1. Lambda関数の作成
- `amplify/backend/function/tanzakuAPI/src/index.js` - メインのLambda関数
- S3を使用してデータを永続化（`tanzaku_data.json`）
- 全てのAPIエンドポイントを単一のLambda関数で処理

### 2. フロントエンドの更新
- `app.js` - Amplify APIエンドポイントの自動検出を追加
- `amplify-config.js` - API設定ファイル（デプロイ後に自動生成される）
- `index.html` - amplify-config.jsを読み込むように更新

### 3. Amplify設定
- `amplify.yml` - ビルド設定を更新
- バックエンドのビルドプロセスを追加
- 不要なファイルを除外

## デプロイ手順

### 1. Amplify CLIのインストール
```bash
npm install -g @aws-amplify/cli
```

### 2. Amplifyの初期化
```bash
amplify init
# プロジェクト名: tanabata3d
# 環境名: dev
# デフォルトエディタ: Visual Studio Code
# アプリタイプ: javascript
# フレームワーク: none
# ソースディレクトリ: /
# ビルドコマンド: npm run-script build
# スタートコマンド: npm run-script start
```

### 3. Amplifyにプッシュ
```bash
amplify push
```

### 4. AWS Amplifyコンソールでデプロイ
1. AWS Amplifyコンソールを開く
2. このブランチ（`feature/lambda-migration`）を選択
3. デプロイを実行

## 注意事項

1. **初回デプロイ後**
   - `amplify-config.js`が自動生成されます
   - API GatewayのURLが含まれます

2. **S3バケット**
   - 自動的に作成されます
   - `tanzaku_data.json`がここに保存されます

3. **コスト**
   - Lambda: 月100万リクエストまで無料
   - S3: 5GBまで無料
   - API Gateway: 月100万リクエストまで無料

## ローカルテスト

Lambda関数をローカルでテストする場合：
```bash
# SAM CLIをインストール
brew install aws-sam-cli

# ローカルでテスト
cd amplify/backend/function/tanzakuAPI/src
sam local start-api
```

## トラブルシューティング

### CORSエラーが出る場合
- Lambda関数内でCORSヘッダーを設定済み
- API Gatewayの設定も確認

### S3アクセスエラー
- Lambda関数のIAMロールにS3アクセス権限が必要
- Amplifyが自動的に設定するはず

### データが保存されない
- S3バケット名が正しいか確認
- CloudWatchログでエラーを確認