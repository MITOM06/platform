// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for French (`fr`).
class AppLocalizationsFr extends AppLocalizations {
  AppLocalizationsFr([String locale = 'fr']) : super(locale);

  @override
  String get appTagline => 'Connecter & Discuter';

  @override
  String get appName => 'PON';

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get notificationsSectionUnread => 'Non lues';

  @override
  String get notificationsSectionRead => 'Lues';

  @override
  String get notificationsEmpty => 'Aucune notification pour le moment';

  @override
  String get notificationsMarkAllRead => 'Tout marquer comme lu';

  @override
  String get notificationAccept => 'Accepter';

  @override
  String get notificationDecline => 'Refuser';

  @override
  String notificationFriendRequestTitle(String name) {
    return '$name vous a envoyé une demande d\'ami';
  }

  @override
  String notificationFriendAcceptedTitle(String name) {
    return '$name a accepté votre demande d\'ami';
  }

  @override
  String get notificationPhoneSetupTitle => 'Vérifier le numéro de téléphone';

  @override
  String get notificationPhoneSetupBody =>
      'Ajoutez et vérifiez un numéro de téléphone pour que vos amis puissent vous trouver et renforcer la sécurité de votre compte.';

  @override
  String get notificationPasswordSetupTitle => 'Protégez votre compte';

  @override
  String get notificationPasswordSetupBody =>
      'Votre compte n\'a pas encore de mot de passe. Définissez-en un pour renforcer la sécurité.';

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
  String get actionRetry => 'Réessayer';

  @override
  String get actionSave => 'Enregistrer';

  @override
  String get actionLogout => 'Se déconnecter';

  @override
  String get actionDelete => 'Supprimer';

  @override
  String get actionLeave => 'Quitter';

  @override
  String get loadingDots => '...';

  @override
  String get loginTitle => 'Connexion';

  @override
  String get fieldEmail => 'E-mail';

  @override
  String get fieldPassword => 'Mot de passe';

  @override
  String get forgotPasswordLink => 'Mot de passe oublié ?';

  @override
  String get loginButton => 'Se connecter';

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
  String get wallpaperPresetMidnightGlow => 'Lueur de minuit';

  @override
  String get wallpaperPresetNeonTeal => 'Turquoise néon';

  @override
  String get wallpaperPresetSunset => 'Coucher de soleil';

  @override
  String get wallpaperPresetSweetPink => 'Rose doux';

  @override
  String get wallpaperPresetDarkShadow => 'Ombre sombre';

  @override
  String get wallpaperPresetOceanBlue => 'Bleu océan';

  @override
  String get wallpaperPresetForestGreen => 'Vert forêt';

  @override
  String get wallpaperPresetPurpleHaze => 'Brume violette';

  @override
  String get wallpaperPresetWarmAmber => 'Ambre chaud';

  @override
  String get wallpaperPresetRoseGold => 'Or rose';

  @override
  String get wallpaperPresetStorm => 'Tempête';

  @override
  String get wallpaperPresetCherryBlossom => 'Fleur de cerisier';

  @override
  String get wallpaperPresetMidnightPurple => 'Violet de minuit';

  @override
  String get wallpaperPresetCoralReef => 'Récif corallien';

  @override
  String get wallpaperPresetArcticIce => 'Glace arctique';

  @override
  String get wallpaperPresetAurora => 'Aurore';

  @override
  String get wallpaperPresetGalaxy => 'Galaxie';

  @override
  String get wallpaperPresetFireIce => 'Feu et glace';

  @override
  String get wallpaperPresetTropical => 'Tropical';

  @override
  String get wallpaperPresetCandy => 'Bonbon';

  @override
  String get wallpaperPresetPureDark => 'Noir pur';

  @override
  String get wallpaperPresetSoftGray => 'Gris doux';

  @override
  String get wallpaperPresetWarmNight => 'Nuit chaude';

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
  String get welcomeToApp => 'Bienvenue sur PON';

  @override
  String get fieldDisplayName => 'Nom affiché';

  @override
  String get fieldConfirmPassword => 'Confirmer le mot de passe';

  @override
  String get valNameRequired => 'Veuillez saisir votre nom';

  @override
  String get valNameMin2 => 'Le nom doit comporter au moins 2 caractères';

  @override
  String get valPasswordMismatch => 'Les mots de passe ne correspondent pas';

  @override
  String get errEmailExists => 'Cet e-mail est déjà enregistré';

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
  String get confirmButton => 'Confirmer';

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
  String get sendOtpButton => 'Envoyer le code OTP';

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
  String get onboardingChooseTheme => 'Choisissez un thème';

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
  String get startExperience => 'Commencer l\'expérience';

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
  String get startConversationButton => 'Commencer à discuter';

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
  String get tabArchived => 'Archivés';

  @override
  String get tabRequests => 'Demandes';

  @override
  String get tabNew => 'Nouveau';

  @override
  String get noRequests => 'Aucune demande en attente';

  @override
  String get declineRequest => 'Refuser';

  @override
  String get dmRequestSubtitle => 'Veut vous envoyer un message';

  @override
  String get groupInviteSubtitle => 'Vous a invité dans un groupe';

  @override
  String get blockedChatsTitle => 'Chats bloqués';

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
  String get downloadAction => 'Télécharger';

  @override
  String get actionReact => 'Réagir';

  @override
  String get messageRecalled => 'Le message a été retiré';

  @override
  String get messageSendFailedRetry =>
      'Échec de l\'envoi. Appuyez pour réessayer.';

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
  String get imageDownloadHd => 'Voir en HD';

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
  String get callNoAnswer => 'Pas de réponse';

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
  String get profileRoleLabel => 'Rôle';

  @override
  String get profileRoleMemberDefault => 'Membre';

  @override
  String get roleLabel => 'Rôle';

  @override
  String get privacySectionLabel => 'Confidentialité';

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
  String get pinLimitReached => 'Vous pouvez épingler jusqu\'à 5 messages';

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
  String get aiSkills => 'Compétences';

  @override
  String get adminOwnerOnly => 'Admin ou propriétaire uniquement';

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
  String get phoneNoNumber => 'Aucun numéro de téléphone';

  @override
  String get phoneNoticeText =>
      'Ajoutez un numéro de téléphone pour sécuriser votre compte.';

  @override
  String get phoneVerifyAction => 'Vérifier';

  @override
  String get phoneUnverifiedBadge => 'Non vérifié';

  @override
  String get phoneModalPhoneSubtitle =>
      'Saisissez votre numéro de téléphone pour recevoir un code.';

  @override
  String get phoneRateLimit =>
      'Veuillez patienter avant de demander un autre code.';

  @override
  String get phoneAlreadyTaken => 'Ce numéro de téléphone est déjà utilisé.';

  @override
  String get phoneInvalidNumber => 'Numéro de téléphone invalide.';

  @override
  String get phoneOtpExpired => 'Code expiré — demandez-en un nouveau.';

  @override
  String get phoneResend => 'Renvoyer le code';

  @override
  String phoneResendCountdown(int seconds) {
    return 'Renvoyer dans ${seconds}s';
  }

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
  String get tokenUsageSelectRange => 'Sélectionner la période';

  @override
  String get tokenUsageDateRangeError =>
      'La date de début doit précéder la date de fin';

  @override
  String get coverPhotoPreviewTitle => 'Aperçu de la photo de couverture';

  @override
  String get saveCoverPhoto => 'Définir comme couverture';

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
      'Vous devez accepter les Conditions d\'Utilisation pour continuer';

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
  String get authErrOtpSendFailed =>
      'Impossible d\'envoyer le code de vérification pour le moment. Réessayez dans un instant.';

  @override
  String get authErrEmailNotFound =>
      'Cet e-mail n\'existe pas dans le système.';

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
  String get customMcpAuth => 'Auth';

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
  String get skillsRealActionNote =>
      'Les compétences changent la façon dont votre assistant réfléchit et s\'exprime. Pour qu\'il agisse réellement (envoyer un e-mail, créer des événements, écrire dans Notion…), connectez l\'application correspondante ci-dessous.';

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
      'Propose des horaires de réunion et rédige des invitations — c\'est à vous de les envoyer via votre agenda/messagerie (ou connectez Google Agenda/Gmail pour qu\'il agisse directement).';

  @override
  String get skillMailWriterName => 'Rédacteur d\'e-mails';

  @override
  String get skillMailWriterDesc =>
      'Rédige des réponses dans votre style, résume les longs fils.';

  @override
  String get skillResearcherName => 'Chercheur';

  @override
  String get skillResearcherDesc =>
      'Répond à partir du contenu de cette conversation et de ses connaissances, avec des sources citées lorsque c\'est possible — pas de recherche web en direct.';

  @override
  String get skillProjectKeeperName => 'Gardien de projet';

  @override
  String get skillProjectKeeperDesc =>
      'Suit les tâches, les responsables et les décisions dans la conversation et les résume — connectez Notion pour qu\'il puisse vraiment les y écrire.';

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
  String get skillWebSearchName => 'Recherche web';

  @override
  String get skillWebSearchDesc =>
      'Trouve des informations récentes sur le web et cite les sources.';

  @override
  String get skillWeatherForecastName => 'Météo';

  @override
  String get skillWeatherForecastDesc =>
      'Consulte la météo et les prévisions pour tout lieu.';

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
  String get adminMemberRoleLockedSelf =>
      'Vous ne pouvez pas modifier votre propre rôle.';

  @override
  String get adminMemberRoleLockedOwner =>
      'Seul un Propriétaire peut modifier le rôle d\'un Propriétaire.';

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
  String get adminSsoEnforce => 'Exiger le SSO pour ces domaines';

