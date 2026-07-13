# 開発引き継ぎメモ

作成日: 2026-06-26  
対象: よりそい アラジール 2026-06-24追加要望反映版  
次回デモ目標: 2026-07-15（水）10:30

---

## 1. 最初に読むファイル

この順に読む。

1. `docs/specs/20260624-expansion/README.md`
2. `docs/specs/20260624-expansion/01-requirements-definition.md`
3. `docs/specs/20260624-expansion/02-functional-design.md`
4. `docs/specs/20260624-expansion/03-ui-ux-specification.md`
5. `docs/specs/20260624-expansion/04-implementation-roadmap.md`

補助として読む。

- `docs/meetings/20260624_アラジール症候群.md`
- `docs/meetings/yorisoi-alagille-feedback-and-implementation-plan-20260624.md`
- `docs/alagille-navigation-and-design-options-20260623.md`
- `README.md`
- `.plans/active/2026-06-21-yorisoi-alagille-lineworks-new-repo-impl-plan.md`

---

## 2. このリポジトリの前提

ここは `yorisoi-3button-line` とは別リポジトリ。  
3ボタンLINE版へ戻したり、3ボタンLINE版の仕様を混ぜたりしない。

対象フォルダ:

```text
C:\Users\green\Projects\medicanvas\yorisoi\patient\yorisoi-alagille-lineworks
```

主な構成:

```text
backend/
  server.js
  src/
    routes/
    controllers/
    config/
  public/
    index.html
    simple/
    lab-tracker.html
    medications.html
    symptom-log.html
  templates/alagille.json
  masters/alagille-medications.json
docs/
images/
```

---

## 3. 現状

### 実装済み

- アラジール版の独立リポジトリ
- アラジールテンプレート `backend/templates/alagille.json`
- 薬マスター枠 `backend/masters/alagille-medications.json`
- UIデザイン画像を翻訳したアラジール版ホーム
- 成人男性・成人女性・男の子・女の子の4アバター
- 記録する人の追加・切り替えUI/API
- 家族メンバー一覧・権限・招待コード/リンクUI/API
- 検査値の写真選択、擬似OCR、確認修正、保存、一覧、グラフ、編集、削除
- 架空の検査結果用紙を使う、本番記録と完全分離したお試しフロー
- 診察メモ
- 成長のきろく画面
- 写真アルバム画面
- カレンダー/先生に見せる画面
- 補助ページ
  - `lab-tracker.html`
  - `medications.html`
  - `symptom-log.html`
  - `resources.html`
  - `restroom.html`
- 画像素材と説明用UIシート

### スタブ/未実装

- `GET /api/medications` は空配列
- 成長記録APIなし
- 日々の様子APIなし
- 先生に見せる集約APIなし
- Q&A専用画面なし
- 実OCRサービス/GCS画像保存なし
- Cloud Run未デプロイ
- 外部LINE/LINE WORKS紐づけはCloud Run URL確定後の次段階

最新の棚卸しは `06-cloud-run-readiness-inventory-20260712.md` を正とする。

---

## 4. 6/24追加要望で最重要になったこと

特に重要な順。

1. 検査値  
   採血結果を写真/OCR/表/グラフで管理する。病院ごとのフォーマット差と、毎回ない検査項目に対応する。

2. お薬メモ  
   薬の写真と薬名OCRを残す。写真アルバム内カテゴリだけではなく、独立ボタンとして出す。

3. 家族共有  
   母のLINE WORKSアカウントで作った記録を、父のLINE WORKSアカウントでも見る。

4. 複数患者切り替え  
   親子・兄弟姉妹で複数患者がいるケースに対応する。

5. 日々の様子  
   皮膚、便の色、かゆみ、動きなどを写真・メモ・動画で時系列に残す。

6. 先生に見せる  
   診察メモ、検査、成長、薬、写真、日々の様子を集約する。

7. Q&A  
   保存、容量、料金、安全性を説明する。

---

## 5. 推奨する次の実装順

### Step 1: 家族/患者の土台（実装済み、各機能への適用継続）

先に `familyId` と `patientId` を固める。  
これを後回しにすると、検査値・薬・日々の様子の保存先を後で全修正することになる。

