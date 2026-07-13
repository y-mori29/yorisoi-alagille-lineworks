# B案 遷移画面デザイン画像生成プロンプト

## 目的

B案ホーム画面のトンマナに合わせて、アラジール症候群向け「よりそい」の主要遷移先画面をまとめた UI デザインボードを生成する。

## Prompt

Create a high-fidelity Japanese mobile app UI design board for a pediatric family health note app named 「よりそい」 for families of children with Alagille syndrome.

Use the same visual style as the selected Style B home screen:
- mint green fabric-like header
- stitched borders and handmade scrapbook feeling
- warm cream paper background
- watercolor mother and child illustration
- large coral voice recording card
- cute chick, bear, leaf, notebook, calendar, and photo motifs
- soft rounded cards with tactile paper texture
- reassuring, practical, family notebook mood

Generate one horizontal design board containing four separate smartphone screens side by side. Do not include browser chrome, OS status bars, real device frames, or mock browser controls.

Screens to design:

1. 「診察メモ」
- Make voice recording the main action.
- Large coral stitched card with a microphone icon.
- Text: 「録音で診察メモ」
- Subtext: 「タップして録音をはじめる」
- Include recent memo cards created from recording.
- Keep manual text input secondary and visually small.

2. 「成長を記録」
- Friendly input screen for height and weight.
- Text: 「成長を記録」
- Include fields: 「身長」, 「体重」, 「今日の様子」
- Include a small sprout illustration and soft chart preview.
- Button: 「記録する」

3. 「写真を整理」
- Fixed equal-size photo grid.
- Text: 「写真を整理」
- Include photo categories: 「皮ふ」, 「目」, 「お薬」, 「外来資料」
- Show equal square watercolor thumbnail placeholders.
- Include tape, flower, and scrapbook decoration.

4. 「先生に見せる」
- A clean summary package for clinic visit.
- Text: 「先生に見せる」
- Include sections: 「診察メモ」, 「成長」, 「写真」, 「聞きたいこと」
- Include a large button: 「まとめて見せる」
- Include clipboard and heart motif.

Japanese text must be legible and natural. The result should feel like a polished presentation-ready UI concept for mothers and children, not a clinical dashboard.

## 注意

- 画像は UI 方針確認用。実装時は全画面スクリーンショットを切り貼りせず、必要なイラストや装飾素材を単体生成して組み込む。
- ステッチ、紙、装飾、アイコン類は素材化しやすいように、必要に応じて単体生成する。
