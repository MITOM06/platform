package com.platform.chatservice.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.ByteArrayInputStream;
import java.util.Base64;

@Configuration
public class FirebaseConfig {

    @Value("${app.firebase.service-account-base64:}")
    private String serviceAccountBase64;

    @Bean
    public FirebaseApp firebaseApp() {
        try {
            if (serviceAccountBase64 == null || serviceAccountBase64.trim().isEmpty()) {
                System.out.println("Firebase service account not provided. FCM will be disabled.");
                return null;
            }

            byte[] decoded = Base64.getDecoder().decode(serviceAccountBase64);
            FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(new ByteArrayInputStream(decoded)))
                .build();

            if (FirebaseApp.getApps().isEmpty()) {
                return FirebaseApp.initializeApp(options);
            }
            return FirebaseApp.getInstance();
        } catch (Exception e) {
            System.err.println("Failed to initialize FirebaseApp: " + e.getMessage());
            return null;
        }
    }
}
