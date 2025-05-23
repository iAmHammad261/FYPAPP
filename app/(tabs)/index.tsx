import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker'; // Used as namespace
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'; // Added useLocalSearchParams and useFocusEffect
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const LOG_PREFIX = '[APP_DEBUG]';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.69;
const CARD_MARGIN_HORIZONTAL_PER_SIDE = (screenWidth - CARD_WIDTH) / 2 / 2;

// --- NEW UI COLORS ---
const darkThemeColors = {
    background: '#1A1D21',         // Dark cool slate
    surface: '#26292E',            // Slightly lighter slate for cards, bottom sheets, headers
    primaryText: '#EAEAEA',        // Off-white, good readability
    secondaryText: '#9E9E9E',      // Muted gray for less emphasis
    accent: '#00ACC1',             // A vibrant cyan/teal (Used for active Translate button bg, active card border)
    cardBorder: '#373A3F',         // Subtle border for cards, headers
    iconColor: '#B0BEC5',          // Muted icon color (blue-gray) for general icons (e.g., AddCard, error overlays, info icon)
    bottomSheetBackground: '#212327', // Darker than surface for depth
    bottomSheetButton: '#373A3F',     // Background for bottom sheet buttons
    bottomSheetButtonText: '#EAEAEA', // Text and Icon color for bottom sheet buttons (including delete)

    statusBar: 'light-content',
    errorOverlayBackground: 'rgba(0,0,0,0.75)',
    errorOverlayText: '#FFFFFF',

    // Specific button states / types
    deleteButtonBackground: '#D32F2F', // Destructive Red for delete button background

    // TranslateButton specific theming
    translateButtonActiveBackground: '#00ACC1', // Same as accent
    translateButtonActiveText: '#FFFFFF',       // White text on accent background
    translateButtonActiveIcon: '#FFFFFF',       // White icon on accent background

    translateButtonDisabledBackground: '#424242', // Darker, muted background for disabled translate button
    translateButtonDisabledText: '#757575',       // Muted text for disabled translate button
    translateButtonDisabledIcon: '#757575',       // Muted icon for disabled translate button

    playIconColor: 'rgba(255, 255, 255, 0.9)', // For video play icon overlay (kept highly visible)
};


// const APP_HEADER_CONTENT_HEIGHT = 50; // No longer directly used for header height
const IOS_STATUS_BAR_HEIGHT = 44; 
const ANDROID_STATUS_BAR_HEIGHT = RNStatusBar.currentHeight || 24; 


