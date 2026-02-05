import { StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

const authStyles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        backgroundColor: Colors.background, // Dùng màu nền sáng
        padding: Spacing.m,
    },
    root: {
        alignItems: 'center',
        padding: Spacing.m,
        maxWidth: 700,
        width: '100%',
        alignSelf: 'center',
        backgroundColor: Colors.white, // Card nền trắng
        borderRadius: Spacing.borderRadiusLarge, // Bo góc lớn
        // Đổ bóng nhẹ cho card đăng nhập
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5,
    },
    logo: {
        width: '70%',
        maxWidth: 250,
        marginBottom: Spacing.l,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.textHeader,
        marginBottom: Spacing.l,
        textAlign: 'center',
    },
    inputWrapper: {
        width: '100%',
        marginBottom: Spacing.s,
    },
    forgotContainer: {
        alignSelf: 'flex-end',
        marginVertical: Spacing.xs,
    },
    errorText: {
        color: Colors.error,
        fontSize: 12,
        marginLeft: 5,
        marginTop: 4,
    },
    errorTextCenter: {
        color: Colors.error,
        fontSize: 14,
        marginBottom: Spacing.m,
        fontWeight: '600',
        textAlign: 'center',
        backgroundColor: '#FFF0F0',
        padding: 10,
        borderRadius: 8,
        width: '100%',
    },
    // Divider "Hoặc"
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.l,
        width: '100%',
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.border,
    },
    dividerText: {
        paddingHorizontal: Spacing.m,
        color: Colors.textSub,
        fontSize: 14,
        fontWeight: '500',
    },
    // Link text
    footerText: {
        color: Colors.textSub,
        textAlign: 'center',
        fontSize: 14,
        marginTop: Spacing.s,
    },
    link: {
        color: Colors.accent,
        fontWeight: 'bold',
    },
});

export default authStyles;