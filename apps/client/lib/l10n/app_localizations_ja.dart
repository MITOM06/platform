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
  String get searchConversationsHint => 'Search conversations...';

  @override
  String get noConversationsFound => 'No conversations found';

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
  String get newGroup => '新しいグループ';

  @override
  String get newDirect => '新しいチャット';

  @override
  String get createGroup => 'グループを作成';

  @override
  String get groupName => 'グループ名';

  @override
  String get valGroupNameRequired => 'グループ名を入力してください';

  @override
  String get selectMembers => 'メンバーを選択';

  @override
  String get valSelectMembers => '2人以上のメンバーを選択してください';

  @override
  String get searchUsers => '名前またはメールで検索';

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
  String get uploading => 'アップロード中…';

  @override
  String get downloadMedia => 'ダウンロード';

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
  String get profileTitle => 'プロフィール';

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
  String get endToEndEncrypted => 'エンドツーエンド暗号化';

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
  String get avatarUploadLabel => 'Change avatar';

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
  String get errEmailDomainInvalid => 'This email address does not exist';

  @override
  String get valPasswordMin8 => 'Password must be at least 8 characters';

  @override
  String get valPasswordUppercase => 'Must contain an uppercase letter (A-Z)';

  @override
  String get valPasswordLowercase => 'Must contain a lowercase letter (a-z)';

  @override
  String get valPasswordDigit => 'Must contain a digit (0-9)';

  @override
  String get valPasswordSpecial =>
      'Must contain a special character (!@#\$%^&*)';

  @override
  String get pwStrengthWeak => 'Weak';

  @override
  String get pwStrengthMedium => 'Medium';

  @override
  String get pwStrengthStrong => 'Strong';

  @override
  String get pwStrengthVeryStrong => 'Very Strong';

  @override
  String get pwReqLength => '≥8 characters';

  @override
  String get pwReqUppercase => 'Uppercase (A-Z)';

  @override
  String get pwReqLowercase => 'Lowercase (a-z)';

  @override
  String get pwReqDigit => 'Digit (0-9)';

  @override
  String get pwReqSpecial => 'Special char (!@#\$...)';

  @override
  String get loginWithGoogle => 'Sign in with Google';

  @override
  String get registerWithGoogle => 'Sign up with Google';

  @override
  String get orContinueWith => 'Or continue with';

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
  String get youColon => 'You:';

  @override
  String get systemNicknameChanged => 'Nickname was changed';

  @override
  String get systemThemeChanged => 'Chat theme changed';

  @override
  String get systemQuickReactionChanged => 'Quick reaction changed';

  @override
  String get wallpaperUploadError => 'Failed to upload image';

  @override
  String get wallpaperScale => 'Scale';

  @override
  String get wallpaperPreviewHint => 'Pinch or drag to adjust';

  @override
  String get wallpaperPreviewIncoming => 'Hi! How does this look?';

  @override
  String get wallpaperPreviewOutgoing => 'Looks great 🎉';

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
}
