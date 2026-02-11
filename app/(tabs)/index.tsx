
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItem,
  Modal,
  Platform,
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
  FadeInDown,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 16;
const GAP = 12;
const ITEM_WIDTH = (SCREEN_WIDTH - (GRID_PADDING * 2) - GAP) / 2;

const STATUS_MESSAGES = [
  "Gathering images...",
  "Encoding assets...",
  "Optimizing layout...",
  "Compressing...",
  "Finalizing PDF...",
];

export default function LibraryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  
  const [pdfs, setPdfs] = useState<PdfDoc[]>([]);
  const [filteredPdfs, setFilteredPdfs] = useState<PdfDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [pdfName, setPdfName] = useState('');
  const [statusIdx, setStatusIdx] = useState(0);

  // Rename State
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renamingItem, setRenamingItem] = useState<PdfDoc | null>(null);
  const [newFileName, setNewFileName] = useState('');

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      interval = setInterval(() => {
        setStatusIdx((prev) => (prev + 1) % STATUS_MESSAGES.length);
      }, 1500);
    } else {
      setStatusIdx(0);
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
          try {
            const info = await FileSystem.getInfoAsync(fileUri);
            let size = '0 MB';
            let timestamp = 0;
            if (info.exists) {
              size = `${(info.size / (1024 * 1024)).toFixed(2)} MB`;
              timestamp = info.modificationTime || Date.now() / 1000;
            }
            return { 
              id: fileName, 
              name: fileName, 
              date: new Date(timestamp * 1000).toLocaleDateString(), 
              size, 
              uri: fileUri, 
              timestamp 
            };
          } catch (e) {
            return { id: fileName, name: fileName, date: 'Error', size: '0 MB', uri: fileUri, timestamp: 0 };
          }
        })
      );
      
      const sorted = pdfDocs.sort((a, b) => b.timestamp - a.timestamp);
      setPdfs(sorted);
      applyFilter(searchQuery, sorted);
    } catch (error) {
      console.error('Error loading library:', error);
    } finally {
      setIsLoadingLibrary(false);
      setIsRefreshing(false);
    }
  };

  const applyFilter = (query: string, data: PdfDoc[]) => {
    if (!query) {
      setFilteredPdfs(data);
    } else {
      setFilteredPdfs(data.filter(p => p.name.toLowerCase().includes(query.toLowerCase())));
    }
  };

  useEffect(() => {
    applyFilter(searchQuery, pdfs);
  }, [searchQuery, pdfs]);

  useEffect(() => {
    loadLibrary();
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadLibrary(false);
  };

  const startRename = (item: PdfDoc) => {
    setRenamingItem(item);
    setNewFileName(item.name.replace('.pdf', ''));
    setIsRenameModalVisible(true);
  };

  const confirmRename = async () => {
    if (!renamingItem || !newFileName.trim()) return;
    
    const newNameWithExt = newFileName.trim() + '.pdf';
    const docDir = FileSystem.documentDirectory;
    const newUri = `${docDir}${newNameWithExt}`;

    try {
      await FileSystem.copyAsync({ from: renamingItem.uri, to: newUri });
      await FileSystem.deleteAsync(renamingItem.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsRenameModalVisible(false);
      loadLibrary(false);
    } catch (error) {
      Alert.alert('Error', 'Could not rename file.');
    }
  };

  const deletePdf = (item: PdfDoc) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Document', `Permanently delete ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await FileSystem.deleteAsync(item.uri);
            loadLibrary(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            Alert.alert('Error', 'Could not delete file.');
          }
        }
      }
    ]);
  };

  const pickImages = async (isAppending = false) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Access to photos is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uris = result.assets.map(asset => asset.uri);
      if (isAppending) {
        setSelectedImages(prev => [...prev, ...uris]);
      } else {
        setSelectedImages(uris);
        const now = new Date();
        const dateStr = `Doc_${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
        setPdfName(dateStr);
        setShowDraftModal(true);
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    if (newImages.length === 0) setShowDraftModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const swapImages = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= selectedImages.length || toIdx >= selectedImages.length) return;
    const newImages = [...selectedImages];
    [newImages[fromIdx], newImages[toIdx]] = [newImages[toIdx], newImages[fromIdx]];
    setSelectedImages(newImages);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

      const htmlContent = `
        <!DOCTYPE html><html><head><style>
          @page { size: A4; margin: 0; }
          body { margin: 0; background: #fff; }
          .page { width: 100%; height: 100vh; display: flex; justify-content: center; align-items: center; page-break-after: always; }
          img { max-width: 95%; max-height: 95%; object-fit: contain; }
        </style></head><body>
          ${base64Images.map(base64 => `<div class="page"><img src="${base64}" /></div>`).join('')}
        </body></html>
      `;

      const { uri: tempUri } = await Print.printToFileAsync({ html: htmlContent });
      const docDir = FileSystem.documentDirectory;
      const cleanName = pdfName.replace(/[^a-z0-9_\-]/gi, '_') || 'Doc';
      const finalName = `${cleanName}.pdf`;
      await FileSystem.copyAsync({ from: tempUri, to: `${docDir}${finalName}` });
      
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

  const sharePdf = async (uri: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
  };

  // Draggable Image Component with actual Drag Logic
  const DraggableItem = ({ uri, index, total }: { uri: string, index: number, total: number }) => {
    const isDragging = useSharedValue(false);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    
    // Fix: Explicitly cast the returned style to any to resolve transform inference issues 
    // that lead to incompatible style assignments in the style array.
    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { scale: withSpring(isDragging.value ? 1.05 : 1) },
        ],
        zIndex: isDragging.value ? 1000 : 1,
        elevation: isDragging.value ? 10 : 2,
        opacity: isDragging.value ? 0.9 : 1,
      } as any;
    });

    const dragGesture = Gesture.Pan()
      .activateAfterLongPress(300)
      .onStart(() => {
        isDragging.value = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      })
      .onUpdate((e) => {
        translateX.value = e.translationX;
        translateY.value = e.translationY;

        // Logic to calculate if we should swap based on distance
        // We do a simple swap on end to keep it robust in this environment
      })
      .onEnd((e) => {
        const colShift = Math.round(e.translationX / (ITEM_WIDTH + GAP));
        const rowShift = Math.round(e.translationY / (ITEM_WIDTH * 1.25 + GAP));
        const indexShift = colShift + (rowShift * 2);
        const targetIndex = Math.max(0, Math.min(total - 1, index + indexShift));

        if (targetIndex !== index) {
          runOnJS(swapImages)(index, targetIndex);
        }

        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        isDragging.value = false;
      });

    return (
      <GestureDetector gesture={dragGesture}>
        <Animated.View 
          layout={LinearTransition.springify()} 
          style={[styles.imageCardContainer, animatedStyle]}
        >
          <View style={[styles.imageCard, { borderColor: themeColors.icon + '22' }]}>
            <Image source={{ uri }} style={styles.previewThumbnail} contentFit="cover" />
            <TouchableOpacity 
              style={styles.removeImageBtn} 
              onPress={() => removeImage(index)}
            >
              <IconSymbol name="plus" size={14} color="#FFF" style={{ transform: [{ rotate: '45deg' }] }} />
            </TouchableOpacity>
            
            <View style={styles.orderBadge}>
              <ThemedText style={styles.orderBadgeText}>{index + 1}</ThemedText>
            </View>

            <View style={styles.dragIndicator}>
              <IconSymbol name="chevron.right" size={12} color="#FFF" style={{ opacity: 0.5, transform: [{rotate: '90deg'}] }} />
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    );
  };

  const renderPdfItem: ListRenderItem<PdfDoc> = useCallback(({ item, index }) => (
    <Animated.View entering={FadeInDown.delay(index * 50)} layout={LinearTransition}>
      <TouchableOpacity 
        style={[styles.pdfCard, { backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#FFF' }]}
        onPress={() => sharePdf(item.uri)}
        onLongPress={() => deletePdf(item)}
      >
        <View style={[styles.pdfIconContainer, { backgroundColor: colorScheme === 'dark' ? '#3D0B0B' : '#FFEBEE' }]}>
          <IconSymbol name="doc.text.fill" size={24} color="#D32F2F" />
        </View>
        <View style={styles.pdfDetails}>
          <ThemedText type="defaultSemiBold" numberOfLines={1}>{item.name}</ThemedText>
          <ThemedText style={styles.pdfSubtext}>{item.date} • {item.size}</ThemedText>
        </View>
        <View style={styles.actionIcons}>
          <TouchableOpacity style={styles.iconButton} onPress={() => startRename(item)}>
            <IconSymbol name="chevron.right" size={20} color={themeColors.icon} style={{ transform: [{ rotate: '-90deg' }] }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => sharePdf(item.uri)}>
            <IconSymbol name="square.and.arrow.up" size={20} color={themeColors.icon} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  ), [colorScheme, themeColors.icon]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <View style={[styles.searchContainer, { backgroundColor: colorScheme === 'dark' ? '#121212' : '#F0F2F5' }]}>
          <IconSymbol name="info.circle.fill" size={20} color={themeColors.icon} />
          <TextInput
            style={[styles.searchInput, { color: themeColors.text }]}
            placeholder="Search library..."
            placeholderTextColor={themeColors.icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {isLoadingLibrary ? (
          <View style={styles.center}><ActivityIndicator size="large" color={themeColors.tint} /></View>
        ) : (
          <FlatList<PdfDoc>
            data={filteredPdfs}
            keyExtractor={(item) => item.id}
            renderItem={renderPdfItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={themeColors.tint} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <IconSymbol name="photo.on.rectangle.angled" size={64} color={themeColors.icon} style={{ opacity: 0.1 }} />
                <ThemedText style={styles.emptyText}>No documents found</ThemedText>
              </View>
            }
          />
        )}

        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: themeColors.tint }]} 
          onPress={() => pickImages(false)}
        >
          <IconSymbol name="plus" size={32} color="#FFF" />
        </TouchableOpacity>

        {/* Rename Modal */}
        <Modal visible={isRenameModalVisible} transparent animationType="fade">
          <View style={styles.overlay}>
            <ThemedView style={styles.dialog}>
              <ThemedText type="subtitle" style={{ marginBottom: 16 }}>Rename Document</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: colorScheme === 'dark' ? '#333' : '#F5F5F5', color: themeColors.text }]}
                value={newFileName}
                onChangeText={setNewFileName}
                autoFocus
              />
              <View style={styles.dialogButtons}>
                <TouchableOpacity onPress={() => setIsRenameModalVisible(false)} style={styles.dialogBtn}>
                  <ThemedText type="link">Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmRename} style={[styles.dialogBtn, { backgroundColor: themeColors.tint, borderRadius: 8 }]}>
                  <ThemedText style={{ color: '#FFF', fontWeight: 'bold' }}>Save</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </View>
        </Modal>

        {/* Draft Modal */}
        <Modal visible={showDraftModal} animationType="slide" presentationStyle="fullScreen">
          <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemedView style={styles.modalContainer}>
              {/* Header with Safe Area Top */}
              <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 16) }]}>
                <TouchableOpacity onPress={() => !isProcessing && setShowDraftModal(false)}>
                  <ThemedText type="link" style={{ padding: 8 }}>Cancel</ThemedText>
                </TouchableOpacity>
                <ThemedText type="subtitle">New Document</ThemedText>
                <TouchableOpacity onPress={() => pickImages(true)}>
                  <IconSymbol name="plus" size={24} color={themeColors.tint} />
                </TouchableOpacity>
              </View>
              
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
              >
                <ScrollView 
                  style={{ flex: 1 }}
                  contentContainerStyle={[styles.draftScrollContent, { paddingBottom: 120 }]}
                  showsVerticalScrollIndicator={true}
                  scrollEnabled={true}
                >
                  <View style={styles.draftSection}>
                    <ThemedText style={styles.label}>FILENAME</ThemedText>
                    <TextInput 
                      style={[styles.input, { backgroundColor: colorScheme === 'dark' ? '#121212' : '#F5F5F5', color: themeColors.text }]}
                      value={pdfName}
                      onChangeText={setPdfName}
                      placeholder="Enter filename"
                      placeholderTextColor={themeColors.icon}
                    />
                  </View>

                  <View style={styles.draftSection}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.label}>PAGES ({selectedImages.length})</ThemedText>
                      <ThemedText style={styles.hintText}>Hold & drag to reorder</ThemedText>
                    </View>
                    
                    <View style={styles.imageGrid}>
                      {selectedImages.map((uri, index) => (
                        <DraggableItem 
                          key={`${uri}-${index}`} 
                          uri={uri} 
                          index={index} 
                          total={selectedImages.length}
                        />
                      ))}
                    </View>
                  </View>
                </ScrollView>

                {/* Footer with Safe Area Bottom */}
                <ThemedView style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                  {isProcessing ? (
                    <View style={{ alignItems: 'center', padding: 12 }}>
                      <ActivityIndicator color={themeColors.tint} />
                      <ThemedText style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>
                        {STATUS_MESSAGES[statusIdx]}
                      </ThemedText>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.convertButton, { backgroundColor: themeColors.tint }]} 
                      onPress={generatePdf}
                    >
                      <ThemedText style={styles.convertButtonText}>
                        Generate PDF • {selectedImages.length} {selectedImages.length === 1 ? 'Page' : 'Pages'}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </ThemedView>
              </KeyboardAvoidingView>
            </ThemedView>
          </GestureHandlerRootView>
        </Modal>
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', margin: 16, paddingHorizontal: 16, height: 50, borderRadius: 25,
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16 },
  listContent: { padding: 16 },
  pdfCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 12,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  pdfIconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  pdfDetails: { flex: 1 },
  pdfSubtext: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  actionIcons: { flexDirection: 'row' },
  iconButton: { padding: 8, marginLeft: 4 },
  emptyState: { alignItems: 'center', marginTop: 120, opacity: 0.5 },
  emptyText: { marginTop: 16 },
  fab: {
    position: 'absolute', bottom: 32, right: 24, width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  dialog: { padding: 24, borderRadius: 24 },
  dialogButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  dialogBtn: { paddingVertical: 12, paddingHorizontal: 20, marginLeft: 8 },
  input: { height: 56, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 10, opacity: 0.5, letterSpacing: 1.2 },
  modalContainer: { flex: 1 },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingBottom: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  draftScrollContent: { padding: GRID_PADDING },
  draftSection: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  hintText: { fontSize: 11, opacity: 0.4, fontStyle: 'italic' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: GAP },
  imageCardContainer: { 
    width: ITEM_WIDTH,
  },
  imageCard: { 
    aspectRatio: 0.8, 
    borderRadius: 16, 
    overflow: 'hidden', 
    borderWidth: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  previewThumbnail: { width: '100%', height: '100%', opacity: 0.9 },
  removeImageBtn: {
    position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)',
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    zIndex: 10
  },
  orderBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, zIndex: 10
  },
  orderBadgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  dragIndicator: {
    position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 4, borderRadius: 4
  },
  footer: { 
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  convertButton: { height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  convertButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
