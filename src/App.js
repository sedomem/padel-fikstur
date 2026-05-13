import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Trophy, User, Building2, Mail, Lock, ArrowRight, Activity } from 'lucide-react-native';

const Stack = createNativeStackNavigator();

// --- 1. KARŞILAMA VE ROL SEÇİM EKRANI ---
const WelcomeScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Trophy color="#10b981" size={48} />
        </View>
        <Text style={styles.title}>RACKET PRO</Text>
        <Text style={styles.subtitle}>Tenis, Padel ve Pickleball Turnuva Platformu</Text>
      </View>

      <View style={styles.roleContainer}>
        <Text style={styles.roleSelectText}>Uygulamayı nasıl kullanmak istersiniz?</Text>
        
        {/* Oyuncu Butonu */}
        <TouchableOpacity 
          style={[styles.roleCard, styles.playerCard]} 
          onPress={() => navigation.navigate('Auth', { role: 'player' })}
          activeOpacity={0.8}
        >
          <View style={styles.roleIconBg}>
            <User color="#10b981" size={32} />
          </View>
          <View style={styles.roleTextContainer}>
            <Text style={styles.roleCardTitle}>Oyuncu Olarak</Text>
            <Text style={styles.roleCardDesc}>Turnuvalara katıl, seviyeni (NTRP) belirle, istatistiklerini takip et.</Text>
          </View>
          <ArrowRight color="#10b981" size={24} />
        </TouchableOpacity>

        {/* Organizatör Butonu */}
        <TouchableOpacity 
          style={[styles.roleCard, styles.organizerCard]} 
          onPress={() => navigation.navigate('Auth', { role: 'organizer' })}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIconBg, { backgroundColor: '#f1f5f9' }]}>
            <Building2 color="#0f172a" size={32} />
          </View>
          <View style={styles.roleTextContainer}>
            <Text style={[styles.roleCardTitle, { color: '#0f172a' }]}>Organizatör / Kulüp</Text>
            <Text style={styles.roleCardDesc}>Fikstür oluştur, kortları yönet, hakem atamaları yap ve gelir kazan.</Text>
          </View>
          <ArrowRight color="#0f172a" size={24} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// --- 2. DİNAMİK KAYIT VE GİRİŞ EKRANI (Role-Based) ---
const AuthScreen = ({ route, navigation }) => {
  const { role } = route.params; // 'player' veya 'organizer'
  const [isLogin, setIsLogin] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', sport: '' });

  const isOrganizer = role === 'organizer';
  const themeColor = isOrganizer ? '#0f172a' : '#10b981'; // Organizatör için koyu, oyuncu için yeşil tema

  const handleAuth = () => {
    // Burada Firebase Auth entegrasyonu yapılacak
    console.log(`${isLogin ? 'Giriş' : 'Kayıt'} yapılıyor... Data:`, formData);
    // Başarılı giriş sonrası uygulamanın ana sayfasına yönlendirilecek
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#ffffff' }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        
        <View style={styles.authHeader}>
          <View style={[styles.iconCircle, { backgroundColor: themeColor + '20' }]}>
            {isOrganizer ? <Building2 color={themeColor} size={40} /> : <Activity color={themeColor} size={40} />}
          </View>
          <Text style={styles.authTitle}>
            {isLogin ? 'Hoş Geldiniz' : (isOrganizer ? 'Kulüp Hesabı Oluştur' : 'Oyuncu Profili Oluştur')}
          </Text>
          <Text style={styles.authSubtitle}>
            {isLogin ? 'Devam etmek için bilgilerinizi girin' : 'Ekosisteme katılmak için bilgilerinizi doldurun'}
          </Text>
        </View>

        <View style={styles.formContainer}>
          {/* Sadece Kayıt ekranında İsim/Kulüp adı iste */}
          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{isOrganizer ? 'Kulüp / Tesis Adı' : 'Ad Soyad'}</Text>
              <TextInput 
                style={styles.input} 
                placeholder={isOrganizer ? 'Örn: İstanbul Padel Club' : 'Örn: Sedat Yakut'}
                value={formData.name}
                onChangeText={(t) => setFormData({...formData, name: t})}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-posta Adresi</Text>
            <View style={styles.inputWithIcon}>
              <Mail color="#94a3b8" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.inputField} 
                placeholder="ornek@mail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(t) => setFormData({...formData, email: t})}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Şifre</Text>
            <View style={styles.inputWithIcon}>
              <Lock color="#94a3b8" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.inputField} 
                placeholder="••••••••"
                secureTextEntry
                value={formData.password}
                onChangeText={(t) => setFormData({...formData, password: t})}
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.mainButton, { backgroundColor: themeColor }]}
            onPress={handleAuth}
          >
            <Text style={styles.mainButtonText}>{isLogin ? 'GİRİŞ YAP' : 'ÜCRETSİZ KAYIT OL'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchModeBtn} onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.switchModeText}>
              {isLogin ? "Hesabınız yok mu? Yeni hesap oluşturun." : "Zaten hesabınız var mı? Giriş yapın."}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- UYGULAMA NAVİGASYON KÖKÜ ---
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// --- TASARIM STİLLERİ (Tailwind Benzeri Yapı) ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { alignItems: 'center', marginTop: 80, marginBottom: 60 },
  logoContainer: { width: 90, height: 90, backgroundColor: '#ecfdf5', borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: '#10b981', shadowOpacity: 0.2, shadowRadius: 10 },
  title: { fontSize: 32, fontWeight: '900', color: '#0f172a', letterSpacing: 1, fontStyle: 'italic' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 8, fontWeight: '600' },
  roleContainer: { paddingHorizontal: 24, gap: 16 },
  roleSelectText: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 8 },
  roleCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, borderWidth: 2 },
  playerCard: { backgroundColor: '#ffffff', borderColor: '#10b981' },
  organizerCard: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', marginTop: 10 },
  roleIconBg: { width: 60, height: 60, backgroundColor: '#ecfdf5', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  roleTextContainer: { flex: 1, marginLeft: 16 },
  roleCardTitle: { fontSize: 18, fontWeight: '900', color: '#10b981', marginBottom: 4 },
  roleCardDesc: { fontSize: 12, color: '#64748b', fontWeight: '500', lineHeight: 18 },
  
  // Auth Ekranı Stilleri
  keyboardView: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  authHeader: { alignItems: 'center', marginBottom: 40 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  authTitle: { fontSize: 26, fontWeight: '900', color: '#0f172a', marginBottom: 8 },
  authSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  formContainer: { gap: 20 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginLeft: 4 },
  input: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 12, fontSize: 15, fontWeight: '600', color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  inputField: { flex: 1, paddingVertical: 16, fontSize: 15, fontWeight: '600', color: '#0f172a' },
  mainButton: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  mainButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  switchModeBtn: { padding: 16, alignItems: 'center' },
  switchModeText: { color: '#64748b', fontSize: 13, fontWeight: '700' }
});
