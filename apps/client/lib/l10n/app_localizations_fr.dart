// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for French (`fr`).
class AppLocalizationsFr extends AppLocalizations {
  AppLocalizationsFr([String locale = 'fr']) : super(locale);

  @override
  String get appName => 'PON';

  @override
  String get languageName => 'Français';

  @override
  String get actionCancel => 'Annuler';

  @override
  String get actionConfirm => 'Confirmer';

  @override
  String get actionRetry => 'RÉESSAYER';

  @override
  String get actionSave => 'ENREGISTRER';

  @override
  String get actionLogout => 'Se déconnecter';

  @override
  String get actionDelete => 'Supprimer';

  @override
  String get actionLeave => 'Quitter';

  @override
  String get loadingDots => '...';

  @override
  String errorWithMsg(String error) {
    return 'Erreur : $error';
  }

  @override
  String get loginTitle => 'Connexion';

  @override
  String get fieldEmail => 'E-mail';

  @override
  String get fieldPassword => 'Mot de passe';

  @override
  String get forgotPasswordLink => 'Mot de passe oublié ?';

  @override
  String get loginButton => 'SE CONNECTER';

  @override
  String get noAccountYet => 'Pas encore de compte ? ';

  @override
  String get registerNow => 'Inscrivez-vous';

  @override
  String get valEmailRequired => 'Veuillez saisir votre e-mail';

  @override
  String get valEmailInvalid => 'E-mail invalide';

  @override
  String get valPasswordRequired => 'Veuillez saisir votre mot de passe';

  @override
  String get valPasswordMin6 =>
      'Le mot de passe doit comporter au moins 6 caractères';

  @override
  String get errInvalidCredentials => 'E-mail ou mot de passe incorrect';

  @override
  String get errNetwork =>
      'Impossible de joindre le serveur, vérifiez votre connexion';

  @override
  String get errLoginFailed => 'Échec de la connexion, veuillez réessayer';

  @override
  String get registerTitle => 'Créer un compte';

  @override
  String get welcomeToApp => 'Bienvenue sur PON';

  @override
  String get fieldDisplayName => 'Nom affiché';

  @override
  String get fieldConfirmPassword => 'Confirmer le mot de passe';

  @override
  String get registerButton => 'S\'INSCRIRE';

  @override
  String get haveAccount => 'Vous avez déjà un compte ? ';

  @override
  String get loginLink => 'Se connecter';

  @override
  String get valNameRequired => 'Veuillez saisir votre nom';

  @override
  String get valNameMin2 => 'Le nom doit comporter au moins 2 caractères';

  @override
  String get valPasswordMismatch => 'Les mots de passe ne correspondent pas';

  @override
  String get errEmailExists => 'Cet e-mail est déjà enregistré';

  @override
  String get errRegisterFailed => 'Échec de l\'inscription, veuillez réessayer';

  @override
  String get verifyOtpTitle => 'Vérifier l\'OTP';

  @override
  String get verifyAccountHeading => 'Vérifiez votre compte';

  @override
  String otpSentTo(String email) {
    return 'Un code OTP à 6 chiffres a été envoyé à\n$email';
  }

  @override
  String get fieldOtp => 'Code OTP';

  @override
  String get confirmButton => 'CONFIRMER';

  @override
  String resendIn(int seconds) {
    return 'Renvoyer dans ${seconds}s';
  }

  @override
  String get resendOtp => 'Renvoyer le code OTP';

  @override
  String get otpResent => 'Un nouveau code OTP a été envoyé à votre e-mail';

  @override
  String get errResendFailed => 'Échec de l\'envoi, réessayez plus tard';

  @override
  String get valOtp6 => 'Saisissez les 6 chiffres de l\'OTP';

  @override
  String get verifySuccess => 'Vérifié avec succès ! Connectez-vous maintenant';

  @override
  String get errVerifyFailed => 'Échec de la vérification, veuillez réessayer';

  @override
  String get forgotTitle => 'Réinitialiser le mot de passe';

  @override
  String get forgotHeading => 'Mot de passe oublié ?';

