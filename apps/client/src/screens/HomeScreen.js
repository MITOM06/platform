import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { HomeStyles as styles } from '../styles/HomeStyles';
import { Colors } from '../theme';

const MOCK_CHATS = [
  { 
    id: '1', 
    name: 'Nguyễn Văn A', 
    message: 'Dự án PON thế nào rồi?', 
    time: '10:30', 
    unread: 2, 
    avatar: 'https://ui-avatars.com/api/?name=Nguyen+Van+A&background=3B71F3&color=fff' 
  },
  { 
    id: '2', 
    name: 'Trần Thị B', 
    message: 'Chiều nay họp nhé!', 
    time: '09:15', 
    unread: 0, 
    avatar: 'https://ui-avatars.com/api/?name=Tran+Thi+B&background=00E096&color=fff' 
  },
  { 
    id: '3', 
    name: 'Team Dev', 
    message: 'Đã fix xong lỗi deploy docker.', 
    time: 'Hôm qua', 
    unread: 5, 
    avatar: 'https://ui-avatars.com/api/?name=Team+Dev&background=FF6B6B&color=fff' 
  },
];

const HomeScreen = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // ✅ FIX: Logout hoạt động trên cả web và mobile
  const handleLogout = async () => {
    console.log('🔴 handleLogout được gọi!');
    
    // ✅ Web: Dùng window.confirm (simple & hoạt động)
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Bạn có chắc chắn muốn đăng xuất khỏi PON?');
      
      if (!confirmed) {
        console.log('❌ User hủy logout');
        return;
      }
    } 
    // ✅ Mobile: Dùng native Alert (import động)
    else {
      const { Alert } = await import('react-native');
      
      return new Promise((resolve) => {
        Alert.alert(
          "Đăng xuất", 
          "Bạn có chắc chắn muốn thoát khỏi PON?", 
          [
            { 
              text: "Hủy", 
              style: "cancel",
              onPress: () => {
                console.log('❌ User hủy logout');
                resolve(false);
              }
            },
            {
              text: "Đăng xuất",
              style: "destructive",
              onPress: () => {
                console.log('✅ User confirm logout');
                performLogout();
                resolve(true);
              }
            }
          ]
        );
      });
    }

    // Web: Thực hiện logout ngay
    performLogout();
  };

  const performLogout = async () => {
    setLoading(true);
    try {
      console.log('📞 Gọi signOut()...');
      await signOut();
      console.log('✅ signOut() thành công');
    } catch (e) {
      console.error("❌ Lỗi đăng xuất:", e);
      
      // Show error
      if (Platform.OS === 'web') {
        window.alert('Không thể đăng xuất. Vui lòng thử lại.');
      } else {
        const { Alert } = await import('react-native');
        Alert.alert("Lỗi", "Không thể đăng xuất. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity style={styles.chatItem} activeOpacity={0.7}>
      <View style={styles.avatarContainer}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        {item.unread > 0 && <View style={styles.onlineIndicator} />}
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text style={styles.chatTime}>{item.time}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={styles.chatMessage} numberOfLines={1}>
            {item.message}
          </Text>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Đang đăng xuất...</Text>
      </View>
    );
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Thành viên';
  const avatarUrl = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3B71F3&color=fff`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Xin chào,</Text>
          <Text style={styles.username}>{displayName}</Text>
        </View>
        
        {/* ✅ Avatar Button với debug logs */}
        <TouchableOpacity 
          onPress={() => {
            console.log('👆 Avatar được bấm!');
            handleLogout();
          }} 
          style={styles.profileButton}
          activeOpacity={0.7}
          testID="logout-button" // ✅ Thêm testID để dễ debug
        >
          <Image 
            source={{ uri: avatarUrl }} 
            style={styles.profileAvatar} 
          />
        </TouchableOpacity>
      </View>

      {/* Search box */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm tin nhắn..."
            placeholderTextColor={Colors.textSub}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {/* Chat list */}
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Tin nhắn gần đây</Text>
        <FlatList
          data={MOCK_CHATS.filter(chat => 
            chat.name.toLowerCase().includes(searchText.toLowerCase()) ||
            chat.message.toLowerCase().includes(searchText.toLowerCase())
          )}
          keyExtractor={item => item.id}
          renderItem={renderChatItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchText ? 'Không tìm thấy kết quả' : 'Chưa có tin nhắn'}
              </Text>
            </View>
          }
        />
      </View>

      {/* ✅ THÊM: Nút logout tạm thời cho debug trên web */}
      {Platform.OS === 'web' && (
        <View style={styles.debugLogoutContainer}>
          <TouchableOpacity
            onPress={() => {
              console.log('🔴 Debug logout button clicked');
              handleLogout();
            }}
            style={styles.debugLogoutButton}
          >
            <Text style={styles.debugLogoutText}>DEBUG: LOGOUT</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default HomeScreen;