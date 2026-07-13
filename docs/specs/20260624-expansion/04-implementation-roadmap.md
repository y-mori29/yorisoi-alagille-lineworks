# 実装ロードマップ・開発タスク

作成日: 2026-06-26  
対象: よりそい アラジール 2026-06-24追加要望反映版  
次回デモ目標: 2026-07-15（水）10:30

---

## 1. 開発方針

2026-07-15（水）10:30の次回デモでは、完成品ではなく「追加要望を受けた実用プロトタイプ」を見せる。  
ただし、単なる画像や静的画面ではなく、主要な記録が保存・表示・集約される流れをできるだけ動かす。

優先順位:

1. 家族/患者の土台
2. 検査値・お薬の本実装入口
3. 成長・日々の様子の記録化
4. 先生に見せる集約
5. Q&A
6. LINE WORKS制約確認

---

## 2. フェーズ構成

## フェーズA: 仕様固定・現行棚卸し

目的: 開発に入る前に、6/24追加要望を正本にする。

タスク:

- [x] 要件定義書作成
- [x] 機能/データ/API設計書作成
- [x] UI/UX仕様書作成
- [x] 開発引き継ぎ作成
- [ ] 現行HTML/JS/APIのリンク切れ再チェック
- [x] 現行スタブ・未接続画面を `06-cloud-run-readiness-inventory-20260712.md` に整理

完了条件:

- 次セッション担当者がこのフォルダを読めば作業に入れる

---

## フェーズB: 家族・患者切り替え

目的: 以後のすべての記録を、家族ID・患者IDに紐づけられるようにする。

タスク:

- [x] `family` / `member` / `patient` のデモデータを作る
- [x] `GET /api/family/current`
- [x] `GET /api/family/members`
- [x] `GET /api/family/patients`
- [x] `POST /api/family/patients`
- [x] ホームに患者セレクタを追加
- [x] 成人男性・成人女性・男の子・女の子の4アバターを選べるようにする
- [x] 家族メンバー一覧と権限表示を実装
- [x] `POST /api/family/invitations` と招待コード・リンク発行UIを実装
- [ ] 全記録作成APIに `familyId` / `patientId` / `createdByMemberId` を渡す（検査値は `familyId` / `patientId` 対応済み）
- [ ] 既存 `patients/{patientId}` 構造との互換を保つ

画面:

- ホーム
- 設定/家族共有
- 患者切り替えシート

検証:

- 母メンバーで作った記録を父メンバーで見られる
- 患者A/Bの記録が混ざらない

---

## フェーズC: 検査値

目的: 6/24で最重要要望だった検査結果OCR・表・グラフをデモできるようにする。

タスク:

- [x] `labResults` データモデル実装
- [x] `GET /api/labs`
- [x] `POST /api/labs`
- [x] `PATCH /api/labs/:id`
- [x] `DELETE /api/labs/:id`
- [x] `POST /api/labs/ocr`
- [x] `GET /api/labs/trends`
- [x] `GET /api/labs/tutorial`（本番記録と完全分離）
- [x] `lab-tracker.html` を静的補助ページから本導線へ格上げ
- [x] 検査結果撮影/アップロードUI
- [x] OCR結果確認・修正UI
- [x] 検査日を必須、病院名・診療科を任意にする（利用しない受付番号欄は削除）
- [x] 読み取り後も元画像を大きく表示し、全画面拡大できるようにする
- [x] 元画像との確認チェックを保存前の必須操作にする
- [x] 小児の年齢別基準範囲、H（赤）/L（青）をサンプル用紙とOCR結果で一致させる
- [x] 保存済み記録の編集・削除UI
- [x] 表表示
- [x] グラフ表示
- [x] Gemini Developer APIによる実OCRとGCS画像保存のコードを実装
- [ ] Cloud Run上で実OCRとGCS保存を実画像で確認

デモ用の妥協:

- OCRは最初はサンプル画像または擬似OCRでもよい
- ただし、読み取り結果を確認・修正して保存する流れは見せる
- お試し用の履歴・今回値は本番保存APIへ送らず、お試し終了時に破棄する

検証:

- AST/ALT/γ-GTP/ALPのサンプル値が保存される
- 欠損項目がある検査回でもグラフが壊れない
- OCR失敗時に写真だけ残せる
- お試し終了後、本番一覧が0件へ戻りデモ値が混ざらない