  @override
  String get forgotSubtitle =>
      'Saisissez votre e-mail pour recevoir un OTP et définir un nouveau mot de passe';

  @override
  String get sendOtpButton => 'ENVOYER LE CODE OTP';

  @override
  String get errEmailNotRegistered => 'Cet e-mail n\'est pas enregistré';

  @override
  String get errSendRequestFailed => 'Échec de la demande, veuillez réessayer';

  @override
  String get newPasswordTitle => 'Nouveau mot de passe';

  @override
  String get newPasswordHeading => 'Créer un nouveau mot de passe';

  @override
  String newPasswordSubtitle(String email) {
    return 'Saisissez l\'OTP envoyé à $email\net votre nouveau mot de passe';
  }

  @override
  String get fieldNewPassword => 'Nouveau mot de passe';

  @override
  String get valNewPasswordRequired => 'Saisissez un nouveau mot de passe';

  @override
  String get resetPasswordSuccess => 'Mot de passe réinitialisé avec succès !';

  @override
  String get errOtpInvalidExpired => 'L\'OTP est incorrect ou a expiré';

  @override
  String get errResetFailed =>
      'Échec de la réinitialisation, veuillez réessayer';

  @override
  String get settingsTitle => 'Paramètres';

  @override
  String get valNameEmpty => 'Le nom ne peut pas être vide';

  @override
  String get nameUpdated => 'Nom affiché mis à jour';

  @override
  String get personalInfo => 'Informations personnelles';

  @override
  String get appearance => 'Apparence';

  @override
  String get chooseThemeTitle => 'Choisir un thème';

  @override
  String get themeLight => 'Thème clair';

  @override
  String get themeDark => 'Thème sombre';

  @override
  String get themeSystem => 'Système';

  @override
  String get language => 'Langue';

  @override
  String get chooseLanguageTitle => 'Choisir la langue';

  @override
  String get logoutConfirmBody => 'Voulez-vous vraiment vous déconnecter ?';

  @override
  String get onboardingChooseTheme => 'CHOISISSEZ UN THÈME';

  @override
  String get onboardingChooseSubtitle =>
      'Choisissez le style d\'interface qui vous convient le mieux.';

  @override
  String get themeLightSubtitle => 'Lumineux, clair et facile à lire';

  @override
  String get themeDarkSubtitle =>
      'Moderne, mystérieux et reposant pour les yeux';

  @override
  String get themeSystemSubtitle =>
      'S\'adapte automatiquement à votre appareil';

  @override
  String get startExperience => 'COMMENCER L\'EXPÉRIENCE';

  @override
  String get tooltipSettings => 'Paramètres';

  @override
  String get tooltipNewConversation => 'Nouvelle conversation';

  @override
  String get listLoadFailed => 'Impossible de charger la liste';

  @override
  String get listCheckNetwork =>
      'Vérifiez votre connexion réseau et réessayez.';

  @override
  String get listGenericError =>
      'Une erreur s\'est produite. Réessayez plus tard.';

  @override
  String get emptyConversations => 'Aucune conversation pour l\'instant';

  @override
  String get emptyTapPlus =>
      'Appuyez sur le bouton « + » ci-dessous pour commencer !';

  @override
  String get offlineBanner => 'Aucune connexion réseau';

  @override
  String get conversationDefault => 'Conversation';

  @override
  String get newConversationTitle => 'Nouvelle conversation';

  @override
  String get startConversationHeading => 'Démarrer une conversation';

  @override
  String get fieldRecipient => 'E-mail ou ID utilisateur du destinataire';

  @override
  String get valRecipientRequired => 'Saisissez un e-mail ou un ID utilisateur';

  @override
  String get errUserNotFoundEmail =>
      'Aucun utilisateur trouvé avec cet e-mail.';

  @override
  String get errUserNotFoundOrConn =>
      'Utilisateur introuvable ou erreur de connexion.';

  @override
  String get startConversationButton => 'COMMENCER À DISCUTER';

  @override
  String get chatDefaultTitle => 'Discussion';

  @override
  String get statusOnline => 'actif maintenant';

