import { StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

export const HomeStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textSub,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.m,
    paddingTop: Spacing.s,
    paddingBottom: Spacing.m,
    backgroundColor: Colors.background,
  },

  greeting: {
    fontSize: 14,
    color: Colors.textSub,
    marginBottom: 4,
  },

  username: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textHeader,
  },

  profileButton: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    // ✅ THÊM: Đảm bảo button có thể bấm được
    zIndex: 10,
  },

  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: Colors.white,
  },

  searchContainer: {
    paddingHorizontal: Spacing.m,
    marginBottom: 20,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  searchIcon: { 
    fontSize: 18, 
    marginRight: 10, 
    opacity: 0.6 
  },

  searchInput: { 
    flex: 1, 
    fontSize: 16, 
    color: Colors.textHeader,
    paddingVertical: 0,
    // ✅ Web: Fix outline
    outlineStyle: 'none',
  },

  listContainer: { 
    flex: 1, 
    paddingHorizontal: Spacing.m,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textHeader,
    marginBottom: 16,
  },

  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  avatarContainer: { 
    position: 'relative', 
    marginRight: 14,
  },

  avatar: { 
    width: 56, 
    height: 56, 
    borderRadius: 16,
    backgroundColor: Colors.border,
  },

  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.secondary,
    borderWidth: 2.5,
    borderColor: Colors.white,
  },

  chatContent: { flex: 1 },

  chatHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 6,
  },

  chatName: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: Colors.textHeader,
  },

  chatTime: { 
    fontSize: 12, 
    color: Colors.textSub,
  },

  messageRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
  },

  chatMessage: { 
    fontSize: 14, 
    color: Colors.textSub, 
    flex: 1, 
    marginRight: 10,
  },

  unreadBadge: {
    backgroundColor: Colors.primary,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },

  unreadText: { 
    color: Colors.white, 
    fontSize: 11, 
    fontWeight: '700',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  emptyText: {
    fontSize: 16,
    color: Colors.textSub,
  },

  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },

  fabIcon: { 
    fontSize: 28, 
    color: Colors.white, 
    fontWeight: '400',
  },

  // ✅ THÊM: Debug logout button cho web
  debugLogoutContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 999,
  },

  debugLogoutButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  debugLogoutText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});