  @override
  String get adminSsoEnforceHint =>
      'Les membres de ces domaines e-mail doivent se connecter avec SSO. Les Propriétaires peuvent toujours utiliser un mot de passe avec 2FA.';

  @override
  String get adminSsoEnforceNotReady =>
      'Activez d\'abord le SSO et ajoutez au moins un domaine autorisé.';

  @override
  String get adminSsoEnforceConfirmTitle => 'Exiger le SSO pour ces domaines ?';

  @override
  String get adminSsoEnforceConfirmPasswords =>
      'La connexion par mot de passe, la connexion Google et la réinitialisation du mot de passe sont désactivées pour ces domaines.';

  @override
  String get adminSsoEnforceConfirmOwners =>
      'Les Propriétaires conservent la connexion par mot de passe + 2FA comme compte de secours.';

  @override
  String get adminSsoEnforceConfirmSessions =>
      'Les personnes de ces domaines connectées sans SSO seront déconnectées lors de l\'enregistrement.';

  @override
  String get adminSsoEnforceConfirm => 'Exiger le SSO';

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

  @override
  String get blockedChats => 'Bloqués';

  @override
  String get noBlockedChats => 'Aucune conversation bloquée';

  @override
  String get blockAndHide => 'Bloquer et masquer';

  @override
  String get unblockAndRestore => 'Débloquer';

  @override
  String get callBlocked => 'Cet utilisateur ne souhaite pas être contacté';

  @override
  String get mute15min => '15 minutes';

  @override
  String get mute30min => '30 minutes';

  @override
  String get mute1hour => '1 heure';

  @override
  String get mute24hours => '24 heures';

  @override
  String get muteForever => 'Jusqu\'à ce que je le réactive';

  @override
  String get profileBlockedByOwner =>
      'Le profil de cet utilisateur n\'est pas disponible';

  @override
  String get unsavedChangesTitle =>
      'Vous avez des modifications non enregistrées';

  @override
  String get unsavedChangesDesc =>
      'Si vous quittez, vos modifications seront perdues.';

  @override
  String get keepEditing => 'Continuer la modification';

  @override
  String get saveAndLeave => 'Enregistrer et quitter';

  @override
  String get leaveWithoutSaving => 'Quitter sans enregistrer';

  @override
  String get aiSessionHistory => 'Historique des conversations';

  @override
  String get aiNewSession => 'Nouvelle conversation';

  @override
  String get aiSessionActive => 'Active';

  @override
  String get aiSessionSummarized => 'Résumée';

  @override
  String get aiSessionEmpty => 'Aucune conversation précédente';

  @override
  String get aiSessionResume => 'Reprendre';

  @override
  String get aiSessionLoadError =>
      'Impossible de charger l\'historique des conversations';

  @override
  String multiSelectCount(int count) {
    return '$count sélectionné(s)';
  }

  @override
  String get multiSelectEmpty => 'Aucun message sélectionné';

  @override
  String get multiSelectCancel => 'Annuler';

  @override
  String multiSelectTypeWarning(String type) {
    return 'Vous sélectionnez $type. Vous ne pouvez sélectionner qu’un seul type.';
  }

  @override
  String multiDeleted(int count) {
    return '$count messages supprimés';
  }

  @override
  String multiRecalled(int count) {
    return '$count messages annulés';
  }

  @override
  String get multiForwardHint => 'Sélectionnez un seul message à transférer';

  @override
  String get msgTypeText => 'texte';

  @override
  String get msgTypeImage => 'photos/vidéos';

  @override
  String get msgTypeFile => 'fichiers';

  @override
  String get selectMessages => 'Sélectionner des messages';

  @override
  String get removeAttachment => 'Supprimer';

  @override
  String get addMore => 'Ajouter';

  @override
  String get attachHdOn => 'HD — haute qualité';

  @override
  String get attachHdOff => 'SD — compressé';

  @override
  String get hdOn => 'HD oui';

  @override
  String get hdOff => 'HD non';

  @override
  String get videoCannotPlay => 'Impossible de lire la vidéo';

  @override
  String get aiContextTitle => 'Contexte IA';

  @override
  String get aiContextIdentityTitle => 'Identité et organisation';

  @override
  String get aiContextResponseStyleTitle => 'Style de réponse';

  @override
  String get aiContextLearnedFactsTitle => 'Ce que l\'IA a appris';

  @override
  String get aiContextCompanyTitle => 'Contexte de l\'entreprise';

  @override
  String get aiContextDepartmentTitle => 'Contexte du département';

  @override
  String get aiContextLabelRole => 'Rôle';

  @override
  String get aiContextLabelDepartment => 'Département';

  @override
  String get aiContextLabelJobTitle => 'Fonction';

  @override
  String get aiContextLabelProjects => 'Projets';

  @override
  String get aiContextRoleUnknown => 'Non attribué';

  @override
  String get aiContextNoDepartment => 'Aucun département';

  @override
  String get aiContextNotSet => 'Non défini';

  @override
  String get aiContextIdentityManaged =>
      'Ces éléments sont définis par votre responsable ou administrateur.';

  @override
  String get aiContextStyleLabel => 'Style de réponse préféré';

  @override
  String get aiContextStyleHint => 'p. ex. concis, formel, code d\'abord';

  @override
  String get aiContextPreferencesLabel => 'Autres préférences';

  @override
  String get aiContextPreferencesHint =>
      'p. ex. éviter les emojis, répondre en français';

  @override
  String get aiContextUpdate => 'Mettre à jour';

  @override
  String get aiContextSaving => 'Enregistrement...';

  @override
  String get aiContextStyleSaved => 'Style de réponse mis à jour';

  @override
  String get aiContextSaveError => 'Échec de l\'enregistrement';

  @override
  String get aiContextKeyFacts => 'Informations clés :';

  @override
  String get aiContextMemoryEmpty => 'Rien n\'a encore été appris';

  @override
  String get aiContextMemoryEmptyHint =>
      'Au fil de vos conversations, l\'assistant mémorisera ici des informations utiles à votre sujet.';

  @override
  String get aiContextTierPublic => 'Public';

  @override
  String get aiContextTierInternal => 'Interne';

  @override
  String get aiContextTierConfidential => 'Confidentiel';

  @override
  String get adminEditAiContext => 'Modifier le contexte IA';

  @override
  String get adminAiContextJobTitle => 'Fonction';

  @override
  String get adminAiContextProjects => 'Projets en cours';

  @override
  String get adminAiContextProjectsHint => 'Un projet par ligne';

  @override
  String get adminAiContextEntriesTitle => 'Contexte IA de l\'entreprise';

  @override
  String get adminAiContextEntriesEmpty =>
      'Aucune entrée de contexte pour le moment.';

  @override
  String get adminEntryLabel => 'Libellé';

  @override
  String get adminEntryText => 'Contenu du contexte';

  @override
  String get adminEntryTier => 'Sensibilité';

  @override
  String get adminEntryScope => 'Portée';

  @override
  String get adminScopeCompany => 'Entreprise';

  @override
  String get adminScopeDepartment => 'Département';

  @override
  String get adminCreateEntry => 'Ajouter une entrée';

  @override
  String get adminEditEntry => 'Modifier l\'entrée';

  @override
  String get adminDeleteEntry => 'Supprimer l\'entrée';

  @override
  String get loginInviteOnlyHint =>
      'PON fonctionne uniquement sur invitation. Demandez une invitation à votre administrateur.';

  @override
  String get loginHaveInviteLink => 'Vous avez un lien d\'invitation ?';

  @override
  String get inviteLinkDialogTitle => 'Ouvrir une invitation';

  @override
  String get inviteLinkDialogHint =>
      'Collez le lien d\'invitation reçu par e-mail';

  @override
  String get inviteLinkInvalid => 'Ce lien d\'invitation ne semble pas valide.';

  @override
  String get inviteOpen => 'Ouvrir';

  @override
  String get inviteCancel => 'Annuler';

  @override
  String get inviteRetry => 'Réessayer';

  @override
  String get inviteTitle => 'Vous êtes invité';

  @override
  String inviteSubtitle(String inviter, String workspace, String role) {
    return '$inviter vous a invité à rejoindre $workspace en tant que $role';
  }

  @override
  String inviteSubtitleNoRole(String inviter, String workspace) {
    return '$inviter vous a invité à rejoindre $workspace';
  }

  @override
  String get inviteContinueWithGoogle => 'Continuer avec Google';

  @override
  String inviteGoogleHint(String email) {
    return 'Utilisez le compte Google de $email';
  }

  @override
  String get inviteOrSetPassword => 'ou définissez un mot de passe';

  @override
  String get inviteSubmit => 'Créer le compte';

  @override
  String get inviteSsoRequired =>
      'Votre organisation exige l\'authentification unique (SSO) pour cette adresse. Connectez-vous avec SSO pour accepter l\'invitation.';

  @override
  String get inviteInvalidTitle => 'Invitation non valide';

  @override
  String get inviteInvalidBody =>
      'Ce lien d\'invitation n\'est pas valide. Vérifiez le lien dans votre e-mail ou demandez une nouvelle invitation à votre administrateur.';

  @override
  String get inviteExpiredTitle => 'Invitation expirée';

  @override
  String get inviteExpiredBody =>
      'Cette invitation a expiré. Demandez à votre administrateur de la renvoyer.';

  @override
  String get inviteRevokedTitle => 'Invitation révoquée';

  @override
  String get inviteRevokedBody =>
      'Cette invitation a été révoquée par votre administrateur.';

  @override
  String get inviteAcceptedTitle => 'Déjà acceptée';