  @override
  String get statusOffline => 'hors ligne';

  @override
  String get typingLabel => 'en train d\'écrire';

  @override
  String get messageHint => 'Écrivez un message...';

  @override
  String get tabChats => 'Discussions';

  @override
  String get newGroup => 'Nouveau groupe';

  @override
  String get newDirect => 'Nouvelle discussion';

  @override
  String get createGroup => 'Créer un groupe';

  @override
  String get groupName => 'Nom du groupe';

  @override
  String get valGroupNameRequired => 'Saisissez un nom de groupe';

  @override
  String get selectMembers => 'Sélectionner des membres';

  @override
  String get valSelectMembers => 'Sélectionnez au moins 2 membres';

  @override
  String get searchUsers => 'Rechercher par nom ou e-mail';

  @override
  String get groupInfo => 'Infos du groupe';

  @override
  String get members => 'Membres';

  @override
  String membersCount(int count) {
    return '$count membres';
  }

  @override
  String get addMembers => 'Ajouter des membres';

  @override
  String get removeMember => 'Retirer du groupe';

  @override
  String get leaveGroup => 'Quitter le groupe';

  @override
  String get leaveGroupConfirm => 'Voulez-vous vraiment quitter ce groupe ?';

  @override
  String get renameGroup => 'Renommer le groupe';

  @override
  String get admin => 'Administrateur';

  @override
  String get you => 'Vous';

  @override
  String systemAddedMember(String actor, String target) {
    return '$actor a ajouté $target';
  }

  @override
  String systemRemovedMember(String actor, String target) {
    return '$actor a retiré $target';
  }

  @override
  String systemLeftGroup(String actor) {
    return '$actor a quitté le groupe';
  }

  @override
  String systemRenamedGroup(String actor, String name) {
    return '$actor a renommé le groupe en $name';
  }

  @override
  String systemCreatedGroup(String actor) {
    return '$actor a créé le groupe';
  }

  @override
  String get actionReply => 'Répondre';

  @override
  String get actionRecall => 'Annuler l\'envoi';

  @override
  String get actionEdit => 'Modifier';

  @override
  String get messageEdited => '(modifié)';

  @override
  String get actionDeleteForMe => 'Supprimer pour moi';

  @override
  String get actionCopy => 'Copier';

  @override
  String get actionReact => 'Réagir';

  @override
  String get messageRecalled => 'Le message a été retiré';

  @override
  String replyingTo(String name) {
    return 'Réponse à $name';
  }

  @override
  String get copiedToClipboard => 'Copié dans le presse-papiers';

  @override
  String get recallConfirm => 'Retirer ce message pour tout le monde ?';

  @override
  String get deleteConversation => 'Supprimer la conversation';

  @override
  String get deleteConversationConfirm =>
      'Supprimer cette conversation ? Elle sera masquée de votre liste.';

  @override
  String get clearHistory => 'Effacer l\'historique';

  @override
  String get clearHistoryConfirm =>
      'Effacer tous les messages de cette conversation pour vous ?';

  @override
  String get disappearingMessages => 'Messages éphémères';

  @override
  String get disappearingOff => 'Désactivé';

  @override
  String get disappearing24h => '24 heures';

  @override
  String get disappearing7d => '7 jours';

  @override
  String get changeAvatar => 'Changer l\'avatar';

  @override
  String get uploadFailed => 'Échec du téléversement, réessayez';

  @override
  String get lastSeenJustNow => 'actif à l\'instant';

  @override
  String lastSeenMinutes(int minutes) {
    return 'actif il y a $minutes min';
  }

  @override
  String lastSeenHours(int hours) {
    return 'actif il y a $hours h';
  }

  @override
  String lastSeenDays(int days) {
    return 'actif il y a $days j';
  }

  @override
  String get dateToday => 'Aujourd\'hui';

  @override
  String get dateYesterday => 'Hier';

  @override
  String get attachPhoto => 'Photo';

  @override
  String get attachVideo => 'Vidéo';

  @override
  String get attachFile => 'Fichier';

