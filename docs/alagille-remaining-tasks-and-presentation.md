# よりそい アラジール症候群版 残タスク整理と説明画像メモ

作成日: 2026-06-22
対象: 2026-06-24提示に向けたアラジール症候群向け「よりそい」

---

## いま実装済み

- 3ボタンLINE版とは別リポジトリとして分離
- LINE WORKSはMVPをリンク起動、次段階をBot/メニュー連携として整理
- アラジール症候群テンプレート `backend/templates/alagille.json`
- アラジール関連薬マスター `backend/masters/alagille-medications.json`
- 家族ノート向けホーム
- 診察メモ画面
- 成長のきろく画面
- 写真アルバム画面
- 先生に見せる/ふりかえる導線
- Image2正本に合わせた単体asset方式への再構築
- 説明用のやさしい水彩トンマナをスキル化
- Image2文字入り説明インフォグラフィック6枚
- 6/24提示順メモ
- 要約プロンプトへの `summaryHints` 注入

---

## 6/24提示前に優先して残っていること

### 1. UIのP3微調整

実ブラウザで見ながら、以下を詰める。

- ホームの余白
- カード密度
- 文字サイズ
- イラストの見え方
- 画面下部ナビの説明順

### 2. 実データでの要約確認

`summaryHints` は実装済み。次は実際の診察会話やテスト文字起こしで、以下を確認する。

- 肝臓・心臓・腎臓・眼・骨格など複数診療科の話題を落としにくいか
- かゆみ、栄養、身長/体重、薬の変更、検査予定が出たときに拾えるか
- 会話に出ていない症状や検査をAIが補完していないか
- 保護者が見返して分かりやすい言葉になっているか

### 3. LINE WORKS導線の当日説明

6/24時点ではリンク起動MVPとして説明する。

- Bot/固定メニュー/URIアクションは次段階
- トーク本文に要配慮情報を出さない
- LINE WORKS userId と保護者docの紐づけは本実装で整理

### 4. リポジトリ初回整理

- 機密混入確認
- GitHub private repo作成
- 初回commit/push
- GCP/Cloud Run/Firestore/GCSをアラジール版として分離

---

## 本実装に向けて残っていること

### 成長のきろく

- `growthRecords` API作成
- 登録/一覧/更新/削除
- サンプルデータ表示
- 本番用の成長曲線データ出典整理
- 医学的判定ではなく記録補助であることの表現確認

### 写真アルバム

- 写真の拡大表示
- 日付/メモ/タグ表示
- 診察メモとの紐づけ
- GCS保存
- サムネイル生成
- 削除/共有範囲

### 診察メモ/AI整理

- 実データでの `summaryHints` 効果確認
- 複数診療科を見分けやすい表示
- 実データで保存から見返しまで確認

### 親から子への引き継ぎ

- `guardian` と `childProfile` の分離
- `futureHandoff.status` の追加
- 本人確認/同意/権限変更の論点整理
- 画面上では「将来、本人へ引き継ぐ準備」として控えめに説明

### LINE WORKS

- MVPリンク導線の確定
- Bot/固定メニュー/URIアクションの実装可否確認
- LINE WORKS userId と保護者docの紐づけ
- トーク本文に要配慮情報を出さない設計

### リポジトリ/デプロイ

- GitHub private repo作成
- 機密混入確認
- 初回commit/push
- GCP/Cloud Run/Firestore/GCSをアラジール版として分離

---

## 6/24提示順メモ

当日の見せ順と話す内容は以下に整理。

- `docs/alagille-20260624-presentation-flow.md`

---

## Image2文字入り説明画像

森さん指摘により、HTMLで組んだPNGではなく、Image2で文字入りインフォグラフィックを生成。

正本候補:

- `images/infographics/alagille-image2/final/01-overview-image2.png`
- `images/infographics/alagille-image2/final/02-visit-note-image2.png`
- `images/infographics/alagille-image2/final/03-growth-image2.png`
- `images/infographics/alagille-image2/final/04-album-image2.png`
- `images/infographics/alagille-image2/final/05-share-lineworks-image2.png`
- `images/infographics/alagille-image2/final/06-remaining-roadmap-image2.png`

候補一覧:

- `images/infographics/alagille-image2/candidate-contact-sheet.png`
- `images/infographics/alagille-image2/candidates/`