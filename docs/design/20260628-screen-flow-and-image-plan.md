# 画面遷移マップ・追加画像生成計画 20260628

作成日: 2026-06-28  
対象: よりそい アラジール LINE WORKS版

## 目的

2026-06-28時点で固まった統合ホーム案を中心に、画面遷移、必要な機能画面、追加で生成すべき画像を整理する。

画像生成は重い作業なので、使用量リセット前に「実装・説明・デモで使う可能性が高い画像」を先に作っておく。

## 画面遷移マップ

```text
LINE WORKS案内・会員向けガイド
  ↓
初回ガイド
  ├─ 使い方を見る
  ├─ 患者を選ぶ
  └─ 家族共有を確認
      ↓
ホーム
  ├─ 今日のことを残す
  │   ├─ 録音で診察メモ
  │   └─ 日々の様子
  ├─ 検査・お薬を確認
  │   ├─ 検査値
  │   │   ├─ 撮影
  │   │   ├─ OCR確認・修正
  │   │   └─ 表・グラフ
  │   └─ お薬メモ
  │       ├─ 撮影
  │       ├─ 登録
  │       └─ 変更履歴
  ├─ 診察に持っていく
  │   ├─ 先生に見せる
  │   └─ 次に聞くこと
  ├─ 成長
  ├─ 写真
  ├─ カレンダー
  ├─ 家族ノート・患者切り替え
  └─ 設定/Q&A
```

## 追加生成する画像パック

保存先予定: `images/alagille-final-ui-pack-20260628/`

| 優先 | ファイル名 | 種類 | 用途 |
| --- | --- | --- | --- |
| 1 | `01-final-home-ui-spec-sheet.png` | UI仕様シート | 正本ホームの構造説明 |
| 1 | `02-screen-flow-map.png` | 画面遷移図 | 実装・説明の全体地図 |
| 1 | `03-core-screens-overview-board.png` | 主要画面一覧 | ホームから主要画面へのつながり |
| 1 | `04-lineworks-onboarding-guide.png` | 初回ガイド | F案の発展版 |
| 1 | `05-family-share-patient-switch-guide.png` | 共有/切替説明 | B案の発展版 |
| 1 | `06-lab-ocr-states-board.png` | 状態UI | OCR成功・修正・失敗 |
| 1 | `07-medication-states-board.png` | 状態UI | 登録・継続・変更履歴 |
| 1 | `08-daily-log-media-board.png` | 状態UI | 写真/動画/短いメモ |
| 1 | `09-doctor-view-detail-board.png` | 先生に見せる | C案の詳細版 |
| 1 | `10-qa-safety-cost-guide.png` | Q&A説明 | 保存・費用・安全性 |
| 2 | `11-reminder-notification-concept.png` | LINE WORKS次段階 | 受診/お薬リマインド候補 |
| 2 | `12-empty-success-error-states-assets.png` | 文字なしアセット | 空状態・保存完了・読取待ち |
| 2 | `13-demo-storyboard-20260715.png` | デモ説明 | 7/15の見せ方 |
| 2 | `14-cut-ready-ui-object-assets.png` | 文字なしアセット | 実装用小物素材 |
| 2 | `15-parent-child-hero-scenes-no-text.png` | 文字なしシーン | ガイド/空状態/説明資料用 |
| 2 | `16-final-design-system-component-sheet.png` | UI部品シート | 実装時の色・部品・状態 |
| 2 | `17-growth-record-detail-board.png` | 成長記録 | 身長・体重・推移の詳細 |
| 2 | `18-photo-album-fixed-grid-board.png` | 写真アルバム | 3列固定グリッドとカテゴリ |
| 2 | `19-calendar-settings-family-note-board.png` | カレンダー/設定 | 予定、家族共有、Q&A、引き継ぎ |
| 2 | `20-doctor-view-print-desktop-board.png` | 印刷/PC表示 | 診察まとめのスマホ・印刷・PC表示 |

## 画像生成時の共通プロンプト方針

- やさしい日本の水彩えほん風
- 母子手帳・家族ノートの安心感
- 温かい紙、ココアブラウンの線、ミント、コーラル、たんぽぽ色、空色
- 医療判断ではなく「記録補助」
- 文字が必要なUIボードは読みやすく、ただし実装時はHTML/CSSで再構築する
- アセット画像は文字なし、ロゴなし、UIスクリーンなし、切り出しやすく

## 生成後に確認すること

- 正本ホームの方針から外れていない
- 3ボタンLINE版や汎用医療ダッシュボードに戻っていない
- 家族共有、患者切り替え、LINE WORKS入口が説明しやすい
- 検査値・薬・成長・日々の様子が独立機能として見える
- 実装素材として使う画像は文字なしになっている

## 生成後の整理先

- `output/`: 画像本体
- `prompts/`: 生成時プロンプト
- `README.md`: 画像一覧、使い道、注意点