  @override
  String get uploading => 'Envoi…';

  @override
  String get downloadMedia => 'Télécharger';

  @override
  String get attachmentLabel => '📎 Pièce jointe';

  @override
  String get callIncoming => 'Appel entrant';

  @override
  String callIncomingBody(String name) {
    return '$name vous appelle';
  }

  @override
  String callCalling(String name) {
    return 'Appel de $name…';
  }

  @override
  String get callConnecting => 'Connexion…';

  @override
  String get callMediaError =>
      'Impossible d\'accéder à la caméra/au micro (HTTPS ou localhost requis)';

  @override
  String get callUnknownCaller => 'Quelqu\'un';

  @override
  String get profileTitle => 'Profil';

  @override
  String get editProfile => 'Modifier le profil';

  @override
  String get bio => 'Bio';

  @override
  String friendsCountLabel(int count) {
    return '$count amis';
  }

  @override
  String get messageAction => 'Message';

  @override
  String get activeFriends => 'Actifs maintenant';

  @override
  String get noFriendsOnline => 'Aucun ami en ligne';

  @override
  String get strangerBannerTitle => 'Demande de message';

  @override
  String get strangerBannerBody =>
      'Cette personne n\'est pas dans vos contacts. Acceptez pour répondre.';

  @override
  String get acceptRequest => 'Accepter';

  @override
  String get rejectRequest => 'Refuser';

  @override
  String get friends => 'Amis';

  @override
  String get contacts => 'Contacts';

  @override
  String get friendRequests => 'Demandes d\'ami';

  @override
  String get addFriend => 'Ajouter';

  @override
  String get friendRequestSent => 'Demande d\'ami envoyée';

  @override
  String get acceptFriend => 'Accepter';

  @override
  String get noFriends => 'Aucun ami pour l\'instant';

  @override
  String get noFriendRequests => 'Aucune demande en attente';

  @override
  String get friendRequestPending => 'En attente';

  @override
  String get unfriend => 'Retirer l\'ami';

  @override
  String get unfriendConfirm => 'Retirer cet ami ?';

  @override
  String get blockUser => 'Bloquer';

  @override
  String get unblockUser => 'Débloquer';

  @override
  String get blockUserConfirm =>
      'Bloquer cet utilisateur ? Vous ne pourrez plus vous envoyer de messages.';

  @override
  String get blockedComposerNotice =>
      'Vous ne pouvez pas envoyer de messages à ce chat';

  @override
  String get userBlocked => 'Utilisateur bloqué';

  @override
  String get userUnblocked => 'Utilisateur débloqué';

  @override
  String get mentionNotificationTitle => 'Vous a mentionné';

  @override
  String mentionNotificationBody(String name) {
    return '$name vous a mentionné';
  }

  @override
  String get searchMessages => 'Rechercher des messages';

  @override
  String get searchHint => 'Rechercher dans la conversation';

  @override
  String get searchNoResults => 'Aucun message trouvé';

  @override
  String get exploreChannels => 'Explorer les canaux';

  @override
  String get searchChannelsHint => 'Rechercher des canaux…';

  @override
  String get noPublicChannels => 'Aucun canal public trouvé';

  @override
  String get joinChannel => 'Rejoindre';

  @override
  String get pinMessage => 'Épingler';

  @override
  String get forwardMessage => 'Transférer';

  @override
  String get messageForwarded => 'Message transféré';

  @override
  String get forwardFailed => 'Échec du transfert';

  @override
  String get noConversationsToForward => 'Aucune conversation disponible';

  @override
  String get rateLimitError => 'Trop de messages. Veuillez ralentir.';

  @override
  String get sharedMediaTitle => 'Médias et fichiers partagés';

  @override
  String get tabMedia => 'Médias';

  @override
  String get tabFiles => 'Fichiers';

  @override
  String get tabLinks => 'Liens';

  @override
  String get noMediaFound => 'Aucun média trouvé';

  @override
  String get noFilesFound => 'Aucun fichier trouvé';

  @override
  String get noLinksFound => 'Aucun lien trouvé';

  @override
  String get reactionsDetail => 'Réactions';

