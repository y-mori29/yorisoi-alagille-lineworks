# よりそい アラジール症候群版 LINE WORKS

このリポジトリは、アラジール症候群のお子さん・ご家族向けに作る **よりそい アラジール症候群版** の独立実装です。

`yorisoi-3button-line` とは別リポジトリとして扱います。既存の診察メモ体験は活かしつつ、小児・保護者管理・成長記録・写真アルバム・LINE WORKS導線を中心に設計します。

---

## 中心機能

- **診察メモ**: 診察の会話を記録し、患者さん・ご家族が読み返しやすいメモにする
- **成長曲線**: 身長・体重を入力し、参考曲線上で今の位置を見える化する
- **写真アルバム**: 写真を横3枚グリッドで見返す。診察メモや日付メモと紐づける
- **ふりかえる**: 受診ごとの記録、成長、写真を時系列で見る
- **みせる**: 他院・他科で言われたことを今日の診察で見せる
- **将来の引き継ぎ**: 最初は保護者が管理し、将来的に子ども本人へデータを引き継ぐ前提をデータ構造に残す

---

## 構成

| ディレクトリ | 役割 |
| --- | --- |
| `backend/` | Node.js + Express のAPIサーバー。静的画面、録音、AI要約、Firestore保存を担当 |
| `backend/public/` | LINE WORKS/ブラウザから開く患者・家族向け画面 |
| `backend/public/simple/` | 診察メモ、ふりかえる、みせるの画面 |
| `backend/templates/` | 疾患テンプレート。アラジール版は `alagille.json` |
| `backend/masters/` | 薬剤などのマスタデータ |
| `docs/` | LINE WORKS仕様調査、引き継ぎ設計、実装判断 |
| `secure/` | ローカル秘密情報置き場。Git対象外 |

---

## ローカル開発

依存関係を入れます。

```powershell
cd C:\Users\green\Projects\medicanvas\yorisoi\patient\yorisoi-alagille-lineworks\backend
npm install
```

開発確認は `npm run dev` を使います。

```powershell
$env:PORT="8082"
$env:FIRESTORE_DATABASE_ID="alagille-local"
$env:GCS_BUCKET="dummy-alagille-local-bucket"
$env:DEFAULT_TENANT_ID="alagille-family"
$env:DEMO_MODE="1"
npm run dev
```

ブラウザでは次を確認します。

- `http://localhost:8082/`
- `http://localhost:8082/setup.html`
- `http://localhost:8082/api/config?disease=alagille`
- `http://localhost:8082/simple/record.html?disease=alagille`
- `http://localhost:8082/simple/calendar.html?disease=alagille`
- `http://localhost:8082/simple/show.html?disease=alagille`

---

## 環境変数

ローカルの秘密情報は `.env` や `secure/` に置き、Gitには含めません。共有用の例は `backend/.env.example` を参照してください。

主な環境変数は次の通りです。

- `PORT`: ローカル起動ポート。既定は `8082`
- `FIRESTORE_DATABASE_ID`: Firestore の named database ID。Cloud Runでは `yorisoi-alagille`
- `GCS_BUCKET`: 録音・写真を置くGCSバケット
- `DEFAULT_TENANT_ID`: 単一運用時のテナントID。推奨は `alagille-family`
- `LINE_WORKS_CLIENT_ID` / `LINE_WORKS_CLIENT_SECRET`: LINE WORKS連携用
- `LINE_WORKS_BOT_ID`: LINE WORKS Bot ID
- `LINE_WORKS_SERVICE_ACCOUNT`: LINE WORKS API用サービスアカウント
- `GOOGLE_GENAI_API_KEY`: AI要約に使うAPIキー
- `LAB_OCR_MODE`: `gemini` で実OCR、`sample` でローカル用サンプル読取
- `GEMINI_OCR_MODEL`: 検査結果OCRの主モデル。現在は `gemini-3.1-flash-lite`
- `GEMINI_OCR_FALLBACK_MODEL`: 構造化読取に失敗した場合だけ再試行するモデル。現在は `gemini-3.5-flash`

検査結果OCRは **Vertex AIを使わず、Gemini Developer APIをAPIキーで直接呼び出す**。APIキーの値はCloud Runへ直接書かず、Secret Managerの `DEV_GEMINI_API_KEY` を環境変数 `GOOGLE_GENAI_API_KEY` として参照する。

---

## 現在の実装方針

- 6/24 10:30 向けMVPでは、LINE WORKS上のリンクからWebアプリを開く導線を最短ルートにする
- LINE WORKS Bot、固定メニュー、リッチメニュー、URIアクションは次段階で使う
- 要配慮情報はLINE WORKSのトーク本文に出さず、Webアプリ内で見る
- 成長曲線はまず参考表示として実装し、医学的な判定はしない
- 写真アルバムは横3枚固定グリッドから始める
- 親から子への引き継ぎは、MVPでは設計とデータ構造だけ先に入れる

---

## デプロイ

Cloud Runの専用構成は、プロジェクト `yorisoi-dev-477515`、サービス `yorisoi-alagille`、Firestore `yorisoi-alagille`、GCS `yorisoi-dev-477515-yorisoi-alagille-files` を使用します。個人記録APIはFirebase AuthenticationのHttpOnlyセッションと、Firestore上のactiveな家族member所属を必須とします。検査画像は所属family/patient配下のGCSへ、OCR結果は同じpatient配下のFirestoreへ保存します。

デプロイはリポジトリルートから `./deploy.ps1` を実行します。外部LINE/LINE WORKS連携は初回Cloud Runの必須条件に含めません。

`deploy_env.yaml` などの秘密情報を含むファイルはGitに含めません。デプロイ前に、`.gitignore` と `git status --ignored --short` で機密混入がないことを確認します。
