---
date: 2026-06-23
tags: [yorisoi, alagille, lineworks, ui-qa, image-assets]
summary: アラジール症候群版の画面遷移修正、全体チェック、追加画像素材とUIデザイン案の整理
source: Codex 2026-06-23 goal run
related: [design-qa.md, docs/alagille-ui-asset-strategy.md]
---

# アラジール版 画面遷移QAと追加デザイン案

## 対応したこと

### 1. 画面遷移の修正

以下のリンク切れを確認し、遷移できるページを追加・修正した。

- `/medications.html`
- `/lab-tracker.html`
- `/symptom-log.html`
- `/restroom.html`
- `/resources.html`

また、文字化けとHTML崩れが出ていた `backend/public/simple/settings.html` を、アラジール版の設定画面として作り直した。

### 2. 共通JSの修正

`backend/public/js/liff-init.js` に文字化けしている表示文言が残っていたため、既存関数名を保ったまま、以下を日本語で安全に再実装した。

- `initLiff`
- `apiGet` / `apiPost` などAPIヘルパー
- `formatDate` / `formatYearMonth`
- `getBackHref`
- `renderMenuGrid`

### 3. 主要画面の作り直し

下部ナビでよく使う以下2画面を、文字化けなしのアラジール版UIへ置き換えた。

- `backend/public/simple/calendar.html`
- `backend/public/simple/show.html`

`calendar.html` は、次回受診カード、月カレンダー、最近の予定・メモを表示する。

`show.html` は、先生に見せる共有用まとめ、コピー、印刷、最近の診察メモを表示する。

### 4. 追加画像素材とUI案

保存先:

- `images/alagille-expansion-20260623/output/01-asset-sheet-24-items.png`
- `images/alagille-expansion-20260623/output/02-ui-a-outing-note.png`
- `images/alagille-expansion-20260623/output/03-ui-b-mother-child-handbook.png`
- `images/alagille-expansion-20260623/output/04-ui-c-visit-prep-timeline.png`

プロンプト保存先:

- `images/alagille-expansion-20260623/prompts/`

UI案の方向性:

- A案: おでかけ前ノート。現在のホームに近い、親子イラストと2x2カード中心。
- B案: 母子手帳ミニ。録音で診察メモを主役にしたコンパクトな母子手帳風。
- C案: 診察準備タイムライン。次回診察に向けた準備チェック中心。

## 確認結果

### リンク切れチェック

HTML/JS内の静的 `href` を確認し、存在しないリンクは0件。

### 構文チェック

- `backend/public/js/liff-init.js`: `node --check` OK
- 全HTMLのインラインscript: `new Function` 構文チェック OK

### HTTPチェック

以下すべて `200` を確認。

- `/?disease=alagille`
- `/simple/record.html?disease=alagille&intent=visit`
- `/simple/growth.html?disease=alagille`
- `/simple/album.html?disease=alagille`
- `/simple/calendar.html?disease=alagille`
- `/simple/show.html?disease=alagille`
- `/simple/settings.html?disease=alagille`
- `/medications.html?disease=alagille`
- `/lab-tracker.html?disease=alagille`
- `/symptom-log.html?disease=alagille`
- `/restroom.html?disease=alagille`
- `/resources.html?disease=alagille`

### スクリーンショット

保存先:

- `C:\Users\green\Projects\.tmp\alagille-nav-check\home.png`
- `C:\Users\green\Projects\.tmp\alagille-nav-check\calendar.png`
- `C:\Users\green\Projects\.tmp\alagille-nav-check\show.png`
- `C:\Users\green\Projects\.tmp\alagille-nav-check\settings.png`
- `C:\Users\green\Projects\.tmp\alagille-nav-check\medications.png`

## 残る注意

- 追加した補助ページは、まず404をなくし、画面遷移できることを優先したローカル保存版。将来、本格的にFirestore/APIへ接続する場合は別途設計する。
- `simple/clinics.html`、`simple/talk.html`、`simple/meal.html`、`simple/minimal.html` は今回の主導線からは外れている。リンク切れではないが、旧UI・旧文言が残っている可能性があるため、必要なら次のUI統一対象にする。
- UI案は検討用。実装する場合は、画面画像を貼るのではなく、単体素材 + HTML/CSSで再構築する。
