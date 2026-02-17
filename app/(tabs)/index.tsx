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
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
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
  thumbnailUri?: string;
  timestamp: number;
  isGhost?: boolean; 
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_PADDING = 20;
const GAP = 12;
const ITEM_WIDTH = (SCREEN_WIDTH - (GRID_PADDING * 2) - GAP) / 2;

const PDF_RED = '#E53935';
const ACCENT_BLUE = '#007AFF';

const STATUS_MESSAGES = [
  "Mixing premium ink...",
  "Applying paper texture...",
  "Stitching pages together...",
  "Finalizing document layers...",
  "Baking your PDF file...",
];

const SelectionGuard = memo(({ message }: { message?: string }) => {
  return (
    <Animated.View 
      entering={FadeIn.duration(100)} 
      exiting={FadeOut.duration(200)} 
      style={[styles.selectionGuard, StyleSheet.absoluteFill]}
    >
      <View style={styles.guardContent}>
        <ActivityIndicator color={PDF_RED} size="large" />
        <ThemedText style={styles.guardTitle}>STITCHING YOUR STORY</ThemedText>
        <ThemedText style={styles.guardSubtitle}>{message || "Preparing your boutique workspace..."}</ThemedText>
      </View>
    </Animated.View>
  );
});

const SkeletonItem = () => {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.6, { duration: 1000 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.imageCard, styles.skeletonBox, animatedStyle]} />
  );
};

const DraggableItem = memo(({ 
  uri, 
  index, 
  total, 
  onSwap, 
  onRemove 
}: { 
  uri: string, 
  index: number, 
  total: number, 
  onSwap: (from: number, to: number) => void,
  onRemove: (idx: number) => void
}) => {
  const isDragging = useSharedValue(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: withSpring(isDragging.value ? 1.08 : 1) },
    ],
    zIndex: isDragging.value ? 1000 : 1,
    shadowOpacity: withSpring(isDragging.value ? 0.3 : 0.08),
  } as any));

  const dragGesture = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const colShift = Math.round(e.translationX / (ITEM_WIDTH + GAP));
      const rowShift = Math.round(e.translationY / (ITEM_WIDTH + GAP));
      const indexShift = colShift + (rowShift * 2);
      const targetIndex = Math.max(0, Math.min(total - 1, index + indexShift));
      if (targetIndex !== index) runOnJS(onSwap)(index, targetIndex);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      isDragging.value = false;
    });

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View entering={FadeIn.duration(300)} layout={LinearTransition.springify()} style={[styles.imageCardContainer, animatedStyle]}>
        <View style={styles.imageCard}>
          <Image source={{ uri }} style={[styles.previewThumbnail]} contentFit="cover" cachePolicy="memory-disk" />
          
          <TouchableOpacity 
            style={styles.removeImageBtn} 
            onPress={() => onRemove(index)}
          >
            <View style={styles.removeIconCircle}>
              <IconSymbol name="plus" size={12} color="#FFF" style={{ transform: [{ rotate: '45deg' }] }} />
            </View>
          </TouchableOpacity>

          <View style={styles.orderRibbon}>
            <ThemedText style={styles.orderRibbonText}>PG {index + 1}</ThemedText>
          </View>
          
          <View style={styles.thumbnailGloss} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

