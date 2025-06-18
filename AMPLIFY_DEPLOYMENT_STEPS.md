# Amplify Lambda版デプロイ手順

## 前提条件
- AWS CLIがインストール・設定済み
- Amplify CLIがインストール済み（✅完了）
- AWSアカウントでAmplifyアプリが作成済み

## 手順

### 1. AWSアカウント認証
```bash
aws configure
# Access Key ID、Secret Access Key、Region (ap-northeast-1)を設定
```

### 2. Amplifyプロジェクト初期化
```bash
amplify init
# - Enter a name for the project: tanabata3d
# - Enter a name for the environment: dev
# - Choose your default editor: None
# - Choose the type of app: javascript
# - What javascript framework: None
# - Source Directory Path: .
# - Distribution Directory Path: .
# - Build Command: npm run build
# - Start Command: npm start
# - Do you want to use an AWS profile? Yes
# - Please choose the profile you want to use: default
```

### 3. APIとLambda関数の追加
```bash
# API Gateway + Lambda関数を追加
amplify add api
# - Please select from one of the below mentioned services: REST
# - Provide a friendly name for your resource: tanabataAPI
# - Provide a path: /api
# - Choose a Lambda source: Create a new Lambda function
# - Provide a friendly name for your resource: tanzakuAPI
# - Provide the AWS Lambda function name: tanzakuAPI
# - Choose the runtime: NodeJS
# - Choose the function template: Hello World
# - Do you want to configure advanced settings? No
# - Do you want to edit the local lambda function now? No
# - Restrict API access: No
# - Do you want to add another path? No
```

### 4. S3ストレージの追加
```bash
amplify add storage
# - Please select from one of the below mentioned services: Content
# - Please provide a friendly name for your resource: tanzakuS3
# - Please provide bucket name: tanabata3d-tanzaku-data
# - Who should have access: Auth and guest users
# - What kind of access do you want for Authenticated users? read/write
# - What kind of access do you want for Guest users? read/write
```

### 5. Lambda関数のコード更新
作成されたLambda関数のコードを、`amplify/backend/function/tanzakuAPI/src/index.js`に
既存の`/amplify/backend/function/tanzakuAPI/src/index.js`の内容をコピー

### 6. デプロイ
```bash
amplify push
# - Are you sure you want to continue? Yes
# - Do you want to generate code for your newly created resources? No
```

### 7. 設定ファイルの更新
デプロイ後、`aws-exports.js`が生成されるので、その内容を`amplify-config.js`に反映

### 8. 再デプロイ
```bash
# Amplify Hostingに再デプロイ
git add .
git commit -m "Update amplify configuration with real values"
git push origin feature/lambda-migration
```

## 注意事項
- 初回デプロイには10-15分かかる場合があります
- Lambda関数の作成にはIAMロールの設定が必要です
- S3バケットはユニークな名前にする必要があります

## トラブルシューティング
- デプロイに失敗した場合: `amplify delete` → 再度 `amplify init`
- 権限エラーの場合: AWS IAMでAmplifyAdmin権限を確認
- リージョンエラーの場合: `ap-northeast-1`を使用