  @override
  String get changePasswordTitle => 'Changer le mot de passe';

  @override
  String get currentPassword => 'Mot de passe actuel';

  @override
  String get newPassword => 'Nouveau mot de passe';

  @override
  String get confirmPassword => 'Confirmer le nouveau mot de passe';

  @override
  String get dateOfBirth => 'Date de naissance';

  @override
  String get notSet => 'Non défini';

  @override
  String get passwordChangedSuccess => 'Mot de passe modifié avec succès';

  @override
  String get errCurrentPasswordIncorrect => 'Mot de passe actuel incorrect';

  @override
  String get changeCoverPhoto => 'Changer la photo de couverture';

  @override
  String get markAsRead => 'Marquer comme lu';

  @override
  String get markAsUnread => 'Marquer comme non lu';

  @override
  String get muteNotifications => 'Muet';

  @override
  String get unmuteNotifications => 'Activer le son';

  @override
  String get viewProfile => 'Voir le profil';

  @override
  String get voiceCall => 'Appel vocal';

  @override
  String get videoCall => 'Appel vidéo';

  @override
  String get archiveChat => 'Archiver le chat';

  @override
  String get unarchiveChat => 'Désarchiver le chat';

  @override
  String get mutedLabel => 'Sourdine';

  @override
  String get newNotificationTitle => 'Nouveau message';

  @override
  String newNotificationBody(String name) {
    return '$name vous a envoyé un message';
  }

  @override
  String get archivedChats => 'Discussions archivées';

  @override
  String get archivedChatsSubtitle => 'Voir les conversations archivées';

  @override
  String get emptyArchivedChats => 'Aucune discussion archivée';

  @override
  String get webNoChatSelected =>
      'Sélectionnez une conversation pour commencer à discuter';

  @override
  String get endToEndEncrypted => 'Chiffrement de bout en bout';

  @override
  String get chatInfoCategory => 'Détails de la discussion';

  @override
  String get customizeChatCategory => 'Personnaliser la discussion';

  @override
  String get filesAndMediaCategory => 'Médias, fichiers et liens';

  @override
  String get privacyAndSupportCategory => 'Confidentialité et assistance';

  @override
  String get callSelectMember => 'Sélectionner un membre à appeler';

  @override
  String get profileHideInfo => 'Masquer les informations personnelles';

  @override
  String get profileInfoHidden => 'Les informations personnelles sont masquées';

  @override
  String get profileGender => 'Genre';

  @override
  String get profilePhone => 'Numéro de téléphone';

  @override
  String get profileBio => 'Biographie';

  @override
  String get profileDateOfBirth => 'Date de naissance';

  @override
  String get profileEditMode => 'Modifier le profil';

  @override
  String get profileSave => 'Enregistrer';

  @override
  String get actionMessage => 'Message';

  @override
  String get actionAddFriend => 'Ajouter un ami';

  @override
  String get actionBlock => 'Bloquer';

  @override
  String get readDetails => 'Détails de lecture';

  @override
  String get seenStatus => 'Vu';

  @override
  String get noReadsYet => 'Personne n\'a encore lu ceci';

  @override
  String get voiceMicTooltip => 'Message vocal';

  @override
  String get recording => 'Enregistrement...';

  @override
  String get stickerLabel => 'Autocollants';

  @override
  String get emojiTab => 'Emoji';

  @override
  String get aiAssistant => 'Assistant IA';

  @override
  String get startChatWithAI => 'Discuter avec PON AI';

  @override
  String get aiThinking => 'L\'IA réfléchit...';

  @override
  String get aiError =>
      'L\'IA est temporairement indisponible. Veuillez réessayer.';

  @override
  String get aiErrorRetry => 'Réessayer';

  @override
  String get aiMessageDeleted => 'Message supprimé';

  @override
  String get aiMemoryTitle => 'Mémoire IA';

  @override
  String get aiMemoryEmptyState =>
      'Aucun souvenir pour l\'instant. Discutez avec PON AI pour commencer à créer des souvenirs.';

