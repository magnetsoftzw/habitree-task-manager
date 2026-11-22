import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../theme/ThemeProvider';
import AppText from '../../components/ui/AppText';
import { Button } from '../../components/ui/Controls';
import { TextField } from '../../components/ui/Fields';
import AuthLayout from './AuthLayout';
import { PasswordToggle } from './LoginScreen';
import { clearError, registerUser } from '../../store/slices/AuthSlice';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { loading, error } = useSelector((s) => s.auth);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errs, setErrs] = useState({});
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const submit = () => {
    const next = {};
    if (!username.trim()) next.username = 'Choose a username';
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address';
    if (password.length < 6) next.password = 'Use at least 6 characters';
    setErrs(next);
    if (Object.keys(next).length) return;
    dispatch(registerUser({ username: username.trim(), email: email.trim().toLowerCase(), password }));
  };

  return (
    <AuthLayout title="Plant your first habit." subtitle="Create an account to plan your day, track focus time and map new skills.">
      <TextField label="Username" placeholder="e.g. demoUser" value={username} onChangeText={setUsername} autoCapitalize="none" autoComplete="username" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} error={errs.username} maxLength={60} />
      <TextField ref={emailRef} label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} error={errs.email} />
      <TextField
        ref={passwordRef}
        label="Password"
        placeholder="At least 6 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={errs.password}
        right={<PasswordToggle shown={show} onPress={() => setShow(!show)} />}
      />
      {error && (
        <View accessibilityRole="alert" style={{ padding: 12, borderRadius: 10, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder }}>
          <AppText variant="meta" color={colors.dangerInk}>{error}</AppText>
        </View>
      )}
      <Button label="Create account" onPress={submit} loading={loading} height={54} textStyle={{ fontFamily: 'Inter_700Bold' }} />
      <View style={{ marginTop: 'auto', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
        <AppText variant="body" tone="muted">Already have an account? </AppText>
        <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Login')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="bodyStrong" tone="accent">Log in</AppText>
        </Pressable>
      </View>
    </AuthLayout>
  );
}
