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
}
