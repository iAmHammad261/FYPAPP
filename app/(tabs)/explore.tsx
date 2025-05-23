import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Voice, {
    SpeechErrorEvent,
    SpeechRecognizedEvent,
    SpeechResultsEvent,
} from '@react-native-voice/voice';
import { Audio, ResizeMode, Video } from 'expo-av'; // Ensure ResizeMode is imported
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDownloadURL, getStorage, list, ListResult, ref, StorageReference } from 'firebase/storage';
import debounce from 'lodash.debounce';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Platform,
    StatusBar as RNStatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

// --- Firebase Configuration (As provided by user) ---
const firebaseConfig = {
    apiKey: "AIzaSyCyqT96fXk2v4m6buL8v7Xw4M2X9gc46xU",
    authDomain: "fyp-signlang.firebaseapp.com",
    projectId: "fyp-signlang",
    storageBucket: "fyp-signlang.firebasestorage.app", // Kept as user provided
    messagingSenderId: "758598830011",
    appId: "1:758598830011:web:69d92a826669ee89c1a69e",
    measurementId: "G-LGL0SFLVTE"
};

// Initialize Firebase if not already initialized
let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}
const storage = getStorage(app);
// --- End Firebase Configuration ---

// --- Theme Colors (Consistent with HomeScreen styling) ---
const themeColors = {
    background: '#1A1D21',
    surface: '#26292E',      // For search bar, video items
    primaryText: '#EAEAEA',
    secondaryText: '#9E9E9E', // For placeholders, status text, default icons
    accent: '#00ACC1',        // For active mic, retry button, highlights
    accentTransparent: 'rgba(0, 172, 193, 0.5)', // For waves (derived from accent #00ACC1)
    error: '#D32F2F',         // For error icon states (e.g., mic error color)
    errorText: '#E57373',     // Softer red for error text messages
    iconColor: '#B0BEC5',     // General icon color (can be same as secondaryText or distinct)
    disabled: '#757575',      // For disabled states (e.g. text input when listening)
    statusBar: 'light-content', // Assuming light text on dark background for status bar
    videoPlayerBackground: '#000000', // Standard black for video player before load
    cardBorder: '#373A3F', // Added for consistency with other card styles
};

// Constants
const SHAKE_DISTANCE = 5;
const WAVE_DELAY = 300;
const WAVE_DURATION = 1500;
const WAVE_MAX_SCALE = 3.5;
const WAVE_INITIAL_OPACITY = 0.6;
const VIDEOS_PER_PAGE = 10;
const VIDEO_FOLDER_PATH = 'Videos/';
const ANDROID_STATUS_BAR_HEIGHT = RNStatusBar.currentHeight || 24;
const IOS_STATUS_BAR_HEIGHT = 44; // Typical iOS status bar height

const AnimatedMicIcon = Animated.createAnimatedComponent(FontAwesome5);

interface VideoItemData {
    id: string;
    name: string;
    url: string;
}

// --- Styles (Updated with Theme Colors & Header) ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themeColors.background,
        paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT : IOS_STATUS_BAR_HEIGHT,
    },
    // Added Header Styles
    header: {
        paddingHorizontal: 15, // Consistent with overall content padding
        paddingVertical: 15,
        marginBottom: 15, // Space between header and search bar
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: themeColors.cardBorder,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: themeColors.primaryText,
    },
    // End Added Header Styles
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: themeColors.surface,
        borderRadius: 30,
        width: '95%',
        maxWidth: 500,
        height: 55,
        paddingLeft: 20,
        marginBottom: 15, // Reduced from 25 to accommodate header margin
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        color: themeColors.primaryText,
        marginRight: 10,
    },
    iconContainer: {
        width: 55,
        height: 55,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 27.5,
        position: 'relative',
    },
    wavesWrapper: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    wave: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: themeColors.accentTransparent,
    },
    statusText: {
        marginTop: 5,
        marginBottom: 15,
        color: themeColors.secondaryText,
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 25,
    },
    errorText: {
        marginTop: 5,
        marginBottom: 15,
        color: themeColors.errorText,
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
        paddingHorizontal: 25,
    },
    videoFetchErrorText: {
        color: themeColors.errorText,
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 10,
    },
    videoListArea: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 10, // Moved from container to here for content only
    },
    videoListContent: {
        paddingHorizontal: 5,
        paddingBottom: 30,
    },
    initialLoader: {
        alignSelf: 'center',
        marginTop: 60,
    },
    centeredMessage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        paddingBottom: 80,
    },
    footerLoader: {
        paddingVertical: 30,
        alignItems: 'center',
    },
    videoItemContainer: {
        marginBottom: 20,
        backgroundColor: themeColors.surface,
        borderRadius: 12,
        padding: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.15,
        shadowRadius: 4.65,
        elevation: 4,
        marginHorizontal: 5,
        borderWidth: 1, // Added border for card consistency
        borderColor: themeColors.cardBorder, // Using theme color for border
    },
    videoTitle: {
        color: themeColors.primaryText,
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 12,
        textTransform: 'capitalize',
    },
    videoPlayer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: themeColors.videoPlayerBackground,
        borderRadius: 8,
    },
    retryButtonText: {
        color: themeColors.accent,
        fontSize: 16,
        fontWeight: '500',
    }
});
interface VideoListItemProps {
    item: VideoItemData;
}