  @override
  String get inviteAcceptedBody =>
      'Cette invitation a déjà été acceptée. Connectez-vous pour continuer.';

  @override
  String get inviteLoadFailedTitle => 'Impossible de charger l\'invitation';

  @override
  String get inviteBackToLogin => 'Retour à la connexion';

  @override
  String get authMsgInvitationAccepted => 'Invitation acceptée. Bienvenue !';

  @override
  String get authErrAccountNotProvisioned =>
      'Le compte choisi n\'a pas encore accès à PON. Essayez un autre compte ou demandez une invitation à votre administrateur.';

  @override
  String get authErrAccountBlocked =>
      'Ce compte a été bloqué. Contactez votre administrateur.';

  @override
  String get authErrInvitationPending =>
      'Vous avez une invitation en attente. Ouvrez le lien d\'invitation reçu par e-mail pour terminer la configuration.';

  @override
  String get authErrInvitationInvalid =>
      'Ce lien d\'invitation n\'est pas valide.';

  @override
  String get authErrInvitationExpired =>
      'Cette invitation a expiré. Demandez à votre administrateur de la renvoyer.';

  @override
  String get authErrInvitationRevoked => 'Cette invitation a été révoquée.';

  @override
  String get authErrInvitationAlreadyAccepted =>
      'Cette invitation a déjà été acceptée. Veuillez vous connecter.';

  @override
  String get authErrInvitationEmailMismatch =>
      'Connectez-vous avec le compte Google correspondant à l\'e-mail invité.';

  @override
  String get authErrInvitationAlreadyPending =>
      'Cet e-mail a déjà une invitation en attente.';

  @override
  String get authErrInvitationNotPending =>
      'Cette invitation n\'est plus en attente.';

  @override
  String get authErrInvitationNotFound => 'Invitation introuvable.';

  @override
  String authErrInvitationResendCooldown(int ttl) {
    return 'Veuillez patienter $ttl s avant de renvoyer.';
  }

  @override
  String get authErrMemberAlreadyExists =>
      'Un membre avec cet e-mail existe déjà.';

  @override
  String get authErrMemberNotFound => 'Membre introuvable.';

  @override
  String get authErrRoleNotFound => 'Rôle introuvable.';

  @override
  String get authErrDepartmentNotFound => 'Département introuvable.';

  @override
  String get authErrOwnerRoleAssignForbidden =>
      'Seul un Propriétaire peut attribuer le rôle de Propriétaire ou modifier le rôle d\'un Propriétaire.';

  @override
  String get authErrCannotChangeOwnRole =>
      'Vous ne pouvez pas modifier votre propre rôle.';

  @override
  String get authErrLastOwnerCannotBeDemoted =>
      'Le dernier Propriétaire ne peut pas être rétrogradé. Désignez d\'abord un autre membre comme Propriétaire.';

  @override
  String get authErrCannotBlockSelf =>
      'Vous ne pouvez pas bloquer votre propre compte.';

  @override
  String get authErrOwnerBlockForbidden =>
      'Seul un Owner peut bloquer un autre Owner.';

  @override
  String get authErrLastOwnerCannotBeBlocked =>
      'Le dernier Owner ne peut pas être bloqué.';

  @override
  String get authErrSsoDisabled => 'L\'authentification unique est désactivée.';

  @override
  String get authErrSsoDomainNotAllowed =>
      'Votre domaine e-mail n\'est pas autorisé pour le SSO.';

  @override
  String get authErrSsoRequired =>
      'Votre organisation exige l\'authentification unique (SSO). Utilisez « Se connecter avec SSO ».';

  @override
  String get authErrSsoUnavailable =>
      'Le service de connexion de votre organisation est momentanément indisponible. Réessayez dans quelques instants.';

  @override
  String get authErrSsoEnforceNotReady =>
      'Impossible d\'exiger le SSO pour l\'instant. Activez le SSO, ajoutez au moins un domaine autorisé et vérifiez que le fournisseur d\'identité est configuré.';

  @override
  String get adminInviteMember => 'Inviter un membre';

  @override
  String get adminInviteTitle => 'Inviter un membre';

  @override
  String get adminInviteEmail => 'Adresse e-mail';

  @override
  String get adminInviteRole => 'Rôle';

  @override
  String get adminInviteDepartments => 'Départements';

  @override
  String get adminInviteSubmit => 'Envoyer l\'invitation';

  @override
  String get adminInviteSent => 'Invitation envoyée';

  @override
  String get adminInviteEmailFailed =>
      'Invitation créée, mais l\'e-mail n\'a pas pu être envoyé. Vérifiez les paramètres de messagerie et renvoyez-la.';

  @override
  String get adminPendingInvitations => 'Invitations en attente';

  @override
  String get adminInviteStatusPending => 'En attente';

  @override
  String get adminInviteStatusExpired => 'Expirée';

  @override
  String adminInviteExpires(String date) {
    return 'Expire le $date';
  }

  @override
  String adminInviteInvitedBy(String name) {
    return 'Invité par $name';
  }

  @override
  String get adminInviteResend => 'Renvoyer';

  @override
  String get adminInviteResent => 'Invitation renvoyée';

  @override
  String get adminInviteRevoke => 'Révoquer';

  @override
  String adminInviteRevokeConfirm(String email) {
    return 'Révoquer l\'invitation de $email ? Le lien ne fonctionnera plus.';
  }

  @override
  String get adminInviteRevoked => 'Invitation révoquée';

  @override
  String get adminMemberStatusBlocked => 'Bloqué';

  @override
  String get adminMemberBlock => 'Bloquer';

  @override
  String get adminMemberUnblock => 'Débloquer';

  @override
  String adminMemberBlockConfirm(String name) {
    return 'Bloquer $name ? Cette personne sera déconnectée partout.';
  }

  @override
  String adminMemberUnblockConfirm(String name) {
    return 'Débloquer $name ? Cette personne pourra se reconnecter.';
  }

  @override
  String get adminMemberBlocked => 'Membre bloqué';

  @override
  String get adminMemberUnblocked => 'Membre débloqué';

  @override
  String get adminLoadFailed =>
      'Impossible de charger cette section. Veuillez réessayer.';

  @override
  String callDeclined(String name) {
    return '$name a refusé l\'appel';
  }

  @override
  String callBusy(String name) {
    return '$name est déjà en appel';
  }

  @override
  String callPeerMediaError(String name) {
    return '$name n\'a pas pu activer son micro ou sa caméra';
  }

  @override
  String get callEnded => 'Appel terminé';

  @override
  String get callConnectionLost => 'Appel interrompu : connexion perdue';

  @override
  String get callSpeaker => 'Haut-parleur';

  @override
  String get callSwitchCamera => 'Changer de caméra';

  @override
  String get callHangUp => 'Raccrocher';

  @override
  String get aiContextLearnedFactsLoadError =>
      'Impossible de charger ce que l’assistant a appris.';

  @override
  String get errTooManyRequests =>
      'Trop de requêtes. Patientez un instant puis réessayez.';

  @override
  String get removedFromConversation =>
      'Vous ne faites plus partie de cette conversation';

  @override
  String get errGroupAdminRequired =>
      'Seuls les administrateurs du groupe peuvent faire cela';

  @override
  String get errChatUserBlocked =>
      'Vous ne pouvez pas envoyer de message à cette personne';

  @override
  String get errReplyTargetInvalid =>
      'Le message auquel vous répondez n\'est plus disponible';

  @override
  String get errMessageTypeNotAllowed =>
      'Ce type de message ne peut pas être envoyé ici';

  @override
  String get errInvalidUrl => 'Impossible d\'afficher l\'aperçu de ce lien';

  @override
  String get errNotAGroup => 'Cela ne fonctionne que dans les groupes';

  @override
  String get errNotAMember => 'Cette personne ne fait plus partie du groupe';

  @override
  String get errLastAdminCannotBeRemoved =>
      'Un groupe doit avoir au moins un administrateur';

  @override
  String get errPublicDepartmentChannel =>
      'Un groupe de service ne peut pas être un canal public';

  @override
  String get publicChannelToggle => 'Canal public';

  @override
  String get publicChannelHint =>
      'Tout membre de l\'espace de travail peut le trouver dans Explorer et le rejoindre';

  @override
  String get groupMakeAdmin => 'Nommer administrateur';

  @override
  String get groupRemoveAdmin => 'Retirer le rôle d\'administrateur';

  @override
  String get aiErrEmptyResponse =>
      'L\'assistant n\'a produit aucune réponse. Veuillez réessayer.';

  @override
  String get sysGroupCreatedNoActor => 'Groupe créé';

  @override
  String get sysMembersAddedNoActor => 'De nouveaux membres ont été ajoutés';

  @override
  String get sysMemberLeftNoActor => 'Un membre a quitté le groupe';

  @override
  String get sysMemberRemovedNoActor => 'Un membre a été retiré';

  @override
  String get sysMemberJoinedNoActor => 'Un nouveau membre a rejoint le groupe';

  @override
  String get sysAutoDeleteOff => 'Messages éphémères désactivés';

  @override
  String sysAutoDeleteOn(String duration) {
    return 'Messages éphémères réglés sur $duration';
  }

  @override
  String sysAutoDeleteOffBy(String actorName) {
    return '$actorName a désactivé les messages éphémères';
  }

  @override
  String sysAutoDeleteOnBy(String actorName, String duration) {
    return '$actorName a réglé les messages éphémères sur $duration';
  }

  @override
  String sysAdminPromoted(String targetName) {
    return '$targetName est maintenant administrateur';
  }

  @override
  String sysAdminDemoted(String targetName) {
    return '$targetName n\'est plus administrateur';
  }

