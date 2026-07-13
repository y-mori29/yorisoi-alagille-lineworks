# A案 遷移画面デザイン画像生成プロンプト

## 目的

A案ホーム画面のトンマナに合わせて、アラジール症候群向け「よりそい」の主要遷移先画面をまとめた UI デザインボードを生成する。

## Prompt

Create a high-fidelity Japanese mobile app UI design board for a pediatric family health note app named 「よりそい」 for families of children with Alagille syndrome.

Use the same visual style as the selected Style A home screen:
- warm watercolor illustration
- soft cream paper background
- gentle mother and child atmosphere
- large friendly hand-drawn Japanese typography
- mint green, honey yellow, coral pink, and soft sky blue accents
- rounded cards with subtle watercolor texture
- calm, reassuring, non-clinical mood for mothers and children

Generate one horizontal design board containing four separate smartphone screens side by side. Do not include browser chrome, OS status bars, real device frames, or mock browser controls.

Screens to design:

1. 「診察メモ」
- Main purpose is voice recording.
- Large friendly microphone button.
- Text: 「録音で診察メモ」
- Subtext: 「先生と話したことを、あとで見返せます」
- Include states or small cards for: 「録音中」, 「要点を確認」, 「次に聞きたいこと」
- Avoid making text input look like the main action.

2. 「成長」
- Record height and weight.
- Text: 「成長を記録」
- Include input fields/cards: 「身長」, 「体重」, 「記録する」
- Include a soft growth chart with dots and gentle guideline band.
- Friendly star or sprout motif.

3. 「写真」
- Fixed-size photo thumbnail grid.
- Text: 「写真を整理」
- Include categories: 「皮ふ」, 「目」, 「お薬」, 「外来資料」
- Show equal square thumbnails with watercolor sample images.
- Include a calm add-photo button.

4. 「先生に見せる」
- Summary screen for clinic visit.
- Text: 「先生に見せる」
- Include sections: 「最近のメモ」, 「成長の記録」, 「写真」, 「聞きたいこと」
- Include a clear share/export button: 「まとめて見せる」
- Calm clipboard and notebook motif.

Japanese text must be legible and natural. Keep the UI family-friendly, trustworthy, and presentation-ready.

## 注意

- 画像は UI 方針確認用。実装時は全画面スクリーンショットを切り貼りせず、必要なイラストや装飾素材を単体生成して組み込む。
- タイトルや本文など可変テキストは HTML/CSS 側で再現する前提。
