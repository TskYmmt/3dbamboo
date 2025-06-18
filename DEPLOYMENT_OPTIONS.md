# デプロイオプション

## 現在の問題
AWS Amplifyは静的サイトホスティングには最適ですが、Express.jsサーバーは自動的に起動しません。

## 推奨される解決策

### 1. **Render.com（最も簡単）** ✅
- すでに動作確認済み
- Express.jsサーバーをそのまま使える
- 無料プランあり

### 2. **AWS EC2 + Elastic Beanstalk**
- Express.jsをそのまま動かせる
- より本格的な運用向け
- コスト：月額$10〜

### 3. **Heroku**
- Express.jsをそのまま使える
- デプロイが簡単
- 無料プランは廃止（月額$7〜）

### 4. **Vercel**
- APIルートとして実装し直す必要あり
- `/api`ディレクトリにサーバーレス関数を配置
- 無料プランあり

### 5. **AWS Amplify + Lambda（上級者向け）**
- Express.jsをLambda関数に変換
- S3でデータ永続化
- サーバーレスアーキテクチャ

## 現実的な選択肢

**開発・テスト用**: Render.com（無料、簡単）
**本番用**: AWS EC2 + Elastic Beanstalk（安定、スケーラブル）

## Amplifyでサーバーも動かしたい場合

1. Amplify CLIをインストール
```bash
npm install -g @aws-amplify/cli
amplify init
amplify add api
amplify push
```

2. Express.jsをLambda関数として実装（上記のコードを使用）

3. フロントエンドのAPIエンドポイントを更新