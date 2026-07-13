# よりそい — Dashboard（管理画面）

よりそいシステムの**ダッシュボード**です。PC やタブレットで、AI が生成した医療記録（SOAP）の確認・編集や、施設・患者の管理を行う Web アプリです。

## 役割

- 施設ボード・患者一覧・ラウンド・訪問記録（Encounter）の表示
- SOAP の閲覧・編集（修正内容は Firestore に即時反映）
- 音声再生、レセコン用 100 文字要約の表示
- CSV インポート、施設・患者の追加・管理、管理者機能、ナレッジ管理

## 技術スタック

- Vite, React 19, TypeScript
- Firebase（認証・Firestore 連携）

## 前提条件

- Node.js v18 以上
- バックエンド API の URL（環境に応じて設定。ルートのデプロイ用 YAML やドキュメントを参照）

## ローカルでの起動

```bash
npm install
npm run dev
```

ブラウザで表示された URL を開いて利用します。Firebase 認証とバックエンド API が利用可能な状態で動作させてください。

## ビルド・プレビュー

```bash
npm run build
npm run preview
```

本番デプロイはルートのデプロイスクリプト（例: `deploy_hikari.ps1`）で行います。ルートの [README.md](../README.md) を参照してください。

## プロジェクト全体について

- ワークスペースの構成・他アプリ（backend / frontend）の説明は、ルートの [README.md](../README.md) および [docs/WORKSPACE_GUIDE_FOR_BEGINNERS.md](../docs/WORKSPACE_GUIDE_FOR_BEGINNERS.md) を参照してください。