const VideoListItem: React.FC<VideoListItemProps> = React.memo(({ item }) => {
    const videoRef = useRef<Video>(null);

    return (
        <View style={styles.videoItemContainer}>
            <Text style={styles.videoTitle}>{item.name.replace(/\.(mp4|mov|avi|wmv|mkv)$/i, '')}</Text>
            <Video
                ref={videoRef}
                style={styles.videoPlayer}
                source={{ uri: item.url }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                onError={(error) => console.warn("[VideoListItem] Video Playback Error for", item.name, ":", error)}
            />
        </View>
    );
});

export default function TabTwoScreen() {
    const [searchQuery, setSearchQuery] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [recognizedText, setRecognizedText] = useState('');
    const [voiceError, setVoiceError] = useState('');
    const [microphonePermissionStatus, setMicrophonePermissionStatus] = useState('undetermined');
    const [allVideos, setAllVideos] = useState<VideoItemData[]>([]);
    const [loadingVideos, setLoadingVideos] = useState(false);
    const [videoFetchError, setVideoFetchError] = useState<string | null>(null);
    const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
    const [hasMoreVideos, setHasMoreVideos] = useState(true);
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    const shakeAnim = useSharedValue(0);
    const waveAnims = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];

    const targetMicColor = useDerivedValue(() => {
        'worklet';
        if (isListening) { return themeColors.accent; }
        else if (voiceError) { return themeColors.error; }
        else { return themeColors.secondaryText; }
    }, [isListening, voiceError]);

    const debouncedSearchUpdate = useRef(
        debounce((query: string) => {
            setDebouncedSearchQuery(query);
        }, 300)
    ).current;

    useEffect(() => {
        debouncedSearchUpdate(searchQuery);
        return () => {
            debouncedSearchUpdate.cancel();
        };
    }, [searchQuery, debouncedSearchUpdate]);

    const filteredVideos = useMemo(() => {
        if (!debouncedSearchQuery) {
            return allVideos;
        }
        const lowerCaseQuery = debouncedSearchQuery.toLowerCase().trim();
        if (!lowerCaseQuery) {
            return allVideos;
        }
        return allVideos.filter(video => {
            const cleanName = video.name.replace(/\.(mp4|mov|avi|wmv|mkv)$/i, '').toLowerCase();
            return cleanName.includes(lowerCaseQuery);
        });
    }, [allVideos, debouncedSearchQuery]);

    const fetchVideos = useCallback(async (pageTokenArg: string | undefined) => {
        if (loadingVideos && pageTokenArg !== undefined) {
            console.debug("[fetchVideos] Skipped: already loading more videos.");
            return;
        }
        const isInitialLoad = pageTokenArg === undefined;
        console.debug(`[fetchVideos] Starting fetch. Initial load: ${isInitialLoad}, PageToken: ${pageTokenArg}`);

        setLoadingVideos(true);
        if (isInitialLoad) {
            setVideoFetchError(null);
        }

        try {
            const listRef = ref(storage, VIDEO_FOLDER_PATH);
            const result: ListResult = await list(listRef, {
                maxResults: VIDEOS_PER_PAGE,
                pageToken: pageTokenArg,
            });

            const videoPromises = result.items.map(async (itemRef: StorageReference) => {
                try {
                    const url = await getDownloadURL(itemRef);
                    return { id: itemRef.fullPath, name: itemRef.name, url: url };
                } catch (urlError: any) {
                    console.error(`[fetchVideos] Failed to get download URL for ${itemRef.name}:`, urlError);
                    return null;
                }
            });

            const newVideosData = (await Promise.all(videoPromises)).filter(v => v !== null) as VideoItemData[];

            setAllVideos(prevVideos => {
                const existingIds = new Set(prevVideos.map(v => v.id));
                const uniqueNewVideos = newVideosData.filter(nv => !existingIds.has(nv.id));
                return isInitialLoad ? uniqueNewVideos : [...prevVideos, ...uniqueNewVideos];
            });
            setNextPageToken(result.nextPageToken);
            setHasMoreVideos(!!result.nextPageToken);

            if (isInitialLoad && newVideosData.length === 0 && !result.nextPageToken) {
                console.debug("[fetchVideos] No videos found in the specified folder on initial load.");
            }
        } catch (error: any) {
            console.error('[fetchVideos] Error fetching video list:', error);
            const errorMessage = `Failed to load videos. (Code: ${error.code || 'UNKNOWN'})`;
            setVideoFetchError(errorMessage);
            setHasMoreVideos(false);
            if (isInitialLoad) {
                setAllVideos([]);
            }
        } finally {
            setLoadingVideos(false);
        }
    }, [loadingVideos]); // loadingVideos dependency is important here for the skip logic

    const checkAndRequestMicrophonePermission = async () => {
        try {
            const { status } = await Audio.getPermissionsAsync();
            let currentStatus = status;
            if (status === 'undetermined') {
                const { status: newStatus } = await Audio.requestPermissionsAsync();
                currentStatus = newStatus;
                if (newStatus !== 'granted') {
                    Alert.alert('Permission Required', 'Microphone access is needed for voice search. You can enable it in settings.');
                }
            }
            setMicrophonePermissionStatus(currentStatus);
            if (currentStatus === 'denied') {
                Alert.alert(
                    'Permission Denied',
                    'Microphone access was denied. Please enable it in your device settings to use voice search.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Open Settings', onPress: () => Linking.openSettings() }
                    ]
                );
            }
            return currentStatus;
        } catch (error: any) {
            console.error('[Permission] Error checking/requesting microphone permission', error);
            Alert.alert('Permission Error', `Could not check microphone permissions: ${error.message || 'Unknown error'}`);
            setMicrophonePermissionStatus('denied');
            return 'denied';
        }
    };

    useEffect(() => {
        checkAndRequestMicrophonePermission();
        if (allVideos.length === 0 && !videoFetchError) {
            fetchVideos(undefined);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // fetchVideos is memoized.

    useEffect(() => {
        Voice.onSpeechStart = onSpeechStart;
        Voice.onSpeechRecognized = onSpeechRecognized;
        Voice.onSpeechResults = onSpeechResults;
        Voice.onSpeechEnd = onSpeechEnd;
        Voice.onSpeechError = onSpeechError;

        return () => {
            Voice.destroy().catch(error => console.error("[Effect Cleanup] Error destroying Voice module:", error));
            cancelAnimation(shakeAnim);
            waveAnims.forEach(anim => cancelAnimation(anim));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Handlers are memoized.

    useEffect(() => {
        if (isListening) {
            waveAnims.forEach((anim, index) => {
                anim.value = 0;
                anim.value = withDelay(
                    index * WAVE_DELAY,
                    withRepeat(
                        withTiming(1, { duration: WAVE_DURATION, easing: Easing.out(Easing.ease) }),
                        -1, false
                    )
                );
            });
        } else {
            waveAnims.forEach(anim => {
                cancelAnimation(anim);
                anim.value = withTiming(0, { duration: 150 });
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isListening]);

    const onSpeechStart = useCallback(() => {
        setVoiceError('');
        setIsListening(true);
        setRecognizedText('');
        shakeAnim.value = 0;
    }, [shakeAnim]);

    const onSpeechRecognized = useCallback((e: SpeechRecognizedEvent) => {
        // console.debug('[VoiceEvent] onSpeechRecognized:', e);
    }, []);

    const onSpeechResults = useCallback((e: SpeechResultsEvent) => {
        if (e.value && e.value.length > 0) {
            const text = e.value[0];
            setRecognizedText(text);
            setSearchQuery(text);
        }
    }, []);

    const onSpeechEnd = useCallback(() => {
        setIsListening(false);
    }, []);

    const onSpeechError = useCallback((e: SpeechErrorEvent) => {
        let errorMessage = 'Voice recognition error.';
        if (e.error) {
            const code = String(e.error.code);
            console.error(`[VoiceEvent] Speech Error Code: ${code}, Message: ${e.error.message}`);
            switch (code) {
                case '7': case '6':
                    errorMessage = "Didn't catch that. Try speaking clearly.";
                    shakeAnim.value = withSequence(
                        withTiming(SHAKE_DISTANCE, { duration: 50 }),
                        withRepeat(withTiming(-SHAKE_DISTANCE, { duration: 100 }), 3, true),
                        withTiming(0, { duration: 50 })
                    );
                    break;
                case '5': errorMessage = "Recognition service error on device."; break;
                case '8': case '4': errorMessage = "Service unavailable. Try again later."; break;
                case 'network': case '2': errorMessage = "Network error. Check connection."; break;
                case '9':
                    errorMessage = "Microphone permission issue.";
                    checkAndRequestMicrophonePermission();
                    break;
                default: errorMessage = `Voice error (${code}). Please try again.`;
            }
        } else {
            console.warn('[VoiceEvent] onSpeechError: Event received but no e.error object.');
        }
        setVoiceError(errorMessage);
        setIsListening(false);
    }, [shakeAnim]); // Added checkAndRequestMicrophonePermission to deps implicitly if needed

    const startListening = async () => {
        if (isListening) return;
        const permission = await checkAndRequestMicrophonePermission();
        if (permission !== 'granted') {
            setVoiceError("Microphone permission is required to use voice search.");
            return;
        }

        setRecognizedText('');
        setVoiceError('');
        shakeAnim.value = 0;

        try {
            const servicesAvailable = await Voice.isAvailable();
            if (!servicesAvailable) {
                throw new Error("Voice recognition service is not available on this device.");
            }
            await Voice.start('en-US');
        } catch (error: any) {
            console.error('[Control] Error starting voice recognition:', error);
            const startErrorMessage = `Failed to start: ${error.message || 'Unknown error'}`;
            setVoiceError(startErrorMessage);
            setIsListening(false);
            Alert.alert('Voice Error', startErrorMessage);
        }
    };

    const stopListening = async () => {
        if (!isListening) return;
        try {
            await Voice.stop();
        } catch (error: any) {
            console.error('[Control] Error stopping voice recognition:', error);
            const stopErrorMessage = `Error stopping: ${error.message || 'Unknown error'}`;
            setVoiceError(stopErrorMessage);
            Alert.alert('Voice Error', stopErrorMessage);
        }
    };

    const handleMicPress = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const micIconContainerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeAnim.value }],
    }));

    const animatedMicIconStyle = useAnimatedStyle(() => ({
        color: withTiming(targetMicColor.value, {
            duration: 150,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
    }));

    const waveStyle1 = useAnimatedStyle(() => {
        'worklet';
        const animProgress = waveAnims[0].value;
        const scale = interpolate(animProgress, [0, 1], [1, WAVE_MAX_SCALE], Extrapolation.CLAMP);
        const opacity = interpolate(animProgress, [0, 0.1, 0.8, 1], [0, WAVE_INITIAL_OPACITY, WAVE_INITIAL_OPACITY * 0.5, 0], Extrapolation.CLAMP);
        return { opacity: opacity, transform: [{ scale: scale }] };
    });
    const waveStyle2 = useAnimatedStyle(() => {
        'worklet';
        const animProgress = waveAnims[1].value;
        const scale = interpolate(animProgress, [0, 1], [1, WAVE_MAX_SCALE], Extrapolation.CLAMP);
        const opacity = interpolate(animProgress, [0, 0.1, 0.8, 1], [0, WAVE_INITIAL_OPACITY, WAVE_INITIAL_OPACITY * 0.5, 0], Extrapolation.CLAMP);
        return { opacity: opacity, transform: [{ scale: scale }] };
    });
    const waveStyle3 = useAnimatedStyle(() => {
        'worklet';
        const animProgress = waveAnims[2].value;
        const scale = interpolate(animProgress, [0, 1], [1, WAVE_MAX_SCALE], Extrapolation.CLAMP);
        const opacity = interpolate(animProgress, [0, 0.1, 0.8, 1], [0, WAVE_INITIAL_OPACITY, WAVE_INITIAL_OPACITY * 0.5, 0], Extrapolation.CLAMP);
        return { opacity: opacity, transform: [{ scale: scale }] };
    });
    const waveStyles = [waveStyle1, waveStyle2, waveStyle3];

    const renderVideoItem = useCallback(({ item }: { item: VideoItemData }) => {
        return <VideoListItem item={item} />;
    }, []);

    const handleLoadMore = useCallback(() => {
        if (debouncedSearchQuery || !hasMoreVideos || loadingVideos) {
            return;
        }
        if (nextPageToken) {
            fetchVideos(nextPageToken);
        }
    }, [debouncedSearchQuery, hasMoreVideos, loadingVideos, nextPageToken, fetchVideos]);

    const renderFooter = () => {
        if (debouncedSearchQuery) return null;
        if (loadingVideos && allVideos.length > 0) {
            return (
                <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color={themeColors.secondaryText} />
                </View>
            );
        }
        if (!loadingVideos && !hasMoreVideos && allVideos.length > 0) {
            return <Text style={styles.statusText}>End of video list.</Text>;
        }
        return null;
    };

    return (
        <View style={styles.container}>
            <RNStatusBar barStyle={themeColors.statusBar} backgroundColor={themeColors.background} translucent={Platform.OS === 'android'} />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Explore Signs</Text>
            </View>
            <View style={styles.searchBarContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search signs or tap mic..."
                    placeholderTextColor={themeColors.secondaryText}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isListening}
                    returnKeyType="search"
                    onSubmitEditing={() => {
                        debouncedSearchUpdate.flush();
                    }}
                />
                <TouchableOpacity
                    style={styles.iconContainer}
                    onPress={handleMicPress}
                    disabled={microphonePermissionStatus === 'denied' && !isListening}
                >
                    <View style={styles.wavesWrapper}>
                        {waveStyles.map((waveStyle, index) => (
                            <Animated.View key={`wave_${index}`} style={[styles.wave, waveStyle]} />
                        ))}
                    </View>
                    <Animated.View style={micIconContainerStyle}>
                        <AnimatedMicIcon
                            name="microphone"
                            size={24}
                            style={[
                                animatedMicIconStyle,
                                microphonePermissionStatus === 'denied' && { opacity: 0.4 }
                            ]}
                        />
                    </Animated.View>
                </TouchableOpacity>
            </View>

            {voiceError ? <Text style={styles.errorText}>{voiceError}</Text> : null}
            {microphonePermissionStatus === 'denied' && !voiceError && (
                <Text style={styles.errorText}>Microphone permission denied. Enable in settings for voice search.</Text>
            )}
            {microphonePermissionStatus === 'undetermined' && !voiceError && (
                <Text style={styles.statusText}>Requesting microphone permission...</Text>
            )}

            <View style={styles.videoListArea}>
                {loadingVideos && allVideos.length === 0 && !videoFetchError && (
                    <ActivityIndicator size="large" color={themeColors.secondaryText} style={styles.initialLoader} />
                )}
                {videoFetchError && (
                    <View style={styles.centeredMessage}>
                        <Text style={styles.videoFetchErrorText}>{videoFetchError}</Text>
                        <TouchableOpacity onPress={() => fetchVideos(undefined)} style={{ marginTop: 15 }}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {!loadingVideos && !videoFetchError && allVideos.length === 0 && !debouncedSearchQuery && (
                    <View style={styles.centeredMessage}>
                        <Text style={styles.statusText}>No videos found in storage.</Text>
                    </View>
                )}
                {!videoFetchError && filteredVideos.length === 0 && debouncedSearchQuery && (
                    <View style={styles.centeredMessage}>
                        <Text style={styles.statusText}>No videos found matching "{debouncedSearchQuery}".</Text>
                    </View>
                )}
                
                {!videoFetchError && (allVideos.length > 0 || debouncedSearchQuery) && (
                    <FlatList
                        data={filteredVideos}
                        renderItem={renderVideoItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.videoListContent}
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.6}
                        ListFooterComponent={renderFooter}
                        initialNumToRender={7}
                        maxToRenderPerBatch={5}
                        windowSize={11}
                        removeClippedSubviews={Platform.OS === 'android'}
                        keyboardShouldPersistTaps="handled"
                    />
                )}
            </View>
        </View>
    );
}
