# アラジール版 UI 再現のための asset 方針

## 方針

Image2の画面モックをそのまま貼る、または画面モックから雑に切り出す方式は使わない。

正しい進め方は以下。

1. Image2のUIモックは「完成見本」として扱う
2. UIで使う画像素材は、最初から単体assetとして生成する
3. ヘッダー、本文、カード、ボタン、グラフ、ナビはHTML/CSS/SVGで実装する
4. 最後にImage2見本とスクリーンショットを比較して、余白・色・角丸・影・文字サイズを詰める

## 画像assetにするもの

- 親子イラスト
- 植木鉢
- 外来資料サムネイル
- 食事メモサムネイル
- 成長記録サムネイル
- 診察メモ用ノート
- 薬・検査の小物
- ハート、葉、鳥などの装飾

## HTML/CSS/SVGで作るもの

- ロゴ文字
- 見出し
- 説明文
- 4つのメインカード
- 次回受診カード
- 下部ナビ
- 成長グラフ
- 診察メモ本文
- タグ、チップ、日付、ボタン

## 生成済みasset

正本asset sheet:

- `backend/public/assets/alagille-brand/asset-sheet-v1.png`

切り出し済み単体asset:

- `01-family-mother-child.png`
- `02-plant-pot.png`
- `03-medical-document.png`
- `04-meal-plate.png`
- `05-growth-child-ruler.png`
- `06-visit-notebook.png`
- `07-medicine-bottle.png`
- `08-checkup-document.png`
- `09-heart-line.png`
- `10-leaf-sprout.png`
- `11-bird-outline.png`
- `12-family-group.png`

## 次の実装手順

1. 旧 `assets/alagille-ui/parts/` の雑切り出し素材は使わない
2. `assets/alagille-brand/` の単体assetだけを参照する
3. ホームから順に、Image2 1案目の構成をHTML/CSSで再構築する
4. 診察メモだけ、Image2 2案目の情報整理カード構成を採用する
5. スマホ幅430pxと通常ブラウザ幅でスクリーンショット比較する


---

## 2026-06-22 追記: 切り出し品質NG素材の差し替え

森さん確認で、`trimmed/01-family-mother-child.png` と `trimmed/02-plant-pot.png` は単体素材として不十分と判定。

理由:

- 画像全体が不透明で、透明な単体素材ではない
- 親子イラストは端の余白が不足し、画面内で切り抜き感が残る
- 植木鉢は小さく置いたときに欠け・切れが目立つ

対応:

- ホーム用親子イラストを単体生成: `backend/public/assets/alagille-brand/generated/home-family-clean-v2.png`
- 次回受診カード用鉢植えを単体生成: `backend/public/assets/alagille-brand/generated/next-visit-plant-clean-v2.png`
- ホーム、写真アルバム、説明用HTML内の旧参照を新素材へ差し替え

今後のルール:

- UI画面からの切り出しやasset sheetの雑トリミングを「正本素材」として扱わない
- 人物・鉢植えなど目立つ素材は、最初から単体素材として生成する
- 端切れ、文字混入、UI混入、不透明な四角い切り抜きが見えた素材は使用しない
---

## 2026-06-22 追記: ホームタイトルと親子イラストの再生成

森さん確認で、`home-family-clean-v2.png` は前回Image2正本の雰囲気より弱いと判定。前回正本画像を参照し、ホーム用の単体assetとして再生成した。

追加asset:

- `backend/public/assets/alagille-brand/generated/home-parent-child-reference-v3.png`
- `backend/public/assets/alagille-brand/generated/home-title-art-v1.png`

方針:

- ホームの主見出しはHTML文字ではなく、Image2で作ったタイトル画像を使う
- アクセシビリティ用に非表示h1は残す
- 親子イラストはUI画面の切り出しではなく、単体生成assetを使う