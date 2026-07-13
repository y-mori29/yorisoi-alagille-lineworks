# よりそい アラジール 2026-06-24追加要望後 仕様ドキュメント一式

作成日: 2026-06-26  
対象リポジトリ: `medicanvas/yorisoi/patient/yorisoi-alagille-lineworks`  
対象: アラジール症候群のお子さん・ご家族向け「よりそい」LINE WORKS版  
次回デモ目標: 2026-07-15（水）10:30

---

## このフォルダの目的

2026-06-24（水）10:30のミーティングで、既存MVPに対して大きな要望追加があった。  
このフォルダは、次セッション・別担当者が前提を知らなくても開発を引き継げるように、要件、設計、UI/UX、実装順をまとめた正本である。

今回の前提は、単なる「3ボタンLINE版の機能追加」ではない。  
このアプリは、アラジール症候群のご家族が、LINE WORKS会員環境から開き、診察・成長・検査・薬・日々の様子を家族で残し、必要な記録だけを診察時に見せるための家族ノートである。

---

## 読む順番

1. [01-requirements-definition.md](01-requirements-definition.md)  
   何を作るか、誰のためか、優先度は何かを確認する。

2. [02-functional-design.md](02-functional-design.md)  
   データモデル、API、機能ごとの処理、既存実装との差分を確認する。

3. [03-ui-ux-specification.md](03-ui-ux-specification.md)  
   画面構成、ホーム導線、各機能画面、文言、トンマナを確認する。

4. [04-implementation-roadmap.md](04-implementation-roadmap.md)  
   2026-07-15（水）10:30の次回デモに向けて、どの順で実装するかを確認する。

5. [05-development-handoff.md](05-development-handoff.md)  
   別セッションで開発を再開するための最短引き継ぎメモを確認する。

6. [06-cloud-run-readiness-inventory-20260712.md](06-cloud-run-readiness-inventory-20260712.md)  
   実装済み・端末内保存・未実装を分け、Cloud Runまでの順序を確認する。

---

## 今回の仕様変更の要点

6/24以前のMVPは、主に以下を見せるためのものだった。

- 診察メモ
- 成長のきろく
- 写真アルバム
- 先生に見せる
- LINE WORKSからリンクで開く想定

6/24後は、以下を本格的に要件へ入れる必要がある。

- 検査結果を写真で撮り、OCRで数値化し、表・グラフで見返す
- お薬を写真・OCR・変更履歴として残す
- 日々の様子を写真・テキスト・動画で時系列に残す
- 父母など複数LINE WORKSアカウントで同じ家族ノートを共有する
- 一家族内に複数患者がいるケースへ対応する
- 「先生に見せる」画面を、診察メモ・検査・成長・薬・写真・日々の様子を集約する画面へ強化する
- クラウド保存、保存期間、料金、安全性、LINE WORKS利用についてQ&Aで説明する
- 受診リマインド、お薬リマインドをLINE WORKS制約確認後に検討する

---

## 参照元

- ミーティング文字起こし: `docs/meetings/20260624_アラジール症候群.md`
- ミーティング整理: `docs/meetings/yorisoi-alagille-feedback-and-implementation-plan-20260624.md`
- 6/24以前の残タスク: `docs/alagille-remaining-tasks-and-presentation.md`
- 6/24以前の初期実装計画: `.plans/active/2026-06-21-yorisoi-alagille-lineworks-new-repo-impl-plan.md`
- UI方向性: `docs/alagille-navigation-and-design-options-20260623.md`
- 追加ブランド/UI画像: `images/alagille-brand-ui-refresh-20260626/`

---

## 開発上の重要注意

- `yorisoi-3button-line` とは別リポジトリとして扱う。
- 3ボタンLINE版の画面や文言に戻さない。
- 汎用医療ダッシュボードではなく、母子手帳・家族ノートのUIにする。
- 検査値・薬・日々の様子は、写真アルバム内カテゴリだけでなく、ホーム上の独立導線として扱う。
- 要配慮情報はLINE WORKSトーク本文に出しすぎず、Webアプリ内で確認する。
- 医学的判断や診断を行う画面にしない。表現は「記録」「見返し」「診察で伝える補助」に寄せる。
- LINE WORKSのBot、固定メニュー、通知、リマインドは、LINE公式アカウント/LIFFと同じ前提で進めず、LINE WORKSの仕様確認後に実装する。
