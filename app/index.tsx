import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  ListRenderItem,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface PdfDoc {
  id: string;
  name: string;
  date: string;
  size: string;
  uri: string;
  thumbnailUri?: string;
  timestamp: number;
  isGhost?: boolean;
}

const { width: SW, height: SH } = Dimensions.get('window');
const GRID_PAD = 16;
const GAP = 10;
const ITEM_W = (SW - GRID_PAD * 2 - GAP) / 2;

const STATUS_MSGS = [
  'Compressing images…',
  'Building pages…',
  'Stitching document…',
  'Finalising PDF…',
  'Almost done…',
];

const DraggableItem = memo(function DraggableItem({
  uri, index, total, onSwap, onRemove, colorScheme,
}: {
  uri: string; index: number; total: number;
  onSwap: (f: number, t: number) => void;
  onRemove: (i: number) => void;
  colorScheme: 'light' | 'dark';
}) {
  const isDragging = useSharedValue(false);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: withSpring(isDragging.value ? 1.06 : 1) },
    ],
    zIndex: isDragging.value ? 999 : 1,
    shadowOpacity: withSpring(isDragging.value ? 0.25 : 0.06) as any,
  }));

  const drag = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => { isDragging.value = true; })
    .onUpdate((e) => { tx.value = e.translationX; ty.value = e.translationY; })
    .onEnd((e) => {
      const colShift = Math.round(e.translationX / (ITEM_W + GAP));
      const rowShift = Math.round(e.translationY / (ITEM_W + GAP));
      const target = Math.max(0, Math.min(total - 1, index + colShift + rowShift * 2));
      if (target !== index) runOnJS(onSwap)(index, target);
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      isDragging.value = false;
    });

  return (
    <GestureDetector gesture={drag}>
      <Animated.View style={[styles.draftCardWrap, animStyle]}>
        <View style={[styles.draftCard, { backgroundColor: colorScheme === 'dark' ? '#27272A' : '#F8FAFC' }]}>
          <Image source={{ uri }} style={styles.draftThumb} contentFit="cover" cachePolicy="memory-disk" />
          <TouchableOpacity style={styles.draftRemoveBtn} onPress={() => onRemove(index)}>
            <View style={styles.draftRemoveCircle}>
              <Text style={styles.draftRemoveX}>✕</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.pageTag}>
            <Text style={styles.pageTagText}>{index + 1}</Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