// --- VideoCard Component ---
const VideoCard = React.memo(({ item, isActive, onVideoPress, onLongPressOpenSheet }) => {
    const videoRef = useRef(null);
    const [hasError, setHasError] = useState(false);
    const [playbackStatus, setPlaybackStatus] = useState({});

    useEffect(() => {
        // console.log(`${LOG_PREFIX} HomeScreen VideoCard MOUNTED for item ${item.id}`);
        return () => {
            // console.log(`${LOG_PREFIX} HomeScreen VideoCard UNMOUNTED for item ${item.id}`);
        };
    }, [item.id]);

    useEffect(() => {
        if (item.uri) setHasError(false); 
        const currentVideoRef = videoRef.current;
        if (currentVideoRef) {
            if (isActive) {
                currentVideoRef.getStatusAsync()
                    .then(status => {
                        if (currentVideoRef && item.uri) {
                            if (status.isLoaded && status.uri === item.uri) {
                                currentVideoRef.playAsync().catch(error => { setHasError(true); console.error(`${LOG_PREFIX} VideoCard Play Error:`, error); });
                            } else {
                                currentVideoRef.loadAsync({ uri: item.uri }, { shouldPlay: true })
                                    .catch(error => { setHasError(true); console.error(`${LOG_PREFIX} VideoCard Load/Play Error:`, error); });
                            }
                        }
                    })
                    .catch(error => { setHasError(true); console.error(`${LOG_PREFIX} VideoCard GetStatus Error:`, error); });
            } else {
                if (playbackStatus.isLoaded) {
                    currentVideoRef.pauseAsync().catch(error => console.warn(`${LOG_PREFIX} VideoCard Pause Warn:`, error));
                }
            }
        }
    }, [item.uri, isActive, playbackStatus.isLoaded]);

    const handlePlaybackStatusUpdate = (newStatus) => {
        setPlaybackStatus(newStatus);
        if (newStatus.isLoaded) {
            if (newStatus.error) { setHasError(true); console.error(`${LOG_PREFIX} VideoCard PlaybackStatus Error:`, newStatus.error); }
            else if (hasError && !newStatus.error) setHasError(false);
        } else if (newStatus.error && !hasError) {
            setHasError(true); console.error(`${LOG_PREFIX} VideoCard PlaybackStatus Error (not loaded):`, newStatus.error);
        }
    };

    return (
        <TouchableOpacity style={styles.cardTouchable} onPress={() => onVideoPress(item.id)} onLongPress={() => onLongPressOpenSheet(item)} activeOpacity={0.9}>
            <View style={[styles.card, isActive && styles.activeCard]}>
                {item.uri ? (
                    <Video ref={videoRef} style={styles.videoPlayer} source={{ uri: item.uri }} useNativeControls={false} resizeMode="cover" isLooping={false} onPlaybackStatusUpdate={handlePlaybackStatusUpdate} onError={(e) => { setHasError(true); console.error(`${LOG_PREFIX} Video onError Prop:`, e); }} onLoad={() => setHasError(false)} />
                ) : (
                    <View style={styles.errorOverlay}><MaterialIcons name="broken-image" size={48} color={darkThemeColors.iconColor} /><Text style={styles.errorText}>Video URI is missing</Text></View>
                )}
                {!isActive && playbackStatus.isLoaded && !hasError && (
                    <View style={styles.playIconContainer}><MaterialIcons name="play-arrow" size={70} color={darkThemeColors.playIconColor} /></View>
                )}
                {hasError && item.uri && (
                    <View style={styles.errorOverlay}><MaterialIcons name="error-outline" size={48} color={darkThemeColors.iconColor} /><Text style={styles.errorText}>Video unavailable</Text></View>
                )}
            </View>
        </TouchableOpacity>
    );
});

// --- AddCard Component ---
const AddCard = React.memo(({ onPress }) => (
    <TouchableOpacity style={[styles.card, styles.addCard, styles.cardTouchable]} onPress={onPress} activeOpacity={0.7}>
        <MaterialIcons name="add-circle-outline" size={70} color={darkThemeColors.iconColor} />
        <Text style={styles.addCardText}>Add New Video</Text>
    </TouchableOpacity>
));

// --- TranslateButton Component ---
const TranslateButton = ({ onPress, disabled }) => (
    <TouchableOpacity
        style={[
            styles.translateButtonBase,
            { backgroundColor: disabled ? darkThemeColors.translateButtonDisabledBackground : darkThemeColors.translateButtonActiveBackground },
            disabled && styles.translateButtonDisabledStyles
        ]}
        onPress={onPress}
        disabled={disabled}
    >
        <MaterialIcons
            name="translate"
            size={22}
            color={disabled ? darkThemeColors.translateButtonDisabledIcon : darkThemeColors.translateButtonActiveIcon}
        />
        <Text
            style={[
                styles.translateButtonTextBase,
                { color: disabled ? darkThemeColors.translateButtonDisabledText : darkThemeColors.translateButtonActiveText }
            ]}
        >
            {disabled ? 'Processing All...' : 'Translate'}
        </Text>
    </TouchableOpacity>
);