export default function LibraryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  
  const [pdfs, setPdfs] = useState<PdfDoc[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreparingDraft, setIsPreparingDraft] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showFullLibrary, setShowFullLibrary] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  
  const [pdfName, setPdfName] = useState('');
  const [statusIdx, setStatusIdx] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [libSearchQuery, setLibSearchQuery] = useState('');

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: PdfDoc | null;
  }>({ visible: false, x: 0, y: 0, item: null });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const pulse = useSharedValue(1);

  // FIX: Created an animated style to avoid reading shared value during render
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  useEffect(() => {
    if (isProcessing) {
      pulse.value = withRepeat(
        withSequence(withTiming(1.05, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1,
        false
      );
    } else {
      pulse.value = 1;
    }
  }, [isProcessing]);

  useEffect(() => {
    let interval: any;
    if (isProcessing && !progressMsg) {
      interval = setInterval(() => {
        setStatusIdx((prev) => (prev + 1) % STATUS_MESSAGES.length);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isProcessing, progressMsg]);

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
          const thumbUri = `${docDir}${fileName.replace('.pdf', '.jpg')}`;
          
          const info = await FileSystem.getInfoAsync(fileUri);
          const thumbInfo = await FileSystem.getInfoAsync(thumbUri);
          
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
            thumbnailUri: thumbInfo.exists ? thumbUri : undefined,
            timestamp 
          };
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
    } catch (error) {
      Alert.alert('Error', 'Could not open the PDF viewer.');
    }
  };

  const pickImages = async (isAppending = false) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    setIsSelecting(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.7,
      });

      if (result.canceled) {
        setIsSelecting(false);
        return;
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (!isAppending) {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        setPdfName(`PDF_${randomNum}`);
      }

      const uris = result.assets.map(asset => asset.uri);
      
      setShowDraftModal(true);
      setIsPreparingDraft(true);

      setTimeout(() => {
        if (isAppending) {
          setSelectedImages(prev => [...prev, ...uris]);
        } else {
          setSelectedImages(uris);
        }
        setIsPreparingDraft(false);
        setIsSelecting(false);
      }, 800);
    } catch (e) {
      setIsSelecting(false);
      setIsPreparingDraft(false);
      Alert.alert("Error", "Could not load images.");
    }
  };

  const generatePdf = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('No Pages', 'Please add at least one image to create a PDF.');
      return;
    }
    
    setIsProcessing(true);
    const tempResizedUris: string[] = [];
    try {
      let htmlPages = "";
      const total = selectedImages.length;
      
      // OPTIMIZATION: Sequential processing with lower width to fit bridge payload limits
      for (let i = 0; i < total; i++) {
        const uri = selectedImages[i];
        setProgressMsg(`Optimizing page ${i + 1} of ${total}...`);
        
        // 750px width is perfect for mobile sharing and keeps the payload under the native bridge limit even for 100+ pages
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 750 } }], 
          { compress: 0.45, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        
        htmlPages += `<div class="page"><img src="data:image/jpeg;base64,${manipResult.base64}" /></div>`;
        
        if (i === 0) {
          tempResizedUris.push(manipResult.uri);
        }

        // Give JS thread room to breathe and process UI updates/GC
        if (i % 15 === 0 && Platform.OS !== 'web') {
           await new Promise(r => setTimeout(r, 60));
        }
      }

      setProgressMsg('Baking boutique PDF...');
      
      const htmlContent = `
        <!DOCTYPE html><html><head><style>
          @page { size: A4; margin: 0; }
          body { margin: 0; padding: 0; background-color: #FFFFFF; font-family: sans-serif; }
          .page { width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center; page-break-after: always; overflow: hidden; }
          img { max-width: 96%; max-height: 96%; object-fit: contain; }
        </style></head><body>
          ${htmlPages}
        </body></html>
      `;

      const { uri: tempUri } = await Print.printToFileAsync({ html: htmlContent });
      const docDir = FileSystem.documentDirectory;
      if (!docDir) throw new Error("Storage unavailable");

      const finalBaseName = pdfName.trim() || `Document_${Math.floor(Date.now()/1000)}`;
      const finalFileName = `${finalBaseName}.pdf`.replace(/[^a-z0-9._-]/gi, '_');
      const destination = `${docDir}${finalFileName}`;
      const thumbDestination = destination.replace('.pdf', '.jpg');
      
      await FileSystem.copyAsync({ from: tempUri, to: destination });
      if (tempResizedUris.length > 0) {
        await FileSystem.copyAsync({ from: tempResizedUris[0], to: thumbDestination });
      }
      
      await loadLibrary(false);
      setShowDraftModal(false);
      setSelectedImages([]);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Memory Exhausted', 'For documents with 100+ images, please ensure your phone has enough free RAM. Try closing background apps or generating in two separate PDFs.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const swapImages = useCallback((fromIdx: number, toIdx: number) => {
    setSelectedImages(prev => {
      const newImages = [...prev];
      [newImages[fromIdx], newImages[toIdx]] = [newImages[toIdx], newImages[fromIdx]];
      return newImages;
    });
  }, []);

  const removeImage = useCallback((idx: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const saveRename = async (item: PdfDoc) => {
    const currentBaseName = item.name.replace('.pdf', '');
    const newValue = editingValue.trim();
    
    if (!newValue || newValue === currentBaseName) {
      setEditingId(null);
      return;
    }
    
    try {
      const newFileName = `${newValue}.pdf`;
      const newUri = `${FileSystem.documentDirectory}${newFileName}`;
      const newThumbUri = newUri.replace('.pdf', '.jpg');
      
      const info = await FileSystem.getInfoAsync(newUri);
      if (info.exists) {
        Alert.alert('Error', 'A file with this name already exists.');
        setEditingId(null);
        return;
      }

      await FileSystem.copyAsync({ from: item.uri, to: newUri });
      await FileSystem.deleteAsync(item.uri);
      
      if (item.thumbnailUri) {
        await FileSystem.copyAsync({ from: item.thumbnailUri, to: newThumbUri });
        await FileSystem.deleteAsync(item.thumbnailUri);
      }
      
      setPdfs(prev => prev.map(p => {
        if (p.id === item.id) {
          return {
            ...p,
            id: newFileName,
            name: newFileName,
            uri: newUri,
            thumbnailUri: p.thumbnailUri ? newThumbUri : undefined
          };
        }
        return p;
      }));
    } catch (e) {
      console.error(e);
      Alert.alert('Rename Failed', 'Could not rename the file.');
    } finally {
      setEditingId(null);
    }
  };

  const showContextMenu = (event: any, item: PdfDoc) => {
    const { pageX, pageY } = event.nativeEvent;
    const adjustedX = Math.min(pageX, SCREEN_WIDTH - 200);
    const adjustedY = Math.min(pageY, SCREEN_HEIGHT - 200);

    setContextMenu({
      visible: true,
      x: adjustedX,
      y: adjustedY,
      item,
    });
  };

  const boutiqueRecentData = useMemo(() => {
    const sliced = pdfs.slice(0, 5);
    if (pdfs.length > 5) {
      return [...sliced, { id: 'ghost_history_card', isGhost: true } as PdfDoc];
    }
    return sliced;
  }, [pdfs]);

  const renderPdfItem: ListRenderItem<PdfDoc> = useCallback(({ item, index }) => {
    if (item.isGhost) {
      const remainingCount = pdfs.length - 5;
      return (
        <Animated.View entering={FadeInDown.delay(index * 50)} layout={LinearTransition}>
          <TouchableOpacity 
            style={[styles.ghostHistoryCard, { backgroundColor: colorScheme === 'dark' ? 'rgba(0,122,255,0.05)' : 'rgba(255,255,255,0.5)' }]}
            onPress={() => setShowFullLibrary(true)}
            activeOpacity={0.7}
          >
            <View style={styles.ghostIconWrapper}>
              <IconSymbol name="photo.on.rectangle.angled" size={24} color={ACCENT_BLUE} />
            </View>
            <View style={styles.pdfAssetDetails}>
              <ThemedText style={styles.ghostTitle}>Explore Full Archive</ThemedText>
              <ThemedText style={styles.ghostSubtitle}>+{remainingCount} documents waiting for you</ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={16} color={ACCENT_BLUE} style={{ opacity: 0.5 }} />
          </TouchableOpacity>
        </Animated.View>
      );
    }

    const isEditing = editingId === item.id;
    const displayName = item.name.replace(/\.pdf$/i, '');

    return (
      <Animated.View entering={FadeInDown.delay(index * 50)} layout={LinearTransition}>
        <TouchableOpacity 
          style={[styles.pdfAssetCard, { backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}
          onPress={() => !isEditing && openPdf(item.uri)}
          activeOpacity={isEditing ? 1 : 0.8}
        >
          <View style={styles.pdfAssetThumbnail}>
            {item.thumbnailUri ? (
              <Image source={{ uri: item.thumbnailUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={styles.pdfIcon3D}>
                <IconSymbol name="doc.text.fill" size={24} color="#FFF" />
              </View>
            )}
            
            <View style={styles.pdfRibbon}>
              <ThemedText style={styles.pdfRibbonText}>PDF</ThemedText>
            </View>

            <View style={styles.thumbnailGloss} />
          </View>

          <View style={styles.pdfAssetDetails}>
            {isEditing ? (
              <TextInput
                style={[styles.assetRenameInput, { color: themeColors.text }]}
                value={editingValue}
                onChangeText={setEditingValue}
                autoFocus
                selectTextOnFocus
                onSubmitEditing={() => Keyboard.dismiss()} 
                onBlur={() => saveRename(item)} 
                returnKeyType="done"
              />
            ) : (
              <View style={styles.assetNameRow}>
                <IconSymbol name="doc.text.fill" size={10} color={PDF_RED} style={{ marginRight: 6, opacity: 0.7 }} />
                <ThemedText style={styles.assetName} numberOfLines={1}>{displayName}</ThemedText>
              </View>
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
              <IconSymbol name="ellipsis" size={18} color={themeColors.icon} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }, [colorScheme, themeColors.icon, editingId, editingValue, themeColors.text, pdfs.length]);

  // FIX: Hooks defined above, now safe to return SelectionGuard conditionally if needed
  if (isSelecting) {
    return <SelectionGuard message={progressMsg} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <View style={styles.hubContainer}>
          <TouchableOpacity 
            style={[styles.hubButton, styles.primaryHub]} 
            onPress={() => pickImages(false)}
          >
            <View style={styles.hubIconCircle}><IconSymbol name="plus" size={20} color="#FFF" /></View>
            <View>
              <ThemedText style={styles.hubLabel}>Select Images</ThemedText>
              <ThemedText style={styles.hubSubLabel}>Start new PDF</ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.hubButton, styles.secondaryHub]} 
            onPress={() => setShowFullLibrary(true)}
          >
            <View style={styles.hubIconCircle}><IconSymbol name="photo.on.rectangle.angled" size={20} color="#FFF" /></View>
            <View>
              <ThemedText style={styles.hubLabel}>View All PDFs</ThemedText>
              <ThemedText style={styles.hubSubLabel}>Full archive</ThemedText>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderHome}>
          <View style={styles.titleRow}>
             <ThemedText style={styles.sectionTitle}>RECENT DOCUMENTS</ThemedText>
             {pdfs.length > 0 && (
               <>
                 <View style={styles.statSeparator} />
                 <ThemedText style={styles.statCount}>{pdfs.length} TOTAL</ThemedText>
               </>
             )}
          </View>
          <TouchableOpacity onPress={() => setShowFullLibrary(true)}>
            <ThemedText style={styles.seeMoreText}>SEE ALL</ThemedText>
          </TouchableOpacity>
        </View>

        <FlatList<PdfDoc>
          data={boutiqueRecentData}
          keyExtractor={(item) => item.id}
          renderItem={renderPdfItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadLibrary(false)} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="photo.on.rectangle.angled" size={48} color={themeColors.icon} style={{ opacity: 0.1 }} />
              <ThemedText style={styles.emptyText}>Create your first PDF to see it here</ThemedText>
            </View>
          }
        />

        <Modal visible={contextMenu.visible} transparent animationType="none">
          <Pressable style={styles.contextMenuOverlay} onPress={() => setContextMenu(prev => ({ ...prev, visible: false }))}>
            <Animated.View entering={ZoomIn.duration(150)} style={[styles.desktopMenu, { top: contextMenu.y, left: contextMenu.x, backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#FFFFFF' }]}>
              <TouchableOpacity style={styles.desktopMenuItem} onPress={() => {
                if (!contextMenu.item) return;
                setContextMenu(prev => ({ ...prev, visible: false }));
                setEditingId(contextMenu.item.id);
                setEditingValue(contextMenu.item.name.replace('.pdf', ''));
              }}>
                <IconSymbol name="pencil" size={16} color={themeColors.text} />
                <ThemedText style={styles.desktopMenuText}>Rename File</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.desktopMenuItem} onPress={() => {
                if (!contextMenu.item) return;
                setContextMenu(prev => ({ ...prev, visible: false }));
                Sharing.shareAsync(contextMenu.item.uri);
              }}>
                <IconSymbol name="square.and.arrow.up" size={16} color={themeColors.text} />
                <ThemedText style={styles.desktopMenuText}>Share Document</ThemedText>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.desktopMenuItem} onPress={() => {
                const itemToDelete = contextMenu.item;
                setContextMenu(prev => ({ ...prev, visible: false }));
                Alert.alert('Delete Permanently', `Delete ${itemToDelete?.name}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: async () => { 
                    if(itemToDelete) {
                      await FileSystem.deleteAsync(itemToDelete.uri); 
                      if (itemToDelete.thumbnailUri) {
                        await FileSystem.deleteAsync(itemToDelete.thumbnailUri);
                      }
                    }
                    loadLibrary(); 
                  } }
                ]);
              }}>
                <IconSymbol name="trash.fill" size={16} color="#FF3B30" />
                <ThemedText style={[styles.desktopMenuText, { color: '#FF3B30' }]}>Delete</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </Modal>

        <Modal visible={showFullLibrary} animationType="slide" presentationStyle="fullScreen">
          <ThemedView style={styles.container}>
            {isSearchActive && (
              <View style={StyleSheet.absoluteFill}>
                <ThemedView style={styles.container}>
                  <View style={[styles.archiveHeader, { paddingTop: insets.top + 10 }]}>
                    <TouchableOpacity 
                      style={[styles.archiveBackButton, { backgroundColor: colorScheme === 'dark' ? '#232328' : '#F5F5F7' }]} 
                      onPress={() => { setIsSearchActive(false); setLibSearchQuery(''); }}
                    >
                      <IconSymbol name="chevron.right" size={22} color={themeColors.text} style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                    <ThemedText style={styles.archiveTitle}>SEARCH PDFS</ThemedText>
                    <View style={{ width: 44 }} />
                  </View>

                  <View style={styles.premiumSearchContainer}>
                    <View style={[styles.searchInner, { backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF', borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,122,255,0.1)' }]}>
                      <IconSymbol name="magnifyingglass" size={20} color={colorScheme === 'dark' ? '#FFFFFF' : '#007AFF'} style={{ opacity: 0.8 }} />
                      <TextInput 
                        style={[styles.searchInput, { color: PDF_RED }]} 
                        placeholder="Search file name..." 
                        placeholderTextColor={themeColors.icon} 
                        value={libSearchQuery} 
                        onChangeText={setLibSearchQuery} 
                        autoFocus
                      />
                      {libSearchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setLibSearchQuery('')}>
                          <View style={styles.clearSearchIcon}>
                            <IconSymbol name="plus" size={14} color="#FFF" style={{ transform: [{ rotate: '45deg' }] }} />
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <FlatList<PdfDoc>
                    data={pdfs.filter(p => p.name.toLowerCase().includes(libSearchQuery.toLowerCase()))}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPdfItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                  />
                </ThemedView>
              </View>
            )}

            {!isSearchActive && (
              <>
                <View style={[styles.archiveHeader, { paddingTop: insets.top + 10 }]}>
                  <TouchableOpacity 
                    style={[styles.archiveBackButton, { backgroundColor: colorScheme === 'dark' ? '#232328' : '#F5F5F7' }]} 
                    onPress={() => setShowFullLibrary(false)}
                  >
                    <IconSymbol name="chevron.right" size={22} color={themeColors.text} style={{ transform: [{ rotate: '180deg' }] }} />
                  </TouchableOpacity>
                  <ThemedText style={styles.archiveTitle}>DOCUMENT ARCHIVE</ThemedText>
                  <TouchableOpacity 
                    style={[styles.archiveBackButton, { backgroundColor: colorScheme === 'dark' ? '#232328' : '#F5F5F7' }]} 
                    onPress={() => setIsSearchActive(true)}
                  >
                    <IconSymbol name="magnifyingglass" size={20} color={themeColors.text} />
                  </TouchableOpacity>
                </View>

                <FlatList<PdfDoc>
                  data={pdfs}
                  keyExtractor={(item) => item.id}
                  renderItem={renderPdfItem}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                />
              </>
            )}
          </ThemedView>
        </Modal>

        <Modal visible={showDraftModal} animationType="slide" presentationStyle="fullScreen">
          <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemedView style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#0D0D0E' : '#F8F9FB' }]}>
              <View style={[styles.archiveHeader, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity 
                  style={[styles.archiveBackButton, { backgroundColor: colorScheme === 'dark' ? '#232328' : '#FFFFFF' }]} 
                  onPress={() => {
                    setShowDraftModal(false);
                    setIsProcessing(false);
                    setIsPreparingDraft(false);
                  }}
                >
                  <ThemedText style={styles.discardText}>Discard</ThemedText>
                </TouchableOpacity>
                
                <ThemedText style={styles.draftHeadingText}>PDF DRAFTING</ThemedText>
                
                <TouchableOpacity 
                  style={[styles.archiveBackButton, { backgroundColor: ACCENT_BLUE }]} 
                  onPress={() => pickImages(true)}
                >
                   <IconSymbol name="plus" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                contentContainerStyle={styles.draftContent} 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.premiumInputWrapper}>
                  <ThemedText style={[styles.vibrantLabel, { color: ACCENT_BLUE }]}>DOCUMENT TITLE</ThemedText>
                  <TextInput 
                    style={[styles.draftInput, { backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF', color: themeColors.text }]} 
                    value={pdfName} 
                    onChangeText={setPdfName} 
                    placeholder="Masterpiece name..."
                    placeholderTextColor="rgba(0,0,0,0.2)"
                  />
                </View>
                
                <View style={styles.sectionHeaderDraft}>
                  <ThemedText style={[styles.vibrantLabel, { color: PDF_RED }]}>
                    {isPreparingDraft ? 'STITCHING PAGES...' : `ORGANIZE PAGES (${selectedImages.length})`}
                  </ThemedText>
                  <ThemedText style={styles.orderInstruction}>
                    {isPreparingDraft ? 'Curating your boutique workspace...' : 'Touch and hold to rearrange your story'}
                  </ThemedText>
                </View>

                <View style={styles.imageGrid}>
                  {isPreparingDraft ? (
                    <>
                      <SkeletonItem />
                      <SkeletonItem />
                      <SkeletonItem />
                      <SkeletonItem />
                    </>
                  ) : (
                    selectedImages.map((uri, index) => (
                      <DraggableItem 
                        key={uri} 
                        uri={uri} 
                        index={index} 
                        total={selectedImages.length} 
                        onSwap={swapImages}
                        onRemove={removeImage}
                      />
                    ))
                  )}
                </View>
              </ScrollView>

              <View style={[styles.footerDraft, { paddingBottom: Math.max(insets.bottom, 24) }]}>
                {isProcessing ? (
                  <Animated.View style={[styles.processingContainer, pulseStyle]}>
                    <ActivityIndicator color={PDF_RED} size="large" />
                    <ThemedText style={styles.statusTextPremium}>{progressMsg || STATUS_MESSAGES[statusIdx]}</ThemedText>
                  </Animated.View>
                ) : (
                  <TouchableOpacity 
                    style={[styles.convertButtonPremium, (isPreparingDraft || isSelecting) && { opacity: 0.5 }]} 
                    onPress={generatePdf}
                    disabled={isPreparingDraft || isSelecting}
                    activeOpacity={0.8}
                  >
                    <IconSymbol name="checkmark.circle.fill" size={22} color="#FFF" style={{ marginRight: 10 }} />
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
  selectionGuard: { 
    zIndex: 99999, 
    backgroundColor: '#F8F9FB', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  guardContent: { alignItems: 'center' },
  guardTitle: { marginTop: 24, fontSize: 16, fontWeight: '900', letterSpacing: 2, color: PDF_RED },
  guardSubtitle: { marginTop: 8, fontSize: 13, opacity: 0.5, fontWeight: '600' },
  hubContainer: { flexDirection: 'row', gap: 12, padding: GRID_PADDING, height: 160 },
  hubButton: { flex: 1, borderRadius: 24, padding: 16, justifyContent: 'space-between', elevation: 8, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  primaryHub: { backgroundColor: '#007AFF' },
  secondaryHub: { backgroundColor: PDF_RED },
  hubIconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  hubLabel: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  hubSubLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', marginTop: 1 },
  sectionHeaderHome: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: GRID_PADDING, marginTop: 20, marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '900', opacity: 0.5, letterSpacing: 2.0 },
  statSeparator: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)', marginHorizontal: 8 },
  statCount: { fontSize: 9, fontWeight: '800', opacity: 0.3, letterSpacing: 1 },
  seeMoreText: { fontSize: 11, fontWeight: '900', color: '#007AFF', opacity: 0.8 },
  listContent: { padding: GRID_PADDING, paddingBottom: 120 },
  pdfAssetCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 22, 
    marginBottom: 12, 
    elevation: 3, 
    shadowOpacity: 0.08, 
    shadowRadius: 6, 
    shadowOffset: { width: 0, height: 3 } 
  },
  ghostHistoryCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 22, 
    marginBottom: 12, 
    borderWidth: 1.5, 
    borderColor: 'rgba(0,122,255,0.2)', 
    borderStyle: 'dashed' 
  },
  ghostIconWrapper: { 
    width: 50, 
    height: 50, 
    borderRadius: 12, 
    backgroundColor: 'rgba(0,122,255,0.08)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 16 
  },
  ghostTitle: { fontSize: 13, fontWeight: '800', color: ACCENT_BLUE },
  ghostSubtitle: { fontSize: 11, fontWeight: '600', opacity: 0.4, marginTop: 2 },
  pdfAssetThumbnail: { 
    width: 64, 
    height: 64, 
    borderRadius: 14, 
    backgroundColor: PDF_RED, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 16, 
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  pdfRibbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: PDF_RED,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderBottomLeftRadius: 6,
    zIndex: 10
  },
  pdfRibbonText: { color: '#FFF', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  pdfIcon3D: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  thumbnailGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '35%', backgroundColor: 'rgba(255,255,255,0.18)' },
  pdfAssetDetails: { flex: 1 },
  assetNameRow: { flexDirection: 'row', alignItems: 'center' },
  assetName: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2, opacity: 0.85 },
  assetRenameInput: { fontSize: 13, fontWeight: '800', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(229,57,53,0.05)', borderWidth: 1.5, borderColor: PDF_RED },
  assetMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  assetMetaText: { fontSize: 10, fontWeight: '700', color: '#007AFF', opacity: 0.5 },
  assetMetaTextMono: { fontSize: 10, fontWeight: '900', color: PDF_RED, opacity: 0.7, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  metaDot: { width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: 'rgba(0,0,0,0.08)', marginHorizontal: 6 },
  assetMenuBtn: { padding: 8 },
  contextMenuOverlay: { flex: 1 },
  desktopMenu: { position: 'absolute', width: 180, borderRadius: 12, padding: 4, elevation: 15, shadowOpacity: 0.15, shadowRadius: 10 },
  desktopMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  desktopMenuText: { marginLeft: 10, fontSize: 13, fontWeight: '600' },
  menuDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 4 },
  emptyState: { alignItems: 'center', marginTop: 50, opacity: 0.3 },
  emptyText: { marginTop: 12, textAlign: 'center', fontSize: 14, fontWeight: '500' },
  archiveHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  archiveBackButton: { width: 72, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  archiveTitle: { fontSize: 14, fontWeight: '900', opacity: 0.9, letterSpacing: 1 },
  discardText: { color: '#FF3B30', fontSize: 14, fontWeight: '900' },
  draftHeadingText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1.2 },
  draftContent: { padding: GRID_PADDING, paddingBottom: 150 },
  premiumInputWrapper: { marginBottom: 24 },
  vibrantLabel: { fontSize: 10, fontWeight: '900', marginBottom: 10, letterSpacing: 1.5, opacity: 0.9 },
  draftInput: { height: 64, borderRadius: 18, fontSize: 18, paddingHorizontal: 20, fontWeight: '800', elevation: 4, shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, borderWidth: 1.5, borderColor: 'rgba(0,122,255,0.1)' },
  sectionHeaderDraft: { marginTop: 8, marginBottom: 16 },
  orderInstruction: { fontSize: 12, opacity: 0.4, fontWeight: '600', marginTop: -6, fontStyle: 'italic' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  imageCardContainer: { width: ITEM_WIDTH },
  imageCard: { aspectRatio: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFF', elevation: 6, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  skeletonBox: { backgroundColor: 'rgba(0,0,0,0.05)', borderColor: 'rgba(0,0,0,0.05)', borderWidth: 1 },
  previewThumbnail: { width: '100%', height: '100%' },
  removeImageBtn: { position: 'absolute', top: 8, right: 8, zIndex: 20 },
  removeIconCircle: { backgroundColor: 'rgba(255,59,48,0.9)', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  orderRibbon: { position: 'absolute', bottom: 0, left: 0, backgroundColor: PDF_RED, paddingHorizontal: 10, paddingVertical: 5, borderTopRightRadius: 12, zIndex: 10 },
  orderRibbonText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  footerDraft: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  convertButtonPremium: { height: 68, borderRadius: 24, backgroundColor: PDF_RED, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 12, shadowColor: PDF_RED, shadowOpacity: 0.3, shadowRadius: 15 },
  convertButtonText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  processingContainer: { alignItems: 'center', justifyContent: 'center' },
  statusTextPremium: { marginTop: 12, fontSize: 14, fontWeight: '800', color: PDF_RED, opacity: 0.9, textAlign: 'center' },
  premiumSearchContainer: { paddingHorizontal: GRID_PADDING, paddingBottom: 20 },
  searchInner: { flexDirection: 'row', alignItems: 'center', height: 58, borderRadius: 18, paddingHorizontal: 18, elevation: 4, borderWidth: 1.5 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600' },
  clearSearchIcon: { backgroundColor: '#8E8E93', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
