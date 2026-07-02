// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Japanese (`ja`).
class AppLocalizationsJa extends AppLocalizations {
  AppLocalizationsJa([String locale = 'ja']) : super(locale);

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
  String errorWithMsg(String error) {
    return 'エラー：$error';
  }

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
  String get noAccountYet => 'アカウントをお持ちでないですか？ ';

  @override
  String get registerNow => '今すぐ登録';

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
  String get registerTitle => 'アカウント作成';

  @override
  String get welcomeToApp => 'PON へようこそ';

  @override
  String get fieldDisplayName => '表示名';

  @override
  String get fieldConfirmPassword => 'パスワード（確認）';

  @override
  String get registerButton => '登録';

  @override
  String get haveAccount => 'すでにアカウントをお持ちですか？ ';

  @override
  String get loginLink => 'ログイン';

  @override
  String get valNameRequired => '名前を入力してください';

  @override
  String get valNameMin2 => '名前は2文字以上です';

  @override
  String get valPasswordMismatch => 'パスワードが一致しません';

  @override
  String get errEmailExists => 'このメールは既に登録されています';

  @override
  String get errRegisterFailed => '登録に失敗しました。再試行してください';

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
  String get errEmailNotRegistered => 'このメールは登録されていません';

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
  String get actionReact => 'リアクション';

  @override
  String get messageRecalled => 'メッセージは取り消されました';

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
  String get pinLimitReached => 'ピン留めできるメッセージは2件までです';

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
  String get aiMemory => 'メモリ';

  @override
  String get aiSkills => 'スキル';

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
  String get aiMemoryTitle => 'AIメモリ';

  @override
  String get aiMemoryEmptyState => 'まだメモリがありません。PON AIとチャットしてメモリを作成しましょう。';

  @override
  String get aiMemoryDeleteConfirm => 'このメモリを削除しますか？AIはこの会話のコンテキストを記憶しなくなります。';

  @override
  String get aiMemoryDeleted => 'メモリが削除されました';

  @override
  String aiMemoryUpdated(String date) {
    return '$date更新';
  }

  @override
  String get aiMemoryFacts => '重要な情報：';

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
  String get registerWithGoogle => 'Googleでサインアップ';

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
  String get valMustAgreeTerms => '登録するには利用規約に同意する必要があります';

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
  String get authMsgRegisterSuccess => '登録が完了しました。OTPがメールに送信されました。';

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
  String get authErrEmailDomainInvalid => 'メールのドメインが存在しないか、MXレコードがありません。';

  @override
  String get authErrEmailNotFound => 'このメールアドレスはシステムに存在しません。';

  @override
  String get authErrEmailInUse => 'このメールアドレスはすでに使用されています。';

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
  String get skillsSettingsSubtitle => 'アシスタントの得意分野を選ぶ';

  @override
  String skillNeeds(String requirements) {
    return '$requirements が必要';
  }

  @override
  String get skillSchedulerName => 'スケジューラー';

  @override
  String get skillSchedulerDesc => '会議を予約し、空き時間を探し、招待とリマインダーを送ります。';

  @override
  String get skillMailWriterName => 'メール作成';

  @override
  String get skillMailWriterDesc => 'あなたの口調で返信を下書きし、長いスレッドを要約します。';

  @override
  String get skillResearcherName => 'リサーチャー';

  @override
  String get skillResearcherDesc => 'ウェブと Drive を検索し、出典付きの回答を返します。';

  @override
  String get skillProjectKeeperName => 'プロジェクト管理';

  @override
  String get skillProjectKeeperDesc => 'メモやタスクを Notion に保存し、データベースを整理します。';

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
}
