#!/usr/bin/env python3
"""Generate reviewed public report pages from public-only source metadata.

The source metadata deliberately contains no private customer-list classification.
Editorial summaries live in content/bulk-report-angles.tsv and can be edited there.
Run this script after changing either file, then validate and build the site.
"""

import html
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATE = '2026-09-27'
EXISTING = {
    '11906': ('カラープラス', '村田隆行代表とカラープラスの歩み', '代表者', '2026-09-25', '赤字の1号店から多店舗モデルへ。代表者の判断と公表された事業の広がりを調べます。'),
    '11905': ('カラープラス', 'カラープラスのサービスと店舗展開', '会社・サービス', '2026-09-18', 'ヘアカラー専門店の仕組み、店舗情報、公開された利用者の声を調べます。'),
    '11904': ('ヨク住ル', '宮野和哉氏とヨク住ルの仕事観', '代表者', '2026-09-23', '代表者の経歴と顧客への向き合い方を、ニュースと会社情報から確認します。'),
    '11903': ('ヨク住ル', 'ヨク住ルの設備支援と保証', '会社・サービス', '2026-09-16', '寒冷地向けのエコキュート交換、工事の流れ、保証と施工事例を調べます。'),
    '11902': ('株式会社光サプライズ・LEDビジョン', '光サプライズの全国展開への取り組み', '会社・サービス', '2026-09-21', '顧問の参画と代理店モデル、事業の広がりを調べます。'),
    '11901': ('株式会社光サプライズ・LEDビジョン', '光サプライズのLEDビジョン事業', '会社・サービス', '2026-09-14', '情報発信に使われるLEDビジョンの事業と公開事例を調べます。'),
    '11670': ('株式会社やまもとくん', '山本雅俊代表の寄付と地域への視点', '代表者', '2026-08-26', '寄付の背景と埼玉県に記録された地域支援を調べます。'),
    '11669': ('株式会社やまもとくん', 'やまもとくんの地域密着リフォームFC戦略', '会社・サービス', '2026-08-19', '工事の仕組み、公開事例と利用者の声を調べます。'),
}
PEOPLE = set('10482 10509 10512 10552 10728 10969 11197 11244 11285 11557 11603 11627 11638 11640 11755 11758 11805 11810 11820 11838'.split())
NEWS_DETAILS = {
    '10482': '家族や自身の経験から人の心の問題に関心を持ち、短い動画で日常の悩みを扱うようになったと本人は話しています。記事にある反応やフォロワー数は当時の発信活動の説明で、相談サービスの効果を測った調査ではありません。',
    '10509': '渋谷氏は病院での勤務経験を、運動を続けられる場所づくりへつなげたと説明しています。記事はスタジオの拡大だけでなく、インストラクターを育てる組織づくりにも触れています。',
    '10512': 'CVCの構想では、加盟サロンが教育、集客、仕入れなどを共有することが想定されています。記事中の加盟数や収益規模は掲載時点の説明であり、最新の参加条件を示すものではありません。',
    '10552': '河野氏はスペースを開いて運営するだけでなく、事業として育てて譲渡する方法も記事で語っています。スクールはその経験を開業希望者へ伝える位置づけです。',
    '10613': '記事が注目したのは、野菜を食事の中心に据え、見た目が不揃いな食材の活用も掲げる点です。鹿児島で生まれた店づくりを首都圏へ広げるという出店時点の計画として読めます。',
    '10617': 'ニュースは、異業種から来た人を短期の研修で育てる方法を取り上げています。掲載されたスタッフの働き方や収入例は個別の紹介で、採用者全員の待遇を示すものではありません。',
    '10728': '水川氏は現場での施術経験を教材にまとめ、実技と動画を組み合わせる講座を企画しました。公式の取引条件にはコース別価格と解約ルールが明記されており、受講判断の材料になります。',
    '10911': 'エピグループは配信者の発掘だけでなく、配信の継続を支える管理や教育を掲げています。ニュース内の所属人数などは会社側の説明として扱い、収入の再現性を示すものとは区別します。',
    '10969': 'ゼロラボは不動産売却の前に改修の可能性を考える一方、そのまま売る選択肢も公式に示しています。物件の状態と手残りを比較して判断するという視点が、ニュースの提案を具体的にします。',
    '11010': '記事では、理科の知識を教えるだけでなく、生徒の発表や対話を授業に組み込む方法が説明されています。合格実績や学力向上の効果は、この授業設計の紹介だけでは判断できません。',
    '11037': '販売元の発表は特定の素材や配合成分に言及しますが、その説明を人での健康効果として断定する根拠は今回確認できませんでした。製品は食品として案内されており、医療上の判断とは切り分ける必要があります。',
    '11098': '製品の説明では、内部のエアバッグがゆっくり動いて頭や首の当たり方を変える仕組みが紹介されています。記事で語られる着想と、利用者の睡眠が改善するという臨床的な証明は別のものです。',
    '11155': 'ニュースは、自衛隊での役割や経験を企業へ伝わる職務経歴に置き換える支援に注目しています。職業紹介の対象や求人ごとの条件は、利用時に公式窓口で確認する必要があります。',
    '11197': '木野氏は柔道整復師としての経験から、産前産後のケアや体重に関する相談へ対応するようになったと語っています。資格の保有と、特定の症状が改善するという保証は別です。',
    '11198': 'ニュースでは施術だけでなく、食事や生活習慣の見直しを含む支援が説明されています。産後や更年期の不調には多様な原因があるため、適切な相談先を選ぶことが重要です。',
    '11244': '落合氏はジムを運営する中で、健康に関わる周辺事業を組み合わせる方向へ進んだと記事で説明しています。七つの事業という見出しは当時の構想と活動を表すもので、各事業の現況は個別に確認が必要です。',
    '11245': '複合ウェルネスの構想は、顧客がジムで運動する時間の外にも接点をつくる発想です。公式スタジオ案内ではトレーニングと食事に関するカウンセリングが具体的に紹介されています。',
    '11270': 'ニュースは軽量なパネルを建物に設置する用途と、廃棄時の負担を抑える構想を伝えています。導入先での長期耐久性や環境負荷は、仕様書や試験資料がないまま判断できません。',
    '11285': '山崎氏は、広告を出す前に顧客企業の課題を把握し、意思決定を早くする姿勢を語っています。公式会社情報ではWeb人材の技能を標準化する考えも掲げられています。',
    '11286': '広告、サイト制作、検索対策を別々に発注する企業に対し、全体の目標から施策を組み合わせる内容です。効果を見るには、取り組み前の数値と測定期間をそろえる必要があります。',
    '11557': '青木氏はアパレルOEMの受注だけでなく、ブランド運営に必要な資金の考え方も支えたいと話しています。法人登記は公的資料で確認できますが、顧客満足度の数値は独立に検証していません。',
    '11603': '嶋田氏は、退職後の採用を繰り返すより、組織内の変化を早く捉える仕組みに着目しています。協会の診断と研修は、その考えをサービスとして提供する手段です。',
    '11604': 'dマトは行動の傾向を分類し、組織で起きている課題を対話する入口として紹介されています。記事にある研修期間や改善例は協会側の説明として読み、すべての職場へ当てはめないことが大切です。',
    '11612': '拓洋は倉庫と配送に加え、建設や移転も事業として公表しています。イベント商品では急な注文増と限られた納期が重なるため、保管から発送までを一緒に設計する点がニュースの焦点です。',
    '11625': '記事はタイヤの交換技術を現場で共有し、若手が学べる会社を目指す姿勢を伝えています。技術大会での結果が記されていても、すべての作業が同じ評価を受けたことにはなりません。',
    '11627': '田中氏は若い年齢で事業を引き継ぎ、従来のタイヤ事業を守りながら新たな事業も試したと語っています。経営判断の経緯と現在の店舗サービスを分けて理解できます。',
    '11637': '記事では週休3日制を、単なる休暇の話ではなく、営業と育成の組み立て直しとともに紹介しています。会社概要では熊本を中心とした拠点と住宅設備の事業が確認できます。',
    '11638': '鎗水氏は営業経験を自らの転機と捉え、社員へ仕事を教える方法にも反映していると述べています。ニュース中の仕事観は代表者の言葉であり、顧客向けの設備契約の評価とは異なります。',
    '11639': '小松水産の公式資料には、水産加工の沿革と海外関連会社が掲載されています。ニュースは「SHIRASU」という商品群を海外へ伝える構想を扱い、実現済みの売上高とは区別して読みます。',
    '11640': 'ニュースは、営業とITの経験を持つと紹介される人物が、家庭で食べやすい水産品の届け方を考える姿を描いています。人物名が公式会社概要と一致しないため、ここではニュースが伝える発言として扱います。',
    '11667': '開業直後に来店が難しくなり、配達、ケータリング、卸などへ仕事を広げたという経緯が語られています。厨房や人員を複数の販路で活かす考えが、店舗運営の特徴として示されています。',
    '11668': '記事は旧店へ何度も足を運び、常連との関係や場所の記憶を見たことが新店構想の始まりだったと伝えます。旧店と同じ味を再現すると約束するのではなく、残すものと変えるものを選ぶ計画です。',
    '11671': 'b-modelsは機器を販売する側と、サロンで使う側を分けず、直営店で施術やメニューの運用を確かめる方針を語っています。導入後の集客や教育を含める点が記事の焦点です。',
    '11672': '頭皮の状態確認、洗浄、保湿などを組み合わせるサロンケアとして紹介されています。新しい成分や機器の名称だけで発毛効果を保証することはできず、研修では医療へ案内すべき状態の判断も課題です。',
    '11745': 'ノア側は役員選任と事業面の協力を提案したと記事に記されています。提案書の説明と、上場企業側が実際に決定・実行した事項は区別し、結果は最新開示で確認する必要があります。',
    '11755': '村上氏は消防士を辞めた後、複数の商品分野を試しながら自社ブランドへ進んだと振り返ります。失敗から商品を直す過程が、模型用品へ事業を絞る判断につながりました。',
    '11756': 'ニュースはガラスヤスリや作業用ボードを例に、使う人の不便を商品改良へ戻す方法を紹介しています。公式会社概要では、自社製品とOEM製品の企画・開発・販売が事業に挙げられています。',
    '11757': '雨漏りの原因を調べてから施工範囲を決めることと、施工後に相談へ対応できる距離で仕事を受けることが記事の軸です。片道30分圏という目安は掲載時点の方針です。',
    '11758': '三嶋氏は住宅修理の現場から経営へ進み、売上が下がった時に自社の説明や連絡に改善余地がないか探すと語ります。数字を顧客対応の見直しへつなげる考えとして読めます。',
    '11804': '公式サイトは金属プレス加工を案内し、ニュースは商流を直接取引へ移す経緯を伝えています。ロボット導入は人を減らす結果としてではなく、作業と判断の分担を見直す構想として紹介されています。',
    '11805': '池田氏は現場で働きながら工場長となり、製造を止めないために事業の再建へ関わったと語っています。資金面での困難と支援の経緯は、本人への取材に基づく説明です。',
    '11809': 'ニュースは1号店の開業から、直営とFCを組み合わせて広げるまでを追っています。共同代表の競技・指導経験と、採用や集客を組織で担う仕組みを別の要素として紹介しています。',
    '11810': '田中氏と林氏は、トレーニングを通じて自ら変化を感じた経験を共有しながら、経営上の役割は分けていると語ります。ニュースは顧客だけでなく働くトレーナーの将来にも触れています。',
    '11811': '本部が採用、集客、研修、運営支援を担うことで、加盟店の現場が指導に集中しやすいという構想です。100店舗は達成済みの数ではなく、会社が掲げる拡大目標として読めます。',
    '11812': '採用では大会実績だけを基準にせず、顧客と話せるかを重視すると記事は説明します。研修ではトレーニング技術に加え、目標設定やカウンセリングを扱うと紹介されています。',
    '11813': 'ニュースは、運動初心者を含む利用者の事例を取り上げ、食事や日常の予定を踏まえた支援を描いています。紹介された体重の変化や感想は個々の利用者の例で、一般的な結果ではありません。',
    '11819': 'Brainは、コンテンツを掲載する人と購入する人を、レビューや紹介の機能で結びます。紹介報酬のある仕組みでは、販売量と教材の質が一致するとは限らず、購入者側の確認が欠かせません。',
    '11820': '迫氏は自身が技能を学んだ経験と、受講生が仕事の選択肢を広げたとする事例を、教育事業の原点として語っています。Brainでは卒業生が開発へ関わった経緯も記事に記されています。',
    '11837': 'メタルの質感を出す塗装は靴の曲がりに耐えることが課題で、坂中氏は下地や乾燥の方法を試したと説明しています。飾るだけではなく履くことを想定した制作がテーマです。',
    '11838': '汚れた靴を塗り直した体験と、ゴルフシューズでの試作が注文制作の始まりだったと記事は伝えます。塗料や下地を扱ってきた本業の経験を、個別のデザインへ応用した歩みです。',
    '11968': '公式サイトはWeb制作、広告運用、SEOを案内しています。記事では、広告で受注を伸ばす一方、入金前の費用に対応する資金繰り支援を組み合わせる考えが説明されています。',
    '11999': 'ニュースによると、会員向けの個別セッションは半年10回または1年20回を想定しています。悩みを言葉にし、日常で試して振り返る方法を重視するという本人の説明です。',
    '12000': 'ニュースは短い動画、日記、オンラインでの交流など複数の参加方法を紹介しています。参加や発言を強制せず、生活の中で使える場を目指すという運営方針です。',
}
OFFICIAL_FACTS = {
    '株式会社CHAINONエンターテイメント': '公式会社概要には、正式な社名を「株式会社CHAINONエンターテインメント」と記し、坂口貴徳氏を代表者として掲載しています。ニュースで使われた社名表記とは一文字異なります。',
    'レンスペ本舗': 'サービスの会社概要では、レンタルスペース運営を学ぶスクールを事業に挙げています。河野光孝氏はサービス代表として挨拶を載せ、運営法人の代表取締役には井上幸美氏が記載されています。',
    'VEGE＆me': '公式会社案内は、合同会社KBcreationが運営し、樺山周作氏と川林雄城氏を共同代表として掲載しています。生産者と消費者をつなぐサラダ事業を理念に挙げています。',
    'ラピラティス': '公式の会社概要には、株式会社La pilatesがスタジオ運営、フランチャイズ本部、研修事業を行い、渋谷生夢氏が代表者と記されています。利用者向けメニューと採用情報は別の案内から確認できます。',
    'ルシルアカデミー': '公式の特定商取引法に基づく表記は、水川優海氏を運営責任者とし、実技指導、動画教材、卒業後1年間の無料サポートをサービス内容に挙げています。コースごとの価格と解約条件も同ページで確認できます。',
    'エピグループ': '公式会社概要は、ライブ配信者のマネジメント、TikTok LIVE導入支援、EC、動画・Web制作などを事業に挙げています。配信者の教育を単独のサービスではなく複数の支援と組み合わせています。',
    'ゼロラボ': '公式会社案内によると、Difference Design株式会社が運営し、大阪・兵庫・奈良の一部を対応地域にしています。改修して売る方法と現状のまま売る方法の双方を案内しています。',
    '中学受験のミカタ': '現在の公式案内には、株式会社キミノミカタが運営すると記されています。理科のオンライン授業と動画、個別コーチングを案内しており、ニュースの教育方針を現在の提供形態と照らせます。',
    'MIRACLE PILLOW': '販売サイトの会社概要は、通信販売業の株式会社TVCを運営会社として記載しています。製品の使用方法や返品条件は会社概要ではなく、販売ページで確認する必要があります。',
    'NEXT MISSION': '公式サイトの公開見出しでは、自衛官のキャリア支援を事業として示しています。サービス内容の詳しい条件は、ニュースの説明と現在の公式案内を合わせて確かめる必要があります。',
    'ゆうきや整体院': '公式サイトは横浜保土ケ谷区の整体院として、ダイエットや産前産後のケアを案内しています。木野竜太郎院長の柔道整復師資格も同サイトに記載されています。',
    'REWA BC SOLAR': 'REIWAクリエイトの公式会社案内には、法人向け太陽光発電サービス「REIWA BCソーラー」が掲載されています。一方、ニュース中のパネル性能や認証そのものを証明する独立資料は、今回の調査では確認していません。',
    '株式会社インプルーブ': '公式のスタジオ案内は、浜松市でのパーソナルトレーニングを紹介し、初回カウンセリングで目標と食事を確認する方針を示しています。複数事業の構想と現在のジム提供内容は分けて読む必要があります。',
    '株式会社allview': '公式会社概要には、山崎真幸氏を代表者とし、Webマーケティングや広告運用の事業を案内しています。会社ページではデジタル広告の品質認証取得も公表していますが、個別案件の成果とは別の情報です。',
    '離職予防士協会／dマト組織活性化': '協会の公式サイトは、専門家の育成・認定と、企業向けの診断・改善支援を分けて案内しています。公開された数値は協会が提示する集計で、当サイトによる独立検証ではありません。',
    '株式会社比良タイヤ工業所': '公式ホームページには、タイヤ販売・交換などのサービス案内があります。会社概要の個別ページは今回取得できなかったため、代表者の歩みや経営数値はニュースの説明として扱っています。',
    '株式会社九州エネルギー事業会': '公式会社概要は鎗水晴輝氏を代表者として掲載し、熊本本社と九州内の支店を案内しています。住宅設備の提案と、働き方に関するニュースの説明を分けて確認できます。',
    '株式会社拓洋': '公式会社概要は、物流、倉庫・施設の建設、移転の三つの事業を示しています。エンタメ物流の話題を、同社の保管・配送サービス全体の中で位置づけられます。',
    '小松水産株式会社': '公式会社概要は1933年の創業と、しらす・ちりめんの加工販売、直販店の運営を記載しています。同ページに記された社長の氏名は人物記事の氏名と異なり、当サイトでは両者の関係を確認できていません。',
    'ANDDINING株式会社（焼鳥雀屋）': '公式会社案内は桜井仁天氏を代表者として掲載し、飲食店の運営と人材育成への考え方を紹介しています。焼鳥雀屋をめぐる新店計画は、ニュース掲載時の内容として確認してください。',
    'ノアグループホールディングス': '公式会社概要は、大西雅之氏を代表者とし、テニス、フットサル、製造、教育などのグループ企業を掲載しています。株主提案の採否やその後の結果は、別途対象会社の開示で確認が必要です。',
    '株式会社b-models': '公式会社案内は、楠本文哉氏を代表者とし、エステサロン向けの機器販売とコンサルティングを事業に挙げています。導入後の研修と頭皮ケアの具体的な条件はサービス別に確認できます。',
    'Sachiプラモ（株式会社サチクル）': '公式会社概要は、株式会社サチクルが自社製品とOEM製品の企画・開発・販売を行い、村上博司氏が代表者と記しています。個別工具の仕様は商品ページで確認できます。',
    '株式会社りふぉーむカンパニー': '公式会社概要の商号は株式会社カンパニーズです。りふぉーむカンパニーの案内には、外壁塗装、屋根工事、雨漏り修理のメニューと、施工事例・保証の説明が分かれて掲載されています。',
    '橘金属工業株式会社': '公式ホームページには、自動車向けの金属加工事業が掲載されています。会社概要の個別ページは今回取得できなかったため、設備や再建の細かな数値はニュース時点の説明として扱っています。',
    'ムネペイント': '公式サイトは、スニーカーペイントのオーダー制作と講座を案内しています。一部に仮の文章や電話番号が残るため、注文条件や連絡先は実際の申込画面で確認してください。',
    'THE PERSONAL GYM': '公式会社概要には、First fit株式会社がパーソナルジムを運営し、FC事業と健康関連商品の販売も事業に挙げています。法人代表の表記は田中健斗氏で、ニュースの共同代表という表現とは分けて記載しています。',
    'Brain': 'グループの公式案内は、株式会社ブレインがBrainの運営主体と記し、持株会社とは区別しています。Brainのサイトでは教材の購入・レビューを確認でき、各教材の内容は出品者ごとに見る必要があります。',
    '株式会社Asahi・Asahiコーチング／オンラインサロン': '吉田朝陽氏の公開プロフィールにはSNSや相談先へのリンクがあります。現在のコーチング・サロンの料金、会員条件、運営法人の詳細は、このリンク集だけでは確認しきれないため申込前に案内を確かめてください。',
    '株式会社リンクス': '公式サイトは、Web制作、Webコンサルティング、SEO、リスティング広告を事業として掲載しています。ファクタリングの提供条件は同じページだけでは確認しきれず、別のサービス資料で確認する必要があります。',
}