---

## フェーズD: お薬メモ

目的: 薬の写真・名前・変更履歴を残せるようにする。

タスク:

- [x] `medications` データモデル実装
- [x] `GET /api/medications`
- [x] `POST /api/medications`
- [x] `PATCH /api/medications/:id`
- [x] `DELETE /api/medications/:id`
- [ ] `POST /api/medications/ocr`
- [x] `POST /api/medications/:id/checks`
- [x] `medications.html` を本導線へ格上げ
- [ ] 薬の写真追加UI
- [ ] 薬名OCR/確認UI
- [x] 現在のお薬一覧
- [x] 変更履歴
- [x] 追加・編集・削除UI
- [x] 任意の飲めたよチェック

検証:

- 薬名を手修正して保存できる
- 薬の写真と名前が先生に見せる画面へ出る
- AIが会話にない薬を勝手に追加しない

---

## フェーズE: 成長記録強化

目的: 既存の成長画面を、実際に身長・体重を登録できる画面へ進める。

タスク:

- [ ] `growthRecords` データモデル実装
- [ ] `GET /api/growth-records`
- [ ] `POST /api/growth-records`
- [ ] `PATCH /api/growth-records/:id`
- [ ] `GET /api/growth-records/trends`
- [ ] 入力欄を画面上部に明確化
- [ ] 前回との差分表示
- [ ] 身長/体重グラフ
- [ ] 注意文の表示

検証:

- 身長・体重を登録できる
- 最新値と前回との差が変わる
- 先生に見せる画面へ反映される

---

## フェーズF: 日々の様子

目的: 皮膚、便の色、かゆみ、動きなどを時系列で残せるようにする。

タスク:

- [ ] `dailyLogs` データモデル実装
- [ ] `GET /api/daily-logs`
- [ ] `POST /api/daily-logs`
- [ ] `PATCH /api/daily-logs/:id`
- [ ] `symptom-log.html` を「日々の様子」へ整理
- [ ] 写真追加UI
- [ ] 動画追加UI
- [ ] カテゴリ選択
- [ ] タイムライン表示
- [ ] 写真アルバムとの連動

デモ用の妥協:

- 動画はモックサムネイルまたは短いアップロードUIだけでも可
- 本番保存上限は次段階で確定

検証:

- 皮膚/便の色/動画/食事などが時系列に並ぶ
- 写真画面にも表示される

---

## フェーズG: 先生に見せる強化

目的: 「何が集まるのか分かりづらい」という6/24の反応を解消する。

タスク:

- [ ] `GET /api/doctor-view`
- [ ] 先生に見せる画面に集約カードを追加
- [ ] 診察メモ
- [ ] 検査値
- [ ] 成長
- [ ] お薬
- [ ] 日々の様子
- [ ] 写真
- [ ] 次に聞きたいこと
- [ ] 含める/外すチェック
- [ ] コピー
- [ ] 印刷

検証:

- 各記録種別からデータが集まる
- チェックを外すと表示から外れる
- 印刷プレビューで大きく崩れない

---

## フェーズH: Q&A・ヘルプ

目的: 保存期間・容量・料金・安全性の不安に答える。

タスク:

- [ ] Q&A画面作成
- [ ] 設定画面からQ&Aへ導線
- [ ] ホーム下部または先生に見せる画面からも導線
- [ ] 保存先説明
- [ ] 容量説明
- [ ] 長期保存説明
- [ ] 費用説明
- [ ] 安全性説明
- [ ] 医学的判断ではない説明

検証:

- 会員向け説明にそのまま使える文言になっている

---

## フェーズI: LINE WORKS制約確認

目的: 実装前にLINE WORKSの実現可能性を確認する。

確認項目:

- [ ] LINE WORKSから外部Webアプリリンクを自然に開けるか
- [ ] 固定メニュー/リッチメニュー相当が使えるか
- [ ] URI actionが使えるか
- [ ] Botから定時通知できるか
- [ ] 無料プラン相当で通知制限があるか
- [ ] Bot送信上限
- [ ] 会員限定運用での認証/ユーザーID取得

成果物:

- `docs/lineworks-mvp-routing.md` を更新
- 必要なら `docs/lineworks-reminder-feasibility.md` を新規作成

