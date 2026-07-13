# 機能・データ・API設計仕様書

作成日: 2026-06-26  
対象: よりそい アラジール 2026-06-24追加要望反映版

---

## 1. 現行実装の前提

対象リポジトリは `medicanvas/yorisoi/patient/yorisoi-alagille-lineworks`。  
Node.js + Express の `backend/` がAPIと静的画面を提供している。

現行で使える主なAPI:

- `GET /api/clinics`
- `POST /api/clinics`
- `GET /api/visits`
- `POST /api/visits`
- `GET /api/timeline`
- `POST /api/timeline`
- `POST /api/ai/parse-record`
- `POST /api/ai/transcribe`
- `POST /api/ai/chat-record`
- `POST /api/encounters`
- `GET /api/encounters`
- `POST /api/visit-notes`
- `GET /api/visit-notes`
- `POST /api/recordings/init`
- `POST /api/recordings/sign-upload`
- `POST /api/recordings/:recordingId/finalize`

現行でスタブになっている重要API:

- `GET /api/medications` は空配列
- `GET /api/labs` は空配列

今回の追加要望では、この2領域を本実装化する必要がある。

---

## 2. データモデル全体

今回の拡張では、LINE WORKS userId 直結ではなく、`family` と `patient` を分ける。

```text
families/{familyId}
  tenantId
  displayName
  createdAt
  updatedAt
  primaryContactMemberId
  lineWorksScope

families/{familyId}/members/{memberId}
  familyId
  lineWorksUserId
  displayName
  relationship: "mother" | "father" | "self" | "grandparent" | "other"
  role: "owner" | "editor" | "viewer"
  status: "active" | "invited" | "removed"
  joinedAt
  invitedBy

families/{familyId}/patients/{patientId}
  familyId
  tenantId
  displayName
  birthDate
  sex
  relationshipLabel
  diseaseId: "alagille"
  active
  createdAt
  updatedAt
  futureHandoff

families/{familyId}/patients/{patientId}/records/{recordId}
  recordType
  sourceType
  title
  occurredAt
  createdByMemberId
  visibility
  linkedRecordIds[]
  createdAt
  updatedAt
```

現行実装は `patients/{patientId}/...` を中心にしているため、7/15デモまでの段階では次のどちらかを選ぶ。

### 推奨: 段階移行

1. 既存 `patients/{patientId}` は維持する
2. `familyId` と `familyMemberId` を患者doc・記録docに追加する
3. 将来 `families/{familyId}/patients/{patientId}` へ移行できるよう、API層では `familyId + patientId` を受ける

これにより、既存画面を壊さず家族共有と患者切替を追加しやすい。

---

## 3. 共通フィールド

すべての記録に共通して、以下を持たせる。

```text
tenantId
familyId
patientId
createdByMemberId
createdByLineWorksUserId
occurredAt
createdAt
updatedAt
recordType
sourceType
visibility: "family" | "creator" | "doctor-view"
tags[]
attachments[]
```

`recordType` の候補:

- `visit-note`
- `lab-result`
- `medication`
- `growth`
- `daily-log`
- `photo`
- `video`
- `appointment`

`sourceType` の候補:

- `voice`
- `manual`
- `photo-ocr`
- `photo`
- `video`
- `import`

---

## 4. 家族共有

### 4-1. 目的

母が前回診察で残した記録を、父が次回診察時に同じように見られるようにする。

### 4-2. 必要API

```text
GET  /api/family/current
POST /api/family
GET  /api/family/members
POST /api/family/invitations
POST /api/family/invitations/:token/accept
PATCH /api/family/members/:memberId
DELETE /api/family/members/:memberId
```

### 4-3. MVP実装

7/15デモでは、本物のLINE WORKS認証が未確定でも以下で見せられる。

- デモ用 `familyId` を作る
- お母さん・お父さんの2メンバーを用意する
- 招待リンクUIを表示する
- 同じ患者記録が両者から見えることを示す

### 4-4. 権限

初期は単純でよい。

- `owner`: 家族設定、患者追加、メンバー招待、削除ができる
- `editor`: 記録追加・編集ができる
- `viewer`: 見るだけ

---

## 5. 患者切り替え

### 5-1. 目的

遺伝性疾患のため、親子・兄弟姉妹で複数患者がいるケースに対応する。

### 5-2. 必要API

