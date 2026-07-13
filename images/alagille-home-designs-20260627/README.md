# アラジール版 ホームUI・機能UIデザイン案 20260627

作成日: 2026-06-27  
追加整理: 2026-06-28

## 目的

2026-06-24ミーティング後の追加要件を反映し、2026-07-15（水）10:30デモに向けて、ホームUI、機能画面、ブランドトーン、説明素材、実装用に参照しやすい水彩アセットをまとめて生成した。

今回の画像は、そのまま背景画像として貼るための素材ではなく、UI Translation Kitで分析し、HTML/CSS/画像アセットへ分解して実装するための参照画像である。

## 参照した正本

- `docs/specs/20260624-expansion/README.md`
- `docs/specs/20260624-expansion/01-requirements-definition.md`
- `docs/specs/20260624-expansion/03-ui-ux-specification.md`
- `images/alagille-brand-ui-refresh-20260626/06-brand-design-sheet-no-numbers.png`
- `images/alagille-brand-ui-refresh-20260626/07-ui-overview-sheet-no-numbers.png`
- 既存ホームスクリーンショット: `C:\Users\green\Projects\.tmp\alagille-nav-check\home.png`

## ホームUI 6案

| 案 | ファイル | 狙い | 所見 |
| --- | --- | --- | --- |
| A | `output/01-concept-a-visit-note-home.png` | 録音で診察メモを主役にし、検査値・お薬・成長・日々の様子を入口にする | 初期案として自然。家族共有の見え方は弱い |
| B | `output/02-concept-b-family-switch-home.png` | 家族共有と患者切り替えを前面に出す | 6/24要望の説明力が高い。通常ホームでは患者選択の比重がやや大きい |
| C | `output/03-concept-c-doctor-prep-home.png` | 先生に見せるまでの準備を中心にする | デモ説明に強い。「先生に見せる」画面側の参考に向く |
| D | `output/04-concept-d-three-action-home.png` | 「今日のこと」「検査・お薬」「診察に持っていく」を3エリアで整理する | 現時点のホーム正本候補。使う順番が分かりやすい |
| E | `output/05-concept-e-recent-changes-home.png` | 最近の変化、検査値、お薬、日々の様子を振り返る | 日常利用の理由を作りやすい。ホーム下部やサマリー機能へ取り込む |
| F | `output/06-concept-f-lineworks-entry-home.png` | LINE WORKS会員入口と初回説明を分かりやすくする | オンボーディング、会員向け説明素材に向く |

## 追加生成シート

| 種類 | ファイル | 用途 |
| --- | --- | --- |
| 6案比較 | `sheets/01-home-six-concept-comparison.png` | 森さん・関係者確認用の比較 |
| 検査値・お薬 | `sheets/02-lab-medication-ui-board.png` | OCR確認、検査値表、薬メモのUI方向 |
| 成長・日々の様子 | `sheets/03-growth-daily-ui-board.png` | 身長体重、写真、動画、日々の記録 |
| 共有・先生に見せる | `sheets/04-share-doctor-help-ui-board.png` | 家族共有、先生に見せる、Q&A |
| A案展開 | `sheets/05-concept-a-expansion-board.png` | A案から機能画面へ広げる参考 |
| B案展開 | `sheets/06-concept-b-expansion-board.png` | 家族共有・患者切り替えの参考 |
| C案展開 | `sheets/07-concept-c-expansion-board.png` | 診察準備・医師提示画面の参考 |
| D案展開 | `sheets/08-concept-d-expansion-board.png` | 推奨ホーム構成の画面展開 |
| E案展開 | `sheets/09-concept-e-expansion-board.png` | 最近の変化・サマリーの参考 |
| F案展開 | `sheets/10-concept-f-expansion-board.png` | LINE WORKS入口・説明導線の参考 |
| ブランド/デザイン | `sheets/11-integrated-brand-ui-design-sheet.png` | 色、文字、部品、言葉の原則 |

## 単体画面モック

| 画面 | ファイル | 用途 |
| --- | --- | --- |
| 統合ホーム正本候補 | `screens/01-integrated-home-final-candidate.png` | 明日以降の実装開始候補。D案を軸にB/E要素を統合 |
| 検査値OCR確認 | `screens/02-lab-ocr-confirm-screen.png` | 撮影後の確認・修正UI |
| お薬メモ | `screens/03-medication-note-screen.png` | 薬名、回数、継続状況の記録 |
| 日々の様子 | `screens/04-daily-log-screen.png` | 症状、写真、動画、メモ |
| 先生に見せる | `screens/05-doctor-view-screen.png` | 診察時に見せるまとめ |
| 家族ノート/患者切り替え | `screens/06-family-patient-switch-screen.png` | 家族共有、複数患者切り替え |
| Q&A・ヘルプ | `screens/07-qa-help-screen.png` | 安心確認とヘルプ導線 |

## アセット

| ファイル | 用途 | 注意 |
| --- | --- | --- |
| `assets/01-core-ui-motif-asset-sheet.png` | ノート、検査、薬、成長、カレンダーなどの小物モチーフ | UI部品化候補 |
| `assets/02-family-scene-asset-sheet-with-text-avoid.png` | 参考用の家族シーン | 一部文字入りのため、実装素材としては避ける |
| `assets/03-family-scene-asset-sheet-no-text.png` | 文字なし家族シーン | 実装や説明資料のイラスト候補 |
| `assets/04-ui-state-asset-sheet-no-text.png` | 空状態、保存完了、共有、安心などの状態イラスト | 実装素材候補 |

## 説明素材

- `explainers/01-lineworks-announcement-visual.png`
- `explainers/02-demo-flow-20260715.png`

会員向け説明、患者会への共有、デモ前の流れ説明に使う参照素材。

## 推奨方針

明日以降のUI Translation Kit対象は、`screens/01-integrated-home-final-candidate.png` を第一候補にする。

理由は以下。

- D案の3エリア構成で「何をすればよいか」が分かりやすい
- B案の患者切り替え・家族共有をヘッダー付近に取り込める
- E案の「最近の変化」を下部サマリーとして入れられる
- C案の「先生に見せる」は独立画面として分けた方が役割が明確
- F案は通常ホームではなく、LINE WORKS会員入口・初回説明に回した方がよい

## 次の工程

1. `screens/01-integrated-home-final-candidate.png` を `design/references/` に登録する
2. `design/design-analysis.md` と `design/design-system.md` を作成する
3. `backend/public/index.html` と `backend/public/css/alagille-family.css` へ、まずホーム1画面だけ実装する
4. スマホ幅スクリーンショットで参照画像との差分を確認する
5. 次に、検査値OCR、お薬メモ、日々の様子、先生に見せる画面の順で展開する

## 注意

- 生成画像全体を背景画像やUI部品として貼らない
- 文字、ボタン、カード、ナビはHTML/CSSで再構築する
- イラストは単体アセット化して使う
- 医療判断を行う画面に見せず、「診察で伝えるための記録補助」として表現する