def esc(value):
    return html.escape(str(value), quote=True)


def read_data():
    sources = json.loads((ROOT / 'content/bulk-report-sources.json').read_text())
    notes = {}
    for line in (ROOT / 'content/bulk-report-angles.tsv').read_text().splitlines():
        parts = line.split('|')
        if len(parts) != 4 or parts[0] in notes:
            raise ValueError(f'Invalid editorial note: {line}')
        notes[parts[0]] = {'heading': parts[1], 'focus': parts[2], 'check': parts[3]}
    ids = [item['id'] for item in sources]
    if len(ids) != 53 or len(ids) != len(set(ids)) or set(ids) != set(notes):
        raise ValueError('Bulk source IDs and editorial notes differ')
    existing_ids = {path.parent.name for path in (ROOT / 'site-v2/reports').glob('*/index.html')}
    if existing_ids - (set(ids) | set(EXISTING)):
        raise ValueError('Newer articles are present: this one-time bulk generator cannot overwrite their navigation')
    return sources, notes


def display_company(item):
    return {
        '株式会社Asahi・Asahiコーチング／オンラインサロン': '株式会社Asahi',
        'Sachiプラモ（株式会社サチクル）': 'Sachiプラモ',
        'ANDDINING株式会社（焼鳥雀屋）': 'ANDDINING',
        '株式会社KanaeRus（カナエルス）': 'KanaeRus',
        '離職予防士協会／dマト組織活性化': '離職予防士協会',
        '株式会社光サプライズ・LEDビジョン': '光サプライズ',
        '株式会社りふぉーむカンパニー': 'りふぉーむカンパニー',
    }.get(item['company'], item['company'])