```text
GET  /api/family/patients
POST /api/family/patients
GET  /api/family/patients/:patientId
PATCH /api/family/patients/:patientId
```

### 5-3. 画面/状態

ホーム上部に現在の患者を表示する。

```text
はるくん  6歳
切り替え
```

患者を切り替えると、診察メモ、検査、薬、成長、日々の様子、先生に見せる対象が切り替わる。

### 5-4. 実装注意

記録作成時に `patientId` が空のまま保存されないようにする。  
録音開始時、写真保存時、OCR保存時、成長記録保存時、すべて対象患者を確定してから保存する。

---

## 6. 診察メモ

### 6-1. 現行利用

現行の録音・文字起こし・AI整理は活かす。

関連API:

- `POST /api/recordings/init`
- `POST /api/recordings/sign-upload`
- `POST /api/recordings/:recordingId/finalize`
- `POST /api/ai/transcribe`
- `POST /api/ai/parse-record`
- `POST /api/encounters`
- `GET /api/encounters`

### 6-2. 追加する整理項目

アラジール版では、AI要約の構造を次に寄せる。

```text
summary
doctorSaid[]
nextQuestions[]
medicationChanges[]
labAndTestTopics[]
growthNutritionTopics[]
dailyLifeTopics[]
departments[]
```

### 6-3. 禁止

- 会話にない薬名・検査値・診断をAIが補完しない
- 医学的判断を断定しない

---

## 7. 検査値

### 7-1. データモデル

```text
labResults/{labResultId}
  tenantId
  familyId
  patientId
  occurredAt
  facilityName
  department
  testType: "blood" | "echo" | "ecg" | "other"
  sourceImagePath
  sourceThumbnailPath
  ocrStatus: "pending" | "review_required" | "confirmed" | "failed"
  items[]
  memo
  createdByMemberId
  createdAt
  updatedAt

items[]
  itemId
  label
  rawLabel
  value
  unit
  referenceRangeText
  normalizedKey
  confidence
  manuallyEdited
```

初期プリセット:

- AST
- ALT
- γ-GTP
- ALP
- 総ビリルビン
- 直接ビリルビン
- アルブミン
- PT-INR

### 7-2. 必要API

```text
GET  /api/labs
POST /api/labs
GET  /api/labs/:labResultId
PATCH /api/labs/:labResultId
DELETE /api/labs/:labResultId
POST /api/labs/ocr
POST /api/labs/:labResultId/confirm
GET  /api/labs/trends?item=ast
```

### 7-3. OCRフロー

```text
写真を撮る
  ↓
画像を保存
  ↓
OCRで項目/値/単位/基準値を抽出
  ↓
ユーザーが確認・修正
  ↓
確定保存
  ↓
表とグラフへ反映
```

### 7-4. グラフ仕様

- 検査項目ごとに折れ線表示
- 欠損値は線を無理に補完しない
- 同じ項目名の表記ゆれは `normalizedKey` で吸収する
- 医学的アラートは初期実装では行わない

---

## 8. お薬メモ

### 8-1. データモデル

```text
medications/{medicationId}
  tenantId
  familyId
  patientId
  name
  rawOcrText
  dosageText
  timingText
  status: "active" | "stopped" | "unknown"
  startedAt
  stoppedAt
  sourceImagePath
  sourceThumbnailPath
  memo
  createdByMemberId
  createdAt
  updatedAt

medicationLogs/{logId}
  medicationId
  patientId
  checkedAt
  status: "taken" | "skipped" | "unknown"
  createdByMemberId
```

### 8-2. 必要API

```text
GET  /api/medications
POST /api/medications
GET  /api/medications/:medicationId
PATCH /api/medications/:medicationId
DELETE /api/medications/:medicationId
POST /api/medications/ocr
POST /api/medications/:medicationId/checks
GET  /api/medications/history
```

### 8-3. 注意

薬剤マスタは空でもよい。  
AIやマスタから一般治療薬を勝手に補完しない。  
「診察で出た薬」「家族が撮影した薬」だけを記録する。

---

## 9. 成長記録

### 9-1. データモデル

```text
growthRecords/{growthRecordId}
  tenantId
  familyId
  patientId
  measuredAt
  heightCm
  weightKg
  headCircumferenceCm
  memo
  source: "manual" | "visit" | "import"
  createdByMemberId
  createdAt
  updatedAt
```

### 9-2. 必要API