現時点の判断（2026-07-12）:

- 外部LINE/LINE WORKS紐づけはCloud Run初回デプロイの必須条件にしない
- まずCloud Run URLでWebアプリ本体を完成・検証し、そのURLを外部導線から開く接続は次段階にする
- 検査結果OCRはVertex AIを使用せず、Gemini Developer APIをSecret ManagerのAPIキーで直接利用する

---

## フェーズJ: Cloud Run初回デプロイ

目的: 外部LINE紐づけ前に、家族がWebアプリとして操作できる検証環境を用意する。

タスク:

- [ ] 未実装画面を優先順にAPI保存へ接続
- [x] Firestore/GCS/実OCR環境変数とSecret参照を確定
- [x] Firebase Authenticationと家族member単位の認証認可を実装
- [x] Cloud BuildによるDockerビルドとCloud Run起動確認
- [x] 架空データE2Eでアカウント登録・患者分離・家族共有・実OCR・保存削除をCloud Run上で確認
- [ ] ログ・エラー表示・データ削除手順を確認

2026-07-13 初回デプロイ:

- service: `yorisoi-alagille`
- revision: `yorisoi-alagille-00001-cqj`
- traffic: 100%
- URL: `https://yorisoi-alagille-hj2kuu4pda-an.a.run.app`
- `DEMO_MODE=1`、`LAB_OCR_MODE=sample`、Gemini Secret未接続、最大1インスタンス
- `/health`、ホーム、家族、検査、薬は200。旧患者APIと録音APIは403
- Chrome視覚QA、実Gemini OCR、GCS実保存は未確認

2026-07-13 認証・実OCR更新:

- revision: `yorisoi-alagille-00002-rkz`、traffic 100%
- `DEMO_MODE=0`、`AUTH_REQUIRED=1`、`ALAGILLE_API_MODE=1`
- Firebase Authenticationのメール登録を、HttpOnlyセッションCookieへ交換
- family memberの `owner` / `editor` / `viewer` をAPIで照合
- `LAB_OCR_MODE=gemini`、Secret Manager `DEV_GEMINI_API_KEY` を参照
- 主モデル `gemini-3.1-flash-lite`、fallback `gemini-3.5-flash`
- 架空用紙の自動E2Eで8項目OCR、Firestore検査保存、GCS画像保存、招待家族からの共有閲覧、削除を確認
- 別サービス `yorisoi-alagille-ocr-check` 案は撤回し、旧スクリプトは `archive/deployment/` へ退避

詳細: `06-cloud-run-readiness-inventory-20260712.md`

---

## 3. 2026-07-15（水）デモの推奨順

1. LINE WORKSから開く想定のホーム
2. 家族共有と患者切り替え
3. 診察メモを録音して要約
4. 検査値を写真/OCR/表/グラフで確認
5. お薬メモ
6. 成長記録
7. 日々の様子
8. 先生に見せる
9. Q&A
10. LINE WORKS導線と今後のリマインド

---

## 4. 実装時に避けること

- 先にUIだけ増やして、保存先や患者IDが決まっていない状態にする
- 検査値・薬を写真アルバム内だけに閉じ込める
- 家族共有なしでLINE WORKS userIdだけに記録を紐づける
- 医療判断に見える色や文言を使う
- LINE公式アカウントの仕様をLINE WORKSにそのまま当てはめる
- 生成済みUI画像をそのまま切り貼りして実装する

---

## 5. 最低限のQA

### 静的

- HTMLリンク切れなし
- JS構文エラーなし
- 主要APIが200/201を返す
- 404ページが主導線にない

### データ

- 患者A/Bの記録が混ざらない
- 家族メンバーA/Bで同じ家族記録が見える
- 検査値の欠損がグラフを壊さない
- 薬名OCR失敗時に手修正できる

### UI

- スマホ幅で文字が切れない
- 下部ナビとコンテンツが重ならない
- 写真グリッドが固定サイズ
- 先生に見せる画面が診察時に読める

---

## 6. デモ後に回すもの

- 本人への引き継ぎの詳細同意設計
- LINE WORKS本番Bot/通知
- 動画保存上限と圧縮
- 医師研究会向け資料
- 他患者会向け汎用化
- 会員向け説明動画
