# よりそい アラジール

アラジール症候群のあるお子さん・成人当事者と、そのご家族のための記録Webアプリです。

診察で話したこと、検査結果、お薬、成長、日々の様子、次回の受診予定などを、健康記録の対象ごとに整理します。記録した内容は家族で共有でき、診察時には必要な項目だけをまとめて先生へ見せられます。

このアプリは診断や治療判断を行いません。家族が記録した事実を見返し、診察で伝えやすくするための補助ツールです。

## 現在の状態

2026年7月13日時点で、主要機能をCloud Runへデプロイしています。

- 公開URL: [https://yorisoi-alagille-hj2kuu4pda-an.a.run.app](https://yorisoi-alagille-hj2kuu4pda-an.a.run.app)
- Cloud Runサービス: `yorisoi-alagille`
- 配信中の確認済みrevision: `yorisoi-alagille-00017-d4g`
- Google Cloudプロジェクト: `yorisoi-dev-477515`
- Firestore database: `yorisoi-alagille`
- GCS bucket: `yorisoi-dev-477515-yorisoi-alagille-files`

Cloud RunのURLから、アカウント登録、家族共有、記録の作成・閲覧・編集・削除を行えます。現在のLINE WORKS利用方法はURLからWebアプリを開く方式です。LINE WORKSアカウントとの自動連携、Bot、通知、リマインドはまだ接続していません。

## 実装済み機能

### アカウントと家族ノート

- Firebase Authenticationによるアカウント登録・ログイン
- 初回登録で、アプリ利用者と健康記録の対象を分けて登録
- 子どもの男の子・女の子、成人男性・女性の4種類のアバター
- 1家族内で複数の健康記録対象を追加・切り替え
- 生年月日から年齢を表示
- 家族メンバーの一覧と権限表示
- 7日間有効・1回限りの招待リンク
- `見るだけ` と `記録できる` の権限
- 発行済み招待の状態確認と取り消し

### 記録

- **診察メモ**: 診察音声の録音、Speech-to-Text、Geminiによる項目整理、音声再生、編集、削除
- **検査値**: 検査用紙の写真、Gemini OCR、元画像との照合、手修正、H/L表示、一覧、グラフ、編集、削除
- **お薬メモ**: お薬の写真、Gemini OCR、名前・量・飲み方・変更履歴、服用記録、編集、削除
- **成長のきろく**: 身長・体重・メモ、前回との差、実測値の推移グラフ、編集、削除
- **日々の様子**: 皮膚、便、かゆみ、食事、動き、その他の写真・動画・メモ、時系列表示、編集、削除
- **受診予定**: 日時、病院、診療科、場所、メモ、予定・受診済み・取消の管理
- **次に聞くこと**: 6カテゴリの質問、未確認・確認済み、回答メモ

### 見返す・診察へ持っていく

- 診察、日々、検査、お薬、成長を新しい順にまとめる「最近の記録」
- 検査、お薬、日々の写真を患者別に横断表示する3列固定の写真アルバム
- 期間と項目を選び、コピー・印刷できる「先生に見せる」画面
- 診察メモから生成した質問候補は出典を明示し、正規の質問へ勝手に追加しない
- 改善・悪化・正常・異常などの医学的判断を自動生成しない

### 使い方とQ&A

- 検査値、お薬、日々の様子、成長、診察録音、先生に見せる画面の非保存チュートリアル
- 保存場所、スマホ容量、保存期間、費用、家族共有、医師への提示、安全性に関するQ&A
- 未確定の費用・保存期間・運用条件を、無料・永久・完全に安全とは案内しない

## データとアクセス制御

データは次の単位で分離します。

```text
アカウント
  └─ 家族
      ├─ メンバーと権限
      └─ 健康記録の対象
          ├─ 診察メモ
          ├─ 検査値
          ├─ お薬
          ├─ 成長
          ├─ 日々の様子
          ├─ 受診予定
          └─ 質問
```

- 個人記録APIはFirebase AuthenticationのHttpOnlyセッションを必須とします。
- Firestore上で、ログイン中の利用者が対象家族のactiveなメンバーか確認します。
- 作成・編集・削除は`owner`または`editor`に限定します。
- 写真・動画・音声はGCSへ保存し、Firestoreへbase64本文を保存しません。
- 画像・音声の取得時にも、家族と健康記録対象の所属を確認します。
- APIはアラジール版で利用する経路だけを許可します。
- 更新系APIは同一オリジンを確認します。
- OCRにはアカウント単位・全体・同時実行数の制限があります。
- 検査値、画像本文、音声本文などの医療情報をアクセスログへ出さない方針です。

## AI・音声処理

- 検査値・お薬OCR: Gemini Developer API
- OCR主モデル: `gemini-3.1-flash-lite`
- OCRフォールバック: `gemini-3.5-flash`
- 診察音声: Google Cloud Speech-to-Text `asia-northeast1 / long / ja-JP`
- 診察内容の構造化: Gemini 3.1 Flash Lite

Vertex AIは使用していません。Gemini APIキーはSecret Managerの`DEV_GEMINI_API_KEY`からCloud Runへ渡し、ソースコードやデプロイ引数へ値を記載しません。

## ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `backend/` | Node.js + ExpressのAPI、静的画面、認証、Firestore/GCS、OCR、音声処理 |
| `backend/public/` | 利用者・家族向けWeb画面 |
| `backend/src/controllers/` | 家族、記録、集約画面などのAPI処理 |
| `backend/src/services/` | OCR、写真・動画・音声保存、診察メモ構造化 |
| `backend/tests/` | 単体・境界・安全性テスト |
| `scripts/` | Cloud Run上で一時テストデータを作成・削除するE2E |
| `docs/specs/20260624-expansion/` | 要件定義、機能設計、UI仕様、実装棚卸し |
| `design/` | 採用したUI方針、コンポーネント、デザインシステム |
| `images/` | UI検討画像、ブランドシート、生成プロンプト、採用素材 |
| `dashboard/` | 管理画面の参照実装。現在の患者・家族向けCloud Run配信対象外 |
| `archive/` | 現在使っていないデプロイ・検証手順の退避先 |

## ローカル開発

### 1. 依存関係

```powershell
cd C:\Users\green\Projects\medicanvas\yorisoi\patient\yorisoi-alagille-lineworks\backend
npm install
```

### 2. 環境変数

設定例は`backend/.env.example`にあります。実際の値は`backend/.env`または`secure/`へ置き、Gitへ追加しません。

ローカルで画面とサンプル動作を確認する最小設定例です。

```powershell
$env:PORT="8082"
$env:PROJECT_ID="yorisoi-dev-477515"
$env:FIRESTORE_DATABASE_ID="alagille-local"
$env:GCS_BUCKET="dummy-alagille-local-bucket"
$env:DEFAULT_TENANT_ID="alagille-family"
$env:DEMO_MODE="1"
$env:AUTH_REQUIRED="0"
$env:ALAGILLE_API_MODE="1"
$env:LAB_OCR_MODE="sample"
npm run dev
```

### 3. 主な画面

- `http://localhost:8082/`
- `http://localhost:8082/lab-tracker.html?disease=alagille`
- `http://localhost:8082/medications.html?disease=alagille`
- `http://localhost:8082/daily-logs.html?disease=alagille`
- `http://localhost:8082/questions.html?disease=alagille`
- `http://localhost:8082/simple/record.html?disease=alagille`
- `http://localhost:8082/simple/growth.html?disease=alagille`
- `http://localhost:8082/simple/calendar.html?disease=alagille`
- `http://localhost:8082/simple/album.html?disease=alagille`
- `http://localhost:8082/simple/show.html?disease=alagille`
- `http://localhost:8082/simple/help.html?disease=alagille`

## テスト

単体・認可境界・API許可リスト・同一オリジン・OCR制限をまとめて実行します。

```powershell
cd backend
npm test
```

Cloud Run用E2Eは、専用の一時アカウントと架空データを作り、確認後にFirestore・GCS・Firebase Authenticationから削除します。

```powershell
.\scripts\e2e-account-ocr.ps1
.\scripts\e2e-visit-recording.ps1
.\scripts\e2e-daily-logs.ps1
.\scripts\e2e-planning.ps1
.\scripts\e2e-overview.ps1
.\scripts\e2e-photo-album.ps1
```

E2Eの実行には、対象GCP/Firebase環境へアクセスできる認証と権限が必要です。実在する患者情報や検査画像は使用しません。

## Cloud Runへのデプロイ

デプロイ前に対象サービスと設定を確認します。

```powershell
.\deploy.ps1 -DryRun
```

現在の設定でデプロイします。

```powershell
.\deploy.ps1
```

`deploy.ps1`は、次の専用リソースへデプロイします。

- service: `yorisoi-alagille`
- region: `asia-northeast1`
- runtime service account: `yorisoi-alagille-run@yorisoi-dev-477515.iam.gserviceaccount.com`
- Firestore database: `yorisoi-alagille`
- GCS bucket: `yorisoi-dev-477515-yorisoi-alagille-files`
- maximum instances: `1`
- `DEMO_MODE=0`
- `AUTH_REQUIRED=1`
- `ALAGILLE_API_MODE=1`
- `LAB_OCR_MODE=gemini`

Cloud Runサービス自体は公開URLですが、個人記録APIはログインと家族所属を必須とします。

## Gitに含めないもの

次のファイルは`.gitignore`で除外します。

- `.env`、`.env.*`
- `secure/`
- `sa-key.json`
- `deploy_env.yaml`
- `*.pem`、`*.key`
- `node_modules/`
- ローカルデータ、ログ、生成物

秘密情報をコミットした疑いがある場合は、値を削除するだけでなく、対象キーを失効・再発行してください。

## 本運用前に確定・確認すること

- LINE WORKSアカウント連携、Bot、通知、リマインド
- 正式な保存期間、費用、利用規約、退会時のデータ処理
- 問い合わせ窓口と運用責任者
- 家族招待を別アカウントで受ける一連の実機確認
- 実会話での録音許諾、長時間録音、中断復帰、再試行
- 実写真・実動画を使ったスマホでの選択・再生・表示
- 「先生に見せる」の印刷プレビューと実際の診察に適した文量

詳細な要件と現在地は、[要件・設計ドキュメント](docs/specs/20260624-expansion/README.md)と[Cloud Run実装棚卸し](docs/specs/20260624-expansion/06-cloud-run-readiness-inventory-20260712.md)を参照してください。
