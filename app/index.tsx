import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { PDFDocument } from 'pdf-lib';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, Colors } from '@/constants/theme';
import { useTheme } from '@/context/theme-context';

type Stage = 'idle' | 'unlocking' | 'success';

function formatBytes(bytes?: number) {
  if (!bytes) return 'PDF document';
  return `${(bytes / 1024 / 1024).toFixed(bytes > 1024 * 1024 ? 1 : 0)} MB PDF`;
}

export default function HomeScreen() {
  const { colorScheme } = useTheme();
  const tc = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [password, setPassword] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState<number>();
  const [outputUri, setOutputUri] = useState<string>();
  const outputUriRef = useRef<string>();

  useEffect(() => {
    outputUriRef.current = outputUri;
  }, [outputUri]);

  const removeTemporaryOutput = async (uri?: string) => {
    if (!uri) return;
    if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    else if (Platform.OS !== 'web') {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (error) {
        console.warn('Could not clear temporary PDF', error);
      }
    }
  };

  useEffect(() => () => {
    void removeTemporaryOutput(outputUriRef.current);
  }, []);

  const reset = () => {
    void removeTemporaryOutput(outputUri);
    setStage('idle');
    setProgress(0);
    setFileName('');
    setFileSize(undefined);
    setPassword('');
    setOutputUri(undefined);
  };

  const pickAndUnlock = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: false,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setFileName(asset.name);
      setFileSize(asset.size);
      setStage('unlocking');
      setProgress(12);
      await waitForUi();

      if (Platform.OS === 'android' && NativeModules.PdfUnlocker) {
        setProgress(30);
        await waitForUi();
        const destination = await NativeModules.PdfUnlocker.unlockPdf(asset.uri, password.trim());
        setProgress(92);
        setOutputUri(destination);
      } else {
        const bytes = await (await fetch(asset.uri)).arrayBuffer();
        setProgress(34);
        await waitForUi();
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
        setProgress(68);
        await waitForUi();
        const unlockedBytes = await pdf.save({ useObjectStreams: false });
        setProgress(92);

        const blob = new Blob([unlockedBytes], { type: 'application/pdf' });
        if (Platform.OS === 'web') {
          setOutputUri(URL.createObjectURL(blob));
        } else {
          const base64 = arrayBufferToBase64(unlockedBytes);
          const destination = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}unlocked-${Date.now()}.pdf`;
          await FileSystem.writeAsStringAsync(destination, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setOutputUri(destination);
        }
      }
      setProgress(100);
      setStage('success');
    } catch (error) {
      console.error('PDF unlock failed', error);
      setStage('idle');
      setProgress(0);
      Alert.alert(
        'Could not unlock this PDF',
        'This file may use password encryption rather than a removable security restriction. A password is required for that type of PDF.',
      );
    }
  };

  const shareUnlocked = async () => {
    if (!outputUri) return;
    if (Platform.OS === 'web') {
      const anchor = document.createElement('a');
      anchor.href = outputUri;
      anchor.download = `unlocked-${fileName || 'document.pdf'}`;
      anchor.click();
      return;
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(outputUri, { mimeType: 'application/pdf', dialogTitle: 'Share unlocked PDF' });
    } else {
      Alert.alert('Sharing unavailable', 'This device does not support sharing files.');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: tc.background }]}>
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 28, 48) }]}>
        <View style={styles.eyebrow}>
          <View style={styles.eyebrowDot} />
          <Text style={[styles.eyebrowText, { color: tc.textSecondary }]}>PRIVATE PDF TOOL</Text>
        </View>
        <Text style={[styles.title, { color: tc.text }]}>Unlock your PDF</Text>
        <Text style={[styles.subtitle, { color: tc.textSecondary }]}>
          Remove PDF restrictions in seconds.{'\n'}Your file stays on this device.
        </Text>

        {stage === 'success' ? (
          <View style={[styles.successCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
            <View style={styles.successIcon}>
              <IconSymbol name="checkmark.circle.fill" size={30} color={Brand.emerald} />
            </View>
            <Text style={[styles.successTitle, { color: tc.text }]}>PDF unlocked</Text>
            <Text style={[styles.fileName, { color: tc.textSecondary }]} numberOfLines={1}>{fileName}</Text>
            <Text style={[styles.successCopy, { color: tc.textSecondary }]}>
              Your unlocked copy is ready to share or download.
            </Text>
            <Pressable style={styles.shareButton} onPress={shareUnlocked}>
              <IconSymbol name="square.and.arrow.up" size={18} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>Share unlocked PDF</Text>
            </Pressable>
            <Pressable onPress={reset} style={styles.secondaryButton}>
              <Text style={[styles.secondaryButtonText, { color: tc.textSecondary }]}>Unlock another PDF</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={pickAndUnlock}
            disabled={stage === 'unlocking'}
            style={({ pressed }) => [
              styles.uploadCard,
              { backgroundColor: tc.surface, borderColor: isDark ? '#3F3F46' : '#CBD5E1' },
              pressed && stage !== 'unlocking' && styles.pressed,
            ]}
          >
            <View style={[styles.uploadIcon, { backgroundColor: `${Brand.indigo}16` }]}>
              {stage === 'unlocking' ? (
                <ActivityIndicator color={Brand.indigo} />
              ) : (
                <IconSymbol name="lock.fill" size={26} color={Brand.indigo} />
              )}
            </View>
            <Text style={[styles.uploadTitle, { color: tc.text }]}>
              {stage === 'unlocking' ? 'Unlocking PDF…' : 'Select a locked PDF'}
            </Text>
            <Text style={[styles.uploadHint, { color: tc.textSecondary }]}>
              {stage === 'unlocking' ? 'Removing security restrictions' : 'Tap to choose a PDF from your device'}
            </Text>
            {stage === 'unlocking' ? (
              <View style={styles.progressWrap}>
                <View style={[styles.progressTrack, { backgroundColor: isDark ? '#3F3F46' : '#E2E8F0' }]}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <View style={styles.progressLabels}>
                  <Text style={[styles.progressText, { color: tc.textSecondary }]}>Working securely</Text>
                  <Text style={[styles.progressText, { color: Brand.indigo }]}>{progress}%</Text>
                </View>
              </View>
            ) : null}
            <View style={[styles.fileBadge, { backgroundColor: isDark ? '#27272A' : '#F8FAFC' }]}>
              <IconSymbol name="doc.text.fill" size={14} color={Brand.pdfRed} />
              <Text style={[styles.fileBadgeText, { color: tc.textSecondary }]}>PDF only</Text>
            </View>
          </Pressable>
        )}

        {stage === 'idle' ? (
          <View style={styles.passwordSection}>
            <View style={styles.passwordLabelRow}>
              <Text style={[styles.passwordLabel, { color: tc.text }]}>PDF password</Text>
              <Text style={[styles.optionalLabel, { color: tc.textSecondary }]}>Optional</Text>
            </View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password if the PDF asks for one"
              placeholderTextColor={isDark ? '#71717A' : '#94A3B8'}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.passwordInput, { color: tc.text, backgroundColor: tc.surface, borderColor: tc.border }]}
            />
            <Text style={[styles.passwordHint, { color: tc.textSecondary }]}>
              Leave blank for PDFs with permission restrictions only.
            </Text>
          </View>
        ) : null}

        <View style={styles.privacyLine}>
          <IconSymbol name="lock.fill" size={13} color={tc.textSecondary} />
          <Text style={[styles.privacyText, { color: tc.textSecondary }]}>
            Files are processed privately and cleared after you finish.
          </Text>
        </View>
        {stage !== 'idle' && stage !== 'success' && fileName ? (
          <Text style={[styles.processingFile, { color: tc.textSecondary }]}>
            {fileName} · {formatBytes(fileSize)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function waitForUi() {
  return new Promise<void>((resolve) => setTimeout(resolve, 40));
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 24, alignItems: 'center' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  eyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Brand.indigo },
  eyebrowText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 38, lineHeight: 44, fontWeight: '800', letterSpacing: -1.3, textAlign: 'center' },
  subtitle: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 12, marginBottom: 40 },
  uploadCard: { width: '100%', minHeight: 300, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 24, alignItems: 'center', justifyContent: 'center', padding: 28 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  uploadIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  uploadTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  uploadHint: { fontSize: 14, textAlign: 'center' },
  passwordSection: { width: '100%', marginTop: 20 },
  passwordLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  passwordLabel: { fontSize: 14, fontWeight: '800' },
  optionalLabel: { fontSize: 12 },
  passwordInput: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 14 },
  passwordHint: { fontSize: 12, marginTop: 7 },
  progressWrap: { width: '100%', maxWidth: 340, marginTop: 24 },
  progressTrack: { height: 8, width: '100%', borderRadius: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 10, backgroundColor: Brand.indigo },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressText: { fontSize: 12, fontWeight: '700' },
  fileBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 22 },
  fileBadgeText: { fontSize: 12, fontWeight: '700' },
  successCard: { width: '100%', borderRadius: 24, borderWidth: 1, alignItems: 'center', padding: 28 },
  successIcon: { marginBottom: 15 },
  successTitle: { fontSize: 24, fontWeight: '800' },
  fileName: { fontSize: 14, marginTop: 7, maxWidth: '90%' },
  successCopy: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 18, marginBottom: 24 },
  shareButton: { width: '100%', height: 52, borderRadius: 14, backgroundColor: Brand.indigo, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  shareButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: { marginTop: 18, padding: 8 },
  secondaryButtonText: { fontSize: 14, fontWeight: '700' },
  privacyLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 28 },
  privacyText: { fontSize: 12 },
  processingFile: { fontSize: 12, marginTop: 12 },
});