  @override
  String sysAdminPromotedBy(String actorName, String targetName) {
    return '$actorName a nommé $targetName administrateur';
  }

  @override
  String sysAdminDemotedBy(String actorName, String targetName) {
    return '$actorName a retiré le rôle d\'administrateur à $targetName';
  }

  @override
  String durationSeconds(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count secondes',
      one: '1 seconde',
    );
    return '$_temp0';
  }

  @override
  String durationMinutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count minutes',
      one: '1 minute',
    );
    return '$_temp0';
  }

  @override
  String durationHours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count heures',
      one: '1 heure',
    );
    return '$_temp0';
  }

  @override
  String durationDays(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count jours',
      one: '1 jour',
    );
    return '$_temp0';
  }

  @override
  String durationShortMinutes(int count) {
    return '$count min';
  }

  @override
  String durationShortHours(int count) {
    return '$count h';
  }

  @override
  String durationShortDays(int count) {
    return '$count j';
  }

  @override
  String get authErrUserBlocked =>
      'Indisponible : l\'un de vous a bloqué l\'autre';

  @override
  String get authErrCurrentPasswordRequired =>
      'Saisissez votre mot de passe actuel';

  @override
  String get authErrSsoEmailUnverified =>
      'Votre fournisseur de connexion n\'a pas vérifié cette adresse e-mail';

  @override
  String get authErrSocialAccountConflict =>
      'Cet e-mail est déjà lié à un autre compte de connexion';

  @override
  String get aiActionConfirm => 'Confirmer';

  @override
  String get aiActionCancel => 'Annuler';

  @override
  String get aiActionSendEmail => 'Envoyer un e-mail';

  @override
  String get aiActionDraftEmail => 'Brouillon d’e-mail';

  @override
  String get aiActionCreateEvent => 'Créer un événement';

  @override
  String get aiActionUpdateEvent => 'Modifier un événement';

  @override
  String get aiActionCreatePage => 'Créer une page';

  @override
  String get aiActionUpdatePage => 'Modifier une page';

  @override
  String get aiActionGeneric => 'Exécuter une action';

  @override
  String aiActionGenericNamed(String tool) {
    return 'Exécuter « $tool »';
  }

  @override
  String aiActionVia(String connector) {
    return 'via $connector';
  }

  @override
  String aiActionWaitingFor(String name) {
    return 'En attente de la confirmation de $name';
  }

  @override
  String get aiActionFieldTo => 'À';

  @override
  String get aiActionFieldSubject => 'Objet';

  @override
  String get aiActionFieldTitle => 'Titre';

  @override
  String get aiActionFieldWhen => 'Quand';

  @override
  String get aiActionStatusConfirmed => 'Effectué';

  @override
  String get aiActionStatusCancelled => 'Annulé';

  @override
  String get aiActionStatusFailed => 'Échec';

  @override
  String get aiActionStatusExpired => 'Expiré';

  @override
  String get aiActionStatusHandled => 'Déjà traité';

  @override
  String get aiActionErrNotFound => 'Cette action n’existe plus';

  @override
  String get aiActionErrNotOwner =>
      'Seule la personne à l’origine de la demande peut confirmer';

  @override
  String get aiActionErrAlreadyResolved => 'Cette action a déjà été traitée';

  @override
  String get aiActionErrExpired => 'Cette demande a expiré';

  @override
  String get aiActionErrGeneric => 'Impossible d’effectuer cette action';

  @override
  String get aiToolWebSearch => 'Recherche sur le web';

  @override
  String get aiToolRememberFact => 'Enregistrement en mémoire';

  @override
  String get aiToolCreateReminder => 'Création d’un rappel';

  @override
  String get aiToolGetUserInfo => 'Recherche d’un collègue';

  @override
  String get aiToolSearchKnowledgeBase =>
      'Recherche dans la base de connaissances';

  @override
  String get aiToolSearchMessages => 'Recherche dans les messages';

  @override
  String get aiToolSummarizeConversation => 'Résumé de la conversation';

  @override
  String aiToolOnConnector(String tool, String connector) {
    return '$tool sur $connector';
  }

  @override
  String get aiTraceToolAwaiting => 'En attente de confirmation';

  @override
  String get aiTraceToolDone => 'Terminé';

  @override
  String get aiTraceToolNotRun => 'Non exécuté';

  @override
  String aiTraceTokens(String input, String output) {
    return '$input entrée · $output sortie';
  }

  @override
  String aiTraceCacheTokens(String read, String written) {
    return 'cache $read lus · $written écrits';
  }

  @override
  String aiTraceThinkingTokens(String count) {
    return '$count de réflexion';
  }

  @override
  String aiTraceDuration(String seconds) {
    return '$seconds s';
  }

  @override
  String aiTraceSteps(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count étapes',
      one: '1 étape',
    );
    return '$_temp0';
  }

  @override
  String get connectorGenericName => 'Connecteur';

  @override
  String get connectorCustomName => 'Serveur MCP personnalisé';

  @override
  String get connectorReconnect => 'Reconnecter';

  @override
  String get connectorStatusReconnect => 'Reconnexion nécessaire';

  @override
  String get connectorStatusUnavailable => 'Indisponible';

  @override
  String get connectorDisconnectWorkspaceConfirm =>
      'Déconnecter ce connecteur de l’espace de travail ? Tout le monde perdra l’accès à ses outils.';

  @override
  String connectorDisconnected(String name) {
    return '$name déconnecté';
  }

  @override
  String get customMcpListTitle => 'Vos serveurs MCP';

  @override
  String get customMcpDelete => 'Supprimer';

  @override
  String get customMcpDeleteConfirm =>
      'Supprimer ce serveur MCP ? L’IA n’utilisera plus ses outils.';

  @override
  String customMcpDeleted(String name) {
    return '$name supprimé';
  }

  @override
  String get directoryDeleteConfirm => 'Supprimer cette entrée de l’annuaire ?';

  @override
  String get directoryAuthOauth => 'Connexion OAuth';

  @override
  String get directoryAuthMcpOauth => 'OAuth (serveur MCP)';

  @override
  String get directoryAuthEnvOauth => 'OAuth (application de l’espace)';

  @override
  String get directoryAuthApiKey => 'Clé d’API';

  @override
  String get directoryAuthNone => 'Aucune connexion requise';

  @override
  String get scopeEmailSend => 'Envoyer des e-mails';

  @override
  String get scopeEmailDraft => 'Créer des brouillons';

  @override
  String get scopeEmailRead => 'Lire les e-mails';

  @override
  String get scopeEmailManage => 'Gérer les e-mails';

  @override
  String get scopeCalendarRead => 'Consulter l’agenda';

  @override
  String get scopeCalendarEvents => 'Gérer les événements';

  @override
  String get scopeCalendarManage => 'Gérer les agendas';

  @override
  String get scopeFilesRead => 'Lire les fichiers';

  @override
  String get scopeFilesManage => 'Gérer les fichiers';

  @override
  String get scopeReadContent => 'Lire le contenu';

  @override
  String get scopeInsertContent => 'Ajouter du contenu';

  @override
  String get scopeUpdateContent => 'Modifier le contenu';

  @override
  String get scopeOther => 'Autres accès';

  @override
  String get connErrUnsafeUrl =>
      'Cette adresse n’est pas autorisée. Utilisez une URL https publique.';

  @override
  String get connErrDiscoveryFailed => 'Impossible de joindre ce serveur MCP';

  @override
  String get connErrInsufficientPermission =>
      'Vous n’avez pas l’autorisation de faire cela';

  @override
  String get connErrNotAllowed =>
      'Ce connecteur n’est pas autorisé dans votre espace de travail';

  @override
  String get connErrUnavailable =>
      'Ce connecteur est indisponible pour le moment';

  @override
  String get connErrOauthSetup =>
      'La connexion de ce connecteur n’est pas encore configurée';

  @override
  String get connErrBotBridgeDisabled =>
      'Le service d’assistant personnel n’est pas configuré';

  @override
  String get connErrBotNotFound => 'Assistant introuvable';

  @override
  String get connErrBotOwnerMismatch =>
      'Cet assistant appartient à un autre membre';

  @override
  String get connErrMemberInactive => 'Le compte de ce membre est inactif';

  @override
  String oauthConnected(String name) {
    return '$name connecté';
  }

  @override
  String oauthErrAccessDenied(String name) {
    return 'Vous avez refusé l’accès à $name';
  }

  @override
  String oauthErrFailed(String name) {
    return 'Impossible de connecter $name';
  }

  @override
  String oauthNotCompleted(String name) {
    return 'La connexion à $name n’a pas abouti';
  }

  @override
  String get oauthErrExpired =>
      'La connexion a pris trop de temps. Veuillez réessayer.';

  @override
  String get tokenUsageDailyChartTitle => 'Utilisation quotidienne';

  @override
  String get tokenUsageTotalInRange => 'Total sur la période choisie';

  @override
  String get tokenUsageQuotaBlocked =>
      'L’IA est désactivée pour cet espace de travail';

  @override
  String get tokenUsageQuotaExceeded => 'Limite mensuelle d’IA atteinte';

  @override
  String tokenUsageQuotaResets(String date) {
    return 'Réinitialisation le $date';
  }

  @override
  String authErrRoleGrantExceedsOwnPermissions(String capabilities) {
    return 'Vous ne pouvez pas accorder des autorisations que vous n\'avez pas : $capabilities.';
  }

  @override
  String get authErrRoleGrantExceedsOwnPermissionsGeneric =>
      'Vous ne pouvez pas accorder des autorisations que vous n\'avez pas.';

  @override
  String get authErrCannotEditOwnRole =>
      'Vous ne pouvez pas modifier votre propre rôle.';

  @override
  String get authErrPresetRoleRenameForbidden =>
      'Les rôles prédéfinis ne peuvent pas être renommés.';

  @override
  String get authErrRoleNameTaken => 'Un rôle portant ce nom existe déjà.';

  @override
  String get authErrOwnerRoleImmutable =>
      'Le rôle Owner ne peut être ni modifié ni supprimé.';

  @override
  String get authErrOwnerSsoMappingForbidden =>
      'Seul un Owner peut associer des groupes SSO au rôle Owner.';

  @override
  String get authErrInsufficientPermission =>
      'Vous n\'avez pas l\'autorisation d\'effectuer cette action.';

  @override
  String get authErrAiContextEntryNotFound =>
      'Cette entrée de contexte n\'existe plus.';

  @override
  String get authErrAiConnectorsNotInAllowList =>
      'Les connecteurs IA sélectionnés doivent aussi être autorisés dans la liste des connecteurs de l\'espace de travail.';

  @override
  String authErrPasswordTooShortMin(int min) {
    return 'Le mot de passe doit contenir au moins $min caractères.';
  }

  @override
  String get adminCapManageAiContext => 'Gérer le contexte IA';

  @override
  String get adminCapViewInternalContext => 'Voir le contexte interne';

  @override
  String get adminCapViewConfidentialContext => 'Voir le contexte confidentiel';

  @override
  String get adminCapUnknown => 'Autre autorisation';

  @override
  String get adminAuditSystem => 'Système';

  @override
  String get adminAuditFormerMember => 'Un ancien membre';

  @override
  String get adminAuditActionOther => 'Autre action';

  @override
  String get adminAuditActionWorkspaceUpdate => 'Espace de travail mis à jour';

  @override
  String get adminAuditActionDepartmentCreate => 'Service créé';

  @override
  String get adminAuditActionDepartmentUpdate => 'Service mis à jour';

  @override
  String get adminAuditActionDepartmentDelete => 'Service supprimé';

  @override
  String get adminAuditActionMemberUpdate => 'Membre mis à jour';

  @override
  String get adminAuditActionMemberSsoUpdate => 'Membre mis à jour par SSO';

  @override
  String get adminAuditActionMemberBlock => 'Membre bloqué';

  @override
  String get adminAuditActionMemberUnblock => 'Membre débloqué';

  @override
  String get adminAuditActionRoleCreate => 'Rôle créé';

  @override
  String get adminAuditActionRoleUpdate => 'Rôle mis à jour';

  @override
  String get adminAuditActionInvitationCreate => 'Invitation envoyée';

  @override
  String get adminAuditActionInvitationResend => 'Invitation renvoyée';

  @override
  String get adminAuditActionInvitationRevoke => 'Invitation révoquée';

  @override
  String get adminAuditActionInvitationAccept => 'Invitation acceptée';

  @override
  String get adminAuditActionConnectorConnect => 'Connecteur connecté';

  @override
  String get adminAuditActionConnectorDisconnect => 'Connecteur déconnecté';

  @override
  String get adminAuditActionConnectorReplace => 'Connecteur reconnecté';

  @override
  String get adminAuditActionConnectionPermissionsUpdate =>
      'Autorisations du connecteur mises à jour';

  @override
  String get adminAuditActionCustomMcpAdd => 'MCP personnalisé ajouté';

  @override
  String get adminAuditActionCustomMcpDelete => 'MCP personnalisé supprimé';

  @override
  String get adminAuditActionDirectoryCreate => 'Entrée d\'annuaire ajoutée';

  @override
  String get adminAuditActionDirectoryUpdate =>
      'Entrée d\'annuaire mise à jour';

  @override
  String get adminAuditActionDirectoryDelete => 'Entrée d\'annuaire supprimée';

  @override
  String get adminAuditActionSensitiveSkillRun =>
      'Compétence sensible exécutée';

  @override
  String get adminAuditTargetWorkspace => 'Espace de travail';

  @override
  String get adminAuditTargetMember => 'Un membre';

  @override
  String get adminAuditTargetRole => 'Un rôle';

  @override
  String get adminAuditTargetDepartment => 'Un service';

  @override
  String get adminAuditTargetInvitation => 'Une invitation';

  @override
  String get adminAuditTargetConnector => 'Un connecteur';

  @override
  String get adminAuditTargetDirectoryEntry => 'Une entrée d\'annuaire';

  @override
  String get adminAuditTargetTool => 'Un outil';

  @override
  String get adminAuditTargetOther => 'Autre élément';

  @override
  String get adminAiConnectorsAllAllowed =>
      'La liste d\'autorisation de l\'espace de travail est vide : tous les connecteurs sont autorisés. Choisissez ceux que l\'IA peut utiliser.';

  @override
  String get errAssistantSetupIncomplete =>
      'Ajoutez une personnalité et choisissez un modèle pour terminer la configuration de votre assistant.';

  @override
  String get errAssistantNotConfigured =>
      'Les assistants personnels ne sont pas encore disponibles dans cet espace de travail. Contactez votre administrateur.';

  @override
  String get errAssistantUpstreamFailed =>
      'Le service de l\'assistant n\'a pas répondu. Réessayez dans un instant.';

  @override
  String adminBotOwnedBy(String name) {
    return 'Appartient à $name';
  }

  @override
  String adminRoleCloneDefaultName(String name) {
    return 'Copie de $name';
  }

  @override
  String get setPasswordTitle => 'Créez votre mot de passe PON';

  @override
  String get setPasswordSubtitle =>
      'Vous avez rejoint PON avec Google. Créez un mot de passe pour pouvoir aussi vous connecter avec votre adresse e-mail.';

  @override
  String get setPasswordSubmit => 'Créer le mot de passe';

  @override
  String get setPasswordSuccess =>
      'Mot de passe créé. Vous pouvez désormais aussi vous connecter avec votre adresse e-mail.';

  @override
  String get mfaVerifyTitle => 'Authentification à deux facteurs';

  @override
  String get mfaVerifySubtitle =>
      'Saisissez le code à 6 chiffres de votre application d\'authentification pour terminer la connexion.';

  @override
  String get mfaBackupSubtitle =>
      'Saisissez l\'un de vos codes de secours (XXXXX-XXXXX). Chaque code ne fonctionne qu\'une fois.';

  @override
  String get mfaCodeLabel => 'Code à 6 chiffres';

  @override
  String get mfaBackupCodeLabel => 'Code de secours';

  @override
  String get mfaVerifyButton => 'Vérifier';

  @override
  String get mfaUseBackupCode => 'Utiliser un code de secours';

  @override
  String get mfaUseAuthenticatorCode =>
      'Utiliser votre application d\'authentification';

  @override
  String get mfaBackToSignIn => 'Retour à la connexion';

  @override
  String mfaBackupCodeUsed(int remaining) {
    return 'Code de secours utilisé. $remaining code(s) restant(s).';
  }

  @override
  String get valMfaCodeInvalid => 'Saisissez le code à 6 chiffres.';

  @override
  String get valMfaBackupCodeInvalid =>
      'Saisissez un code de secours au format ABCDE-FGHIJ.';

  @override
  String get mfaEnrollTitle => 'Configurer l\'authentification à deux facteurs';

  @override
  String get mfaEnrollSubtitle =>
      'Votre rôle exige un code d\'une application d\'authentification à chaque connexion.';

  @override
  String get mfaEnrollStepInstall =>
      '1. Installez Google Authenticator (ou une autre application d\'authentification).';

  @override
  String get mfaEnrollStepScan =>
      '2. Scannez ce code QR, ouvrez-le dans l\'application ou saisissez la clé de configuration.';

  @override
  String get mfaEnrollStepCode =>
      '3. Saisissez le code à 6 chiffres affiché par l\'application.';

  @override
  String get mfaEnrollOpenApp =>
      'Ouvrir dans l\'application d\'authentification';

  @override
  String get mfaEnrollNoApp =>
      'Aucune application d\'authentification trouvée. Installez Google Authenticator ou saisissez la clé de configuration manuellement.';

  @override
  String get mfaEnrollManualKey => 'Clé de configuration';

  @override
  String get mfaCopyKey => 'Copier la clé';

  @override
  String get mfaKeyCopied => 'Clé de configuration copiée';

  @override
  String get mfaQrSemantic =>
      'Code QR pour votre application d\'authentification';

  @override
  String get mfaEnrollConfirm => 'Confirmer';

  @override
  String get mfaBackupCodesTitle => 'Enregistrez vos codes de secours';

  @override
  String get mfaBackupCodesSubtitle =>
      'Chaque code vous permet de vous connecter une fois si vous perdez votre téléphone. Ils ne seront plus affichés : conservez-les en lieu sûr.';

  @override
  String get mfaCopyCodes => 'Copier les codes';

  @override
  String get mfaCodesCopied => 'Codes de secours copiés';

  @override
  String get mfaSavedCheckbox => 'J\'ai enregistré mes codes de secours';

  @override
  String get mfaContinue => 'Continuer';

  @override
  String get securityMfaOn =>
      'Un code de votre application d\'authentification est requis à chaque connexion.';

  @override
  String get securityMfaPending =>
      'Obligatoire pour votre rôle. Vous la configurerez à votre prochaine connexion.';

  @override
  String get securityMfaStatusOn => 'Activée';

  @override
  String get securityMfaStatusOff => 'Non configurée';

  @override
  String get securityMfaRegenerate => 'Régénérer les codes de secours';

  @override
  String get securityMfaRegenerateHint =>
      'Saisissez un code actuel de votre application d\'authentification. Vos anciens codes de secours ne fonctionneront plus.';

  @override
  String get securityMfaRegenerateSubmit => 'Générer';

  @override
  String get securityMfaDone => 'Terminé';

  @override
  String get securityMfaOptionalHint =>
      'Ajoutez une deuxième étape à votre connexion. Facultatif pour votre rôle.';

  @override
  String get securityMfaStatusDisabled => 'Désactivée';

  @override
  String get securityMfaTurnOn => 'Activer la 2FA';

  @override
  String get securityMfaTurnedOn =>
      'L\'authentification à deux facteurs est activée.';

  @override
  String get securityMfaSetupExpired =>
      'La configuration a expiré. Veuillez recommencer.';

  @override
  String get securityMfaTooManyAttempts =>
      'Trop de codes incorrects. Patientez quelques minutes puis réessayez.';

  @override
  String get securityMfaTurnOff => 'Désactiver la 2FA';

  @override
  String get securityMfaTurnOffTitle =>
      'Désactiver l\'authentification à deux facteurs ?';

  @override
  String get securityMfaTurnOffHint =>
      'Saisissez un code actuel de votre application d\'authentification pour confirmer. Aucun code ne vous sera plus demandé à la connexion.';

  @override
  String get securityMfaTurnOffSubmit => 'Désactiver';

  @override
  String get securityMfaTurnedOff =>
      'L\'authentification à deux facteurs est désactivée.';

  @override
  String get authErrMfaRequiredByRole =>
      'Votre rôle exige l\'authentification à deux facteurs : elle ne peut pas être désactivée.';

  @override
  String get adminMfaBadge => '2FA activée';

  @override
  String get adminMfaReset => 'Réinitialiser la 2FA';

  @override
  String adminMfaResetConfirm(String name) {
    return 'Réinitialiser l\'authentification à deux facteurs de $name ? Cette personne sera déconnectée partout et devra la reconfigurer à sa prochaine connexion.';
  }

  @override
  String get adminMfaResetDone =>
      '2FA réinitialisée. Cette personne la reconfigurera à sa prochaine connexion.';

  @override
  String adminMfaResetConfirmOptional(String name) {
    return 'Réinitialiser l\'authentification à deux facteurs de $name ? Cette personne sera déconnectée partout et l\'authentification à deux facteurs sera désactivée. Elle pourra la réactiver dans Paramètres → Mot de passe et sécurité.';
  }

  @override
  String get adminMfaResetDoneOptional =>
      '2FA réinitialisée. Elle est désactivée pour cette personne, qui pourra la réactiver dans les paramètres.';

  @override
  String get authMsgMfaRequired =>
      'Saisissez le code de votre application d\'authentification pour terminer la connexion.';

  @override
  String get authErrMfaTokenInvalid =>
      'Votre connexion a expiré. Veuillez vous reconnecter.';

  @override
  String get authErrMfaCodeInvalid => 'Code incorrect. Veuillez réessayer.';

  @override
  String authErrMfaCodeInvalidRemaining(int remaining) {
    return 'Code incorrect. $remaining tentative(s) restante(s).';
  }

  @override
  String get authErrMfaTooManyAttempts =>
      'Trop de codes incorrects. Veuillez vous reconnecter.';

  @override
  String get authErrMfaNotEnrolled =>
      'L\'authentification à deux facteurs n\'est pas encore configurée pour ce compte.';

  @override
  String get authErrMfaAlreadyEnrolled =>
      'L\'authentification à deux facteurs est déjà configurée pour ce compte.';

  @override
  String get authErrMfaResetForbidden =>
      'Vous ne pouvez pas réinitialiser l\'authentification à deux facteurs de ce membre.';

  @override
  String get authErrMfaResetSelfForbidden =>
      'Vous ne pouvez pas réinitialiser votre propre authentification à deux facteurs.';

  @override
  String get callSelfWeakNetwork => 'Votre réseau est faible';

  @override
  String callPeerWeakNetwork(String name) {
    return 'Le réseau de $name est faible';
  }

  @override
  String get callUnstableNetwork => 'Connexion instable';

  @override
  String get callReconnectingSelf => 'Connexion perdue, reconnexion…';

  @override
  String callWaitingForPeer(String name) {
    return 'En attente de la reconnexion de $name…';
  }

  @override
  String callReconnectCountdown(int seconds) {
    return 'L\'appel prendra fin dans $seconds s sans reconnexion';
  }

  @override
  String get callSwitchToVideo => 'Passer en vidéo';

  @override
  String get callVideoUnavailable =>
      'La vidéo n\'est pas disponible pour cet appel — l\'autre personne doit peut-être mettre à jour l\'application';

  @override
  String get adminCapHostMeeting => 'Organiser des réunions';

  @override
  String get meetingErrNotFound => 'Cette réunion n\'existe pas';

  @override
  String get meetingErrForbidden =>
      'Vous ne pouvez pas faire cela dans cette réunion';

  @override
  String get meetingErrCreateForbidden =>
      'Votre rôle ne permet pas d\'organiser des réunions';

  @override
  String get meetingErrDepartmentForbidden =>
      'Vous ne pouvez pas créer de réunion pour ce service';

  @override
  String get meetingErrRemoved => 'Vous avez été retiré de cette réunion';

  @override
  String get meetingErrLocked => 'Cette réunion est verrouillée';

  @override
  String get meetingErrEnded => 'Cette réunion est terminée';

  @override
  String meetingErrFull(int max) {
    return 'Cette réunion est complète ($max personnes)';
  }

  @override
  String get meetingErrNotCancellable =>
      'Quelqu\'un l\'a déjà rejointe, elle ne peut donc pas être annulée';

  @override
  String get meetingErrUnavailable =>
      'Les réunions sont indisponibles pour le moment. Réessayez bientôt.';

  @override
  String get meetingErrNotesReadOnly =>
      'Seuls les organisateurs peuvent modifier les notes partagées';

  @override
  String get meetingErrNoteConflict =>
      'Quelqu\'un a enregistré une version plus récente';

  @override
  String get meetingErrRateLimited =>
      'Vous envoyez trop vite. Patientez un instant.';

  @override
  String meetingErrChatTooLong(int max) {
    return 'Les messages peuvent contenir au maximum $max caractères';
  }

  @override
  String meetingErrNoteTooLong(int max) {
    return 'Les notes peuvent contenir au maximum $max caractères';
  }

  @override
  String get meetingErrInviteeInvalid =>
      'Une personne de la liste ne peut pas être invitée';

  @override
  String get meetingErrDepartmentInvalid => 'Ce service n\'est pas disponible';

  @override
  String get meetingErrStartInvalid => 'L\'heure de début n\'est pas valide';

  @override
  String get meetingErrEndInvalid =>
      'La réunion doit se terminer après son début et dans les 24 heures';

  @override
  String get meetingErrTargetUnavailable =>
      'Cette personne n\'est plus dans la réunion';

  @override
  String get meetingErrInvalid => 'Un élément de la requête n\'est pas valide';

  @override
  String get meetingErrNetwork =>
      'Impossible de joindre le serveur. Vérifiez votre connexion.';

  @override
  String get meetingErrGeneric => 'Une erreur s\'est produite. Réessayez.';

  @override
  String meetingValTitleTooLong(int max) {
    return 'Le titre peut contenir au maximum $max caractères';
  }

  @override
  String meetingValDescriptionTooLong(int max) {
    return 'La description peut contenir au maximum $max caractères';
  }

  @override
  String meetingValTooManyInvitees(int max) {
    return 'Vous pouvez inviter au maximum $max personnes';
  }

  @override
  String get meetingValStartPast => 'Choisissez un moment dans le futur';

  @override
  String get meetingValScheduleInvalid =>
      'Choisissez une date et une heure valides';

  @override
  String get meetingUntitled => 'Réunion';

  @override
  String get meetingSomeone => 'Quelqu\'un';

  @override
  String get meetingParticipantFallback => 'Participant';

  @override
  String get meetingYou => 'Vous';

  @override
  String get meetingRoleHost => 'Organisateur';

  @override
  String get meetingRoleCohost => 'Co-organisateur';

  @override
  String get meetingRoleAttendee => 'Participant';

  @override
  String get meetingStatusLive => 'En cours';

  @override
  String get meetingStatusScheduled => 'Planifiée';

  @override
  String get meetingStatusEnded => 'Terminée';

  @override
  String get meetingStatusCancelled => 'Annulée';

  @override
  String meetingDurationMinutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count min',
    );
    return '$_temp0';
  }

  @override
  String meetingDurationHours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count heures',
      one: '$count heure',
    );
    return '$_temp0';
  }

  @override
  String meetingDurationHoursMinutes(int hours, int minutes) {
    return '$hours h $minutes min';
  }

  @override
  String get meetingRealtimeOffline =>
      'Le chat, les mains levées et les commandes de l\'organisateur sont en pause jusqu\'au retour de la connexion';

  @override
  String meetingMutedBy(String name) {
    return '$name a coupé votre micro';
  }

  @override
  String get meetingMutedByUnknown => 'Un organisateur a coupé votre micro';

  @override
  String get meetingMadeCohost => 'Vous êtes maintenant co-organisateur';

  @override
  String get meetingRevokedCohost => 'Vous n\'êtes plus co-organisateur';

  @override
  String get meetingEndedToast => 'La réunion est terminée';

  @override
  String get meetingMediaFailed =>
      'Impossible d\'activer votre micro ou votre caméra';

  @override
  String get meetingShareRevoked =>
      'L\'organisateur a désactivé le partage d\'écran';

  @override
  String get meetingShareFailed => 'Impossible de lancer la présentation';

  @override
  String meetingLobbyWaiting(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count personnes attendent pour rejoindre',
      one: '$count personne attend pour rejoindre',
    );
    return '$_temp0';
  }

  @override
  String get meetingNotifInvitedTitle => 'Invitation à une réunion';

  @override
  String meetingNotifInvitedBody(String name, String title) {
    return '$name vous a invité à « $title »';
  }

  @override
  String meetingNotifInvitedBodyAt(String name, String title, String time) {
    return '$name vous a invité à « $title » le $time';
  }

  @override
  String get meetingNotifStartingTitle => 'La réunion commence bientôt';

  @override
  String meetingNotifStartingBody(String title, String time) {
    return '« $title » commence à $time';
  }

  @override
  String meetingNotifCancelled(String title) {
    return '« $title » a été annulée';
  }

  @override
  String get meetingNotifCancelledUnknown =>
      'Une réunion à laquelle vous étiez invité a été annulée';

  @override
  String get meetingTitle => 'Réunions';

  @override
  String get meetingPushInvited => 'Vous êtes invité à une réunion';

  @override
  String get meetingPushStarting => 'Votre réunion commence dans 10 minutes';

  @override
  String get meetingPushChannel => 'Réunions';

  @override
  String get meetingSubtitle =>
      'Lancez une réunion maintenant ou planifiez-la pour plus tard.';

  @override
  String get meetingNewInstant => 'Démarrer une réunion';

  @override
  String get meetingNewScheduled => 'Planifier';

  @override
  String get meetingJoinByCodeLabel => 'Code ou lien de la réunion';

  @override
  String get meetingJoinByCodePlaceholder => 'abc-defg-hjk';

  @override
  String get meetingJoinByCode => 'Rejoindre';

  @override
  String get meetingCodeInvalid => 'Ce code de réunion n\'est pas valide';

  @override
  String get meetingTabUpcoming => 'À venir';

  @override
  String get meetingTabPast => 'Passées';

  @override
  String get meetingEmptyUpcoming => 'Aucune réunion à venir';

  @override
  String get meetingEmptyPast => 'Aucune réunion passée';

  @override
  String get meetingLoadMore => 'Charger plus';

  @override
  String get meetingListError => 'Impossible de charger les réunions';

  @override
  String get meetingInstantMeeting => 'Réunion instantanée';

  @override
  String meetingHostedBy(String name) {
    return 'Organisée par $name';
  }

  @override
  String get meetingCopyLink => 'Copier le lien';

  @override
  String get meetingLinkCopied => 'Lien de la réunion copié';

  @override
  String get meetingCopyFailed => 'Impossible de copier le lien';

  @override
  String get meetingJoin => 'Rejoindre';

  @override
  String get meetingStarting => 'Création…';

  @override
  String get meetingFormCreateTitle => 'Planifier une réunion';

  @override
  String get meetingFormEditTitle => 'Modifier la réunion';

  @override
  String get meetingFormAgainTitle => 'Se réunir à nouveau';

  @override
  String get meetingFieldTitle => 'Titre';

  @override
  String get meetingFieldTitlePlaceholder => 'Ajoutez un titre';

  @override
  String get meetingFieldDescription => 'Description';

  @override
  String get meetingFieldDescriptionPlaceholder =>
      'Ordre du jour, liens, tout ce qu\'il faut savoir';

  @override
  String get meetingFieldWhen => 'Quand';

  @override
  String get meetingWhenNow => 'Commencer maintenant';

  @override
  String get meetingWhenLater => 'Planifier pour plus tard';

  @override
  String get meetingFieldDate => 'Date';

  @override
  String get meetingFieldTime => 'Heure de début';

  @override
  String get meetingFieldDuration => 'Durée';

  @override
  String meetingTimeZoneHint(String zone) {
    return 'Les heures sont en $zone';
  }

  @override
  String get meetingFieldInvitees => 'Inviter des personnes';

  @override
  String get meetingInviteeSearchPlaceholder => 'Rechercher par nom ou e-mail';

  @override
  String meetingInviteeCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count personnes invitées',
      one: '$count personne invitée',
    );
    return '$_temp0';
  }

  @override
  String get meetingInviteeNone => 'Personne n\'est encore invité';

  @override
  String meetingRemoveInvitee(String name) {
    return 'Retirer $name';
  }

  @override
  String get meetingSearchNoResults => 'Aucune personne trouvée';

  @override
  String get meetingSearchFailed => 'Recherche impossible pour le moment';

  @override
  String get meetingFieldDepartment => 'Service';

  @override
  String get meetingDepartmentNone => 'Aucun service';

  @override
  String get meetingDepartmentHint => 'Tout le service est invité';

  @override
  String get meetingSettingsTitle => 'Options de la réunion';

  @override
  String get meetingSettingWaitingRoom => 'Salle d\'attente';

  @override
  String get meetingSettingWaitingRoomDesc =>
      'Les personnes non invitées attendent qu\'un organisateur les admette';

  @override
  String get meetingSettingMuteOnEntry => 'Couper le micro à l\'arrivée';

  @override
  String get meetingSettingMuteOnEntryDesc =>
      'Les participants arrivent micro coupé';

  @override
  String get meetingSettingScreenShare =>
      'Les participants peuvent présenter leur écran';

  @override
  String get meetingSettingNotes =>
      'Les participants peuvent modifier les notes partagées';

  @override
  String get meetingSettingLocked => 'Verrouiller la réunion';

  @override
  String get meetingSettingLockedDesc =>
      'Seules les personnes invitées peuvent rejoindre';

  @override
  String get meetingSubmitCreate => 'Planifier';

  @override
  String get meetingSubmitStartNow => 'Commencer maintenant';

  @override
  String get meetingSubmitSave => 'Enregistrer';

  @override
  String get meetingToastCreated => 'Réunion planifiée';

  @override
  String get meetingToastUpdated => 'Modifications enregistrées';

  @override
  String meetingCharCounter(int count, int max) {
    return '$count/$max';
  }

  @override
  String get meetingNotesShared => 'Partagées';

  @override
  String get meetingNotesPrivate => 'Les miennes';

  @override
  String get meetingNotesPrivateHint => 'Vous seul pouvez voir ces notes';

  @override
  String get meetingNotesPlaceholder =>
      'Prenez des notes — Markdown pris en charge';

  @override
  String get meetingNotesWrite => 'Écrire';

  @override
  String get meetingNotesPreview => 'Aperçu';

  @override
  String get meetingNotesSaving => 'Enregistrement…';

  @override
  String get meetingNotesSaved => 'Enregistré';

  @override
  String get meetingNotesUnsaved => 'Modifications non enregistrées';

  @override
  String get meetingNotesSaveFailed => 'Échec de l\'enregistrement';

  @override
  String get meetingNotesRetry => 'Réessayer';

  @override
  String get meetingNotesReadOnly =>
      'Seuls les organisateurs peuvent modifier ces notes';

  @override
  String meetingNotesRemoteNewer(String name) {
    return '$name a enregistré une version plus récente';
  }

  @override
  String get meetingNotesRemoteNewerUnknown =>
      'Une version plus récente a été enregistrée';

  @override
  String meetingNotesCounter(int count, int max) {
    return '$count / $max';
  }

  @override
  String get meetingNotesConflictTitle =>
      'Quelqu\'un a enregistré une version plus récente';

  @override
  String get meetingNotesConflictDesc =>
      'Votre texte est intact. Comparez les deux versions et choisissez laquelle garder.';

  @override
  String get meetingNotesConflictReview => 'Comparer';

  @override
  String get meetingNotesConflictTheirs => 'Version plus récente';

  @override
  String get meetingNotesConflictMine => 'Votre version';

  @override
  String get meetingNotesConflictKeepMine => 'Garder la mienne';

  @override
  String get meetingNotesConflictTakeTheirs =>
      'Utiliser la version plus récente';

  @override
  String get meetingNotesConflictSaveMerged => 'Enregistrer le texte fusionné';

  @override
  String get meetingNotesConflictDiscardWarning =>
      'Votre texte non enregistré sera supprimé';

  @override
  String get meetingEdit => 'Modifier';

  @override
  String get meetingCancelMeeting => 'Annuler la réunion';

  @override
  String get meetingMeetAgain => 'Se réunir à nouveau';

  @override
  String get meetingEndMeeting => 'Terminer la réunion';

  @override
  String get meetingCancelConfirmTitle => 'Annuler cette réunion ?';

  @override
  String get meetingCancelConfirmDesc =>
      'Toutes les personnes invitées seront prévenues de l\'annulation.';

  @override
  String get meetingEndConfirmTitle =>
      'Terminer la réunion pour tout le monde ?';

  @override
  String get meetingEndConfirmDesc =>
      'Tout le monde quittera la réunion et elle ne pourra pas être relancée';

  @override
  String get meetingToastCancelled => 'Réunion annulée';

  @override
  String get meetingToastEnded => 'Réunion terminée';

  @override
  String get meetingBackToList => 'Toutes les réunions';

  @override
  String get meetingDetailError => 'Impossible de charger cette réunion';

  @override
  String get meetingMeetingCode => 'Code de la réunion';

  @override
  String get meetingSectionPeople => 'Participants';

  @override
  String get meetingCoHosts => 'Co-organisateurs';

  @override
  String get meetingInvitees => 'Invités';

  @override
  String meetingMoreCount(int count) {
    return '+$count';
  }

  @override
  String get meetingDepartmentGeneric => 'Un service';

  @override
  String get meetingSectionAttendance => 'Présence';

  @override
  String get meetingAttendanceEmpty => 'Personne n\'a rejoint';

  @override
  String get meetingAttendanceInside => 'Dans la réunion';

  @override
  String meetingAttendanceDuration(int minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes min',
    );
    return '$_temp0';
  }

  @override
  String meetingAttendanceSessions(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sessions',
      one: '$count session',
    );
    return '$_temp0';
  }

  @override
  String get meetingSectionNotes => 'Notes';

  @override
  String get meetingSectionChat => 'Discussion de la réunion';

  @override
  String get meetingChatHistoryEmpty => 'Aucun message';

  @override
  String get meetingChatLoadOlder => 'Charger les messages précédents';

  @override
  String get meetingChatHistoryError => 'Impossible de charger la discussion';

  @override
  String get meetingRemovedNotice =>
      'Vous avez été retiré de cette réunion : ses notes et sa discussion ne sont pas disponibles.';

  @override
  String get meetingGuestNotice =>
      'Rejoignez la réunion pour voir ses notes et sa discussion.';

  @override
  String meetingCreatedAt(String time) {
    return 'Créée le $time';
  }

  @override
  String get meetingLinkCodeCopied => 'Code de la réunion copié';

  @override
  String get meetingShareNotifTitle => 'Présentation de votre écran';

  @override
  String get meetingShareNotifBody =>
      'Tous les participants à la réunion voient votre écran';

  @override
  String get meetingJoinNow => 'Participer maintenant';

  @override
  String get meetingAskToJoin => 'Demander à participer';

  @override
  String get meetingPrejoinTitle => 'Prêt à participer ?';

  @override
  String meetingPrejoinStartsAt(String time) {
    return 'Commence $time';
  }

  @override
  String meetingPrejoinJoiningAs(String name) {
    return 'Vous participerez en tant que $name';
  }

  @override
  String get meetingPrejoinCameraOff => 'La caméra est désactivée';

  @override
  String get meetingPrejoinMuteOnEntry =>
      'L\'organisateur demande de rejoindre avec le micro coupé';

  @override
  String get meetingPrejoinLockedHint =>
      'Cette réunion est verrouillée. Seules les personnes invitées peuvent participer.';

  @override
  String get meetingPrejoinInCall =>
      'Vous êtes en appel. Raccrochez pour rejoindre cette réunion.';

  @override
  String get meetingMicOn => 'Activer le micro';

  @override
  String get meetingMicOff => 'Couper le micro';

  @override
  String get meetingCamOn => 'Activer la caméra';

  @override
  String get meetingCamOff => 'Désactiver la caméra';

  @override
  String get meetingMediaUnavailable => 'Aucun micro ni caméra trouvé';

  @override
  String get meetingWaitingTitle => 'Demande de participation…';

  @override
  String get meetingWaitingDesc =>
      'Une personne de la réunion va vous laisser entrer';

  @override
  String get meetingWaitingCancel => 'Annuler';

  @override
  String get meetingDeniedTitle => 'Vous n\'avez pas été admis';

  @override
  String get meetingDeniedDesc =>
      'Une personne de la réunion a refusé votre demande';

  @override
  String get meetingRemovedTitle => 'Vous avez été retiré de la réunion';

  @override
  String get meetingRemovedDesc => 'Vous ne pouvez pas rejoindre cette réunion';

  @override
  String get meetingLockedTitle => 'Cette réunion est verrouillée';

  @override
  String get meetingLockedDesc =>
      'Seules les personnes invitées peuvent participer pour le moment';

  @override
  String get meetingFullTitle => 'Cette réunion est complète';

  @override
  String meetingFullDesc(int max) {
    return '$max personnes sont déjà présentes. Réessayez plus tard.';
  }

  @override
  String get meetingUnavailableTitle => 'Les réunions sont indisponibles';

  @override
  String get meetingUnavailableDesc => 'Réessayez dans un instant';

  @override
  String get meetingNotFoundTitle => 'Réunion introuvable';

  @override
  String get meetingNotFoundDesc => 'Vérifiez le code ou le lien et réessayez';

  @override
  String get meetingLeftTitle => 'Vous avez quitté la réunion';

  @override
  String get meetingConnectionLostTitle => 'Connexion perdue';

  @override
  String get meetingConnectionLostDesc =>
      'Impossible de vous reconnecter à la réunion';

  @override
  String get meetingRejoin => 'Rejoindre';

  @override
  String get meetingTryAgain => 'Réessayer';

  @override
  String get meetingViewDetails => 'Détails de la réunion';

  @override
  String get meetingLeaveMeeting => 'Quitter la réunion';

  @override
  String meetingNameWithYou(String name) {
    return '$name (vous)';
  }

  @override
  String get meetingReconnecting => 'Reconnexion…';

  @override
  String get meetingPoorConnection => 'Votre connexion est instable';

  @override
  String get meetingPresenting => 'Vous présentez votre écran';

  @override
  String get meetingStopPresenting => 'Arrêter la présentation';

  @override
  String meetingPresentingName(String name) {
    return '$name présente son écran';
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
      other: '$count autres personnes',
      one: '$count autre personne',
    );
    return '$_temp0';
  }

  @override
  String get meetingPin => 'Épingler';

  @override
  String get meetingUnpin => 'Désépingler';

  @override
  String meetingTileMenu(String name) {
    return 'Options pour $name';
  }

  @override
  String get meetingMicMutedLabel => 'Micro coupé';

  @override
  String get meetingHandRaisedLabel => 'Main levée';

  @override
  String get meetingPoorConnectionPeer => 'Connexion instable';

  @override
  String get meetingHostBadge => 'Organisateur ou co-organisateur';

  @override
  String get meetingShareStart => 'Présenter l\'écran';

  @override
  String get meetingShareDisabled =>
      'L\'organisateur a désactivé le partage d\'écran pour les participants';

  @override
  String get meetingRaiseHand => 'Lever la main';

  @override
  String get meetingLowerHand => 'Baisser la main';

  @override
  String get meetingReactions => 'Envoyer une réaction';

  @override
  String get meetingChat => 'Discussion';

  @override
  String get meetingNotes => 'Notes';

  @override
  String get meetingPeople => 'Participants';

  @override
  String get meetingMore => 'Plus d\'options';

  @override
  String get meetingLayout => 'Disposition';

  @override
  String get meetingLayoutGrid => 'Mosaïque';

  @override
  String get meetingLayoutSpotlight => 'Intervenant';

  @override
  String get meetingLeave => 'Quitter';

  @override
  String get meetingEndForAll => 'Mettre fin à la réunion pour tous';

  @override
  String meetingReactionAria(String name, String emoji) {
    return '$name a réagi avec $emoji';
  }

  @override
  String get meetingPeopleTitle => 'Participants';

  @override
  String get meetingManageTitle => 'Commandes de l\'organisateur';

  @override
  String meetingSectionHands(int count) {
    return 'Mains levées ($count)';
  }

  @override
  String meetingSectionLobby(int count) {
    return 'En attente ($count)';
  }

  @override
  String meetingSectionInMeeting(int count) {
    return 'Dans la réunion ($count)';
  }

  @override
  String get meetingAdmit => 'Admettre';

  @override
  String get meetingDeny => 'Refuser';

  @override
  String get meetingAdmitAll => 'Tout admettre';

  @override
  String meetingPersonMenu(String name) {
    return 'Options pour $name';
  }

  @override
  String get meetingActionMuteMic => 'Couper le micro';

  @override
  String get meetingActionMuteAll => 'Couper le micro de tous';

  @override
  String get meetingActionRemove => 'Retirer de la réunion';

  @override
  String get meetingActionLowerHand => 'Baisser la main';

  @override
  String get meetingActionLowerAllHands => 'Baisser toutes les mains';

  @override
  String get meetingActionMakeCohost => 'Nommer co-organisateur';

  @override
  String get meetingActionRevokeCohost => 'Retirer le rôle de co-organisateur';

  @override
  String meetingRemoveConfirmTitle(String name) {
    return 'Retirer $name ?';
  }

  @override
  String get meetingRemoveConfirmDesc =>
      'Cette personne ne pourra plus rejoindre la réunion';

  @override
  String get meetingMuteAllConfirmTitle => 'Couper le micro de tout le monde ?';

  @override
  String get meetingMuteAllConfirmDesc => 'Chacun pourra réactiver son micro';

  @override
  String get meetingChatTitle => 'Discussion de la réunion';

  @override
  String get meetingChatPlaceholder => 'Envoyer un message';

  @override
  String get meetingChatSend => 'Envoyer';

  @override
  String get meetingChatEmpty =>
      'Les messages sont visibles par tous les participants';

  @override
  String get meetingChatFailed => 'Non envoyé';

  @override
  String get meetingChatRetry => 'Réessayer';

  @override
  String get meetingChatDiscard => 'Supprimer';

  @override
  String get meetingChatSending => 'Envoi…';

  @override
  String get meetingChatOffline =>
      'Reconnexion en cours : impossible d\'envoyer des messages pour l\'instant';

  @override
  String meetingChatCounter(int count, int max) {
    return '$count/$max';
  }

  @override
  String meetingChatUnread(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count nouveaux messages',
      one: '$count nouveau message',
    );
    return '$_temp0';
  }

  @override
  String get meetingMediaBlocked =>
      'L\'accès au micro ou à la caméra est désactivé. Vous pouvez quand même participer et l\'activer plus tard dans Réglages.';

  @override
  String get meetingSwitchCamera => 'Changer de caméra';

  @override
  String get meetingSpeakerOn => 'Utiliser le haut-parleur';

  @override
  String get meetingLoading => 'Chargement de la réunion…';
}
