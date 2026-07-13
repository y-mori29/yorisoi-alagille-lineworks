# 生成プロンプト要約 20260628

実行方法: built-in `image_gen`  
共通トーン: やさしい日本の水彩えほん風、母子手帳・家族ノート、温かい紙、ココアブラウン線、ミント/コーラル/たんぽぽ色/空色、医療判断ではなく記録補助。

## 共通制約

- 汎用医療ダッシュボードにしない
- 3ボタンLINE版に戻さない
- 公式LINE WORKSロゴをコピーしない
- 医療判断、診断、強い赤色警告を避ける
- 文字入りUI画像は参照用。実装時はHTML/CSSで再構築する
- アセット画像は文字なし、ロゴなし、切り出しやすくする

## 個別プロンプトの要約

| No | ファイル | 主要指示 |
| --- | --- | --- |
| 01 | `01-final-home-ui-spec-sheet.png` | 正本ホームの大きなスマホ画面と、ヘッダー/家族共有/3エリア/最近の変化/成長予定/下部ナビの注釈 |
| 02 | `02-screen-flow-map.png` | LINE WORKS案内からホーム、各機能、Q&A/設定までの水彩画面遷移図 |
| 03 | `03-core-screens-overview-board.png` | ホーム、検査値、お薬、日々、先生に見せる、Q&Aの6画面一覧 |
| 04 | `04-lineworks-onboarding-guide.png` | F案を発展させた、LINE WORKSから開く4ステップ初回ガイド |
| 05 | `05-family-share-patient-switch-guide.png` | 現在の患者、切り替え、家族ノート、招待/権限の4状態 |
| 06 | `06-lab-ocr-states-board.png` | 検査値OCRの成功、確認修正、失敗しても写真保存の3状態 |
| 07 | `07-medication-states-board.png` | お薬撮影、現在のお薬、飲み方メモ、変更履歴 |
| 08 | `08-daily-log-media-board.png` | 日々の様子、写真追加、動画追加、タイムライン |
| 09 | `09-doctor-view-detail-board.png` | 見せたい記録選択、診察まとめ、次に聞くこと、コピー/印刷 |
| 10 | `10-qa-safety-cost-guide.png` | 保存先、容量、家族共有、費用、先生に見せる、医学的判断ではないこと |
| 11 | `11-reminder-notification-concept.png` | 次段階の受診/お薬リマインド。仕様確認後に検討と明示 |
| 12 | `12-empty-success-error-states-assets.png` | 空状態、保存完了、アップロード、OCR、修正、再試行、共有、プライバシー等の文字なし状態アセット |
| 13 | `13-demo-storyboard-20260715.png` | 7/15デモの8ステップストーリーボード |
| 14 | `14-cut-ready-ui-object-assets.png` | マイク、ノート、検査、薬、写真、成長、カレンダー等の文字なし小物アセット |
| 15 | `15-parent-child-hero-scenes-no-text.png` | 親子で記録、家族で見返す、薬、成長、診察準備、先生に見せる等の文字なしシーン |
| 16 | `16-final-design-system-component-sheet.png` | 色、タイポグラフィ、ボタン、カード、チップ、リスト、ナビ、状態バッジ、空/成功状態 |
| 17 | `17-growth-record-detail-board.png` | 成長記録の入力、最新サマリー、推移グラフ、主治医相談メモ |
| 18 | `18-photo-album-fixed-grid-board.png` | 写真カテゴリ、3列固定グリッド、写真追加、記録ひもづけ |
| 19 | `19-calendar-settings-family-note-board.png` | カレンダー、受診準備、設定、家族共有、患者切替、Q&A、将来引き継ぎ |
| 20 | `20-doctor-view-print-desktop-board.png` | スマホの先生に見せる画面と、印刷/A4/PC表示の診察まとめ |
