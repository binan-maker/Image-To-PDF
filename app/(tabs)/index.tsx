
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface PdfDoc {
  id: string;
  name: string;
  date: string;
  size: string;
  uri: string;
  timestamp: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_PADDING = 20;
const GAP = 12;
const ITEM_WIDTH = (SCREEN_WIDTH - (GRID_PADDING * 2) - GAP) / 2;

const STATUS_MESSAGES = [
  "Mixing ink...",
  "Applying paper texture...",
  "Processing filters...",
  "Flattening pages...",
  "Baking PDF...",
];

const SHEET_COLORS = [
  { label: 'Standard', hex: '#FFFFFF', text: '#000000' },
  { label: 'Ivory', hex: '#FFFBF2', text: '#1A1A1A' },
  { label: 'Slate', hex: '#2C3E50', text: '#FFFFFF' },
  { label: 'Eco Grey', hex: '#F0F0F0', text: '#333333' },
];

const IMAGE_FILTERS = [
  { id: 'none', label: 'Original', icon: 'photo.on.rectangle.angled' },
  { id: 'bw', label: 'Scanner', icon: 'checkmark.circle.fill' },
  { id: 'vivid', label: 'Vivid', icon: 'paintbrush' },
];

export default function LibraryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  
  const [pdfs, setPdfs] = useState<PdfDoc[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showFullLibrary, setShowFullLibrary] = useState(false);
  
  const [pdfName, setPdfName] = useState('');
  const [selectedColor, setSelectedColor] = useState(SHEET_COLORS[0]);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [statusIdx, setStatusIdx] = useState(0);

  // Search in full library
  const [libSearchQuery, setLibSearchQuery] = useState('');

  // Desktop Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: PdfDoc | null;
  }>({ visible: false, x: 0, y: 0, item: null });

  // In-place Rename State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      interval = setInterval(() => {
        setStatusIdx((prev) => (prev + 1) % STATUS_MESSAGES.length);
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const loadLibrary = async (showSpinner = true) => {
    if (showSpinner) setIsLoadingLibrary(true);
    try {
      const docDir = FileSystem.documentDirectory;
      if (!docDir) return;

      const files = await FileSystem.readDirectoryAsync(docDir);
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

      const pdfDocs: PdfDoc[] = await Promise.all(
        pdfFiles.map(async (fileName) => {
          const fileUri = `${docDir}${fileName}`;
          const info = await FileSystem.getInfoAsync(fileUri);
          let size = '0 MB';
          let timestamp = 0;
          if (info.exists) {
            size = `${(info.size / (1024 * 1024)).toFixed(2)} MB`;
            timestamp = info.modificationTime || Date.now() / 1000;
          }
          return { id: fileName, name: fileName, date: new Date(timestamp * 1000).toLocaleDateString(), size, uri: fileUri, timestamp };
        })
      );
      
      const sorted = pdfDocs.sort((a, b) => b.timestamp - a.timestamp);
      setPdfs(sorted);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingLibrary(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const openPdf = async (uri: string) => {
    try {
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'application/pdf',
        });
      } else {
        await Sharing.shareAsync(uri);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert('Error', 'Could not open the PDF viewer. Please ensure you have a PDF viewer app installed.');
    }
  };

  const pickImages = async (isAppending = false) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      const uris = result.assets.map(asset => asset.uri);
      if (isAppending) {
        setSelectedImages(prev => [...prev, ...uris]);
      } else {
        setSelectedImages(uris);
        const now = new Date();
        setPdfName(`Doc_${now.getHours()}${now.getMinutes()}`);
        setShowDraftModal(true);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const generatePdf = async () => {
    if (selectedImages.length === 0) return;
    setIsProcessing(true);
    try {
      const base64Images = await Promise.all(
        selectedImages.map(async (uri) => {
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
          return `data:image/jpeg;base64,${base64}`;
        })
      );

      let filterCss = '';
      if (selectedFilter === 'bw') filterCss = 'filter: grayscale(100%) contrast(1.5);';
      if (selectedFilter === 'vivid') filterCss = 'filter: saturate(1.5) contrast(1.2);';

      const htmlContent = `
        <!DOCTYPE html><html><head><style>
          @page { size: A4; margin: 0; }
          body { margin: 0; background-color: ${selectedColor.hex}; }
          .page { width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center; page-break-after: always; }
          img { max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); ${filterCss} }
        </style></head><body>
          ${base64Images.map(base64 => `<div class="page"><img src="${base64}" /></div>`).join('')}
        </body></html>
      `;

      const { uri: tempUri } = await Print.printToFileAsync({ html: htmlContent });
      const finalName = `${pdfName.trim() || 'Document'}.pdf`;
      await FileSystem.copyAsync({ from: tempUri, to: `${FileSystem.documentDirectory}${finalName}` });
      
      await loadLibrary();
      setShowDraftModal(false);
      setSelectedImages([]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Failed', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const swapImages = (fromIdx: number, toIdx: number) => {
    const newImages = [...selectedImages];
    [newImages[fromIdx], newImages[toIdx]] = [newImages[toIdx], newImages[fromIdx]];
    setSelectedImages(newImages);
  };

  const saveRename = async (item: PdfDoc) => {
    if (!editingValue.trim() || editingValue.trim() === item.name.replace('.pdf', '')) {
      setEditingId(null);
      return;
    }
    
    try {
      const newFileName = `${editingValue.trim()}.pdf`;
      const newUri = `${FileSystem.documentDirectory}${newFileName}`;
      
      const info = await FileSystem.getInfoAsync(newUri);
      if (info.exists) {
        Alert.alert('Error', 'A file with this name already exists.');
        return;
      }

      await FileSystem.copyAsync({ from: item.uri, to: newUri });
      await FileSystem.deleteAsync(item.uri);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadLibrary();
    } catch (e) {
      console.error(e);
      Alert.alert('Rename Failed', 'Could not rename the file.');
    } finally {
      setEditingId(null);
      Keyboard.dismiss();
    }
  };

  const DraggableItem = ({ uri, index, total }: { uri: string, index: number, total: number }) => {
    const isDragging = useSharedValue(false);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: withSpring(isDragging.value ? 1.05 : 1) },
      ],
      zIndex: isDragging.value ? 1000 : 1,
    } as any));

    const dragGesture = Gesture.Pan()
      .activateAfterLongPress(300)
      .onStart(() => {
        isDragging.value = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      })
      .onUpdate((e) => {
        translateX.value = e.translationX;
        translateY.value = e.translationY;
      })
      .onEnd((e) => {
        const colShift = Math.round(e.translationX / (ITEM_WIDTH + GAP));
        const rowShift = Math.round(e.translationY / (ITEM_WIDTH * 1.25 + GAP));
        const indexShift = colShift + (rowShift * 2);
        const targetIndex = Math.max(0, Math.min(total - 1, index + indexShift));
        if (targetIndex !== index) runOnJS(swapImages)(index, targetIndex);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        isDragging.value = false;
      });

    return (
      <GestureDetector gesture={dragGesture}>
        <Animated.View layout={LinearTransition.springify()} style={[styles.imageCardContainer, animatedStyle]}>
          <View style={styles.imageCard}>
            <Image source={{ uri }} style={[styles.previewThumbnail]} contentFit="cover" />
            <TouchableOpacity style={styles.removeImageBtn} onPress={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}>
              <IconSymbol name="plus" size={14} color="#FFF" style={{ transform: [{ rotate: '45deg' }] }} />
            </TouchableOpacity>
            <View style={styles.orderBadge}><ThemedText style={styles.orderBadgeText}>{index + 1}</ThemedText></View>
          </View>
        </Animated.View>
      </GestureDetector>
    );
  };

  const showContextMenu = (event: any, item: PdfDoc) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { pageX, pageY } = event.nativeEvent;
    
    const menuHeight = 160;
    const adjustedY = pageY + menuHeight > SCREEN_HEIGHT - 100 ? pageY - menuHeight : pageY;
    const menuWidth = 200;
    const adjustedX = pageX + menuWidth > SCREEN_WIDTH - 20 ? pageX - menuWidth : pageX;

    setContextMenu({
      visible: true,
      x: adjustedX,
      y: adjustedY,
      item,
    });
  };

  const renderPdfItem: ListRenderItem<PdfDoc> = useCallback(({ item, index }) => {
    const isEditing = editingId === item.id;

    return (
      <Animated.View entering={FadeInDown.delay(index * 50)} layout={LinearTransition}>
        <TouchableOpacity 
          style={[styles.pdfAssetCard, { backgroundColor: colorScheme === 'dark' ? '#1E1E22' : '#FFF' }]}
          onPress={() => !isEditing && openPdf(item.uri)}
          activeOpacity={isEditing ? 1 : 0.8}
        >
          <View style={styles.pdfAssetThumbnail}>
            <View style={styles.pdfIcon3D}>
              <IconSymbol name="doc.text.fill" size={32} color="#FFF" />
            </View>
            <View style={styles.thumbnailGloss} />
          </View>

          <View style={styles.pdfAssetDetails}>
            {isEditing ? (
              <Animated.View entering={FadeIn} exiting={FadeOut}>
                <TextInput
                  style={[styles.assetRenameInput, { color: themeColors.text }]}
                  value={editingValue}
                  onChangeText={setEditingValue}
                  autoFocus
                  selectTextOnFocus
                  onSubmitEditing={() => saveRename(item)}
                  onBlur={() => setEditingId(null)}
                  returnKeyType="done"
                />
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn} exiting={FadeOut}>
                <ThemedText style={styles.assetName} numberOfLines={1}>{item.name}</ThemedText>
              </Animated.View>
            )}
            
            <View style={styles.assetMetaRow}>
              <ThemedText style={styles.assetMetaText}>{item.date}</ThemedText>
              <View style={styles.metaDot} />
              <ThemedText style={styles.assetMetaTextMono}>{item.size}</ThemedText>
            </View>
          </View>

          {!isEditing && (
            <TouchableOpacity 
              style={styles.assetMenuBtn} 
              onPress={(e) => showContextMenu(e, item)}
            >
              <IconSymbol name="ellipsis" size={24} color={themeColors.icon} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }, [colorScheme, themeColors.icon, editingId, editingValue]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        
        <View style={styles.hubContainer}>
          <TouchableOpacity 
            style={[styles.hubButton, styles.primaryHub, { shadowColor: '#007AFF' }]} 
            onPress={() => pickImages(false)}
          >
            <View style={styles.hubIconCircle}><IconSymbol name="plus" size={26} color="#FFF" /></View>
            <View>
              <ThemedText style={styles.hubLabel}>Select Images</ThemedText>
              <ThemedText style={styles.hubSubLabel}>Start new PDF</ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.hubButton, styles.secondaryHub, { shadowColor: '#FF3B30' }]} 
            onPress={() => setShowFullLibrary(true)}
          >
            <View style={styles.hubIconCircle}><IconSymbol name="photo.on.rectangle.angled" size={26} color="#FFF" /></View>
            <View>
              <ThemedText style={styles.hubLabel}>View All PDFs</ThemedText>
              <ThemedText style={styles.hubSubLabel}>Full archive</ThemedText>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderHome}>
          <View style={styles.titleRow}>
             <View style={styles.accentBar} />
             <ThemedText style={styles.sectionTitle}>Recent Documents</ThemedText>
          </View>
          <TouchableOpacity onPress={() => setShowFullLibrary(true)} activeOpacity={0.6}>
            <ThemedText style={styles.seeMoreText}>See More {">>"}</ThemedText>
          </TouchableOpacity>
        </View>

        <FlatList<PdfDoc>
          data={pdfs.slice(0, 10)}
          keyExtractor={(item) => item.id}
          renderItem={renderPdfItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadLibrary(false)} tintColor="#007AFF" />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="photo.on.rectangle.angled" size={64} color={themeColors.icon} style={{ opacity: 0.1 }} />
              <ThemedText style={styles.emptyText}>Create your first PDF to see it here</ThemedText>
            </View>
          }
        />

        <Modal
          visible={contextMenu.visible}
          transparent
          animationType="none"
        >
          <Pressable 
            style={styles.contextMenuOverlay} 
            onPress={() => setContextMenu(prev => ({ ...prev, visible: false }))}
          >
            <Animated.View 
              entering={ZoomIn.duration(150)}
              style={[
                styles.desktopMenu, 
                { 
                  top: contextMenu.y, 
                  left: contextMenu.x,
                  backgroundColor: colorScheme === 'dark' ? '#2A2D2F' : '#FFF' 
                }
              ]}
            >
              <TouchableOpacity style={styles.desktopMenuItem} onPress={() => {
                if (!contextMenu.item) return;
                setContextMenu(prev => ({ ...prev, visible: false }));
                setEditingId(contextMenu.item.id);
                setEditingValue(contextMenu.item.name.replace('.pdf', ''));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}>
                <IconSymbol name="pencil" size={18} color={themeColors.text} />
                <ThemedText style={styles.desktopMenuText}>Rename File</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.desktopMenuItem} onPress={() => {
                if (!contextMenu.item) return;
                setContextMenu(prev => ({ ...prev, visible: false }));
                Sharing.shareAsync(contextMenu.item.uri);
              }}>
                <IconSymbol name="square.and.arrow.up" size={18} color={themeColors.text} />
                <ThemedText style={styles.desktopMenuText}>Share Document</ThemedText>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity style={styles.desktopMenuItem} onPress={() => {
                const itemToDelete = contextMenu.item;
                setContextMenu(prev => ({ ...prev, visible: false }));
                Alert.alert('Delete Permanently', `Delete ${itemToDelete?.name}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: async () => { 
                    if(itemToDelete) await FileSystem.deleteAsync(itemToDelete.uri); 
                    loadLibrary(); 
                  } }
                ]);
              }}>
                <IconSymbol name="trash.fill" size={18} color="#FF3B30" />
                <ThemedText style={[styles.desktopMenuText, { color: '#FF3B30' }]}>Delete</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </Modal>

        <Modal visible={showFullLibrary} animationType="slide" presentationStyle="fullScreen">
          <ThemedView style={styles.container}>
            <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
              <TouchableOpacity onPress={() => setShowFullLibrary(false)}><IconSymbol name="chevron.right" size={28} color={themeColors.text} style={{ transform: [{ rotate: '180deg' }] }} /></TouchableOpacity>
              <ThemedText type="subtitle">Document Archive</ThemedText>
              <View style={{ width: 28 }} />
            </View>

            <View style={[styles.searchContainer, { backgroundColor: colorScheme === 'dark' ? '#232328' : '#F5F5F7' }]}>
              <IconSymbol name="info.circle.fill" size={20} color={themeColors.icon} />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }]}
                placeholder="Search archive..."
                placeholderTextColor={themeColors.icon}
                value={libSearchQuery}
                onChangeText={setLibSearchQuery}
              />
            </View>

            <FlatList<PdfDoc>
              data={libSearchQuery ? pdfs.filter(p => p.name.toLowerCase().includes(libSearchQuery.toLowerCase())) : pdfs}
              keyExtractor={(item) => item.id}
              renderItem={renderPdfItem}
              contentContainerStyle={styles.listContent}
            />
          </ThemedView>
        </Modal>

        <Modal visible={showDraftModal} animationType="slide" presentationStyle="pageSheet">
          <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemedView style={styles.container}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowDraftModal(false)}><ThemedText type="link">Cancel</ThemedText></TouchableOpacity>
                <ThemedText type="subtitle">Craft PDF</ThemedText>
                <TouchableOpacity onPress={() => pickImages(true)}><IconSymbol name="plus" size={24} color="#007AFF" /></TouchableOpacity>
              </View>
              
              <ScrollView contentContainerStyle={styles.draftContent} showsVerticalScrollIndicator={false}>
                <ThemedText style={styles.label}>DOCUMENT TITLE</ThemedText>
                <TextInput style={[styles.input, { backgroundColor: colorScheme === 'dark' ? '#1E1E22' : '#F5F5F7', color: themeColors.text, paddingHorizontal: 20 }]} value={pdfName} onChangeText={setPdfName} />
                
                <ThemedText style={styles.label}>SHEET COLOR</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
                  {SHEET_COLORS.map((c, idx) => (
                    <TouchableOpacity key={idx} onPress={() => setSelectedColor(c)} style={[styles.colorChip, { backgroundColor: c.hex }, selectedColor.hex === c.hex && { borderColor: '#007AFF' }]}>
                      <ThemedText style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{c.label}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <ThemedText style={styles.label}>IMAGE OPTIMIZATION</ThemedText>
                <View style={styles.filterRow}>
                  {IMAGE_FILTERS.map((f) => (
                    <TouchableOpacity key={f.id} onPress={() => setSelectedFilter(f.id)} style={[styles.filterBtn, selectedFilter === f.id && { backgroundColor: '#007AFF' }]}>
                      <IconSymbol name={f.icon as any} size={18} color={selectedFilter === f.id ? '#FFF' : themeColors.icon} />
                      <ThemedText style={[styles.filterLabel, selectedFilter === f.id && { color: '#FFF' }]}>{f.label}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.label}>PAGES ({selectedImages.length})</ThemedText>
                </View>
                <View style={styles.imageGrid}>
                  {selectedImages.map((uri, index) => <DraggableItem key={`${uri}-${index}`} uri={uri} index={index} total={selectedImages.length} />)}
                </View>
              </ScrollView>

              <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                {isProcessing ? (
                  <View style={styles.center}><ActivityIndicator color="#007AFF" /><ThemedText style={styles.statusText}>{STATUS_MESSAGES[statusIdx]}</ThemedText></View>
                ) : (
                  <TouchableOpacity style={[styles.convertButton, { backgroundColor: '#1A1A1A' }]} onPress={generatePdf}>
                    <ThemedText style={styles.convertButtonText}>Generate PDF</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </ThemedView>
          </GestureHandlerRootView>
        </Modal>

      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  hubContainer: { flexDirection: 'row', gap: 14, padding: GRID_PADDING, height: 180 },
  hubButton: { flex: 1, borderRadius: 28, padding: 20, justifyContent: 'space-between', elevation: 12, shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  primaryHub: { backgroundColor: '#007AFF' },
  secondaryHub: { backgroundColor: '#FF3B30' },
  hubIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  hubLabel: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
  hubSubLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500', marginTop: 2 },
  sectionHeaderHome: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: GRID_PADDING, marginTop: 24, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  accentBar: { width: 4, height: 20, backgroundColor: '#007AFF', borderRadius: 2, marginRight: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '900', opacity: 0.9, letterSpacing: -0.5 },
  seeMoreText: { fontSize: 13, fontWeight: '700', color: '#007AFF', opacity: 0.8 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: GRID_PADDING, paddingHorizontal: 16, height: 56, borderRadius: 16 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16 },
  listContent: { padding: GRID_PADDING, paddingBottom: 100 },
  
  pdfAssetCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 24, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.06)', 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.08, 
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }
  },
  pdfAssetThumbnail: { 
    width: 64, 
    height: 72, 
    borderRadius: 16, 
    backgroundColor: '#FF4136', 
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  pdfIcon3D: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  thumbnailGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderBottomRightRadius: 64,
  },
  pdfAssetDetails: { flex: 1 },
  assetName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  assetRenameInput: { 
    fontSize: 16, 
    fontWeight: '800', 
    letterSpacing: -0.3, 
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  assetMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  assetMetaText: { fontSize: 12, opacity: 0.4, fontWeight: '600' },
  assetMetaTextMono: { fontSize: 12, opacity: 0.4, fontWeight: '700', fontFamily: 'monospace' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(0,0,0,0.2)', marginHorizontal: 8 },
  assetMenuBtn: { padding: 12 },

  contextMenuOverlay: { flex: 1, backgroundColor: 'transparent' },
  desktopMenu: {
    position: 'absolute',
    width: 200,
    borderRadius: 14,
    padding: 6,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  desktopMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  desktopMenuText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 4,
    marginHorizontal: 8,
  },

  emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.5, paddingHorizontal: 40 },
  emptyText: { marginTop: 16, textAlign: 'center', fontSize: 15, fontWeight: '500' },
  input: { height: 64, borderRadius: 20, fontSize: 16, marginBottom: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 24, alignItems: 'center' },
  draftContent: { padding: GRID_PADDING, paddingBottom: 150 },
  label: { fontSize: 11, fontWeight: '900', marginBottom: 14, opacity: 0.4, letterSpacing: 1.5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  imageCardContainer: { width: ITEM_WIDTH },
  imageCard: { aspectRatio: 0.75, borderRadius: 24, overflow: 'hidden', backgroundColor: '#F0F0F0', elevation: 5 },
  previewThumbnail: { width: '100%', height: '100%' },
  removeImageBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.65)', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  orderBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  orderBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  hScroll: { marginBottom: 24 },
  colorChip: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 18, marginRight: 12, borderWidth: 2, borderColor: 'transparent' },
  filterRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  filterBtn: { flex: 1, height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)' },
  filterLabel: { marginLeft: 10, fontSize: 13, fontWeight: '700' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  convertButton: { height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  convertButtonText: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  statusText: { marginTop: 18, fontSize: 14, opacity: 0.7, fontWeight: '700' },
});
