import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { trpc } from '../services/trpc';
import RNFS from 'react-native-fs';

export default function CameraScreen() {
  const navigation = useNavigation();
  const camera = useRef<Camera>(null);
  const devices = useCameraDevices();
  const device = devices.back;

  const [hasPermission, setHasPermission] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const uploadMutation = trpc.files.upload.useMutation();
  const processOCRMutation = trpc.ai.processOCR.useMutation();

  React.useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'authorized');
    })();
  }, []);

  const takePhoto = async () => {
    if (!camera.current) return;

    try {
      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'balanced',
      });

      setCapturedPhoto(photo.path);
    } catch (error) {
      console.error('拍照失败:', error);
      Alert.alert('错误', '拍照失败，请重试');
    }
  };

  const processPhoto = async () => {
    if (!capturedPhoto) return;

    setIsProcessing(true);

    try {
      // Read file as base64
      const fileBase64 = await RNFS.readFile(capturedPhoto, 'base64');
      const fileSize = (await RNFS.stat(capturedPhoto)).size;

      // Upload file
      const uploadResult = await uploadMutation.mutateAsync({
        fileName: `photo_${Date.now()}.jpg`,
        fileType: 'image/jpeg',
        fileSize,
        fileBuffer: fileBase64,
      });

      // Process OCR
      const ocrResult = await processOCRMutation.mutateAsync({
        fileId: uploadResult.fileId,
      });

      Alert.alert(
        '处理成功',
        `已识别文字并生成文档：${ocrResult.document.title}`,
        [
          {
            text: '查看文档',
            onPress: () => {
              navigation.navigate('DocumentDetail' as never, {
                id: ocrResult.document.id,
              });
            },
          },
          { text: '继续拍照', onPress: () => setCapturedPhoto(null) },
        ]
      );
    } catch (error: any) {
      console.error('处理失败:', error);
      Alert.alert('错误', error.message || '处理失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Icon name="camera-off" size={64} color="#d1d5db" />
        <Text style={styles.permissionText}>需要相机权限</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={async () => {
            const status = await Camera.requestCameraPermission();
            setHasPermission(status === 'authorized');
          }}
        >
          <Text style={styles.buttonText}>授予权限</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>加载相机...</Text>
      </View>
    );
  }

  if (capturedPhoto) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: `file://${capturedPhoto}` }} style={styles.preview} />
        
        {isProcessing ? (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.processingText}>正在处理...</Text>
            <Text style={styles.processingSubtext}>识别文字并生成文档</Text>
          </View>
        ) : (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.retakeButton} onPress={retakePhoto}>
              <Icon name="camera-retake" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>重拍</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.processButton} onPress={processPhoto}>
              <Icon name="check" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>处理</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
      />
      
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>拍照识别</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.guideBox} />

        <View style={styles.footer}>
          <Text style={styles.hint}>对准文档或名片拍照</Text>
          <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  guideBox: {
    alignSelf: 'center',
    width: '80%',
    height: '40%',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  hint: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3b82f6',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  processingSubtext: {
    fontSize: 14,
    color: '#d1d5db',
    marginTop: 8,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    gap: 20,
  },
  retakeButton: {
    backgroundColor: '#6b7280',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  permissionText: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
});
