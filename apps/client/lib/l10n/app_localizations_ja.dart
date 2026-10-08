// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Japanese (`ja`).
class AppLocalizationsJa extends AppLocalizations {
  AppLocalizationsJa([String locale = 'ja']) : super(locale);

  @override
  String get appTagline => 'つながって、チャット';

  @override
  String get appName => 'PON';

  @override
  String get notificationsTitle => '通知';

  @override
  String get notificationsSectionUnread => '未読';

  @override
  String get notificationsSectionRead => '既読';

  @override
  String get notificationsEmpty => '通知はまだありません';

  @override
  String get notificationsMarkAllRead => 'すべて既読にする';

  @override
  String get notificationAccept => '承認';

  @override
  String get notificationDecline => '拒否';

  @override
  String notificationFriendRequestTitle(String name) {
    return '$name さんから友達リクエストが届きました';
  }

  @override
  String notificationFriendAcceptedTitle(String name) {
    return '$name さんが友達リクエストを承認しました';
  }

  @override
  String get notificationPhoneSetupTitle => '電話番号を確認';

  @override
  String get notificationPhoneSetupBody =>
      '電話番号を追加して確認すると、友達が見つけやすくなり、アカウントの安全性が高まります。';

  @override
  String get notificationPasswordSetupTitle => 'アカウントを保護';

  @override
  String get notificationPasswordSetupBody =>
      'アカウントにパスワードが設定されていません。安全性を高めるために設定してください。';

  @override
  String get securityTitle => 'パスワードとセキュリティ';

  @override
  String get securitySubtitle => 'パスワードを変更する';

  @override
  String get securityNoPasswordCardSubtitle => 'パスワード未設定';

  @override
  String get securityNoPasswordTitle => 'パスワードがまだ設定されていません';

  @override
  String get securityNoPasswordSubtitle =>
      'アカウントを保護し、メールによる復旧を有効にするためにパスワードを設定してください。';

  @override
  String get securityChangePasswordTitle => 'パスワードを変更';

  @override
  String get securityChangePasswordSubtitle => '現在のパスワードを更新します。';

  @override
  String get securitySetPasswordTitle => 'パスワードを設定';

  @override
  String get securitySetPasswordSubtitle => 'セキュリティ強化のためにアカウントにパスワードを追加します。';

  @override
  String get securitySetButton => 'パスワードを設定';

  @override
  String get securityChangeButton => 'パスワードを変更';

  @override
  String get securitySetSuccess => 'パスワードを設定しました';

  @override
  String get securityTwoFaTitle => '二要素認証';

  @override
  String get securityTwoFaSubtitle => 'アカウントにさらなるセキュリティ層を追加します。';

  @override
  String get securityTwoFaComingSoon => '二要素認証は近日公開予定です。';

  @override
  String get securityComingSoon => '近日公開';

  @override
  String get languageName => '日本語';

  @override
  String get actionCancel => 'キャンセル';

  @override
  String get actionConfirm => '確認';

  @override
  String get actionRetry => '再試行';

  @override
  String get actionSave => '保存';

  @override
  String get actionLogout => 'ログアウト';

  @override
  String get actionDelete => '削除';

  @override
  String get actionLeave => '退出';

  @override
  String get loadingDots => '...';

  @override
  String get loginTitle => 'ログイン';

  @override
  String get fieldEmail => 'メール';

  @override
  String get fieldPassword => 'パスワード';

  @override
  String get forgotPasswordLink => 'パスワードをお忘れですか？';

  @override
  String get loginButton => 'ログイン';

  @override
  String get valEmailRequired => 'メールを入力してください';

  @override
  String get valEmailInvalid => 'メールが無効です';

  @override
  String get valPasswordRequired => 'パスワードを入力してください';

  @override
  String get valPasswordMin6 => 'パスワードは6文字以上です';

  @override
  String get errInvalidCredentials => 'メールまたはパスワードが正しくありません';

  @override
  String get errNetwork => 'サーバーに接続できません。ネットワークを確認してください';

  @override
  String get errSlow => '接続が遅すぎます。再試行してください';

  @override
  String get errSessionExpired => 'セッションの有効期限が切れました';

  @override
  String get errForbidden => 'この操作を行う権限がありません';

  @override
  String get errNotFound => 'データが見つかりません';

  @override
  String get errConflict => 'データはすでに存在します';

  @override
  String get errInvalidData => 'データが無効です';

  @override
  String get errServer => 'サーバーエラーです。後でもう一度お試しください';

  @override
  String errRequestFailed(String code) {
    return 'リクエストに失敗しました（$code）';
  }

  @override
  String get errCancelled => 'リクエストはキャンセルされました';

  @override
  String get errConnection => '接続エラーです。再試行してください';

  @override
  String get errGeneric => 'エラーが発生しました。再試行してください';

  @override
  String get detailsTitle => '詳細';

  @override
  String get themeMenuItem => 'テーマ';

  @override
  String get quickReactionTitle => 'クイックリアクション';

  @override
  String get wallpaperDefaultName => 'デフォルト';

  @override
  String get wallpaperCategoryColors => 'シンプルカラー';

  @override
  String get wallpaperCategoryVibrant => '鮮やかなグラデーション';

  @override
  String get wallpaperCategoryMinimal => 'ミニマル';

  @override
  String get wallpaperShowMore => 'もっと見る';

  @override
  String get wallpaperShowLess => '閉じる';

  @override
  String get wallpaperCategoryThemes => 'テーマ';

  @override
  String get wallpaperThemeForest => '森林';

  @override
  String get wallpaperThemeOcean => '海';

  @override
  String get wallpaperThemeMountain => '雪山';

  @override
  String get wallpaperThemeCherryBlossom => '桜';

  @override
  String get wallpaperThemeSpace => '宇宙';

  @override
  String get wallpaperThemeAurora => 'オーロラ';

  @override
  String get wallpaperThemeCityNight => '夜の街';

  @override
  String get wallpaperThemeDesert => '砂漠';

  @override
  String get wallpaperPresetMidnightGlow => '真夜中の輝き';

  @override
  String get wallpaperPresetNeonTeal => 'ネオンティール';

  @override
  String get wallpaperPresetSunset => 'サンセット';

  @override
  String get wallpaperPresetSweetPink => 'スイートピンク';

  @override
  String get wallpaperPresetDarkShadow => 'ダークシャドウ';

  @override
  String get wallpaperPresetOceanBlue => 'オーシャンブルー';

  @override
  String get wallpaperPresetForestGreen => 'フォレストグリーン';

  @override
  String get wallpaperPresetPurpleHaze => 'パープルヘイズ';

  @override
  String get wallpaperPresetWarmAmber => 'ウォームアンバー';

  @override
  String get wallpaperPresetRoseGold => 'ローズゴールド';

  @override
  String get wallpaperPresetStorm => 'ストーム';

  @override
  String get wallpaperPresetCherryBlossom => '桜';

  @override
  String get wallpaperPresetMidnightPurple => 'ミッドナイトパープル';

  @override
  String get wallpaperPresetCoralReef => 'コーラルリーフ';

  @override
  String get wallpaperPresetArcticIce => 'アークティックアイス';

  @override
  String get wallpaperPresetAurora => 'オーロラ';

  @override
  String get wallpaperPresetGalaxy => 'ギャラクシー';

  @override
  String get wallpaperPresetFireIce => 'ファイア＆アイス';

  @override
  String get wallpaperPresetTropical => 'トロピカル';

  @override
  String get wallpaperPresetCandy => 'キャンディ';

  @override
  String get wallpaperPresetPureDark => 'ピュアダーク';

  @override
  String get wallpaperPresetSoftGray => 'ソフトグレー';

  @override
  String get wallpaperPresetWarmNight => 'ウォームナイト';

  @override
  String get changeChatThemeTitle => 'チャットのテーマを変更';

  @override
  String get uploadImageButton => '画像をアップロード';

  @override
  String get imageFitLabel => '画像の表示方法';

  @override
  String get fitCoverLabel => 'カバー';

  @override
  String get fitContainLabel => '全体表示';

  @override
  String get fitFillLabel => '引き伸ばし';

  @override
  String get errLoginFailed => 'ログインに失敗しました。再試行してください';

  @override
  String get welcomeToApp => 'PON へようこそ';

  @override
  String get fieldDisplayName => '表示名';

  @override
  String get fieldConfirmPassword => 'パスワード（確認）';

  @override
  String get valNameRequired => '名前を入力してください';

  @override
  String get valNameMin2 => '名前は2文字以上です';

  @override
  String get valPasswordMismatch => 'パスワードが一致しません';

  @override
  String get errEmailExists => 'このメールは既に登録されています';

  @override
  String get verifyOtpTitle => 'OTP 認証';

  @override
  String get verifyAccountHeading => 'アカウントを認証';

  @override
  String otpSentTo(String email) {
    return '6桁のOTPを送信しました\n$email';
  }

  @override
  String get fieldOtp => 'OTP コード';

  @override
  String get confirmButton => '確認';

  @override
  String resendIn(int seconds) {
    return '$seconds秒後に再送信';
  }

  @override
  String get resendOtp => 'OTP を再送信';

  @override
  String get otpResent => '新しいOTPコードをメールに送信しました';

  @override
  String get errResendFailed => '再送信に失敗しました。後でもう一度お試しください';

  @override
  String get valOtp6 => 'OTP の6桁を入力してください';

  @override
  String get verifySuccess => '認証に成功しました！今すぐログイン';

  @override
  String get errVerifyFailed => '認証に失敗しました。再試行してください';

  @override
  String get forgotTitle => 'パスワード再設定';

  @override
  String get forgotHeading => 'パスワードをお忘れですか？';

  @override
  String get forgotSubtitle => 'OTPを受け取って新しいパスワードを設定するにはメールを入力してください';

  @override
  String get sendOtpButton => 'OTP を送信';

  @override
  String get errSendRequestFailed => 'リクエストに失敗しました。再試行してください';

  @override
  String get newPasswordTitle => '新しいパスワード';

  @override
  String get newPasswordHeading => '新しいパスワードを作成';

  @override
  String newPasswordSubtitle(String email) {
    return '$email に送信したOTPと\n新しいパスワードを入力してください';
  }

  @override
  String get fieldNewPassword => '新しいパスワード';

  @override
  String get valNewPasswordRequired => '新しいパスワードを入力してください';

  @override
  String get resetPasswordSuccess => 'パスワードを再設定しました！';

  @override
  String get errOtpInvalidExpired => 'OTPが正しくないか、有効期限が切れています';

  @override
  String get errResetFailed => 'パスワードの再設定に失敗しました。再試行してください';

  @override
  String get settingsTitle => '設定';

  @override
  String get valNameEmpty => '名前を空にできません';

  @override
  String get nameUpdated => '表示名を更新しました';

  @override
  String get personalInfo => '個人情報';

  @override
  String get appearance => '外観';

  @override
  String get chooseThemeTitle => 'テーマを選択';

  @override
  String get themeLight => 'ライトテーマ';

  @override
  String get themeDark => 'ダークテーマ';

  @override
  String get themeSystem => 'システム';

  @override
  String get language => '言語';

  @override
  String get chooseLanguageTitle => '言語を選択';

  @override
  String get logoutConfirmBody => 'ログアウトしてもよろしいですか？';

  @override
  String get onboardingChooseTheme => 'テーマを選択';

  @override
  String get onboardingChooseSubtitle => '最も合うインターフェースのスタイルを選んでください。';

  @override
  String get themeLightSubtitle => '明るく、はっきりして読みやすい';

  @override
  String get themeDarkSubtitle => 'モダンで神秘的、目に優しい';

  @override
  String get themeSystemSubtitle => 'デバイスに自動で合わせる';

  @override
  String get startExperience => '体験を始める';

  @override
  String get tooltipSettings => '設定';

  @override
  String get tooltipNewConversation => '新しい会話';

  @override
  String get listLoadFailed => 'リストを読み込めませんでした';

  @override
  String get listCheckNetwork => 'ネットワーク接続を確認して再試行してください。';

  @override
  String get listGenericError => '問題が発生しました。後でもう一度お試しください。';

  @override
  String get emptyConversations => 'まだ会話がありません';

  @override
  String get emptyTapPlus => '下の「+」ボタンをタップして始めましょう！';

  @override
  String get searchConversationsHint => '会話を検索...';

  @override
  String get noConversationsFound => '会話が見つかりません';

  @override
  String get offlineBanner => 'ネットワーク接続がありません';

  @override
  String get conversationDefault => '会話';

  @override
  String get newConversationTitle => '新しい会話';

  @override
  String get startConversationHeading => '会話を始める';

  @override
  String get fieldRecipient => '相手のメールまたはユーザーID';

  @override
  String get valRecipientRequired => 'メールまたはユーザーIDを入力してください';

  @override
  String get errUserNotFoundEmail => 'このメールのユーザーが見つかりません。';

  @override
  String get errUserNotFoundOrConn => 'ユーザーが見つからないか、接続エラーです。';

  @override
  String get startConversationButton => 'チャットを始める';

  @override
  String get chatDefaultTitle => 'チャット';

  @override
  String get statusOnline => 'オンライン';

  @override
  String get statusOffline => 'オフライン';

  @override
  String get typingLabel => '入力中';

  @override
  String get messageHint => 'メッセージを入力…';

  @override
  String get tabChats => 'チャット';

  @override
  String get tabArchived => 'アーカイブ';

  @override
  String get tabRequests => 'リクエスト';

  @override
  String get tabNew => '新規';

  @override
  String get noRequests => '保留中のリクエストはありません';

  @override
  String get declineRequest => '拒否';

  @override
  String get dmRequestSubtitle => 'メッセージを送りたい';

  @override
  String get groupInviteSubtitle => 'グループに招待されました';

  @override
  String get blockedChatsTitle => 'ブロック中のチャット';

  @override
  String get newGroup => '新しいグループ';

  @override
  String get newDirect => '新しいチャット';

  @override
  String get createGroup => 'グループを作成';

  @override
  String get groupName => 'グループ名';

  @override
  String get groupDefaultName => 'グループ';

  @override
  String get valGroupNameRequired => 'グループ名を入力してください';

  @override
  String get selectMembers => 'メンバーを選択';

  @override
  String get valSelectMembers => '2人以上のメンバーを選択してください';

  @override
  String get searchUsers => '名前・メール・電話番号で検索';

  @override
  String get phoneSearchHint => '検索するには完全な電話番号を入力してください';

  @override
  String get groupInfo => 'グループ情報';

  @override
  String get members => 'メンバー';

  @override
  String membersCount(int count) {
    return '$count 人のメンバー';
  }

  @override
  String get addMembers => 'メンバーを追加';

  @override
  String get removeMember => 'グループから削除';

  @override
  String get leaveGroup => 'グループを退出';

  @override
  String get leaveGroupConfirm => 'このグループを退出してもよろしいですか？';

  @override
  String get renameGroup => 'グループ名を変更';

  @override
  String get admin => '管理者';

  @override
  String get you => 'あなた';

  @override
  String get someone => '誰か';

  @override
  String get aiHubTitle => 'AI ハブ';

  @override
  String get aiHubSubtitle => 'AI アシスタントに関するすべて';

  @override
  String get aiHubStartChat => 'PON AI とチャットを開始';

  @override
  String get aiHubMemory => 'メモリ';

  @override
  String get aiHubIntegrations => 'コネクタ';

  @override
  String get aiHubSkills => 'スキル';

  @override
  String get aiHubTokenUsage => '使用量';

  @override
  String systemAddedMember(String actor, String target) {
    return '$actor が $target を追加しました';
  }

  @override
  String systemRemovedMember(String actor, String target) {
    return '$actor が $target を削除しました';
  }

  @override
  String systemLeftGroup(String actor) {
    return '$actor がグループを退出しました';
  }

  @override
  String systemRenamedGroup(String actor, String name) {
    return '$actor がグループ名を $name に変更しました';
  }

  @override
  String systemCreatedGroup(String actor) {
    return '$actor がグループを作成しました';
  }

  @override
  String get actionReply => '返信';

  @override
  String get actionRecall => '送信取消';

  @override
  String get actionEdit => '編集';

  @override
  String get messageEdited => '(編集済み)';

  @override
  String get actionDeleteForMe => '自分から削除';

  @override
  String get actionCopy => 'コピー';

