# LINE WORKS導線メモ

作成日: 2026-06-21

## 結論

6/24のMVPは、**LINE WORKS内に置いたリンクからWebアプリを開く**導線を第一候補にする。

理由は、公式ドキュメント上でBot、Callback、URIアクション、固定メニュー、リッチメニュー相当は確認できた一方、実際のLINE WORKS管理者設定・Bot作成・認証情報がないと本番導線までは確定できないため。まずはリンク起動で見せられる状態を作り、Bot/メニュー連携は次段階で実装する。

## 公式ドキュメントで確認したこと

- BotはLINE WORKSのトークルーム上で利用できるチャットボット機能。
- Bot作成時にはHTTPSのCallback URLを設定し、Callback EventがJSONで送られる。
- Callback URLはBotごとに1件のみ登録できる。
- Callbackイベントにはメッセージ、ポストバック、参加/退室、1対1開始/終了などがある。
- イベントには送信者の `userId` が含まれ、必要なScopeがあればメンバー情報取得に使える。
- アクションにはポストバック、メッセージ、URI、カメラ、カメラロール、位置情報、コピーなどがある。
- URIアクションはボタンテンプレート、リストテンプレート、カルーセル、画像カルーセル、クイックリプライ、固定メニュー/リッチメニュー等で使える。
- Botメニューには、固定メニューとリッチメニューがある。

## 参照URL

- [LINE WORKS Developers Docs](https://developers.worksmobile.com/jp/docs)
- [Botの概要](https://developers.worksmobile.com/jp/docs/bot)
- [メッセージタイプ](https://developers.worksmobile.com/jp/docs/bot-send-content)
- [アクションオブジェクト](https://developers.worksmobile.com/jp/docs/bot-actionobject)
- [Botメニュー](https://developers.worksmobile.com/jp/docs/bot-menu)
- [Callback](https://developers.worksmobile.com/jp/docs/bot-callback)

## MVP導線

```text
LINE WORKSの患者会トーク/案内
  ↓
「よりそい アラジールを開く」リンク
  ↓
Webアプリ
  ↓
保護者が子どもプロフィールを作成
  ↓
診察メモ / 成長曲線 / 写真アルバム
```

## 次段階の導線

```text
LINE WORKS Bot
  ├─ 診察メモを開く
  ├─ 成長記録をつける
  ├─ 写真を追加する
  └─ これまでの記録を見る
```

この段階では、BotのCallback URL、署名検証、LINE WORKS userIdと患者/保護者docの紐づけ、メニュー作成APIを実装する。

## 実装上の注意

- LINE公式アカウント/LIFFと同じ前提で作らない。
- LINE WORKS userIdは、LINE userIdとは別物として扱う。
- 要配慮情報はトーク本文に直接出さず、Webアプリ内で表示する。
- Bot Callbackは速く200を返し、重い処理は非同期化する。
- 管理者設定や患者会側のLINE WORKS権限が揃うまでは、本番Bot化をブロッカーにしない。
