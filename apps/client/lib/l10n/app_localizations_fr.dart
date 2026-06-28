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
  String get notificationsTitle => 'Notifications';

  @override
  String get notificationsEmpty => 'Aucune notification pour le moment';

  @override
  String get notificationsMarkAllRead => 'Tout marquer comme lu';

  @override
  String get notificationAccept => 'Accepter';

  @override
  String get notificationDecline => 'Refuser';

  @override
  String get securityTitle => 'Mot de passe et sécurité';

  @override
  String get securitySubtitle => 'Modifier votre mot de passe';

  @override
  String get securityNoPasswordCardSubtitle => 'Aucun mot de passe défini';

  @override
  String get securityNoPasswordTitle =>
      'Aucun mot de passe défini pour le moment';

  @override
  String get securityNoPasswordSubtitle =>
      'Définissez un mot de passe pour sécuriser votre compte et activer la récupération par e-mail.';

  @override
  String get securityChangePasswordTitle => 'Changer le mot de passe';

  @override
  String get securityChangePasswordSubtitle =>
      'Mettez à jour votre mot de passe actuel.';

  @override
  String get securitySetPasswordTitle => 'Configurer votre mot de passe';

  @override
  String get securitySetPasswordSubtitle =>
      'Ajoutez un mot de passe à votre compte pour plus de sécurité.';

  @override
  String get securitySetButton => 'Définir le mot de passe';

  @override
  String get securityChangeButton => 'Changer le mot de passe';

  @override
  String get securitySetSuccess => 'Mot de passe défini avec succès';

  @override
  String get securityTwoFaTitle => 'Authentification à deux facteurs';

  @override
  String get securityTwoFaSubtitle =>
      'Ajoutez une couche de sécurité supplémentaire à votre compte.';

  @override
  String get securityTwoFaComingSoon =>
      'L\'authentification à deux facteurs arrive bientôt.';

  @override
  String get securityComingSoon => 'Bientôt disponible';

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
  String get errSlow => 'Connexion trop lente, veuillez réessayer';

  @override
  String get errSessionExpired => 'Votre session a expiré';

  @override
  String get errForbidden => 'Vous n\'avez pas la permission de faire cela';

  @override
  String get errNotFound => 'Données introuvables';

  @override
  String get errConflict => 'Ces données existent déjà';

  @override
  String get errInvalidData => 'Données invalides';

  @override
  String get errServer => 'Erreur du serveur, veuillez réessayer plus tard';

  @override
  String errRequestFailed(String code) {
    return 'Échec de la requête ($code)';
  }

  @override
  String get errCancelled => 'La requête a été annulée';

  @override
  String get errConnection => 'Erreur de connexion, veuillez réessayer';

  @override
  String get errGeneric => 'Une erreur s\'est produite, veuillez réessayer';

  @override
  String get detailsTitle => 'Détails';

  @override
  String get themeMenuItem => 'Thème';

  @override
  String get quickReactionTitle => 'Réaction rapide';

  @override
  String get wallpaperDefaultName => 'Par défaut';

  @override
  String get wallpaperCategoryColors => 'Couleurs simples';

  @override
  String get wallpaperCategoryVibrant => 'Dégradés vibrants';

  @override
  String get wallpaperCategoryMinimal => 'Minimaliste';

  @override
  String get wallpaperShowMore => 'Afficher plus';

  @override
  String get wallpaperShowLess => 'Afficher moins';

  @override
  String get wallpaperCategoryThemes => 'Thèmes';

  @override
  String get wallpaperThemeForest => 'Forêt';

  @override
  String get wallpaperThemeOcean => 'Océan';

  @override
  String get wallpaperThemeMountain => 'Montagne enneigée';

  @override
  String get wallpaperThemeCherryBlossom => 'Fleur de cerisier';

  @override
  String get wallpaperThemeSpace => 'Espace';

  @override
  String get wallpaperThemeAurora => 'Aurore boréale';

  @override
  String get wallpaperThemeCityNight => 'Ville la nuit';

  @override
  String get wallpaperThemeDesert => 'Désert';

  @override
  String get changeChatThemeTitle => 'Changer le thème du chat';

  @override
  String get uploadImageButton => 'Importer une image';

  @override
  String get imageFitLabel => 'Ajustement de l\'image';

  @override
  String get fitCoverLabel => 'Couvrir';

  @override
  String get fitContainLabel => 'Contenir';

  @override
  String get fitFillLabel => 'Étirer';

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
  String get searchConversationsHint => 'Rechercher des conversations...';

  @override
  String get noConversationsFound => 'Aucune conversation trouvée';

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
  String get groupDefaultName => 'Groupe';

  @override
  String get valGroupNameRequired => 'Saisissez un nom de groupe';

  @override
  String get selectMembers => 'Sélectionner des membres';

  @override
  String get valSelectMembers => 'Sélectionnez au moins 2 membres';

  @override
  String get searchUsers => 'Rechercher par nom, e-mail ou téléphone';

  @override
  String get phoneSearchHint =>
      'Saisissez le numéro de téléphone complet pour rechercher';

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
  String get someone => 'Quelqu\'un';

  @override
  String get aiHubTitle => 'Hub IA';

  @override
  String get aiHubSubtitle => 'Tout sur votre assistant IA';

  @override
  String get aiHubStartChat => 'Démarrer une discussion avec PON AI';

  @override
  String get aiHubMemory => 'Mémoire';

  @override
  String get aiHubIntegrations => 'Connecteurs';

  @override
  String get aiHubSkills => 'Compétences';

  @override
  String get aiHubTokenUsage => 'Utilisation';

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
  String get attachVoice => 'Message vocal';

  @override
  String get attachSticker => 'Sticker';

  @override
  String get pinnedMessageTitle => 'Message épinglé';

  @override
  String get pinnedSystemMessage => 'Message système';

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
  String get callToggleMic => 'Activer/désactiver le micro';

  @override
  String get callToggleCam => 'Activer/désactiver la caméra';

  @override
  String get callLeave => 'Quitter';

  @override
  String get callJoin => 'Rejoindre';

  @override
  String get callAccept => 'Accepter';

  @override
  String get callDecline => 'Refuser';

  @override
  String get groupCallTitle => 'Appel de groupe';

  @override
  String groupCallParticipants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count participants',
      one: '1 participant',
    );
    return '$_temp0';
  }

  @override
  String get groupCallNotetakerActive => 'L\'IA prend des notes';

  @override
  String get groupCallStartTitle => 'Démarrer un appel de groupe';

  @override
  String get groupCallAudio => 'Audio';

  @override
  String get groupCallVideo => 'Vidéo';

  @override
  String get groupCallNotetakerToggle => 'Preneur de notes IA';

  @override
  String get groupCallNotetakerHint =>
      'L\'IA écoute et publie un résumé de la réunion ensuite.';

  @override
  String get groupCallStartAction => 'Démarrer l\'appel';

  @override
  String activeCallBanner(int count) {
    return 'Appel de groupe · $count ont rejoint';
  }

  @override
  String get incomingGroupCallTitle => 'Appel de groupe entrant';

  @override
  String incomingGroupCallBody(String name) {
    return '$name a démarré un appel de groupe';
  }

  @override
  String get meetingSummaryTitle => 'Résumé de la réunion';

  @override
  String meetingSummaryDuration(String duration) {
    return 'Durée $duration';
  }

  @override
  String meetingSummaryAttendees(String names) {
    return 'Participants : $names';
  }

  @override
  String get meetingSummaryOverview => 'Aperçu';

  @override
  String get meetingSummaryKeyPoints => 'Points clés';

  @override
  String get meetingSummaryActionItems => 'Actions à mener';

  @override
  String get profileTitle => 'Profil';

  @override
  String get editProfile => 'Modifier le profil';

  @override
  String get bio => 'Biographie';

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
  String get friendsTabSearch => 'Rechercher';

  @override
  String get declineFriend => 'Refuser';

  @override
  String get searchUsersPrompt =>
      'Recherchez des personnes à ajouter comme amis';

  @override
  String get noSearchResults => 'Aucun utilisateur trouvé';

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
  String get unpinMessage => 'Désépingler';

  @override
  String get pinnedMessagesTitle => 'Messages épinglés';

  @override
  String get pinLimitReached => 'Vous pouvez épingler jusqu\'à 2 messages';

  @override
  String get cannotPinCall => 'Les appels ne peuvent pas être épinglés';

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
  String get aiPersonality => 'Personnalité';

  @override
  String get aiMemory => 'Mémoire';

  @override
  String get aiSkills => 'Compétences';

  @override
  String get aiConnectedApps => 'Apps connectées';

  @override
  String get aiUsage => 'Utilisation';

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
  String get profileShowDateOfBirth =>
      'Afficher la date de naissance aux autres';

  @override
  String get profileShowPhone => 'Afficher le numéro de téléphone aux autres';

  @override
  String get profileShowGender => 'Afficher le genre aux autres';

  @override
  String get phoneVerifiedBadge => 'Vérifié';

  @override
  String get phoneSendOtp => 'Envoyer le code de vérification';

  @override
  String get phoneSending => 'Envoi...';

  @override
  String get phoneChangeNumber => 'Changer de numéro';

  @override
  String get phoneNotVerified => 'Non vérifié';

  @override
  String get phoneSendOtpError =>
      'Impossible d\'envoyer le code. Réessayez plus tard.';

  @override
  String get phoneVerifyTitle => 'Vérifier le numéro de téléphone';

  @override
  String phoneOtpSubtitle(String phone) {
    return 'Saisissez le code à 6 chiffres envoyé au $phone';
  }

  @override
  String get phoneOtpIncomplete => 'Saisissez les 6 chiffres';

  @override
  String get phoneOtpInvalid => 'Code incorrect ou expiré';

  @override
  String get phoneVerifiedSuccess => 'Numéro de téléphone vérifié !';

  @override
  String get phoneVerifying => 'Vérification...';

  @override
  String get phoneConfirm => 'Confirmer';

  @override
  String get phoneHint => '901 234 567';

  @override
  String get profilePrivacySection => 'Confidentialité';

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
  String get emojiTab => 'Émoji';

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
  String get aiErrStreamInterrupted =>
      'Le flux IA a été interrompu. Veuillez réessayer.';

  @override
  String get aiErrUnavailable => 'L\'IA est temporairement indisponible.';

  @override
  String get aiErrRateLimited =>
      'Trop de requêtes IA. Veuillez ralentir et réessayer dans un instant.';

  @override
  String get feedbackHelpful => 'Utile';

  @override
  String get feedbackNotHelpful => 'Pas utile';

  @override
  String get feedbackCommentHint =>
      'Dites-nous ce qui n\'a pas fonctionné (facultatif)';

  @override
  String get feedbackThanks => 'Merci pour votre retour';

  @override
  String get feedbackSend => 'Envoyer';

  @override
  String get feedbackError =>
      'Impossible d\'envoyer le retour. Veuillez réessayer.';

  @override
  String get aiSensitiveAction => 'action sensible';

  @override
  String get sourcesLabel => 'Sources';

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
  String get avatarUploadLabel => 'Changer l\'avatar';

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
  String get errEmailDomainInvalid => 'Cette adresse e-mail n\'existe pas';

  @override
  String get valPasswordMin8 =>
      'Le mot de passe doit comporter au moins 8 caractères';

  @override
  String get valPasswordUppercase => 'Doit contenir une lettre majuscule (A-Z)';

  @override
  String get valPasswordLowercase => 'Doit contenir une lettre minuscule (a-z)';

  @override
  String get valPasswordDigit => 'Doit contenir un chiffre (0-9)';

  @override
  String get valPasswordSpecial =>
      'Doit contenir un caractère spécial (!@#\$%^&*)';

  @override
  String get pwStrengthWeak => 'Faible';

  @override
  String get pwStrengthMedium => 'Moyen';

  @override
  String get pwStrengthStrong => 'Fort';

  @override
  String get pwStrengthVeryStrong => 'Très fort';

  @override
  String get pwReqLength => '≥8 caractères';

  @override
  String get pwReqUppercase => 'Majuscule (A-Z)';

  @override
  String get pwReqLowercase => 'Minuscule (a-z)';

  @override
  String get pwReqDigit => 'Chiffre (0-9)';

  @override
  String get pwReqSpecial => 'Caractère spécial (!@#\$...)';

  @override
  String get loginWithGoogle => 'Se connecter avec Google';

  @override
  String get registerWithGoogle => 'S\'inscrire avec Google';

  @override
  String get orContinueWith => 'Ou continuer avec';

  @override
  String agreeToTerms(String privacyPolicy, String termsOfService) {
    return 'J\'accepte la $privacyPolicy et les $termsOfService';
  }

  @override
  String get privacyPolicy => 'Politique de Confidentialité';

  @override
  String get termsOfService => 'Conditions d\'Utilisation';

  @override
  String get valMustAgreeTerms =>
      'Vous devez accepter les Conditions d\'Utilisation pour vous inscrire';

  @override
  String get youColon => 'Vous :';

  @override
  String get systemNicknameChanged => 'Le surnom a été modifié';

  @override
  String get systemThemeChanged => 'Thème de la discussion modifié';

  @override
  String get systemQuickReactionChanged => 'Réaction rapide modifiée';

  @override
  String get wallpaperUploadError => 'Échec du téléversement de l\'image';

  @override
  String get wallpaperScale => 'Échelle';

  @override
  String get wallpaperPreviewHint => 'Pincez ou faites glisser pour ajuster';

  @override
  String get wallpaperPreviewIncoming => 'Bonjour ! Qu\'en pensez-vous ?';

  @override
  String get wallpaperPreviewOutgoing => 'C\'est superbe 🎉';

  @override
  String get errCannotOpenLink => 'Impossible d\'ouvrir le lien';

  @override
  String sysNicknameClearedSelf(String actorName) {
    return '$actorName a supprimé son propre surnom';
  }

  @override
  String sysNicknameClearedOther(String actorName, String targetName) {
    return '$actorName a supprimé le surnom de $targetName';
  }

  @override
  String sysNicknameSetSelf(String actorName, String nickname) {
    return '$actorName a défini son surnom sur $nickname';
  }

  @override
  String sysNicknameSetOther(
      String actorName, String targetName, String nickname) {
    return '$actorName a défini le surnom de $targetName sur $nickname';
  }

  @override
  String sysThemeChanged(String actorName) {
    return '$actorName a changé le thème de la discussion';
  }

  @override
  String sysQuickReactionChanged(String actorName, String emoji) {
    return '$actorName a changé la réaction rapide en $emoji';
  }

  @override
  String sysGroupCreated(String actorName) {
    return '$actorName a créé le groupe';
  }

  @override
  String sysMembersAdded(String actorName) {
    return '$actorName a ajouté de nouveaux membres';
  }

  @override
  String sysMemberLeft(String actorName) {
    return '$actorName a quitté le groupe';
  }

  @override
  String sysMemberRemoved(String actorName) {
    return '$actorName a retiré un membre';
  }

  @override
  String sysMemberJoined(String actorName) {
    return '$actorName a rejoint le groupe';
  }

  @override
  String sysPinnedMessage(String actorName) {
    return '$actorName a épinglé un message';
  }

  @override
  String sysUnpinnedMessage(String actorName) {
    return '$actorName a désépinglé un message';
  }

  @override
  String systemVideoCallEnded(String duration) {
    return 'Appel vidéo terminé · $duration';
  }

  @override
  String systemVoiceCallEnded(String duration) {
    return 'Appel vocal terminé · $duration';
  }

  @override
  String get systemVideoCallMissed => 'Appel vidéo manqué';

  @override
  String get systemVoiceCallMissed => 'Appel vocal manqué';

  @override
  String get errActionFailed =>
      'Une erreur s\'est produite. Veuillez réessayer.';

  @override
  String get kbDeleteFailed => 'Échec de la suppression, veuillez réessayer';

  @override
  String get exploreJoinFailed => 'Impossible de rejoindre le canal';

  @override
  String get unnamedChannel => 'Sans nom';

  @override
  String get actionOk => 'OK';

  @override
  String get reminderDeleteConfirm => 'Supprimer ce rappel ?';

  @override
  String get profileNameLabel => 'Nom';

  @override
  String get genderMale => 'Homme';

  @override
  String get genderFemale => 'Femme';

  @override
  String get genderOther => 'Autre';

  @override
  String get aiPersonaSaved => 'Enregistré';

  @override
  String get aiPersonaResetTitle => 'Réinitialiser la persona IA';

  @override
  String get aiPersonaResetConfirm =>
      'Réinitialiser la persona IA à ses paramètres par défaut ?';

  @override
  String get aiPersonaToneLabel => 'Ton';

  @override
  String get aiPersonaResetToDefault => 'Rétablir les valeurs par défaut';

  @override
  String tokenUsagePercentUsed(String percent) {
    return '$percent% utilisé ce mois-ci';
  }

  @override
  String tokenUsageCostUsd(String amount) {
    return '$amount USD';
  }

  @override
  String get notifications => 'Notifications';

  @override
  String get notificationsEnabled => 'Les notifications sont activées';

  @override
  String get notificationsDisabled => 'Les notifications sont désactivées';

  @override
  String get legalScreenTitle => 'Confidentialité & Conditions';

  @override
  String get legalLastUpdated => 'Dernière mise à jour : 15 juin 2026';

  @override
  String get legalDataCollectionTitle => '1. Collecte de Données';

  @override
  String get legalDataCollectionContent =>
      'Nous collectons les informations que vous nous fournissez directement, par exemple lors de la création ou modification de votre compte, de l\'utilisation de nos services ou de vos communications avec nous, notamment votre nom, adresse e-mail, photo de profil et les messages que vous envoyez.';

  @override
  String get legalDataUsageTitle => '2. Comment Nous Utilisons Vos Données';

  @override
  String get legalDataUsageContent =>
      'Vos données sont utilisées pour fournir, maintenir et améliorer nos services, notamment en facilitant la communication entre utilisateurs, en assurant la sécurité et en personnalisant votre expérience.';

  @override
  String get legalSecurityTitle => '3. Sécurité';

  @override
  String get legalSecurityContent =>
      'Nous mettons en œuvre des mesures de sécurité conformes aux normes de l\'industrie pour protéger vos informations personnelles et vos messages. L\'accès aux données est strictement contrôlé et nous utilisons le chiffrement pour sécuriser les informations sensibles.';

  @override
  String get legalUserRightsTitle => '4. Vos Droits';

  @override
  String get legalUserRightsContent =>
      'Vous avez le droit d\'accéder, de corriger ou de supprimer vos données personnelles. Vous pouvez supprimer votre compte à tout moment via les paramètres de l\'application.';

  @override
  String get legalTermsTitle => '5. Conditions d\'Utilisation';

  @override
  String get legalTermsContent =>
      'En utilisant notre plateforme, vous acceptez de ne pas vous engager dans des activités abusives, harcelantes ou illégales. Nous nous réservons le droit de suspendre ou de résilier les comptes qui enfreignent ces conditions.';

  @override
  String get authMsgLoginSuccess => 'Connexion réussie.';

  @override
  String get authMsgLogoutSuccess => 'Déconnexion réussie.';

  @override
  String get authMsgOtpSent => 'Un OTP a été envoyé à votre adresse e-mail.';

  @override
  String get authMsgOtpValid => 'OTP vérifié avec succès.';

  @override
  String get authMsgOtpResent => 'Un nouvel OTP a été envoyé.';

  @override
  String get authMsgPasswordUpdated =>
      'Mot de passe mis à jour avec succès. Veuillez vous reconnecter.';

  @override
  String get authMsgRegisterSuccess =>
      'Inscription réussie. Un OTP a été envoyé à votre adresse e-mail.';

  @override
  String get authMsgAccountUnverifiedOtpSent =>
      'Compte non encore vérifié. Un nouvel OTP a été envoyé à votre adresse e-mail.';

  @override
  String get authErrOtpInvalid => 'Code OTP invalide.';

  @override
  String get authErrOtpExpired => 'L\'OTP a expiré.';

  @override
  String get authErrOtpAttemptsExceeded =>
      'Trop de tentatives incorrectes. Veuillez demander un nouvel OTP.';

  @override
  String authErrOtpWrongWithRemaining(int remaining) {
    return 'OTP incorrect. $remaining tentative(s) restante(s).';
  }

  @override
  String authErrOtpResendCooldown(int ttl) {
    return 'Veuillez attendre $ttl secondes avant de demander un nouvel OTP.';
  }

  @override
  String get authErrEmailDomainInvalid =>
      'Le domaine de l\'e-mail n\'existe pas ou n\'a pas d\'enregistrements MX.';

  @override
  String get authErrEmailNotFound =>
      'Cet e-mail n\'existe pas dans le système.';

  @override
  String get authErrEmailInUse => 'Cet e-mail est déjà utilisé.';

  @override
  String get authErrValEmailInvalid => 'Format d\'e-mail invalide.';

  @override
  String get authErrValEmailRequired => 'L\'e-mail est obligatoire.';

  @override
  String get authErrValDisplaynameRequired =>
      'Le nom d\'affichage est obligatoire.';

  @override
  String get authErrValDisplaynameTooShort =>
      'Le nom d\'affichage est trop court (minimum 2 caractères).';

  @override
  String get authErrValPasswordTooShort =>
      'Le mot de passe doit contenir au moins 8 caractères.';

  @override
  String authErrAccountLocked(int minutes) {
    return 'Compte temporairement bloqué pendant $minutes minute(s) en raison de trop nombreuses tentatives échouées.';
  }

  @override
  String authErrLoginFailedWithRemaining(int remaining) {
    return 'E-mail ou mot de passe incorrect. $remaining tentative(s) restante(s).';
  }

  @override
  String authErrLoginFailedLocked(int minutes) {
    return 'Trop de tentatives échouées. Compte bloqué pendant $minutes minute(s).';
  }

  @override
  String get authErrTokenInvalid => 'Token invalide.';

  @override
  String get authErrSessionNotFound => 'Session introuvable ou expirée.';

  @override
  String get authErrSessionInvalid => 'La session n\'existe pas ou a expiré.';

  @override
  String get authErrSessionRevoked => 'La session a été révoquée.';

  @override
  String get authErrRefreshTokenReuse =>
      'Alerte de sécurité : réutilisation du token de rafraîchissement détectée. Toutes les sessions ont été révoquées.';

  @override
  String get authErrRefreshTokenInvalid =>
      'Token de rafraîchissement invalide.';

  @override
  String get authErrRefreshTokenRotated =>
      'Le token de rafraîchissement a déjà été renouvelé.';

  @override
  String get authErrTokenSessionMismatch =>
      'Le token ne correspond pas à la session.';

  @override
  String get authErrSocialEmailUnavailable =>
      'Impossible de récupérer l\'e-mail depuis le compte social.';

  @override
  String get authErrLoginCodeInvalid =>
      'Le code de connexion est invalide ou a expiré.';

  @override
  String get authErrUserNotFound => 'Utilisateur introuvable.';

  @override
  String get integrationsTitle => 'Intégrations';

  @override
  String get integrationsSubtitle =>
      'Connectez un compte une fois. Ensuite, écrivez simplement à votre assistant — il agit en votre nom, avec vos autorisations et rien de plus.';

  @override
  String get integrationsSettingsSubtitle =>
      'Connectez des outils que votre assistant peut utiliser';

  @override
  String get connectorStatusConnected => 'Connecté';

  @override
  String get connectorStatusAvailable => 'Disponible';

  @override
  String get connectorStatusComingSoon => 'Bientôt disponible';

  @override
  String get connectorConnect => 'Connecter';

  @override
  String get connectorManage => 'Gérer';

  @override
  String get connectorDisconnect => 'Déconnecter';

  @override
  String get connectorDisconnectConfirm =>
      'Déconnecter ce compte ? Votre assistant perdra l\'accès à ses outils.';

  @override
  String get connectorOpenFailed =>
      'Impossible d\'ouvrir la page d\'autorisation.';

  @override
  String get customMcpTitle => 'Ajouter un serveur MCP personnalisé';

  @override
  String get customMcpSubtitle =>
      'Pointez votre assistant vers n\'importe quel serveur MCP. Nous découvrirons ses outils et votre assistant pourra les utiliser.';

  @override
  String get customMcpName => 'Nom';

  @override
  String get customMcpUrl => 'URL du serveur';

  @override
  String get customMcpAuth => 'AUTH';

  @override
  String get customMcpAuthNone => 'Aucune';

  @override
  String get customMcpAuthApiKey => 'Clé API';

  @override
  String get customMcpAuthOauth => 'OAuth';

  @override
  String get customMcpCredential => 'Identifiant';

  @override
  String get customMcpDiscover => 'Découvrir les outils';

  @override
  String get customMcpSave => 'Enregistrer';

  @override
  String get customMcpSaved => 'Serveur MCP personnalisé ajouté.';

  @override
  String customMcpToolsFound(int count) {
    return '$count outils découverts';
  }

  @override
  String get permissionsTitle => 'Autorisations de l\'IA';

  @override
  String get permissionsSubtitle =>
      'Choisissez les actions que votre assistant peut effectuer via ce connecteur.';

  @override
  String get permView => 'Consulter';

  @override
  String get permCreate => 'Créer';

  @override
  String get permEdit => 'Modifier';

  @override
  String get permDelete => 'Supprimer';

  @override
  String get permViewDesc =>
      'Lire les données, rechercher et résumer (lecture seule).';

  @override
  String get permCreateDesc =>
      'Ajouter de nouveaux éléments tels que fichiers, événements ou enregistrements.';

  @override
  String get permEditDesc => 'Modifier les éléments existants et leur contenu.';

  @override
  String get permDeleteDesc => 'Supprimer définitivement les éléments.';

  @override
  String get permManage => 'Autorisations';

  @override
  String get permSaved => 'Autorisations mises à jour.';

  @override
  String get skillsTitle => 'Compétences';

  @override
  String get skillsSubtitle =>
      'Les compétences regroupent un ensemble d\'outils et une façon de travailler. Activez seulement ce dont vous avez besoin — chacune indique ses prérequis.';

  @override
  String get skillsSettingsSubtitle =>
      'Choisissez les points forts de votre assistant';

  @override
  String skillNeeds(String requirements) {
    return 'Nécessite $requirements';
  }

  @override
  String get skillSchedulerName => 'Planificateur';

  @override
  String get skillSchedulerDesc =>
      'Réserve des réunions, trouve des créneaux, envoie invitations et rappels.';

  @override
  String get skillMailWriterName => 'Rédacteur d\'e-mails';

  @override
  String get skillMailWriterDesc =>
      'Rédige des réponses dans votre style, résume les longs fils.';

  @override
  String get skillResearcherName => 'Chercheur';

  @override
  String get skillResearcherDesc =>
      'Cherche sur le web et dans votre Drive, renvoie des réponses sourcées.';

  @override
  String get skillProjectKeeperName => 'Gardien de projet';

  @override
  String get skillProjectKeeperDesc =>
      'Classe notes et tâches dans Notion, garde les bases de données en ordre.';

  @override
  String get skillMeetingNotesName => 'Notes de réunion';

  @override
  String get skillMeetingNotesDesc =>
      'Résume les réunions et dégage décisions et actions à mener.';

  @override
  String get skillInboxTriageName => 'Tri de la boîte de réception';

  @override
  String get skillInboxTriageDesc =>
      'Priorise les messages et suggère des réponses rapides.';

  @override
  String get skillDataAnalystName => 'Analyste de données';

  @override
  String get skillDataAnalystDesc =>
      'Analyse tableaux et chiffres ; révèle tendances et valeurs aberrantes.';

  @override
  String get skillDocDrafterName => 'Rédacteur de documents';

  @override
  String get skillDocDrafterDesc =>
      'Rédige propositions, spécifications et rapports structurés.';

  @override
  String get skillTranslatorName => 'Traducteur';

  @override
  String get skillTranslatorDesc =>
      'Traduit et localise les textes naturellement entre les langues.';

  @override
  String get adminTitle => 'Console d\'administration';

  @override
  String get adminSubtitle =>
      'Gérez votre espace, départements, membres et rôles';

  @override
  String get adminBack => 'Retour';

  @override
  String get adminLoading => 'Chargement…';

  @override
  String get adminSave => 'Enregistrer';

  @override
  String get adminSaving => 'Enregistrement…';

  @override
  String get adminCancel => 'Annuler';

  @override
  String get adminToastSaved => 'Enregistré';

  @override
  String get adminToastDeleted => 'Supprimé';

  @override
  String get adminToastError => 'Une erreur s\'est produite';

  @override
  String get adminMenu => 'Administration';

  @override
  String get adminSettingsSubtitle => 'Espace, départements, membres et rôles';

  @override
  String get adminNavWorkspace => 'Espace';

  @override
  String get adminNavDepartments => 'Départements';

  @override
  String get adminNavMembers => 'Membres';

  @override
  String get adminNavRoles => 'Rôles';

  @override
  String get adminNavAudit => 'Journal d\'audit';

  @override
  String get adminNavAi => 'Assistant IA';

  @override
  String get adminAiInheritHint =>
      'Laissez un champ vide ou choisissez « Hériter » pour utiliser la valeur par défaut du serveur.';

  @override
  String get adminAiInheritOption => 'Hériter (par défaut)';

  @override
  String get adminAiOn => 'Activé';

  @override
  String get adminAiOff => 'Désactivé';

  @override
  String get adminAiPersonaSection => 'Personnalité';

  @override
  String get adminAiPersonaName => 'Nom par défaut de l\'assistant';

  @override
  String get adminAiTone => 'Ton par défaut';

  @override
  String get adminAiToneFriendly => 'Amical';

  @override
  String get adminAiToneProfessional => 'Professionnel';

  @override
  String get adminAiToneConcise => 'Concis';

  @override
  String get adminAiToneCreative => 'Créatif';

  @override
  String get adminAiModelSection => 'Modèle';

  @override
  String get adminAiModelTier => 'Niveau de modèle par défaut';

  @override
  String get adminAiTierAuto => 'Auto (routeur)';

  @override
  String get adminAiTierSimple => 'Simple';

  @override
  String get adminAiTierMid => 'Équilibré';

  @override
  String get adminAiTierComplex => 'Avancé';

  @override
  String get adminAiCapabilitiesSection => 'Capacités';

  @override
  String get adminAiWebSearch => 'Recherche web';

  @override
  String get adminAiWebSearchDesc =>
      'Autoriser l\'assistant à effectuer des recherches sur le web.';

  @override
  String get adminAiThinking => 'Réflexion approfondie';

  @override
  String get adminAiThinkingDesc =>
      'Autoriser l\'assistant à raisonner étape par étape.';

  @override
  String get adminAiDigestSection => 'Résumé quotidien';

  @override
  String get adminAiDailyDigest => 'Résumé quotidien';

  @override
  String get adminAiDailyDigestDesc =>
      'Publie une fois par jour un résumé de l\'activité de chaque conversation IA.';

  @override
  String get adminAiDailyDigestHour => 'Heure d\'envoi';

  @override
  String get adminAiDailyDigestHourDesc =>
      'Heure locale d\'envoi du résumé. Disponible lorsque le résumé est activé.';

  @override
  String get adminAiQuotaSection => 'Limite d\'utilisation';

  @override
  String get adminAiTokenLimit => 'Limite mensuelle de jetons';

  @override
  String get adminAiTokenLimitDesc =>
      'Laissez vide pour hériter ; 0 bloque toute utilisation.';

  @override
  String get adminAiConnectorsSection => 'Connecteurs autorisés';

  @override
  String get adminAiRestrictConnectors =>
      'Restreindre les connecteurs pour l\'IA';

  @override
  String get adminAiConnectorsInherit =>
      'Hérite de la liste autorisée de l\'espace de travail.';

  @override
  String get adminAiConnectorsExplicit =>
      'L\'IA ne peut utiliser que les connecteurs sélectionnés ci-dessous.';

  @override
  String get adminWsIdentity => 'Identité et image de marque';

  @override
  String get adminWsName => 'Nom de l\'espace';

  @override
  String get adminWsNamePlaceholder => 'Acme SARL';

  @override
  String get adminWsLogoUrl => 'URL du logo';

  @override
  String get adminWsPrimaryColor => 'Couleur principale';

  @override
  String get adminWsFeatures => 'Indicateurs de fonctionnalités';

  @override
  String get adminWsNoFeatures =>
      'Aucun indicateur de fonctionnalité configuré.';

  @override
  String get adminWsAllowList => 'Liste blanche de connecteurs';

  @override
  String get adminWsAllowListDesc =>
      'Connecteurs que les membres peuvent connecter personnellement.';

  @override
  String get adminWsNoCatalog => 'Aucun connecteur disponible.';

  @override
  String get adminDeptNew => 'Nouveau département';

  @override
  String get adminDeptEdit => 'Modifier le département';

  @override
  String get adminDeptEmpty => 'Aucun département pour le moment.';

  @override
  String get adminDeptLead => 'Responsable';

  @override
  String get adminDeptLeadNone => 'Aucun';

  @override
  String get adminDeptName => 'Nom';

  @override
  String get adminDeptDescription => 'Description';

  @override
  String get adminDeptDialogDesc =>
      'Les départements regroupent des membres et possèdent leurs discussions.';

  @override
  String adminDeptDeleteConfirm(String name) {
    return 'Supprimer le département « $name » ?';
  }

  @override
  String get adminMemberHint =>
      'Attribuez un rôle et des départements à chaque membre.';

  @override
  String get adminMemberEdit => 'Modifier le membre';

  @override
  String get adminMemberRevokeNote =>
      'L\'enregistrement révoque les sessions actives du membre.';

  @override
  String get adminMemberRole => 'Rôle';

  @override
  String get adminMemberRoleNone => 'Aucun rôle';

  @override
  String get adminMemberDepartments => 'Départements';

  @override
  String get adminRoleHint =>
      'Activez les permissions de chaque rôle. Le rôle Owner est en lecture seule.';

  @override
  String get adminRoleCapability => 'Permission';

  @override
  String get adminRolePreset => 'Prédéfini';

  @override
  String get adminRoleClone => 'Cloner';

  @override
  String adminRoleCloneTitle(String name) {
    return 'Cloner $name';
  }

  @override
  String get adminRoleName => 'Nom du rôle';

  @override
  String get adminAuditTitle => 'Journal d\'audit';

  @override
  String get adminAuditComingSoon =>
      'Le journal d\'audit sera disponible dans une prochaine mise à jour.';

  @override
  String get adminCapManageWorkspace => 'Gérer l\'espace';

  @override
  String get adminCapManageDepartments => 'Gérer les départements';

  @override
  String get adminCapManageMembers => 'Gérer les membres';

  @override
  String get adminCapManageRoles => 'Gérer les rôles';

  @override
  String get adminCapConnectWorkspaceConnector =>
      'Connecter les connecteurs de l\'espace';

  @override
  String get adminCapAddCustomMcp => 'Ajouter un MCP personnalisé';

  @override
  String get adminCapConnectPersonalConnector =>
      'Connecter des connecteurs personnels';

  @override
  String get adminCapUsePersonalAssistant => 'Utiliser l\'assistant personnel';

  @override
  String get adminCapUseGroupBot => 'Utiliser le bot de groupe';

  @override
  String get adminCapRunSensitiveSkill => 'Exécuter des compétences sensibles';

  @override
  String get adminCapViewAuditLog => 'Voir le journal d\'audit';

  @override
  String get adminAuditEmpty => 'Aucune entrée d\'audit pour le moment.';

  @override
  String get adminAuditPrev => 'Précédent';

  @override
  String get adminAuditNext => 'Suivant';

  @override
  String get newConvDepartment => 'Département (facultatif)';

  @override
  String get newConvNoDepartment => 'Aucun département';

  @override
  String get loginWithSso => 'Se connecter avec SSO';

  @override
  String get adminNavSso => 'SSO';

  @override
  String get adminSsoTitle => 'Authentification unique (SSO)';

  @override
  String get adminSsoHint =>
      'Configurez la connexion OIDC. Les identifiants du fournisseur sont dans le .env ; ici, vous associez les groupes IdP aux rôles et départements.';

  @override
  String get adminSsoEnabled => 'Activer le SSO';

  @override
  String get adminSsoAllowedDomains => 'Domaines d’e-mail autorisés';

  @override
  String get adminSsoAllowedDomainsHint =>
      'Séparés par des virgules. Laissez vide pour autoriser tout e-mail vérifié.';

  @override
  String get adminSsoDefaultRole => 'Rôle par défaut';

  @override
  String get adminSsoNone => 'Aucun';

  @override
  String get adminSsoGroupRoleMap => 'Groupe → Rôle';

  @override
  String get adminSsoGroupDeptMap => 'Groupe → Département';

  @override
  String get adminSsoGroupPlaceholder => 'Nom du groupe IdP';

  @override
  String get adminSsoAddMapping => 'Ajouter un mappage';

  @override
  String get sectionDirectoryTitle => 'Annuaire MCP';

  @override
  String get sectionDirectoryDesc =>
      'Parcourez les serveurs MCP et connectez-vous en un clic — OAuth s’exécute automatiquement.';

  @override
  String get directoryAdd => 'Ajouter une entrée';

  @override
  String get directorySearch => 'Rechercher dans l’annuaire…';

  @override
  String get directoryEmpty => 'Aucune entrée ne correspond à votre recherche.';

  @override
  String get directoryEdit => 'Modifier l’entrée';

  @override
  String get directoryDelete => 'Supprimer l’entrée';

  @override
  String get tierWorkspace => 'Espace de travail';

  @override
  String get tierPersonal => 'Personnel';

  @override
  String get tierBoth => 'Personnel / Espace de travail';

  @override
  String get directorySaveSuccess => 'Entrée d’annuaire enregistrée.';

  @override
  String get directoryDeleteSuccess => 'Entrée d’annuaire supprimée.';

  @override
  String get directoryAddTitle => 'Ajouter une entrée d’annuaire';

  @override
  String get directoryEditTitle => 'Modifier l’entrée d’annuaire';

  @override
  String get directoryDialogDesc =>
      'Ajoutez un serveur MCP public que les membres peuvent connecter en un clic.';

  @override
  String get directorySlug => 'Slug';

  @override
  String get directoryName => 'Nom';

  @override
  String get directoryDescription => 'Description';

  @override
  String get directoryMcpUrl => 'URL MCP';

  @override
  String get directoryAuthMode => 'Mode d’authentification';

  @override
  String get directoryTier => 'Niveau';

  @override
  String get directoryEnvHint =>
      'Pour env-oauth : référencez les variables d’environnement contenant les identifiants du client OAuth.';

  @override
  String get directoryEnvClientId => 'Variable Client ID';

  @override
  String get directoryEnvClientSecret => 'Variable Client secret';

  @override
  String get directoryAuthorizeUrl => 'URL d’autorisation';

  @override
  String get directoryTokenUrl => 'URL du jeton';

  @override
  String get directoryCancel => 'Annuler';

  @override
  String get directorySave => 'Enregistrer';

  @override
  String directoryKeyTitle(String provider) {
    return 'Connecter $provider';
  }

  @override
  String get directoryKeyLabel => 'Clé API';

  @override
  String directoryConnected(String provider) {
    return '$provider connecté.';
  }

  @override
  String get editNicknames => 'Modifier les surnoms';

  @override
  String get nicknameModalTitle => 'Surnoms';

  @override
  String get nicknameNonePlaceholder => 'Aucun surnom';

  @override
  String get nicknameYouSuffix => '(vous)';

  @override
  String get adminNavUsage => 'Utilisation';

  @override
  String get usageThisMonth => 'Ce mois-ci';

  @override
  String get usageTotalTokens => 'Jetons totaux';

  @override
  String get usageRequests => 'Requêtes';

  @override
  String get usageEstCost => 'Coût estimé';

  @override
  String get usageThumbsDownRate => 'Taux de pouce vers le bas';

  @override
  String usageFeedbackBreakdown(int down, int total) {
    return '$down sur $total évaluées';
  }

  @override
  String get usagePerModelTitle => 'Coût par modèle';

  @override
  String usageModelTokens(String input, String output, String requests) {
    return '$input ent. / $output sort. · $requests req.';
  }

  @override
  String get usageTopUsersTitle => 'Principaux utilisateurs';

  @override
  String usageUserRequests(int count) {
    return '$count requêtes';
  }

  @override
  String get usageWorstAnswersTitle => 'Réponses les moins bien notées';

  @override
  String get usageNoPreview => '(aucun aperçu de réponse)';

  @override
  String usageUserComment(String comment) {
    return '« $comment »';
  }

  @override
  String get usageNoData => 'Aucune donnée pour cette période.';

  @override
  String get usageLoadError =>
      'Impossible de charger le tableau de bord d’utilisation.';

  @override
  String get usageRetry => 'Réessayer';

  @override
  String get assistantDefaultName => 'Mon assistant';

  @override
  String get assistantSubtitle => 'Votre assistant personnel';

  @override
  String get assistantOpenChat => 'Ouvrir le chat de l’assistant';

  @override
  String get assistantSetupCta => 'Configurer l’assistant';

  @override
  String get assistantSetupTitle => 'Configurez votre assistant';

  @override
  String get assistantSetupStepName => 'Nommez votre assistant';

  @override
  String get assistantSetupStepPersona => 'Définissez sa personnalité';

  @override
  String get assistantSetupStepModel => 'Choisissez un modèle';

  @override
  String get assistantSetupStepConfirm => 'Vérifier et créer';

  @override
  String get assistantSetupNamePlaceholder => 'p. ex. Aria';

  @override
  String get assistantSetupPersonaPlaceholder =>
      'Vous êtes un assistant utile qui…';

  @override
  String get assistantSetupPersonaHint =>
      'Décrivez comment votre assistant doit parler et se comporter.';

  @override
  String get assistantSetupCreateButton => 'Créer l’assistant';

  @override
  String get assistantSetupCreating => 'Création…';

  @override
  String get assistantSetupSuccess => 'Votre assistant est prêt';

  @override
  String get assistantSettingsTitle => 'Paramètres de l’assistant';

  @override
  String get assistantSettingsEditPersona => 'Personnalité';

  @override
  String get assistantSettingsChangeModel => 'Modèle';

  @override
  String get assistantSettingsDeleteTitle => 'Supprimer l’assistant';

  @override
  String get assistantSettingsDeleteConfirm =>
      'Cela supprimera votre assistant et son chat. Cette action est irréversible.';

  @override
  String get assistantSettingsDeleteButton => 'Supprimer l’assistant';

  @override
  String get botAdminTitle => 'Intégration des bots';

  @override
  String get botAdminGenerateToken => 'Générer un jeton';

  @override
  String get botAdminRevokeToken => 'Révoquer';

  @override
  String get botAdminTokenWarning =>
      'Copiez ce jeton maintenant : il n’est affiché qu’une seule fois et ne peut pas être récupéré.';

  @override
  String get botAdminCopyToken => 'Copier';

  @override
  String get botAdminMcpUrl => 'URL MCP';

  @override
  String get botAdminToken => 'Jeton d\'intégration';

  @override
  String get botAdminLastUsed => 'Dernière utilisation';

  @override
  String get botAdminNeverUsed => 'Jamais utilisé';

  @override
  String get botAdminNoBotsRegistered => 'Aucun bot enregistré pour le moment.';

  @override
  String get helpTitle => 'Aide et FAQ';

  @override
  String get settingsHelp => 'Aide et FAQ';

  @override
  String get settingsHelpSubtitle => 'Centre d\'aide et questions fréquentes';

  @override
  String get helpSearchHint => 'Rechercher dans l\'aide…';

  @override
  String get helpNoResults => 'Aucun résultat trouvé';

  @override
  String get helpCatGettingStarted => 'Premiers pas';

  @override
  String get helpCatMessaging => 'Messagerie';

  @override
  String get helpCatAiFeatures => 'Fonctionnalités d\'IA';

  @override
  String get helpCatGroups => 'Groupes';

  @override
  String get helpCatAccountSecurity => 'Compte et sécurité';

  @override
  String get helpGettingStartedQ1 => 'Qu\'est-ce que PON ?';

  @override
  String get helpGettingStartedA1 =>
      'PON est une plateforme de messagerie auto-hébergée propulsée par l\'IA qui combine la communication d\'équipe avec un assistant IA intégré. Elle prend en charge les messages directs, les discussions de groupe et les flux de travail pilotés par l\'IA.';

  @override
  String get helpGettingStartedQ2 => 'Comment créer un compte ?';

  @override
  String get helpGettingStartedA2 =>
      'Votre compte est créé par l\'administrateur de votre espace de travail. Vous recevrez un e-mail d\'invitation contenant les instructions pour définir votre mot de passe et vérifier votre compte.';

  @override
  String get helpGettingStartedQ3 => 'Comment trouver et ajouter des amis ?';

  @override
  String get helpGettingStartedA3 =>
      'Accédez à l\'onglet Amis et utilisez la barre de recherche pour trouver des collègues par nom ou par e-mail. Envoyez une demande d\'ami et commencez à discuter une fois la demande acceptée.';

  @override
  String get helpGettingStartedQ4 => 'Comment démarrer une conversation ?';

  @override
  String get helpGettingStartedA4 =>
      'Touchez l\'icône de rédaction sur l\'écran des conversations, recherchez un contact et sélectionnez-le pour ouvrir une nouvelle conversation.';

  @override
  String get helpMessagingQ1 => 'Comment envoyer des messages ?';

  @override
  String get helpMessagingA1 =>
      'Saisissez votre message dans le champ de texte au bas de la conversation, puis appuyez sur Entrée ou touchez le bouton d\'envoi.';

  @override
  String get helpMessagingQ2 => 'Puis-je envoyer des messages vocaux ?';

  @override
  String get helpMessagingA2 =>
      'Oui ! Maintenez le bouton du microphone dans la zone de saisie pour enregistrer un message vocal. Relâchez pour envoyer ou balayez pour annuler.';

  @override
  String get helpMessagingQ3 => 'Comment envoyer des fichiers et des images ?';

  @override
  String get helpMessagingA3 =>
      'Touchez l\'icône de pièce jointe à côté de la zone de saisie pour sélectionner des images, des vidéos ou des fichiers depuis votre appareil.';

  @override
  String get helpMessagingQ4 => 'Comment épingler les messages importants ?';

  @override
  String get helpMessagingA4 =>
      'Appuyez longuement ou survolez un message, touchez le menu Plus (⋯) et sélectionnez « Épingler le message ». Les messages épinglés apparaissent en haut de la conversation. Vous pouvez épingler jusqu\'à 2 messages par conversation.';

  @override
  String get helpMessagingQ5 => 'Que sont les réactions aux messages ?';

  @override
  String get helpMessagingA5 =>
      'Survolez ou appuyez longuement sur un message, puis touchez l\'icône emoji pour ajouter une réaction rapide. Les autres peuvent la voir et ajouter les leurs.';

  @override
  String get helpAiFeaturesQ1 => 'Que peut faire l\'assistant IA ?';

  @override
  String get helpAiFeaturesA1 =>
      'L\'assistant IA (@AI) peut répondre à des questions, résumer des conversations, aider à rédiger des messages, analyser des documents téléchargés et exécuter des tâches à l\'aide d\'outils connectés.';

  @override
  String get helpAiFeaturesQ2 => 'Comment utiliser @AI dans une conversation ?';

  @override
  String get helpAiFeaturesA2 =>
      'Dans n\'importe quelle conversation, saisissez @AI suivi de votre question ou de votre demande. L\'assistant répondra dans le fil de la conversation.';

  @override
  String get helpAiFeaturesQ3 => 'Qu\'est-ce que la mémoire de l\'IA ?';

  @override
  String get helpAiFeaturesA3 =>
      'La mémoire de l\'IA permet à l\'assistant de se souvenir du contexte des conversations précédentes, rendant les interactions plus personnalisées et plus efficaces au fil du temps.';

  @override
  String get helpAiFeaturesQ4 => 'Comment configurer mon assistant personnel ?';

  @override
  String get helpAiFeaturesA4 =>
      'Accédez à la section Assistant IA et touchez « Configurer l\'assistant ». Vous pouvez configurer la personnalité de l\'assistant, connecter des outils et définir vos préférences.';

  @override
  String get helpGroupsQ1 => 'Comment créer un groupe ?';

  @override
  String get helpGroupsA1 =>
      'Touchez l\'icône de rédaction, sélectionnez « Nouveau groupe », ajoutez des membres en recherchant leurs noms, définissez un nom de groupe, puis touchez Créer.';

  @override
  String get helpGroupsQ2 => 'Comment ajouter des membres à un groupe ?';

  @override
  String get helpGroupsA2 =>
      'Ouvrez la conversation de groupe, touchez l\'icône Paramètres et sélectionnez « Ajouter des membres ». Recherchez des contacts et ajoutez-les.';

  @override
  String get helpGroupsQ3 => 'Que sont les rôles de groupe ?';

  @override
  String get helpGroupsA3 =>
      'Les groupes ont deux rôles : Administrateur et Membre. Les administrateurs peuvent ajouter/supprimer des membres, modifier le nom et l\'avatar du groupe et gérer les paramètres du groupe.';

  @override
  String get helpAccountSecurityQ1 => 'Comment changer ma photo de profil ?';

  @override
  String get helpAccountSecurityA1 =>
      'Accédez à Paramètres → Profil, touchez votre avatar actuel et choisissez une nouvelle photo depuis votre appareil.';

  @override
  String get helpAccountSecurityQ2 =>
      'Comment activer les messages éphémères ?';

  @override
  String get helpAccountSecurityA2 =>
      'Ouvrez une conversation, touchez l\'icône Paramètres, accédez à Personnaliser la discussion et activez « Messages éphémères » avec le minuteur de votre choix.';

  @override
  String get helpAccountSecurityQ3 => 'Comment bloquer un utilisateur ?';

  @override
  String get helpAccountSecurityA3 =>
      'Ouvrez la conversation avec l\'utilisateur, touchez l\'icône Paramètres, faites défiler jusqu\'à Confidentialité et assistance, puis sélectionnez « Bloquer l\'utilisateur ».';

  @override
  String get helpAccountSecurityQ4 =>
      'Comment supprimer l\'historique des messages ?';

  @override
  String get helpAccountSecurityA4 =>
      'Ouvrez la conversation, touchez Paramètres, accédez à Confidentialité et assistance, puis sélectionnez « Effacer l\'historique ». Cela supprime uniquement l\'historique de votre appareil.';
}
