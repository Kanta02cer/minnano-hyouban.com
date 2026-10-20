# 記事のアクセス・外部リンク計測を保全する手順

2026-10-20、両媒体の全101記事について、記事閲覧・企業公式リンク・Global News Asia出典リンクの計測コードを公開し、全111対象ファイルの公開SHAとJavaScript MIMEを読み戻した。11970の実受信は両媒体で個別に確認した。全記事の各リンククリックの実受信を個別に確認したという意味ではない。計測には分析への同意が必要で、広告ブロッカー等により記録されない場合がある。月次集計と会社別集約の確認は別工程。

## 編集時

1. 公開HTMLの media-analytics-config、data-mm-link、runtime、同意設定を確認する。公開runtimeは .js（ES module）で、.mjsへ戻さない。
2. 既存記事の本文・要約・FAQを再生成するとマーカーが消える場合がある。URLをそのまま保ち、マーカーとconfigの登録先を再照合する。ニュースリンクは article_news_click、公式会社・サービスCTAは article_cta_click。出典欄の会社URLを無条件に公式CTAへ転用しない。
3. 新記事は媒体ID・記事ID・リンクID・正確なURLを登録する。みんなはG-YBRSKWW8VE、社長はG-TWTSBFXEL1の既存ストリームを使用する。会社IDが未照合ならnullのまま記事別に収集できるが、会社別集約・診断照合へ流用しない。
4. 新規登録やURL変更は記事本文・公式サイトとの照合を経て、verifiedを更新する。時刻や会社名だけで他社へ紐付けない。本文の私的情報やURLクエリをイベントパラメーターへ入れない。
5. 新たなタグを重ねない。enhanced measurementはOFFを保ち、page_viewは同意後に1文書1回。拒否・撤回後の送信停止と設定を再開できるUIを維持する。
6. 同意の選択と保存日時をブラウザー内へ保存し、180日を過ぎた選択は無効として再確認する。実体が180日で必ず削除されるとは表記しない。GA cookieの期限設定は180日。

## みんなの評判.com

編集正本はsite-v2/。scripts/validate-measurement.jsが全記事のconfig・リンク・4公開assetを検査し、scripts/build-public-v2.jsのallowlistでdistへ引き継ぐ。新記事やenhancer後に検証が止まったら、欠落したマーカー・台帳を直す。検証を削除して通さない。

通常の `npm run build:branch-root` でprebuild検証・build・ルートミラーを実行する。npmが利用できなければ同じpackage script順で `node scripts/validate-public-v2.js` → `node scripts/build-public-v2.js` → `node scripts/stage-branch-root.js`。GitHubへのpushは履歴であり本番公開ではない。

## 社長の取材.com

原稿はarticle-drafts/20261007/articles.json。通常は `python3 public-site/build.py`。build_sister_edition.pyが記事生成後・manifest作成前にmeasurement/preserve.pyを呼び、measurement/registry.jsonの照合済み差分を再適用する。registryは公開リンク、元レンダリングのSHA、統合後SHA、head設定、専用CTAと公開assetのSHAを保持する。

原稿が変わる、新記事が増える、記事が減る場合は検証が止まる。古い原稿へ戻して通さず、対象の新レンダリングとリンクを再照合しregistryの当該記事とSHAを更新する。計測なしのbase-renderを直接公開しない。現在の正本はpublic-site/release-interviews-20261012/dist/、同じ生成物をpublic-site/dist/へコピーする。runtimeのURLは既存配信ルート /shacho-roman-20261007/media-*.js とCSSを維持する。

## 検証・公開

ビルド、本文と構造化データの整合、PC・スマホ・埋め込み幅の表示、同意・撤回・企業CTA・GNAリンクを確認する。適用前バックアップと固定対象のSHAを照合し、XServerの正規経路から公開する。実ドメインHTMLとruntimeを読み戻し、全SHAとJavaScript MIMEを確認する。公開・GA受信・月次集計を別々に記録し、未計測を0にしない。

11906の内容改修保留は維持する。今回の計測導入はdata属性とheadだけで、新しい企業CTAや記事本文の改稿を含まない。内容改修には別途基準計測の完了が必要。