const SkeletonItem = () => {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.6, { duration: 800 }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.draftCardWrap, style]}>
      <View style={[styles.draftCard, { backgroundColor: '#CBD5E1' }]} />
    </Animated.View>
  );
};

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const tc = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [pdfs, setPdfs] = useState<PdfDoc[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [pendingAppendCount, setPendingAppendCount] = useState(0);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [pdfName, setPdfName] = useState('');
  const [statusIdx, setStatusIdx] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'fit'>('a4');
  const [margin, setMargin] = useState<'none' | 'small' | 'large'>('small');
  const [libSearchQuery, setLibSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean; x: number; y: number; item: PdfDoc | null;
  }>({ visible: false, x: 0, y: 0, item: null });

  const menuBtnRefs = React.useRef<{[id: string]: any}>({});

  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  useEffect(() => {
    if (isProcessing) {
      pulse.value = withRepeat(
        withSequence(withTiming(1.04, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1, false
      );
    } else {
      pulse.value = 1;
    }
  }, [isProcessing]);

  useEffect(() => {
    let iv: any;
    if (isProcessing && !progressMsg) {
      iv = setInterval(() => setStatusIdx(p => (p + 1) % STATUS_MSGS.length), 1400);
    }
    return () => clearInterval(iv);
  }, [isProcessing, progressMsg]);

  const loadLibrary = async (spinner = true) => {
    if (spinner) setIsLoadingLibrary(true);
    try {
      const dir = FileSystem.documentDirectory;
      if (!dir) return;
      const files = await FileSystem.readDirectoryAsync(dir);
      const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
      const docs: PdfDoc[] = await Promise.all(pdfFiles.map(async (fn) => {
        const uri = `${dir}${fn}`;
        const thumbUri = `${dir}${fn.replace('.pdf', '.jpg')}`;
        const info = await FileSystem.getInfoAsync(uri);
        const thumbInfo = await FileSystem.getInfoAsync(thumbUri);
        let size = '0 MB', ts = 0;
        if (info.exists) {
          size = `${(info.size / (1024 * 1024)).toFixed(2)} MB`;
          ts = info.modificationTime || Date.now() / 1000;
        }
        return {
          id: fn, name: fn, uri,
          thumbnailUri: thumbInfo.exists ? thumbUri : undefined,
          date: new Date(ts * 1000).toLocaleDateString(), size, timestamp: ts,
        };
      }));
      setPdfs(docs.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) { console.error(e); }
    finally { setIsLoadingLibrary(false); setIsRefreshing(false); }
  };

  useEffect(() => { loadLibrary(); }, []);

  const openPdf = async (uri: string) => {
    try {
      if (Platform.OS === 'android') {
        const cu = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: cu, flags: 1, type: 'application/pdf',
        });
      } else { await Sharing.shareAsync(uri); }
    } catch { Alert.alert('Error', 'Could not open PDF viewer.'); }
  };

  const pickImages = async (appending = false) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    if (!appending) setIsSelecting(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.7,
      });
      if (result.canceled) {
        if (!appending) setIsSelecting(false);
        return;
      }
      const uris = result.assets.map(a => a.uri);

      if (appending) {
        // Show skeleton cards immediately for each incoming image, then fill them in
        setPendingAppendCount(uris.length);
        setTimeout(() => {
          setSelectedImages(prev => [...prev, ...uris]);
          setPendingAppendCount(0);
        }, 350);
      } else {
        setPdfName(`PDF_${Math.floor(100000 + Math.random() * 900000)}`);
        setShowDraftModal(true);
        setTimeout(() => {
          setSelectedImages(uris);
          setIsSelecting(false);
        }, 300);
      }
    } catch {
      if (!appending) setIsSelecting(false);
      setPendingAppendCount(0);
      Alert.alert('Error', 'Could not load images.');
    }
  };

  // Build page dimensions from current settings.
  // Returns mm values (for CSS @page) and pt values (for native printToFileAsync).
  const getPageParams = (imgW: number, imgH: number) => {
    const MM_TO_PT = 2.8346; // 1 mm in points
    const PX_TO_MM = 25.4 / 72; // treat image pixels as 72 dpi → mm

    let wMm: number, hMm: number;
    if (pageSize === 'a4') {
      wMm = 210; hMm = 297;
    } else if (pageSize === 'letter') {
      wMm = 215.9; hMm = 279.4;
    } else {
      // Fit: match the image's natural proportions
      wMm = imgW * PX_TO_MM;
      hMm = imgH * PX_TO_MM;
    }
    if (orientation === 'landscape' && pageSize !== 'fit') [wMm, hMm] = [hMm, wMm];

    const mMm = margin === 'none' ? 0 : margin === 'small' ? 8 : 20;
    const mPt = Math.round(mMm * MM_TO_PT);
    return {
      wMm, hMm, mMm,
      width: Math.round(wMm * MM_TO_PT),
      height: Math.round(hMm * MM_TO_PT),
      margins: { top: mPt, right: mPt, bottom: mPt, left: mPt },
    };
  };

  // Build HTML with embedded @page CSS so web browsers respect page size, orientation, and margins.
  // Native printToFileAsync also gets the same values via its params (see generatePdf).
  const buildPdfHtml = (b64Images: string[], wMm: number, hMm: number, mMm: number) => {
    const cw = Math.max(1, wMm - mMm * 2).toFixed(2);
    const ch = Math.max(1, hMm - mMm * 2).toFixed(2);
    const w = wMm.toFixed(2);
    const h = hMm.toFixed(2);
    const m = mMm.toFixed(2);
    const pages = b64Images
      .map(b64 => `<div class="page"><img src="data:image/jpeg;base64,${b64}"/></div>`)
      .join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page{size:${w}mm ${h}mm;margin:${m}mm}
      *{box-sizing:border-box;margin:0;padding:0}
      html,body{background:#fff}
      .page{
        width:${w}mm;height:${h}mm;
        display:flex;justify-content:center;align-items:center;
        page-break-after:always;page-break-inside:avoid;
        padding:${m}mm;overflow:hidden;
      }
      img{
        max-width:${cw}mm;max-height:${ch}mm;
        width:auto;height:auto;object-fit:contain;display:block;
      }
    </style></head><body>${pages}</body></html>`;
  };

  const generatePdf = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('No Images', 'Add at least one image.'); return;
    }
    setIsProcessing(true);
    const dir = FileSystem.documentDirectory;
    if (!dir) {
      setIsProcessing(false);
      Alert.alert('Error', 'File storage is not available on this platform.');
      return;
    }
    const baseName = (pdfName.trim() || `Doc_${Date.now()}`).replace(/[^a-z0-9._-]/gi, '_');

    try {
      const b64Images: string[] = [];
      let params = { wMm: 210, hMm: 297, mMm: 8, width: 595, height: 842, margins: { top: 23, right: 23, bottom: 23, left: 23 } };
      let firstThumbUri = '';

      for (let i = 0; i < selectedImages.length; i++) {
        setProgressMsg(`Optimising ${i + 1} of ${selectedImages.length}…`);
        const r = await ImageManipulator.manipulateAsync(
          selectedImages[i], [{ resize: { width: 750 } }],
          { compress: 0.45, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        b64Images.push(r.base64 ?? '');
        if (i === 0) {
          firstThumbUri = r.uri;
          params = getPageParams(r.width, r.height);
        }
        if (i % 15 === 0 && Platform.OS !== 'web') await new Promise(res => setTimeout(res, 50));
      }

      setProgressMsg('Building PDF…');
      const html = buildPdfHtml(b64Images, params.wMm, params.hMm, params.mMm);
      const { uri: tmp } = await Print.printToFileAsync({
        html,
        width: params.width,
        height: params.height,
        margins: params.margins,
      });
      const dest = `${dir}${baseName}.pdf`;
      await FileSystem.copyAsync({ from: tmp, to: dest });
      if (firstThumbUri) await FileSystem.copyAsync({ from: firstThumbUri, to: dest.replace('.pdf', '.jpg') });

      await loadLibrary(false);
      setShowDraftModal(false);
      setSelectedImages([]);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not create PDF. Try fewer images or close background apps.');
    } finally { setIsProcessing(false); setProgressMsg(''); }
  };

  const swapImages = useCallback((f: number, t: number) => {
    setSelectedImages(prev => {
      const n = [...prev]; [n[f], n[t]] = [n[t], n[f]]; return n;
    });
  }, []);

  const removeImage = useCallback((i: number) => {
    setSelectedImages(prev => prev.filter((_, idx) => idx !== i));
  }, []);

  const saveRename = async (item: PdfDoc) => {
    const cur = item.name.replace('.pdf', '');
    const val = editingValue.trim();
    if (!val || val === cur) { setEditingId(null); return; }
    try {
      const newFn = `${val}.pdf`;
      const newUri = `${FileSystem.documentDirectory}${newFn}`;
      const newThumb = newUri.replace('.pdf', '.jpg');
      const exists = await FileSystem.getInfoAsync(newUri);
      if (exists.exists) { Alert.alert('Error', 'File name already exists.'); setEditingId(null); return; }
      await FileSystem.copyAsync({ from: item.uri, to: newUri });
      await FileSystem.deleteAsync(item.uri);
      if (item.thumbnailUri) {
        await FileSystem.copyAsync({ from: item.thumbnailUri, to: newThumb });
        await FileSystem.deleteAsync(item.thumbnailUri);
      }
      setPdfs(prev => prev.map(p => p.id === item.id
        ? { ...p, id: newFn, name: newFn, uri: newUri, thumbnailUri: p.thumbnailUri ? newThumb : undefined }
        : p));
    } catch { Alert.alert('Rename Failed', 'Could not rename file.'); }
    finally { setEditingId(null); }
  };

  const showCtx = useCallback((itemId: string, item: PdfDoc) => {
    const ref = menuBtnRefs.current[itemId];
    if (!ref) return;
    ref.measureInWindow((x: number, y: number, w: number, h: number) => {
      const MENU_W = 170;
      setContextMenu({
        visible: true,
        x: Math.min(x + w - MENU_W, SW - MENU_W - 4),
        y: y + h + 4,
        item,
      });
    });
  }, []);

  const recentData = useMemo(() => {
    const sliced = pdfs.slice(0, 5);
    if (pdfs.length > 5) return [...sliced, { id: 'ghost', isGhost: true } as PdfDoc];
    return sliced;
  }, [pdfs]);

  const filteredPdfs = useMemo(() => {
    if (!libSearchQuery.trim()) return pdfs;
    return pdfs.filter(p => p.name.toLowerCase().includes(libSearchQuery.toLowerCase()));
  }, [pdfs, libSearchQuery]);

  const renderDoc: ListRenderItem<PdfDoc> = useCallback(({ item }) => {
    if (item.isGhost) {
      return (
        <TouchableOpacity
          style={[styles.docCard, { backgroundColor: tc.surface }]}
          onPress={() => setShowLibraryModal(true)}
          activeOpacity={0.75}
        >
          <View style={[styles.docThumbBox, { backgroundColor: `${Brand.indigo}12` }]}>
            <IconSymbol name="photo.on.rectangle.angled" size={20} color={Brand.indigo} />
          </View>
          <View style={styles.docInfo}>
            <Text style={[styles.docName, { color: Brand.indigo }]}>View all documents</Text>
            <Text style={[styles.docMeta, { color: tc.textSecondary }]}>{pdfs.length - 5} more</Text>
          </View>
          <IconSymbol name="chevron.right" size={14} color={tc.textSecondary} style={{ opacity: 0.4 }} />
        </TouchableOpacity>
      );
    }

    const isEditing = editingId === item.id;
    const name = item.name.replace(/\.pdf$/i, '');

    return (
      <TouchableOpacity
        style={[styles.docCard, { backgroundColor: tc.surface }]}
        onPress={() => !isEditing && openPdf(item.uri)}
        activeOpacity={isEditing ? 1 : 0.75}
      >
        <View style={styles.docThumbBox}>
          {item.thumbnailUri ? (
            <Image source={{ uri: item.thumbnailUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: `${Brand.pdfRed}12`, alignItems: 'center', justifyContent: 'center' }]}>
              <IconSymbol name="doc.text.fill" size={20} color={Brand.pdfRed} />
            </View>
          )}
          <View style={styles.pdfBadgeSmall}>
            <Text style={styles.pdfBadgeSmallText}>PDF</Text>
          </View>
        </View>

        <View style={styles.docInfo}>
          {isEditing ? (
            <TextInput
              style={[styles.renameInput, { color: tc.text, borderColor: Brand.indigo }]}
              value={editingValue}
              onChangeText={setEditingValue}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={() => Keyboard.dismiss()}
              onBlur={() => saveRename(item)}
              returnKeyType="done"
            />
          ) : (
            <Text style={[styles.docName, { color: tc.text }]} numberOfLines={1}>{name}</Text>
          )}
          <Text style={[styles.docMeta, { color: tc.textSecondary }]}>{item.date} · {item.size}</Text>
        </View>

        {!isEditing && (
          <TouchableOpacity
            ref={r => { if (r) menuBtnRefs.current[item.id] = r; }}
            style={styles.docMenuBtn}
            onPress={() => showCtx(item.id, item)}
          >
            <IconSymbol name="ellipsis" size={16} color={tc.textSecondary} style={{ opacity: 0.5 }} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }, [colorScheme, editingId, editingValue, pdfs.length, tc]);

  if (isSelecting) {
    return (
      <View style={[styles.guardFull, { backgroundColor: tc.background }]}>
        <ActivityIndicator color={Brand.indigo} size="large" />
        <Text style={[styles.guardTitle, { color: tc.text }]}>Loading Images</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.root, { backgroundColor: tc.background }]}>
        <FlatList<PdfDoc>
          data={recentData}
          keyExtractor={(item) => item.id}
          renderItem={renderDoc}
          contentContainerStyle={styles.mainList}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadLibrary(false)} tintColor={Brand.indigo} />}
          ListHeaderComponent={
            <View>
              {pdfs.length > 0 ? (
                <View style={styles.withPdfsHeader}>
                  {/* Action bar */}
                  <View style={styles.actionBar}>
                    <TouchableOpacity
                      style={[styles.newPdfBtn, { backgroundColor: Brand.indigo }]}
                      onPress={() => pickImages(false)}
                      activeOpacity={0.85}
                    >
                      <IconSymbol name="plus" size={16} color="#FFF" />
                      <Text style={styles.newPdfBtnText}>New PDF</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.libraryBtn, {
                        backgroundColor: isDark ? '#18181B' : '#FFFFFF',
                        borderColor: isDark ? '#3F3F46' : '#E4E4E7',
                      }]}
                      onPress={() => setShowLibraryModal(true)}
                      activeOpacity={0.75}
                    >
                      <IconSymbol name="photo.on.rectangle.angled" size={15} color={tc.textSecondary} />
                      <Text style={[styles.libraryBtnText, { color: tc.text }]}>Library</Text>
                      <View style={[styles.libraryCount, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}>
                        <Text style={[styles.libraryCountText, { color: tc.textSecondary }]}>{pdfs.length}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Section label */}
                  <View style={styles.sectionRow}>
                    <Text style={[styles.sectionTitle, { color: tc.textSecondary }]}>Recent</Text>
                    {pdfs.length > 5 && (
                      <TouchableOpacity onPress={() => setShowLibraryModal(true)}>
                        <Text style={[styles.seeAll, { color: Brand.indigo }]}>See all</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            isLoadingLibrary ? null : (
              /* Full-screen onboarding when library is empty */
              <View style={[styles.onboarding, { backgroundColor: tc.background }]}>
                {/* Icon cluster */}
                <View style={styles.onboardingIconRow}>
                  <View style={[styles.onboardingIconBox, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}>
                    <IconSymbol name="photo.on.rectangle.angled" size={28} color={Brand.indigo} />
                  </View>
                  <View style={styles.onboardingArrow}>
                    <View style={[styles.onboardingArrowLine, { backgroundColor: isDark ? '#3F3F46' : '#D4D4D8' }]} />
                    <View style={[styles.onboardingArrowHead, { borderLeftColor: isDark ? '#3F3F46' : '#D4D4D8' }]} />
                  </View>
                  <View style={[styles.onboardingIconBox, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}>
                    <IconSymbol name="doc.text.fill" size={28} color={Brand.pdfRed} />
                  </View>
                </View>

                <Text style={[styles.onboardingTitle, { color: tc.text }]}>
                  Turn photos into PDFs
                </Text>

                {/* Steps */}
                <View style={styles.stepsContainer}>
                  {[
                    { num: '1', label: 'Pick images', desc: 'Choose one or many photos', icon: 'photo.on.rectangle.angled' as const, color: Brand.indigo },
                    { num: '2', label: 'Arrange pages', desc: 'Drag to reorder', icon: 'rectangle.stack.fill' as const, color: Brand.amber },
                    { num: '3', label: 'Export PDF', desc: 'Save or share instantly', icon: 'square.and.arrow.up' as const, color: Brand.pdfRed },
                  ].map((step) => (
                    <View key={step.num} style={[styles.stepCard, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? '#3F3F46' : '#E4E4E7' }]}>
                      <View style={[styles.stepIconBox, { backgroundColor: `${step.color}15` }]}>
                        <IconSymbol name={step.icon} size={18} color={step.color} />
                      </View>
                      <View style={styles.stepCardText}>
                        <Text style={[styles.stepCardLabel, { color: tc.text }]}>{step.label}</Text>
                        <Text style={[styles.stepCardDesc, { color: tc.textSecondary }]}>{step.desc}</Text>
                      </View>
                      <View style={[styles.stepNumBadge, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}>
                        <Text style={[styles.stepNumText, { color: tc.textSecondary }]}>{step.num}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Primary CTA */}
                <TouchableOpacity
                  style={[styles.onboardingCta, { backgroundColor: Brand.indigo }]}
                  onPress={() => pickImages(false)}
                  activeOpacity={0.85}
                >
                  <IconSymbol name="plus" size={18} color="#FFF" />
                  <Text style={styles.onboardingCtaText}>Get Started</Text>
                </TouchableOpacity>

                <Text style={[styles.onboardingHint, { color: tc.textSecondary }]}>
                  100% offline · nothing leaves your device
                </Text>
              </View>
            )
          }
        />

      </View>

      {/* Context menu — transparent modal so coordinates are window-relative */}
      <Modal
        visible={contextMenu.visible && !!contextMenu.item}
        transparent
        animationType="none"
        onRequestClose={() => setContextMenu(p => ({ ...p, visible: false }))}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setContextMenu(p => ({ ...p, visible: false }))}>
          <View style={[styles.ctxMenu, {
            top: contextMenu.y, left: contextMenu.x,
            backgroundColor: isDark ? '#27272A' : '#FFFFFF',
            borderColor: isDark ? '#3F3F46' : '#E4E4E7',
          }]}>
            {[
              { label: 'Open', icon: 'eye.fill' as const, onPress: () => openPdf(contextMenu.item!.uri) },
              { label: 'Share', icon: 'square.and.arrow.up' as const, onPress: async () => { await Sharing.shareAsync(contextMenu.item!.uri); } },
              { label: 'Rename', icon: 'pencil' as const, onPress: () => { setEditingId(contextMenu.item!.id); setEditingValue(contextMenu.item!.name.replace('.pdf', '')); } },
              { label: 'Delete', icon: 'trash.fill' as const, isDestructive: true, onPress: () => {
                Alert.alert('Delete PDF', 'This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: async () => {
                    await FileSystem.deleteAsync(contextMenu.item!.uri);
                    if (contextMenu.item!.thumbnailUri) await FileSystem.deleteAsync(contextMenu.item!.thumbnailUri!);
                    setPdfs(prev => prev.filter(p => p.id !== contextMenu.item!.id));
                  }},
                ]);
              }},
            ].map((action, i) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.ctxItem, i < 3 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? '#3F3F46' : '#E4E4E7' }]}
                onPress={() => { setContextMenu(p => ({ ...p, visible: false })); action.onPress(); }}
              >
                <Text style={[styles.ctxLabel, { color: action.isDestructive ? Brand.pdfRed : tc.text }]}>
                  {action.label}
                </Text>
                <IconSymbol name={action.icon} size={14} color={action.isDestructive ? Brand.pdfRed : tc.textSecondary} style={{ opacity: action.isDestructive ? 1 : 0.5 }} />
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Draft modal */}
      <Modal
        visible={showDraftModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => { setShowDraftModal(false); setIsProcessing(false); }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={[styles.root, { backgroundColor: tc.background }]}>
            <View style={[styles.modalHeader, {
              paddingTop: Platform.OS === 'web' ? 24 : insets.top + 12,
              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
              borderBottomColor: isDark ? '#3F3F46' : '#E4E4E7',
              borderBottomWidth: StyleSheet.hairlineWidth,
            }]}>
              <TouchableOpacity
                style={[styles.modalHeaderBtn, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}
                onPress={() => { setShowDraftModal(false); setIsProcessing(false); }}
              >
                <Text style={[styles.modalHeaderBtnText, { color: tc.textSecondary }]}>Discard</Text>
              </TouchableOpacity>

              <View style={styles.modalTitleBlock}>
                <Text style={[styles.modalTitle, { color: tc.text }]}>Draft</Text>
                <Text style={[styles.modalSubtitle, { color: tc.textSecondary }]}>{selectedImages.length + pendingAppendCount} pages</Text>
              </View>

              <TouchableOpacity
                style={[styles.modalHeaderBtn, { backgroundColor: `${Brand.indigo}18` }]}
                onPress={() => pickImages(true)}
              >
                <IconSymbol name="plus" size={17} color={Brand.indigo} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.draftScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.nameInputCard, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? '#3F3F46' : '#E4E4E7' }]}>
                <Text style={[styles.nameInputLabel, { color: tc.textSecondary }]}>Document title</Text>
                <TextInput
                  style={[styles.nameInput, { color: tc.text }]}
                  value={pdfName}
                  onChangeText={setPdfName}
                  placeholder="File name…"
                  placeholderTextColor={tc.textSecondary}
                />
              </View>

              {/* PDF Settings Card */}
              <View style={[styles.settingsCard, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? '#3F3F46' : '#E4E4E7' }]}>
                <Text style={[styles.nameInputLabel, { color: tc.textSecondary, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 4 }]}>PDF Settings</Text>

                {/* Orientation */}
                <View style={styles.settingRow}>
                  <Text style={[styles.settingTitle, { color: tc.text }]}>Orientation</Text>
                  <View style={styles.chipRow}>
                    {(['portrait', 'landscape'] as const).map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.chip, { backgroundColor: orientation === v ? Brand.indigo : (isDark ? '#27272A' : '#F4F4F5') }]}
                        onPress={() => setOrientation(v)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.chipText, { color: orientation === v ? '#FFF' : tc.textSecondary }]}>
                          {v === 'portrait' ? 'Portrait' : 'Landscape'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.settingDivider, { backgroundColor: isDark ? '#3F3F46' : '#E4E4E7' }]} />

                {/* Page Size */}
                <View style={styles.settingRow}>
                  <Text style={[styles.settingTitle, { color: tc.text }]}>Page Size</Text>
                  <View style={styles.chipRow}>
                    {(['a4', 'letter', 'fit'] as const).map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.chip, { backgroundColor: pageSize === v ? Brand.indigo : (isDark ? '#27272A' : '#F4F4F5') }]}
                        onPress={() => setPageSize(v)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.chipText, { color: pageSize === v ? '#FFF' : tc.textSecondary }]}>
                          {v === 'a4' ? 'A4' : v === 'letter' ? 'US Letter' : 'Fit'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.settingDivider, { backgroundColor: isDark ? '#3F3F46' : '#E4E4E7' }]} />

                {/* Margin */}
                <View style={styles.settingRow}>
                  <Text style={[styles.settingTitle, { color: tc.text }]}>Margin</Text>
                  <View style={styles.chipRow}>
                    {(['none', 'small', 'large'] as const).map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.chip, { backgroundColor: margin === v ? Brand.indigo : (isDark ? '#27272A' : '#F4F4F5') }]}
                        onPress={() => setMargin(v)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.chipText, { color: margin === v ? '#FFF' : tc.textSecondary }]}>
                          {v === 'none' ? 'None' : v === 'small' ? 'Small' : 'Large'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

              </View>

              <View style={styles.draftSectionRow}>
                <Text style={[styles.sectionTitle, { color: tc.textSecondary }]}>
                  Pages ({selectedImages.length + pendingAppendCount})
                </Text>
                <Text style={[styles.draftHint, { color: tc.textSecondary }]}>Hold to reorder</Text>
              </View>

              <View style={styles.draftGrid}>
                {selectedImages.map((uri, index) => (
                  <DraggableItem
                    key={uri} uri={uri} index={index}
                    total={selectedImages.length}
                    onSwap={swapImages} onRemove={removeImage}
                    colorScheme={colorScheme}
                  />
                ))}
                {Array.from({ length: pendingAppendCount }).map((_, i) => (
                  <SkeletonItem key={`pending-${i}`} />
                ))}
              </View>
            </ScrollView>

            <View style={[styles.draftFooter, {
              paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 20),
              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
              borderTopColor: isDark ? '#3F3F46' : '#E4E4E7',
              borderTopWidth: StyleSheet.hairlineWidth,
            }]}>
              {isProcessing ? (
                <Animated.View style={[styles.processingRow, pulseStyle]}>
                  <ActivityIndicator color={Brand.indigo} size="small" />
                  <Text style={[styles.processingText, { color: tc.text }]}>
                    {progressMsg || STATUS_MSGS[statusIdx]}
                  </Text>
                </Animated.View>
              ) : (
                <TouchableOpacity
                  style={[styles.generateBtn, { backgroundColor: Brand.indigo }]}
                  onPress={generatePdf}
                  activeOpacity={0.85}
                  disabled={selectedImages.length === 0}
                >
                  <IconSymbol name="doc.text.fill" size={18} color="#FFF" />
                  <Text style={styles.generateBtnText}>Generate PDF</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>

      {/* Library modal */}
      <Modal
        visible={showLibraryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowLibraryModal(false); setLibSearchQuery(''); }}
      >
        <View style={[styles.root, { backgroundColor: tc.background }]}>
          <View style={[styles.modalHeader, {
            paddingTop: Platform.OS === 'web' ? 20 : insets.top + 12,
            backgroundColor: isDark ? '#18181B' : '#FFFFFF',
            borderBottomColor: isDark ? '#3F3F46' : '#E4E4E7',
            borderBottomWidth: StyleSheet.hairlineWidth,
          }]}>
            <View style={{ width: 80 }} />
            <Text style={[styles.modalTitle, { color: tc.text }]}>Library</Text>
            <TouchableOpacity
              style={[styles.modalHeaderBtn, { backgroundColor: isDark ? '#27272A' : '#F4F4F5', width: 80 }]}
              onPress={() => setShowLibraryModal(false)}
            >
              <Text style={[styles.modalHeaderBtnText, { color: tc.textSecondary }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.searchRow, { backgroundColor: isDark ? '#27272A' : '#F4F4F5', marginHorizontal: 16, marginTop: 12 }]}>
            <IconSymbol name="magnifyingglass" size={15} color={tc.textSecondary} style={{ opacity: 0.5 }} />
            <TextInput
              style={[styles.searchInput, { color: tc.text }]}
              value={libSearchQuery}
              onChangeText={setLibSearchQuery}
              placeholder="Search documents…"
              placeholderTextColor={tc.textSecondary}
              autoCorrect={false}
            />
            {libSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setLibSearchQuery('')}>
                <View style={[styles.clearSearch, { backgroundColor: tc.textSecondary }]}>
                  <Text style={styles.clearSearchX}>✕</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredPdfs}
            keyExtractor={i => i.id}
            renderItem={renderDoc}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={[styles.emptyTitle, { color: tc.textSecondary }]}>No documents found</Text>
                <Text style={[styles.emptySub, { color: tc.textSecondary }]}>
                  {libSearchQuery ? 'Try a different search.' : 'Create your first PDF from home.'}
                </Text>
              </View>
            }
          />

          {/* Context menu inside library modal */}
          {contextMenu.visible && contextMenu.item && (
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setContextMenu(p => ({ ...p, visible: false }))}>
              <View style={[styles.ctxMenu, {
                top: contextMenu.y, left: contextMenu.x,
                backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                borderColor: isDark ? '#3F3F46' : '#E4E4E7',
              }]}>
                {[
                  { label: 'Open', icon: 'eye.fill' as const, onPress: () => openPdf(contextMenu.item!.uri) },
                  { label: 'Share', icon: 'square.and.arrow.up' as const, onPress: async () => { await Sharing.shareAsync(contextMenu.item!.uri); } },
                  { label: 'Rename', icon: 'pencil' as const, onPress: () => { setEditingId(contextMenu.item!.id); setEditingValue(contextMenu.item!.name.replace('.pdf', '')); } },
                  { label: 'Delete', icon: 'trash.fill' as const, isDestructive: true, onPress: () => {
                    Alert.alert('Delete PDF', 'This cannot be undone.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: async () => {
                        await FileSystem.deleteAsync(contextMenu.item!.uri);
                        if (contextMenu.item!.thumbnailUri) await FileSystem.deleteAsync(contextMenu.item!.thumbnailUri!);
                        setPdfs(prev => prev.filter(p => p.id !== contextMenu.item!.id));
                      }},
                    ]);
                  }},
                ].map((action, i) => (
                  <TouchableOpacity
                    key={action.label}
                    style={[styles.ctxItem, i < 3 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? '#3F3F46' : '#E4E4E7' }]}
                    onPress={() => { setContextMenu(p => ({ ...p, visible: false })); action.onPress(); }}
                  >
                    <Text style={[styles.ctxLabel, { color: action.isDestructive ? Brand.pdfRed : tc.text }]}>
                      {action.label}
                    </Text>
                    <IconSymbol name={action.icon} size={14} color={action.isDestructive ? Brand.pdfRed : tc.textSecondary} style={{ opacity: action.isDestructive ? 1 : 0.5 }} />
                  </TouchableOpacity>
                ))}
              </View>
            </Pressable>
          )}
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  guardFull: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  guardTitle: { fontSize: 16, fontWeight: '600' },

  mainList: { paddingHorizontal: 20, paddingBottom: 40 },

  withPdfsHeader: {
    paddingTop: 20,
    paddingBottom: 4,
    gap: 20,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
  },
  newPdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 12,
  },
  newPdfBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  libraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  libraryBtnText: { fontSize: 15, fontWeight: '500' },
  libraryCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  libraryCountText: { fontSize: 12, fontWeight: '600' },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600' },
  seeAll: { fontSize: 13, fontWeight: '500' },

  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
    gap: 12,
  },
  docThumbBox: { width: 44, height: 52, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F4F4F5', alignItems: 'center', justifyContent: 'center' },
  pdfBadgeSmall: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: Brand.pdfRed, borderRadius: 3,
    paddingHorizontal: 3, paddingVertical: 1,
  },
  pdfBadgeSmallText: { color: '#FFF', fontSize: 7, fontWeight: '800' },
  docInfo: { flex: 1, gap: 3 },
  docName: { fontSize: 14, fontWeight: '600' },
  docMeta: { fontSize: 12, fontWeight: '400' },
  docMenuBtn: { padding: 8 },
  renameInput: { fontSize: 14, fontWeight: '600', borderBottomWidth: 1.5, paddingVertical: 2 },

  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 19, fontWeight: '400' },

  onboarding: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 40, gap: 0 },
  onboardingIconRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 32 },
  onboardingIconBox: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  onboardingArrow: { flexDirection: 'row', alignItems: 'center', width: 44, paddingHorizontal: 4 },
  onboardingArrowLine: { flex: 1, height: 1.5 },
  onboardingArrowHead: {
    width: 0, height: 0,
    borderTopWidth: 5, borderBottomWidth: 5, borderLeftWidth: 8,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
  },
  onboardingTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6, textAlign: 'center', marginBottom: 10 },
  onboardingSub: { fontSize: 15, lineHeight: 23, fontWeight: '400', textAlign: 'center', marginBottom: 36 },
  stepsContainer: { gap: 10, marginBottom: 32 },
  stepCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14, borderWidth: StyleSheet.hairlineWidth,
  },
  stepIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepCardText: { flex: 1, gap: 2 },
  stepCardLabel: { fontSize: 15, fontWeight: '600' },
  stepCardDesc: { fontSize: 12, fontWeight: '400' },
  stepNumBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 12, fontWeight: '700' },
  onboardingCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 14, marginBottom: 16,
  },
  onboardingCtaText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  onboardingHint: { fontSize: 12, fontWeight: '400', textAlign: 'center' },

  ctxMenu: {
    position: 'absolute',
    width: 170,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  ctxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  ctxLabel: { fontSize: 14, fontWeight: '500' },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  modalHeaderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderBtnText: { fontSize: 14, fontWeight: '500' },
  modalTitleBlock: { alignItems: 'center', gap: 2 },
  modalTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 12, fontWeight: '400' },

  draftScroll: { padding: 16, gap: 16, paddingBottom: 0 },
  nameInputCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  nameInputLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  nameInput: { fontSize: 16, fontWeight: '600', paddingVertical: 2 },
  draftSectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  draftHint: { fontSize: 12, fontWeight: '400' },
  draftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingTop: 8 },
  draftCardWrap: { width: ITEM_W },
  draftCard: {
    width: ITEM_W,
    height: ITEM_W * 1.3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  draftThumb: { width: '100%', height: '100%' },
  draftRemoveBtn: { position: 'absolute', top: 6, right: 6 },
  draftRemoveCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftRemoveX: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  pageTag: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pageTagText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  draftFooter: { padding: 16, paddingTop: 12 },
  processingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  processingText: { fontSize: 14, fontWeight: '500' },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  generateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginBottom: 0,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '400' },
  clearSearch: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', opacity: 0.4 },
  clearSearchX: { color: '#FFF', fontSize: 9, fontWeight: '900' },

  settingsCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  settingRow: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingDivider: { height: StyleSheet.hairlineWidth, marginLeft: 14 },
  settingTitle: { fontSize: 15, fontWeight: '500', paddingTop: 3 },
  settingDesc: { fontSize: 12, fontWeight: '400', marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8 },
  chipText: { fontSize: 13, fontWeight: '500' },
  toggle: {
    width: 46, height: 26, borderRadius: 13, justifyContent: 'center',
  },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
});
