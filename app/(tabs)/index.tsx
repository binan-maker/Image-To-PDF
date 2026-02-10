
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItem,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface PdfDoc {
  id: string;
  name: string;
  date: string;
  size: string;
}

export default function LibraryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme];
  
  const [pdfs, setPdfs] = useState<PdfDoc[]>([
    { id: '1', name: 'Identity_Card.pdf', date: '2023-10-15', size: '1.2 MB' },
    { id: '2', name: 'Rent_Agreement.pdf', date: '2023-10-12', size: '2.5 MB' },
  ]);

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos to create PDFs.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uris = result.assets.map(asset => asset.uri);
      setSelectedImages(uris);
      setShowDraftModal(true);
    }
  };

  const generatePdf = () => {
    setIsProcessing(true);
    // Simulate PDF generation process
    setTimeout(() => {
      const newPdf: PdfDoc = {
        id: Date.now().toString(),
        name: `Document_${pdfs.length + 1}.pdf`,
        date: new Date().toISOString().split('T')[0],
        size: `${(Math.random() * 5 + 1).toFixed(1)} MB`,
      };
      setPdfs([newPdf, ...pdfs]);
      setIsProcessing(false);
      setShowDraftModal(false);
      setSelectedImages([]);
      Alert.alert('Success', 'PDF generated successfully!');
    }, 2000);
  };

  const sharePdf = async (name: string) => {
    if (await Sharing.isAvailableAsync()) {
      // In a real app, we'd share the actual file URI
      Alert.alert('Share', `Sharing ${name}...`);
    }
  };

  // Explicitly typing renderItem to resolve generic inference issues and fix contentContainerStyle detection
  const renderPdfItem: ListRenderItem<PdfDoc> = useCallback(({ item }) => (
    <TouchableOpacity 
      style={[styles.pdfCard, { backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#F5F5F5' }]}
      onPress={() => sharePdf(item.name)}
    >
      <View style={styles.pdfIconContainer}>
        <IconSymbol name="doc.text.fill" size={32} color="#D32F2F" />
      </View>
      <View style={styles.pdfDetails}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>{item.name}</ThemedText>
        <ThemedText style={styles.pdfSubtext}>{item.date} • {item.size}</ThemedText>
      </View>
      <TouchableOpacity onPress={() => Alert.alert('Menu', 'Options: Rename, Delete')}>
        <IconSymbol name="chevron.right" size={20} color={themeColors.icon} />
      </TouchableOpacity>
    </TouchableOpacity>
  ), [colorScheme, themeColors.icon]);

  // Explicitly typing the grid item renderer for selected images
  const renderGridItem: ListRenderItem<string> = useCallback(({ item }) => (
    <Image source={{ uri: item }} style={styles.gridImage} />
  ), []);

  return (
    <ThemedView style={styles.container}>
      {/* Providing explicit generic type <PdfDoc> helps fix property detection on FlatList */}
      <FlatList<PdfDoc>
        data={pdfs}
        keyExtractor={(item) => item.id}
        renderItem={renderPdfItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconSymbol name="photo.on.rectangle.angled" size={80} color={themeColors.icon} style={{ opacity: 0.5 }} />
            <ThemedText style={styles.emptyText}>No documents created yet</ThemedText>
            <ThemedText style={styles.emptySubtext}>Tap the + button to convert images to PDF</ThemedText>
          </View>
        }
      />

      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: themeColors.tint }]} 
        onPress={pickImages}
        activeOpacity={0.8}
      >
        <IconSymbol name="plus" size={30} color="#FFF" />
      </TouchableOpacity>

      {/* Conversion Modal */}
      <Modal visible={showDraftModal} animationType="slide">
        <ThemedView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDraftModal(false)}>
              <ThemedText type="link">Cancel</ThemedText>
            </TouchableOpacity>
            <ThemedText type="subtitle" style={{ fontFamily: Fonts.rounded }}>Review Selected</ThemedText>
            <View style={{ width: 50 }} />
          </View>

          {/* Providing explicit generic type <string> and numColumns fixes property detection */}
          <FlatList<string>
            data={selectedImages}
            keyExtractor={(item, index) => index.toString()}
            numColumns={2}
            renderItem={renderGridItem}
            contentContainerStyle={styles.gridContent}
          />

          <View style={styles.footer}>
            {isProcessing ? (
              <ActivityIndicator color={themeColors.tint} size="large" />
            ) : (
              <TouchableOpacity style={[styles.convertButton, { backgroundColor: themeColors.tint }]} onPress={generatePdf}>
                <ThemedText style={styles.convertButtonText}>Convert {selectedImages.length} Images to PDF</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  pdfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  pdfIconContainer: {
    marginRight: 16,
  },
  pdfDetails: {
    flex: 1,
  },
  pdfSubtext: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  emptyState: {
    marginTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
  emptySubtext: {
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 20, // Rounded square Material 3 style
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  gridContent: {
    padding: 8,
  },
  gridImage: {
    flex: 1,
    height: 200,
    margin: 4,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  convertButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convertButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
