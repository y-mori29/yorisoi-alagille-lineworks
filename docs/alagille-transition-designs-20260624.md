# アラジール症候群向け 遷移画面デザイン画像整理

作成日: 2026-06-24

## 今回作成したもの

ホーム画面の A案/B案に合わせて、主要機能の遷移先画面を画像生成で作成した。

- A案: 水彩イラストを大きく使う、やさしい家族ノート風
- B案: 布・ステッチ・スクラップブック感を強めた、録音導線重視の家族ノート風

## 対象画面

- 診察メモ
  - 主役は音声録音
  - 入力欄を主役にしない
  - 録音から要点確認、次に聞きたいことへつなげる
- 成長
  - 身長・体重を記録できる
  - 成長曲線や前回差分をやさしく見返せる
- 写真
  - サムネイルのグリッドサイズを固定する
  - 写真カテゴリで外来資料や日常の様子を整理する
- 先生に見せる
  - 診察メモ、成長、写真、聞きたいことをまとめて提示する

## 保存場所

- `images/alagille-transition-designs-20260624/output/01-style-a-transition-screens.png`
- `images/alagille-transition-designs-20260624/output/02-style-b-transition-screens.png`
- `images/alagille-transition-designs-20260624/prompts/01-style-a-transition-screens.md`
- `images/alagille-transition-designs-20260624/prompts/02-style-b-transition-screens.md`

## 実装時の注意

生成画像をそのまま画面に貼るのではなく、次のように分解して再構築する。

- イラスト、装飾、紙テクスチャ、アイコンは単体素材として生成・配置する
- 日本語テキスト、ボタン、カード、入力欄、グリッドは HTML/CSS で再現する
- クリック領域、画面遷移、入力・録音・保存などの操作は実装側で担保する
- UI の見た目確認では、画像が表示されるだけでなく、ボタン遷移と画面内の文字欠けを確認する