export default function HomeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [videos, _setVideos] = useState([]);
    const [activeVideoId, _setActiveVideoId] = useState(null);
    const [videoInFocusId, _setVideoInFocusId] = useState(null);
    const [actionableVideo, _setActionableVideo] = useState(null);

    const [translations, setTranslations] = useState({});
    const [currentPredictedGloss, setCurrentPredictedGloss] = useState('---');
    const [isProcessingAll, setIsProcessingAll] = useState(false);

    const setVideos = useCallback((updater) => _setVideos(prev => typeof updater === 'function' ? updater(prev) : updater), []);
    const setActiveVideoId = useCallback((updater) => _setActiveVideoId(prev => typeof updater === 'function' ? updater(prev) : updater), []);
    const setVideoInFocusId = useCallback((updater) => _setVideoInFocusId(prev => typeof updater === 'function' ? updater(prev) : updater), []);
    const setActionableVideo = useCallback((item) => _setActionableVideo(item), []);

    const addVideoBottomSheetRef = useRef(null);
    const videoActionBottomSheetRef = useRef(null);
    const addVideoSnapPoints = useMemo(() => ['15%', '25%'], []); 
    const videoActionSnapPoints = useMemo(() => ['25%', '35%'], []); 

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 75 }).current;

    const flatListData = useMemo(() => {
        return [
            ...videos.map(video => ({ ...video, itemType: 'video' })),
            { id: 'add-new-button', itemType: 'add' }
        ];
    }, [videos]);

    useFocusEffect(
        useCallback(() => {
            const { newVideoUri, newVideoId } = params;
            if (typeof newVideoUri === 'string' && typeof newVideoId === 'string') {
                console.log(`${LOG_PREFIX} Received new video from recorder: ID=${newVideoId}, URI=${newVideoUri}`);
                const newVideo = { id: newVideoId, uri: newVideoUri };
                
                setVideos(prevVideos => {
                    if (!prevVideos.find(v => v.id === newVideo.id)) {
                        return [...prevVideos, newVideo];
                    }
                    return prevVideos;
                });
                router.setParams({ newVideoUri: undefined, newVideoId: undefined });
            }
        }, [params, setVideos, router])
    );

    const handleOpenAddVideoSheet = useCallback(() => addVideoBottomSheetRef.current?.snapToIndex(1), []);
    const handleCloseAddVideoSheet = useCallback(() => addVideoBottomSheetRef.current?.close(), []);
    const handleAddVideoSheetChanges = useCallback(() => { /* console.log('Add video sheet changed'); */ }, []);
    const handleOpenVideoActionSheet = useCallback((videoItem) => setActionableVideo(videoItem), [setActionableVideo]);
    const handleCloseVideoActionSheet = useCallback(() => { videoActionBottomSheetRef.current?.close(); }, []);

    useEffect(() => {
        if (actionableVideo && videoActionBottomSheetRef.current) {
            const timer = setTimeout(() => videoActionBottomSheetRef.current?.expand(), 50); 
            return () => clearTimeout(timer);
        }
    }, [actionableVideo]);

    const handleVideoActionSheetChanges = useCallback((index) => {
        if (index === -1) setActionableVideo(null); 
    }, [setActionableVideo]);

    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') Alert.alert('Permissions Required', 'Gallery access is needed to select videos.');
            }
        })();
    }, []);

    const fetchGlossForSingleVideo = useCallback(async (videoUri, videoId) => {
        console.log(`${LOG_PREFIX} API Call: Attempting fetch for ${videoId}`);
        try {
            const formData = new FormData();
            const filename = videoUri.split('/').pop() || 'video.mp4';
            let fileType = 'video/mp4'; 
            const extension = filename.split('.').pop()?.toLowerCase();
            if (extension === 'mov') fileType = 'video/quicktime';
            else if (extension && extension.length < 5 && extension.length > 1) fileType = `video/${extension}`; 
            
            formData.append('file', { uri: videoUri, name: filename, type: fileType });

            const response = await fetch('https://signlang-api-758598830011.asia-south1.run.app/predict/', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                let detail = `API error ${response.status}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.detail) detail = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
                } catch (e) { detail = errorText.length < 100 ? errorText : `API error ${response.status}`; } 
                console.error(`${LOG_PREFIX} API Error for ${videoId} [${response.status}]: ${detail}`);
                setTranslations(prev => ({ ...prev, [videoId]: `Error: ${response.status}` }));
                return;
            }
            const data = await response.json();
            if (data && typeof data.predicted_gloss === 'string') {
                console.log(`${LOG_PREFIX} API Success for ${videoId}: ${data.predicted_gloss}`);
                setTranslations(prev => ({ ...prev, [videoId]: data.predicted_gloss }));
            } else {
                console.error(`${LOG_PREFIX} Invalid API response for ${videoId}:`, data);
                setTranslations(prev => ({ ...prev, [videoId]: 'Invalid Response' }));
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Exception during fetch for ${videoId}:`, error.message);
            setTranslations(prev => ({ ...prev, [videoId]: 'Fetch Exception' }));
        }
    }, [/* setTranslations is stable */]);

    const handleTranslateAllVideos = useCallback(async () => {
        if (isProcessingAll) return;
        if (videos.length === 0) {
            Alert.alert("No Videos", "Please add videos to translate.");
            return;
        }
        console.log(`${LOG_PREFIX} Starting translation for all ${videos.length} videos.`);
        setIsProcessingAll(true);
        setCurrentPredictedGloss("Processing all videos...");

        const fetchPromises = videos.map(video => {
            if (video.uri && (!translations[video.id] || ['Translation Error', 'No URI', 'Invalid Response', 'Fetch Exception'].includes(translations[video.id]))) {
                return fetchGlossForSingleVideo(video.uri, video.id);
            }
            return Promise.resolve(); 
        });

        await Promise.allSettled(fetchPromises);

        console.log(`${LOG_PREFIX} All video translation attempts completed.`);
        setIsProcessingAll(false);
        if (videoInFocusId && translations[videoInFocusId]) {
            setCurrentPredictedGloss(translations[videoInFocusId]);
        } else if (videoInFocusId) { 
            setCurrentPredictedGloss(translations[videoInFocusId] || "---"); 
        } else { 
            setCurrentPredictedGloss("---");
        }
    }, [videos, translations, isProcessingAll, videoInFocusId, fetchGlossForSingleVideo]);

    useEffect(() => {
        if (videoInFocusId) {
            const gloss = translations[videoInFocusId];
            if (gloss && !['Translation Error', 'No URI', 'Invalid Response', 'Fetch Exception'].includes(gloss)) {
                setCurrentPredictedGloss(gloss);
            } else if (isProcessingAll) {
                const isFocusedVideoStillPending = videos.some(v => v.id === videoInFocusId && v.uri && (!translations[v.id] || ['Translation Error', 'No URI', 'Invalid Response', 'Fetch Exception'].includes(translations[v.id])));
                if (isFocusedVideoStillPending) {
                    setCurrentPredictedGloss("Processing...");
                } else if (gloss) { 
                    setCurrentPredictedGloss(gloss);
                } else {
                    setCurrentPredictedGloss("---"); 
                }
            } else if (gloss) { 
                setCurrentPredictedGloss(gloss);
            } else { 
                setCurrentPredictedGloss("---");
            }
        } else { 
            setCurrentPredictedGloss("---");
        }
    }, [videoInFocusId, translations, isProcessingAll, videos]);

    const handleSelectVideo = async () => {
        handleCloseAddVideoSheet();
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: Platform.OS === 'ios', quality: 0.8, 
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const { uri, assetId, fileName } = result.assets[0];
                const id = assetId || fileName || Date.now().toString() + Math.random().toString(); 
                setVideos(prev => [...prev, { id: id, uri: uri }]);
            }
        } catch (error) { Alert.alert('Error', 'Could not select video.'); console.error(error); }
    };
    
    const handleRecordNewVideo = () => {
        handleCloseAddVideoSheet();
        console.log(`${LOG_PREFIX} Navigating to video recorder screen.`);
        router.push('/record');
    };

    const handleChangeVideoFromGallery = useCallback(async () => {
        if (!actionableVideo) return;
        const videoToReplaceId = actionableVideo.id;
        handleCloseVideoActionSheet(); 
        setTimeout(async () => { 
            try {
                const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1 });
                if (!result.canceled && result.assets && result.assets.length > 0) {
                    const newUri = result.assets[0].uri;
                    setVideos(prev => prev.map(v => v.id === videoToReplaceId ? { ...v, uri: newUri } : v));
                    setTranslations(prev => { const updated = {...prev}; delete updated[videoToReplaceId]; return updated; }); 
                }
            } catch (error) { Alert.alert('Error', 'Could not change video.'); console.error(error); }
        }, Platform.OS === 'ios' ? 500 : 200); 
    }, [actionableVideo, setVideos, setTranslations, handleCloseVideoActionSheet]);

    const handleRecordReplacementVideo = useCallback(() => Alert.alert('Record Replacement', 'To be implemented.'), []);

    const handleDeleteVideo = useCallback(() => {
        if (!actionableVideo) return;
        const videoToDeleteId = actionableVideo.id;
        Alert.alert('Delete Video', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel', onPress: handleCloseVideoActionSheet }, 
            { text: 'Delete', style: 'destructive', onPress: () => {
                setVideos(prev => prev.filter(v => v.id !== videoToDeleteId));
                if (activeVideoId === videoToDeleteId) setActiveVideoId(null);
                if (videoInFocusId === videoToDeleteId) setVideoInFocusId(null);
                setTranslations(prev => { const updated = {...prev}; delete updated[videoToDeleteId]; return updated; });
                handleCloseVideoActionSheet(); 
            }}
        ], { cancelable: true, onDismiss: handleCloseVideoActionSheet }); 
    }, [actionableVideo, activeVideoId, videoInFocusId, setVideos, setActiveVideoId, setVideoInFocusId, setTranslations, handleCloseVideoActionSheet]);

    const onVideoPress = useCallback((videoId) => {
        if (activeVideoId === videoId) { 
            setActiveVideoId(null); 
        } else { 
            setActiveVideoId(videoId);
            setVideoInFocusId(videoId); 
        }
    }, [activeVideoId, setActiveVideoId, setVideoInFocusId]);

    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        const firstViewableVideo = viewableItems.find(v => v.isViewable && v.item.itemType === 'video');
        if (firstViewableVideo) {
            if (videoInFocusId !== firstViewableVideo.item.id) {
                setVideoInFocusId(firstViewableVideo.item.id);
                setActiveVideoId(firstViewableVideo.item.id); 
            }
        } else {
            if (videoInFocusId !== null && viewableItems.every(v => !v.isViewable || v.item.itemType !== 'video')) {
                setVideoInFocusId(null);
                setActiveVideoId(null);
            }
        }
    }, [videoInFocusId, setVideoInFocusId, setActiveVideoId]);

    const renderItem = useCallback(({ item }) => {
        if (item.itemType === 'video') return <VideoCard item={item} isActive={activeVideoId === item.id} onVideoPress={onVideoPress} onLongPressOpenSheet={handleOpenVideoActionSheet} />;
        if (item.itemType === 'add') return <AddCard onPress={handleOpenAddVideoSheet} />;
        return null;
    }, [activeVideoId, onVideoPress, handleOpenVideoActionSheet, handleOpenAddVideoSheet]);
    
    if (flatListData === undefined) {
        console.error(`${LOG_PREFIX} flatListData IS UNDEFINED just before render!`);
        return <View style={styles.container}><Text style={{color: darkThemeColors.primaryText}}>Loading or Error...</Text></View>;
    }

    return (
        <View style={styles.container}>
            <RNStatusBar barStyle={darkThemeColors.statusBar} backgroundColor={darkThemeColors.surface} translucent={Platform.OS === 'android'} />
            
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Sign Feed</Text>
            </View>

            <FlatList
                style={styles.flatList}
                data={flatListData}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.flatListContentContainer}
                decelerationRate="fast"
                snapToInterval={CARD_WIDTH + (CARD_MARGIN_HORIZONTAL_PER_SIDE * 2)} 
                snapToAlignment="center"
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                extraData={{ activeId: activeVideoId, focusId: videoInFocusId, translationsHash: JSON.stringify(translations) }}
                windowSize={7} 
                initialNumToRender={3}
                maxToRenderPerBatch={3}
            />

            {videos.length > 0 && (
                <View style={styles.dotContainer}>
                    {videos.map((video) => {
                        const isActiveDot = video.id === videoInFocusId;
                        return (
                            <View
                                key={`dot-${video.id}`} // Ensure unique key for dots
                                style={[
                                    styles.dot,
                                    isActiveDot ? styles.dotActive : styles.dotInactive
                                ]}
                            />
                        );
                    })}
                </View>
            )}

            <TranslateButton onPress={handleTranslateAllVideos} disabled={isProcessingAll} />

            <View style={styles.translationContainer}>
                <Text style={styles.translationTitle}>Translated Word</Text>
                <Text style={styles.translationGloss} numberOfLines={2} ellipsizeMode="tail">{currentPredictedGloss}</Text>
            </View>

            <BottomSheet ref={addVideoBottomSheetRef} index={-1} snapPoints={addVideoSnapPoints} onChange={handleAddVideoSheetChanges} enablePanDownToClose handleComponent={null} backgroundStyle={styles.bottomSheetItselfBackground}>
                <BottomSheetView style={styles.bottomSheetContentContainer}>
                    <Text style={styles.bottomSheetTitle}>Add Video</Text>
                    <TouchableOpacity style={styles.bottomSheetButton} onPress={handleRecordNewVideo}><MaterialIcons name="videocam" size={24} color={darkThemeColors.bottomSheetButtonText} /><Text style={styles.bottomSheetButtonText}>Record Video</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.bottomSheetButton} onPress={handleSelectVideo}><MaterialIcons name="photo-library" size={24} color={darkThemeColors.bottomSheetButtonText} /><Text style={styles.bottomSheetButtonText}>Select Video from Gallery</Text></TouchableOpacity>
                </BottomSheetView>
            </BottomSheet>

            {actionableVideo && (
                <BottomSheet ref={videoActionBottomSheetRef} index={-1} snapPoints={videoActionSnapPoints} onChange={handleVideoActionSheetChanges} enablePanDownToClose handleComponent={null} backgroundStyle={styles.bottomSheetItselfBackground}>
                    <BottomSheetView style={styles.bottomSheetContentContainer}>
                        <Text style={styles.bottomSheetTitle}>Video Options</Text>
                        <TouchableOpacity style={styles.bottomSheetButton} onPress={handleChangeVideoFromGallery}><MaterialIcons name="photo-library" size={24} color={darkThemeColors.bottomSheetButtonText} /><Text style={styles.bottomSheetButtonText}>Change from Gallery</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.bottomSheetButton} onPress={handleRecordReplacementVideo}><MaterialIcons name="videocam" size={24} color={darkThemeColors.bottomSheetButtonText} /><Text style={styles.bottomSheetButtonText}>Record New to Replace</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.bottomSheetButton, styles.deleteButton]} onPress={handleDeleteVideo}><MaterialIcons name="delete" size={24} color={darkThemeColors.bottomSheetButtonText} /><Text style={styles.bottomSheetButtonText}>Delete Video</Text></TouchableOpacity>
                    </BottomSheetView>
                </BottomSheet>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: darkThemeColors.background,
        paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT : IOS_STATUS_BAR_HEIGHT,
    },
    header: {
        paddingVertical: 15, 
        paddingHorizontal: 20,
        backgroundColor: darkThemeColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: darkThemeColors.cardBorder,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center', 
        marginBottom: 0, 
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: darkThemeColors.primaryText,
    },
    flatList: { 
        marginBottom: 5, 
    },
    flatListContentContainer: { 
        paddingHorizontal: CARD_MARGIN_HORIZONTAL_PER_SIDE, 
        paddingTop: 20, 
        paddingBottom: 10, 
    },
    // Dot Indicator Styles
    dotContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20, // Space before TranslateButton
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },
    dotInactive: {
        borderWidth: 1,
        borderColor: darkThemeColors.iconColor,
    },
    dotActive: {
        backgroundColor: darkThemeColors.accent,
    },
    // End Dot Indicator Styles
    cardTouchable: {
        marginHorizontal: CARD_MARGIN_HORIZONTAL_PER_SIDE,
    },
    card: { 
        width: CARD_WIDTH,
        height: CARD_WIDTH * (16 / 9),
        borderRadius: 15,
        overflow: 'hidden',
        backgroundColor: darkThemeColors.surface,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        borderWidth: 1,
        borderColor: darkThemeColors.cardBorder,
    },
    activeCard: { 
        borderColor: darkThemeColors.accent, 
        borderWidth: 2, 
        elevation: 8,
        shadowOpacity: 0.3,
    },
    addCard: { 
        borderWidth: 2,
        borderColor: darkThemeColors.cardBorder, 
        borderStyle: 'dashed', 
    },
    addCardText: { 
        marginTop: 10, 
        fontSize: 16, 
        color: darkThemeColors.secondaryText, 
    },
    videoPlayer: { 
        width: '100%', 
        height: '100%', 
        backgroundColor: '#000000',
    },
    playIconContainer: { 
        ...StyleSheet.absoluteFillObject, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    errorOverlay: { 
        ...StyleSheet.absoluteFillObject, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: darkThemeColors.errorOverlayBackground, 
        borderRadius: 13, 
        padding: 10, 
    },
    errorText: { 
        marginTop: 8, 
        color: darkThemeColors.errorOverlayText, 
        fontSize: 14, 
        textAlign: 'center', 
        paddingHorizontal: 10, 
    },
    translateButtonBase: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25,
        alignSelf: 'center', 
        marginTop: 0, 
        marginBottom: 20, 
        elevation: 4,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3,
    },
    translateButtonDisabledStyles: {
        opacity: 0.7,
    },
    translateButtonTextBase: {
        marginLeft: 10,
        fontSize: 16,
        fontWeight: '600',
    },
    translationContainer: {
        marginHorizontal: 20,
        marginTop: 0, 
        marginBottom: Platform.OS === 'ios' ? 30 : 20,
        padding: 15,
        backgroundColor: darkThemeColors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: darkThemeColors.cardBorder,
        alignItems: 'center',
        minHeight: 80, 
        justifyContent: 'center',
    },
    translationTitle: {
        fontSize: 16, 
        fontWeight: '500',
        color: darkThemeColors.secondaryText,
        marginBottom: 8,
    },
    translationGloss: {
        fontSize: 20,
        fontWeight: 'bold',
        color: darkThemeColors.primaryText, 
        textAlign: 'center',
        minHeight: 25, 
    },
    bottomSheetItselfBackground: { 
        backgroundColor: darkThemeColors.bottomSheetBackground, 
        borderTopLeftRadius: 20, 
        borderTopRightRadius: 20, 
    },
    bottomSheetContentContainer: { 
        flex: 1, 
        alignItems: 'center', 
        paddingHorizontal: 20, 
        paddingTop: 20, 
        paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    },
    bottomSheetTitle: { 
        fontSize: 18, 
        fontWeight: '600', 
        marginBottom: 20, 
        color: darkThemeColors.primaryText, 
    },
    bottomSheetButton: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: darkThemeColors.bottomSheetButton, 
        paddingVertical: 15, 
        paddingHorizontal: 20, 
        borderRadius: 10, 
        marginBottom: 12,
        width: '100%', 
    },
    bottomSheetButtonText: { 
        marginLeft: 15, 
        fontSize: 16, 
        color: darkThemeColors.bottomSheetButtonText,
    },
    deleteButton: { 
        backgroundColor: darkThemeColors.deleteButtonBackground,
    },
});

