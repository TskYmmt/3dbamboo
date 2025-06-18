# AWS Elastic Beanstalk デプロイガイド

## 必要な準備
1. AWSアカウント
2. AWS CLIインストール済み（または EB CLIをインストール）

## 手順

### 方法1: AWSコンソールでデプロイ（簡単）

1. **AWSコンソールにログイン**
   - https://console.aws.amazon.com/elasticbeanstalk

2. **新しいアプリケーション作成**
   - 「アプリケーションの作成」をクリック
   - アプリケーション名: `tanabata-3d`

3. **環境設定**
   - プラットフォーム: `Node.js`
   - プラットフォームブランチ: `Node.js 18` または最新
   - アプリケーションコード: 「コードのアップロード」

4. **コードのアップロード**
   - このプロジェクトを ZIP ファイルに圧縮
   ```bash
   # プロジェクトルートで実行
   zip -r tanabata-3d.zip . -x "node_modules/*" -x ".git/*" -x "*.log"
   ```
   - ZIPファイルをアップロード

5. **環境作成**
   - 「環境の作成」をクリック
   - 5-10分待つ

### 方法2: EB CLIでデプロイ（推奨）

1. **EB CLIインストール**
   ```bash
   pip install awsebcli
   ```

2. **初期化**
   ```bash
   cd /home/yamamoto/projects/bamboo/tanabata-3d
   eb init tanabata-3d --platform node.js --region ap-northeast-1
   ```

3. **環境作成とデプロイ**
   ```bash
   eb create tanabata-3d-env
   eb deploy
   ```

4. **アプリケーションを開く**
   ```bash
   eb open
   ```

## デプロイ後の確認

1. 環境のURLにアクセス
   - 形式: `http://tanabata-3d-env.xxxxxx.ap-northeast-1.elasticbeanstalk.com`

2. ログ確認（問題がある場合）
   ```bash
   eb logs
   ```

## 更新方法

コード変更後：
```bash
git add .
git commit -m "Update message"
eb deploy
```

## コスト

- t3.micro インスタンス: 無料枠内（12ヶ月）
- 無料枠後: 月額約$10-15
- Application Load Balancer: 月額約$20

## メリット

- ✅ 現在のコードをそのまま使える
- ✅ 自動スケーリング
- ✅ ヘルスモニタリング
- ✅ ローリングデプロイ
- ✅ HTTPSも簡単に設定可能

## 注意事項

- `tanzaku_data.json`はインスタンス内に保存されるため、再デプロイで消える可能性
- 本番環境では S3 や RDS への移行を推奨