# アラジール版 Image2 asset prompts

## Brand asset sheet v1

用途:

- UIモックからの雑な切り出しをやめ、最初から切り出しやすい単体素材集として生成する
- 画面そのもの、ステータスバー、UIテキスト、ラベルは入れない

Prompt:

```text
Use case: ui-mockup
Asset type: reusable brand asset sheet for a pediatric family health notebook app
Primary request: Create a clean asset sheet for the app 「よりそい アラジール」. This is NOT a UI mockup. It is a collection of isolated reusable illustration assets to be cropped and used inside an HTML/CSS mobile app.
Audience: Japanese mothers caring for a child with Alagille syndrome. The assets should feel gentle, trustworthy, warm, pediatric, and suitable for a family health notebook.
Canvas: one large square asset sheet, off-white background (#fffdf6), arranged in a neat 4 x 3 grid with very generous spacing and margins between every asset. No phone frames, no UI screens, no status bars, no cards, no labels.
Style: soft Japanese watercolor picturebook illustration, clean edges, warm but not childish, matching a premium mother-and-child health notebook app. Use the same visual language as the previously selected Image2 UI direction: mint, coral, sky blue, honey yellow, soft brown linework, gentle hand-drawn warmth.
Assets to include as separate isolated objects, one per grid cell:
1. mother and child smiling together, upper body, child in yellow shirt, mother in mint striped shirt, soft greenery behind them
2. small potted plant with fresh leaves
3. paper medical document thumbnail with faint chart lines, no readable text
4. healthy meal plate thumbnail, soft illustration style
5. child standing beside a height ruler, growth record thumbnail
6. small open notebook with pencil, for visit notes
7. simple medicine bottle and tablet pack, friendly and non-scary
8. ultrasound/checkup document thumbnail, abstract and non-realistic
9. hand-drawn heart line icon, coral
10. small leaf sprout decoration, mint green
11. small bird outline decoration, sky blue
12. family group small icon illustration, mother, father, child, warm and simple
Text: no text anywhere. No Japanese text. No labels. No numbers. No UI copy.
Constraints: every asset must be fully visible, centered in its cell, separated from other assets, with clean off-white space around it so it can be cropped easily. No partial objects, no overlaps, no phone frames, no app UI, no screenshot look, no status bar, no battery/time icons, no watermark, no logo.
Avoid: cut-off heads or bodies, embedded UI text, labels, English text, Japanese text, dense medical imagery, scary hospital imagery, corporate dashboard style, stock photo style, purple gradients, beige/brown dominant palette.
```

## 追加素材を作る時のルール

- 1素材だけを追加生成する場合も、必ず「no text」「no UI」「generous padding」「fully visible」を入れる
- 画面モックから切り抜かない
- 背景は `#fffdf6` に揃える
- 実装では、画像素材は装飾とサムネイルに限定し、文字やカードはHTML/CSSで作る

