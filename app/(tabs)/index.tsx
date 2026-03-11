import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
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
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
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
  'Finalizing PDF…',
  'Almost done…',
];

const SkeletonItem = () => {
  const opacity = useSharedValue(0.25);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.55, { duration: 900 }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.draftCard, styles.skeleton, style]} />;
};

const DraggableItem = memo(({
  uri, index, total, onSwap, onRemove, colorScheme,
}: {
  uri: string; index: number; total: number;
  onSwap: (f: number, t: number) => void;
  onRemove: (i: number) => void;
  colorScheme: 'light' | 'dark';
}) => {
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
      <Animated.View
        entering={FadeIn.duration(250)}
        layout={LinearTransition.springify()}
        style={[styles.draftCardWrap, animStyle]}
      >
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
  const [isPreparingDraft, setIsPreparingDraft] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [pdfName, setPdfName] = useState('');
  const [statusIdx, setStatusIdx] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [libSearchQuery, setLibSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean; x: number; y: number; item: PdfDoc | null;
  }>({ visible: false, x: 0, y: 0, item: null });

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
    setIsSelecting(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.7,
      });
      if (result.canceled) { setIsSelecting(false); return; }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!appending) setPdfName(`PDF_${Math.floor(100000 + Math.random() * 900000)}`);
      const uris = result.assets.map(a => a.uri);
      setShowDraftModal(true);
      setIsPreparingDraft(true);
      setTimeout(() => {
        if (appending) setSelectedImages(prev => [...prev, ...uris]);
        else setSelectedImages(uris);
        setIsPreparingDraft(false);
        setIsSelecting(false);
      }, 700);
    } catch { setIsSelecting(false); setIsPreparingDraft(false); Alert.alert('Error', 'Could not load images.'); }
  };

  const generatePdf = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('No Images', 'Add at least one image.'); return;
    }
    setIsProcessing(true);
    const tempUris: string[] = [];
    try {
      let html = '';
      for (let i = 0; i < selectedImages.length; i++) {
        setProgressMsg(`Optimizing ${i + 1} of ${selectedImages.length}…`);
        const r = await ImageManipulator.manipulateAsync(
          selectedImages[i], [{ resize: { width: 750 } }],
          { compress: 0.45, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        html += `<div class="page"><img src="data:image/jpeg;base64,${r.base64}" /></div>`;
        if (i === 0) tempUris.push(r.uri);
        if (i % 15 === 0 && Platform.OS !== 'web') await new Promise(res => setTimeout(res, 50));
      }
      setProgressMsg('Building PDF…');
      const fullHtml = `<!DOCTYPE html><html><head><style>
        @page{size:A4;margin:0}body{margin:0;padding:0;background:#fff}
        .page{width:100vw;height:100vh;display:flex;justify-content:center;align-items:center;page-break-after:always;overflow:hidden}
        img{max-width:96%;max-height:96%;object-fit:contain}
      </style></head><body>${html}</body></html>`;
      const { uri: tmp } = await Print.printToFileAsync({ html: fullHtml });
      const dir = FileSystem.documentDirectory;
      if (!dir) throw new Error('No storage');
      const base = (pdfName.trim() || `Doc_${Date.now()}`).replace(/[^a-z0-9._-]/gi, '_');
      const dest = `${dir}${base}.pdf`;
      const thumbDest = dest.replace('.pdf', '.jpg');
      await FileSystem.copyAsync({ from: tmp, to: dest });
      if (tempUris.length > 0) await FileSystem.copyAsync({ from: tempUris[0], to: thumbDest });
      await loadLibrary(false);
      setShowDraftModal(false);
      setSelectedImages([]);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Could not create PDF. Try fewer images or close background apps.');
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

  const showCtx = (e: any, item: PdfDoc) => {
    const { pageX, pageY } = e.nativeEvent;
    setContextMenu({ visible: true, x: Math.min(pageX, SW - 200), y: Math.min(pageY, SH - 160), item });
  };

  const recentData = useMemo(() => {
    const sliced = pdfs.slice(0, 5);
    if (pdfs.length > 5) return [...sliced, { id: 'ghost', isGhost: true } as PdfDoc];
    return sliced;
  }, [pdfs]);

  const filteredPdfs = useMemo(() => {
    if (!libSearchQuery.trim()) return pdfs;
    return pdfs.filter(p => p.name.toLowerCase().includes(libSearchQuery.toLowerCase()));
  }, [pdfs, libSearchQuery]);

  const renderDoc: ListRenderItem<PdfDoc> = useCallback(({ item, index }) => {
    if (item.isGhost) {
      return (
        <Animated.View entering={FadeInDown.delay(index * 40)} layout={LinearTransition}>
          <TouchableOpacity
            style={[styles.docCard, { backgroundColor: tc.surface }]}
            onPress={() => setShowLibraryModal(true)}
            activeOpacity={0.75}
          >
            <View style={[styles.docThumbBox, { backgroundColor: `${Brand.indigo}15` }]}>
              <IconSymbol name="photo.on.rectangle.angled" size={22} color={Brand.indigo} />
            </View>
            <View style={styles.docInfo}>
              <Text style={[styles.docName, { color: Brand.indigo }]}>View full library</Text>
              <Text style={[styles.docMeta, { color: tc.textSecondary }]}>+{pdfs.length - 5} more documents</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={Brand.indigo} />
          </TouchableOpacity>
        </Animated.View>
      );
    }

    const isEditing = editingId === item.id;
    const name = item.name.replace(/\.pdf$/i, '');

    return (
      <Animated.View entering={FadeInDown.delay(index * 40)} layout={LinearTransition}>
        <TouchableOpacity
          style={[styles.docCard, { backgroundColor: tc.surface }]}
          onPress={() => !isEditing && openPdf(item.uri)}
          activeOpacity={isEditing ? 1 : 0.75}
        >
          <View style={styles.docThumbBox}>
            {item.thumbnailUri ? (
              <Image source={{ uri: item.thumbnailUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: `${Brand.pdfRed}15`, alignItems: 'center', justifyContent: 'center' }]}>
                <IconSymbol name="doc.text.fill" size={22} color={Brand.pdfRed} />
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
            <TouchableOpacity style={styles.docMenuBtn} onPress={(e) => showCtx(e, item)}>
              <IconSymbol name="ellipsis" size={18} color={tc.icon} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }, [colorScheme, editingId, editingValue, pdfs.length, tc]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 0 : 0;

  if (isSelecting) {
    return (
      <View style={[styles.guardFull, { backgroundColor: isDark ? '#09090B' : '#F1F5F9' }]}>
        <Animated.View entering={FadeIn.duration(200)} style={styles.guardBox}>
          <ActivityIndicator color={Brand.indigo} size="large" />
          <Text style={[styles.guardTitle, { color: tc.text }]}>Loading Images</Text>
          <Text style={[styles.guardSub, { color: tc.textSecondary }]}>Preparing your selection…</Text>
        </Animated.View>
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
          contentContainerStyle={[styles.mainList, { paddingBottom: botPad + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadLibrary(false)} tintColor={Brand.indigo} />}
          ListHeaderComponent={
            <View>
              <View style={[styles.hero, { backgroundColor: isDark ? '#18181B' : '#FFFFFF' }]}>
                <View style={styles.heroContent}>
                  <View style={styles.heroVisual}>
                    <View style={[styles.heroIconBox, { backgroundColor: `${Brand.indigo}18` }]}>
                      <IconSymbol name="photo.on.rectangle.angled" size={32} color={Brand.indigo} />
                    </View>
                    <View style={styles.heroArrowBox}>
                      <View style={styles.heroArrowLine} />
                      <View style={[styles.heroArrowHead, { borderLeftColor: Brand.pdfRed }]} />
                    </View>
                    <View style={[styles.heroIconBox, { backgroundColor: `${Brand.pdfRed}18` }]}>
                      <IconSymbol name="doc.text.fill" size={32} color={Brand.pdfRed} />
                    </View>
                  </View>
                  <Text style={[styles.heroTitle, { color: tc.text }]}>Images to PDF</Text>
                  <Text style={[styles.heroSub, { color: tc.textSecondary }]}>
                    Select photos · arrange · export as a professional PDF — all on-device.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.ctaBtn, { backgroundColor: Brand.indigo }]}
                  onPress={() => pickImages(false)}
                  activeOpacity={0.85}
                >
                  <IconSymbol name="plus" size={20} color="#FFF" />
                  <Text style={styles.ctaBtnText}>Select Images</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.ctaBtnSecondary, { backgroundColor: isDark ? '#27272A' : '#F1F5F9', borderColor: tc.border }]}
                  onPress={() => setShowLibraryModal(true)}
                  activeOpacity={0.85}
                >
                  <IconSymbol name="photo.on.rectangle.angled" size={18} color={tc.icon} />
                  <Text style={[styles.ctaBtnSecondaryText, { color: tc.text }]}>View All PDFs</Text>
                  {pdfs.length > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: Brand.indigo }]}>
                      <Text style={styles.countBadgeText}>{pdfs.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.sectionRow}>
                <Text style={[styles.sectionTitle, { color: tc.textSecondary }]}>RECENT</Text>
                {pdfs.length > 0 && (
                  <TouchableOpacity onPress={() => setShowLibraryModal(true)}>
                    <Text style={[styles.seeAll, { color: Brand.indigo }]}>See all</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#27272A' : '#E2E8F0' }]}>
                <IconSymbol name="doc.text.fill" size={28} color={tc.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: tc.text }]}>No PDFs yet</Text>
              <Text style={[styles.emptySub, { color: tc.textSecondary }]}>Tap "Select Images" above to create your first PDF</Text>
            </View>
          }
        />

        {contextMenu.visible && contextMenu.item && (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setContextMenu(p => ({ ...p, visible: false }))}>
            <Animated.View
              entering={ZoomIn.springify().damping(20)}
              style={[styles.ctxMenu, {
                top: contextMenu.y, left: contextMenu.x,
                backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                borderColor: tc.border,
              }]}
            >
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
                  style={[styles.ctxItem, i < 3 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tc.border }]}
                  onPress={() => { setContextMenu(p => ({ ...p, visible: false })); action.onPress(); }}
                >
                  <Text style={[styles.ctxLabel, action.isDestructive && { color: Brand.pdfRed }, { color: action.isDestructive ? Brand.pdfRed : tc.text }]}>
                    {action.label}
                  </Text>
                  <IconSymbol name={action.icon} size={15} color={action.isDestructive ? Brand.pdfRed : tc.icon} />
                </TouchableOpacity>
              ))}
            </Animated.View>
          </Pressable>
        )}
      </View>

      <Modal visible={showDraftModal} animationType="slide" presentationStyle="fullScreen">
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={[styles.root, { backgroundColor: tc.background }]}>
            <View style={[styles.modalHeader, {
              paddingTop: Platform.OS === 'web' ? 67 : insets.top + 12,
              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
              borderBottomColor: tc.border,
              borderBottomWidth: StyleSheet.hairlineWidth,
            }]}>
              <TouchableOpacity
                style={[styles.modalHeaderBtn, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}
                onPress={() => { setShowDraftModal(false); setIsProcessing(false); setIsPreparingDraft(false); }}
              >
                <Text style={[styles.modalHeaderBtnText, { color: tc.textSecondary }]}>Discard</Text>
              </TouchableOpacity>

              <View style={styles.modalTitleBlock}>
                <Text style={[styles.modalTitle, { color: tc.text }]}>Draft</Text>
                <View style={[styles.pagePill, { backgroundColor: `${Brand.indigo}20` }]}>
                  <Text style={[styles.pagePillText, { color: Brand.indigo }]}>{selectedImages.length} pages</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.modalHeaderBtn, { backgroundColor: `${Brand.indigo}20` }]}
                onPress={() => pickImages(true)}
              >
                <IconSymbol name="plus" size={18} color={Brand.indigo} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.draftScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.nameInputCard, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: tc.border }]}>
                <Text style={[styles.nameInputLabel, { color: tc.textSecondary }]}>DOCUMENT TITLE</Text>
                <TextInput
                  style={[styles.nameInput, { color: tc.text }]}
                  value={pdfName}
                  onChangeText={setPdfName}
                  placeholder="Enter file name…"
                  placeholderTextColor={tc.textSecondary}
                />
              </View>

              <View style={styles.draftSectionRow}>
                <Text style={[styles.sectionTitle, { color: tc.textSecondary }]}>
                  {isPreparingDraft ? 'LOADING…' : `PAGES (${selectedImages.length})`}
                </Text>
                {!isPreparingDraft && (
                  <Text style={[styles.draftHint, { color: tc.textSecondary }]}>Hold to reorder</Text>
                )}
              </View>

              <View style={styles.draftGrid}>
                {isPreparingDraft
                  ? [0,1,2,3].map(i => <SkeletonItem key={i} />)
                  : selectedImages.map((uri, index) => (
                    <DraggableItem
                      key={uri} uri={uri} index={index}
                      total={selectedImages.length}
                      onSwap={swapImages} onRemove={removeImage}
                      colorScheme={colorScheme}
                    />
                  ))
                }
              </View>
            </ScrollView>

            <View style={[styles.draftFooter, {
              paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 20),
              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
              borderTopColor: tc.border,
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
                  style={[styles.generateBtn, { backgroundColor: Brand.pdfRed }]}
                  onPress={generatePdf}
                  activeOpacity={0.85}
                  disabled={selectedImages.length === 0}
                >
                  <IconSymbol name="doc.text.fill" size={20} color="#FFF" />
                  <Text style={styles.generateBtnText}>Generate PDF</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>

      <Modal visible={showLibraryModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.root, { backgroundColor: tc.background }]}>
          <View style={[styles.modalHeader, {
            paddingTop: Platform.OS === 'web' ? 20 : insets.top + 12,
            backgroundColor: isDark ? '#18181B' : '#FFFFFF',
            borderBottomColor: tc.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
          }]}>
            <View style={{ width: 80 }} />
            <Text style={[styles.modalTitle, { color: tc.text }]}>Library</Text>
            <TouchableOpacity
              style={[styles.modalHeaderBtn, { backgroundColor: isDark ? '#27272A' : '#F1F5F9', width: 80 }]}
              onPress={() => setShowLibraryModal(false)}
            >
              <Text style={[styles.modalHeaderBtnText, { color: tc.textSecondary }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.searchRow, { backgroundColor: isDark ? '#27272A' : '#F1F5F9', marginHorizontal: 16, marginTop: 12 }]}>
            <IconSymbol name="magnifyingglass" size={16} color={tc.textSecondary} />
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
                <Text style={[styles.emptyTitle, { color: tc.text }]}>No documents found</Text>
                <Text style={[styles.emptySub, { color: tc.textSecondary }]}>
                  {libSearchQuery ? 'Try a different search term.' : 'Create your first PDF from the home screen.'}
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  guardFull: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  guardBox: { alignItems: 'center', gap: 12 },
  guardTitle: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  guardSub: { fontSize: 14, textAlign: 'center' },

  mainList: { paddingHorizontal: 16, gap: 0 },

  hero: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heroContent: { alignItems: 'center', paddingVertical: 8 },
  heroVisual: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  heroIconBox: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroArrowBox: { flexDirection: 'row', alignItems: 'center', width: 32 },
  heroArrowLine: { flex: 1, height: 2, backgroundColor: '#CBD5E1' },
  heroArrowHead: {
    width: 0, height: 0,
    borderTopWidth: 6, borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
  },
  heroTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  heroSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 6, maxWidth: 280 },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15, borderRadius: 14,
    shadowColor: Brand.indigo, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  ctaBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  ctaBtnSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1,
  },
  ctaBtnSecondaryText: { fontSize: 15, fontWeight: '600' },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginLeft: 4 },
  countBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  seeAll: { fontSize: 13, fontWeight: '700' },

  docCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14, marginBottom: 8,
    padding: 12, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  docThumbBox: { width: 48, height: 56, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  pdfBadgeSmall: {
    position: 'absolute', bottom: 3, right: 3,
    backgroundColor: Brand.pdfRed, borderRadius: 3,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  pdfBadgeSmallText: { color: '#FFF', fontSize: 7, fontWeight: '900' },
  docInfo: { flex: 1, gap: 4 },
  docName: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  docMeta: { fontSize: 12, fontWeight: '500' },
  docMenuBtn: { padding: 8 },
  renameInput: { fontSize: 14, fontWeight: '700', borderBottomWidth: 2, paddingVertical: 2 },

  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', maxWidth: 240, lineHeight: 18 },

  ctxMenu: {
    position: 'absolute', width: 180, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 10, overflow: 'hidden',
  },
  ctxItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  ctxLabel: { fontSize: 14, fontWeight: '600' },

  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  modalHeaderBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalHeaderBtnText: { fontSize: 14, fontWeight: '600' },
  modalTitleBlock: { alignItems: 'center', gap: 4 },
  modalTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  pagePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  pagePillText: { fontSize: 11, fontWeight: '700' },

  draftScroll: { padding: 16, gap: 16, paddingBottom: 0 },
  nameInputCard: {
    borderRadius: 14, padding: 14, borderWidth: 1, gap: 6,
  },
  nameInputLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  nameInput: { fontSize: 16, fontWeight: '700', paddingVertical: 2 },
  draftSectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  draftHint: { fontSize: 11, fontWeight: '500' },
  draftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingTop: 8 },
  draftCardWrap: { width: ITEM_W },
  draftCard: {
    width: ITEM_W, height: ITEM_W * 1.3, borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  skeleton: { backgroundColor: '#CBD5E1' },
  draftThumb: { width: '100%', height: '100%' },
  draftRemoveBtn: { position: 'absolute', top: 6, right: 6 },
  draftRemoveCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center',
  },
  draftRemoveX: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  pageTag: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  pageTagText: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  draftFooter: { padding: 16, paddingTop: 12 },
  processingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  processingText: { fontSize: 14, fontWeight: '600' },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15, borderRadius: 14,
    shadowColor: Brand.pdfRed, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  generateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 0,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  clearSearch: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', opacity: 0.5 },
  clearSearchX: { color: '#FFF', fontSize: 9, fontWeight: '900' },
});
