# コンポーネント棚卸し: ホームUI再構築 2026-06-29

作成日: 2026-06-29

## 実装対象

- `backend/public/index.html`
- `backend/public/css/alagille-family.css`

## 新規/更新コンポーネント

| コンポーネント | 実装クラス | 役割 |
| --- | --- | --- |
| ホームシェル | `.home-shell` | ホーム専用の最大幅・背景・余白 |
| ホームヘッダー | `.home-header` | ワードマーク画像とメニューだけを置き、患者切り替えとは競合させない |
| ワードマーク | `.brand-wordmark` | 正本画像から切り出したロゴ画像 |
| 患者セレクターカード | `.patient-selector-card` | 現在の記録対象と切り替えを、ロゴから独立した押せるカードとして示す |
| 家族共有バナー | `.family-share-banner` | 家族共有の安心表示。ボタンとして確認シートを開く |
| 3エリア導線 | `.home-action-zone` | 今日のこと/検査お薬/診察準備 |
| アクションタイル | `.home-action-tile` | 1列の大きいボタン。旧ページへ遷移せず、ホーム内の確認シートを開く |
| タイル水彩アート | `.tile-art` | Material Symbolsではなく単体水彩素材を主役にする |
| 最近の変化 | `.recent-changes-card` | 変化サマリー |
| 成長・受診サマリー | `.home-summary-grid` `.summary-panel` | 成長と次回受診 |
| 下部ナビ | `.bottom-nav` | ホーム/カレンダー/写真/家族ノートの入口。旧設定画面へは直接遷移しない |
| 確認シート | `.feature-sheet` | 次に作る機能画面の役割をホーム内で確認する |

## 再利用アセット

- Material Symbols: UIアイコン
- `assets/alagille-brand/trimmed/*.png`: 水彩イラスト
- `assets/alagille-brand/ui-extracted/patient-avatar-harukun-v2.png`: 患者セレクター用の子どもアバター
- `assets/alagille-brand/ui-extracted/tile-daily-camera-v2.png`: 日々の様子用のカメラ素材
- `assets/alagille-brand/ui-extracted/growth-plant-v2.png`: 植物だけを切り直した補助素材。成長カード主役ではなく別用途へ回す
- `assets/alagille-brand/ui-extracted/*.png`: 正本画像・アセットシートから切り出したUI部品

## 意図的に使わないもの

- 旧 `/simple/...` 画面へのホーム内リンク
- 既存設定画面への直接遷移
- 旧診察メモ画面、旧検査値画面、旧お薬画面、旧日々の様子画面への直接遷移
- 画面全体スクリーンショットの背景利用
- 文字や罫線が混ざった不完全な切り出し素材の継続利用

## 次に共通化したいもの

- 機能別カードのデータ定義
- 患者切り替えシート
- 家族共有バナー
- 先生に見せるサマリーカード
- 各機能画面を正本画像から再構築した後の本遷移