やること:

- デモ用 family/member/patient を作る
- 患者切り替えUIをホームへ入れる
- 既存APIに `familyId` / `patientId` を明示的に渡す

### Step 2: 検査値（擬似OCR版まで実装済み）

`/api/labs` を空配列から本実装へ進める。

やること:

- labResults保存
- OCRデモ
- 確認・修正
- 表
- グラフ

### Step 3: お薬（次に実装）

`/api/medications` を空配列から本実装へ進める。

やること:

- 薬写真
- OCRデモ
- 手修正
- 一覧
- 変更履歴

### Step 4: 成長・日々

成長は入力APIを作る。  
日々の様子は `symptom-log.html` を「日々の様子」へ再設計する。

### Step 5: 先生に見せる

各記録が揃い始めたら、まとめ画面へ集約する。

### Step 6: Q&A

デモ前に説明画面を用意する。

---

## 6. ローカル起動

```powershell
cd C:\Users\green\Projects\medicanvas\yorisoi\patient\yorisoi-alagille-lineworks\backend
$env:PORT="8082"
$env:FIRESTORE_DATABASE_ID="alagille-local"
$env:GCS_BUCKET="dummy-alagille-local-bucket"
$env:DEFAULT_TENANT_ID="alagille-family"
$env:DEMO_MODE="1"
npm run dev
```

確認URL:

```text
http://localhost:8082/?disease=alagille
http://localhost:8082/simple/record.html?disease=alagille
http://localhost:8082/lab-tracker.html?disease=alagille
http://localhost:8082/medications.html?disease=alagille
http://localhost:8082/simple/growth.html?disease=alagille
http://localhost:8082/symptom-log.html?disease=alagille
http://localhost:8082/simple/album.html?disease=alagille
http://localhost:8082/simple/show.html?disease=alagille
```

---

## 7. デザイン参照

本命:

- `images/alagille-brand-ui-refresh-20260626/06-brand-design-sheet-no-numbers.png`
- `images/alagille-brand-ui-refresh-20260626/07-ui-overview-sheet-no-numbers.png`

機能別:

- `images/alagille-brand-ui-refresh-20260626/03-lab-medication-ui-sheet.png`
- `images/alagille-brand-ui-refresh-20260626/04-growth-daily-record-ui-sheet.png`
- `images/alagille-brand-ui-refresh-20260626/05-family-share-doctor-help-ui-sheet.png`

注意:

- 生成画像をそのまま切り貼りしない
- 実装は単体素材 + HTML/CSS + フォントで再構築する
- 画面全体画像を貼ると、ヘッダーや文字切れなどの違和感が出る

---

## 8. 実装時の注意

### データ混在を防ぐ

すべての保存で `tenantId`、`familyId`、`patientId` を意識する。

### AI補完を防ぐ

薬名、検査値、症状をAIが勝手に補わない。  
会話、OCR、ユーザー入力に出たものだけを保存する。

### 医療判断にしない

検査値や成長グラフは「診断」ではなく「記録の見返し」。

### LINE WORKSを推測しない

LINE公式アカウントのLIFFとLINE WORKSは別物。  
Bot、通知、固定メニュー、URI actionは必ず仕様確認する。

---

## 9. 7/15デモの完成イメージ

次回は以下を一連で見せたい。

1. LINE WORKSから開く想定のホーム
2. 患者を切り替える
3. 診察メモを録音する
4. AI要約を見る
5. 検査結果を撮影/OCRし、表とグラフを見る
6. お薬を写真と名前で残す
7. 身長・体重を記録する
8. 日々の様子を写真・メモ・動画で残す
9. 先生に見せる画面でまとめる
10. Q&Aで保存・料金・安全性を説明する

---

## 10. 最初に着手するなら

次セッションで最初にやるべきこと:

1. `git status --short` で作業状態確認
2. `backend/src/controllers/patientDataController.js` の `listMedications` / `listLabs` が空配列であることを確認
3. `family/patient` のデモデータとAPI方針を決める
4. ホームに患者セレクタと検査値/お薬/日々の様子の主導線があるか確認
5. `GET /api/labs` と `GET /api/medications` の本実装から始める

この順番が、後戻りが少ない。