  @override
  String get aiMemoryDeleteConfirm =>
      'Supprimer ce souvenir ? L\'IA ne se souviendra plus du contexte de cette conversation.';

  @override
  String get aiMemoryDeleted => 'Souvenir supprimé';

  @override
  String aiMemoryUpdated(String date) {
    return 'Mis à jour le $date';
  }

  @override
  String get aiMemoryFacts => 'Faits clés :';

  @override
  String get viewAiMemory => 'Voir la mémoire';

  @override
  String get kbTitle => 'Base de connaissances';

  @override
  String get kbEmptyState =>
      'Aucun document.\nAppuyez sur le bouton d\'importation pour ajouter un fichier PDF, DOCX ou TXT.';

  @override
  String get kbUploadButton => 'Importer un document';

  @override
  String get kbDeleteConfirm => 'Supprimer ce document ?';

  @override
  String get kbProcessing => 'En cours';

  @override
  String get kbReady => 'Prêt';

  @override
  String get kbError => 'Erreur';

  @override
  String get kbManage => 'Base de connaissances';

  @override
  String get kbSources => 'source(s)';

  @override
  String get kbChunks => 'segments';

  @override
  String aiToolCalling(String toolName) {
    return 'Utilisation de l\'outil : $toolName';
  }

  @override
  String get aiToolTrace => 'Journal des outils';

  @override
  String get toolSearchMessages => 'Recherche de messages...';

  @override
  String get toolGetUserInfo => 'Récupération des infos utilisateur...';

  @override
  String get toolSearchKnowledgeBase =>
      'Recherche dans la base de connaissances...';

  @override
  String get toolSummarizeConversation => 'Résumé de la conversation...';

  @override
  String get toolCreateReminder => 'Création d\'un rappel...';

  @override
  String get reminders => 'Rappels';

  @override
  String get remindersEmpty =>
      'Aucun rappel en attente.\nDemandez à PON AI d\'en créer un.';

  @override
  String get reminderDone => 'Marquer comme fait';

  @override
  String get tokenUsage => 'Utilisation des tokens';

  @override
  String get tokenUsageTitle => 'Tableau de bord des tokens';

  @override
  String get tokenUsageThisMonth => 'Total de tokens ce mois';

  @override
  String get tokenUsageRequests => 'Requêtes IA';

  @override
  String get tokenUsageEstCost => 'Coût estimé (USD)';

  @override
  String get tokenUsageDailyChart =>
      'Utilisation quotidienne (30 derniers jours)';

  @override
  String get aiTraceTitle => 'Trace de l\'IA';

  @override
  String get aiTraceThinking => 'Réflexion';

  @override
  String get aiTraceTools => 'Appels d\'outils';

  @override
  String get aiTraceStats => 'Statistiques';

  @override
  String get aiPersonaTitle => 'Persona IA';

  @override
  String get aiPersonaNameHint => 'Nom du bot (ex. DevBot)';

  @override
  String get aiPersonaInstructionsHint =>
      'Instructions personnalisées (ex. Réponds toujours avec des puces)';

  @override
  String get aiPersonaAdminOnly =>
      'Seuls les administrateurs du groupe peuvent configurer la persona IA.';

  @override
  String get configureAiPersona => 'Configurer la persona IA';

  @override
  String get aiPersonaToneFriendly => 'Amical';

  @override
  String get aiPersonaToneProfessional => 'Professionnel';

  @override
  String get aiPersonaToneConcise => 'Concis';

  @override
  String get aiPersonaToneCreative => 'Créatif';

  @override
  String get aiQuotaExceeded =>
      'Le quota mensuel d\'utilisation de l\'IA est dépassé. Contactez votre administrateur.';

  @override
  String get viewUsage => 'Voir l\'utilisation';

  @override
  String get tokenUsageQuota => 'Quota mensuel';

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
  String get loginWithFacebook => 'Sign in with Facebook';

  @override
  String get registerWithGoogle => 'Sign up with Google';

  @override
  String get registerWithFacebook => 'Sign up with Facebook';

  @override
  String get orContinueWith => 'Or continue with';
}
