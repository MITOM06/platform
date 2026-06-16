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
    return 'I agree to the $privacyPolicy and $termsOfService';
  }

  @override
  String get privacyPolicy => 'Privacy Policy';

  @override
  String get termsOfService => 'Terms of Service';

  @override
  String get valMustAgreeTerms =>
      'You must agree to the Terms of Service to register';

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
}
