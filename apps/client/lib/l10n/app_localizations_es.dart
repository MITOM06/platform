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
  String get searchConversationsHint => 'Search conversations...';

  @override
  String get noConversationsFound => 'No conversations found';

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
  String get endToEndEncrypted => 'Cifrado de extremo a extremo';

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
  String get avatarUploadLabel => 'Change avatar';

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
}
