# アラジール版 最終UI画像パック 20260628

作成日: 2026-06-28  
生成方法: built-in `image_gen`  
保存先: `images/alagille-final-ui-pack-20260628/output/`

## 目的

2026-06-28時点で合意した `01-integrated-home-final-candidate.png` を中心に、仕様書・UI設計書・画面遷移マップ・実装素材・7/15デモ説明に使う画像を追加生成した。

このパックは、明日以降のUI Translation Kit実装に入る前の「見た目と説明の正本候補」である。文字・ボタン・カード・ナビはHTML/CSSで再構築し、画像は参照または単体アセットとして扱う。

## 前提にした正本

- `docs/design/20260628-canonical-ui-brief.md`
- `docs/design/20260628-screen-flow-and-image-plan.md`
- `images/alagille-home-designs-20260627/screens/01-integrated-home-final-candidate.png`
- `docs/specs/20260624-expansion/`

## 生成画像一覧

| No | ファイル | 用途 | 扱い |
| --- | --- | --- | --- |
| 01 | `output/01-final-home-ui-spec-sheet.png` | 正本ホームUIの構造説明 | 説明・実装参照 |
| 02 | `output/02-screen-flow-map.png` | 画面遷移マップ | 説明・仕様参照 |
| 03 | `output/03-core-screens-overview-board.png` | 主要画面一覧 | 説明・実装参照 |
| 04 | `output/04-lineworks-onboarding-guide.png` | LINE WORKS初回ガイド | 説明・オンボーディング参照 |
| 05 | `output/05-family-share-patient-switch-guide.png` | 家族共有・患者切り替え | 説明・実装参照 |
| 06 | `output/06-lab-ocr-states-board.png` | 検査値OCRの成功/修正/失敗状態 | 状態設計参照 |
| 07 | `output/07-medication-states-board.png` | お薬メモの登録/継続/履歴 | 状態設計参照 |
| 08 | `output/08-daily-log-media-board.png` | 日々の様子の写真/動画/メモ | 状態設計参照 |
| 09 | `output/09-doctor-view-detail-board.png` | 先生に見せる画面の詳細 | 実装参照 |
| 10 | `output/10-qa-safety-cost-guide.png` | 保存・費用・安全性Q&A | 説明素材 |
| 11 | `output/11-reminder-notification-concept.png` | 受診/お薬リマインドの次段階案 | 将来構想素材 |
| 12 | `output/12-empty-success-error-states-assets.png` | 空状態・保存完了・読取待ちなど | 文字なしアセット候補 |
| 13 | `output/13-demo-storyboard-20260715.png` | 7/15デモの流れ | デモ説明素材 |
| 14 | `output/14-cut-ready-ui-object-assets.png` | UI小物モチーフ | 文字なしアセット候補 |
| 15 | `output/15-parent-child-hero-scenes-no-text.png` | 親子・家族シーン | 文字なしアセット候補 |
| 16 | `output/16-final-design-system-component-sheet.png` | 色・部品・状態のUIシート | 実装参照 |
| 17 | `output/17-growth-record-detail-board.png` | 成長記録の詳細 | 実装参照 |
| 18 | `output/18-photo-album-fixed-grid-board.png` | 写真アルバム3列固定グリッド | 実装参照 |
| 19 | `output/19-calendar-settings-family-note-board.png` | カレンダー・設定・家族ノート | 実装参照 |
| 20 | `output/20-doctor-view-print-desktop-board.png` | 先生に見せる印刷/PC表示 | 実装参照 |

## 目視確認メモ

代表確認済み:

- `01-final-home-ui-spec-sheet.png`: 正本ホームの構造説明として使える。
- `02-screen-flow-map.png`: 全体の導線説明として使える。
- `04-lineworks-onboarding-guide.png`: F案をガイド用途に発展できている。
- `06-lab-ocr-states-board.png`: 成功・修正・失敗の状態設計は使える。ただし、検査値の細かい文字は実装時に正しいテキストで再構築する。
- `12-empty-success-error-states-assets.png`: 文字なし状態アセットとして使いやすい。
- `16-final-design-system-component-sheet.png`: UI部品・色・状態の実装参照として使える。

## 推奨利用順

1. `docs/design/20260628-canonical-ui-brief.md` を読む
2. `output/01-final-home-ui-spec-sheet.png` と `output/16-final-design-system-component-sheet.png` を見てホーム実装の基準にする
3. `output/02-screen-flow-map.png` で導線を確認する
4. `output/04-lineworks-onboarding-guide.png`、`output/05-family-share-patient-switch-guide.png` を説明素材・初回導線に使う
5. 機能実装時に `06`〜`10`、`17`〜`20` を参照する
6. 実装素材が必要なときは `12`、`14`、`15` を切り出し候補にする

## 注意

- 文字入り画像は、UI実装ではそのまま貼らない。
- 正式文言、検査値、薬名、日付、ボタン文言はHTML/CSS側で再構築する。
- `11-reminder-notification-concept.png` は次段階案であり、LINE WORKS仕様確認前の確定機能として扱わない。
- 医療判断に見える表現は避け、「診察で伝えるための記録補助」として実装する。