  @override
  String get downloadAction => 'ダウンロード';

  @override
  String get actionReact => 'リアクション';

  @override
  String get messageRecalled => 'メッセージは取り消されました';

  @override
  String get messageSendFailedRetry => '送信に失敗しました。タップして再試行。';

  @override
  String replyingTo(String name) {
    return '$name に返信中';
  }

  @override
  String get copiedToClipboard => 'クリップボードにコピーしました';

  @override
  String get recallConfirm => '全員に対してこのメッセージを取り消しますか？';

  @override
  String get deleteConversation => '会話を削除';

  @override
  String get deleteConversationConfirm => 'この会話を削除しますか？リストから非表示になります。';

  @override
  String get clearHistory => '履歴を消去';

  @override
  String get clearHistoryConfirm => 'この会話のすべてのメッセージをあなたの側で消去しますか？';

  @override
  String get disappearingMessages => '消えるメッセージ';

  @override
  String get disappearingOff => 'オフ';

  @override
  String get disappearing24h => '24 時間';

  @override
  String get disappearing7d => '7 日';

  @override
  String get changeAvatar => 'アバターを変更';

  @override
  String get uploadFailed => 'アップロードに失敗しました。再試行してください';

  @override
  String get lastSeenJustNow => 'たった今オンライン';

  @override
  String lastSeenMinutes(int minutes) {
    return '$minutes 分前にオンライン';
  }

  @override
  String lastSeenHours(int hours) {
    return '$hours 時間前にオンライン';
  }

  @override
  String lastSeenDays(int days) {
    return '$days 日前にオンライン';
  }

  @override
  String get dateToday => '今日';

  @override
  String get dateYesterday => '昨日';

  @override
  String get attachPhoto => '写真';

  @override
  String get attachVideo => '動画';

  @override
  String get attachFile => 'ファイル';

  @override
  String get attachVoice => '音声メッセージ';

  @override
  String get attachSticker => 'スタンプ';

  @override
  String get pinnedMessageTitle => 'ピン留めしたメッセージ';

  @override
  String get pinnedSystemMessage => 'システムメッセージ';

  @override
  String get uploading => 'アップロード中…';

  @override
  String get downloadMedia => 'ダウンロード';

  @override
  String get imageDownloadHd => 'HDで表示';

  @override
  String get attachmentLabel => '📎 添付ファイル';

  @override
  String get callIncoming => '着信';

  @override
  String callIncomingBody(String name) {
    return '$name があなたを呼び出しています';
  }

  @override
  String callCalling(String name) {
    return '$name に発信中…';
  }

  @override
  String get callConnecting => '接続中…';

  @override
  String get callMediaError => 'カメラ/マイクにアクセスできません（HTTPS または localhost が必要）';

  @override
  String get callNoAnswer => '応答がありません';

  @override
  String get callUnknownCaller => '誰か';

  @override
  String get callToggleMic => 'マイクの切り替え';

  @override
  String get callToggleCam => 'カメラの切り替え';

  @override
  String get callLeave => '退出';

  @override
  String get callJoin => '参加';

  @override
  String get callAccept => '応答';

  @override
  String get callDecline => '拒否';

  @override
  String get groupCallTitle => 'グループ通話';

