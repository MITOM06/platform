/// Web Push (VAPID) public key for Firebase Cloud Messaging on the **web** platform.
///
/// Bắt buộc cho `FirebaseMessaging.getToken(vapidKey: ...)` trên web. Đây là khoá
/// CÔNG KHAI (applicationServerKey), KHÔNG phải secret — an toàn để commit.
///
/// Lấy ở: Firebase Console → Project settings → Cloud Messaging →
/// "Web Push certificates" → (Generate key pair nếu chưa có) → copy "Key pair".
///
/// Để rỗng ⇒ app bỏ qua đăng ký FCM token trên web (Android/iOS không cần khoá này).
const String kFirebaseWebVapidKey =
    'BFXtvKg0AxdkYwJoSS0EusOTteRd2L_5qBacQEsozxMUpRfmNYp7PakyszG9YX2k26I9pKGQ1-AQUcPdVxaaH5E';
