// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

  @override
  String get appName => 'PON';

  @override
  String get notificationsTitle => 'Notificaciones';

  @override
  String get notificationsEmpty => 'Aún no hay notificaciones';

  @override
  String get notificationsMarkAllRead => 'Marcar todo como leído';

  @override
  String get notificationAccept => 'Aceptar';

  @override
  String get notificationDecline => 'Rechazar';

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
  String get actionRetry => 'REINTENTAR';

  @override
  String get actionSave => 'GUARDAR';

  @override
  String get actionLogout => 'Cerrar sesión';

  @override
  String get actionDelete => 'Eliminar';

  @override
  String get actionLeave => 'Salir';

  @override
  String get loadingDots => '...';

  @override
  String errorWithMsg(String error) {
    return 'Error: $error';
  }

  @override
  String get loginTitle => 'Iniciar sesión';

  @override
  String get fieldEmail => 'Correo';

  @override
  String get fieldPassword => 'Contraseña';

  @override
  String get forgotPasswordLink => '¿Olvidaste tu contraseña?';

  @override
  String get loginButton => 'INICIAR SESIÓN';

  @override
  String get noAccountYet => '¿No tienes una cuenta? ';

  @override
  String get registerNow => 'Regístrate ahora';

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
  String get registerTitle => 'Crear cuenta';

  @override
  String get welcomeToApp => 'Bienvenido a PON';

  @override
  String get fieldDisplayName => 'Nombre visible';

  @override
  String get fieldConfirmPassword => 'Confirmar contraseña';

  @override
  String get registerButton => 'REGISTRARSE';

  @override
  String get haveAccount => '¿Ya tienes una cuenta? ';

  @override
  String get loginLink => 'Iniciar sesión';

  @override
  String get valNameRequired => 'Ingresa tu nombre';

  @override
  String get valNameMin2 => 'El nombre debe tener al menos 2 caracteres';

  @override
  String get valPasswordMismatch => 'Las contraseñas no coinciden';

  @override
  String get errEmailExists => 'Este correo ya está registrado';

  @override
  String get errRegisterFailed => 'Error al registrarse, inténtalo de nuevo';

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
  String get confirmButton => 'CONFIRMAR';

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
  String get sendOtpButton => 'ENVIAR CÓDIGO OTP';

  @override
  String get errEmailNotRegistered => 'Este correo no está registrado';

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
  String get onboardingChooseTheme => 'ELIGE UN TEMA';

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
  String get startExperience => 'EMPEZAR A EXPLORAR';

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
  String get startConversationButton => 'EMPEZAR A CHATEAR';

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
  String get searchUsers => 'Buscar por nombre o correo';

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
  String get actionReact => 'Reaccionar';

  @override
  String get messageRecalled => 'El mensaje fue retirado';

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
  String get pinLimitReached => 'Puedes fijar hasta 2 mensajes';

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
  String get aiMemory => 'Memoria';

  @override
  String get aiSkills => 'Habilidades';

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
  String get aiMemoryTitle => 'Memoria de IA';

  @override
  String get aiMemoryEmptyState =>
      'Aún no hay memorias. Chatea con PON AI para comenzar a crear memorias.';

  @override
  String get aiMemoryDeleteConfirm =>
      '¿Eliminar esta memoria? La IA ya no recordará el contexto de esta conversación.';

  @override
  String get aiMemoryDeleted => 'Memoria eliminada';

  @override
  String aiMemoryUpdated(String date) {
    return 'Actualizado el $date';
  }

  @override
  String get aiMemoryFacts => 'Datos clave:';

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
  String get registerWithGoogle => 'Registrarse con Google';

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
      'Debes aceptar los Términos del Servicio para registrarte';

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
  String get authMsgRegisterSuccess =>
      'Registro exitoso. Se ha enviado un OTP a su correo electrónico.';

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
  String get authErrEmailDomainInvalid =>
      'El dominio del correo no existe o no tiene registros MX.';

  @override
  String get authErrEmailNotFound => 'El correo no existe en el sistema.';

  @override
  String get authErrEmailInUse => 'Este correo ya está en uso.';

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
  String get customMcpAuth => 'AUTENTICACIÓN';

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
  String get skillsSettingsSubtitle => 'Elige en qué es bueno tu asistente';

  @override
  String skillNeeds(String requirements) {
    return 'Necesita $requirements';
  }

  @override
  String get skillSchedulerName => 'Planificador';

  @override
  String get skillSchedulerDesc =>
      'Agenda reuniones, encuentra huecos, envía invitaciones y recordatorios.';

  @override
  String get skillMailWriterName => 'Redactor de correos';

  @override
  String get skillMailWriterDesc =>
      'Redacta respuestas con tu estilo, resume hilos largos.';

  @override
  String get skillResearcherName => 'Investigador';

  @override
  String get skillResearcherDesc =>
      'Busca en la web y en tu Drive, devuelve respuestas con citas.';

  @override
  String get skillProjectKeeperName => 'Gestor de proyectos';

  @override
  String get skillProjectKeeperDesc =>
      'Archiva notas y tareas en Notion, mantiene las bases de datos ordenadas.';

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
}