```text
GET  /api/growth-records
POST /api/growth-records
PATCH /api/growth-records/:growthRecordId
DELETE /api/growth-records/:growthRecordId
GET  /api/growth-records/trends
```

### 9-3. 表示

- 最新身長
- 最新体重
- 前回との差
- 身長グラフ
- 体重グラフ
- メモ
- 注意文: 「診断ではなく、受診時に見返す補助です」

---

## 10. 日々の様子

### 10-1. データモデル

```text
dailyLogs/{dailyLogId}
  tenantId
  familyId
  patientId
  occurredAt
  category: "skin" | "stool" | "itch" | "meal" | "movement" | "other"
  title
  memo
  media[]
  createdByMemberId
  createdAt
  updatedAt

media[]
  mediaType: "photo" | "video"
  storagePath
  thumbnailPath
  durationSec
  contentType
```

### 10-2. 必要API

```text
GET  /api/daily-logs
POST /api/daily-logs
GET  /api/daily-logs/:dailyLogId
PATCH /api/daily-logs/:dailyLogId
DELETE /api/daily-logs/:dailyLogId
POST /api/media/sign-upload
```

### 10-3. 動画

7/15デモでは、動画はUIとモック保存でもよい。  
本番実装では次を決める。

- 最大秒数
- 最大容量
- 圧縮
- サムネイル生成
- 保存期間
- 費用説明

---

## 11. 先生に見せる

### 11-1. 集約データ

```text
doctorView
  patient
  selectedRange
  visitNotes[]
  labSummary
  growthSummary
  medications[]
  dailyLogs[]
  photos[]
  nextQuestions[]
```

### 11-2. 必要API

```text
GET  /api/doctor-view
POST /api/doctor-view/preview
POST /api/doctor-view/export
```

### 11-3. 表示方針

- 初期表示は「今日見せたいこと」
- チェックで含める/外すを選べる
- コピー
- 印刷
- 診療科別/日付別の整理

---

## 12. Q&A・ヘルプ

### 12-1. 必要画面

`/simple/help.html` または `/resources.html` とは別に、アプリ利用Q&Aを追加する。

### 12-2. 表示項目

- どこに保存されますか
- スマホ容量は使いますか
- どれくらい残りますか
- 費用はかかりますか
- 家族で共有できますか
- 先生に見せてもよいですか
- LINE WORKS以外から使えますか
- 医学的判断ですか

---

## 13. LINE WORKS連携

### 13-1. 初期

リンク起動。

```text
LINE WORKS掲示板/トーク/案内画像
  ↓
よりそいを開く
  ↓
Webアプリ
```

### 13-2. 次段階

- Bot
- 固定メニュー
- URI action
- 定時通知
- 受診リマインド
- お薬リマインド

### 13-3. 未確認

LINE WORKS無料プラン相当でどこまで使えるか。  
LINE公式アカウントのLIFF前提で進めないこと。

---

## 14. 既存実装との差分一覧

| 領域 | 現状 | 必要な変更 |
| --- | --- | --- |
| ホーム | 診察メモ/成長/写真/先生に見せる中心 | 検査値、お薬、日々の様子、患者切替を追加 |
| 検査値 | `GET /api/labs` が空配列 | OCR、保存、表、グラフAPIを追加 |
| お薬 | `GET /api/medications` が空配列 | 写真/OCR/一覧/変更履歴/チェックを追加 |
| 成長 | 画面モック中心 | 登録/一覧/更新/削除APIを追加 |
| 日々の様子 | 補助ページあり | 写真/動画/時系列ログAPIを追加 |
| 家族共有 | 未実装 | family/member/invitationを追加 |
| 患者切替 | 未実装 | family配下patient一覧と切替状態を追加 |
| 先生に見せる | 画面あり | 検査/薬/日々/成長を集約する構造へ拡張 |
| Q&A | 一部説明のみ | 保存/費用/容量/安全性のFAQを追加 |

---

## 15. 実装時の検証

- `node --check` でJS構文確認
- HTML内 `<script>` の構文確認
- 静的hrefリンク切れ確認
- ローカルHTTP 200確認
- スマホ幅スクリーンショット確認
- 検査値OCRは、成功例・読み取り修正例・失敗例を確認
- 家族共有は、母/父の両方で同じ患者記録が見えることを確認
- 患者切替は、患者A/Bで記録が混ざらないことを確認