  @override
  String groupCallParticipants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count人の参加者',
      one: '1人の参加者',
    );
    return '$_temp0';
  }

  @override
  String get groupCallNotetakerActive => 'AIがメモを取っています';

  @override
  String get groupCallStartTitle => 'グループ通話を開始';

  @override
  String get groupCallAudio => '音声';

  @override
  String get groupCallVideo => 'ビデオ';

  @override
  String get groupCallNotetakerToggle => 'AIノートテイカー';

  @override
  String get groupCallNotetakerHint => 'AIが会話を聞き取り、終了後に議事録を投稿します。';

  @override
  String get groupCallStartAction => '通話を開始';

  @override
  String activeCallBanner(int count) {
    return 'グループ通話 · $count人が参加中';
  }

  @override
  String get incomingGroupCallTitle => 'グループ通話の着信';

  @override
  String incomingGroupCallBody(String name) {
    return '$nameさんがグループ通話を開始しました';
  }

  @override
  String get meetingSummaryTitle => '議事録';

  @override
  String meetingSummaryDuration(String duration) {
    return '通話時間 $duration';
  }

  @override
  String meetingSummaryAttendees(String names) {
    return '参加者: $names';
  }

  @override
  String get meetingSummaryOverview => '概要';

  @override
  String get meetingSummaryKeyPoints => '要点';

  @override
  String get meetingSummaryActionItems => 'アクションアイテム';

  @override
  String get profileTitle => 'プロフィール';

  @override
  String get profileRoleLabel => 'ロール';

  @override
  String get profileRoleMemberDefault => 'メンバー';

  @override
  String get roleLabel => 'ロール';

  @override
  String get privacySectionLabel => 'プライバシー';

  @override
  String get editProfile => 'プロフィール編集';

  @override
  String get bio => '自己紹介';

  @override
  String friendsCountLabel(int count) {
    return '友達 $count 人';
  }

  @override
  String get messageAction => 'メッセージ';

  @override
  String get activeFriends => 'オンラインの友達';

  @override
  String get noFriendsOnline => 'オンラインの友達はいません';

  @override
  String get strangerBannerTitle => 'メッセージリクエスト';

  @override
  String get strangerBannerBody => 'この人は連絡先にいません。返信するには承認してください。';

  @override
  String get acceptRequest => '承認';

  @override
  String get rejectRequest => '拒否';

  @override
  String get friends => '友達';

  @override
  String get contacts => '連絡先';

  @override
  String get friendRequests => '友達リクエスト';

  @override
  String get addFriend => '友達追加';

  @override
  String get friendRequestSent => '友達リクエストを送信しました';

  @override
  String get acceptFriend => '承認';

  @override
  String get noFriends => 'まだ友達がいません';

  @override
  String get noFriendRequests => '保留中のリクエストはありません';

  @override
  String get friendRequestPending => '保留中';

  @override
  String get friendsTabSearch => '検索';

  @override
  String get declineFriend => '拒否';

  @override
  String get searchUsersPrompt => '友達に追加する人を検索';

  @override
  String get noSearchResults => 'ユーザーが見つかりません';

  @override
  String get unfriend => '友達を解除';

  @override
  String get unfriendConfirm => 'この友達を解除しますか？';

  @override
  String get blockUser => 'ブロック';

  @override
  String get unblockUser => 'ブロック解除';

  @override
  String get blockUserConfirm => 'このユーザーをブロックしますか？お互いにメッセージを送れなくなります。';

  @override
  String get blockedComposerNotice => 'このチャットにはメッセージを送信できません';

  @override
  String get userBlocked => 'ユーザーをブロックしました';

  @override
  String get userUnblocked => 'ブロックを解除しました';

  @override
  String get mentionNotificationTitle => 'あなたへのメンション';

  @override
  String mentionNotificationBody(String name) {
    return '$nameがあなたをメンションしました';
  }

  @override
  String get searchMessages => 'メッセージを検索';

  @override
  String get searchHint => '会話内を検索';

  @override
  String get searchNoResults => 'メッセージが見つかりません';

  @override
  String get exploreChannels => 'チャンネルを探す';

  @override
  String get searchChannelsHint => 'チャンネルを検索…';

  @override
  String get noPublicChannels => '公開チャンネルが見つかりません';

  @override
  String get joinChannel => '参加';

  @override
  String get pinMessage => 'ピン留め';

  @override
  String get unpinMessage => 'ピン留め解除';

  @override
  String get pinnedMessagesTitle => 'ピン留めしたメッセージ';

  @override
  String get pinLimitReached => 'ピン留めできるメッセージは5件までです';

  @override
  String get cannotPinCall => '通話はピン留めできません';

  @override
  String get forwardMessage => '転送';

  @override
  String get messageForwarded => 'メッセージを転送しました';

  @override
  String get forwardFailed => '転送に失敗しました';

  @override
  String get noConversationsToForward => '転送先の会話がありません';

  @override
  String get rateLimitError => 'メッセージを送りすぎています。少し落ち着いてください。';

  @override
  String get sharedMediaTitle => '共有メディアとファイル';

  @override
  String get tabMedia => 'メディア';

  @override
  String get tabFiles => 'ファイル';

  @override
  String get tabLinks => 'リンク';

  @override
  String get noMediaFound => 'メディアが見つかりません';

  @override
  String get noFilesFound => 'ファイルが見つかりません';

  @override
  String get noLinksFound => 'リンクが見つかりません';

  @override
  String get reactionsDetail => 'リアクション';

  @override
  String get changePasswordTitle => 'パスワード変更';

  @override
  String get currentPassword => '現在のパスワード';

  @override
  String get newPassword => '新しいパスワード';

  @override
  String get confirmPassword => '新しいパスワードを再入力';

  @override
  String get dateOfBirth => '生年月日';

  @override
  String get notSet => '未設定';

  @override
  String get passwordChangedSuccess => 'パスワードを正常に変更しました';

  @override
  String get errCurrentPasswordIncorrect => '現在のパスワードが正しくありません';

  @override
  String get changeCoverPhoto => 'カバー写真を変更';

  @override
  String get markAsRead => '既読にする';

  @override
  String get markAsUnread => '未読にする';

  @override
  String get muteNotifications => '通知をミュート';

  @override
  String get unmuteNotifications => 'ミュートを解除';

  @override
  String get viewProfile => 'プロフィールを表示';

  @override
  String get voiceCall => '音声通話';

  @override
  String get videoCall => 'ビデオ通話';

  @override
  String get archiveChat => 'チャットをアーカイブ';

  @override
  String get unarchiveChat => 'アーカイブを解除';

  @override
  String get mutedLabel => 'ミュート中';

  @override
  String get newNotificationTitle => '新しいメッセージ';

  @override
  String newNotificationBody(String name) {
    return '$name さんからメッセージが届きました';
  }

  @override
  String get archivedChats => 'アーカイブされたチャット';

  @override
  String get archivedChatsSubtitle => 'アーカイブした会話を表示';

  @override
  String get emptyArchivedChats => 'アーカイブされたチャットはありません';

  @override
  String get webNoChatSelected => '会話を選択してチャットを始めましょう';

  @override
  String get aiPersonality => 'パーソナリティ';

  @override
  String get aiSkills => 'スキル';

  @override
  String get adminOwnerOnly => '管理者またはオーナーのみ';

  @override
  String get aiConnectedApps => '連携アプリ';

  @override
  String get aiUsage => '使用量';

  @override
  String get chatInfoCategory => 'チャット詳細';

  @override
  String get customizeChatCategory => 'チャットをカスタマイズ';

  @override
  String get filesAndMediaCategory => 'メディア、ファイル、リンク';

  @override
  String get privacyAndSupportCategory => 'プライバシーとサポート';

  @override
  String get callSelectMember => '通話するメンバーを選択';

  @override
  String get profileHideInfo => '個人情報を非表示';

  @override
  String get profileInfoHidden => '個人情報は非表示になっています';

  @override
  String get profileGender => '性別';

  @override
  String get profilePhone => '電話番号';

  @override
  String get profileBio => '自己紹介';

  @override
  String get profileDateOfBirth => '生年月日';

  @override
  String get profileShowDateOfBirth => '誕生日を他のユーザーに表示';

  @override
  String get profileShowPhone => '電話番号を他のユーザーに表示';

  @override
  String get profileShowGender => '性別を他のユーザーに表示';

  @override
  String get phoneVerifiedBadge => '確認済み';

  @override
  String get phoneSendOtp => '確認コードを送信';

  @override
  String get phoneSending => '送信中...';

  @override
  String get phoneChangeNumber => '番号を変更';

  @override
  String get phoneNotVerified => '未確認';

  @override
  String get phoneSendOtpError => 'コードを送信できませんでした。後でもう一度お試しください。';

  @override
  String get phoneVerifyTitle => '電話番号を確認';

  @override
  String phoneOtpSubtitle(String phone) {
    return '$phone に送信された6桁のコードを入力してください';
  }

  @override
  String get phoneOtpIncomplete => '6桁すべて入力してください';

  @override
  String get phoneOtpInvalid => 'コードが正しくないか、有効期限が切れています';

  @override
  String get phoneVerifiedSuccess => '電話番号が確認されました！';

  @override
  String get phoneVerifying => '確認中...';

  @override
  String get phoneConfirm => '確認';

  @override
  String get phoneHint => '901 234 567';

  @override
  String get phoneNoNumber => '電話番号がありません';

  @override
  String get phoneNoticeText => 'アカウントのセキュリティを高めるために電話番号を追加してください。';

  @override
  String get phoneVerifyAction => '認証';

  @override
  String get phoneUnverifiedBadge => '未認証';

  @override
  String get phoneModalPhoneSubtitle => '認証コードを受け取る電話番号を入力してください。';

  @override
  String get phoneRateLimit => '新しいコードをリクエストするまで少しお待ちください。';

  @override
  String get phoneAlreadyTaken => 'この電話番号は既に使用されています。';

  @override
  String get phoneInvalidNumber => '電話番号が無効です。';

  @override
  String get phoneOtpExpired => 'コードの有効期限が切れました。新しいコードをリクエストしてください。';

  @override
  String get phoneResend => 'コードを再送信';

  @override
  String phoneResendCountdown(int seconds) {
    return '$seconds秒後に再送信';
  }

  @override
  String get profilePrivacySection => 'プライバシー';

  @override
  String get profileEditMode => 'プロフィール編集';

  @override
  String get profileSave => '保存';

  @override
  String get actionMessage => 'メッセージ';

  @override
  String get actionAddFriend => '友達追加';

  @override
  String get actionBlock => 'ブロック';

  @override
  String get readDetails => '既読詳細';

  @override
  String get seenStatus => '既読';

  @override
  String get noReadsYet => 'まだ誰も読んでいません';

  @override
  String get voiceMicTooltip => '音声メッセージ';

  @override
  String get recording => '録音中...';

  @override
  String get stickerLabel => 'スタンプ';

  @override
  String get emojiTab => '絵文字';

  @override
  String get aiAssistant => 'AIアシスタント';

  @override
  String get startChatWithAI => 'PON AIとチャット';

  @override
  String get aiThinking => 'AIが考え中...';

  @override
  String get aiError => 'AIは一時的に利用できません。もう一度お試しください。';

  @override
  String get aiErrStreamInterrupted => 'AIストリームが中断されました。もう一度お試しください。';

  @override
  String get aiErrUnavailable => 'AIは一時的に利用できません。';

  @override
  String get aiErrRateLimited => 'AI へのリクエストが多すぎます。少し時間をおいて再試行してください。';

  @override
  String get feedbackHelpful => '役に立った';

  @override
  String get feedbackNotHelpful => '役に立たない';

  @override
  String get feedbackCommentHint => '問題点を教えてください（任意）';

  @override
  String get feedbackThanks => 'フィードバックありがとうございます';

  @override
  String get feedbackSend => '送信';

  @override
  String get feedbackError => 'フィードバックを送信できませんでした。もう一度お試しください。';

  @override
  String get aiSensitiveAction => '重要な操作';

  @override
  String get sourcesLabel => '出典';

  @override
  String get aiErrorRetry => '再試行';

  @override
  String get aiMessageDeleted => 'メッセージが削除されました';

  @override
  String get viewAiMemory => 'メモリを表示';

  @override
  String get kbTitle => 'ナレッジベース';

  @override
  String get kbEmptyState =>
      'ドキュメントがありません。\nアップロードボタンをタップして PDF、DOCX、TXT ファイルを追加してください。';

  @override
  String get kbUploadButton => 'ドキュメントをアップロード';

  @override
  String get kbDeleteConfirm => 'このドキュメントを削除しますか？';

  @override
  String get kbProcessing => '処理中';

  @override
  String get kbReady => '準備完了';

  @override
  String get kbError => 'エラー';

  @override
  String get kbManage => 'ナレッジベース';

  @override
  String get kbSources => 'ソース';

  @override
  String get kbChunks => 'チャンク';

  @override
  String aiToolCalling(String toolName) {
    return 'ツールを使用中：$toolName';
  }

  @override
  String get aiToolTrace => 'ツールログ';

  @override
  String get toolSearchMessages => 'メッセージを検索中...';

  @override
  String get toolGetUserInfo => 'ユーザー情報を取得中...';

  @override
  String get toolSearchKnowledgeBase => 'ナレッジベースを検索中...';

  @override
  String get toolSummarizeConversation => '会話を要約中...';

  @override
  String get toolCreateReminder => 'リマインダーを作成中...';

  @override
  String get reminders => 'リマインダー';

  @override
  String get remindersEmpty => '保留中のリマインダーはありません。\nPON AIにリマインダーを設定してもらいましょう。';

  @override
  String get reminderDone => '完了としてマーク';

  @override
  String get tokenUsage => 'トークン使用量';

  @override
  String get tokenUsageTitle => 'トークン使用量ダッシュボード';

  @override
  String get tokenUsageSelectRange => '期間を選択';

  @override
  String get tokenUsageDateRangeError => '開始日は終了日より前である必要があります';

  @override
  String get coverPhotoPreviewTitle => 'カバー写真をプレビュー';

  @override
  String get saveCoverPhoto => 'カバーに設定';

  @override
  String get tokenUsageThisMonth => '今月の合計トークン';

  @override
  String get tokenUsageRequests => 'AIリクエスト数';

  @override
  String get tokenUsageEstCost => '推定コスト (USD)';

  @override
  String get tokenUsageDailyChart => '日別トークン使用量（過去30日）';

  @override
  String get aiTraceTitle => 'AIトレース';

  @override
  String get aiTraceThinking => '思考';

  @override
  String get aiTraceTools => 'ツール呼び出し';

  @override
  String get aiTraceStats => '統計';

  @override
  String get aiPersonaTitle => 'AIペルソナ';

  @override
  String get avatarUploadLabel => 'アバターを変更';

  @override
  String get aiPersonaNameHint => 'ボット名（例：DevBot）';

  @override
  String get aiPersonaInstructionsHint => 'カスタム指示（例：常に箇条書きで回答する）';

  @override
  String get aiPersonaAdminOnly => 'グループ管理者のみがAIペルソナを設定できます。';

  @override
  String get configureAiPersona => 'AIペルソナを設定';

  @override
  String get aiPersonaToneFriendly => 'フレンドリー';

  @override
  String get aiPersonaToneProfessional => 'プロフェッショナル';

  @override
  String get aiPersonaToneConcise => '簡潔';

  @override
  String get aiPersonaToneCreative => 'クリエイティブ';

  @override
  String get aiQuotaExceeded => '月間AI使用量の上限を超えました。管理者にお問い合わせください。';

  @override
  String get viewUsage => '使用量を確認';

  @override
  String get tokenUsageQuota => '月間クォータ';

  @override
  String get errEmailDomainInvalid => 'このメールアドレスは存在しません';

  @override
  String get valPasswordMin8 => 'パスワードは8文字以上で入力してください';

  @override
  String get valPasswordUppercase => '大文字（A-Z）を含める必要があります';

  @override
  String get valPasswordLowercase => '小文字（a-z）を含める必要があります';

  @override
  String get valPasswordDigit => '数字（0-9）を含める必要があります';

  @override
  String get valPasswordSpecial => '特殊文字（!@#\$%^&*）を含める必要があります';

  @override
  String get pwStrengthWeak => '弱い';

  @override
  String get pwStrengthMedium => '普通';

  @override
  String get pwStrengthStrong => '強い';

  @override
  String get pwStrengthVeryStrong => '非常に強い';

  @override
  String get pwReqLength => '8文字以上';

  @override
  String get pwReqUppercase => '大文字（A-Z）';

  @override
  String get pwReqLowercase => '小文字（a-z）';

  @override
  String get pwReqDigit => '数字（0-9）';

  @override
  String get pwReqSpecial => '特殊文字（!@#\$...）';

  @override
  String get loginWithGoogle => 'Googleでサインイン';

  @override
  String get orContinueWith => 'または次で続行';

  @override
  String agreeToTerms(String privacyPolicy, String termsOfService) {
    return '$privacyPolicyと$termsOfServiceに同意します';
  }

  @override
  String get privacyPolicy => 'プライバシーポリシー';

  @override
  String get termsOfService => '利用規約';

  @override
  String get valMustAgreeTerms => '続行するには利用規約に同意する必要があります';

  @override
  String get youColon => 'あなた:';

  @override
  String get systemNicknameChanged => 'ニックネームが変更されました';

  @override
  String get systemThemeChanged => 'チャットテーマが変更されました';

  @override
  String get systemQuickReactionChanged => 'クイックリアクションが変更されました';

  @override
  String get wallpaperUploadError => '画像のアップロードに失敗しました';

  @override
  String get wallpaperScale => '拡大率';

  @override
  String get wallpaperPreviewHint => 'ピンチまたはドラッグで調整';

  @override
  String get wallpaperPreviewIncoming => 'こんにちは！これはどうですか？';

  @override
  String get wallpaperPreviewOutgoing => 'いい感じですね 🎉';

  @override
  String get errCannotOpenLink => 'リンクを開けませんでした';

  @override
  String sysNicknameClearedSelf(String actorName) {
    return '$actorNameが自分のニックネームを削除しました';
  }

  @override
  String sysNicknameClearedOther(String actorName, String targetName) {
    return '$actorNameが$targetNameのニックネームを削除しました';
  }

  @override
  String sysNicknameSetSelf(String actorName, String nickname) {
    return '$actorNameが自分のニックネームを$nicknameに設定しました';
  }

  @override
  String sysNicknameSetOther(
      String actorName, String targetName, String nickname) {
    return '$actorNameが$targetNameのニックネームを$nicknameに設定しました';
  }

  @override
  String sysThemeChanged(String actorName) {
    return '$actorNameがチャットのテーマを変更しました';
  }

  @override
  String sysQuickReactionChanged(String actorName, String emoji) {
    return '$actorNameがクイックリアクションを$emojiに変更しました';
  }

  @override
  String sysGroupCreated(String actorName) {
    return '$actorNameがグループを作成しました';
  }

  @override
  String sysMembersAdded(String actorName) {
    return '$actorNameが新しいメンバーを追加しました';
  }

  @override
  String sysMemberLeft(String actorName) {
    return '$actorNameがグループから退出しました';
  }

  @override
  String sysMemberRemoved(String actorName) {
    return '$actorNameがメンバーを削除しました';
  }

  @override
  String sysMemberJoined(String actorName) {
    return '$actorNameがグループに参加しました';
  }

  @override
  String sysPinnedMessage(String actorName) {
    return '$actorName さんがメッセージをピン留めしました';
  }

  @override
  String sysUnpinnedMessage(String actorName) {
    return '$actorName さんがメッセージのピン留めを解除しました';
  }

  @override
  String systemVideoCallEnded(String duration) {
    return 'ビデオ通話が終了しました · $duration';
  }

  @override
  String systemVoiceCallEnded(String duration) {
    return '音声通話が終了しました · $duration';
  }

  @override
  String get systemVideoCallMissed => '不在着信（ビデオ通話）';

  @override
  String get systemVoiceCallMissed => '不在着信（音声通話）';

  @override
  String get errActionFailed => '問題が発生しました。もう一度お試しください。';

  @override
  String get kbDeleteFailed => '削除に失敗しました。もう一度お試しください';

  @override
  String get exploreJoinFailed => 'チャンネルに参加できませんでした';

  @override
  String get unnamedChannel => '名称未設定';

  @override
  String get actionOk => 'OK';

  @override
  String get reminderDeleteConfirm => 'このリマインダーを削除しますか？';

  @override
  String get profileNameLabel => '名前';

  @override
  String get genderMale => '男性';

  @override
  String get genderFemale => '女性';

  @override
  String get genderOther => 'その他';

  @override
  String get aiPersonaSaved => '保存しました';

  @override
  String get aiPersonaResetTitle => 'AIペルソナをリセット';

  @override
  String get aiPersonaResetConfirm => 'AIペルソナを既定の設定にリセットしますか？';

  @override
  String get aiPersonaToneLabel => 'トーン';

  @override
  String get aiPersonaResetToDefault => '既定値に戻す';

  @override
  String tokenUsagePercentUsed(String percent) {
    return '今月 $percent% 使用';
  }

  @override
  String tokenUsageCostUsd(String amount) {
    return '$amount ドル';
  }

  @override
  String get notifications => '通知';

  @override
  String get notificationsEnabled => '通知は有効です';

  @override
  String get notificationsDisabled => '通知は無効です';

  @override
  String get legalScreenTitle => 'プライバシーと規約';

  @override
  String get legalLastUpdated => '最終更新：2026年6月15日';

  @override
  String get legalDataCollectionTitle => '1. データ収集';

  @override
  String get legalDataCollectionContent =>
      '当社は、アカウントの作成・変更、サービスの利用、または当社との通信など、お客様が直接提供する情報（名前、メールアドレス、プロフィール写真、送信したメッセージなど）を収集します。';

  @override
  String get legalDataUsageTitle => '2. データの利用方法';

  @override
  String get legalDataUsageContent =>
      'お客様のデータは、ユーザー間のコミュニケーション促進、セキュリティの確保、エクスペリエンスのパーソナライズを含む、サービスの提供・維持・改善のために使用されます。';

  @override
  String get legalSecurityTitle => '3. セキュリティ';

  @override
  String get legalSecurityContent =>
      '当社は、お客様の個人情報とメッセージを保護するために業界標準のセキュリティ対策を実施しています。データへのアクセスは厳格に管理され、機密情報の保護には暗号化を使用しています。';

  @override
  String get legalUserRightsTitle => '4. お客様の権利';

  @override
  String get legalUserRightsContent =>
      'お客様は、個人データへのアクセス、修正、または削除を行う権利があります。アプリケーション設定からいつでもアカウントを削除できます。';

  @override
  String get legalTermsTitle => '5. 利用規約';

  @override
  String get legalTermsContent =>
      '当社のプラットフォームを使用することで、虐待、嫌がらせ、または違法行為に関与しないことに同意したものとみなされます。当社は、これらの規約に違反するアカウントを停止または終了する権利を留保します。';

  @override
  String get authMsgLoginSuccess => 'ログインに成功しました。';

  @override
  String get authMsgLogoutSuccess => 'ログアウトしました。';

  @override
  String get authMsgOtpSent => 'OTPがメールに送信されました。';

  @override
  String get authMsgOtpValid => 'OTPの認証に成功しました。';

  @override
  String get authMsgOtpResent => '新しいOTPが送信されました。';

  @override
  String get authMsgPasswordUpdated => 'パスワードが更新されました。再度ログインしてください。';

  @override
  String get authMsgAccountUnverifiedOtpSent =>
      'アカウントはまだ確認されていません。新しいOTPがメールに送信されました。';

  @override
  String get authErrOtpInvalid => 'OTPコードが無効です。';

  @override
  String get authErrOtpExpired => 'OTPの有効期限が切れました。';

  @override
  String get authErrOtpAttemptsExceeded => '試行回数が超過しました。新しいOTPを申請してください。';

  @override
  String authErrOtpWrongWithRemaining(int remaining) {
    return 'OTPが正しくありません。残り$remaining回の試行があります。';
  }

  @override
  String authErrOtpResendCooldown(int ttl) {
    return '新しいOTPを申請する前に$ttl秒お待ちください。';
  }

  @override
  String get authErrOtpSendFailed => '現在、認証コードを送信できません。しばらくしてからもう一度お試しください。';

  @override
  String get authErrEmailNotFound => 'このメールアドレスはシステムに存在しません。';

  @override
  String get authErrValEmailInvalid => 'メールの形式が無効です。';

  @override
  String get authErrValEmailRequired => 'メールは必須です。';

  @override
  String get authErrValDisplaynameRequired => '表示名は必須です。';

  @override
  String get authErrValDisplaynameTooShort => '表示名が短すぎます（最低2文字）。';

  @override
  String get authErrValPasswordTooShort => 'パスワードは8文字以上である必要があります。';

  @override
  String authErrAccountLocked(int minutes) {
    return 'ログイン失敗が多すぎるため、アカウントが$minutes分間ロックされました。';
  }

  @override
  String authErrLoginFailedWithRemaining(int remaining) {
    return 'メールアドレスまたはパスワードが正しくありません。残り$remaining回の試行があります。';
  }

  @override
  String authErrLoginFailedLocked(int minutes) {
    return 'ログイン試行回数が超過しました。アカウントが$minutes分間ロックされました。';
  }

  @override
  String get authErrTokenInvalid => 'トークンが無効です。';

  @override
  String get authErrSessionNotFound => 'セッションが見つからないか、有効期限が切れました。';

  @override
  String get authErrSessionInvalid => 'セッションが存在しないか、有効期限が切れました。';

  @override
  String get authErrSessionRevoked => 'セッションが取り消されました。';

  @override
  String get authErrRefreshTokenReuse =>
      'セキュリティ警告：リフレッシュトークンの再利用が検出されました。すべてのセッションが取り消されました。';

  @override
  String get authErrRefreshTokenInvalid => 'リフレッシュトークンが無効です。';

  @override
  String get authErrRefreshTokenRotated => 'リフレッシュトークンはすでにローテーションされています。';

  @override
  String get authErrTokenSessionMismatch => 'トークンがセッションと一致しません。';

  @override
  String get authErrSocialEmailUnavailable => 'ソーシャルアカウントからメールを取得できません。';

  @override
  String get authErrLoginCodeInvalid => 'ログインコードが無効または有効期限が切れています。';

  @override
  String get authErrUserNotFound => 'ユーザーが見つかりません。';

  @override
  String get integrationsTitle => '連携';

  @override
  String get integrationsSubtitle =>
      '一度アカウントを接続するだけ。あとはアシスタントにメッセージを送るだけで、あなたの権限の範囲内で代わりに動きます。';

  @override
  String get integrationsSettingsSubtitle => 'アシスタントが使えるツールを接続';

  @override
  String get connectorStatusConnected => '接続済み';

  @override
  String get connectorStatusAvailable => '利用可能';

  @override
  String get connectorStatusComingSoon => '近日公開';

  @override
  String get connectorConnect => '接続';

  @override
  String get connectorManage => '管理';

  @override
  String get connectorDisconnect => '切断';

  @override
  String get connectorDisconnectConfirm =>
      'このアカウントを切断しますか？アシスタントはツールを使えなくなります。';

  @override
  String get connectorOpenFailed => '認証ページを開けませんでした。';

  @override
  String get customMcpTitle => 'カスタム MCP サーバーを追加';

  @override
  String get customMcpSubtitle =>
      '任意の MCP サーバーをアシスタントに指定します。ツールを検出し、アシスタントが使えるようになります。';

  @override
  String get customMcpName => '名前';

  @override
  String get customMcpUrl => 'サーバー URL';

  @override
  String get customMcpAuth => '認証';

  @override
  String get customMcpAuthNone => 'なし';

  @override
  String get customMcpAuthApiKey => 'API キー';

  @override
  String get customMcpAuthOauth => 'OAuth';

  @override
  String get customMcpCredential => '認証情報';

  @override
  String get customMcpDiscover => 'ツールを検出';

  @override
  String get customMcpSave => '保存';

  @override
  String get customMcpSaved => 'カスタム MCP サーバーを追加しました。';

  @override
  String customMcpToolsFound(int count) {
    return '$count 個のツールを検出';
  }

  @override
  String get permissionsTitle => 'AI の権限';

  @override
  String get permissionsSubtitle => 'このコネクターを通じてアシスタントが実行できる操作を選択します。';

  @override
  String get permView => '閲覧';

  @override
  String get permCreate => '作成';

  @override
  String get permEdit => '編集';

  @override
  String get permDelete => '削除';

  @override
  String get permViewDesc => 'データの読み取り、検索、要約（読み取り専用）。';

  @override
  String get permCreateDesc => 'ファイル、イベント、レコードなどの新規項目を追加します。';

  @override
  String get permEditDesc => '既存の項目とその内容を変更します。';

  @override
  String get permDeleteDesc => '項目を完全に削除します。';

  @override
  String get permManage => '権限';

  @override
  String get permSaved => '権限を更新しました。';

  @override
  String get skillsTitle => 'スキル';

  @override
  String get skillsSubtitle =>
      'スキルはツール群と働き方をまとめたものです。必要なものだけオンにしてください。各スキルが必要条件を示します。';

  @override
  String get skillsRealActionNote =>
      'スキルはアシスタントの考え方や話し方を変えます。実際に操作させる（メール送信、予定作成、Notion への書き込みなど）には、下の対応アプリを連携してください。';

  @override
  String get skillsSettingsSubtitle => 'アシスタントの得意分野を選ぶ';

  @override
  String skillNeeds(String requirements) {
    return '$requirements が必要';
  }

  @override
  String get skillSchedulerName => 'スケジューラー';

  @override
  String get skillSchedulerDesc =>
      '会議の時間を提案し招待状の下書きを作成します——送信はカレンダー/メールアプリでご自身で行ってください（Google カレンダー/Gmail を連携すると直接操作できます）。';

  @override
  String get skillMailWriterName => 'メール作成';

  @override
  String get skillMailWriterDesc => 'あなたの口調で返信を下書きし、長いスレッドを要約します。';

  @override
  String get skillResearcherName => 'リサーチャー';

  @override
  String get skillResearcherDesc =>
      'この会話の内容と既存の知識をもとに回答し、可能な場合は出典を示します——リアルタイムのウェブ検索ではありません。';

  @override
  String get skillProjectKeeperName => 'プロジェクト管理';

  @override
  String get skillProjectKeeperDesc =>
      '会話の中でタスク・担当者・決定事項を記録して要約します——Notion を連携すると実際に書き込めます。';

  @override
  String get skillMeetingNotesName => '議事録';

  @override
  String get skillMeetingNotesDesc => '会議を要約し、決定事項とアクションアイテムを抽出します。';

  @override
  String get skillInboxTriageName => '受信トレイ整理';

  @override
  String get skillInboxTriageDesc => 'メッセージに優先順位を付け、すばやい返信を提案します。';

  @override
  String get skillDataAnalystName => 'データアナリスト';

  @override
  String get skillDataAnalystDesc => '表や数値を分析し、傾向や外れ値を浮き彫りにします。';

  @override
  String get skillDocDrafterName => 'ドキュメント作成';

  @override
  String get skillDocDrafterDesc => '構造化された提案書、仕様書、レポートを作成します。';

  @override
  String get skillTranslatorName => '翻訳';

  @override
  String get skillTranslatorDesc => '言語をまたいで自然にテキストを翻訳・ローカライズします。';

  @override
  String get skillWebSearchName => 'ウェブ検索';

  @override
  String get skillWebSearchDesc => '最新情報をウェブで検索し、出典を引用します。';

  @override
  String get skillWeatherForecastName => '天気予報';

  @override
  String get skillWeatherForecastDesc => 'あらゆる場所の天気と予報を調べます。';

  @override
  String get adminTitle => '管理コンソール';

  @override
  String get adminSubtitle => 'ワークスペース、部門、メンバー、ロールを管理';

  @override
  String get adminBack => '戻る';

  @override
  String get adminLoading => '読み込み中…';

  @override
  String get adminSave => '保存';

  @override
  String get adminSaving => '保存中…';

  @override
  String get adminCancel => 'キャンセル';

  @override
  String get adminToastSaved => '保存しました';

  @override
  String get adminToastDeleted => '削除しました';

  @override
  String get adminToastError => 'エラーが発生しました';

  @override
  String get adminMenu => '管理';

  @override
  String get adminSettingsSubtitle => 'ワークスペース、部門、メンバー、ロール';

  @override
  String get adminNavWorkspace => 'ワークスペース';

  @override
  String get adminNavDepartments => '部門';

  @override
  String get adminNavMembers => 'メンバー';

  @override
  String get adminNavRoles => 'ロール';

  @override
  String get adminNavAudit => '監査ログ';

  @override
  String get adminNavAi => 'AI アシスタント';

  @override
  String get adminAiInheritHint => '空欄または「継承」でサーバー既定値を使用します。';

  @override
  String get adminAiInheritOption => '継承（既定）';

  @override
  String get adminAiOn => 'オン';

  @override
  String get adminAiOff => 'オフ';

  @override
  String get adminAiPersonaSection => 'ペルソナ';

  @override
  String get adminAiPersonaName => '既定のアシスタント名';

  @override
  String get adminAiTone => '既定のトーン';

  @override
  String get adminAiToneFriendly => 'フレンドリー';

  @override
  String get adminAiToneProfessional => 'プロフェッショナル';

  @override
  String get adminAiToneConcise => '簡潔';

  @override
  String get adminAiToneCreative => '創造的';

  @override
  String get adminAiModelSection => 'モデル';

  @override
  String get adminAiModelTier => '既定のモデルティア';

  @override
  String get adminAiTierAuto => '自動（ルーター）';

  @override
  String get adminAiTierSimple => 'シンプル';

  @override
  String get adminAiTierMid => 'バランス';

  @override
  String get adminAiTierComplex => '高度';

  @override
  String get adminAiCapabilitiesSection => '機能';

  @override
  String get adminAiWebSearch => 'ウェブ検索';

  @override
  String get adminAiWebSearchDesc => 'アシスタントによるウェブ検索を許可します。';

  @override
  String get adminAiThinking => '拡張思考';

  @override
  String get adminAiThinkingDesc => 'アシスタントの段階的な推論を許可します。';

  @override
  String get adminAiDigestSection => 'デイリーダイジェスト';

  @override
  String get adminAiDailyDigest => 'デイリーダイジェスト';

  @override
  String get adminAiDailyDigestDesc => '各 AI 会話のアクティビティを 1 日 1 回まとめて投稿します。';

  @override
  String get adminAiDailyDigestHour => '配信時刻';

  @override
  String get adminAiDailyDigestHourDesc =>
      'ダイジェストを配信する現地時刻。ダイジェストが有効な場合に設定できます。';

  @override
  String get adminAiQuotaSection => '使用上限';

  @override
  String get adminAiTokenLimit => '月間トークン上限';

  @override
  String get adminAiTokenLimitDesc => '空欄で継承。0 ですべての使用を遮断します。';

  @override
  String get adminAiConnectorsSection => '許可するコネクタ';

  @override
  String get adminAiRestrictConnectors => 'AI のコネクタを制限';

  @override
  String get adminAiConnectorsInherit => 'ワークスペースの許可リストを継承します。';

  @override
  String get adminAiConnectorsExplicit => 'AI は下で選択したコネクタのみ使用できます。';

  @override
  String get adminWsIdentity => 'アイデンティティとブランディング';

  @override
  String get adminWsName => 'ワークスペース名';

  @override
  String get adminWsNamePlaceholder => 'Acme 株式会社';

  @override
  String get adminWsLogoUrl => 'ロゴ URL';

  @override
  String get adminWsPrimaryColor => 'プライマリカラー';

  @override
  String get adminWsFeatures => '機能フラグ';

  @override
  String get adminWsNoFeatures => '機能フラグは設定されていません。';

  @override
  String get adminWsAllowList => 'コネクタ許可リスト';

  @override
  String get adminWsAllowListDesc => 'メンバーが個人で接続できるコネクタ。';

  @override
  String get adminWsNoCatalog => '利用可能なコネクタがありません。';

  @override
  String get adminDeptNew => '新しい部門';

  @override
  String get adminDeptEdit => '部門を編集';

  @override
  String get adminDeptEmpty => '部門がまだありません。';

  @override
  String get adminDeptLead => 'リーダー';

  @override
  String get adminDeptLeadNone => 'なし';

  @override
  String get adminDeptName => '名前';

  @override
  String get adminDeptDescription => '説明';

  @override
  String get adminDeptDialogDesc => '部門はメンバーをまとめ、部門チャットを持ちます。';

  @override
  String adminDeptDeleteConfirm(String name) {
    return '部門「$name」を削除しますか？';
  }

  @override
  String get adminMemberHint => '各メンバーにロールと部門を割り当てます。';

  @override
  String get adminMemberEdit => 'メンバーを編集';

  @override
  String get adminMemberRevokeNote => '保存するとメンバーのアクティブなセッションが取り消されます。';

  @override
  String get adminMemberRole => 'ロール';

  @override
  String get adminMemberRoleNone => 'なし';

  @override
  String get adminMemberRoleLockedSelf => '自分のロールは変更できません。';

  @override
  String get adminMemberRoleLockedOwner => 'オーナーのロールを変更できるのはオーナーのみです。';

  @override
  String get adminMemberDepartments => '部門';

  @override
  String get adminRoleHint => '各ロールの権限を切り替えます。Owner ロールは読み取り専用です。';

  @override
  String get adminRoleCapability => '権限';

  @override
  String get adminRolePreset => 'プリセット';

  @override
  String get adminRoleClone => '複製';

  @override
  String adminRoleCloneTitle(String name) {
    return '$name を複製';
  }

  @override
  String get adminRoleName => 'ロール名';

  @override
  String get adminAuditTitle => '監査ログ';

  @override
  String get adminAuditComingSoon => '監査ログは今後のアップデートで利用可能になります。';

  @override
  String get adminCapManageWorkspace => 'ワークスペースを管理';

  @override
  String get adminCapManageDepartments => '部門を管理';

  @override
  String get adminCapManageMembers => 'メンバーを管理';

  @override
  String get adminCapManageRoles => 'ロールを管理';

  @override
  String get adminCapConnectWorkspaceConnector => 'ワークスペースコネクタを接続';

  @override
  String get adminCapAddCustomMcp => 'カスタム MCP を追加';

  @override
  String get adminCapConnectPersonalConnector => '個人コネクタを接続';

  @override
  String get adminCapUsePersonalAssistant => '個人アシスタントを使用';

  @override
  String get adminCapUseGroupBot => 'グループボットを使用';

  @override
  String get adminCapRunSensitiveSkill => '機密スキルを実行';

  @override
  String get adminCapViewAuditLog => '監査ログを表示';

  @override
  String get adminAuditEmpty => '監査記録はまだありません。';

  @override
  String get adminAuditPrev => '前へ';

  @override
  String get adminAuditNext => '次へ';

  @override
  String get newConvDepartment => '部門（任意）';

  @override
  String get newConvNoDepartment => '部門なし';

  @override
  String get loginWithSso => 'SSO でログイン';

  @override
  String get adminNavSso => 'SSO';

  @override
  String get adminSsoTitle => 'シングルサインオン (SSO)';

  @override
  String get adminSsoHint =>
      'OIDC ログインを設定します。プロバイダーの認証情報は .env で設定し、ここで IdP グループをロールと部門にマッピングします。';

  @override
  String get adminSsoEnabled => 'SSO を有効化';

  @override
  String get adminSsoAllowedDomains => '許可するメールドメイン';

  @override
  String get adminSsoAllowedDomainsHint => 'カンマ区切り。空欄の場合、確認済みのすべてのメールを許可します。';

  @override
  String get adminSsoDefaultRole => 'デフォルトのロール';

  @override
  String get adminSsoNone => 'なし';

  @override
  String get adminSsoGroupRoleMap => 'グループ → ロール';

  @override
  String get adminSsoGroupDeptMap => 'グループ → 部門';

  @override
  String get adminSsoGroupPlaceholder => 'IdP グループ名';

  @override
  String get adminSsoAddMapping => 'マッピングを追加';

  @override
  String get sectionDirectoryTitle => 'MCP ディレクトリ';

  @override
  String get sectionDirectoryDesc =>
      'MCP サーバーを閲覧してワンクリックで接続——OAuth は自動で実行されます。';

  @override
  String get directoryAdd => '項目を追加';

  @override
  String get directorySearch => 'ディレクトリを検索…';

  @override
  String get directoryEmpty => '検索に一致する項目がありません。';

  @override
  String get directoryEdit => '項目を編集';

  @override
  String get directoryDelete => '項目を削除';

  @override
  String get tierWorkspace => 'ワークスペース';

  @override
  String get tierPersonal => '個人';

  @override
  String get tierBoth => '個人 / ワークスペース';

  @override
  String get directorySaveSuccess => 'ディレクトリ項目を保存しました。';

  @override
  String get directoryDeleteSuccess => 'ディレクトリ項目を削除しました。';

  @override
  String get directoryAddTitle => 'ディレクトリ項目を追加';

  @override
  String get directoryEditTitle => 'ディレクトリ項目を編集';

  @override
  String get directoryDialogDesc => 'メンバーがワンクリックで接続できる公開 MCP サーバーを追加します。';

  @override
  String get directorySlug => 'スラッグ';

  @override
  String get directoryName => '名前';

  @override
  String get directoryDescription => '説明';

  @override
  String get directoryMcpUrl => 'MCP URL';

  @override
  String get directoryAuthMode => '認証モード';

  @override
  String get directoryTier => '範囲';

  @override
  String get directoryEnvHint =>
      'env-oauth の場合：OAuth クライアント資格情報を保持する環境変数を参照します。';

  @override
  String get directoryEnvClientId => 'Client ID 環境変数';

  @override
  String get directoryEnvClientSecret => 'Client secret 環境変数';

  @override
  String get directoryAuthorizeUrl => '認可 URL';

  @override
  String get directoryTokenUrl => 'トークン URL';

  @override
  String get directoryCancel => 'キャンセル';

  @override
  String get directorySave => '保存';

  @override
  String directoryKeyTitle(String provider) {
    return '$provider に接続';
  }

  @override
  String get directoryKeyLabel => 'API キー';

  @override
  String directoryConnected(String provider) {
    return '$provider に接続しました。';
  }

  @override
  String get editNicknames => 'ニックネームを編集';

  @override
  String get nicknameModalTitle => 'ニックネーム';

  @override
  String get nicknameNonePlaceholder => 'ニックネームなし';

  @override
  String get nicknameYouSuffix => '（あなた）';

  @override
  String get adminNavUsage => '使用状況';

  @override
  String get usageThisMonth => '今月';

  @override
  String get usageTotalTokens => '合計トークン';

  @override
  String get usageRequests => 'リクエスト数';

  @override
  String get usageEstCost => '推定コスト';

  @override
  String get usageThumbsDownRate => '低評価率';

  @override
  String usageFeedbackBreakdown(int down, int total) {
    return '$total 件中 $down 件';
  }

  @override
  String get usagePerModelTitle => 'モデル別コスト';

  @override
  String usageModelTokens(String input, String output, String requests) {
    return '入力 $input / 出力 $output · $requests 件';
  }

  @override
  String get usageTopUsersTitle => '上位ユーザー';

  @override
  String usageUserRequests(int count) {
    return '$count 件のリクエスト';
  }

  @override
  String get usageWorstAnswersTitle => '低評価の回答';

  @override
  String get usageNoPreview => '（回答プレビューなし）';

  @override
  String usageUserComment(String comment) {
    return '「$comment」';
  }

  @override
  String get usageNoData => 'この期間のデータはありません。';

  @override
  String get usageLoadError => '使用状況ダッシュボードを読み込めませんでした。';

  @override
  String get usageRetry => '再試行';

  @override
  String get assistantDefaultName => 'マイアシスタント';

  @override
  String get assistantSubtitle => 'あなたの専属アシスタント';

  @override
  String get assistantOpenChat => 'アシスタントのチャットを開く';

  @override
  String get assistantSetupCta => 'アシスタントを設定';

  @override
  String get assistantSetupTitle => 'アシスタントを設定';

  @override
  String get assistantSetupStepName => 'アシスタントに名前を付ける';

  @override
  String get assistantSetupStepPersona => '性格を定義する';

  @override
  String get assistantSetupStepModel => 'モデルを選択';

  @override
  String get assistantSetupStepConfirm => '確認して作成';

  @override
  String get assistantSetupNamePlaceholder => '例：Aria';

  @override
  String get assistantSetupPersonaPlaceholder => 'あなたは役に立つアシスタントで…';

  @override
  String get assistantSetupPersonaHint => 'アシスタントの話し方や振る舞いを説明してください。';

  @override
  String get assistantSetupCreateButton => 'アシスタントを作成';

  @override
  String get assistantSetupCreating => '作成中…';

  @override
  String get assistantSetupSuccess => 'アシスタントの準備ができました';

  @override
  String get assistantSettingsTitle => 'アシスタント設定';

  @override
  String get assistantSettingsEditPersona => '性格';

  @override
  String get assistantSettingsChangeModel => 'モデル';

  @override
  String get assistantSettingsDeleteTitle => 'アシスタントを削除';

  @override
  String get assistantSettingsDeleteConfirm =>
      'アシスタントとそのチャットが削除されます。この操作は取り消せません。';

  @override
  String get assistantSettingsDeleteButton => 'アシスタントを削除';

  @override
  String get botAdminTitle => 'ボット連携';

  @override
  String get botAdminGenerateToken => 'トークンを生成';

  @override
  String get botAdminRevokeToken => '取り消す';

  @override
  String get botAdminTokenWarning => 'このトークンは一度しか表示されず、再取得できません。今すぐコピーしてください。';

  @override
  String get botAdminCopyToken => 'コピー';

  @override
  String get botAdminMcpUrl => 'MCP URL';

  @override
  String get botAdminToken => '連携トークン';

  @override
  String get botAdminLastUsed => '最終使用';

  @override
  String get botAdminNeverUsed => '未使用';

  @override
  String get botAdminNoBotsRegistered => '登録されたボットはまだありません。';

  @override
  String get helpTitle => 'ヘルプとよくある質問';

  @override
  String get settingsHelp => 'ヘルプとFAQ';

  @override
  String get settingsHelpSubtitle => 'ヘルプセンターとよくある質問';

  @override
  String get helpSearchHint => 'ヘルプを検索…';

  @override
  String get helpNoResults => '結果が見つかりません';

  @override
  String get helpCatGettingStarted => 'はじめに';

  @override
  String get helpCatMessaging => 'メッセージ';

  @override
  String get helpCatAiFeatures => 'AI機能';

  @override
  String get helpCatGroups => 'グループ';

  @override
  String get helpCatAccountSecurity => 'アカウントとセキュリティ';

  @override
  String get helpGettingStartedQ1 => 'PONとは何ですか？';

  @override
  String get helpGettingStartedA1 =>
      'PONは、チームコミュニケーションと統合されたAIアシスタントを組み合わせた、セルフホスト型のAI搭載メッセージングプラットフォームです。ダイレクトメッセージ、グループチャット、AIによるワークフローに対応しています。';

  @override
  String get helpGettingStartedQ2 => 'アカウントを作成するにはどうすればよいですか？';

  @override
  String get helpGettingStartedA2 =>
      'アカウントはワークスペースの管理者によって作成されます。パスワードの設定とアカウントの確認方法を記載した招待メールが届きます。';

  @override
  String get helpGettingStartedQ3 => '友達を見つけて追加するにはどうすればよいですか？';

  @override
  String get helpGettingStartedA3 =>
      '「友達」タブを開き、検索バーを使って名前やメールアドレスで同僚を検索してください。友達リクエストを送り、相手が承認するとチャットを始められます。';

  @override
  String get helpGettingStartedQ4 => '会話を始めるにはどうすればよいですか？';

  @override
  String get helpGettingStartedA4 =>
      '会話画面で作成アイコンをタップし、連絡先を検索して選択すると、新しい会話が開きます。';

  @override
  String get helpMessagingQ1 => 'メッセージを送信するにはどうすればよいですか？';

  @override
  String get helpMessagingA1 =>
      '会話の下部にあるテキストフィールドにメッセージを入力し、Enterキーを押すか送信ボタンをタップしてください。';

  @override
  String get helpMessagingQ2 => '音声メッセージを送信できますか？';

  @override
  String get helpMessagingA2 =>
      'はい！メッセージ入力エリアのマイクボタンを長押しすると音声メッセージを録音できます。指を離すと送信、スワイプするとキャンセルできます。';

  @override
  String get helpMessagingQ3 => 'ファイルや画像を送信するにはどうすればよいですか？';

  @override
  String get helpMessagingA3 =>
      'メッセージ入力欄の横にある添付アイコンをタップして、デバイスから画像、動画、ファイルを選択してください。';

  @override
  String get helpMessagingQ4 => '重要なメッセージをピン留めするにはどうすればよいですか？';

  @override
  String get helpMessagingA4 =>
      'メッセージを長押しまたはカーソルを合わせ、その他メニュー（⋯）をタップして「メッセージをピン留め」を選択します。ピン留めしたメッセージは会話の上部に表示されます。1つの会話につき最大2件までピン留めできます。';

  @override
  String get helpMessagingQ5 => 'メッセージリアクションとは何ですか？';

  @override
  String get helpMessagingA5 =>
      'メッセージにカーソルを合わせるか長押しし、絵文字アイコンをタップするとクイックリアクションを追加できます。他のユーザーもそれを見て自分のリアクションを追加できます。';

  @override
  String get helpAiFeaturesQ1 => 'AIアシスタントは何ができますか？';

  @override
  String get helpAiFeaturesA1 =>
      'AIアシスタント（@AI）は、質問への回答、会話の要約、メッセージ作成の支援、アップロードされた文書の分析、接続されたツールを使ったタスクの実行ができます。';

  @override
  String get helpAiFeaturesQ2 => '会話で@AIを使うにはどうすればよいですか？';

  @override
  String get helpAiFeaturesA2 =>
      '任意の会話で@AIに続けて質問やリクエストを入力してください。アシスタントが会話スレッド内で返信します。';

  @override
  String get helpAiFeaturesQ3 => 'AIメモリとは何ですか？';

  @override
  String get helpAiFeaturesA3 =>
      'AIメモリにより、アシスタントは過去の会話のコンテキストを記憶でき、時間とともにやり取りがよりパーソナライズされ効率的になります。';

  @override
  String get helpAiFeaturesQ4 => '個人アシスタントを設定するにはどうすればよいですか？';

  @override
  String get helpAiFeaturesA4 =>
      'AIアシスタントのセクションを開き、「アシスタントを設定」をタップします。アシスタントのペルソナの設定、ツールの接続、各種設定が行えます。';

  @override
  String get helpGroupsQ1 => 'グループを作成するにはどうすればよいですか？';

  @override
  String get helpGroupsA1 =>
      '作成アイコンをタップし、「新規グループ」を選択して名前を検索しメンバーを追加し、グループ名を設定して「作成」をタップします。';

  @override
  String get helpGroupsQ2 => 'グループにメンバーを追加するにはどうすればよいですか？';

  @override
  String get helpGroupsA2 =>
      'グループの会話を開き、設定アイコンをタップして「メンバーを追加」を選択します。連絡先を検索して追加してください。';

  @override
  String get helpGroupsQ3 => 'グループの役割とは何ですか？';

  @override
  String get helpGroupsA3 =>
      'グループには管理者とメンバーの2つの役割があります。管理者はメンバーの追加・削除、グループ名やアバターの変更、グループ設定の管理ができます。';

  @override
  String get helpAccountSecurityQ1 => 'プロフィール写真を変更するにはどうすればよいですか？';

  @override
  String get helpAccountSecurityA1 =>
      '設定 → プロフィールを開き、現在のアバターをタップしてデバイスから新しい写真を選択してください。';

  @override
  String get helpAccountSecurityQ2 => '消える メッセージを有効にするにはどうすればよいですか？';

  @override
  String get helpAccountSecurityA2 =>
      '会話を開き、設定アイコンをタップしてチャットのカスタマイズに進み、お好みのタイマーで「消えるメッセージ」を有効にしてください。';

  @override
  String get helpAccountSecurityQ3 => 'ユーザーをブロックするにはどうすればよいですか？';

  @override
  String get helpAccountSecurityA3 =>
      'そのユーザーとの会話を開き、設定アイコンをタップしてプライバシーとサポートまでスクロールし、「ユーザーをブロック」を選択してください。';

  @override
  String get helpAccountSecurityQ4 => 'メッセージ履歴を削除するにはどうすればよいですか？';

  @override
  String get helpAccountSecurityA4 =>
      '会話を開いて設定をタップし、プライバシーとサポートに進んで「履歴を消去」を選択します。これはお使いのデバイスから履歴を削除するだけです。';

  @override
  String get blockedChats => 'ブロック済み';

  @override
  String get noBlockedChats => 'ブロックした会話はありません';

  @override
  String get blockAndHide => 'ブロックして非表示';

  @override
  String get unblockAndRestore => 'ブロック解除';

  @override
  String get callBlocked => 'このユーザーは連絡を望んでいません';

  @override
  String get mute15min => '15 分';

  @override
  String get mute30min => '30 分';

  @override
  String get mute1hour => '1 時間';

  @override
  String get mute24hours => '24 時間';

  @override
  String get muteForever => '手動でオンにするまで';

  @override
  String get profileBlockedByOwner => 'このユーザーのプロフィールは表示できません';

  @override
  String get unsavedChangesTitle => '保存されていない変更があります';

  @override
  String get unsavedChangesDesc => 'このページを離れると、変更内容は失われます。';

  @override
  String get keepEditing => '編集を続ける';

  @override
  String get saveAndLeave => '保存して移動';

  @override
  String get leaveWithoutSaving => '保存せずに移動';

  @override
  String get aiSessionHistory => '会話履歴';

  @override
  String get aiNewSession => '新しい会話';

  @override
  String get aiSessionActive => '使用中';

  @override
  String get aiSessionSummarized => '要約済み';

  @override
  String get aiSessionEmpty => '過去の会話はありません';

  @override
  String get aiSessionResume => '再開';

  @override
  String get aiSessionLoadError => '会話履歴を読み込めませんでした';

  @override
  String multiSelectCount(int count) {
    return '$count件選択中';
  }

  @override
  String get multiSelectEmpty => 'メッセージが選択されていません';

  @override
  String get multiSelectCancel => 'キャンセル';

  @override
  String multiSelectTypeWarning(String type) {
    return '$typeを選択しています。同じ種類のみ選択できます。';
  }

  @override
  String multiDeleted(int count) {
    return '$count件のメッセージを削除しました';
  }

  @override
  String multiRecalled(int count) {
    return '$count件のメッセージを取り消しました';
  }

  @override
  String get multiForwardHint => '転送するメッセージを1件選択してください';

  @override
  String get msgTypeText => 'テキスト';

  @override
  String get msgTypeImage => '写真/動画';

  @override
  String get msgTypeFile => 'ファイル';

  @override
  String get selectMessages => 'メッセージを選択';

  @override
  String get removeAttachment => '削除';

  @override
  String get addMore => '追加';

  @override
  String get attachHdOn => 'HD — 高画質';

  @override
  String get attachHdOff => 'SD — 圧縮';

  @override
  String get hdOn => 'HD オン';

  @override
  String get hdOff => 'HD オフ';

  @override
  String get videoCannotPlay => '動画を再生できません';

  @override
  String get aiContextTitle => 'AIコンテキスト';

  @override
  String get aiContextIdentityTitle => '個人情報と組織';

  @override
  String get aiContextResponseStyleTitle => '応答スタイル';

  @override
  String get aiContextLearnedFactsTitle => 'AIが学習した内容';

  @override
  String get aiContextCompanyTitle => '会社のコンテキスト';

  @override
  String get aiContextDepartmentTitle => '部門のコンテキスト';

  @override
  String get aiContextLabelRole => 'ロール';

  @override
  String get aiContextLabelDepartment => '部門';

  @override
  String get aiContextLabelJobTitle => '役職';

  @override
  String get aiContextLabelProjects => 'プロジェクト';

  @override
  String get aiContextRoleUnknown => '未割り当て';

  @override
  String get aiContextNoDepartment => '部門なし';

  @override
  String get aiContextNotSet => '未設定';

  @override
  String get aiContextIdentityManaged => 'これらは上司または管理者が設定します。';

  @override
  String get aiContextStyleLabel => '希望する応答スタイル';

  @override
  String get aiContextStyleHint => '例：簡潔、フォーマル、コード優先';

  @override
  String get aiContextPreferencesLabel => 'その他の設定';

  @override
  String get aiContextPreferencesHint => '例：絵文字を使わない、日本語で回答する';

  @override
  String get aiContextUpdate => '更新';

  @override
  String get aiContextSaving => '保存中...';

  @override
  String get aiContextStyleSaved => '応答スタイルを更新しました';

  @override
  String get aiContextSaveError => '保存できませんでした';

  @override
  String get aiContextKeyFacts => '主な情報:';

  @override
  String get aiContextMemoryEmpty => 'まだ学習した内容はありません';

  @override
  String get aiContextMemoryEmptyHint =>
      'チャットを続けると、アシスタントがあなたに関する有用な情報をここに記憶します。';

  @override
  String get aiContextTierPublic => '公開';

  @override
  String get aiContextTierInternal => '社内';

  @override
  String get aiContextTierConfidential => '機密';

  @override
  String get adminEditAiContext => 'AIコンテキストを編集';

  @override
  String get adminAiContextJobTitle => '役職';

  @override
  String get adminAiContextProjects => '現在のプロジェクト';

  @override
  String get adminAiContextProjectsHint => '1行に1つのプロジェクト';

  @override
  String get adminAiContextEntriesTitle => '会社のAIコンテキスト';

  @override
  String get adminAiContextEntriesEmpty => 'コンテキスト項目がまだありません。';

  @override
  String get adminEntryLabel => 'ラベル';

  @override
  String get adminEntryText => 'コンテキスト';

  @override
  String get adminEntryTier => '機密レベル';

  @override
  String get adminEntryScope => '適用範囲';

  @override
  String get adminScopeCompany => '会社';

  @override
  String get adminScopeDepartment => '部門';

  @override
  String get adminCreateEntry => '項目を追加';

  @override
  String get adminEditEntry => '項目を編集';

  @override
  String get adminDeleteEntry => '項目を削除';

  @override
  String get loginInviteOnlyHint => 'PON は招待制です。管理者に招待を依頼してください。';

  @override
  String get loginHaveInviteLink => '招待リンクをお持ちですか？';

  @override
  String get inviteLinkDialogTitle => '招待を開く';

  @override
  String get inviteLinkDialogHint => 'メールに記載された招待リンクを貼り付けてください';

  @override
  String get inviteLinkInvalid => '有効な招待リンクではありません。';

  @override
  String get inviteOpen => '開く';

  @override
  String get inviteCancel => 'キャンセル';

  @override
  String get inviteRetry => '再試行';

  @override
  String get inviteTitle => '招待が届いています';

  @override
  String inviteSubtitle(String inviter, String workspace, String role) {
    return '$inviter さんが $role として $workspace に招待しました';
  }

  @override
  String inviteSubtitleNoRole(String inviter, String workspace) {
    return '$inviter さんから $workspace への招待が届いています';
  }

  @override
  String get inviteContinueWithGoogle => 'Google で続行';

  @override
  String inviteGoogleHint(String email) {
    return '$email の Google アカウントを使用してください';
  }

  @override
  String get inviteOrSetPassword => 'またはパスワードを設定';

  @override
  String get inviteSubmit => 'アカウントを作成';

  @override
  String get inviteInvalidTitle => '無効な招待';

  @override
  String get inviteInvalidBody =>
      'この招待リンクは無効です。メール内のリンクを確認するか、管理者に新しい招待を依頼してください。';

  @override
  String get inviteExpiredTitle => '招待の有効期限切れ';

  @override
  String get inviteExpiredBody => 'この招待は有効期限が切れています。管理者に再送を依頼してください。';

  @override
  String get inviteRevokedTitle => '招待は取り消されました';

  @override
  String get inviteRevokedBody => 'この招待は管理者によって取り消されました。';

  @override
  String get inviteAcceptedTitle => '承諾済み';

  @override
  String get inviteAcceptedBody => 'この招待はすでに承諾されています。サインインして続行してください。';

  @override
  String get inviteLoadFailedTitle => '招待を読み込めませんでした';

  @override
  String get inviteBackToLogin => 'サインインに戻る';

  @override
  String get authMsgInvitationAccepted => '招待を承諾しました。ようこそ！';

  @override
  String get authErrAccountNotProvisioned =>
      '選択したアカウントにはまだ PON へのアクセス権がありません。別のアカウントを試すか、管理者に招待を依頼してください。';

  @override
  String get authErrAccountBlocked => 'このアカウントはブロックされています。管理者に連絡してください。';

  @override
  String get authErrInvitationPending =>
      '保留中の招待があります。メール内の招待リンクを開いて設定を完了してください。';

  @override
  String get authErrInvitationInvalid => 'この招待リンクは無効です。';

  @override
  String get authErrInvitationExpired => 'この招待は有効期限が切れています。管理者に再送を依頼してください。';

  @override
  String get authErrInvitationRevoked => 'この招待は取り消されました。';

  @override
  String get authErrInvitationAlreadyAccepted =>
      'この招待はすでに承諾されています。サインインしてください。';

  @override
  String get authErrInvitationEmailMismatch =>
      '招待されたメールアドレスと一致する Google アカウントでサインインしてください。';

  @override
  String get authErrInvitationAlreadyPending => 'このメールアドレスにはすでに保留中の招待があります。';

  @override
  String get authErrInvitationNotPending => 'この招待は保留中ではありません。';

  @override
  String get authErrInvitationNotFound => '招待が見つかりません。';

  @override
  String authErrInvitationResendCooldown(int ttl) {
    return '再送するまで $ttl 秒お待ちください。';
  }

  @override
  String get authErrMemberAlreadyExists => 'このメールアドレスのメンバーはすでに存在します。';

  @override
  String get authErrMemberNotFound => 'メンバーが見つかりません。';

  @override
  String get authErrRoleNotFound => 'ロールが見つかりません。';

  @override
  String get authErrDepartmentNotFound => '部署が見つかりません。';

  @override
  String get authErrOwnerRoleAssignForbidden =>
      'オーナーロールの付与やオーナーのロール変更ができるのはオーナーのみです。';

  @override
  String get authErrCannotChangeOwnRole => '自分のロールは変更できません。';

  @override
  String get authErrLastOwnerCannotBeDemoted =>
      '最後のオーナーは降格できません。先に別のメンバーをオーナーにしてください。';

  @override
  String get authErrCannotBlockSelf => '自分のアカウントはブロックできません。';

  @override
  String get authErrOwnerBlockForbidden => '他の Owner をブロックできるのは Owner のみです。';

  @override
  String get authErrLastOwnerCannotBeBlocked => '最後の Owner はブロックできません。';

  @override
  String get authErrSsoDisabled => 'シングルサインオンは無効です。';

  @override
  String get authErrSsoDomainNotAllowed => 'お使いのメールドメインは SSO で許可されていません。';

  @override
  String get adminInviteMember => 'メンバーを招待';

  @override
  String get adminInviteTitle => 'メンバーを招待する';

  @override
  String get adminInviteEmail => 'メールアドレス';

  @override
  String get adminInviteRole => 'ロール';

  @override
  String get adminInviteDepartments => '部署';

  @override
  String get adminInviteSubmit => '招待を送信';

  @override
  String get adminInviteSent => '招待を送信しました';

  @override
  String get adminInviteEmailFailed =>
      '招待は作成されましたが、メールを送信できませんでした。メール設定を確認して再送してください。';

  @override
  String get adminPendingInvitations => '保留中の招待';

  @override
  String get adminInviteStatusPending => '保留中';

  @override
  String get adminInviteStatusExpired => '期限切れ';

  @override
  String adminInviteExpires(String date) {
    return '$date に期限切れ';
  }

  @override
  String adminInviteInvitedBy(String name) {
    return '招待者: $name';
  }

  @override
  String get adminInviteResend => '再送';

  @override
  String get adminInviteResent => '招待を再送しました';

  @override
  String get adminInviteRevoke => '取り消す';

  @override
  String adminInviteRevokeConfirm(String email) {
    return '$email への招待を取り消しますか？リンクは使用できなくなります。';
  }

  @override
  String get adminInviteRevoked => '招待を取り消しました';

  @override
  String get adminMemberStatusBlocked => 'ブロック中';

  @override
  String get adminMemberBlock => 'ブロック';

  @override
  String get adminMemberUnblock => 'ブロック解除';

  @override
  String adminMemberBlockConfirm(String name) {
    return '$name さんをブロックしますか？すべての端末からサインアウトされます。';
  }

  @override
  String adminMemberUnblockConfirm(String name) {
    return '$name さんのブロックを解除しますか？再びサインインできるようになります。';
  }

  @override
  String get adminMemberBlocked => 'メンバーをブロックしました';

  @override
  String get adminMemberUnblocked => 'メンバーのブロックを解除しました';

  @override
  String get adminLoadFailed => 'このセクションを読み込めませんでした。もう一度お試しください。';

  @override
  String callDeclined(String name) {
    return '$nameさんが通話を拒否しました';
  }

  @override
  String callBusy(String name) {
    return '$nameさんは別の通話中です';
  }

  @override
  String callPeerMediaError(String name) {
    return '$nameさんのマイクまたはカメラを起動できませんでした';
  }

  @override
  String get callEnded => '通話が終了しました';

  @override
  String get callConnectionLost => '接続が切れたため通話が終了しました';

  @override
  String get callSpeaker => 'スピーカー';

  @override
  String get callSwitchCamera => 'カメラを切り替え';

  @override
  String get callHangUp => '通話を終了';

  @override
  String get aiContextLearnedFactsLoadError => 'アシスタントが記憶した内容を読み込めませんでした。';

  @override
  String get errTooManyRequests => 'リクエストが多すぎます。しばらくしてからもう一度お試しください。';

  @override
  String get removedFromConversation => 'この会話のメンバーではなくなりました';

  @override
  String get errGroupAdminRequired => 'この操作はグループ管理者のみ行えます';

  @override
  String get errChatUserBlocked => 'この相手にはメッセージを送信できません';

  @override
  String get errReplyTargetInvalid => '返信先のメッセージは利用できなくなりました';

  @override
  String get errMessageTypeNotAllowed => 'この種類のメッセージはここでは送信できません';

  @override
  String get errInvalidUrl => 'このリンクはプレビューできません';

  @override
  String get errNotAGroup => 'この機能はグループチャットでのみ使えます';

  @override
  String get errNotAMember => 'この人はもうグループにいません';

  @override
  String get errLastAdminCannotBeRemoved => 'グループには少なくとも1人の管理者が必要です';

  @override
  String get errPublicDepartmentChannel => '部署のグループは公開チャンネルにできません';

  @override
  String get publicChannelToggle => '公開チャンネル';

  @override
  String get publicChannelHint => 'ワークスペースの誰でも「探索」で見つけて参加できます';

  @override
  String get groupMakeAdmin => '管理者にする';

  @override
  String get groupRemoveAdmin => '管理者を解除';

  @override
  String get aiErrEmptyResponse => 'アシスタントから回答がありませんでした。もう一度お試しください。';

  @override
  String get sysGroupCreatedNoActor => 'グループが作成されました';

  @override
  String get sysMembersAddedNoActor => '新しいメンバーが追加されました';

  @override
  String get sysMemberLeftNoActor => 'メンバーがグループを退出しました';

  @override
  String get sysMemberRemovedNoActor => 'メンバーが削除されました';

  @override
  String get sysMemberJoinedNoActor => '新しいメンバーが参加しました';

  @override
  String get sysAutoDeleteOff => '消えるメッセージをオフにしました';

  @override
  String sysAutoDeleteOn(String duration) {
    return '消えるメッセージを$durationに設定しました';
  }

  @override
  String sysAutoDeleteOffBy(String actorName) {
    return '$actorNameさんが消えるメッセージをオフにしました';
  }

  @override
  String sysAutoDeleteOnBy(String actorName, String duration) {
    return '$actorNameさんが消えるメッセージを$durationに設定しました';
  }

  @override
  String sysAdminPromoted(String targetName) {
    return '$targetNameさんが管理者になりました';
  }

  @override
  String sysAdminDemoted(String targetName) {
    return '$targetNameさんは管理者ではなくなりました';
  }

  @override
  String sysAdminPromotedBy(String actorName, String targetName) {
    return '$actorNameさんが$targetNameさんを管理者にしました';
  }

  @override
  String sysAdminDemotedBy(String actorName, String targetName) {
    return '$actorNameさんが$targetNameさんの管理者を解除しました';
  }

  @override
  String durationSeconds(int count) {
    return '$count秒';
  }

  @override
  String durationMinutes(int count) {
    return '$count分';
  }

  @override
  String durationHours(int count) {
    return '$count時間';
  }

  @override
  String durationDays(int count) {
    return '$count日';
  }

  @override
  String durationShortMinutes(int count) {
    return '$count分';
  }

  @override
  String durationShortHours(int count) {
    return '$count時間';
  }

  @override
  String durationShortDays(int count) {
    return '$count日';
  }

  @override
  String get authErrUserBlocked => 'ご利用いただけません — どちらかが相手をブロックしています';

  @override
  String get authErrCurrentPasswordRequired => '現在のパスワードを入力してください';

  @override
  String get authErrSsoEmailUnverified => 'サインインプロバイダーでこのメールアドレスが確認されていません';

  @override
  String get authErrSocialAccountConflict => 'このメールは別のサインインアカウントに既にリンクされています';

  @override
  String get aiActionConfirm => '確認';

  @override
  String get aiActionCancel => 'キャンセル';

  @override
  String get aiActionSendEmail => 'メールを送信';

  @override
  String get aiActionDraftEmail => 'メールの下書き';

  @override
  String get aiActionCreateEvent => 'カレンダーの予定を作成';

  @override
  String get aiActionUpdateEvent => 'カレンダーの予定を更新';

  @override
  String get aiActionCreatePage => 'ページを作成';

  @override
  String get aiActionUpdatePage => 'ページを更新';

  @override
  String get aiActionGeneric => '操作を実行';

  @override
  String aiActionGenericNamed(String tool) {
    return '「$tool」を実行';
  }

  @override
  String aiActionVia(String connector) {
    return '$connector 経由';
  }

  @override
  String aiActionWaitingFor(String name) {
    return '$name の確認待ち';
  }

  @override
  String get aiActionFieldTo => '宛先';

  @override
  String get aiActionFieldSubject => '件名';

  @override
  String get aiActionFieldTitle => 'タイトル';

  @override
  String get aiActionFieldWhen => '日時';

  @override
  String get aiActionStatusConfirmed => '完了';

  @override
  String get aiActionStatusCancelled => 'キャンセル済み';

  @override
  String get aiActionStatusFailed => '失敗';

  @override
  String get aiActionStatusExpired => '期限切れ';

  @override
  String get aiActionStatusHandled => '処理済み';

  @override
  String get aiActionErrNotFound => 'この操作はもう存在しません';

  @override
  String get aiActionErrNotOwner => '依頼した本人だけが確認できます';

  @override
  String get aiActionErrAlreadyResolved => 'この操作はすでに処理されています';

  @override
  String get aiActionErrExpired => 'このリクエストは期限切れです';

  @override
  String get aiActionErrGeneric => 'この操作を完了できませんでした';

  @override
  String get aiToolWebSearch => 'ウェブを検索中';

  @override
  String get aiToolRememberFact => '記憶に保存中';

  @override
  String get aiToolCreateReminder => 'リマインダーを作成中';

  @override
  String get aiToolGetUserInfo => '同僚を検索中';

  @override
  String get aiToolSearchKnowledgeBase => 'ナレッジベースを検索中';

  @override
  String get aiToolSearchMessages => 'メッセージを検索中';

  @override
  String get aiToolSummarizeConversation => '会話を要約中';

  @override
  String aiToolOnConnector(String tool, String connector) {
    return '$connector で$tool';
  }

  @override
  String get aiTraceToolAwaiting => '確認待ち';

  @override
  String get aiTraceToolDone => '完了';

  @override
  String get aiTraceToolNotRun => '未実行';

  @override
  String aiTraceTokens(String input, String output) {
    return '入力 $input · 出力 $output';
  }

  @override
  String aiTraceCacheTokens(String read, String written) {
    return 'キャッシュ 読込 $read · 書込 $written';
  }

  @override
  String aiTraceThinkingTokens(String count) {
    return '思考 $count';
  }

  @override
  String aiTraceDuration(String seconds) {
    return '$seconds 秒';
  }

  @override
  String aiTraceSteps(int count) {
    return '$count ステップ';
  }

  @override
  String get connectorGenericName => 'コネクタ';

  @override
  String get connectorCustomName => 'カスタム MCP サーバー';

  @override
  String get connectorReconnect => '再接続';

  @override
  String get connectorStatusReconnect => '再接続が必要です';

  @override
  String get connectorStatusUnavailable => '利用できません';

  @override
  String get connectorDisconnectWorkspaceConfirm =>
      'このワークスペースのコネクタを切断しますか？ワークスペース全員がそのツールを使えなくなります。';

  @override
  String connectorDisconnected(String name) {
    return '$name を切断しました';
  }

  @override
  String get customMcpListTitle => 'あなたの MCP サーバー';

  @override
  String get customMcpDelete => '削除';

  @override
  String get customMcpDeleteConfirm => 'この MCP サーバーを削除しますか？AI はそのツールを使わなくなります。';

  @override
  String customMcpDeleted(String name) {
    return '$name を削除しました';
  }

  @override
  String get directoryDeleteConfirm => 'このディレクトリ項目を削除しますか？';

  @override
  String get directoryAuthOauth => 'OAuth サインイン';

  @override
  String get directoryAuthMcpOauth => 'OAuth（MCP サーバー）';

  @override
  String get directoryAuthEnvOauth => 'OAuth（ワークスペースのアプリ）';

  @override
  String get directoryAuthApiKey => 'API キー';

  @override
  String get directoryAuthNone => 'サインイン不要';

  @override
  String get scopeEmailSend => 'メールの送信';

  @override
  String get scopeEmailDraft => '下書きの作成';

  @override
  String get scopeEmailRead => 'メールの閲覧';

  @override
  String get scopeEmailManage => 'メールの管理';

  @override
  String get scopeCalendarRead => 'カレンダーの閲覧';

  @override
  String get scopeCalendarEvents => '予定の管理';

  @override
  String get scopeCalendarManage => 'カレンダーの管理';

  @override
  String get scopeFilesRead => 'ファイルの閲覧';

  @override
  String get scopeFilesManage => 'ファイルの管理';

  @override
  String get scopeReadContent => 'コンテンツの閲覧';

  @override
  String get scopeInsertContent => 'コンテンツの追加';

  @override
  String get scopeUpdateContent => 'コンテンツの編集';

  @override
  String get scopeOther => 'その他のアクセス';

  @override
  String get connErrUnsafeUrl => 'このアドレスは使用できません。公開されている https の URL を使ってください。';

  @override
  String get connErrDiscoveryFailed => 'その MCP サーバーに接続できませんでした';

  @override
  String get connErrInsufficientPermission => 'この操作を行う権限がありません';

  @override
  String get connErrNotAllowed => 'このコネクタはワークスペースで許可されていません';

  @override
  String get connErrUnavailable => 'このコネクタは現在利用できません';

  @override
  String get connErrOauthSetup => 'このコネクタはまだサインインが設定されていません';

  @override
  String get connErrBotBridgeDisabled => 'パーソナルアシスタントのサービスが設定されていません';

  @override
  String get connErrBotNotFound => 'アシスタントが見つかりません';

  @override
  String get connErrBotOwnerMismatch => 'このアシスタントは別のメンバーのものです';

  @override
  String get connErrMemberInactive => 'このメンバーのアカウントは無効です';

  @override
  String oauthConnected(String name) {
    return '$name に接続しました';
  }

  @override
  String oauthErrAccessDenied(String name) {
    return '$name へのアクセスを拒否しました';
  }

  @override
  String oauthErrFailed(String name) {
    return '$name に接続できませんでした';
  }

  @override
  String oauthNotCompleted(String name) {
    return '$name の接続が完了していません';
  }

  @override
  String get oauthErrExpired => 'サインインに時間がかかりすぎました。もう一度お試しください。';

  @override
  String get tokenUsageDailyChartTitle => '日別の使用量';

  @override
  String get tokenUsageTotalInRange => '選択期間の合計';

  @override
  String get tokenUsageQuotaBlocked => 'このワークスペースでは AI がオフになっています';

  @override
  String get tokenUsageQuotaExceeded => '今月の AI 上限に達しました';

  @override
  String tokenUsageQuotaResets(String date) {
    return '$date にリセット';
  }

  @override
  String authErrRoleGrantExceedsOwnPermissions(String capabilities) {
    return '自分が持っていない権限は付与できません: $capabilities。';
  }

  @override
  String get authErrRoleGrantExceedsOwnPermissionsGeneric =>
      '自分が持っていない権限は付与できません。';

  @override
  String get authErrCannotEditOwnRole => '自分のロールは編集できません。';

  @override
  String get authErrPresetRoleRenameForbidden => '組み込みロールの名前は変更できません。';

  @override
  String get authErrRoleNameTaken => 'この名前のロールは既に存在します。';

  @override
  String get authErrOwnerRoleImmutable => 'Owner ロールは変更・削除できません。';

  @override
  String get authErrOwnerSsoMappingForbidden =>
      'SSO グループを Owner ロールに割り当てられるのは Owner のみです。';

  @override
  String get authErrInsufficientPermission => 'この操作を行う権限がありません。';

  @override
  String get authErrAiContextEntryNotFound => 'このコンテキスト項目は既に存在しません。';

  @override
  String get authErrAiConnectorsNotInAllowList =>
      '選択した AI コネクタはワークスペースの許可リストに含まれている必要があります。';

  @override
  String authErrPasswordTooShortMin(int min) {
    return 'パスワードは $min 文字以上にしてください。';
  }

  @override
  String get adminCapManageAiContext => 'AI コンテキストを管理';

  @override
  String get adminCapViewInternalContext => '社内コンテキストを閲覧';

  @override
  String get adminCapViewConfidentialContext => '機密コンテキストを閲覧';

  @override
  String get adminCapUnknown => 'その他の権限';

  @override
  String get adminAuditSystem => 'システム';

  @override
  String get adminAuditFormerMember => '元メンバー';

  @override
  String get adminAuditActionOther => 'その他の操作';

  @override
  String get adminAuditActionWorkspaceUpdate => 'ワークスペースを更新';

  @override
  String get adminAuditActionDepartmentCreate => '部署を作成';

  @override
  String get adminAuditActionDepartmentUpdate => '部署を更新';

  @override
  String get adminAuditActionDepartmentDelete => '部署を削除';

  @override
  String get adminAuditActionMemberUpdate => 'メンバーを更新';

  @override
  String get adminAuditActionMemberSsoUpdate => 'SSO によりメンバーを更新';

  @override
  String get adminAuditActionMemberBlock => 'メンバーをブロック';

  @override
  String get adminAuditActionMemberUnblock => 'メンバーのブロックを解除';

  @override
  String get adminAuditActionRoleCreate => 'ロールを作成';

  @override
  String get adminAuditActionRoleUpdate => 'ロールを更新';

  @override
  String get adminAuditActionInvitationCreate => '招待を送信';

  @override
  String get adminAuditActionInvitationResend => '招待を再送信';

  @override
  String get adminAuditActionInvitationRevoke => '招待を取り消し';

  @override
  String get adminAuditActionInvitationAccept => '招待を承諾';

  @override
  String get adminAuditActionConnectorConnect => 'コネクタを接続';

  @override
  String get adminAuditActionConnectorDisconnect => 'コネクタを切断';

  @override
  String get adminAuditActionConnectorReplace => 'コネクタを再接続';

  @override
  String get adminAuditActionConnectionPermissionsUpdate => 'コネクタの権限を更新';

  @override
  String get adminAuditActionCustomMcpAdd => 'カスタム MCP を追加';

  @override
  String get adminAuditActionCustomMcpDelete => 'カスタム MCP を削除';

  @override
  String get adminAuditActionDirectoryCreate => 'ディレクトリ項目を追加';

  @override
  String get adminAuditActionDirectoryUpdate => 'ディレクトリ項目を更新';

  @override
  String get adminAuditActionDirectoryDelete => 'ディレクトリ項目を削除';

  @override
  String get adminAuditActionSensitiveSkillRun => '機密スキルを実行';

  @override
  String get adminAuditTargetWorkspace => 'ワークスペース';

  @override
  String get adminAuditTargetMember => 'メンバー';

  @override
  String get adminAuditTargetRole => 'ロール';

  @override
  String get adminAuditTargetDepartment => '部署';

  @override
  String get adminAuditTargetInvitation => '招待';

  @override
  String get adminAuditTargetConnector => 'コネクタ';

  @override
  String get adminAuditTargetDirectoryEntry => 'ディレクトリ項目';

  @override
  String get adminAuditTargetTool => 'ツール';

  @override
  String get adminAuditTargetOther => 'その他';

  @override
  String get adminAiConnectorsAllAllowed =>
      'ワークスペースの許可リストが空のため、すべてのコネクタが許可されています。AI が使用できるものを選んでください。';

  @override
  String get errAssistantSetupIncomplete =>
      'アシスタントの設定を完了するには、ペルソナを入力してモデルを選んでください。';

  @override
  String get errAssistantNotConfigured =>
      'このワークスペースではまだ個人アシスタントを利用できません。管理者にお問い合わせください。';

  @override
  String get errAssistantUpstreamFailed =>
      'アシスタントサービスが応答しませんでした。しばらくしてからもう一度お試しください。';

  @override
  String adminBotOwnedBy(String name) {
    return '所有者: $name';
  }

  @override
  String adminRoleCloneDefaultName(String name) {
    return '$name のコピー';
  }

  @override
  String get setPasswordTitle => 'PON のパスワードを作成';

  @override
  String get setPasswordSubtitle =>
      'Google で参加しました。メールアドレスでもサインインできるよう、パスワードを作成してください。';

  @override
  String get setPasswordSubmit => 'パスワードを作成';

  @override
  String get setPasswordSuccess => 'パスワードを作成しました。メールアドレスでもサインインできるようになりました。';

  @override
  String get mfaVerifyTitle => '二要素認証';

  @override
  String get mfaVerifySubtitle => 'サインインを完了するには、認証アプリに表示される6桁のコードを入力してください。';

  @override
  String get mfaBackupSubtitle =>
      'バックアップコード（XXXXX-XXXXX）を1つ入力してください。各コードは1回のみ使用できます。';

  @override
  String get mfaCodeLabel => '6桁のコード';

  @override
  String get mfaBackupCodeLabel => 'バックアップコード';

  @override
  String get mfaVerifyButton => '確認';

  @override
  String get mfaUseBackupCode => 'バックアップコードを使用';

  @override
  String get mfaUseAuthenticatorCode => '認証アプリを使用';

  @override
  String get mfaBackToSignIn => 'サインインに戻る';

  @override
  String mfaBackupCodeUsed(int remaining) {
    return 'バックアップコードを使用しました。残り$remaining個です。';
  }

  @override
  String get valMfaCodeInvalid => '6桁のコードを入力してください。';

  @override
  String get valMfaBackupCodeInvalid => 'ABCDE-FGHIJ の形式でバックアップコードを入力してください。';

  @override
  String get mfaEnrollTitle => '二要素認証を設定';

  @override
  String get mfaEnrollSubtitle => 'あなたのロールでは、サインインのたびに認証アプリのコードが必要です。';

  @override
  String get mfaEnrollStepInstall =>
      '1. Google Authenticator（または他の認証アプリ）をインストールします。';

  @override
  String get mfaEnrollStepScan => '2. このQRコードをスキャンするか、アプリで開くか、セットアップキーを入力します。';

  @override
  String get mfaEnrollStepCode => '3. アプリに表示される6桁のコードを入力します。';

  @override
  String get mfaEnrollOpenApp => '認証アプリで開く';

  @override
  String get mfaEnrollNoApp =>
      '認証アプリが見つかりません。Google Authenticator をインストールするか、セットアップキーを手動で入力してください。';

  @override
  String get mfaEnrollManualKey => 'セットアップキー';

  @override
  String get mfaCopyKey => 'キーをコピー';

  @override
  String get mfaKeyCopied => 'セットアップキーをコピーしました';

  @override
  String get mfaQrSemantic => '認証アプリ用のQRコード';

  @override
  String get mfaEnrollConfirm => '確認';

  @override
  String get mfaBackupCodesTitle => 'バックアップコードを保存';

  @override
  String get mfaBackupCodesSubtitle =>
      'スマートフォンを紛失した場合、各コードで1回サインインできます。再表示されないため、安全な場所に保管してください。';

  @override
  String get mfaCopyCodes => 'コードをコピー';

  @override
  String get mfaCodesCopied => 'バックアップコードをコピーしました';

  @override
  String get mfaSavedCheckbox => 'バックアップコードを保存しました';

  @override
  String get mfaContinue => '続行';

  @override
  String get securityMfaOn => 'サインインのたびに認証アプリのコードが必要です。';

  @override
  String get securityMfaPending => 'あなたのロールでは必須です。次回のサインイン時に設定します。';

  @override
  String get securityMfaStatusOn => 'オン';

  @override
  String get securityMfaStatusOff => '未設定';

  @override
  String get securityMfaRegenerate => 'バックアップコードを再生成';

  @override
  String get securityMfaRegenerateHint =>
      '認証アプリに表示されている現在のコードを入力してください。古いバックアップコードは使えなくなります。';

  @override
  String get securityMfaRegenerateSubmit => '生成';

  @override
  String get securityMfaDone => '完了';

  @override
  String get adminMfaBadge => '2FA オン';

  @override
  String get adminMfaReset => '2FA をリセット';

  @override
  String adminMfaResetConfirm(String name) {
    return '$name さんの二要素認証をリセットしますか？すべての端末からサインアウトされ、次回のサインイン時に再設定が必要になります。';
  }

  @override
  String get adminMfaResetDone => '2FA をリセットしました。次回のサインイン時に再設定されます。';

  @override
  String get authMsgMfaRequired => 'サインインを完了するには、認証アプリのコードを入力してください。';

  @override
  String get authErrMfaTokenInvalid => 'サインインの有効期限が切れました。もう一度サインインしてください。';

  @override
  String get authErrMfaCodeInvalid => 'コードが正しくありません。もう一度お試しください。';

  @override
  String authErrMfaCodeInvalidRemaining(int remaining) {
    return 'コードが正しくありません。残り$remaining回の試行があります。';
  }

  @override
  String get authErrMfaTooManyAttempts => 'コードの誤りが多すぎます。もう一度サインインしてください。';

  @override
  String get authErrMfaNotEnrolled => 'このアカウントでは二要素認証がまだ設定されていません。';

  @override
  String get authErrMfaAlreadyEnrolled => 'このアカウントでは二要素認証がすでに設定されています。';

  @override
  String get authErrMfaResetForbidden => '二要素認証をリセットできるのはオーナーのみです。';

  @override
  String get authErrMfaResetSelfForbidden => '自分の二要素認証はリセットできません。';

  @override
  String get callSelfWeakNetwork => 'あなたのネットワークが不安定です';

  @override
  String callPeerWeakNetwork(String name) {
    return '$nameさんのネットワークが不安定です';
  }

  @override
  String get callUnstableNetwork => '接続が不安定です';

  @override
  String get callReconnectingSelf => '接続が切れました。再接続しています…';

  @override
  String callWaitingForPeer(String name) {
    return '$nameさんの再接続を待っています…';
  }

  @override
  String callReconnectCountdown(int seconds) {
    return '再接続できない場合、$seconds秒後に通話が終了します';
  }

  @override
  String get callSwitchToVideo => 'ビデオ通話に切り替え';

  @override
  String get callVideoUnavailable => 'この通話ではビデオを使えません。相手のアプリの更新が必要な可能性があります';

  @override
  String get adminCapHostMeeting => '会議を主催';

  @override
  String get meetingErrNotFound => 'この会議は存在しません';

  @override
  String get meetingErrForbidden => 'この会議ではその操作を行う権限がありません';

  @override
  String get meetingErrCreateForbidden => 'あなたのロールでは会議を主催できません';

  @override
  String get meetingErrDepartmentForbidden => 'この部署の会議は作成できません';

  @override
  String get meetingErrRemoved => 'この会議から退出させられました';

  @override
  String get meetingErrLocked => 'この会議はロックされています';

  @override
  String get meetingErrEnded => 'この会議は終了しました';

  @override
  String meetingErrFull(int max) {
    return 'この会議は満員です（$max 人）';
  }

  @override
  String get meetingErrNotCancellable => 'すでに参加者がいるため、キャンセルできません';

  @override
  String get meetingErrUnavailable => '現在、会議機能を利用できません。しばらくしてからもう一度お試しください。';

  @override
  String get meetingErrNotesReadOnly => '共有メモを編集できるのは主催者のみです';

  @override
  String get meetingErrNoteConflict => '他の人が新しいバージョンを保存しました';

  @override
  String get meetingErrRateLimited => '送信が速すぎます。少し待ってください。';

  @override
  String meetingErrChatTooLong(int max) {
    return 'メッセージは最大 $max 文字です';
  }

  @override
  String meetingErrNoteTooLong(int max) {
    return 'メモは最大 $max 文字です';
  }

  @override
  String get meetingErrInviteeInvalid => 'リストに招待できない人が含まれています';

  @override
  String get meetingErrDepartmentInvalid => 'この部署は利用できません';

  @override
  String get meetingErrStartInvalid => '開始時刻が無効です';

  @override
  String get meetingErrEndInvalid => '会議は開始後、24 時間以内に終了する必要があります';

  @override
  String get meetingErrTargetUnavailable => 'この人はもう会議にいません';

  @override
  String get meetingErrInvalid => 'リクエストに無効な内容があります';

  @override
  String get meetingErrNetwork => 'サーバーに接続できません。ネットワークを確認してください。';

  @override
  String get meetingErrGeneric => '問題が発生しました。もう一度お試しください。';

  @override
  String meetingValTitleTooLong(int max) {
    return 'タイトルは最大 $max 文字です';
  }

  @override
  String meetingValDescriptionTooLong(int max) {
    return '説明は最大 $max 文字です';
  }

  @override
  String meetingValTooManyInvitees(int max) {
    return '招待できるのは最大 $max 人です';
  }

  @override
  String get meetingValStartPast => '未来の日時を選んでください';

  @override
  String get meetingValScheduleInvalid => '有効な日付と時刻を選んでください';

  @override
  String get meetingUntitled => '会議';

  @override
  String get meetingSomeone => '誰か';

  @override
  String get meetingParticipantFallback => '参加者';

  @override
  String get meetingYou => 'あなた';

  @override
  String get meetingRoleHost => '主催者';

  @override
  String get meetingRoleCohost => '共同主催者';

  @override
  String get meetingRoleAttendee => '参加者';

  @override
  String get meetingStatusLive => '開催中';

  @override
  String get meetingStatusScheduled => '予定済み';

  @override
  String get meetingStatusEnded => '終了';

  @override
  String get meetingStatusCancelled => 'キャンセル済み';

  @override
  String meetingDurationMinutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count 分',
    );
    return '$_temp0';
  }

  @override
  String meetingDurationHours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count 時間',
    );
    return '$_temp0';
  }

  @override
  String meetingDurationHoursMinutes(int hours, int minutes) {
    return '$hours 時間 $minutes 分';
  }

  @override
  String get meetingRealtimeOffline => 'オンラインに戻るまで、チャット・挙手・主催者の操作は一時停止しています';

  @override
  String meetingMutedBy(String name) {
    return '$name があなたのマイクをミュートしました';
  }

  @override
  String get meetingMutedByUnknown => '主催者があなたのマイクをミュートしました';

  @override
  String get meetingMadeCohost => '共同主催者になりました';

  @override
  String get meetingRevokedCohost => '共同主催者ではなくなりました';

  @override
  String get meetingEndedToast => '会議は終了しました';

  @override
  String get meetingMediaFailed => 'マイクまたはカメラをオンにできませんでした';

  @override
  String get meetingShareRevoked => '主催者が画面共有をオフにしました';

  @override
  String get meetingShareFailed => '画面を共有できませんでした';

  @override
  String meetingLobbyWaiting(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count 人が参加を待っています',
    );
    return '$_temp0';
  }

  @override
  String get meetingNotifInvitedTitle => '会議への招待';

  @override
  String meetingNotifInvitedBody(String name, String title) {
    return '$name さんが「$title」に招待しました';
  }

  @override
  String meetingNotifInvitedBodyAt(String name, String title, String time) {
    return '$name さんが $time の「$title」に招待しました';
  }

  @override
  String get meetingNotifStartingTitle => 'まもなく会議が始まります';

  @override
  String meetingNotifStartingBody(String title, String time) {
    return '「$title」は $time に始まります';
  }

  @override
  String meetingNotifCancelled(String title) {
    return '「$title」はキャンセルされました';
  }

  @override
  String get meetingNotifCancelledUnknown => '招待されていた会議がキャンセルされました';

  @override
  String get meetingTitle => '会議';

  @override
  String get meetingPushInvited => '会議に招待されました';

  @override
  String get meetingPushStarting => '会議が10分後に始まります';

  @override
  String get meetingPushChannel => '会議';

  @override
  String get meetingSubtitle => '今すぐ会議を始めるか、後の会議を予約しましょう。';

  @override
  String get meetingNewInstant => '今すぐ会議';

  @override
  String get meetingNewScheduled => '予約';

  @override
  String get meetingJoinByCodeLabel => '会議コードまたはリンク';

  @override
  String get meetingJoinByCodePlaceholder => 'abc-defg-hjk';

  @override
  String get meetingJoinByCode => '参加';

  @override
  String get meetingCodeInvalid => '有効な会議コードではありません';

  @override
  String get meetingTabUpcoming => '今後';

  @override
  String get meetingTabPast => '過去';

  @override
  String get meetingEmptyUpcoming => '予定されている会議はありません';

  @override
  String get meetingEmptyPast => '過去の会議はありません';

  @override
  String get meetingLoadMore => 'さらに読み込む';

  @override
  String get meetingListError => '会議を読み込めませんでした';

  @override
  String get meetingInstantMeeting => '即時会議';

  @override
  String meetingHostedBy(String name) {
    return '主催：$name';
  }

  @override
  String get meetingCopyLink => 'リンクをコピー';

  @override
  String get meetingLinkCopied => '会議のリンクをコピーしました';

  @override
  String get meetingCopyFailed => 'リンクをコピーできませんでした';

  @override
  String get meetingJoin => '参加';

  @override
  String get meetingStarting => '作成中…';

  @override
  String get meetingFormCreateTitle => '会議を予約';

  @override
  String get meetingFormEditTitle => '会議を編集';

  @override
  String get meetingFormAgainTitle => 'もう一度開催';

  @override
  String get meetingFieldTitle => 'タイトル';

  @override
  String get meetingFieldTitlePlaceholder => 'タイトルを追加';

  @override
  String get meetingFieldDescription => '説明';

  @override
  String get meetingFieldDescriptionPlaceholder => '議題、リンク、参加者に伝えたいこと';

  @override
  String get meetingFieldWhen => '日時';

  @override
  String get meetingWhenNow => '今すぐ開始';

  @override
  String get meetingWhenLater => '後で予約';

  @override
  String get meetingFieldDate => '日付';

  @override
  String get meetingFieldTime => '開始時刻';

  @override
  String get meetingFieldDuration => '所要時間';

  @override
  String meetingTimeZoneHint(String zone) {
    return '時刻は $zone で表示されます';
  }

  @override
  String get meetingFieldInvitees => '参加者を招待';

  @override
  String get meetingInviteeSearchPlaceholder => '名前またはメールで検索';

  @override
  String meetingInviteeCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count 人を招待済み',
    );
    return '$_temp0';
  }

  @override
  String get meetingInviteeNone => 'まだ誰も招待していません';

  @override
  String meetingRemoveInvitee(String name) {
    return '$name を削除';
  }

  @override
  String get meetingSearchNoResults => '見つかりませんでした';

  @override
  String get meetingSearchFailed => '現在検索できません';

  @override
  String get meetingFieldDepartment => '部署';

  @override
  String get meetingDepartmentNone => '部署なし';

  @override
  String get meetingDepartmentHint => '部署の全員が招待されます';

  @override
  String get meetingSettingsTitle => '会議のオプション';

  @override
  String get meetingSettingWaitingRoom => '待機室';

  @override
  String get meetingSettingWaitingRoomDesc => '招待されていない人は主催者が許可するまで待機します';

  @override
  String get meetingSettingMuteOnEntry => '参加時にミュート';

  @override
  String get meetingSettingMuteOnEntryDesc => '参加者はマイクがオフの状態で参加します';

  @override
  String get meetingSettingScreenShare => '参加者が画面を共有できる';

  @override
  String get meetingSettingNotes => '参加者が共有メモを編集できる';

  @override
  String get meetingSettingLocked => '会議をロック';

  @override
  String get meetingSettingLockedDesc => '招待された人だけが参加できます';

  @override
  String get meetingSubmitCreate => '予約';

  @override
  String get meetingSubmitStartNow => '今すぐ開始';

  @override
  String get meetingSubmitSave => '変更を保存';

  @override
  String get meetingToastCreated => '会議を予約しました';

  @override
  String get meetingToastUpdated => '変更を保存しました';

  @override
  String meetingCharCounter(int count, int max) {
    return '$count/$max';
  }

  @override
  String get meetingNotesShared => '共有';

  @override
  String get meetingNotesPrivate => '自分用';

  @override
  String get meetingNotesPrivateHint => 'このメモはあなただけが見られます';

  @override
  String get meetingNotesPlaceholder => 'メモを書く — Markdown 対応';

  @override
  String get meetingNotesWrite => '書く';

  @override
  String get meetingNotesPreview => 'プレビュー';

  @override
  String get meetingNotesSaving => '保存中…';

  @override
  String get meetingNotesSaved => '保存しました';

  @override
  String get meetingNotesUnsaved => '未保存の変更があります';

  @override
  String get meetingNotesSaveFailed => '保存できませんでした';

  @override
  String get meetingNotesRetry => '再試行';

  @override
  String get meetingNotesReadOnly => 'このメモを編集できるのは主催者のみです';

  @override
  String meetingNotesRemoteNewer(String name) {
    return '$name さんが新しいバージョンを保存しました';
  }

  @override
  String get meetingNotesRemoteNewerUnknown => '新しいバージョンが保存されました';

  @override
  String meetingNotesCounter(int count, int max) {
    return '$count / $max';
  }

  @override
  String get meetingNotesConflictTitle => '他の人が新しいバージョンを保存しました';

  @override
  String get meetingNotesConflictDesc =>
      '入力中の文章は失われていません。2 つのバージョンを比較して、残す方を選んでください。';

  @override
  String get meetingNotesConflictReview => '比較する';

  @override
  String get meetingNotesConflictTheirs => '新しいバージョン';

  @override
  String get meetingNotesConflictMine => 'あなたのバージョン';

  @override
  String get meetingNotesConflictKeepMine => '自分の版を残す';

  @override
  String get meetingNotesConflictTakeTheirs => '新しいバージョンを使う';

  @override
  String get meetingNotesConflictSaveMerged => '統合した文章を保存';

  @override
  String get meetingNotesConflictDiscardWarning => '未保存の文章は破棄されます';

  @override
  String get meetingEdit => '編集';

  @override
  String get meetingCancelMeeting => '会議をキャンセル';

  @override
  String get meetingMeetAgain => 'もう一度開催';

  @override
  String get meetingEndMeeting => '会議を終了';

  @override
  String get meetingCancelConfirmTitle => 'この会議をキャンセルしますか？';

  @override
  String get meetingCancelConfirmDesc => '招待された全員にキャンセルが通知されます。';

  @override
  String get meetingEndConfirmTitle => '全員の会議を終了しますか？';

  @override
  String get meetingEndConfirmDesc => '全員が退出し、会議を再開することはできません';

  @override
  String get meetingToastCancelled => '会議をキャンセルしました';

  @override
  String get meetingToastEnded => '会議を終了しました';

  @override
  String get meetingBackToList => 'すべての会議';

  @override
  String get meetingDetailError => 'この会議を読み込めませんでした';

  @override
  String get meetingMeetingCode => '会議コード';

  @override
  String get meetingSectionPeople => '参加者';

  @override
  String get meetingCoHosts => '共同主催者';

  @override
  String get meetingInvitees => '招待された人';

  @override
  String meetingMoreCount(int count) {
    return '+$count';
  }

  @override
  String get meetingDepartmentGeneric => '部署';

  @override
  String get meetingSectionAttendance => '出席状況';

  @override
  String get meetingAttendanceEmpty => 'まだ誰も参加していません';

  @override
  String get meetingAttendanceInside => '現在会議中';

  @override
  String meetingAttendanceDuration(int minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes 分',
    );
    return '$_temp0';
  }

  @override
  String meetingAttendanceSessions(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count 回参加',
    );
    return '$_temp0';
  }

  @override
  String get meetingSectionNotes => 'メモ';

  @override
  String get meetingSectionChat => '会議チャット';

  @override
  String get meetingChatHistoryEmpty => 'メッセージはありません';

  @override
  String get meetingChatLoadOlder => '以前のメッセージを読み込む';

  @override
  String get meetingChatHistoryError => '会議チャットを読み込めませんでした';

  @override
  String get meetingRemovedNotice => 'この会議から退出させられたため、メモとチャットは表示できません。';

  @override
  String get meetingGuestNotice => '会議に参加するとメモとチャットを見られます。';

  @override
  String meetingCreatedAt(String time) {
    return '$time に作成';
  }

  @override
  String get meetingLinkCodeCopied => '会議コードをコピーしました';

  @override
  String get meetingShareNotifTitle => '画面を共有しています';

  @override
  String get meetingShareNotifBody => '会議の参加者全員があなたの画面を見ることができます';

  @override
  String get meetingJoinNow => '今すぐ参加';

  @override
  String get meetingAskToJoin => '参加をリクエスト';

  @override
  String get meetingPrejoinTitle => '参加の準備はできましたか？';

  @override
  String meetingPrejoinStartsAt(String time) {
    return '開始：$time';
  }

  @override
  String meetingPrejoinJoiningAs(String name) {
    return '$name として参加します';
  }

  @override
  String get meetingPrejoinCameraOff => 'カメラはオフです';

  @override
  String get meetingPrejoinMuteOnEntry => '主催者はミュートでの参加を求めています';

  @override
  String get meetingPrejoinLockedHint => 'この会議はロックされています。招待された人のみ参加できます。';

  @override
  String get meetingPrejoinInCall => '通話中です。この会議に参加するには通話を終了してください。';

  @override
  String get meetingMicOn => 'マイクをオンにする';

  @override
  String get meetingMicOff => 'マイクをオフにする';

  @override
  String get meetingCamOn => 'カメラをオンにする';

  @override
  String get meetingCamOff => 'カメラをオフにする';

  @override
  String get meetingMediaUnavailable => 'マイクまたはカメラが見つかりません';

  @override
  String get meetingWaitingTitle => '参加をリクエストしています…';

  @override
  String get meetingWaitingDesc => 'まもなく会議の参加者が入室を許可します';

  @override
  String get meetingWaitingCancel => 'キャンセル';

  @override
  String get meetingDeniedTitle => '入室が許可されませんでした';

  @override
  String get meetingDeniedDesc => '会議の参加者がリクエストを拒否しました';

  @override
  String get meetingRemovedTitle => '会議から退出させられました';

  @override
  String get meetingRemovedDesc => 'この会議には再参加できません';

  @override
  String get meetingLockedTitle => 'この会議はロックされています';

  @override
  String get meetingLockedDesc => '現在は招待された人のみ参加できます';

  @override
  String get meetingFullTitle => 'この会議は満員です';

  @override
  String meetingFullDesc(int max) {
    return 'すでに $max 人が参加しています。後でもう一度お試しください。';
  }

  @override
  String get meetingUnavailableTitle => '会議は現在利用できません';

  @override
  String get meetingUnavailableDesc => 'しばらくしてからもう一度お試しください';

  @override
  String get meetingNotFoundTitle => '会議が見つかりません';

  @override
  String get meetingNotFoundDesc => 'コードまたはリンクを確認してもう一度お試しください';

  @override
  String get meetingLeftTitle => '会議から退出しました';

  @override
  String get meetingConnectionLostTitle => '接続が切れました';

  @override
  String get meetingConnectionLostDesc => '会議に再接続できませんでした';

  @override
  String get meetingRejoin => '再参加';

  @override
  String get meetingTryAgain => '再試行';

  @override
  String get meetingViewDetails => '会議の詳細';

  @override
  String get meetingLeaveMeeting => '会議から退出';

  @override
  String meetingNameWithYou(String name) {
    return '$name（あなた）';
  }

  @override
  String get meetingReconnecting => '再接続しています…';

  @override
  String get meetingPoorConnection => '接続が不安定です';

  @override
  String get meetingPresenting => '画面を共有しています';

  @override
  String get meetingStopPresenting => '共有を停止';

  @override
  String meetingPresentingName(String name) {
    return '$name さんが画面を共有しています';
  }

  @override
  String meetingOverflowTiles(int count) {
    return '+$count';
  }

  @override
  String meetingOverflowMore(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'ほか $count 人',
    );
    return '$_temp0';
  }

  @override
  String get meetingPin => '固定';

  @override
  String get meetingUnpin => '固定を解除';

  @override
  String meetingTileMenu(String name) {
    return '$name のオプション';
  }

  @override
  String get meetingMicMutedLabel => 'マイクはオフです';

  @override
  String get meetingHandRaisedLabel => '挙手しています';

  @override
  String get meetingPoorConnectionPeer => '接続が不安定';

  @override
  String get meetingHostBadge => '主催者または共同主催者';

  @override
  String get meetingShareStart => '画面を共有';

  @override
  String get meetingShareDisabled => '主催者が参加者の画面共有をオフにしました';

  @override
  String get meetingRaiseHand => '挙手';

  @override
  String get meetingLowerHand => '手を下ろす';

  @override
  String get meetingReactions => 'リアクションを送信';

  @override
  String get meetingChat => 'チャット';

  @override
  String get meetingNotes => 'メモ';

  @override
  String get meetingPeople => '参加者';

  @override
  String get meetingMore => 'その他のオプション';

  @override
  String get meetingLayout => 'レイアウト';

  @override
  String get meetingLayoutGrid => 'グリッド';

  @override
  String get meetingLayoutSpotlight => '発言者';

  @override
  String get meetingLeave => '退出';

  @override
  String get meetingEndForAll => '全員の会議を終了';

  @override
  String meetingReactionAria(String name, String emoji) {
    return '$name さんが $emoji でリアクションしました';
  }

  @override
  String get meetingPeopleTitle => '参加者';

  @override
  String get meetingManageTitle => '主催者の操作';

  @override
  String meetingSectionHands(int count) {
    return '挙手中（$count）';
  }

  @override
  String meetingSectionLobby(int count) {
    return '参加待ち（$count）';
  }

  @override
  String meetingSectionInMeeting(int count) {
    return '会議中（$count）';
  }

  @override
  String get meetingAdmit => '参加を許可';

  @override
  String get meetingDeny => '拒否';

  @override
  String get meetingAdmitAll => '全員を許可';

  @override
  String meetingPersonMenu(String name) {
    return '$name のオプション';
  }

  @override
  String get meetingActionMuteMic => 'マイクをミュート';

  @override
  String get meetingActionMuteAll => '全員をミュート';

  @override
  String get meetingActionRemove => '会議から退出させる';

  @override
  String get meetingActionLowerHand => '手を下ろす';

  @override
  String get meetingActionLowerAllHands => '全員の手を下ろす';

  @override
  String get meetingActionMakeCohost => '共同主催者にする';

  @override
  String get meetingActionRevokeCohost => '共同主催者から外す';

  @override
  String meetingRemoveConfirmTitle(String name) {
    return '$name を会議から退出させますか？';
  }

  @override
  String get meetingRemoveConfirmDesc => 'この会議に再参加できなくなります';

  @override
  String get meetingMuteAllConfirmTitle => '全員をミュートしますか？';

  @override
  String get meetingMuteAllConfirmDesc => '各自でミュートを解除できます';

  @override
  String get meetingChatTitle => '会議のチャット';

  @override
  String get meetingChatPlaceholder => 'メッセージを送信';

  @override
  String get meetingChatSend => '送信';

  @override
  String get meetingChatEmpty => 'メッセージは会議の参加者全員に表示されます';

  @override
  String get meetingChatFailed => '送信できませんでした';

  @override
  String get meetingChatRetry => '再送信';

  @override
  String get meetingChatDiscard => '破棄';

  @override
  String get meetingChatSending => '送信中…';

  @override
  String get meetingChatOffline => '再接続中のため、現在メッセージを送信できません';

  @override
  String meetingChatCounter(int count, int max) {
    return '$count/$max';
  }

  @override
  String meetingChatUnread(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '新着メッセージ $count 件',
    );
    return '$_temp0';
  }

  @override
  String get meetingMediaBlocked =>
      'マイクまたはカメラへのアクセスがオフです。このまま参加して、後で「設定」からオンにできます。';

  @override
  String get meetingSwitchCamera => 'カメラを切り替え';

  @override
  String get meetingSpeakerOn => 'スピーカーを使用';

  @override
  String get meetingLoading => '会議を読み込み中…';
}
