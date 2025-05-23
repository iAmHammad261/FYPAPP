// app/record.js (or your chosen route for the recorder screen)
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Video } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Dimensions, Platform, StatusBar as RNStatusBar, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Camera, useCameraDevice, useCameraDevices, useCameraPermission } from 'react-native-vision-camera';

const LOG_PREFIX = '[RECORDER_DEBUG]';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const RECORD_TIMER_DURATION = 3000; // 5 seconds
const RECORD_BUTTON_SIZE = 70;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const IOS_STATUS_BAR_HEIGHT = 44;
const ANDROID_STATUS_BAR_HEIGHT = RNStatusBar.currentHeight || 24;

export default function VideoRecorderScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  const { hasPermission, requestPermission } = useCameraPermission();
  const devices = useCameraDevices();
  const [cameraType, setCameraType] = useState('back');
  const device = useCameraDevice(cameraType);

  const cameraRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false); 
  const [isStoppingRecording, setIsStoppingRecording] = useState(false); 
  const [torchOn, setTorchOn] = useState(false);
  // Timer state and ref removed
  const autoStopTimerRef = useRef(null);
  const recordingProgress = useSharedValue(0);

  const [recordedVideoUri, setRecordedVideoUri] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewVideoRef = useRef(null);

  const [isCameraActiveForUI, setIsCameraActiveForUI] = useState(false);

  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);


  const stopTimersAndResetAnimation = useCallback(() => {
    console.log(`${LOG_PREFIX} stopTimersAndResetAnimation called.`);
    // Timer interval ref removed
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    // setTimer(0) removed
    recordingProgress.value = 0; 
  }, [recordingProgress]); 

  useFocusEffect(
    useCallback(() => {
      console.log(`${LOG_PREFIX} Screen focused. Resetting component state and activating camera UI flag.`);
      setIsCameraActiveForUI(true);
      
      setIsRecording(false);
      setIsStoppingRecording(false);
      setRecordedVideoUri(null);
      setIsPreviewing(false);
      if (previewVideoRef.current) {
        previewVideoRef.current.unloadAsync().catch(e => console.warn(`${LOG_PREFIX} Error unloading preview video on focus:`, e));
      }
      stopTimersAndResetAnimation(); 

      return () => {
        console.log(`${LOG_PREFIX} Screen blurred. Setting isCameraActiveForUI = false.`);
        setIsCameraActiveForUI(false);
        
        if (autoStopTimerRef.current) {
            console.log(`${LOG_PREFIX} Screen blurred, clearing pending auto-stop timer.`);
            clearTimeout(autoStopTimerRef.current);
            autoStopTimerRef.current = null;
        }
        if (isRecordingRef.current) { 
             console.warn(`${LOG_PREFIX} Screen blurred while isRecordingRef was true. Resetting JS recording state.`);
             setIsRecording(false); 
             stopTimersAndResetAnimation(); 
        }
      };
    }, [stopTimersAndResetAnimation]) 
  );

  useEffect(() => {
    navigation.setOptions({ title: 'Record Video', headerBackTitle: 'Cancel' });
    if (!hasPermission) {
      requestPermission();
    }
    return () => { 
      // Timer interval ref removed
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    };
  }, [hasPermission, requestPermission, navigation]);


  const handleRecordingFinished = useCallback(async (video) => {
    console.log(`${LOG_PREFIX} onRecordingFinished. Video path: ${video.path}.`);
    setIsRecording(false); 
    stopTimersAndResetAnimation(); 

    let fileUri = video.path;
    if (Platform.OS === 'android' && !fileUri.startsWith('file://')) {
      fileUri = `file://${video.path}`;
    }
    
    console.log(`${LOG_PREFIX} Processed file URI for preview: ${fileUri}`);
    try {
      await new Promise(resolve => setTimeout(resolve, 300)); 
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        console.error(`${LOG_PREFIX} Error: Recorded file does not exist at URI: ${fileUri}`);
        Alert.alert('File Error', 'Recorded video file was not found after saving.');
        setIsStoppingRecording(false); 
        return;
      }
      console.log(`${LOG_PREFIX} File exists. Setting for preview.`);
      setRecordedVideoUri(fileUri);
      setIsPreviewing(true); 
    } catch (error) {
      console.error(`${LOG_PREFIX} Error accessing recorded file:`, error);
      Alert.alert('File Access Error', 'Could not verify the recorded video.');
    } finally {
      setIsStoppingRecording(false); 
    }
  }, [stopTimersAndResetAnimation]);

  const handleRecordingError = useCallback((error) => {
    console.error(`${LOG_PREFIX} onRecordingError:`, error);
    setIsRecording(false); 
    stopTimersAndResetAnimation(); 
    
    if (isStoppingRecording || !(error.message && error.message.includes("no-recording-in-progress"))) {
        Alert.alert('Recording Error', `An error occurred: ${error.message || 'Unknown error'}`);
    } else {
        console.log(`${LOG_PREFIX} Suppressed 'no-recording-in-progress' alert as not in explicit stopping phase.`);
    }
    setIsStoppingRecording(false); 
  }, [stopTimersAndResetAnimation, isStoppingRecording]);


  const stopRecordingInternal = async (stopMethodContext) => {
    if (!cameraRef.current) {
      console.warn(`${LOG_PREFIX} stopRecordingInternal (${stopMethodContext}): Camera ref not available.`);
      setIsRecording(false);
      setIsStoppingRecording(false);
      stopTimersAndResetAnimation();
      return;
    }
    if (isStoppingRecording || !isRecordingRef.current) { // Check isRecordingRef here
      console.log(`${LOG_PREFIX} stopRecordingInternal (${stopMethodContext}): Bailing. isStoppingRecording: ${isStoppingRecording}, isRecordingRef.current: ${isRecordingRef.current}`);
      if (!isRecordingRef.current && !isStoppingRecording) {
          setIsStoppingRecording(false); 
      }
      return;
    }

    console.log(`${LOG_PREFIX} stopRecordingInternal (${stopMethodContext}): Initiating stop.`);
    setIsStoppingRecording(true);

    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
      console.log(`${LOG_PREFIX} Cleared auto-stop timer in stopRecordingInternal by ${stopMethodContext}.`);
    }

    try {
      console.log(`${LOG_PREFIX} Calling camera.stopRecording() via ${stopMethodContext}.`);
      await cameraRef.current.stopRecording();
    } catch (e) {
      console.error(`${LOG_PREFIX} Error from camera.stopRecording() in ${stopMethodContext}:`, e);
      handleRecordingError(e); 
    }
  };

  const toggleRecording = async () => {
    const cameraIsReady = cameraRef.current && isCameraActiveForUI;

    if (isRecordingRef.current) { 
      if (!isStoppingRecording) {
        console.log(`${LOG_PREFIX} Manual stop requested (toggleRecording).`);
        await stopRecordingInternal("manual_toggle");
      } else {
        console.log(`${LOG_PREFIX} Manual stop requested, but already stopping (toggleRecording).`);
      }
    } else { // Start recording
      if (!cameraIsReady) {
        console.warn(`${LOG_PREFIX} Cannot start recording: Camera not ready or not active.`);
        Alert.alert("Camera Not Ready", "Please ensure camera is active and permissions are granted.");
        return;
      }
      if (isStoppingRecording) { 
        console.log(`${LOG_PREFIX} Cannot start recording: Currently stopping a previous one.`);
        return;
      }

      console.log(`${LOG_PREFIX} Attempting to start a new recording (toggleRecording).`);
      setIsPreviewing(false); 
      setRecordedVideoUri(null); 
      stopTimersAndResetAnimation(); 

      setIsRecording(true); 
      // Timer UI related calls removed
      recordingProgress.value = withTiming(1, { duration: RECORD_TIMER_DURATION, easing: Easing.linear });
      
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current); 
      autoStopTimerRef.current = setTimeout(async () => {
        if (isRecordingRef.current && cameraRef.current) { // Check ref here
            console.log(`${LOG_PREFIX} Auto-stop timer fired. isRecordingRef.current is TRUE. Initiating stop sequence.`);
            await stopRecordingInternal("auto_timer_if_still_recording"); 
        } else {
            console.log(`${LOG_PREFIX} Auto-stop timer fired, but isRecordingRef.current is ${isRecordingRef.current} (or cameraRef is null). Recording likely already stopped/errored. No action by this timer instance.`);
        }
      }, RECORD_TIMER_DURATION);

      try {
        console.log(`${LOG_PREFIX} Calling camera.startRecording()...`);
        await cameraRef.current.startRecording({
          flash: torchOn && cameraType === 'back' ? 'on' : 'off',
          onRecordingFinished: handleRecordingFinished,
          onRecordingError: handleRecordingError,
        });
        console.log(`${LOG_PREFIX} camera.startRecording() promise resolved (native recording process initiated).`);
      } catch (error) {
        console.error(`${LOG_PREFIX} Error thrown by camera.startRecording():`, error);
        handleRecordingError(error);
      }
    }
  };

  const switchCamera = useCallback(() => {
    if (isRecording || isStoppingRecording) return;
    setCameraType(prev => (prev === 'back' ? 'front' : 'back'));
    if (cameraType === 'front' && torchOn) setTorchOn(false);
  }, [isRecording, isStoppingRecording, cameraType, torchOn]);

  const toggleTorch = useCallback(() => {
    if (isRecording || isStoppingRecording) return;
    if (device?.hasTorch) setTorchOn(prev => !prev);
  }, [isRecording, isStoppingRecording, device]);

  const handleConfirmVideo = useCallback(() => {
    if (recordedVideoUri) {
      console.log(`${LOG_PREFIX} Confirming video: ${recordedVideoUri}`);
      router.push({ pathname: '/', params: { newVideoUri: recordedVideoUri, newVideoId: `rec-${Date.now()}` } });
    }
  }, [recordedVideoUri, router]);

  const handleRetakeVideo = useCallback(() => {
    console.log(`${LOG_PREFIX} Retake video selected.`);
    setRecordedVideoUri(null);
    setIsPreviewing(false);
    if (previewVideoRef.current) {
      previewVideoRef.current.unloadAsync().catch(e => console.warn(`${LOG_PREFIX} Error unloading preview on retake:`, e));
    }
    setIsRecording(false);
    setIsStoppingRecording(false);
    stopTimersAndResetAnimation();
  }, [stopTimersAndResetAnimation]); // stopTimersAndResetAnimation is stable

  const animatedCircleStyle = useAnimatedStyle(() => ({
    strokeDashoffset: (2 * Math.PI * (RECORD_BUTTON_SIZE / 2 + 5)) * (1 - recordingProgress.value),
    stroke: interpolateColor(recordingProgress.value, [0, 1], ['#4CAF50', '#F44336']),
  }));

  const actualCameraIsActive = (isCameraActiveForUI || isStoppingRecording) && !isPreviewing;

  if (!hasPermission) return <View style={styles.fullScreenMessage}><Text style={styles.messageText}>Requesting camera permission...</Text><Button title="Grant Permission" onPress={requestPermission} /></View>;
  if (!device) return <View style={styles.fullScreenMessage}><Text style={styles.messageText}>No camera device found.</Text></View>;

  if (isPreviewing && recordedVideoUri) {
    return (
      <SafeAreaView style={styles.previewContainer}>
        <Video
          ref={previewVideoRef}
          source={{ uri: recordedVideoUri }}
          style={styles.previewVideo}
          useNativeControls
          resizeMode="contain"
          isLooping
          shouldPlay
        />
        <View style={styles.previewControls}>
          <TouchableOpacity style={[styles.previewButton, styles.retakeButton]} onPress={handleRetakeVideo}>
            <MaterialIcons name="replay" size={28} color="#FFFFFF" />
            <Text style={styles.previewButtonText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.previewButton, styles.confirmButton]} onPress={handleConfirmVideo}>
            <MaterialIcons name="check-circle" size={28} color="#FFFFFF" />
            <Text style={styles.previewButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={actualCameraIsActive}
        video={true}
        audio={false}
        torch={torchOn ? 'on' : 'off'}
        onError={(error) => {
            console.error(`${LOG_PREFIX} Camera Component onError Prop:`, error);
            Alert.alert("Camera Error", "An unexpected camera error occurred. Please try restarting the recording screen.");
            setIsRecording(false);
            setIsStoppingRecording(false);
            stopTimersAndResetAnimation();
        }}
      />
      {/* Timer UI Removed */}
      <View style={styles.topControlsContainer}>
        {device?.hasTorch && cameraType === 'back' && (
          <TouchableOpacity style={styles.iconButton} onPress={toggleTorch} disabled={isRecording || isStoppingRecording || !actualCameraIsActive}>
            <MaterialIcons name={torchOn ? "flash-on" : "flash-off"} size={28} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.bottomControlsContainer}>
        <View style={styles.controlsRow}>
          <View style={styles.iconButtonPlaceholder} />
          <View style={styles.recordButtonOuterContainer}>
            {isRecording && ( // This still controls the progress circle visibility
              <Svg style={StyleSheet.absoluteFillObject} width={RECORD_BUTTON_SIZE + 20} height={RECORD_BUTTON_SIZE + 20}>
                <AnimatedCircle cx={(RECORD_BUTTON_SIZE + 20) / 2} cy={(RECORD_BUTTON_SIZE + 20) / 2} r={RECORD_BUTTON_SIZE / 2 + 5} strokeWidth={5} fill="transparent" rotation="-90" originX={(RECORD_BUTTON_SIZE + 20) / 2} originY={(RECORD_BUTTON_SIZE + 20) / 2} strokeDasharray={2 * Math.PI * (RECORD_BUTTON_SIZE / 2 + 5)} animatedProps={animatedCircleStyle} strokeLinecap="round" />
              </Svg>
            )}
            <TouchableOpacity 
              style={[styles.recordButton, isRecording && styles.recordButtonRecording]} 
              onPress={toggleRecording} 
              disabled={(!actualCameraIsActive && !isRecordingRef.current && !isStoppingRecording) || (isStoppingRecording) }
            >
              <View style={isRecording ? styles.recordButtonInnerStop : styles.recordButtonInnerRecord} />
            </TouchableOpacity>
          </View>
          {devices.length > 1 ? (
            <TouchableOpacity style={styles.iconButton} onPress={switchCamera} disabled={isRecording || isStoppingRecording || !actualCameraIsActive}>
              <MaterialIcons name="flip-camera-android" size={28} color="#FFF" />
            </TouchableOpacity>
          ) : <View style={styles.iconButtonPlaceholder} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  fullScreenMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'black' },
  messageText: { color: 'white', fontSize: 18, textAlign: 'center', marginBottom: 20 },
  camera: { flex: 1 },
  topControlsContainer: { position: 'absolute', top: (Platform.OS === 'ios' ? IOS_STATUS_BAR_HEIGHT : ANDROID_STATUS_BAR_HEIGHT) + 10, right: 20, zIndex: 10 },
  // timerContainer and timerText styles removed
  bottomControlsContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingBottom: 20 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  iconButton: { padding: 10, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  iconButtonPlaceholder: { width: 50, height: 50 },
  recordButtonOuterContainer: { width: RECORD_BUTTON_SIZE + 20, height: RECORD_BUTTON_SIZE + 20, justifyContent: 'center', alignItems: 'center' },
  recordButton: { width: RECORD_BUTTON_SIZE, height: RECORD_BUTTON_SIZE, borderRadius: RECORD_BUTTON_SIZE / 2, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'white' },
  recordButtonRecording: { backgroundColor: 'rgba(255,0,0,0.7)', borderColor: 'red' },
  recordButtonInnerRecord: { width: RECORD_BUTTON_SIZE * 0.8, height: RECORD_BUTTON_SIZE * 0.8, borderRadius: (RECORD_BUTTON_SIZE * 0.8) / 2, backgroundColor: 'red' },
  recordButtonInnerStop: { width: RECORD_BUTTON_SIZE * 0.4, height: RECORD_BUTTON_SIZE * 0.4, borderRadius: 4, backgroundColor: 'white' },
  previewContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewVideo: {
    width: screenWidth,
    flex: 1, 
    backgroundColor: 'black',
    marginBottom: 10, 
  },
  previewControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 15, 
    paddingBottom: Platform.OS === 'ios' ? 30 : 20, 
  },
  previewButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, marginHorizontal: 10 },
  retakeButton: { backgroundColor: '#FF6347' },
  confirmButton: { backgroundColor: '#4CAF50' },
  previewButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
});

