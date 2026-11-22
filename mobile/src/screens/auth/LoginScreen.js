import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import AppText from '../../components/ui/AppText';
import { Button } from '../../components/ui/Controls';
import { TextField } from '../../components/ui/Fields';
import AuthLayout from './AuthLayout';
import { clearError, loginUser } from '../../store/slices/AuthSlice';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PasswordToggle({ shown, onPress }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={shown ? 'Hide password' : 'Show password'} onPress={onPress} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      {shown ? <EyeOff size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}
    </Pressable>
  );
}

export default function LoginScreen({ navigation }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { loading, error } = useSelector((s) => s.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [fieldError, setFieldError] = useState({});
  const passwordRef = useRef(null);

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const submit = () => {
    const errs = {};
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address';
    if (!password) errs.password = 'Enter your password';
    setFieldError(errs);
    if (Object.keys(errs).length) return;
    dispatch(loginUser({ email: email.trim().toLowerCase(), password }));
  };

  return (
    <AuthLayout title="Welcome back. Let's keep it growing." subtitle="Pick up today's plan and start a focus session.">
      <TextField
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={(t) => { setEmail(t); setFieldError((f) => ({ ...f, email: null })); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={fieldError.email}
      />
      <View style={{ gap: 0 }}>
        <TextField
          ref={passwordRef}
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={(t) => { setPassword(t); setFieldError((f) => ({ ...f, password: null })); }}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={fieldError.password}
          right={<PasswordToggle shown={show} onPress={() => setShow(!show)} />}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert('Forgot your password?', 'Password reset by email is not set up on this server yet. Ask your Habitree admin to reset it for you, then change it under Settings.')}
          style={{ alignSelf: 'flex-end', paddingVertical: 10, minHeight: 44, justifyContent: 'center' }}
        >
          <AppText variant="label" tone="accent">Forgot password?</AppText>
        </Pressable>
      </View>

      {error && (
        <View accessibilityRole="alert" style={{ padding: 12, borderRadius: 10, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder }}>
          <AppText variant="meta" color={colors.dangerInk}>{error}</AppText>
        </View>
      )}

      <Button label="Log in" onPress={submit} loading={loading} height={54} textStyle={{ fontFamily: 'Inter_700Bold' }} />

      <View style={{ marginTop: 'auto', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
        <AppText variant="body" tone="muted">New to Habitree? </AppText>
        <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Register')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="bodyStrong" tone="accent">Create an account</AppText>
        </Pressable>
      </View>
    </AuthLayout>
  );
}
