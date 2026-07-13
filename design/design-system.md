# デザインシステム: アラジール 家族ノートUI

作成日: 2026-06-29  
対象: `backend/public/index.html` から開始する静的HTML実装

## トークン正本

設計上のCSSトークンは `src/styles/tokens.css` に置く。  
このアプリは静的HTML配信のため、実表示では `backend/public/css/alagille-family.css` に同じ値を反映する。

## 色

| 名前 | 値 | 用途 |
| --- | --- | --- |
| `--alagille-ink` | `#49372f` | 見出し・本文 |
| `--alagille-paper` | `#fffdf6` | 背景 |
| `--alagille-mint` | `#228c68` | ホーム、共有、安心 |
| `--alagille-coral` | `#ee705f` | 今日残す、録音 |
| `--alagille-sky` | `#4d91bd` | 検査、情報整理 |
| `--alagille-honey` | `#d99b25` | 薬、予定 |
| `--alagille-sage` | `#6f9554` | 先生に見せる、診察準備 |

## タイポグラフィ

本文は既存の丸ゴシック系を継続する。  
候補:

```css
"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Yu Gothic", "Meiryo", system-ui, sans-serif
```

表示サイズ:

- 大見出し: 30-34px
- セクション見出し: 20-24px
- カード見出し: 16-18px
- 本文: 13-15px
- 補足: 11-12px

## コンポーネント

### 患者セレクターカード

現在の患者、年齢、切り替えをまとめる。  
診察メモや検査値など、すべての記録の対象患者を明確にするための部品。

ロゴ行の中へ入れると、ブランドと操作の意味が混ざる。  
ホームではヘッダー直下の独立カードとして置き、カード全体を押せる切り替え導線にする。

### 家族共有バナー

家族で同じ記録を見られることを説明する。  
イラストは `assets/alagille-brand/trimmed/12-family-group.png` を使用する。

### アクションエリア

ホームの主導線は3エリアに分ける。

- `.home-action-zone.coral`
- `.home-action-zone.sky`
- `.home-action-zone.sage`

各エリア内のアクションは `.home-action-tile` とする。

アクションは2列グリッドではなく、1列の大きいボタンを標準にする。  
理由は、画像・機能名・短い説明を同時に読めることを優先するため。特に家族利用では、小さい2列カードよりも1操作ずつ縦に並べる方が迷いにくい。

### サマリーカード

最近の変化、成長、次回受診を表示する。  
医学的判定ではなく、記録の見返しとして扱う。

### 下部ナビ

ホーム再構築段階では、旧ページへ直接遷移させない。

- ホーム
- カレンダー
- 写真
- 家族ノート

`設定` は旧実装の印象を強くするため、ホーム正本では前面に出さない。  
家族ノートの中に、家族共有、患者切り替え、Q&A、LINE WORKS案内、安全性説明をまとめる。

### 確認シート

未再構築の画面は、旧ページへ飛ばさず、ホーム内の `.feature-sheet` で役割だけを確認する。  
各機能画面を正本画像から再構築した時点で、実際の遷移へ置き換える。

## アセット

実装で使う水彩アセット:

- `assets/alagille-brand/trimmed/12-family-group.png`
- `assets/alagille-brand/trimmed/11-bird-outline.png`
- `assets/alagille-brand/trimmed/06-visit-notebook.png`
- `assets/alagille-brand/trimmed/07-medicine-bottle.png`
- `assets/alagille-brand/trimmed/03-medical-document.png`
- `assets/alagille-brand/trimmed/05-growth-child-ruler.png`
- `assets/alagille-brand/trimmed/02-plant-pot.png`
- `assets/alagille-brand/ui-extracted/patient-avatar-harukun-v2.png`
- `assets/alagille-brand/ui-extracted/tile-daily-camera-v2.png`
- `assets/alagille-brand/ui-extracted/growth-plant-v2.png`

## 署名的な要素

「今日のこと」「検査・お薬」「診察に持っていく」を、色違いの家族ノート見出しとして並べる。  
これは今回の正本UIの核であり、単なる機能カード一覧ではなく「家族がその日に選ぶ行動」として見えるようにする。

## 旧実装混入を防ぐルール

- ホームから未再構築の旧HTMLへ直接リンクしない。
- 既存ページを使う場合は、そのページ自体を先にUI Translation Kitで再構築する。
- 仕様書にない導線は、既存ファイルがあってもホームへ出さない。
- 画面名は「家族が何をしたいか」で決める。内部実装や旧ページ名をそのまま出さない。
- 文字、罫線、隣の素材、紙端などが混ざった切り出しは使い続けない。CSSで隠すより、単体素材として作り直す。
- 成長カードの主役は、植物よりも子ども＋身長計を優先する。植物は補助・空状態・装飾として使う。
