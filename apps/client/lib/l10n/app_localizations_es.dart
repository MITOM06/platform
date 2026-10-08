// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

  @override
  String get appTagline => 'Conecta y chatea';

  @override
  String get appName => 'PON';

  @override
  String get notificationsTitle => 'Notificaciones';

  @override
  String get notificationsSectionUnread => 'Sin leer';

  @override
  String get notificationsSectionRead => 'Leídas';

  @override
  String get notificationsEmpty => 'Aún no hay notificaciones';

  @override
  String get notificationsMarkAllRead => 'Marcar todo como leído';

  @override
  String get notificationAccept => 'Aceptar';

  @override
  String get notificationDecline => 'Rechazar';

  @override
  String notificationFriendRequestTitle(String name) {
    return '$name te envió una solicitud de amistad';
  }

  @override
  String notificationFriendAcceptedTitle(String name) {
    return '$name aceptó tu solicitud de amistad';
  }

  @override
  String get notificationPhoneSetupTitle => 'Verificar número de teléfono';

  @override
  String get notificationPhoneSetupBody =>
      'Agrega y verifica un número de teléfono para que tus amigos puedan encontrarte y mejorar la seguridad de tu cuenta.';

  @override
  String get notificationPasswordSetupTitle => 'Protege tu cuenta';

  @override
  String get notificationPasswordSetupBody =>
      'Tu cuenta aún no tiene contraseña. Establece una para mejorar la seguridad.';

  @override
  String get securityTitle => 'Contraseña y seguridad';

  @override
  String get securitySubtitle => 'Cambia tu contraseña';

  @override
  String get securityNoPasswordCardSubtitle => 'Sin contraseña establecida';

  @override
  String get securityNoPasswordTitle => 'Aún no has establecido una contraseña';

  @override
  String get securityNoPasswordSubtitle =>
      'Establece una contraseña para proteger tu cuenta y habilitar la recuperación por correo electrónico.';

  @override
  String get securityChangePasswordTitle => 'Cambiar contraseña';

  @override
  String get securityChangePasswordSubtitle =>
      'Actualiza tu contraseña actual.';

  @override
  String get securitySetPasswordTitle => 'Configura tu contraseña';

  @override
  String get securitySetPasswordSubtitle =>
      'Añade una contraseña a tu cuenta para mayor seguridad.';

  @override
  String get securitySetButton => 'Establecer contraseña';

  @override
  String get securityChangeButton => 'Cambiar contraseña';

  @override
  String get securitySetSuccess => 'Contraseña establecida correctamente';

  @override
  String get securityTwoFaTitle => 'Autenticación de dos factores';

  @override
  String get securityTwoFaSubtitle =>
      'Añade una capa adicional de seguridad a tu cuenta.';

  @override
  String get securityTwoFaComingSoon =>
      'La autenticación de dos factores estará disponible pronto.';

  @override
  String get securityComingSoon => 'Próximamente';

  @override
  String get languageName => 'Español';

  @override
  String get actionCancel => 'Cancelar';

  @override
  String get actionConfirm => 'Confirmar';

  @override
  String get actionRetry => 'Reintentar';

  @override
  String get actionSave => 'Guardar';

  @override
  String get actionLogout => 'Cerrar sesión';

  @override
  String get actionDelete => 'Eliminar';

  @override
  String get actionLeave => 'Salir';

  @override
  String get loadingDots => '...';

  @override
  String get loginTitle => 'Iniciar sesión';

  @override
  String get fieldEmail => 'Correo';

  @override
  String get fieldPassword => 'Contraseña';

  @override
  String get forgotPasswordLink => '¿Olvidaste tu contraseña?';

  @override
  String get loginButton => 'Iniciar sesión';

  @override
  String get valEmailRequired => 'Ingresa tu correo';

  @override
  String get valEmailInvalid => 'Correo no válido';

  @override
  String get valPasswordRequired => 'Ingresa tu contraseña';

  @override
  String get valPasswordMin6 =>
      'La contraseña debe tener al menos 6 caracteres';

  @override
  String get errInvalidCredentials => 'Correo o contraseña incorrectos';

  @override
  String get errNetwork =>
      'No se puede conectar al servidor, revisa tu conexión';

  @override
  String get errSlow => 'La conexión es demasiado lenta, inténtalo de nuevo';

  @override
  String get errSessionExpired => 'Tu sesión ha expirado';

  @override
  String get errForbidden => 'No tienes permiso para hacer esto';

  @override
  String get errNotFound => 'Datos no encontrados';

  @override
  String get errConflict => 'Estos datos ya existen';

  @override
  String get errInvalidData => 'Datos no válidos';

  @override
  String get errServer => 'Error del servidor, inténtalo más tarde';

  @override
  String errRequestFailed(String code) {
    return 'La solicitud falló ($code)';
  }

  @override
  String get errCancelled => 'La solicitud fue cancelada';

  @override
  String get errConnection => 'Error de conexión, inténtalo de nuevo';

  @override
  String get errGeneric => 'Algo salió mal, inténtalo de nuevo';

  @override
  String get detailsTitle => 'Detalles';

  @override
  String get themeMenuItem => 'Tema';

  @override
  String get quickReactionTitle => 'Reacción rápida';

  @override
  String get wallpaperDefaultName => 'Predeterminado';

  @override
  String get wallpaperCategoryColors => 'Colores simples';

  @override
  String get wallpaperCategoryVibrant => 'Degradados vibrantes';

  @override
  String get wallpaperCategoryMinimal => 'Minimalista';

  @override
  String get wallpaperShowMore => 'Mostrar más';

  @override
  String get wallpaperShowLess => 'Mostrar menos';

  @override
  String get wallpaperCategoryThemes => 'Temas';

  @override
  String get wallpaperThemeForest => 'Bosque';

  @override
  String get wallpaperThemeOcean => 'Océano';

  @override
  String get wallpaperThemeMountain => 'Montaña nevada';

  @override
  String get wallpaperThemeCherryBlossom => 'Flor de cerezo';

  @override
  String get wallpaperThemeSpace => 'Espacio';

  @override
  String get wallpaperThemeAurora => 'Aurora boreal';

  @override
  String get wallpaperThemeCityNight => 'Ciudad nocturna';

  @override
  String get wallpaperThemeDesert => 'Desierto';

  @override
  String get wallpaperPresetMidnightGlow => 'Brillo de medianoche';

  @override
  String get wallpaperPresetNeonTeal => 'Verde neón';

  @override
  String get wallpaperPresetSunset => 'Atardecer';

  @override
  String get wallpaperPresetSweetPink => 'Rosa dulce';

  @override
  String get wallpaperPresetDarkShadow => 'Sombra oscura';

  @override
  String get wallpaperPresetOceanBlue => 'Azul océano';

  @override
  String get wallpaperPresetForestGreen => 'Verde bosque';

  @override
  String get wallpaperPresetPurpleHaze => 'Bruma púrpura';

  @override
  String get wallpaperPresetWarmAmber => 'Ámbar cálido';

  @override
  String get wallpaperPresetRoseGold => 'Oro rosa';

  @override
  String get wallpaperPresetStorm => 'Tormenta';

  @override
  String get wallpaperPresetCherryBlossom => 'Flor de cerezo';

  @override
  String get wallpaperPresetMidnightPurple => 'Púrpura medianoche';

  @override
  String get wallpaperPresetCoralReef => 'Arrecife de coral';

  @override
  String get wallpaperPresetArcticIce => 'Hielo ártico';

  @override
  String get wallpaperPresetAurora => 'Aurora';

  @override
  String get wallpaperPresetGalaxy => 'Galaxia';

  @override
  String get wallpaperPresetFireIce => 'Fuego y hielo';

  @override
  String get wallpaperPresetTropical => 'Tropical';

  @override
  String get wallpaperPresetCandy => 'Caramelo';

  @override
  String get wallpaperPresetPureDark => 'Negro puro';

  @override
  String get wallpaperPresetSoftGray => 'Gris suave';

  @override
  String get wallpaperPresetWarmNight => 'Noche cálida';

  @override
  String get changeChatThemeTitle => 'Cambiar tema del chat';

  @override
  String get uploadImageButton => 'Subir imagen';

  @override
  String get imageFitLabel => 'Ajuste de imagen';

  @override
  String get fitCoverLabel => 'Cubrir';

  @override
  String get fitContainLabel => 'Contener';

  @override
  String get fitFillLabel => 'Rellenar';

  @override
  String get errLoginFailed => 'Error al iniciar sesión, inténtalo de nuevo';

  @override
  String get welcomeToApp => 'Bienvenido a PON';

  @override
  String get fieldDisplayName => 'Nombre visible';

  @override
  String get fieldConfirmPassword => 'Confirmar contraseña';

  @override
  String get valNameRequired => 'Ingresa tu nombre';

  @override
  String get valNameMin2 => 'El nombre debe tener al menos 2 caracteres';

  @override
  String get valPasswordMismatch => 'Las contraseñas no coinciden';

  @override
  String get errEmailExists => 'Este correo ya está registrado';

  @override
  String get verifyOtpTitle => 'Verificar OTP';

  @override
  String get verifyAccountHeading => 'Verifica tu cuenta';

  @override
  String otpSentTo(String email) {
    return 'Se envió un OTP de 6 dígitos a\n$email';
  }

  @override
  String get fieldOtp => 'Código OTP';

  @override
  String get confirmButton => 'Confirmar';

  @override
  String resendIn(int seconds) {
    return 'Reenviar en ${seconds}s';
  }

  @override
  String get resendOtp => 'Reenviar código OTP';

  @override
  String get otpResent => 'Se envió un nuevo código OTP a tu correo';

  @override
  String get errResendFailed => 'Error al reenviar, inténtalo más tarde';

  @override
  String get valOtp6 => 'Ingresa los 6 dígitos del OTP';

  @override
  String get verifySuccess => '¡Verificado con éxito! Inicia sesión ahora';

  @override
  String get errVerifyFailed => 'Error de verificación, inténtalo de nuevo';

  @override
  String get forgotTitle => 'Restablecer contraseña';

  @override
  String get forgotHeading => '¿Olvidaste tu contraseña?';

  @override
  String get forgotSubtitle =>
      'Ingresa tu correo para recibir un OTP y crear una nueva contraseña';

  @override
  String get sendOtpButton => 'Enviar código OTP';

  @override
  String get errSendRequestFailed =>
      'Error en la solicitud, inténtalo de nuevo';

  @override
  String get newPasswordTitle => 'Nueva contraseña';

  @override
  String get newPasswordHeading => 'Crea una nueva contraseña';

  @override
  String newPasswordSubtitle(String email) {
    return 'Ingresa el OTP enviado a $email\ny tu nueva contraseña';
  }

  @override
  String get fieldNewPassword => 'Nueva contraseña';

  @override
  String get valNewPasswordRequired => 'Ingresa una nueva contraseña';

  @override
  String get resetPasswordSuccess => '¡Contraseña restablecida con éxito!';

  @override
  String get errOtpInvalidExpired => 'El OTP es incorrecto o ha expirado';

  @override
  String get errResetFailed =>
      'Error al restablecer la contraseña, inténtalo de nuevo';

  @override
  String get settingsTitle => 'Ajustes';

  @override
  String get valNameEmpty => 'El nombre no puede estar vacío';

  @override
  String get nameUpdated => 'Nombre visible actualizado';

  @override
  String get personalInfo => 'Información personal';

  @override
  String get appearance => 'Apariencia';

  @override
  String get chooseThemeTitle => 'Elegir tema';

  @override
  String get themeLight => 'Tema claro';

  @override
  String get themeDark => 'Tema oscuro';

  @override
  String get themeSystem => 'Sistema';

  @override
  String get language => 'Idioma';

  @override
  String get chooseLanguageTitle => 'Elegir idioma';

  @override
  String get logoutConfirmBody => '¿Seguro que quieres cerrar sesión?';

  @override
  String get onboardingChooseTheme => 'Elige un tema';

  @override
  String get onboardingChooseSubtitle =>
      'Elige el estilo de interfaz que más te guste.';

  @override
  String get themeLightSubtitle => 'Brillante, claro y fácil de leer';

  @override
  String get themeDarkSubtitle => 'Moderno, misterioso y cómodo para la vista';

  @override
  String get themeSystemSubtitle =>
      'Coincide automáticamente con tu dispositivo';

  @override
  String get startExperience => 'Empezar a explorar';

  @override
  String get tooltipSettings => 'Ajustes';

  @override
  String get tooltipNewConversation => 'Nueva conversación';

  @override
  String get listLoadFailed => 'No se pudo cargar la lista';

  @override
  String get listCheckNetwork =>
      'Revisa tu conexión de red e inténtalo de nuevo.';

  @override
  String get listGenericError => 'Algo salió mal. Inténtalo más tarde.';

  @override
  String get emptyConversations => 'Aún no hay conversaciones';

  @override
  String get emptyTapPlus => '¡Toca el botón \"+\" de abajo para empezar!';

  @override
  String get searchConversationsHint => 'Buscar conversaciones...';

  @override
  String get noConversationsFound => 'No se encontraron conversaciones';

  @override
  String get offlineBanner => 'Sin conexión de red';

  @override
  String get conversationDefault => 'Conversación';

  @override
  String get newConversationTitle => 'Nueva conversación';

  @override
  String get startConversationHeading => 'Iniciar una conversación';

  @override
  String get fieldRecipient => 'Correo o ID de usuario del destinatario';

  @override
  String get valRecipientRequired => 'Ingresa un correo o ID de usuario';

  @override
  String get errUserNotFoundEmail =>
      'No se encontró ningún usuario con este correo.';

  @override
  String get errUserNotFoundOrConn =>
      'Usuario no encontrado o error de conexión.';

  @override
  String get startConversationButton => 'Empezar a chatear';

  @override
  String get chatDefaultTitle => 'Chat';

  @override
  String get statusOnline => 'activo ahora';

  @override
  String get statusOffline => 'desconectado';

  @override
  String get typingLabel => 'escribiendo';

  @override
  String get messageHint => 'Escribe un mensaje...';

  @override
  String get tabChats => 'Chats';

  @override
  String get tabArchived => 'Archivados';

  @override
  String get tabRequests => 'Solicitudes';

  @override
  String get tabNew => 'Nuevo';

  @override
  String get noRequests => 'No hay solicitudes pendientes';

  @override
  String get declineRequest => 'Rechazar';

  @override
  String get dmRequestSubtitle => 'Quiere enviarte un mensaje';

  @override
  String get groupInviteSubtitle => 'Te invitó a un grupo';

  @override
  String get blockedChatsTitle => 'Chats bloqueados';

  @override
  String get newGroup => 'Nuevo grupo';

  @override
  String get newDirect => 'Nuevo chat';

  @override
  String get createGroup => 'Crear grupo';

  @override
  String get groupName => 'Nombre del grupo';

  @override
  String get groupDefaultName => 'Grupo';

  @override
  String get valGroupNameRequired => 'Ingresa un nombre de grupo';

  @override
  String get selectMembers => 'Seleccionar miembros';

  @override
  String get valSelectMembers => 'Selecciona al menos 2 miembros';

  @override
  String get searchUsers => 'Buscar por nombre, correo o teléfono';

  @override
  String get phoneSearchHint =>
      'Introduce el número de teléfono completo para buscar';

  @override
  String get groupInfo => 'Información del grupo';

  @override
  String get members => 'Miembros';

  @override
  String membersCount(int count) {
    return '$count miembros';
  }

  @override
  String get addMembers => 'Añadir miembros';

  @override
  String get removeMember => 'Quitar del grupo';

  @override
  String get leaveGroup => 'Salir del grupo';

  @override
  String get leaveGroupConfirm => '¿Seguro que quieres salir de este grupo?';

  @override
  String get renameGroup => 'Renombrar grupo';

  @override
  String get admin => 'Administrador';

  @override
  String get you => 'Tú';

  @override
  String get someone => 'Alguien';

  @override
  String get aiHubTitle => 'Centro de IA';

  @override
  String get aiHubSubtitle => 'Todo sobre tu asistente de IA';

  @override
  String get aiHubStartChat => 'Iniciar chat con PON AI';

  @override
  String get aiHubMemory => 'Memoria';

  @override
  String get aiHubIntegrations => 'Conectores';

  @override
  String get aiHubSkills => 'Habilidades';

  @override
  String get aiHubTokenUsage => 'Uso';

  @override
  String systemAddedMember(String actor, String target) {
    return '$actor añadió a $target';
  }

  @override
  String systemRemovedMember(String actor, String target) {
    return '$actor quitó a $target';
  }

  @override
  String systemLeftGroup(String actor) {
    return '$actor salió del grupo';
  }

  @override
  String systemRenamedGroup(String actor, String name) {
    return '$actor renombró el grupo a $name';
  }

  @override
  String systemCreatedGroup(String actor) {
    return '$actor creó el grupo';
  }

  @override
  String get actionReply => 'Responder';

  @override
  String get actionRecall => 'Retirar';

  @override
  String get actionEdit => 'Editar';

  @override
  String get messageEdited => '(editado)';

  @override
  String get actionDeleteForMe => 'Eliminar para mí';

  @override
  String get actionCopy => 'Copiar';

  @override
  String get downloadAction => 'Descargar';

  @override
  String get actionReact => 'Reaccionar';

  @override
  String get messageRecalled => 'El mensaje fue retirado';

  @override
  String get messageSendFailedRetry => 'Error al enviar. Toca para reintentar.';

  @override
  String replyingTo(String name) {
    return 'Respondiendo a $name';
  }

  @override
  String get copiedToClipboard => 'Copiado al portapapeles';

  @override
  String get recallConfirm => '¿Retirar este mensaje para todos?';

  @override
  String get deleteConversation => 'Eliminar conversación';

  @override
  String get deleteConversationConfirm =>
      '¿Eliminar esta conversación? Se ocultará de tu lista.';

  @override
  String get clearHistory => 'Borrar historial';

  @override
  String get clearHistoryConfirm =>
      '¿Borrar todos los mensajes de esta conversación para ti?';

  @override
  String get disappearingMessages => 'Mensajes temporales';

  @override
  String get disappearingOff => 'Desactivado';

  @override
  String get disappearing24h => '24 horas';

  @override
  String get disappearing7d => '7 días';

  @override
  String get changeAvatar => 'Cambiar avatar';

  @override
  String get uploadFailed => 'Error al subir, inténtalo de nuevo';

  @override
  String get lastSeenJustNow => 'activo hace un momento';

  @override
  String lastSeenMinutes(int minutes) {
    return 'activo hace $minutes min';
  }

  @override
  String lastSeenHours(int hours) {
    return 'activo hace $hours h';
  }

  @override
  String lastSeenDays(int days) {
    return 'activo hace $days d';
  }

  @override
  String get dateToday => 'Hoy';

  @override
  String get dateYesterday => 'Ayer';

  @override
  String get attachPhoto => 'Foto';

  @override
  String get attachVideo => 'Vídeo';

  @override
  String get attachFile => 'Archivo';

  @override
  String get attachVoice => 'Mensaje de voz';

  @override
  String get attachSticker => 'Sticker';

  @override
  String get pinnedMessageTitle => 'Mensaje fijado';

  @override
  String get pinnedSystemMessage => 'Mensaje del sistema';

  @override
  String get uploading => 'Subiendo…';

  @override
  String get downloadMedia => 'Descargar';

  @override
  String get imageDownloadHd => 'Ver en HD';

  @override
  String get attachmentLabel => '📎 Adjunto';

  @override
  String get callIncoming => 'Llamada entrante';

  @override
  String callIncomingBody(String name) {
    return '$name te está llamando';
  }

  @override
  String callCalling(String name) {
    return 'Llamando a $name…';
  }

  @override
  String get callConnecting => 'Conectando…';

  @override
  String get callMediaError =>
      'No se puede acceder a la cámara/micrófono (se requiere HTTPS o localhost)';

  @override
  String get callNoAnswer => 'Sin respuesta';

  @override
  String get callUnknownCaller => 'Alguien';

  @override
  String get callToggleMic => 'Activar/desactivar micrófono';

  @override
  String get callToggleCam => 'Activar/desactivar cámara';

  @override
  String get callLeave => 'Salir';

  @override
  String get callJoin => 'Unirse';

  @override
  String get callAccept => 'Aceptar';

  @override
  String get callDecline => 'Rechazar';

  @override
  String get groupCallTitle => 'Llamada grupal';

  @override
  String groupCallParticipants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count participantes',
      one: '1 participante',
    );
    return '$_temp0';
  }

  @override
  String get groupCallNotetakerActive => 'La IA está tomando notas';

  @override
  String get groupCallStartTitle => 'Iniciar una llamada grupal';

  @override
  String get groupCallAudio => 'Audio';

  @override
  String get groupCallVideo => 'Vídeo';

  @override
  String get groupCallNotetakerToggle => 'Tomador de notas IA';

  @override
  String get groupCallNotetakerHint =>
      'La IA escucha y publica un resumen de la reunión después.';

  @override
  String get groupCallStartAction => 'Iniciar llamada';

  @override
  String activeCallBanner(int count) {
    return 'Llamada grupal · $count unidos';
  }

  @override
  String get incomingGroupCallTitle => 'Llamada grupal entrante';

  @override
  String incomingGroupCallBody(String name) {
    return '$name inició una llamada grupal';
  }

  @override
  String get meetingSummaryTitle => 'Resumen de la reunión';

  @override
  String meetingSummaryDuration(String duration) {
    return 'Duración $duration';
  }

  @override
  String meetingSummaryAttendees(String names) {
    return 'Asistentes: $names';
  }

  @override
  String get meetingSummaryOverview => 'Resumen';

  @override
  String get meetingSummaryKeyPoints => 'Puntos clave';

  @override
  String get meetingSummaryActionItems => 'Tareas pendientes';

  @override
  String get profileTitle => 'Perfil';

  @override
  String get profileRoleLabel => 'Rol';

  @override
  String get profileRoleMemberDefault => 'Miembro';

  @override
  String get roleLabel => 'Rol';

  @override
  String get privacySectionLabel => 'Privacidad';

  @override
  String get editProfile => 'Editar perfil';

  @override
  String get bio => 'Biografía';

  @override
  String friendsCountLabel(int count) {
    return '$count amigos';
  }

  @override
  String get messageAction => 'Mensaje';

  @override
  String get activeFriends => 'Activos ahora';

  @override
  String get noFriendsOnline => 'No hay amigos en línea';

  @override
  String get strangerBannerTitle => 'Solicitud de mensaje';

  @override
  String get strangerBannerBody =>
      'Esta persona no está en tus contactos. Acepta para responder.';

  @override
  String get acceptRequest => 'Aceptar';

  @override
  String get rejectRequest => 'Rechazar';

  @override
  String get friends => 'Amigos';

  @override
  String get contacts => 'Contactos';

  @override
  String get friendRequests => 'Solicitudes de amistad';

  @override
  String get addFriend => 'Añadir amigo';

  @override
  String get friendRequestSent => 'Solicitud de amistad enviada';

  @override
  String get acceptFriend => 'Aceptar';

  @override
  String get noFriends => 'Aún no tienes amigos';

  @override
  String get noFriendRequests => 'No hay solicitudes pendientes';

  @override
  String get friendRequestPending => 'Pendiente';

  @override
  String get friendsTabSearch => 'Buscar';

  @override
  String get declineFriend => 'Rechazar';

  @override
  String get searchUsersPrompt => 'Busca personas para agregar como amigos';

  @override
  String get noSearchResults => 'No se encontraron usuarios';

  @override
  String get unfriend => 'Eliminar amigo';

  @override
  String get unfriendConfirm => '¿Eliminar a este amigo?';

  @override
  String get blockUser => 'Bloquear';

  @override
  String get unblockUser => 'Desbloquear';

  @override
  String get blockUserConfirm =>
      '¿Bloquear a este usuario? No podréis enviaros mensajes.';

  @override
  String get blockedComposerNotice => 'No puedes enviar mensajes a este chat';

  @override
  String get userBlocked => 'Usuario bloqueado';

  @override
  String get userUnblocked => 'Usuario desbloqueado';

  @override
  String get mentionNotificationTitle => 'Te mencionó';

  @override
  String mentionNotificationBody(String name) {
    return '$name te mencionó';
  }

  @override
  String get searchMessages => 'Buscar mensajes';

  @override
  String get searchHint => 'Buscar en la conversación';

  @override
  String get searchNoResults => 'No se encontraron mensajes';

  @override
  String get exploreChannels => 'Explorar canales';

  @override
  String get searchChannelsHint => 'Buscar canales…';

  @override
  String get noPublicChannels => 'No se encontraron canales públicos';

  @override
  String get joinChannel => 'Unirse';

  @override
  String get pinMessage => 'Fijar';

  @override
  String get unpinMessage => 'Dejar de fijar';

  @override
  String get pinnedMessagesTitle => 'Mensajes fijados';

  @override
  String get pinLimitReached => 'Puedes fijar hasta 5 mensajes';

  @override
  String get cannotPinCall => 'Las llamadas no se pueden fijar';

  @override
  String get forwardMessage => 'Reenviar';

  @override
  String get messageForwarded => 'Mensaje reenviado';

  @override
  String get forwardFailed => 'Error al reenviar el mensaje';

  @override
  String get noConversationsToForward => 'No hay conversaciones disponibles';

  @override
  String get rateLimitError => 'Demasiados mensajes. Por favor, más despacio.';

  @override
  String get sharedMediaTitle => 'Medios y archivos compartidos';

  @override
  String get tabMedia => 'Medios';

  @override
  String get tabFiles => 'Archivos';

  @override
  String get tabLinks => 'Enlaces';

  @override
  String get noMediaFound => 'No se encontraron medios';

  @override
  String get noFilesFound => 'No se encontraron archivos';

  @override
  String get noLinksFound => 'No se encontraron enlaces';

  @override
  String get reactionsDetail => 'Reacciones';

  @override
  String get changePasswordTitle => 'Cambiar contraseña';

  @override
  String get currentPassword => 'Contraseña actual';

  @override
  String get newPassword => 'Nueva contraseña';

  @override
  String get confirmPassword => 'Confirmar nueva contraseña';

  @override
  String get dateOfBirth => 'Fecha de nacimiento';

  @override
  String get notSet => 'No establecido';

  @override
  String get passwordChangedSuccess => 'Contraseña cambiada con éxito';

  @override
  String get errCurrentPasswordIncorrect => 'Contraseña actual incorrecta';

  @override
  String get changeCoverPhoto => 'Cambiar foto de portada';

  @override
  String get markAsRead => 'Marcar como leído';

  @override
  String get markAsUnread => 'Marcar como no leído';

  @override
  String get muteNotifications => 'Silenciar notificaciones';

  @override
  String get unmuteNotifications => 'Desactivar silencio';

  @override
  String get viewProfile => 'Ver perfil';

  @override
  String get voiceCall => 'Llamada de voz';

  @override
  String get videoCall => 'Videollamada';

  @override
  String get archiveChat => 'Archivar chat';

  @override
  String get unarchiveChat => 'Desarchivar chat';

  @override
  String get mutedLabel => 'Silenciado';

  @override
  String get newNotificationTitle => 'Nuevo mensaje';

  @override
  String newNotificationBody(String name) {
    return '$name te envió un mensaje';
  }

  @override
  String get archivedChats => 'Chats archivados';

  @override
  String get archivedChatsSubtitle => 'Ver conversaciones archivadas';

  @override
  String get emptyArchivedChats => 'No hay chats archivados';

  @override
  String get webNoChatSelected =>
      'Selecciona una conversación para empezar a chatear';

  @override
  String get aiPersonality => 'Personalidad';

  @override
  String get aiSkills => 'Habilidades';

  @override
  String get adminOwnerOnly => 'Solo administrador o propietario';

  @override
  String get aiConnectedApps => 'Apps conectadas';

  @override
  String get aiUsage => 'Uso';

  @override
  String get chatInfoCategory => 'Detalles del chat';

  @override
  String get customizeChatCategory => 'Personalizar chat';

  @override
  String get filesAndMediaCategory => 'Medios, archivos y enlaces';

  @override
  String get privacyAndSupportCategory => 'Privacidad y soporte';

  @override
  String get callSelectMember => 'Selecciona un miembro para llamar';

  @override
  String get profileHideInfo => 'Ocultar información personal';

  @override
  String get profileInfoHidden => 'La información personal está oculta';

  @override
  String get profileGender => 'Género';

  @override
  String get profilePhone => 'Número de teléfono';

  @override
  String get profileBio => 'Biografía';

  @override
  String get profileDateOfBirth => 'Fecha de nacimiento';

  @override
  String get profileShowDateOfBirth =>
      'Mostrar fecha de nacimiento a los demás';

  @override
  String get profileShowPhone => 'Mostrar número de teléfono a los demás';

  @override
  String get profileShowGender => 'Mostrar género a los demás';

  @override
  String get phoneVerifiedBadge => 'Verificado';

  @override
  String get phoneSendOtp => 'Enviar código de verificación';

  @override
  String get phoneSending => 'Enviando...';

  @override
  String get phoneChangeNumber => 'Cambiar número';

  @override
  String get phoneNotVerified => 'No verificado';

  @override
  String get phoneSendOtpError =>
      'No se pudo enviar el código. Inténtalo más tarde.';

  @override
  String get phoneVerifyTitle => 'Verificar número de teléfono';

  @override
  String phoneOtpSubtitle(String phone) {
    return 'Introduce el código de 6 dígitos enviado a $phone';
  }

  @override
  String get phoneOtpIncomplete => 'Introduce los 6 dígitos';

  @override
  String get phoneOtpInvalid => 'Código incorrecto o caducado';

  @override
  String get phoneVerifiedSuccess => '¡Número de teléfono verificado!';

  @override
  String get phoneVerifying => 'Verificando...';

  @override
  String get phoneConfirm => 'Confirmar';

  @override
  String get phoneHint => '901 234 567';

  @override
  String get phoneNoNumber => 'Sin número de teléfono';

  @override
  String get phoneNoticeText =>
      'Agrega un número de teléfono para proteger tu cuenta.';

  @override
  String get phoneVerifyAction => 'Verificar';

  @override
  String get phoneUnverifiedBadge => 'Sin verificar';

  @override
  String get phoneModalPhoneSubtitle =>
      'Introduce tu número de teléfono para recibir un código.';

  @override
  String get phoneRateLimit => 'Espera antes de solicitar otro código.';

  @override
  String get phoneAlreadyTaken => 'Este número de teléfono ya está en uso.';

  @override
  String get phoneInvalidNumber => 'Número de teléfono no válido.';

  @override
  String get phoneOtpExpired => 'El código caducó: solicita uno nuevo.';

  @override
  String get phoneResend => 'Reenviar código';

  @override
  String phoneResendCountdown(int seconds) {
    return 'Reenviar en ${seconds}s';
  }

  @override
  String get profilePrivacySection => 'Privacidad';

  @override
  String get profileEditMode => 'Editar perfil';

  @override
  String get profileSave => 'Guardar';

  @override
  String get actionMessage => 'Mensaje';

  @override
  String get actionAddFriend => 'Agregar amigo';

  @override
  String get actionBlock => 'Bloquear';

  @override
  String get readDetails => 'Detalles de lectura';

  @override
  String get seenStatus => 'Visto';

  @override
  String get noReadsYet => 'Nadie lo ha leído aún';

  @override
  String get voiceMicTooltip => 'Mensaje de voz';

  @override
  String get recording => 'Grabando...';

  @override
  String get stickerLabel => 'Stickers';

  @override
  String get emojiTab => 'Emoji';

  @override
  String get aiAssistant => 'Asistente IA';

  @override
  String get startChatWithAI => 'Chatear con PON AI';

  @override
  String get aiThinking => 'La IA está pensando...';

  @override
  String get aiError =>
      'La IA no está disponible temporalmente. Por favor, inténtelo de nuevo.';

  @override
  String get aiErrStreamInterrupted =>
      'El flujo de IA fue interrumpido. Por favor, inténtelo de nuevo.';

  @override
  String get aiErrUnavailable => 'La IA no está disponible temporalmente.';

  @override
  String get aiErrRateLimited =>
      'Demasiadas solicitudes de IA. Reduce la velocidad e inténtalo de nuevo en breve.';

  @override
  String get feedbackHelpful => 'Útil';

  @override
  String get feedbackNotHelpful => 'No útil';

  @override
  String get feedbackCommentHint => 'Cuéntanos qué salió mal (opcional)';

  @override
  String get feedbackThanks => 'Gracias por tus comentarios';

  @override
  String get feedbackSend => 'Enviar';

  @override
  String get feedbackError =>
      'No se pudo enviar el comentario. Inténtalo de nuevo.';

  @override
  String get aiSensitiveAction => 'acción sensible';

  @override
  String get sourcesLabel => 'Fuentes';

  @override
  String get aiErrorRetry => 'Reintentar';

  @override
  String get aiMessageDeleted => 'Mensaje eliminado';

  @override
  String get viewAiMemory => 'Ver memoria';

  @override
  String get kbTitle => 'Base de conocimiento';

  @override
  String get kbEmptyState =>
      'No hay documentos aún.\nToca el botón de carga para agregar un archivo PDF, DOCX o TXT.';

  @override
  String get kbUploadButton => 'Subir documento';

  @override
  String get kbDeleteConfirm => '¿Eliminar este documento?';

  @override
  String get kbProcessing => 'Procesando';

  @override
  String get kbReady => 'Listo';

  @override
  String get kbError => 'Error';

  @override
  String get kbManage => 'Base de conocimiento';

  @override
  String get kbSources => 'fuente(s)';

  @override
  String get kbChunks => 'fragmentos';

  @override
  String aiToolCalling(String toolName) {
    return 'Usando herramienta: $toolName';
  }

  @override
  String get aiToolTrace => 'Registro de herramientas';

  @override
  String get toolSearchMessages => 'Buscando mensajes...';

  @override
  String get toolGetUserInfo => 'Consultando información de usuario...';

  @override
  String get toolSearchKnowledgeBase =>
      'Buscando en la base de conocimiento...';

  @override
  String get toolSummarizeConversation => 'Resumiendo conversación...';

  @override
  String get toolCreateReminder => 'Creando recordatorio...';

  @override
  String get reminders => 'Recordatorios';

  @override
  String get remindersEmpty =>
      'Sin recordatorios pendientes.\nPídele a PON AI que configure uno.';

  @override
  String get reminderDone => 'Marcar como completado';

  @override
  String get tokenUsage => 'Uso de tokens';

  @override
  String get tokenUsageTitle => 'Panel de uso de tokens';

  @override
  String get tokenUsageSelectRange => 'Seleccionar rango de fechas';

  @override
  String get tokenUsageDateRangeError =>
      'La fecha de inicio debe ser anterior a la fecha de fin';

  @override
  String get coverPhotoPreviewTitle => 'Vista previa de la foto de portada';

  @override
  String get saveCoverPhoto => 'Establecer como portada';

  @override
  String get tokenUsageThisMonth => 'Total de tokens este mes';

  @override
  String get tokenUsageRequests => 'Solicitudes de IA';

  @override
  String get tokenUsageEstCost => 'Costo estimado (USD)';

  @override
  String get tokenUsageDailyChart => 'Uso diario de tokens (últimos 30 días)';

  @override
  String get aiTraceTitle => 'Rastreo de IA';

  @override
  String get aiTraceThinking => 'Pensamiento';

  @override
  String get aiTraceTools => 'Llamadas de herramientas';

  @override
  String get aiTraceStats => 'Estadísticas';

  @override
  String get aiPersonaTitle => 'Persona de IA';

  @override
  String get avatarUploadLabel => 'Cambiar avatar';

  @override
  String get aiPersonaNameHint => 'Nombre del bot (ej. DevBot)';

  @override
  String get aiPersonaInstructionsHint =>
      'Instrucciones personalizadas (ej. Responde siempre con viñetas)';

  @override
  String get aiPersonaAdminOnly =>
      'Solo los administradores del grupo pueden configurar la persona de IA.';

  @override
  String get configureAiPersona => 'Configurar persona de IA';

  @override
  String get aiPersonaToneFriendly => 'Amigable';

  @override
  String get aiPersonaToneProfessional => 'Profesional';

  @override
  String get aiPersonaToneConcise => 'Conciso';

  @override
  String get aiPersonaToneCreative => 'Creativo';

  @override
  String get aiQuotaExceeded =>
      'Se ha superado la cuota mensual de uso de IA. Contacta a tu administrador.';

  @override
  String get viewUsage => 'Ver uso';

  @override
  String get tokenUsageQuota => 'Cuota mensual';

  @override
  String get errEmailDomainInvalid => 'Esta dirección de correo no existe';

  @override
  String get valPasswordMin8 =>
      'La contraseña debe tener al menos 8 caracteres';

  @override
  String get valPasswordUppercase => 'Debe contener una letra mayúscula (A-Z)';

  @override
  String get valPasswordLowercase => 'Debe contener una letra minúscula (a-z)';

  @override
  String get valPasswordDigit => 'Debe contener un dígito (0-9)';

  @override
  String get valPasswordSpecial =>
      'Debe contener un carácter especial (!@#\$%^&*)';

  @override
  String get pwStrengthWeak => 'Débil';

  @override
  String get pwStrengthMedium => 'Media';

  @override
  String get pwStrengthStrong => 'Fuerte';

  @override
  String get pwStrengthVeryStrong => 'Muy fuerte';

  @override
  String get pwReqLength => '≥8 caracteres';

  @override
  String get pwReqUppercase => 'Mayúscula (A-Z)';

  @override
  String get pwReqLowercase => 'Minúscula (a-z)';

  @override
  String get pwReqDigit => 'Dígito (0-9)';

  @override
  String get pwReqSpecial => 'Carácter especial (!@#\$...)';

  @override
  String get loginWithGoogle => 'Iniciar sesión con Google';

  @override
  String get orContinueWith => 'O continúe con';

  @override
  String agreeToTerms(String privacyPolicy, String termsOfService) {
    return 'Acepto la $privacyPolicy y los $termsOfService';
  }

  @override
  String get privacyPolicy => 'Política de Privacidad';

  @override
  String get termsOfService => 'Términos del Servicio';

  @override
  String get valMustAgreeTerms =>
      'Debes aceptar los Términos del Servicio para continuar';

  @override
  String get youColon => 'Usted:';

  @override
  String get systemNicknameChanged => 'Se cambió el apodo';

  @override
  String get systemThemeChanged => 'Se cambió el tema del chat';

  @override
  String get systemQuickReactionChanged => 'Reacción rápida cambiada';

  @override
  String get wallpaperUploadError => 'No se pudo subir la imagen';

  @override
  String get wallpaperScale => 'Escala';

  @override
  String get wallpaperPreviewHint => 'Pellizque o arrastre para ajustar';

  @override
  String get wallpaperPreviewIncoming => '¡Hola! ¿Cómo se ve esto?';

  @override
  String get wallpaperPreviewOutgoing => 'Se ve genial 🎉';

  @override
  String get errCannotOpenLink => 'No se pudo abrir el enlace';

  @override
  String sysNicknameClearedSelf(String actorName) {
    return '$actorName eliminó su propio apodo';
  }

  @override
  String sysNicknameClearedOther(String actorName, String targetName) {
    return '$actorName eliminó el apodo de $targetName';
  }

  @override
  String sysNicknameSetSelf(String actorName, String nickname) {
    return '$actorName estableció su apodo como $nickname';
  }

  @override
  String sysNicknameSetOther(
      String actorName, String targetName, String nickname) {
    return '$actorName estableció el apodo de $targetName como $nickname';
  }

  @override
  String sysThemeChanged(String actorName) {
    return '$actorName cambió el tema del chat';
  }

  @override
  String sysQuickReactionChanged(String actorName, String emoji) {
    return '$actorName cambió la reacción rápida a $emoji';
  }

  @override
  String sysGroupCreated(String actorName) {
    return '$actorName creó el grupo';
  }

  @override
  String sysMembersAdded(String actorName) {
    return '$actorName añadió nuevos miembros';
  }

  @override
  String sysMemberLeft(String actorName) {
    return '$actorName salió del grupo';
  }

  @override
  String sysMemberRemoved(String actorName) {
    return '$actorName eliminó a un miembro';
  }

  @override
  String sysMemberJoined(String actorName) {
    return '$actorName se unió al grupo';
  }

  @override
  String sysPinnedMessage(String actorName) {
    return '$actorName fijó un mensaje';
  }

  @override
  String sysUnpinnedMessage(String actorName) {
    return '$actorName dejó de fijar un mensaje';
  }

  @override
  String systemVideoCallEnded(String duration) {
    return 'Videollamada finalizada · $duration';
  }

  @override
  String systemVoiceCallEnded(String duration) {
    return 'Llamada de voz finalizada · $duration';
  }

  @override
  String get systemVideoCallMissed => 'Videollamada perdida';

  @override
  String get systemVoiceCallMissed => 'Llamada de voz perdida';

  @override
  String get errActionFailed => 'Algo salió mal. Inténtalo de nuevo.';

  @override
  String get kbDeleteFailed => 'Error al eliminar, inténtalo de nuevo';

  @override
  String get exploreJoinFailed => 'No se pudo unir al canal';

  @override
  String get unnamedChannel => 'Sin nombre';

  @override
  String get actionOk => 'Aceptar';

  @override
  String get reminderDeleteConfirm => '¿Eliminar este recordatorio?';

  @override
  String get profileNameLabel => 'Nombre';

  @override
  String get genderMale => 'Masculino';

  @override
  String get genderFemale => 'Femenino';

  @override
  String get genderOther => 'Otro';

  @override
  String get aiPersonaSaved => 'Guardado';

  @override
  String get aiPersonaResetTitle => 'Restablecer la persona de IA';

  @override
  String get aiPersonaResetConfirm =>
      '¿Restablecer la persona de IA a su configuración predeterminada?';

  @override
  String get aiPersonaToneLabel => 'Tono';

  @override
  String get aiPersonaResetToDefault => 'Restablecer valores predeterminados';

  @override
  String tokenUsagePercentUsed(String percent) {
    return '$percent% usado este mes';
  }

  @override
  String tokenUsageCostUsd(String amount) {
    return '$amount USD';
  }

  @override
  String get notifications => 'Notificaciones';

  @override
  String get notificationsEnabled => 'Las notificaciones están activadas';

  @override
  String get notificationsDisabled => 'Las notificaciones están desactivadas';

  @override
  String get legalScreenTitle => 'Privacidad y Términos';

  @override
  String get legalLastUpdated => 'Última actualización: 15 de junio de 2026';

  @override
  String get legalDataCollectionTitle => '1. Recopilación de Datos';

  @override
  String get legalDataCollectionContent =>
      'Recopilamos información que nos proporciona directamente, por ejemplo, al crear o modificar su cuenta, usar nuestros servicios o comunicarse con nosotros, incluyendo su nombre, dirección de correo electrónico, foto de perfil y los mensajes que envía.';

  @override
  String get legalDataUsageTitle => '2. Cómo Usamos Sus Datos';

  @override
  String get legalDataUsageContent =>
      'Sus datos se utilizan para proporcionar, mantener y mejorar nuestros servicios, incluida la facilitación de la comunicación entre usuarios, garantizar la seguridad y personalizar su experiencia.';

  @override
  String get legalSecurityTitle => '3. Seguridad';

  @override
  String get legalSecurityContent =>
      'Implementamos medidas de seguridad estándar de la industria para proteger su información personal y mensajes. El acceso a los datos está estrictamente controlado y utilizamos cifrado para proteger la información confidencial.';

  @override
  String get legalUserRightsTitle => '4. Sus Derechos';

  @override
  String get legalUserRightsContent =>
      'Tiene derecho a acceder, corregir o eliminar sus datos personales. Puede eliminar su cuenta en cualquier momento a través de la configuración de la aplicación.';

  @override
  String get legalTermsTitle => '5. Términos de Servicio';

  @override
  String get legalTermsContent =>
      'Al usar nuestra plataforma, acepta no participar en actividades abusivas, de acoso o ilegales. Nos reservamos el derecho de suspender o cancelar cuentas que violen estos términos.';

  @override
  String get authMsgLoginSuccess => 'Inicio de sesión exitoso.';

  @override
  String get authMsgLogoutSuccess => 'Cierre de sesión exitoso.';

  @override
  String get authMsgOtpSent => 'Se ha enviado un OTP a su correo electrónico.';

  @override
  String get authMsgOtpValid => 'OTP verificado correctamente.';

  @override
  String get authMsgOtpResent => 'Se ha enviado un nuevo OTP.';

  @override
  String get authMsgPasswordUpdated =>
      'Contraseña actualizada correctamente. Por favor, inicie sesión de nuevo.';

  @override
  String get authMsgAccountUnverifiedOtpSent =>
      'La cuenta aún no está verificada. Se ha enviado un nuevo OTP a su correo electrónico.';

  @override
  String get authErrOtpInvalid => 'Código OTP inválido.';

  @override
  String get authErrOtpExpired => 'El OTP ha expirado.';

  @override
  String get authErrOtpAttemptsExceeded =>
      'Demasiados intentos incorrectos. Por favor, solicite un nuevo OTP.';

  @override
  String authErrOtpWrongWithRemaining(int remaining) {
    return 'OTP incorrecto. Quedan $remaining intento(s).';
  }

  @override
  String authErrOtpResendCooldown(int ttl) {
    return 'Por favor, espere $ttl segundos antes de solicitar un nuevo OTP.';
  }

  @override
  String get authErrOtpSendFailed =>
      'No pudimos enviar el código de verificación ahora. Inténtalo de nuevo en un momento.';

  @override
  String get authErrEmailNotFound => 'El correo no existe en el sistema.';

  @override
  String get authErrValEmailInvalid => 'Formato de correo inválido.';

  @override
  String get authErrValEmailRequired => 'El correo es obligatorio.';

  @override
  String get authErrValDisplaynameRequired =>
      'El nombre de usuario es obligatorio.';

  @override
  String get authErrValDisplaynameTooShort =>
      'El nombre de usuario es demasiado corto (mínimo 2 caracteres).';

  @override
  String get authErrValPasswordTooShort =>
      'La contraseña debe tener al menos 8 caracteres.';

  @override
  String authErrAccountLocked(int minutes) {
    return 'Cuenta bloqueada temporalmente durante $minutes minuto(s) por demasiados intentos fallidos.';
  }

  @override
  String authErrLoginFailedWithRemaining(int remaining) {
    return 'Correo o contraseña incorrectos. Quedan $remaining intento(s).';
  }

  @override
  String authErrLoginFailedLocked(int minutes) {
    return 'Demasiados intentos fallidos. Cuenta bloqueada durante $minutes minuto(s).';
  }

  @override
  String get authErrTokenInvalid => 'Token inválido.';

  @override
  String get authErrSessionNotFound => 'Sesión no encontrada o expirada.';

  @override
  String get authErrSessionInvalid => 'La sesión no existe o ha expirado.';

  @override
  String get authErrSessionRevoked => 'La sesión ha sido revocada.';

  @override
  String get authErrRefreshTokenReuse =>
      'Alerta de seguridad: se detectó reutilización del token de actualización. Todas las sesiones fueron revocadas.';

  @override
  String get authErrRefreshTokenInvalid => 'Token de actualización inválido.';

  @override
  String get authErrRefreshTokenRotated =>
      'El token de actualización ya ha sido rotado.';

  @override
  String get authErrTokenSessionMismatch =>
      'El token no coincide con la sesión.';

  @override
  String get authErrSocialEmailUnavailable =>
      'No se puede obtener el correo de la cuenta social.';

  @override
  String get authErrLoginCodeInvalid =>
      'El código de inicio de sesión es inválido o ha expirado.';

  @override
  String get authErrUserNotFound => 'Usuario no encontrado.';

  @override
  String get integrationsTitle => 'Integraciones';

  @override
  String get integrationsSubtitle =>
      'Conecta una cuenta una vez. A partir de ahí, solo escribe a tu asistente — actúa en tu nombre, con tus permisos y nada más.';

  @override
  String get integrationsSettingsSubtitle =>
      'Conecta herramientas que tu asistente puede usar';

  @override
  String get connectorStatusConnected => 'Conectado';

  @override
  String get connectorStatusAvailable => 'Disponible';

  @override
  String get connectorStatusComingSoon => 'Próximamente';

  @override
  String get connectorConnect => 'Conectar';

  @override
  String get connectorManage => 'Gestionar';

  @override
  String get connectorDisconnect => 'Desconectar';

  @override
  String get connectorDisconnectConfirm =>
      '¿Desconectar esta cuenta? Tu asistente perderá acceso a sus herramientas.';

  @override
  String get connectorOpenFailed =>
      'No se pudo abrir la página de autorización.';

  @override
  String get customMcpTitle => 'Añadir un servidor MCP personalizado';

  @override
  String get customMcpSubtitle =>
      'Apunta tu asistente a cualquier servidor MCP. Descubriremos sus herramientas y tu asistente podrá usarlas.';

  @override
  String get customMcpName => 'Nombre';

  @override
  String get customMcpUrl => 'URL del servidor';

  @override
  String get customMcpAuth => 'Autenticación';

  @override
  String get customMcpAuthNone => 'Ninguna';

  @override
  String get customMcpAuthApiKey => 'Clave API';

  @override
  String get customMcpAuthOauth => 'OAuth';

  @override
  String get customMcpCredential => 'Credencial';

  @override
  String get customMcpDiscover => 'Descubrir herramientas';

  @override
  String get customMcpSave => 'Guardar';

  @override
  String get customMcpSaved => 'Servidor MCP personalizado añadido.';

  @override
  String customMcpToolsFound(int count) {
    return '$count herramientas descubiertas';
  }

  @override
  String get permissionsTitle => 'Permisos de la IA';

  @override
  String get permissionsSubtitle =>
      'Elige qué acciones puede realizar tu asistente a través de este conector.';

  @override
  String get permView => 'Ver';

  @override
  String get permCreate => 'Crear';

  @override
  String get permEdit => 'Editar';

  @override
  String get permDelete => 'Eliminar';

  @override
  String get permViewDesc => 'Leer datos, buscar y resumir (solo lectura).';

  @override
  String get permCreateDesc =>
      'Agregar nuevos elementos como archivos, eventos o registros.';

  @override
  String get permEditDesc => 'Modificar elementos existentes y su contenido.';

  @override
  String get permDeleteDesc => 'Eliminar elementos de forma permanente.';

  @override
  String get permManage => 'Permisos';

  @override
  String get permSaved => 'Permisos actualizados.';

  @override
  String get skillsTitle => 'Habilidades';

  @override
  String get skillsSubtitle =>
      'Las habilidades agrupan un conjunto de herramientas y una forma de trabajar. Activa solo lo que necesites — cada una indica lo que requiere.';

  @override
  String get skillsRealActionNote =>
      'Las habilidades cambian cómo piensa y se expresa tu asistente. Para que actúe de verdad (enviar correos, crear eventos, escribir en Notion…), conecta la app correspondiente que aparece abajo.';

  @override
  String get skillsSettingsSubtitle => 'Elige en qué es bueno tu asistente';

  @override
  String skillNeeds(String requirements) {
    return 'Necesita $requirements';
  }

  @override
  String get skillSchedulerName => 'Planificador';

  @override
  String get skillSchedulerDesc =>
      'Sugiere horarios de reunión y redacta invitaciones — aún debes enviarlas desde tu app de calendario/correo (o conecta Google Calendar/Gmail para que actúe directamente).';

  @override
  String get skillMailWriterName => 'Redactor de correos';

  @override
  String get skillMailWriterDesc =>
      'Redacta respuestas con tu estilo, resume hilos largos.';

  @override
  String get skillResearcherName => 'Investigador';

  @override
  String get skillResearcherDesc =>
      'Responde a partir del contenido de esta conversación y su conocimiento previo, citando fuentes cuando es posible — no es una búsqueda web en vivo.';

  @override
  String get skillProjectKeeperName => 'Gestor de proyectos';

  @override
  String get skillProjectKeeperDesc =>
      'Hace seguimiento de tareas, responsables y decisiones en la conversación y las resume — conecta Notion para que realmente pueda escribirlas allí.';

  @override
  String get skillMeetingNotesName => 'Notas de reunión';

  @override
  String get skillMeetingNotesDesc =>
      'Resume reuniones y extrae decisiones y tareas a realizar.';

  @override
  String get skillInboxTriageName => 'Clasificación de bandeja';

  @override
  String get skillInboxTriageDesc =>
      'Prioriza mensajes y sugiere respuestas rápidas.';

  @override
  String get skillDataAnalystName => 'Analista de datos';

  @override
  String get skillDataAnalystDesc =>
      'Analiza tablas y cifras; revela tendencias y valores atípicos.';

  @override
  String get skillDocDrafterName => 'Redactor de documentos';

  @override
  String get skillDocDrafterDesc =>
      'Redacta propuestas, especificaciones e informes estructurados.';

  @override
  String get skillTranslatorName => 'Traductor';

  @override
  String get skillTranslatorDesc =>
      'Traduce y localiza textos de forma natural entre idiomas.';

  @override
  String get skillWebSearchName => 'Búsqueda web';

  @override
  String get skillWebSearchDesc =>
      'Encuentra información reciente en la web y cita fuentes.';

  @override
  String get skillWeatherForecastName => 'Pronóstico del tiempo';

  @override
  String get skillWeatherForecastDesc =>
      'Consulta el tiempo y el pronóstico para cualquier lugar.';

  @override
  String get adminTitle => 'Consola de administración';

  @override
  String get adminSubtitle =>
      'Gestiona tu espacio, departamentos, miembros y roles';

  @override
  String get adminBack => 'Volver';

  @override
  String get adminLoading => 'Cargando…';

  @override
  String get adminSave => 'Guardar';

  @override
  String get adminSaving => 'Guardando…';

  @override
  String get adminCancel => 'Cancelar';

  @override
  String get adminToastSaved => 'Guardado';

  @override
  String get adminToastDeleted => 'Eliminado';

  @override
  String get adminToastError => 'Algo salió mal';

  @override
  String get adminMenu => 'Administración';

  @override
  String get adminSettingsSubtitle =>
      'Espacio, departamentos, miembros y roles';

  @override
  String get adminNavWorkspace => 'Espacio';

  @override
  String get adminNavDepartments => 'Departamentos';

  @override
  String get adminNavMembers => 'Miembros';

  @override
  String get adminNavRoles => 'Roles';

  @override
  String get adminNavAudit => 'Registro de auditoría';

  @override
  String get adminNavAi => 'Asistente de IA';

  @override
  String get adminAiInheritHint =>
      'Deja un campo vacío o elige \"Heredar\" para usar el valor predeterminado del servidor.';

  @override
  String get adminAiInheritOption => 'Heredar (predeterminado)';

  @override
  String get adminAiOn => 'Activado';

  @override
  String get adminAiOff => 'Desactivado';

  @override
  String get adminAiPersonaSection => 'Personalidad';

  @override
  String get adminAiPersonaName => 'Nombre predeterminado del asistente';

  @override
  String get adminAiTone => 'Tono predeterminado';

  @override
  String get adminAiToneFriendly => 'Amigable';

  @override
  String get adminAiToneProfessional => 'Profesional';

  @override
  String get adminAiToneConcise => 'Conciso';

  @override
  String get adminAiToneCreative => 'Creativo';

  @override
  String get adminAiModelSection => 'Modelo';

  @override
  String get adminAiModelTier => 'Nivel de modelo predeterminado';

  @override
  String get adminAiTierAuto => 'Automático (enrutador)';

  @override
  String get adminAiTierSimple => 'Simple';

  @override
  String get adminAiTierMid => 'Equilibrado';

  @override
  String get adminAiTierComplex => 'Avanzado';

  @override
  String get adminAiCapabilitiesSection => 'Capacidades';

  @override
  String get adminAiWebSearch => 'Búsqueda web';

  @override
  String get adminAiWebSearchDesc =>
      'Permitir que el asistente busque en la web.';

  @override
  String get adminAiThinking => 'Pensamiento extendido';

  @override
  String get adminAiThinkingDesc =>
      'Permitir que el asistente razone paso a paso.';

  @override
  String get adminAiDigestSection => 'Resumen diario';

  @override
  String get adminAiDailyDigest => 'Resumen diario';

  @override
  String get adminAiDailyDigestDesc =>
      'Publica una vez al día un resumen de la actividad de cada conversación con la IA.';

  @override
  String get adminAiDailyDigestHour => 'Hora de entrega';

  @override
  String get adminAiDailyDigestHourDesc =>
      'Hora local en que se entrega el resumen. Disponible cuando el resumen está activado.';

  @override
  String get adminAiQuotaSection => 'Límite de uso';

  @override
  String get adminAiTokenLimit => 'Límite mensual de tokens';

  @override
  String get adminAiTokenLimitDesc =>
      'Déjalo vacío para heredar; 0 bloquea todo el uso.';

  @override
  String get adminAiConnectorsSection => 'Conectores permitidos';

  @override
  String get adminAiRestrictConnectors => 'Restringir conectores para la IA';

  @override
  String get adminAiConnectorsInherit =>
      'Heredando la lista permitida del espacio de trabajo.';

  @override
  String get adminAiConnectorsExplicit =>
      'La IA solo puede usar los conectores seleccionados abajo.';

  @override
  String get adminWsIdentity => 'Identidad y marca';

  @override
  String get adminWsName => 'Nombre del espacio';

  @override
  String get adminWsNamePlaceholder => 'Acme S.A.';

  @override
  String get adminWsLogoUrl => 'URL del logo';

  @override
  String get adminWsPrimaryColor => 'Color principal';

  @override
  String get adminWsFeatures => 'Indicadores de funciones';

  @override
  String get adminWsNoFeatures =>
      'No hay indicadores de funciones configurados.';

  @override
  String get adminWsAllowList => 'Lista de conectores permitidos';

  @override
  String get adminWsAllowListDesc =>
      'Conectores que los miembros pueden conectar personalmente.';

  @override
  String get adminWsNoCatalog => 'No hay conectores disponibles.';

  @override
  String get adminDeptNew => 'Nuevo departamento';

  @override
  String get adminDeptEdit => 'Editar departamento';

  @override
  String get adminDeptEmpty => 'Aún no hay departamentos.';

  @override
  String get adminDeptLead => 'Responsable';

  @override
  String get adminDeptLeadNone => 'Sin responsable';

  @override
  String get adminDeptName => 'Nombre';

  @override
  String get adminDeptDescription => 'Descripción';

  @override
  String get adminDeptDialogDesc =>
      'Los departamentos agrupan miembros y tienen sus propios chats.';

  @override
  String adminDeptDeleteConfirm(String name) {
    return '¿Eliminar el departamento \"$name\"?';
  }

  @override
  String get adminMemberHint => 'Asigna un rol y departamentos a cada miembro.';

  @override
  String get adminMemberEdit => 'Editar miembro';

  @override
  String get adminMemberRevokeNote =>
      'Al guardar se revocan las sesiones activas del miembro.';

  @override
  String get adminMemberRole => 'Rol';

  @override
  String get adminMemberRoleNone => 'Sin rol';

  @override
  String get adminMemberRoleLockedSelf => 'No puedes cambiar tu propio rol.';

  @override
  String get adminMemberRoleLockedOwner =>
      'Solo un Propietario puede cambiar el rol de un Propietario.';

  @override
  String get adminMemberDepartments => 'Departamentos';

  @override
  String get adminRoleHint =>
      'Activa los permisos de cada rol. El rol Owner es de solo lectura.';

  @override
  String get adminRoleCapability => 'Permiso';

  @override
  String get adminRolePreset => 'Predefinido';

  @override
  String get adminRoleClone => 'Clonar';

  @override
  String adminRoleCloneTitle(String name) {
    return 'Clonar $name';
  }

  @override
  String get adminRoleName => 'Nombre del rol';

  @override
  String get adminAuditTitle => 'Registro de auditoría';

  @override
  String get adminAuditComingSoon =>
      'El registro de auditoría estará disponible en una próxima actualización.';

  @override
  String get adminCapManageWorkspace => 'Gestionar espacio';

  @override
  String get adminCapManageDepartments => 'Gestionar departamentos';

  @override
  String get adminCapManageMembers => 'Gestionar miembros';

  @override
  String get adminCapManageRoles => 'Gestionar roles';

  @override
  String get adminCapConnectWorkspaceConnector =>
      'Conectar conectores del espacio';

  @override
  String get adminCapAddCustomMcp => 'Añadir MCP personalizado';

  @override
  String get adminCapConnectPersonalConnector =>
      'Conectar conectores personales';

  @override
  String get adminCapUsePersonalAssistant => 'Usar asistente personal';

  @override
  String get adminCapUseGroupBot => 'Usar bot de grupo';

  @override
  String get adminCapRunSensitiveSkill => 'Ejecutar habilidades sensibles';

  @override
  String get adminCapViewAuditLog => 'Ver registro de auditoría';

  @override
  String get adminAuditEmpty => 'Aún no hay registros de auditoría.';

  @override
  String get adminAuditPrev => 'Anterior';

  @override
  String get adminAuditNext => 'Siguiente';

  @override
  String get newConvDepartment => 'Departamento (opcional)';

  @override
  String get newConvNoDepartment => 'Sin departamento';

  @override
  String get loginWithSso => 'Iniciar sesión con SSO';

  @override
  String get adminNavSso => 'SSO';

  @override
  String get adminSsoTitle => 'Inicio de sesión único (SSO)';

  @override
  String get adminSsoHint =>
      'Configura el inicio de sesión OIDC. Las credenciales del proveedor se definen en el .env; aquí asignas grupos del IdP a roles y departamentos.';

  @override
  String get adminSsoEnabled => 'Activar SSO';

  @override
  String get adminSsoAllowedDomains => 'Dominios de correo permitidos';

  @override
  String get adminSsoAllowedDomainsHint =>
      'Separados por comas. Déjalo vacío para permitir cualquier correo verificado.';

  @override
  String get adminSsoDefaultRole => 'Rol predeterminado';

  @override
  String get adminSsoNone => 'Ninguno';

  @override
  String get adminSsoGroupRoleMap => 'Grupo → Rol';

  @override
  String get adminSsoGroupDeptMap => 'Grupo → Departamento';

  @override
  String get adminSsoGroupPlaceholder => 'Nombre del grupo IdP';

  @override
  String get adminSsoAddMapping => 'Añadir asignación';

  @override
  String get sectionDirectoryTitle => 'Directorio MCP';

  @override
  String get sectionDirectoryDesc =>
      'Explora servidores MCP y conéctate con un clic — OAuth se ejecuta automáticamente.';

  @override
  String get directoryAdd => 'Añadir entrada';

  @override
  String get directorySearch => 'Buscar en el directorio…';

  @override
  String get directoryEmpty => 'Ninguna entrada coincide con tu búsqueda.';

  @override
  String get directoryEdit => 'Editar entrada';

  @override
  String get directoryDelete => 'Eliminar entrada';

  @override
  String get tierWorkspace => 'Espacio de trabajo';

  @override
  String get tierPersonal => 'Personal';

  @override
  String get tierBoth => 'Personal / Espacio de trabajo';

  @override
  String get directorySaveSuccess => 'Entrada del directorio guardada.';

  @override
  String get directoryDeleteSuccess => 'Entrada del directorio eliminada.';

  @override
  String get directoryAddTitle => 'Añadir entrada al directorio';

  @override
  String get directoryEditTitle => 'Editar entrada del directorio';

  @override
  String get directoryDialogDesc =>
      'Añade un servidor MCP público que los miembros puedan conectar con un clic.';

  @override
  String get directorySlug => 'Slug';

  @override
  String get directoryName => 'Nombre';

  @override
  String get directoryDescription => 'Descripción';

  @override
  String get directoryMcpUrl => 'URL de MCP';

  @override
  String get directoryAuthMode => 'Modo de autenticación';

  @override
  String get directoryTier => 'Nivel';

  @override
  String get directoryEnvHint =>
      'Para env-oauth: indica las variables de entorno con las credenciales del cliente OAuth.';

  @override
  String get directoryEnvClientId => 'Variable Client ID';

  @override
  String get directoryEnvClientSecret => 'Variable Client secret';

  @override
  String get directoryAuthorizeUrl => 'URL de autorización';

  @override
  String get directoryTokenUrl => 'URL de token';

  @override
  String get directoryCancel => 'Cancelar';

  @override
  String get directorySave => 'Guardar';

  @override
  String directoryKeyTitle(String provider) {
    return 'Conectar $provider';
  }

  @override
  String get directoryKeyLabel => 'Clave API';

  @override
  String directoryConnected(String provider) {
    return '$provider conectado.';
  }

  @override
  String get editNicknames => 'Editar apodos';

  @override
  String get nicknameModalTitle => 'Apodos';

  @override
  String get nicknameNonePlaceholder => 'Sin apodo';

  @override
  String get nicknameYouSuffix => '(tú)';

  @override
  String get adminNavUsage => 'Uso';

  @override
  String get usageThisMonth => 'Este mes';

  @override
  String get usageTotalTokens => 'Tokens totales';

  @override
  String get usageRequests => 'Solicitudes';

  @override
  String get usageEstCost => 'Coste estimado';

  @override
  String get usageThumbsDownRate => 'Tasa de pulgares abajo';

  @override
  String usageFeedbackBreakdown(int down, int total) {
    return '$down de $total valoradas';
  }

  @override
  String get usagePerModelTitle => 'Coste por modelo';

  @override
  String usageModelTokens(String input, String output, String requests) {
    return '$input ent. / $output sal. · $requests sol.';
  }

  @override
  String get usageTopUsersTitle => 'Usuarios principales';

  @override
  String usageUserRequests(int count) {
    return '$count solicitudes';
  }

  @override
  String get usageWorstAnswersTitle => 'Respuestas peor valoradas';

  @override
  String get usageNoPreview => '(sin vista previa de la respuesta)';

  @override
  String usageUserComment(String comment) {
    return '«$comment»';
  }

  @override
  String get usageNoData => 'No hay datos para este periodo.';

  @override
  String get usageLoadError => 'No se pudo cargar el panel de uso.';

  @override
  String get usageRetry => 'Reintentar';

  @override
  String get assistantDefaultName => 'Mi asistente';

  @override
  String get assistantSubtitle => 'Tu asistente personal';

  @override
  String get assistantOpenChat => 'Abrir chat del asistente';

  @override
  String get assistantSetupCta => 'Configurar asistente';

  @override
  String get assistantSetupTitle => 'Configura tu asistente';

  @override
  String get assistantSetupStepName => 'Ponle nombre a tu asistente';

  @override
  String get assistantSetupStepPersona => 'Define su personalidad';

  @override
  String get assistantSetupStepModel => 'Elige un modelo';

  @override
  String get assistantSetupStepConfirm => 'Revisar y crear';

  @override
  String get assistantSetupNamePlaceholder => 'p. ej. Aria';

  @override
  String get assistantSetupPersonaPlaceholder => 'Eres un asistente útil que…';

  @override
  String get assistantSetupPersonaHint =>
      'Describe cómo debe hablar y comportarse tu asistente.';

  @override
  String get assistantSetupCreateButton => 'Crear asistente';

  @override
  String get assistantSetupCreating => 'Creando…';

  @override
  String get assistantSetupSuccess => 'Tu asistente está listo';

  @override
  String get assistantSettingsTitle => 'Ajustes del asistente';

  @override
  String get assistantSettingsEditPersona => 'Personalidad';

  @override
  String get assistantSettingsChangeModel => 'Modelo';

  @override
  String get assistantSettingsDeleteTitle => 'Eliminar asistente';

  @override
  String get assistantSettingsDeleteConfirm =>
      'Esto eliminará tu asistente y su chat. No se puede deshacer.';

  @override
  String get assistantSettingsDeleteButton => 'Eliminar asistente';

  @override
  String get botAdminTitle => 'Integración de bots';

  @override
  String get botAdminGenerateToken => 'Generar token';

  @override
  String get botAdminRevokeToken => 'Revocar';

  @override
  String get botAdminTokenWarning =>
      'Copia este token ahora: solo se muestra una vez y no se puede recuperar.';

  @override
  String get botAdminCopyToken => 'Copiar';

  @override
  String get botAdminMcpUrl => 'URL de MCP';

  @override
  String get botAdminToken => 'Token de integración';

  @override
  String get botAdminLastUsed => 'Último uso';

  @override
  String get botAdminNeverUsed => 'Nunca usado';

  @override
  String get botAdminNoBotsRegistered => 'Aún no hay bots registrados.';

  @override
  String get helpTitle => 'Ayuda y preguntas frecuentes';

  @override
  String get settingsHelp => 'Ayuda y FAQ';

  @override
  String get settingsHelpSubtitle => 'Centro de ayuda y preguntas frecuentes';

  @override
  String get helpSearchHint => 'Buscar ayuda…';

  @override
  String get helpNoResults => 'No se encontraron resultados';

  @override
  String get helpCatGettingStarted => 'Primeros pasos';

  @override
  String get helpCatMessaging => 'Mensajería';

  @override
  String get helpCatAiFeatures => 'Funciones de IA';

  @override
  String get helpCatGroups => 'Grupos';

  @override
  String get helpCatAccountSecurity => 'Cuenta y seguridad';

  @override
  String get helpGettingStartedQ1 => '¿Qué es PON?';

  @override
  String get helpGettingStartedA1 =>
      'PON es una plataforma de mensajería autoalojada con tecnología de IA que combina la comunicación en equipo con un asistente de IA integrado. Admite mensajes directos, chats grupales y flujos de trabajo impulsados por IA.';

  @override
  String get helpGettingStartedQ2 => '¿Cómo creo una cuenta?';

  @override
  String get helpGettingStartedA2 =>
      'Tu cuenta la crea el administrador de tu espacio de trabajo. Recibirás un correo de invitación con instrucciones para establecer tu contraseña y verificar tu cuenta.';

  @override
  String get helpGettingStartedQ3 => '¿Cómo encuentro y agrego amigos?';

  @override
  String get helpGettingStartedA3 =>
      'Ve a la pestaña Amigos y usa la barra de búsqueda para encontrar colegas por nombre o correo electrónico. Envía una solicitud de amistad y empieza a chatear una vez aceptada.';

  @override
  String get helpGettingStartedQ4 => '¿Cómo inicio una conversación?';

  @override
  String get helpGettingStartedA4 =>
      'Toca el icono de redactar en la pantalla de conversaciones, busca un contacto y selecciónalo para abrir una nueva conversación.';

  @override
  String get helpMessagingQ1 => '¿Cómo envío mensajes?';

  @override
  String get helpMessagingA1 =>
      'Escribe tu mensaje en el campo de texto en la parte inferior de la conversación y pulsa Intro o toca el botón de enviar.';

  @override
  String get helpMessagingQ2 => '¿Puedo enviar mensajes de voz?';

  @override
  String get helpMessagingA2 =>
      '¡Sí! Mantén pulsado el botón del micrófono en el área de entrada de mensajes para grabar un mensaje de voz. Suelta para enviar o desliza para cancelar.';

  @override
  String get helpMessagingQ3 => '¿Cómo envío archivos e imágenes?';

  @override
  String get helpMessagingA3 =>
      'Toca el icono de adjuntar junto al campo de mensaje para seleccionar imágenes, vídeos o archivos de tu dispositivo.';

  @override
  String get helpMessagingQ4 => '¿Cómo fijo mensajes importantes?';

  @override
  String get helpMessagingA4 =>
      'Mantén pulsado o pasa el cursor sobre un mensaje, toca el menú Más (⋯) y selecciona \'Fijar mensaje\'. Los mensajes fijados aparecen en la parte superior de la conversación. Puedes fijar hasta 2 mensajes por conversación.';

  @override
  String get helpMessagingQ5 => '¿Qué son las reacciones a mensajes?';

  @override
  String get helpMessagingA5 =>
      'Pasa el cursor o mantén pulsado un mensaje y toca el icono de emoji para añadir una reacción rápida. Los demás pueden verla y añadir las suyas.';

  @override
  String get helpAiFeaturesQ1 => '¿Qué puede hacer el asistente de IA?';

  @override
  String get helpAiFeaturesA1 =>
      'El asistente de IA (@AI) puede responder preguntas, resumir conversaciones, ayudar a redactar mensajes, analizar documentos cargados y ejecutar tareas mediante herramientas conectadas.';

  @override
  String get helpAiFeaturesQ2 => '¿Cómo uso @AI en una conversación?';

  @override
  String get helpAiFeaturesA2 =>
      'En cualquier conversación, escribe @AI seguido de tu pregunta o solicitud. El asistente responderá en el hilo de la conversación.';

  @override
  String get helpAiFeaturesQ3 => '¿Qué es la memoria de IA?';

  @override
  String get helpAiFeaturesA3 =>
      'La memoria de IA permite que el asistente recuerde el contexto de conversaciones anteriores, haciendo que las interacciones sean más personalizadas y eficientes con el tiempo.';

  @override
  String get helpAiFeaturesQ4 => '¿Cómo configuro mi asistente personal?';

  @override
  String get helpAiFeaturesA4 =>
      'Ve a la sección Asistente de IA y toca \'Configurar asistente\'. Puedes configurar la personalidad del asistente, conectar herramientas y establecer preferencias.';

  @override
  String get helpGroupsQ1 => '¿Cómo creo un grupo?';

  @override
  String get helpGroupsA1 =>
      'Toca el icono de redactar, selecciona \'Nuevo grupo\', añade miembros buscando sus nombres, establece un nombre de grupo y toca Crear.';

  @override
  String get helpGroupsQ2 => '¿Cómo agrego miembros a un grupo?';

  @override
  String get helpGroupsA2 =>
      'Abre la conversación del grupo, toca el icono de Configuración y selecciona \'Añadir miembros\'. Busca contactos y agrégalos.';

  @override
  String get helpGroupsQ3 => '¿Qué son los roles de grupo?';

  @override
  String get helpGroupsA3 =>
      'Los grupos tienen dos roles: Administrador y Miembro. Los administradores pueden agregar/eliminar miembros, cambiar el nombre y el avatar del grupo, y gestionar la configuración del grupo.';

  @override
  String get helpAccountSecurityQ1 => '¿Cómo cambio mi foto de perfil?';

  @override
  String get helpAccountSecurityA1 =>
      'Ve a Configuración → Perfil, toca tu avatar actual y elige una nueva foto de tu dispositivo.';

  @override
  String get helpAccountSecurityQ2 => '¿Cómo activo los mensajes temporales?';

  @override
  String get helpAccountSecurityA2 =>
      'Abre una conversación, toca el icono de Configuración, ve a Personalizar chat y activa \'Mensajes temporales\' con el temporizador que prefieras.';

  @override
  String get helpAccountSecurityQ3 => '¿Cómo bloqueo a un usuario?';

  @override
  String get helpAccountSecurityA3 =>
      'Abre la conversación con el usuario, toca el icono de Configuración, desplázate hasta Privacidad y soporte y selecciona \'Bloquear usuario\'.';

  @override
  String get helpAccountSecurityQ4 => '¿Cómo elimino el historial de mensajes?';

  @override
  String get helpAccountSecurityA4 =>
      'Abre la conversación, toca Configuración, ve a Privacidad y soporte y selecciona \'Borrar historial\'. Esto solo elimina el historial de tu dispositivo.';

  @override
  String get blockedChats => 'Bloqueados';

  @override
  String get noBlockedChats => 'No hay conversaciones bloqueadas';

  @override
  String get blockAndHide => 'Bloquear y ocultar';

  @override
  String get unblockAndRestore => 'Desbloquear';

  @override
  String get callBlocked => 'Este usuario no quiere ser contactado';

  @override
  String get mute15min => '15 minutos';

  @override
  String get mute30min => '30 minutos';

  @override
  String get mute1hour => '1 hora';

  @override
  String get mute24hours => '24 horas';

  @override
  String get muteForever => 'Hasta que lo active manualmente';

  @override
  String get profileBlockedByOwner =>
      'El perfil de este usuario no está disponible';

  @override
  String get unsavedChangesTitle => 'Tienes cambios sin guardar';

  @override
  String get unsavedChangesDesc => 'Si sales, se perderán tus cambios.';

  @override
  String get keepEditing => 'Seguir editando';

  @override
  String get saveAndLeave => 'Guardar y salir';

  @override
  String get leaveWithoutSaving => 'Salir sin guardar';

  @override
  String get aiSessionHistory => 'Historial de conversaciones';

  @override
  String get aiNewSession => 'Nueva conversación';

  @override
  String get aiSessionActive => 'Activa';

  @override
  String get aiSessionSummarized => 'Resumida';

  @override
  String get aiSessionEmpty => 'No hay conversaciones anteriores';

  @override
  String get aiSessionResume => 'Reanudar';

  @override
  String get aiSessionLoadError =>
      'No se pudo cargar el historial de conversaciones';

  @override
  String multiSelectCount(int count) {
    return '$count seleccionados';
  }

  @override
  String get multiSelectEmpty => 'Ningún mensaje seleccionado';

  @override
  String get multiSelectCancel => 'Cancelar';

  @override
  String multiSelectTypeWarning(String type) {
    return 'Estás seleccionando $type. Solo puedes seleccionar un tipo.';
  }

  @override
  String multiDeleted(int count) {
    return '$count mensajes eliminados';
  }

  @override
  String multiRecalled(int count) {
    return '$count mensajes retirados';
  }

  @override
  String get multiForwardHint => 'Selecciona un solo mensaje para reenviar';

  @override
  String get msgTypeText => 'texto';

  @override
  String get msgTypeImage => 'fotos/videos';

  @override
  String get msgTypeFile => 'archivos';

  @override
  String get selectMessages => 'Seleccionar mensajes';

  @override
  String get removeAttachment => 'Quitar';

  @override
  String get addMore => 'Añadir';

  @override
  String get attachHdOn => 'HD — alta calidad';

  @override
  String get attachHdOff => 'SD — comprimido';

  @override
  String get hdOn => 'HD sí';

  @override
  String get hdOff => 'HD no';

  @override
  String get videoCannotPlay => 'No se puede reproducir el video';

  @override
  String get aiContextTitle => 'Contexto de IA';

  @override
  String get aiContextIdentityTitle => 'Identidad y organización';

  @override
  String get aiContextResponseStyleTitle => 'Estilo de respuesta';

  @override
  String get aiContextLearnedFactsTitle => 'Lo que la IA ha aprendido';

  @override
  String get aiContextCompanyTitle => 'Contexto de la empresa';

  @override
  String get aiContextDepartmentTitle => 'Contexto del departamento';

  @override
  String get aiContextLabelRole => 'Rol';

  @override
  String get aiContextLabelDepartment => 'Departamento';

  @override
  String get aiContextLabelJobTitle => 'Puesto';

  @override
  String get aiContextLabelProjects => 'Proyectos';

  @override
  String get aiContextRoleUnknown => 'Sin asignar';

  @override
  String get aiContextNoDepartment => 'Sin departamento';

  @override
  String get aiContextNotSet => 'No establecido';

  @override
  String get aiContextIdentityManaged =>
      'Estos datos los define su responsable o administrador.';

  @override
  String get aiContextStyleLabel => 'Estilo de respuesta preferido';

  @override
  String get aiContextStyleHint => 'p. ej. conciso, formal, primero el código';

  @override
  String get aiContextPreferencesLabel => 'Otras preferencias';

  @override
  String get aiContextPreferencesHint =>
      'p. ej. evitar emojis, responder en español';

  @override
  String get aiContextUpdate => 'Actualizar';

  @override
  String get aiContextSaving => 'Guardando...';

  @override
  String get aiContextStyleSaved => 'Estilo de respuesta actualizado';

  @override
  String get aiContextSaveError => 'No se pudo guardar';

  @override
  String get aiContextKeyFacts => 'Datos clave:';

  @override
  String get aiContextMemoryEmpty => 'Aún no ha aprendido nada';

  @override
  String get aiContextMemoryEmptyHint =>
      'A medida que conversa, el asistente recordará aquí datos útiles sobre usted.';

  @override
  String get aiContextTierPublic => 'Público';

  @override
  String get aiContextTierInternal => 'Interno';

  @override
  String get aiContextTierConfidential => 'Confidencial';

  @override
  String get adminEditAiContext => 'Editar contexto de IA';

  @override
  String get adminAiContextJobTitle => 'Puesto';

  @override
  String get adminAiContextProjects => 'Proyectos actuales';

  @override
  String get adminAiContextProjectsHint => 'Un proyecto por línea';

  @override
  String get adminAiContextEntriesTitle => 'Contexto de IA de la empresa';

  @override
  String get adminAiContextEntriesEmpty => 'Aún no hay entradas de contexto.';

  @override
  String get adminEntryLabel => 'Etiqueta';

  @override
  String get adminEntryText => 'Contexto';

  @override
  String get adminEntryTier => 'Sensibilidad';

  @override
  String get adminEntryScope => 'Alcance';

  @override
  String get adminScopeCompany => 'Empresa';

  @override
  String get adminScopeDepartment => 'Departamento';

  @override
  String get adminCreateEntry => 'Añadir entrada';

  @override
  String get adminEditEntry => 'Editar entrada';

  @override
  String get adminDeleteEntry => 'Eliminar entrada';

  @override
  String get loginInviteOnlyHint =>
      'PON funciona solo por invitación. Pide una invitación a tu administrador.';

  @override
  String get loginHaveInviteLink => '¿Tienes un enlace de invitación?';

  @override
  String get inviteLinkDialogTitle => 'Abrir una invitación';

  @override
  String get inviteLinkDialogHint =>
      'Pega el enlace de invitación de tu correo';

  @override
  String get inviteLinkInvalid =>
      'Esto no parece un enlace de invitación válido.';

  @override
  String get inviteOpen => 'Abrir';

  @override
  String get inviteCancel => 'Cancelar';

  @override
  String get inviteRetry => 'Reintentar';

  @override
  String get inviteTitle => 'Has recibido una invitación';

  @override
  String inviteSubtitle(String inviter, String workspace, String role) {
    return '$inviter te invitó a unirte a $workspace como $role';
  }

  @override
  String inviteSubtitleNoRole(String inviter, String workspace) {
    return '$inviter te invitó a unirte a $workspace';
  }

  @override
  String get inviteContinueWithGoogle => 'Continuar con Google';

  @override
  String inviteGoogleHint(String email) {
    return 'Usa la cuenta de Google de $email';
  }

  @override
  String get inviteOrSetPassword => 'o crea una contraseña';

  @override
  String get inviteSubmit => 'Crear cuenta';

  @override
  String get inviteInvalidTitle => 'Invitación no válida';

  @override
  String get inviteInvalidBody =>
      'Este enlace de invitación no es válido. Revisa el enlace de tu correo o pide una nueva invitación a tu administrador.';

  @override
  String get inviteExpiredTitle => 'Invitación caducada';

  @override
  String get inviteExpiredBody =>
      'Esta invitación ha caducado. Pide a tu administrador que la reenvíe.';

  @override
  String get inviteRevokedTitle => 'Invitación revocada';

  @override
  String get inviteRevokedBody => 'Tu administrador revocó esta invitación.';

  @override
  String get inviteAcceptedTitle => 'Ya aceptada';

  @override
  String get inviteAcceptedBody =>
      'Esta invitación ya fue aceptada. Inicia sesión para continuar.';

  @override
  String get inviteLoadFailedTitle => 'No se pudo cargar la invitación';

  @override
  String get inviteBackToLogin => 'Volver a iniciar sesión';

  @override
  String get authMsgInvitationAccepted => 'Invitación aceptada. ¡Bienvenido!';

  @override
  String get authErrAccountNotProvisioned =>
      'La cuenta que elegiste aún no tiene acceso a PON. Prueba con otra cuenta o pide una invitación a tu administrador.';

  @override
  String get authErrAccountBlocked =>
      'Esta cuenta ha sido bloqueada. Contacta con tu administrador.';

  @override
  String get authErrInvitationPending =>
      'Tienes una invitación pendiente. Abre el enlace de invitación de tu correo para terminar la configuración.';

  @override
  String get authErrInvitationInvalid =>
      'Este enlace de invitación no es válido.';

  @override
  String get authErrInvitationExpired =>
      'Esta invitación ha caducado. Pide a tu administrador que la reenvíe.';

  @override
  String get authErrInvitationRevoked => 'Esta invitación fue revocada.';

  @override
  String get authErrInvitationAlreadyAccepted =>
      'Esta invitación ya fue aceptada. Inicia sesión.';

  @override
  String get authErrInvitationEmailMismatch =>
      'Inicia sesión con la cuenta de Google que coincide con el correo invitado.';

  @override
  String get authErrInvitationAlreadyPending =>
      'Este correo ya tiene una invitación pendiente.';

  @override
  String get authErrInvitationNotPending =>
      'Esta invitación ya no está pendiente.';

  @override
  String get authErrInvitationNotFound => 'Invitación no encontrada.';

  @override
  String authErrInvitationResendCooldown(int ttl) {
    return 'Espera $ttl s antes de reenviar.';
  }

  @override
  String get authErrMemberAlreadyExists =>
      'Ya existe un miembro con este correo.';

  @override
  String get authErrMemberNotFound => 'Miembro no encontrado.';

  @override
  String get authErrRoleNotFound => 'Rol no encontrado.';

  @override
  String get authErrDepartmentNotFound => 'Departamento no encontrado.';

  @override
  String get authErrOwnerRoleAssignForbidden =>
      'Solo un Propietario puede otorgar el rol de Propietario o cambiar el rol de un Propietario.';

  @override
  String get authErrCannotChangeOwnRole => 'No puedes cambiar tu propio rol.';

  @override
  String get authErrLastOwnerCannotBeDemoted =>
      'No se puede degradar al último Propietario. Primero asigna el rol de Propietario a otro miembro.';

  @override
  String get authErrCannotBlockSelf => 'No puedes bloquear tu propia cuenta.';

  @override
  String get authErrOwnerBlockForbidden =>
      'Solo un Owner puede bloquear a otro Owner.';

  @override
  String get authErrLastOwnerCannotBeBlocked =>
      'No se puede bloquear al último Owner.';

  @override
  String get authErrSsoDisabled =>
      'El inicio de sesión único está desactivado.';

  @override
  String get authErrSsoDomainNotAllowed =>
      'Tu dominio de correo no está permitido para SSO.';

  @override
  String get adminInviteMember => 'Invitar miembro';

  @override
  String get adminInviteTitle => 'Invitar a un miembro';

  @override
  String get adminInviteEmail => 'Correo electrónico';

  @override
  String get adminInviteRole => 'Rol';

  @override
  String get adminInviteDepartments => 'Departamentos';

  @override
  String get adminInviteSubmit => 'Enviar invitación';

  @override
  String get adminInviteSent => 'Invitación enviada';

  @override
  String get adminInviteEmailFailed =>
      'Invitación creada, pero no se pudo enviar el correo. Revisa la configuración de correo y reenvíala.';

  @override
  String get adminPendingInvitations => 'Invitaciones pendientes';

  @override
  String get adminInviteStatusPending => 'Pendiente';

  @override
  String get adminInviteStatusExpired => 'Caducada';

  @override
  String adminInviteExpires(String date) {
    return 'Caduca el $date';
  }

  @override
  String adminInviteInvitedBy(String name) {
    return 'Invitado por $name';
  }

  @override
  String get adminInviteResend => 'Reenviar';

  @override
  String get adminInviteResent => 'Invitación reenviada';

  @override
  String get adminInviteRevoke => 'Revocar';

  @override
  String adminInviteRevokeConfirm(String email) {
    return '¿Revocar la invitación de $email? El enlace dejará de funcionar.';
  }

  @override
  String get adminInviteRevoked => 'Invitación revocada';

  @override
  String get adminMemberStatusBlocked => 'Bloqueado';

  @override
  String get adminMemberBlock => 'Bloquear';

  @override
  String get adminMemberUnblock => 'Desbloquear';

  @override
  String adminMemberBlockConfirm(String name) {
    return '¿Bloquear a $name? Se cerrará su sesión en todos los dispositivos.';
  }

  @override
  String adminMemberUnblockConfirm(String name) {
    return '¿Desbloquear a $name? Podrá volver a iniciar sesión.';
  }

  @override
  String get adminMemberBlocked => 'Miembro bloqueado';

  @override
  String get adminMemberUnblocked => 'Miembro desbloqueado';

  @override
  String get adminLoadFailed =>
      'No se pudo cargar esta sección. Inténtalo de nuevo.';

  @override
  String callDeclined(String name) {
    return '$name rechazó la llamada';
  }

  @override
  String callBusy(String name) {
    return '$name está en otra llamada';
  }

  @override
  String callPeerMediaError(String name) {
    return '$name no pudo activar su micrófono o cámara';
  }

  @override
  String get callEnded => 'Llamada finalizada';

  @override
  String get callConnectionLost =>
      'La llamada se cortó por pérdida de conexión';

  @override
  String get callSpeaker => 'Altavoz';

  @override
  String get callSwitchCamera => 'Cambiar cámara';

  @override
  String get callHangUp => 'Colgar';

  @override
  String get callReconnecting => 'Reconectando…';

  @override
  String get callPoorConnection => 'Conexión débil';

  @override
  String get aiContextLearnedFactsLoadError =>
      'No se pudo cargar lo que el asistente ha aprendido.';

  @override
  String get errTooManyRequests =>
      'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.';

  @override
  String get removedFromConversation =>
      'Ya no eres miembro de esta conversación';

  @override
  String get errGroupAdminRequired =>
      'Solo los administradores del grupo pueden hacer esto';

  @override
  String get errChatUserBlocked => 'No puedes enviar mensajes a esta persona';

  @override
  String get errReplyTargetInvalid =>
      'El mensaje al que respondiste ya no está disponible';

  @override
  String get errMessageTypeNotAllowed =>
      'Este tipo de mensaje no se puede enviar aquí';

  @override
  String get errInvalidUrl => 'No se puede previsualizar este enlace';

  @override
  String get errNotAGroup => 'Esto solo funciona en chats de grupo';

  @override
  String get errNotAMember => 'Esta persona ya no está en el grupo';

  @override
  String get errLastAdminCannotBeRemoved =>
      'Un grupo necesita al menos un administrador';

  @override
  String get errPublicDepartmentChannel =>
      'Un grupo de departamento no puede ser un canal público';

  @override
  String get publicChannelToggle => 'Canal público';

  @override
  String get publicChannelHint =>
      'Cualquiera del espacio de trabajo puede encontrarlo en Explorar y unirse';

  @override
  String get groupMakeAdmin => 'Hacer administrador';

  @override
  String get groupRemoveAdmin => 'Quitar como administrador';

  @override
  String get aiErrEmptyResponse =>
      'El asistente no generó una respuesta. Inténtalo de nuevo.';

  @override
  String get sysGroupCreatedNoActor => 'Grupo creado';

  @override
  String get sysMembersAddedNoActor => 'Se añadieron nuevos miembros';

  @override
  String get sysMemberLeftNoActor => 'Un miembro salió del grupo';

  @override
  String get sysMemberRemovedNoActor => 'Se eliminó a un miembro';

  @override
  String get sysMemberJoinedNoActor => 'Se unió un nuevo miembro';

  @override
  String get sysAutoDeleteOff => 'Mensajes temporales desactivados';

  @override
  String sysAutoDeleteOn(String duration) {
    return 'Mensajes temporales configurados en $duration';
  }

  @override
  String sysAutoDeleteOffBy(String actorName) {
    return '$actorName desactivó los mensajes temporales';
  }

  @override
  String sysAutoDeleteOnBy(String actorName, String duration) {
    return '$actorName configuró los mensajes temporales en $duration';
  }

  @override
  String sysAdminPromoted(String targetName) {
    return '$targetName ahora es administrador';
  }

  @override
  String sysAdminDemoted(String targetName) {
    return '$targetName ya no es administrador';
  }

  @override
  String sysAdminPromotedBy(String actorName, String targetName) {
    return '$actorName nombró administrador a $targetName';
  }

  @override
  String sysAdminDemotedBy(String actorName, String targetName) {
    return '$actorName quitó a $targetName como administrador';
  }

  @override
  String durationSeconds(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count segundos',
      one: '1 segundo',
    );
    return '$_temp0';
  }

  @override
  String durationMinutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count minutos',
      one: '1 minuto',
    );
    return '$_temp0';
  }

  @override
  String durationHours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count horas',
      one: '1 hora',
    );
    return '$_temp0';
  }

  @override
  String durationDays(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count días',
      one: '1 día',
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
    return '$count d';
  }

  @override
  String get authErrUserBlocked =>
      'No disponible: uno de los dos ha bloqueado al otro';

  @override
  String get authErrCurrentPasswordRequired => 'Introduce tu contraseña actual';

  @override
  String get authErrSsoEmailUnverified =>
      'Tu proveedor de inicio de sesión no ha verificado este correo';

  @override
  String get authErrSocialAccountConflict =>
      'Este correo ya está vinculado a otra cuenta de inicio de sesión';

  @override
  String get aiActionConfirm => 'Confirmar';

  @override
  String get aiActionCancel => 'Cancelar';

  @override
  String get aiActionSendEmail => 'Enviar correo';

  @override
  String get aiActionDraftEmail => 'Borrador de correo';

  @override
  String get aiActionCreateEvent => 'Crear evento de calendario';

  @override
  String get aiActionUpdateEvent => 'Actualizar evento de calendario';

  @override
  String get aiActionCreatePage => 'Crear página';

  @override
  String get aiActionUpdatePage => 'Actualizar página';

  @override
  String get aiActionGeneric => 'Ejecutar una acción';

  @override
  String aiActionGenericNamed(String tool) {
    return 'Ejecutar «$tool»';
  }

  @override
  String aiActionVia(String connector) {
    return 'mediante $connector';
  }

  @override
  String aiActionWaitingFor(String name) {
    return 'Esperando a que $name confirme';
  }

  @override
  String get aiActionFieldTo => 'Para';

  @override
  String get aiActionFieldSubject => 'Asunto';

  @override
  String get aiActionFieldTitle => 'Título';

  @override
  String get aiActionFieldWhen => 'Cuándo';

  @override
  String get aiActionStatusConfirmed => 'Hecho';

  @override
  String get aiActionStatusCancelled => 'Cancelado';

  @override
  String get aiActionStatusFailed => 'Falló';

  @override
  String get aiActionStatusExpired => 'Caducado';

  @override
  String get aiActionStatusHandled => 'Ya gestionado';

  @override
  String get aiActionErrNotFound => 'Esta acción ya no existe';

  @override
  String get aiActionErrNotOwner => 'Solo quien lo pidió puede confirmarlo';

  @override
  String get aiActionErrAlreadyResolved => 'Esta acción ya se gestionó';

  @override
  String get aiActionErrExpired => 'Esta solicitud caducó';

  @override
  String get aiActionErrGeneric => 'No se pudo completar esta acción';

  @override
  String get aiToolWebSearch => 'Buscando en la web';

  @override
  String get aiToolRememberFact => 'Guardando en la memoria';

  @override
  String get aiToolCreateReminder => 'Creando un recordatorio';

  @override
  String get aiToolGetUserInfo => 'Buscando a un compañero';

  @override
  String get aiToolSearchKnowledgeBase => 'Buscando en la base de conocimiento';

  @override
  String get aiToolSearchMessages => 'Buscando mensajes';

  @override
  String get aiToolSummarizeConversation => 'Resumiendo la conversación';

  @override
  String aiToolOnConnector(String tool, String connector) {
    return '$tool en $connector';
  }

  @override
  String get aiTraceToolAwaiting => 'Esperando confirmación';

  @override
  String get aiTraceToolDone => 'Hecho';

  @override
  String get aiTraceToolNotRun => 'No ejecutado';

  @override
  String aiTraceTokens(String input, String output) {
    return '$input entrada · $output salida';
  }

  @override
  String aiTraceCacheTokens(String read, String written) {
    return 'caché $read leídos · $written escritos';
  }

  @override
  String aiTraceThinkingTokens(String count) {
    return '$count de razonamiento';
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
      other: '$count pasos',
      one: '1 paso',
    );
    return '$_temp0';
  }

  @override
  String get connectorGenericName => 'Conector';

  @override
  String get connectorCustomName => 'Servidor MCP personalizado';

  @override
  String get connectorReconnect => 'Reconectar';

  @override
  String get connectorStatusReconnect => 'Hay que reconectar';

  @override
  String get connectorStatusUnavailable => 'No disponible';

  @override
  String get connectorDisconnectWorkspaceConfirm =>
      '¿Desconectar este conector del espacio de trabajo? Todos perderán el acceso a sus herramientas.';

  @override
  String connectorDisconnected(String name) {
    return '$name desconectado';
  }

  @override
  String get customMcpListTitle => 'Tus servidores MCP';

  @override
  String get customMcpDelete => 'Quitar';

  @override
  String get customMcpDeleteConfirm =>
      '¿Quitar este servidor MCP? La IA dejará de usar sus herramientas.';

  @override
  String customMcpDeleted(String name) {
    return '$name quitado';
  }

  @override
  String get directoryDeleteConfirm => '¿Eliminar esta entrada del directorio?';

  @override
  String get directoryAuthOauth => 'Inicio de sesión OAuth';

  @override
  String get directoryAuthMcpOauth => 'OAuth (servidor MCP)';

  @override
  String get directoryAuthEnvOauth => 'OAuth (app del espacio de trabajo)';

  @override
  String get directoryAuthApiKey => 'Clave de API';

  @override
  String get directoryAuthNone => 'Sin inicio de sesión';

  @override
  String get scopeEmailSend => 'Enviar correos';

  @override
  String get scopeEmailDraft => 'Crear borradores';

  @override
  String get scopeEmailRead => 'Leer correos';

  @override
  String get scopeEmailManage => 'Gestionar correos';

  @override
  String get scopeCalendarRead => 'Ver el calendario';

  @override
  String get scopeCalendarEvents => 'Gestionar eventos';

  @override
  String get scopeCalendarManage => 'Gestionar calendarios';

  @override
  String get scopeFilesRead => 'Leer archivos';

  @override
  String get scopeFilesManage => 'Gestionar archivos';

  @override
  String get scopeReadContent => 'Leer contenido';

  @override
  String get scopeInsertContent => 'Añadir contenido';

  @override
  String get scopeUpdateContent => 'Editar contenido';

  @override
  String get scopeOther => 'Otros accesos';

  @override
  String get connErrUnsafeUrl =>
      'Esa dirección no está permitida. Usa una URL https pública.';

  @override
  String get connErrDiscoveryFailed =>
      'No se pudo contactar con ese servidor MCP';

  @override
  String get connErrInsufficientPermission =>
      'No tienes permiso para hacer esto';

  @override
  String get connErrNotAllowed =>
      'Este conector no está permitido en tu espacio de trabajo';

  @override
  String get connErrUnavailable => 'Este conector no está disponible ahora';

  @override
  String get connErrOauthSetup =>
      'Este conector aún no tiene configurado el inicio de sesión';

  @override
  String get connErrBotBridgeDisabled =>
      'El servicio de asistente personal no está configurado';

  @override
  String get connErrBotNotFound => 'No se encontró el asistente';

  @override
  String get connErrBotOwnerMismatch =>
      'Este asistente pertenece a otro miembro';

  @override
  String get connErrMemberInactive => 'La cuenta de este miembro está inactiva';

  @override
  String oauthConnected(String name) {
    return '$name conectado';
  }

  @override
  String oauthErrAccessDenied(String name) {
    return 'Rechazaste el acceso a $name';
  }

  @override
  String oauthErrFailed(String name) {
    return 'No se pudo conectar $name';
  }

  @override
  String oauthNotCompleted(String name) {
    return 'La conexión con $name no se completó';
  }

  @override
  String get oauthErrExpired =>
      'El inicio de sesión tardó demasiado. Inténtalo de nuevo.';

  @override
  String get tokenUsageDailyChartTitle => 'Uso diario';

  @override
  String get tokenUsageTotalInRange => 'Total del periodo seleccionado';

  @override
  String get tokenUsageQuotaBlocked =>
      'La IA está desactivada en este espacio de trabajo';

  @override
  String get tokenUsageQuotaExceeded => 'Se alcanzó el límite mensual de IA';

  @override
  String tokenUsageQuotaResets(String date) {
    return 'Se restablece el $date';
  }

  @override
  String authErrRoleGrantExceedsOwnPermissions(String capabilities) {
    return 'No puedes conceder permisos que tú no tienes: $capabilities.';
  }

  @override
  String get authErrRoleGrantExceedsOwnPermissionsGeneric =>
      'No puedes conceder permisos que tú no tienes.';

  @override
  String get authErrCannotEditOwnRole => 'No puedes editar tu propio rol.';

  @override
  String get authErrPresetRoleRenameForbidden =>
      'Los roles predefinidos no se pueden renombrar.';

  @override
  String get authErrRoleNameTaken => 'Ya existe un rol con este nombre.';

  @override
  String get authErrOwnerRoleImmutable =>
      'El rol Owner no se puede modificar ni eliminar.';

  @override
  String get authErrOwnerSsoMappingForbidden =>
      'Solo un Owner puede asignar grupos SSO al rol Owner.';

  @override
  String get authErrInsufficientPermission =>
      'No tienes permiso para hacer esto.';

  @override
  String get authErrAiContextEntryNotFound =>
      'Esta entrada de contexto ya no existe.';

  @override
  String get authErrAiConnectorsNotInAllowList =>
      'Los conectores de IA seleccionados también deben estar permitidos en la lista de conectores del espacio de trabajo.';

  @override
  String authErrPasswordTooShortMin(int min) {
    return 'La contraseña debe tener al menos $min caracteres.';
  }

  @override
  String get adminCapManageAiContext => 'Gestionar el contexto de IA';

  @override
  String get adminCapViewInternalContext => 'Ver el contexto interno';

  @override
  String get adminCapViewConfidentialContext => 'Ver el contexto confidencial';

  @override
  String get adminCapUnknown => 'Otro permiso';

  @override
  String get adminAuditSystem => 'Sistema';

  @override
  String get adminAuditFormerMember => 'Un antiguo miembro';

  @override
  String get adminAuditActionOther => 'Otra acción';

  @override
  String get adminAuditActionWorkspaceUpdate =>
      'Espacio de trabajo actualizado';

  @override
  String get adminAuditActionDepartmentCreate => 'Departamento creado';

  @override
  String get adminAuditActionDepartmentUpdate => 'Departamento actualizado';

  @override
  String get adminAuditActionDepartmentDelete => 'Departamento eliminado';

  @override
  String get adminAuditActionMemberUpdate => 'Miembro actualizado';

  @override
  String get adminAuditActionMemberSsoUpdate => 'Miembro actualizado por SSO';

  @override
  String get adminAuditActionMemberBlock => 'Miembro bloqueado';

  @override
  String get adminAuditActionMemberUnblock => 'Miembro desbloqueado';

  @override
  String get adminAuditActionRoleCreate => 'Rol creado';

  @override
  String get adminAuditActionRoleUpdate => 'Rol actualizado';

  @override
  String get adminAuditActionInvitationCreate => 'Invitación enviada';

  @override
  String get adminAuditActionInvitationResend => 'Invitación reenviada';

  @override
  String get adminAuditActionInvitationRevoke => 'Invitación revocada';

  @override
  String get adminAuditActionInvitationAccept => 'Invitación aceptada';

  @override
  String get adminAuditActionConnectorConnect => 'Conector conectado';

  @override
  String get adminAuditActionConnectorDisconnect => 'Conector desconectado';

  @override
  String get adminAuditActionConnectorReplace => 'Conector reconectado';

  @override
  String get adminAuditActionConnectionPermissionsUpdate =>
      'Permisos del conector actualizados';

  @override
  String get adminAuditActionCustomMcpAdd => 'MCP personalizado añadido';

  @override
  String get adminAuditActionCustomMcpDelete => 'MCP personalizado eliminado';

  @override
  String get adminAuditActionDirectoryCreate => 'Entrada de directorio añadida';

  @override
  String get adminAuditActionDirectoryUpdate =>
      'Entrada de directorio actualizada';

  @override
  String get adminAuditActionDirectoryDelete =>
      'Entrada de directorio eliminada';

  @override
  String get adminAuditActionSensitiveSkillRun =>
      'Habilidad sensible ejecutada';

  @override
  String get adminAuditTargetWorkspace => 'Espacio de trabajo';

  @override
  String get adminAuditTargetMember => 'Un miembro';

  @override
  String get adminAuditTargetRole => 'Un rol';

  @override
  String get adminAuditTargetDepartment => 'Un departamento';

  @override
  String get adminAuditTargetInvitation => 'Una invitación';

  @override
  String get adminAuditTargetConnector => 'Un conector';

  @override
  String get adminAuditTargetDirectoryEntry => 'Una entrada de directorio';

  @override
  String get adminAuditTargetTool => 'Una herramienta';

  @override
  String get adminAuditTargetOther => 'Otro elemento';

  @override
  String get adminAiConnectorsAllAllowed =>
      'La lista de permitidos del espacio de trabajo está vacía, así que se permiten todos los conectores. Elige los que puede usar la IA.';

  @override
  String get errAssistantSetupIncomplete =>
      'Añade una personalidad y elige un modelo para terminar de configurar tu asistente.';

  @override
  String get errAssistantNotConfigured =>
      'Los asistentes personales aún no están disponibles en este espacio de trabajo. Consulta a tu administrador.';

  @override
  String get errAssistantUpstreamFailed =>
      'El servicio del asistente no respondió. Inténtalo de nuevo en un momento.';

  @override
  String adminBotOwnedBy(String name) {
    return 'Propiedad de $name';
  }

  @override
  String adminRoleCloneDefaultName(String name) {
    return 'Copia de $name';
  }

  @override
  String get setPasswordTitle => 'Crea tu contraseña de PON';

  @override
  String get setPasswordSubtitle =>
      'Te uniste con Google. Crea una contraseña para poder iniciar sesión también con tu correo electrónico.';

  @override
  String get setPasswordSubmit => 'Crear contraseña';

  @override
  String get setPasswordSuccess =>
      'Contraseña creada. Ahora también puedes iniciar sesión con tu correo electrónico.';

  @override
  String get mfaVerifyTitle => 'Autenticación de dos factores';

  @override
  String get mfaVerifySubtitle =>
      'Introduce el código de 6 dígitos de tu app de autenticación para terminar de iniciar sesión.';

  @override
  String get mfaBackupSubtitle =>
      'Introduce uno de tus códigos de respaldo (XXXXX-XXXXX). Cada código solo funciona una vez.';

  @override
  String get mfaCodeLabel => 'Código de 6 dígitos';

  @override
  String get mfaBackupCodeLabel => 'Código de respaldo';

  @override
  String get mfaVerifyButton => 'Verificar';

  @override
  String get mfaUseBackupCode => 'Usar un código de respaldo';

  @override
  String get mfaUseAuthenticatorCode => 'Usar tu app de autenticación';

  @override
  String get mfaBackToSignIn => 'Volver a iniciar sesión';

  @override
  String mfaBackupCodeUsed(int remaining) {
    return 'Código de respaldo usado. Quedan $remaining código(s).';
  }

  @override
  String get valMfaCodeInvalid => 'Introduce el código de 6 dígitos.';

  @override
  String get valMfaBackupCodeInvalid =>
      'Introduce un código de respaldo como ABCDE-FGHIJ.';

  @override
  String get mfaEnrollTitle => 'Configura la autenticación de dos factores';

  @override
  String get mfaEnrollSubtitle =>
      'Tu rol requiere un código de una app de autenticación cada vez que inicies sesión.';

  @override
  String get mfaEnrollStepInstall =>
      '1. Instala Google Authenticator (u otra app de autenticación).';

  @override
  String get mfaEnrollStepScan =>
      '2. Escanea este código QR, ábrelo en la app o introduce la clave de configuración.';

  @override
  String get mfaEnrollStepCode =>
      '3. Introduce el código de 6 dígitos que muestra la app.';

  @override
  String get mfaEnrollOpenApp => 'Abrir en la app de autenticación';

  @override
  String get mfaEnrollNoApp =>
      'No se encontró ninguna app de autenticación. Instala Google Authenticator o introduce la clave de configuración manualmente.';

  @override
  String get mfaEnrollManualKey => 'Clave de configuración';

  @override
  String get mfaCopyKey => 'Copiar clave';

  @override
  String get mfaKeyCopied => 'Clave de configuración copiada';

  @override
  String get mfaQrSemantic => 'Código QR para tu app de autenticación';

  @override
  String get mfaEnrollConfirm => 'Confirmar';

  @override
  String get mfaBackupCodesTitle => 'Guarda tus códigos de respaldo';

  @override
  String get mfaBackupCodesSubtitle =>
      'Cada código te permite iniciar sesión una vez si pierdes tu teléfono. No se volverán a mostrar, así que guárdalos en un lugar seguro.';

  @override
  String get mfaCopyCodes => 'Copiar códigos';

  @override
  String get mfaCodesCopied => 'Códigos de respaldo copiados';

  @override
  String get mfaSavedCheckbox => 'He guardado mis códigos de respaldo';

  @override
  String get mfaContinue => 'Continuar';

  @override
  String get securityMfaOn =>
      'Se requiere un código de tu app de autenticación cada vez que inicias sesión.';

  @override
  String get securityMfaPending =>
      'Obligatoria para tu rol. La configurarás en tu próximo inicio de sesión.';

  @override
  String get securityMfaStatusOn => 'Activada';

  @override
  String get securityMfaStatusOff => 'Sin configurar';

  @override
  String get securityMfaRegenerate => 'Regenerar códigos de respaldo';

  @override
  String get securityMfaRegenerateHint =>
      'Introduce un código actual de tu app de autenticación. Tus códigos de respaldo anteriores dejarán de funcionar.';

  @override
  String get securityMfaRegenerateSubmit => 'Generar';

  @override
  String get securityMfaDone => 'Listo';

  @override
  String get adminMfaBadge => '2FA activada';

  @override
  String get adminMfaReset => 'Restablecer 2FA';

  @override
  String adminMfaResetConfirm(String name) {
    return '¿Restablecer la autenticación de dos factores de $name? Se cerrará su sesión en todos los dispositivos y deberá configurarla de nuevo en su próximo inicio de sesión.';
  }

  @override
  String get adminMfaResetDone =>
      '2FA restablecida. La configurará de nuevo en su próximo inicio de sesión.';

  @override
  String get authMsgMfaRequired =>
      'Introduce el código de tu app de autenticación para terminar de iniciar sesión.';

  @override
  String get authErrMfaTokenInvalid =>
      'Tu inicio de sesión ha caducado. Vuelve a iniciar sesión.';

  @override
  String get authErrMfaCodeInvalid => 'Código incorrecto. Inténtalo de nuevo.';

  @override
  String authErrMfaCodeInvalidRemaining(int remaining) {
    return 'Código incorrecto. Quedan $remaining intento(s).';
  }

  @override
  String get authErrMfaTooManyAttempts =>
      'Demasiados códigos incorrectos. Vuelve a iniciar sesión.';

  @override
  String get authErrMfaNotEnrolled =>
      'Esta cuenta aún no tiene configurada la autenticación de dos factores.';

  @override
  String get authErrMfaAlreadyEnrolled =>
      'Esta cuenta ya tiene configurada la autenticación de dos factores.';

  @override
  String get authErrMfaResetForbidden =>
      'Solo un Propietario puede restablecer la autenticación de dos factores.';

  @override
  String get authErrMfaResetSelfForbidden =>
      'No puedes restablecer tu propia autenticación de dos factores.';

  @override
  String get adminCapHostMeeting => 'Organizar reuniones';

  @override
  String get meetingErrNotFound => 'Esta reunión no existe';

  @override
  String get meetingErrForbidden => 'No puedes hacer eso en esta reunión';

  @override
  String get meetingErrCreateForbidden => 'Tu rol no puede organizar reuniones';

  @override
  String get meetingErrDepartmentForbidden =>
      'No puedes crear una reunión para ese departamento';

  @override
  String get meetingErrRemoved => 'Te han expulsado de esta reunión';

  @override
  String get meetingErrLocked => 'Esta reunión está bloqueada';

  @override
  String get meetingErrEnded => 'Esta reunión ha terminado';

  @override
  String meetingErrFull(int max) {
    return 'Esta reunión está llena ($max personas)';
  }

  @override
  String get meetingErrNotCancellable =>
      'Alguien ya se ha unido, así que no se puede cancelar';

  @override
  String get meetingErrUnavailable =>
      'Las reuniones no están disponibles en este momento. Inténtalo de nuevo en breve.';

  @override
  String get meetingErrNotesReadOnly =>
      'Solo los organizadores pueden editar las notas compartidas';

  @override
  String get meetingErrNoteConflict =>
      'Alguien guardó una versión más reciente';

  @override
  String get meetingErrRateLimited =>
      'Estás enviando demasiado rápido. Espera un momento.';

  @override
  String meetingErrChatTooLong(int max) {
    return 'Los mensajes pueden tener como máximo $max caracteres';
  }

  @override
  String meetingErrNoteTooLong(int max) {
    return 'Las notas pueden tener como máximo $max caracteres';
  }

  @override
  String get meetingErrInviteeInvalid =>
      'Alguien de la lista no se puede invitar';

  @override
  String get meetingErrDepartmentInvalid =>
      'Ese departamento no está disponible';

  @override
  String get meetingErrStartInvalid => 'La hora de inicio no es válida';

  @override
  String get meetingErrEndInvalid =>
      'La reunión debe terminar después de empezar y en un plazo de 24 horas';

  @override
  String get meetingErrTargetUnavailable =>
      'Esa persona ya no está en la reunión';

  @override
  String get meetingErrInvalid => 'Algo en la solicitud no es válido';

  @override
  String get meetingErrNetwork =>
      'No se puede conectar con el servidor. Comprueba tu conexión.';

  @override
  String get meetingErrGeneric => 'Algo salió mal. Inténtalo de nuevo.';

  @override
  String meetingValTitleTooLong(int max) {
    return 'El título puede tener como máximo $max caracteres';
  }

  @override
  String meetingValDescriptionTooLong(int max) {
    return 'La descripción puede tener como máximo $max caracteres';
  }

  @override
  String meetingValTooManyInvitees(int max) {
    return 'Puedes invitar como máximo a $max personas';
  }

  @override
  String get meetingValStartPast => 'Elige una hora en el futuro';

  @override
  String get meetingValScheduleInvalid => 'Elige una fecha y hora válidas';

  @override
  String get meetingUntitled => 'Reunión';

  @override
  String get meetingSomeone => 'Alguien';

  @override
  String get meetingParticipantFallback => 'Participante';

  @override
  String get meetingYou => 'Tú';

  @override
  String get meetingRoleHost => 'Organizador';

  @override
  String get meetingRoleCohost => 'Coorganizador';

  @override
  String get meetingRoleAttendee => 'Participante';

  @override
  String get meetingStatusLive => 'En curso';

  @override
  String get meetingStatusScheduled => 'Programada';

  @override
  String get meetingStatusEnded => 'Finalizada';

  @override
  String get meetingStatusCancelled => 'Cancelada';

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
      other: '$count horas',
      one: '$count hora',
    );
    return '$_temp0';
  }

  @override
  String meetingDurationHoursMinutes(int hours, int minutes) {
    return '$hours h $minutes min';
  }

  @override
  String get meetingRealtimeOffline =>
      'El chat, las manos levantadas y los controles del organizador están en pausa hasta que vuelvas a estar en línea';

  @override
  String meetingMutedBy(String name) {
    return '$name ha silenciado tu micrófono';
  }

  @override
  String get meetingMutedByUnknown =>
      'Un organizador ha silenciado tu micrófono';

  @override
  String get meetingMadeCohost => 'Ahora eres coorganizador';

  @override
  String get meetingRevokedCohost => 'Ya no eres coorganizador';

  @override
  String get meetingEndedToast => 'La reunión ha terminado';

  @override
  String get meetingMediaFailed =>
      'No se pudo activar el micrófono o la cámara';

  @override
  String get meetingShareRevoked =>
      'El organizador ha desactivado la presentación de pantalla';

  @override
  String get meetingShareFailed => 'No se pudo empezar a presentar';

  @override
  String meetingLobbyWaiting(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count personas están esperando para entrar',
      one: '$count persona está esperando para entrar',
    );
    return '$_temp0';
  }

  @override
  String get meetingNotifInvitedTitle => 'Invitación a una reunión';

  @override
  String meetingNotifInvitedBody(String name, String title) {
    return '$name te invitó a «$title»';
  }

  @override
  String meetingNotifInvitedBodyAt(String name, String title, String time) {
    return '$name te invitó a «$title» el $time';
  }

  @override
  String get meetingNotifStartingTitle => 'La reunión empieza pronto';

  @override
  String meetingNotifStartingBody(String title, String time) {
    return '«$title» empieza a las $time';
  }

  @override
  String meetingNotifCancelled(String title) {
    return '«$title» se ha cancelado';
  }

  @override
  String get meetingNotifCancelledUnknown =>
      'Se canceló una reunión a la que te invitaron';
}