def date_ja(value):
    year, month, day = value.split('-')
    return f'{year}年{int(month)}月{int(day)}日'


def media_list(item):
    return ''.join(f'<li><a href="{esc(url)}" rel="noopener noreferrer">{esc(name)}</a></li>' for name, url in item['media'].items())


def official_text(item):
    name = display_company(item)
    if item['company'] == 'SenoRich':
        return '総販売元の会社案内と販売元が出した製品発表を確認しました。発表にある成分の働きや老化細胞への作用は、当サイトが独立に検証したものではありません。食品を医薬品の代わりに使わず、健康上の相談は医療専門家へしてください。'
    if item['company'] == '株式会社KanaeRus（カナエルス）':
        return '同社名を掲げる事業案内では、アパレルOEMの相談を受け付けています。案内上の満足度や利用者コメントは事業者が選んで載せたもので、当サイトの独立調査による評価ではありません。'
    if item['company'] in OFFICIAL_FACTS:
        return OFFICIAL_FACTS[item['company']]
    return f'{name}の公開案内では、{item["business"]}を事業内容として紹介しています。ニュースで取り上げられた考え方を、現在の提供サービスや会社の案内と照らして読むことができます。'


def page(item, note, related):
    id_ = item['id']
    company = display_company(item)
    heading = note['heading']
    full_title = f'{heading}｜口コミ・評判・実績を調査'
    url = f'https://minnano-hyouban.com/reports/{id_}/'
    date = date_ja(item['newsDate'])
    media_count = len(item['media'])
    kind = '代表者' if id_ in PEOPLE else '会社・サービス'
    news_url = item['media']['Global News Asia']
    official = item['officialUrl']
    details = item['officialDetailUrl']
    related_html = ''
    if related:
        links = []
        for rid, rtitle in related:
            links.append(f'<li><a href="/reports/{esc(rid)}/">{esc(rtitle)}｜口コミ・評判・実績を調査</a></li>')
        related_html = '<section class="report-section" aria-labelledby="related"><p class="section-kicker">RELATED REPORTS</p><h2 id="related">同じ企業・サービスの関連記事</h2><ul class="source-list">' + ''.join(links) + '</ul></section>'
    evidence = [news_url, details]
    if official != details:
        evidence.append(official)
    evidence = list(dict.fromkeys(evidence))
    jsonld = {'@context': 'https://schema.org', '@type': 'Article', 'mainEntityOfPage': url,
              'headline': full_title, 'description': f'{company}のニュース、公開された事業内容、口コミ・評判の確認範囲を調べた記事。',
              'inLanguage': 'ja', 'datePublished': DATE, 'dateModified': DATE,
              'author': {'@type': 'Person', 'name': '漆沢祐樹', 'url': 'https://minnano-hyouban.com/editor.html'},
              'isBasedOn': evidence}
    json_text = json.dumps(jsonld, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    warning = ''
    if id_ == '11037':
        warning = '<p>健康食品については、<a href="https://www.caa.go.jp/policies/policy/consumer_safety/food_safety/food_safety_portal/health_food/">消費者庁の情報</a>も参照できます。販売元の説明だけで治療効果を判断しないことが大切です。</p>'
    if id_ == '11745':
        warning = '<p>株主提案の現状は、対象上場会社の最新の適時開示や株主総会資料で改めて確認してください。この記事は投資判断を勧めるものではありません。</p>'
    corporate_source = '<p><a href="https://brain-holdings.com/">運営会社グループの会社情報</a>も参照しています（確認：2026年9月27日）。</p>' if id_ in ['11819', '11820'] else ''
    return f'''<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#152f32">
  <title>{esc(full_title)}｜みんなの評判.com</title>
  <meta name="description" content="{esc(company)}のニュースは{media_count}媒体に掲載。公式案内と照らし、事業の特徴、口コミ・評判、確認できる実績と情報の限界を整理します。">
  <link rel="canonical" href="{url}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/site.css"><script src="/site.js" defer></script>
  <meta property="og:type" content="article"><meta property="og:site_name" content="みんなの評判.com"><meta property="og:title" content="{esc(full_title)}"><meta property="og:description" content="ニュースと公開資料で{esc(company)}を調査。口コミ・評判と実績の確認範囲を明示します。"><meta property="og:url" content="{url}">
  <script type="application/ld+json">{json_text}</script>
</head>
<body>
  <a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><div class="wrap header-inner"><a class="brand" href="/" aria-label="みんなの評判.com トップページ"><span>みんなの評判</span><small>.com</small></a><nav class="primary-nav" aria-label="メインメニュー"><a href="/articles.html" aria-current="page">調査レポート</a><a href="/guide.html">調査の方法</a><a href="/editor.html">編集者</a></nav></div></header>
  <main id="main">
    <header class="report-hero"><div class="wrap"><nav class="breadcrumb" aria-label="パンくずリスト"><a href="/">トップ</a><span aria-hidden="true">/</span><a href="/articles.html">調査レポート</a><span aria-hidden="true">/</span><span aria-current="page">{esc(company)}</span></nav><p class="eyebrow"><span class="eyebrow-line"></span> {('PEOPLE' if kind == '代表者' else 'COMPANY RESEARCH')} / {id_}</p><h1>{esc(heading)}<span class="report-title-qualifier">口コミ・評判・実績を調査</span></h1><p class="report-deck">{esc(note['focus'])}この記事ではニュースに加え、公開された事業案内と、口コミ・評判を判断できる範囲を確認します。</p><div class="report-meta"><span>ニュース掲載：<time datetime="{item['newsDate']}">{date}</time></span><span>確認日：<time datetime="{DATE}">2026年9月27日</time></span><span>調査方法：公開情報の照合</span></div></div></header>
    <div class="wrap report-layout"><article class="report-main">
      <section class="report-section" aria-labelledby="overview"><p class="section-kicker">OVERVIEW</p><h2 id="overview">ニュースで取り上げられたテーマ</h2><p><a href="{esc(news_url)}" rel="noopener noreferrer">元記事</a>は{date}に掲載されました。{esc(note['focus'])}同じ内容のニュースは{media_count}媒体で読むことができます。掲載の広がりは確認できる実績ですが、{media_count}件の独立した取材や、サービス品質への第三者認証を意味するものではありません。</p></section>{related_html}
      <section class="report-section" aria-labelledby="news-detail"><p class="section-kicker">THE NEWS</p><h2 id="news-detail">記事が伝える取り組み</h2><p>{esc(NEWS_DETAILS[id_])}</p></section>
      <section class="report-section" aria-labelledby="company"><p class="section-kicker">COMPANY &amp; SERVICE</p><h2 id="company">公開案内から見る事業</h2><p>{esc(official_text(item))}</p>{corporate_source}<p>サービスの内容、対象地域、価格や提供条件は更新される場合があります。利用や取引を考えるときは、<a href="{esc(details)}" rel="noopener noreferrer">現在の公開案内</a>で詳しく確認できます。</p></section>
      <section class="report-section" aria-labelledby="angle"><p class="section-kicker">WHAT TO CHECK</p><h2 id="angle">読み解くときの視点</h2><p>{esc(note['check'])}</p><p>ニュースで紹介された背景と、実際に提供されるサービスの条件を分けて見ると、{esc(company)}の取り組みを具体的に理解できます。</p>{warning}</section>
      <section class="report-section" aria-labelledby="record"><p class="section-kicker">PUBLICLY SOURCED RECORD</p><h2 id="record">確認できた実績の範囲</h2><div class="card"><dl class="report-facts"><dt>ニュース掲載</dt><dd>同じテーマの記事が{media_count}媒体に掲載されています。掲載先へのリンクは下にまとめました。</dd><dt>事業案内</dt><dd><a href="{esc(details)}" rel="noopener noreferrer">公開ページ</a>で{esc(company)}の事業や提供内容を確認できます。ページ上の実績・数値は公表主体と時点を確認してください。</dd></dl></div></section>
      <section class="report-section" aria-labelledby="reviews"><p class="section-kicker">REPUTATION</p><h2 id="reviews">口コミ・評判をどう読むか</h2><p>当サイトが独自に集め、本人確認まで行った利用者の口コミはありません。公式サイトに利用者の声や事例が掲載されている場合も、それは事業者が選んで公開した情報です。ニュースへの掲載は知名度を知る手がかりになりますが、顧客全体の満足度や成果を示す調査ではありません。</p><p>実際に利用する際は、自分に近い条件の事例、費用、契約後の対応を確認することを勧めます。</p></section>
      <section class="report-section official-visit" aria-labelledby="official"><p class="section-kicker">OFFICIAL SITE</p><h2 id="official">現在のサービスを確認する</h2><p>最新の内容や提供条件は、{esc(company)}の公開案内から確認できます。記事で気になった点を具体的に照らし合わせてみてください。</p><p class="official-links"><a href="{esc(official)}" rel="noopener noreferrer">公式・公開案内を見る <span aria-hidden="true">↗</span></a></p></section>
      <section class="report-section" aria-labelledby="media"><p class="section-kicker">MEDIA COVERAGE</p><h2 id="media">記事が掲載された{media_count}媒体</h2><p>以下は同じニュースが載ったページです。各媒体が別々に取材したことを示す一覧ではありません。</p><ul class="source-list">{media_list(item)}</ul></section>
      <section class="report-section" aria-labelledby="sources"><p class="section-kicker">SOURCES &amp; LIMITS</p><h2 id="sources">参照した公開資料</h2><ol class="source-list"><li><a href="{esc(news_url)}" rel="noopener noreferrer">{esc(item['newsTitle'])}</a><small>掲載：{date}</small></li><li><a href="{esc(details)}" rel="noopener noreferrer">{esc(company)}の公開案内</a><small>確認：2026年9月27日</small></li></ol><div class="notice"><h3>情報の確認範囲</h3><p>この記事はニュースと公開情報を当サイトが整理したものです。当サイトによる直接取材、利用者全体の満足度調査、個別の成果検証は行っていません。記事にある方針や予定は掲載当時の内容として読んでください。</p></div></section>
    </article><aside class="report-sidebar" aria-label="調査対象の基本情報"><div class="card"><p class="section-kicker">AT A GLANCE</p><h2>調査対象</h2><dl class="report-facts"><dt>対象</dt><dd>{esc(company)}</dd><dt>記事の視点</dt><dd>{kind}</dd><dt>運営・法人表記</dt><dd>{esc(item['legalName'])}</dd><dt>事業</dt><dd>{esc(item['business'])}</dd><dt>掲載</dt><dd>{media_count}媒体</dd></dl></div><div class="card"><p class="section-kicker">HOW TO READ</p><h2>この記事の範囲</h2><p>ニュース、公開案内、掲載先を確認しました。口コミの代表性やサービスの効果は独立検証していません。</p><a href="/guide.html">調査方法を読む →</a></div></aside></div>
  </main><footer class="site-footer"><div class="wrap footer-grid"><div><a class="brand footer-brand" href="/">みんなの評判<small>.com</small></a><p>ニュースの先にある、会社の姿を調べる。</p></div><nav aria-label="フッターメニュー"><a href="/articles.html">調査レポート</a><a href="/guide.html">調査の方法</a><a href="/editor.html">編集者</a><a href="/privacy.html">プライバシーポリシー</a><a href="/disclaimer.html">免責事項</a></nav></div><div class="wrap footer-bottom"><small>© みんなの評判.com</small><small>記事の情報は掲載・確認時点のものです。</small></div></footer>
</body>
</html>
'''


def archive_and_home(sources, notes):
    records = []
    for item in sources:
        id_ = item['id']
        records.append({'id': id_, 'company': item['company'], 'title': notes[id_]['heading'],
                        'kind': '代表者' if id_ in PEOPLE else '会社・サービス',
                        'date': item['newsDate'], 'summary': notes[id_]['focus']})
    for id_, (company, title, kind, date, summary) in EXISTING.items():
        records.append({'id': id_, 'company': company, 'title': title,
                        'kind': kind, 'date': date, 'summary': summary})
    records.sort(key=lambda item: (item['date'], int(item['id'])), reverse=True)
    if len(records) != 61 or len({r['company'] for r in records}) != 36:
        raise ValueError('Expected 36 companies and 61 articles')

    # One company section keeps people and service stories together even when
    # their original publication dates differ.
    groups = defaultdict(list)
    for record in records:
        groups[record['company']].append(record)
    group_html = []
    for company, rows in groups.items():
        label = display_company({'company': company})
        cards = []
        for row in rows:
            id_ = row['id']
            title = row['title']
            summary = row['summary']
            card = f'''<article class="report-card" data-report-card data-search="{esc(label + ' ' + title + ' ' + summary)}"><div class="report-card-top"><span>{esc(row['kind'])}</span><span>ニュース掲載 {row['date'].replace('-', '.')}</span></div><h4><a href="/reports/{id_}/">{esc(title)}<small class="report-card-qualifier">口コミ・評判・実績を調査</small></a></h4><p>{esc(summary)}</p><a class="report-card-link" href="/reports/{id_}/" aria-label="{esc(title)}の記事を読む">調査を読む <span aria-hidden="true">↗</span></a></article>'''
            cards.append(card)
        group_html.append(f'''<section class="company-report-group" data-report-group aria-label="{esc(label)}の調査記事"><div class="company-group-heading"><h3>{esc(label)}</h3><span>{len(rows)}記事</span></div><div class="report-card-grid archive-grid paired-reports">
{chr(10).join(cards)}
</div></section>''')
    archive = ROOT / 'site-v2/articles.html'
    archive_text = archive.read_text()
    section = f'''<section class="section archive-section"><div class="wrap"><div class="section-head"><div><p class="section-kicker">BY COMPANY</p><h2>36社・61記事</h2></div></div><div class="archive-search"><label for="report-search">会社・代表者・サービス名で探す</label><input id="report-search" type="search" placeholder="例：会社名や代表者名" autocomplete="off"><p id="search-result-count" role="status">61記事を掲載</p></div><div class="company-report-list">
{chr(10).join(group_html)}
</div><p id="search-no-results" hidden>一致する記事がありません。別の言葉で検索してください。</p></div></section>'''
    archive_text, count = re.subn(r'<section class="section archive-section">[\s\S]*?</section>\s*</main>', section + '\n  </main>', archive_text, count=1)
    if count != 1:
        raise ValueError('Cannot replace archive section')
    archive.write_text(archive_text)

    home = ROOT / 'site-v2/index.html'
    home_text = home.read_text()
    home_text = home_text.replace('4社 / 8記事', '36社 / 61記事')
    home_text = home_text.replace('Reports / 08', 'Reports / 61')
    featured = records[:8]
    home_cards = []
    for index, row in enumerate(featured, start=1):
        id_ = row['id']
        date = row['date'][5:].replace('-', '.')
        title = row['title']
        home_cards.append(f'''<article class="article-item"><div class="article-meta micro"><span>{index:02d} / {esc(row['kind'])}</span><span>{date}</span></div><h3>{esc(title)}<small>口コミ・評判・実績を調査</small></h3><p>{esc(row['summary'])}</p><span class="arrow" aria-hidden="true">↗</span><a href="/reports/{id_}/" aria-label="{esc(title)}の記事を読む"></a></article>''')
    home_text, count = re.subn(r'<div class="article-grid">[\s\S]*?</div>\s*<div class="more">', '<div class="article-grid">\n' + '\n'.join(home_cards) + '\n</div>\n      <div class="more">', home_text, count=1)
    if count != 1:
        raise ValueError('Cannot replace home report grid')
    aside = []
    for number, row in enumerate(featured[:2], start=1):
        aside.append(f'''<a class="aside-feature" href="/reports/{row['id']}/"><span class="num">{number:02d}</span><span class="category micro">{('PEOPLE' if row['kind'] == '代表者' else 'COMPANY')} / {esc(display_company({'company': row['company']}))}</span><h2>{esc(row['title'])}<small>口コミ・評判・実績を調査</small></h2><p>{esc(row['summary'])}</p></a>''')
    home_text, count = re.subn(r'<a class="aside-feature"[\s\S]*?<div class="aside-tail micro">', '\n'.join(aside) + '\n        <div class="aside-tail micro">', home_text, count=1)
    if count != 1:
        raise ValueError('Cannot replace featured aside')
    home.write_text(home_text)

    build = ROOT / 'scripts/build-public-v2.js'
    build_text = build.read_text()
    ids = [r['id'] for r in records]
    definition = "const reportIds = [" + ', '.join(f"'{id_}'" for id_ in ids) + '];'
    build_text, count = re.subn(r'const reportIds = \[[^\]]*\];', definition, build_text, count=1)
    if count != 1:
        raise ValueError('Cannot update report build allowlist')
    build.write_text(build_text)


def main():
    sources, notes = read_data()
    all_by_company = defaultdict(list)
    for id_, (company, title, _, _, _) in EXISTING.items():
        all_by_company[company].append((id_, title))
    for item in sources:
        all_by_company[item['company']].append((item['id'], notes[item['id']]['heading']))
    for item in sources:
        id_ = item['id']
        related = [pair for pair in all_by_company[item['company']] if pair[0] != id_]
        target = ROOT / 'site-v2/reports' / id_ / 'index.html'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(page(item, notes[id_], related), encoding='utf-8')
    archive_and_home(sources, notes)
    print('Next: node scripts/enhance-search-pages.js (required before validation/build)')
    print(f'Generated {len(sources)} reviewed report pages.')


if __name__ == '__main__':
    main()
