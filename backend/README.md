# よりそい アラジール症候群版 — Backend

アラジール症候群のお子さん・ご家族向け「よりそい」のバックエンドです。

録音された診察会話やチャット形式の入力を受け取り、必要に応じて音声認識とAI要約を行い、保護者・本人が読み返しやすい `patient_view` としてFirestoreに保存します。加えて、成長曲線・写真アルバム・将来の本人引き継ぎを扱う前提で拡張していきます。

## 役割

- LINE WORKS/ブラウザからの患者・保護者向け画面配信
- 音声アップロード用の署名付きURL（GCS）の発行
- 音声認識、文脈補正、患者・家族向け要約の生成
- 診察メモ、成長記録、写真アルバム、タイムラインの取得・保存
- アラジール症候群テンプレートとマスタデータの配信

## 技術スタック

- Node.js, Express
- Firebase Admin（Firestore）
- Google Cloud Storage
- Google Cloud Speech-to-Text
- Gemini / Google GenAI
- LINE WORKS Bot/API（MVPではリンク起動を優先）

## ローカルでの起動

```bash
npm install
npm run dev
```

ローカルで最低限の画面確認をするときは、次のように一時環境変数を指定します。

```powershell
$env:PORT="8082"
$env:FIRESTORE_DATABASE_ID="alagille-local"
$env:GCS_BUCKET="dummy-alagille-local-bucket"
$env:DEFAULT_TENANT_ID="alagille-family"
$env:DEMO_MODE="1"
npm run dev
```

## 主な確認URL

- `/`
- `/setup.html`
- `/api/templates`
- `/api/config?disease=alagille`
- `/simple/record.html?disease=alagille`
- `/simple/growth.html?disease=alagille`
- `/simple/album.html?disease=alagille`
- `/simple/calendar.html?disease=alagille`
- `/simple/show.html?disease=alagille`

## プロジェクト全体について

- 全体の方針はルートの [README.md](../README.md) を参照してください。
- LINE WORKS導線は [docs/lineworks-mvp-routing.md](../docs/lineworks-mvp-routing.md) を参照してください。
- デプロイ前には、LINE WORKS/GCPの接続情報と機密ファイル混入がないことを確認してください。
