# 🎋 デジタル七夕 3D

会社の七夕イベント用の3Dウェブアプリケーション。社員がスマートフォンで願い事を短冊に書いて、3D空間の竹に飾ることができます。

## 🌟 機能

- **3D竹林**: リアルな竹のモデルと3D環境
- **短冊作成**: スマートフォンで指を使って願い事を描画
- **マルチデバイス対応**: PC（マインクラフト風操作）とスマホ（仮想ジョイスティック）
- **リアルタイム共有**: 複数ユーザーの短冊をリアルタイムで共有
- **永続化**: サーバー側でデータ保存、ページ更新でも状態維持

## 🎮 操作方法

### PC版
- **クリック**: ポインターロック開始
- **マウス**: 視点移動
- **WASD**: 移動
- **QE**: 上下移動
- **F or クリック**: 短冊選択
- **ESC**: ポインターロック解除

### スマホ版
- **左下ジョイスティック**: 移動
- **右側エリア**: 視点移動
- **右下ボタン**: QE（上下移動）

## 🚀 デプロイ

### Renderでのデプロイ

1. [Render](https://render.com)にサインアップ
2. "New Web Service"を選択
3. GitHubリポジトリを接続
4. 設定:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node.js

### Railwayでのデプロイ

1. [Railway](https://railway.app)にサインアップ
2. "Deploy from GitHub repo"を選択
3. リポジトリを選択
4. 自動的にデプロイ開始

## 🛠️ ローカル開発

```bash
# 依存関係インストール
npm install

# サーバー起動
npm start

# 開発モード（自動再起動）
npm run dev
```

アクセス: http://localhost:8005

## 📁 プロジェクト構成

```
tanabata-3d/
├── server.js          # Node.js サーバー
├── package.json       # 依存関係
├── index.html         # メインHTML
├── css/
│   └── style.css      # スタイルシート
├── js/
│   └── app.js         # メインアプリケーション
├── models/
│   └── bamboo.glb     # 3D竹モデル
└── tanzaku_data.json  # 短冊データ（自動生成）
```

## 🎨 技術スタック

- **フロントエンド**: Three.js, HTML5 Canvas
- **バックエンド**: Node.js, Express
- **データ**: JSON ファイルベース
- **3Dモデル**: GLB形式

## 📱 対応デバイス

- **PC**: Chrome, Firefox, Safari, Edge
- **スマートフォン**: iOS Safari, Android Chrome
- **タブレット**: iPad, Android タブレット

## 🔧 カスタマイズ

### 竹モデルの変更
`models/bamboo.glb` を差し替えて独自の3Dモデルを使用可能

### UI言語の変更
`index.html` と `js/app.js` 内のテキストを編集

### データベース連携
`server.js` を編集してMongoDB、PostgreSQLなどに対応可能