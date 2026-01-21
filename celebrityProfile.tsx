import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { PermissionsAndroid , Alert } from "react-native";
import Video from 'react-native-video';
import React from "react";
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import ImagePicker from 'react-native-image-crop-picker';
import { useEffect, useRef, useState } from "react";
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import RNFS from 'react-native-fs';
import { useTranslation } from "react-i18next";
import { WebView } from "react-native-webview";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  View
} from "react-native";


import { trim } from 'react-native-video-trim';

import { db, auth , storage } from "../../firebaseConfig";
import { NativeModules } from 'react-native';
const { VideoRemux } = NativeModules;
const { VideoThumbnail } = NativeModules;

/* -------------------- LAYOUT -------------------- */

const { width, height } = Dimensions.get("window");
const POST_GAP = 15;
const postWidth = (width - 45) / 2;
const PAGE_SIZE = 20;
const CARD_WIDTH = width * 0.35;
const CARD_MARGIN_RIGHT = 15;

const generateHeight = () => postWidth * (1.3 + Math.random() * 0.5);


/* -------------------- UTILS -------------------- */

// Simple hash to int from string for consistent color selection
function hashStringToInt(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/* -------------------- SKELETON -------------------- */

function SkeletonPost({ height }: { height: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-postWidth, postWidth],
  });

  return (
    <View style={[styles.skeleton, { height }]}>
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "#333",
          transform: [{ translateX }],
          opacity: 0.4,
        }}
      />
    </View>
  );
}

/* -------------------- POST -------------------- */

function AnimatedPost({
  uri,
  id,
  height: heightProp,
  onHeightMeasured,
  onLongPress,
  onPressOut,
  onPress,
  mediaType,
  initialViews = 0,
  initialLikes = 0,
  liked: likedProp,
  onViewsChange,
  onLikesChange,
  showOverlay = true,
  thumbnail,

}: any) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const [views, setViews] = useState(initialViews);
  const [likes, setLikes] = useState(initialLikes);

  const [liked, setLiked] = useState(() => likedPostCache.has(id));
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);


  
  const height = measuredHeight ?? heightProp;

  const onLayout = (event: LayoutChangeEvent) => {
    const { height: layoutHeight } = event.nativeEvent.layout;

    if (heightProp == null && measuredHeight !== layoutHeight) {
      setMeasuredHeight(layoutHeight);
      onHeightMeasured?.(id, layoutHeight);
    }
  };

  useEffect(() => {
    if (heightProp != null && heightProp !== measuredHeight) {
      setMeasuredHeight(heightProp);
    }
  }, [heightProp]);


  useEffect(() => {
    setLikes(initialLikes);
  }, [initialLikes]);

  


  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const onPostPress = () => {
    setViews((prev) => {
      const newViews = prev + 1;
      onViewsChange?.(newViews);
      return newViews;
    });
    onPress?.();
  };

  const onPostPressOut = () => {
    onPressOut?.();
  };

  const onPostLongPress = () => {
    setViews((prev) => {
      const newViews = prev + 1;
      onViewsChange?.(newViews);
      return newViews;
    });
    onLongPress?.();
  };

  const onLikePress = (e: any) => {
    e.stopPropagation();

    if (liked) {
      // Unlike: remove from cache and update state
      likedPostCache.delete(id);
      setLiked(false);

      // Trigger parent's like handler, passing false (unliked)
      onLikesChange && onLikesChange(false);
    } else {
      // Like: add to cache and update state
      likedPostCache.add(id);
      setLiked(true);

      // Trigger parent's like handler, passing true (liked)
      onLikesChange && onLikesChange(true);

      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.4,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };




  const overlayColors = [
  "rgba(120, 20, 20, 0.5)",    // Dark Burgundy
  "rgba(20, 50, 90, 0.5)",     // Deep Midnight Blue
  "rgba(100, 85, 30, 0.5)",    // Olive Drab
  "rgba(20, 70, 70, 0.5)",     // Teal Green
  "rgba(55, 30, 100, 0.5)",    // Indigo
];

  const overlayColor = overlayColors[hashStringToInt(uri || "") % overlayColors.length];

  const formatViews = (num: number) => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + "B+";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M+";
    if (num >= 1_000) return (num / 1_000).toFixed(1) + "K+";
    return num.toString();
  };
  const cleanUri = uri.split("?")[0];
  const isVideo = /\.(mp4|mov|webm|mkv)$/i.test(cleanUri);
  console.log('uri and isVideo');
  console.log(cleanUri);
  console.log(isVideo);
  console.log(`thumbnailUri is : ${thumbnail}`)
  console.log(`uri is ${uri}`);
  return (
    <Animated.View style={{ opacity, marginBottom: POST_GAP }} >
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={onPostLongPress}
        onPressOut={onPostPressOut}
        onPress={onPostPress}
      >
        <View style={{ width: postWidth, height, borderRadius: 8, overflow: "hidden",position: "relative" }}>
            {
              (isVideo) ? (
                <Image
                source={{ uri: thumbnail }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              ) : (
                <Image source={{ uri: uri }} style={StyleSheet.absoluteFill} resizeMode="cover"  />
              )
            }
            
          {/* OVERLAY */}

          {showOverlay && (
            <View style={{...StyleSheet.absoluteFill, backgroundColor: overlayColor,}}/>
          )}

          {/* LIKE + VIEWS */}
          {/* CENTERED LIKE BUTTON */}
          <View
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: [{ translateX: -16 }, { translateY: -16 }],
            }}
          >
           <Animated.View
              style={{
                transform: [{ scale }],
                opacity: scale.interpolate({
                  inputRange: [0.9, 1],
                  outputRange: [0, 1],
                }),
              }}
            >
              <TouchableOpacity onPress={onLikePress} activeOpacity={0.85}>
                <FontAwesome
                  name={liked ? "heart" : "heart-o"}   // filled or outlined heart
                  size={32}
                  color={liked ? "#ff2d2d" : "#ffffff"}  // red or white
                />
              </TouchableOpacity>
            </Animated.View>


          </View>

          {/* STATS (BOTTOM RIGHT) */}
          <View style={{ position: "absolute", bottom: 10, right: 10 }}>
            {/* VIEWS */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 12,
                  width: 55,
                  textAlign: "right",
                  marginRight: 4,
                }}
              >
                {formatViews(views)}
              </Text>
              <Text style={{ color: "#fff", fontSize: 12 }}>views</Text>
            </View>

            {/* LIKES */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 12,
                  width: 55,
                  textAlign: "right",
                  marginRight: 4,
                }}
              >
                {formatViews(likes)}
              </Text>
              <Text style={{ color: "#fff", fontSize: 12 }}>likes</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const AnimatedPostMemo = React.memo(AnimatedPost, (prevProps, nextProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.height === nextProps.height &&
    prevProps.liked === nextProps.liked &&
    prevProps.initialLikes === nextProps.initialLikes &&
    prevProps.initialViews === nextProps.initialViews &&
    prevProps.uri === nextProps.uri
  );
});

type CelebrityProfileRouteProp = RouteProp<RootStackParamList, "CelebrityProfile">;


/* -------------------- MAIN COMPONENT -------------------- */

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const likedPostCache = new Set<string>();


export default function CelebrityProfile() {
  const [activeTab, setActiveTab] = useState<"posts" | "linked" | "updates">("posts");
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkId, setLinkId] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = auth().currentUser?.uid;
  const { t } = useTranslation();

  const route = useRoute<CelebrityProfileRouteProp>();
  const { id, providerId, actualUserId } = route.params;
  const isAdmin = name === "brkandcnct";
  const [step, setStep] = useState<0 | 1 | 2>(0);

  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isVideoLoading, setIsVideoLoading] = useState(false);


  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{
    uri: string;
    type: "image" | "video";
    duration?: number;
  } | null>(null);
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fullScreenPost, setFullScreenPost] = useState<any | null>(null);
  const contentTypes = ["Behind The Scenes", "Announcement", "Promo", "Personal", "Other"];
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const [duration, setDuration] = useState(0);
  const [segments, setSegments] = useState<{ time: number; uri: string }[]>([]);
  const videoRef = useRef<any>(null);
  const videoLoadedRef = useRef(false);
  const isLoopSeekingRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [currentThumbnailUri, setCurrentThumbnailUri] = useState<string | null>(null);

  const timelineWidth = useRef(0);
  const scrubberX = useRef(new Animated.Value(0)).current;
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const isScrubbing = useRef(false);

  const [celebrityUid, setCelebrityUid] = useState(null);
  const [uid, setUid] = useState<string | null>(null);

  const TRIM_WINDOW_SEC = 30;
  
  useEffect(() => {
    if (selectedMedia) {
      setUploaded(false);
    }
  }, [selectedMedia]);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged(user => {
      setUid(user?.uid ?? null);
    });
    return unsub;
  }, []);

  //useEffect(() => {
  //   if (!id) return;

  //   const fetchPostsWithLikeStatus = async () => {
  //     const currentUserId = auth().currentUser?.uid;

  //     try {
  //       const postsSnapshot = await db()
  //         .collection("celebrities")
  //         .doc(id)
  //         .collection("posts")
  //         .orderBy("createdAt", "desc")
  //         .get();

  //       const postsWithLikeStatus = await Promise.all(postsSnapshot.docs.map(async doc => {
  //         const postData = doc.data();
  //         let liked = false;
  //         if (currentUserId) {
  //           const likeDoc = await doc.ref.collection("likesBy").doc(currentUserId).get();
  //           liked = likeDoc.exists;
  //         }
  //         return {
  //           id: doc.id,
  //           ...postData,
  //           liked,
  //         };
  //       }));

  //       setPosts(postsWithLikeStatus);
  //     } catch (err) {
  //       console.error("Error fetching posts with liked status:", err);
  //     }
  //   };

  //   fetchPostsWithLikeStatus();

  // }, [id]);

  // useEffect(() => {
  // if (!id) return;

  // const fetchPostsWithLikeStatus = async () => {
  //   const currentUserId = auth().currentUser?.uid;

  //   try {
  //     const postsSnapshot = await db()
  //       .collection("celebrities")
  //       .doc(id)
  //       .collection("posts")
  //       .orderBy("createdAt", "desc")
  //       .get();

  //     const postsWithLikeStatus = await Promise.all(
  //       postsSnapshot.docs.map(async doc => {
  //         const postData = doc.data();

  //         let liked = false;

  //         if (currentUserId) {
  //           const userLikeDoc = await doc.ref
  //             .collection("likesBy")
  //             .doc(currentUserId)
  //             .get();

  //           liked = userLikeDoc.exists;
  //         }

  //         return {
  //           id: doc.id,
  //           ...postData,
  //           liked,
  //         };
  //       })
  //     );

  //     setPosts(postsWithLikeStatus);
  //   } catch (err) {
  //     console.error("Error fetching posts with liked status:", err);
  //   }
  // };

  // fetchPostsWithLikeStatus();
  // }, [id]);


  useEffect(() => {
  if (!id || !uid) return;

  const unsubscribe = db()
    .collection("celebrities")
    .doc(id)
    .collection("posts")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      setPosts(prev =>
        snapshot.docs.map(doc => {
          const data = doc.data();
          // Find post in previous state (prev) to preserve optimistic liked/likes
          const local = prev.find(p => p.id === doc.id);

          return {
            id: doc.id,
            ...data,
            liked: local?.liked ?? !!data.likedBy?.[uid],
            likes: local?.likes ?? data.likes ?? 0,
          };
        })
      );
    });

  return () => unsubscribe();
  }, [id, uid]);









  useEffect(() => {
    async function fetchUid() {
      try {
        const docRef = db().collection("celebrities").doc(id);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          const data = docSnap.data();
          setCelebrityUid(data?.uid || null);
        } else {
          console.log("No such document!");
          setCelebrityUid(null);
        }
      } catch (error) {
        console.error("Error fetching uid:", error);
        setCelebrityUid(null);
      }
    }
    fetchUid();
  }, []);

  const generate30SecSegments = async (videoDuration: number) => {
    if (!selectedMedia?.uri) return;

    const segmentSize = 30;
    const totalSegments = Math.ceil(videoDuration / segmentSize);
    const frames: { time: number; uri: string }[] = [];

    try {
      // Resolve video path (native-safe)
      let videoPath = selectedMedia.uri;

      if (videoPath.startsWith("file://")) {
        videoPath = videoPath.replace("file://", "");
      }

      for (let i = 0; i < totalSegments; i++) {
        const timeSec = i * segmentSize;
        const timeMs = timeSec * 1000;

        try {
          const result = await NativeModules.VideoThumbnail.createThumbnailAtTime(
            videoPath,
            timeMs
          );

          if (result?.path) {
            frames.push({
              time: timeSec,
              uri: `file://${result.path}`,
            });
          }
        } catch (err) {
          console.warn(`[Segments] Failed at ${timeSec}s`, err);
        }
      }

      setSegments(frames);
    } catch (err) {
      console.error("[Segments] Generation failed", err);
    }
  };


  const linkAccount = async () => {
  if (!linkId.trim()) return;

  try {
    const snap = await db()
      .collection("celebrities")
      .doc(linkId.trim())
      .get();

    if (!snap.exists) {
      alert("Account not found");
      return;
    }

    const data = snap.data();

    await db()
      .collection("celebrities")
      .doc("brkandcnct")
      .collection("linkedAccounts")
      .add({
        id: linkId.trim(),
        name: data?.name || linkId,
        profilePic: data?.profilePic || null,
        linkedAt: db.FieldValue.serverTimestamp(),
      });

    setLinkId("");
    setLinkModalVisible(false);

  } catch (e) {
    console.error("Link failed", e);
  }
  };


  const uploadPost = async () => {
    if (!description.trim()) return;

    setUploading(true);

    try {
      await performUpload();
      setUploaded(true);
      setStep(0);
    } catch (err) {
      console.error("Upload failed:", err);
      alert(
        `Upload failed: ${
          err instanceof Error ? err.message : JSON.stringify(err)
        }`
      );
    } finally {
      setUploading(false);
    }
  };

  const goToStep = (nextStep: 0 | 1 | 2) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -12,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(nextStep);

      slideAnim.setValue(12);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  // const isExpired = (createdAt: any) => {
  //   const date = createdAt?.toDate?.();
  //   if (!date) return false;

  //   return Date.now() - date.getTime() > THREE_DAYS_MS;
  // };

  const ONE_MINUTE_MS = 60 * 1000;

  const isExpired = (createdAt: any) => {
    const date = createdAt?.toDate?.();
    if (!date) return false;

    return Date.now() - date.getTime() > ONE_MINUTE_MS;
  };



  // useEffect(() => {
  //   if (duration > 0 && selectedMedia?.type === "video") {
  //     alert(`duration is : ${duration}`);
      
  //   }
  // }, [duration, selectedMedia]);



  useEffect(() => {
    const createLinkedAccountDoc = async () => {
      const linkedAccountsRef = db()
        .collection("celebrities")
        .doc(id)
        .collection("linkedAccounts");

      // Check if there is at least one linkedAccount doc
      const snapshot = await linkedAccountsRef.limit(1).get();

      if (snapshot.empty) {
        // No linked accounts, so add one
        await linkedAccountsRef.add({
          name: "sajramkisho",
          profilePhoto: "", // add real URL here
          linkedAt: db.FieldValue.serverTimestamp(),
        });
        console.log("Linked account created!");
      } else {
        console.log("Linked accounts already exist");
      }
    };

    createLinkedAccountDoc();
  }, [id]);

  useEffect(() => {
    const fetchName = async () => {
      try {
        const docRef = db().collection('celebrities').doc(id);
        const docSnap = await docRef.get();

        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data?.name || null);
        } else {
          setError('Document does not exist');
        }
      } catch (e) {
        setError('Failed to fetch name');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchName();
  }, [id]);

  useEffect(() => {
    if (!isAdmin || activeTab !== "linked") return;

    const unsub = db()
      .collection("celebrities")
      .doc(id)
      .collection("linkedAccounts")
      .orderBy("linkedAt", "desc")
      .onSnapshot((snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setLinkedAccounts(data);
      });

    return () => unsub();
  }, [activeTab]);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      try {
        const celebDocRef = db().collection("celebrities").doc(id);
        const snap = await celebDocRef.get();
        if (snap.exists()) setProfilePicUrl(snap.data()?.photoURL);

        const postsQuery = db()
        .collection("celebrities")
        .doc(id)
        .collection("posts")
        .orderBy("createdAt", "desc")
        .limit(PAGE_SIZE);

        const snapshot = await postsQuery.get();

        if (!snapshot.empty) {
          const loadedPosts = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          const postsWithHeight = loadedPosts.map((post) => ({
            ...post,
            h: generateHeight(),
          }));

          setPosts(postsWithHeight);
        }
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);


  useEffect(() => {
    if (!modalVisible) {
      setDescription("");
      setSelectedMedia(null);
      setContentType(null);
    }
  }, [modalVisible]);


  const openImagePicker = (fromCamera = false) => {
    setModalVisible(false);

    setTimeout(async () => {
        try {
            const options = {
                mediaType: 'mixed',          // photos and videos
                includeExtra: true,          // includes metadata if needed
                quality: 1,                  // max quality (iOS only)
                videoMaxDuration: 20,        // max video duration in seconds
                selectionLimit: 1,           // single selection
                saveToPhotos: true,          // save camera photos to gallery (only for launchCamera)
            };

            const res = fromCamera ? await launchCamera(options) : await launchImageLibrary(options);

            if (res.didCancel) {
                // User cancelled picker
                setModalVisible(true);
            } else if (res.errorCode) {
                console.error('Media picker error:', res.errorMessage);
                setModalVisible(true);
            } else if (res.assets && res.assets.length > 0) {
                setSelectedMedia(res.assets[0]);
                setModalVisible(true);
            } else {
                setModalVisible(true);
            }

        }
        catch (err) {
            console.error('Media picker error:', err);
            setModalVisible(true);
        }
    }, 300);
 }


 const openVideoPicker = async () => {
  setModalVisible(false);
  setTimeout(async () => {
      try {
        const res = await ImagePicker.openPicker({
          mediaType: 'video',
        });
        if (res) {
          setSelectedMedia({
            uri: res.path,
            type: "video",
            duration: res.duration
          });
        }
        setModalVisible(true);
      } catch (err) {
        setModalVisible(true);
      }
  }, 300);
  
};

  const deleteLocalFileIfExists = async (filePath: string) => {
    try {
      const normalizedPath = filePath.replace('file://', '');
      const exists = await RNFS.exists(normalizedPath);

      if (!exists) {
        console.log('Temp file already deleted:', normalizedPath);
        return;
      }

      await RNFS.unlink(normalizedPath);
      console.log('Temp file deleted:', normalizedPath);
    } catch (err) {
      console.warn('Failed to delete temp file:', err);
    }
  };

  // async function uploadThumbnail(localFileUri: string, celebrityId: string): Promise<string> {
  //   const path = localFileUri.replace('file://', '');
  //   const thumbnailName = `thumbnails/${celebrityId}/thumb_${Date.now()}.jpg`;  // <-- include celebrityId folder here
  //   const ref = storage().ref(thumbnailName);
  //   await ref.putFile(path);
  //   const downloadUrl = await ref.getDownloadURL();
  //   return downloadUrl;
  // }

  async function uploadThumbnail(localFileUri: string, celebrityId: string): Promise<string> {
    if (!localFileUri.startsWith("file://") && !localFileUri.startsWith("/")) {
      throw new Error("uploadThumbnail expects a LOCAL file path");
    }

    const path = localFileUri.replace("file://", "");
    const thumbPath = `thumbnails/${celebrityId}/thumb_${Date.now()}.jpg`;

    const ref = storage().ref(thumbPath);
    await ref.putFile(path);

    return await ref.getDownloadURL();
  }


  const performUpload = async () => {
    let tempFilePath: string | null = null;

    try {
      const userId = auth().currentUser?.uid;
      console.log("[UPLOAD] User:", userId);

      // ───────────── BASIC VALIDATION ─────────────
      if (!selectedMedia || !id) {
        Alert.alert("Upload Error", "Missing media or user ID");
        return;
      }

      if (!description || !description.trim()) {
        Alert.alert("Upload Error", "Description cannot be empty");
        return;
      }

      if (!contentType) {
        Alert.alert("Upload Error", "Please select content type");
        return;
      }

      setIsUploading(true);

      // ───────────── ANDROID MEDIA PERMISSION ─────────────
      if (Platform.OS === "android" && selectedMedia.type === "video") {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO
        );
      }

      // ───────────── RESOLVE FILE PATH ─────────────
      const originalUri = selectedMedia.uri;
      let finalPath: string;

      if (originalUri.startsWith("content://")) {
        const extension =
          selectedMedia.type === "video" ? "mp4" : "jpg";

        tempFilePath = `${RNFS.CachesDirectoryPath}/upload_${Date.now()}.${extension}`;
        await RNFS.copyFile(originalUri, tempFilePath);
        finalPath = tempFilePath;
      } else if (originalUri.startsWith("file://")) {
        finalPath = originalUri.replace("file://", "");
      } else {
        finalPath = originalUri;
      }

      if (!finalPath) {
        throw new Error("File path resolution failed");
      }

      // ───────────── STORAGE FILE NAME ─────────────
      const fileExtension =
        selectedMedia.type === "video" ? "mp4" : "jpg";

      const storagePath = `posts/${id}/${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.${fileExtension}`;

      // ───────────── VIDEO THUMBNAIL (NATIVE MODULE) ─────────────
      let thumbnailUrl: string | null = null;

      if (selectedMedia.type === "video") {
        try {
          const result = await NativeModules.VideoThumbnail.createThumbnail(
            `file://${finalPath}`
          );

          if (result?.path) {
            thumbnailUrl = await uploadThumbnail(result.path, id);
          }
        } catch (thumbError) {
          console.warn("[THUMBNAIL] Skipped:", thumbError);
          thumbnailUrl = null;
        }
      }

      // ───────────── UPLOAD TO FIREBASE STORAGE ─────────────
      const fileRef = storage().ref(storagePath);
      await fileRef.putFile(finalPath);
      const fileUrl = await fileRef.getDownloadURL();

      // ───────────── CREATE POST DOCUMENT ─────────────
      const postRef = await db()
        .collection("celebrities")
        .doc(id)
        .collection("posts")
        .add({
          uri: fileUrl,
          thumbnail: thumbnailUrl,
          description: description.trim(),
          createdAt: db.FieldValue.serverTimestamp(),
          storagePath,
          mediaType: selectedMedia.type,
          duration: selectedMedia.duration ?? null,
          contentType,
          views: 0,
          likes: 0,
          likedBy: {},
          h: generateHeight(),
          expireAt: new Date(Date.now() + 60 * 1000),
        });

      // ───────────── FEATURED POSTS UPDATE ─────────────
      const featuredRef = db()
        .collection("featuredPosts")
        .doc("featuredPostsDocument");

      const snapshot = await featuredRef.get();

      const currentUris =
        snapshot.exists && Array.isArray(snapshot.data()?.uris)
          ? snapshot.data()!.uris
          : [];

      const featuredItem = {
        url: fileUrl,
        createdAt: db.Timestamp.now(),
        expireAt: new Date(Date.now() + 60 * 1000),
      };

      await featuredRef.set(
        {
          uris: [...currentUris, featuredItem],
          updatedAt: db.FieldValue.serverTimestamp(),
          createdAt:
            snapshot.exists && snapshot.data()?.createdAt
              ? snapshot.data()!.createdAt
              : db.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // ───────────── UPDATE LOCAL STATE ─────────────
      setPosts((prev) => [
        {
          id: postRef.id,
          uri: fileUrl,
          thumbnail: thumbnailUrl,
          description: description.trim(),
          createdAt: new Date(),
          storagePath,
          mediaType: selectedMedia.type,
          duration: selectedMedia.duration ?? null,
          contentType,
          views: 0,
          likes: 0,
          likedBy: {},
          liked: false,
          h: generateHeight(),
        },
        ...prev,
      ]);

      Alert.alert("Upload Successful ✅");

      // ───────────── RESET UI STATE ─────────────
      setSelectedMedia(null);
      setDescription("");
      setContentType(null);
      setModalVisible(false);
      setStep(1);
    } catch (error: any) {
      console.error("[UPLOAD FAILED]", error);
      Alert.alert("Upload Failed ❌", error?.message || "Unknown error");
    } finally {
      setIsUploading(false);

      // ───────────── CLEAN TEMP FILE ─────────────
      if (tempFilePath) {
        RNFS.unlink(tempFilePath).catch(() => {});
      }
    }
  };












  const closeFullScreen = () => {
    setIsVideoLoading(false);
    setFullScreenPost(null);
  };


  // Distribute posts to left and right columns (masonry)
  const left: any[] = [];
  const right: any[] = [];
  let lh = 0,
    rh = 0;

  posts.forEach((p) => {
    const h = p.h;
    if (lh <= rh) {
      left.push(p);
      lh += h + POST_GAP;
    } else {
      right.push(p);
      rh += h + POST_GAP;
    }
  });

  // Firestore update handlers for views and likes
  const updatePostViews = async (postId: string, newViews: number) => {
    try {
      const postRef = db().collection('celebrities').doc(id).collection('posts').doc(postId);
      await postRef.update({ views: newViews });
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, views: newViews } : p))
      );
    } catch (err) {
      console.error("Error updating views:", err);
    }
  };

  // A simple in-memory lock to prevent multiple parallel toggles on the same post
const likeInProgress = new Set<string>();

const updatePostLikes = async (
  postId: string,
  userId: string | undefined
) => {
  console.log(`[DEBUG] updatePostLikes called for postId=${postId} userId=${userId}`);
  console.log(`[DEBUG] Authenticated user: ${auth().currentUser?.uid}`);
  console.log(`[DEBUG] Celebrity ID (id): ${id}`);

  if (!userId) {
    console.warn("[WARN] User not logged in");
    return;
  }

  if (userId !== auth().currentUser?.uid) {
    console.warn(
      `[WARN] userId param (${userId}) does not match authenticated user (${auth().currentUser?.uid})`
    );
    return;
  }

  if (!id) {
    console.warn("[WARN] Celebrity ID missing");
    return;
  }

  if (likeInProgress.has(postId)) {
    console.log(`[DEBUG] Like already in progress for post ${postId}`);
    return;
  }

  likeInProgress.add(postId);
  console.log("[DEBUG] Starting like/unlike transaction...");

  const postRef = db()
    .collection("celebrities")
    .doc(id)
    .collection("posts")
    .doc(postId);

  try {
    let alreadyLiked = false;
    let currentLikes = 0;

    await db().runTransaction(async transaction => {
      const postSnap = await transaction.get(postRef);

      if (!postSnap.exists) {
        throw new Error("Post does not exist");
      }

      const data = postSnap.data()!;
      const likedBy = data.likedBy ?? {};

      alreadyLiked = !!likedBy[userId];
      currentLikes = data.likes ?? 0;

      console.log(`[DEBUG] alreadyLiked=${alreadyLiked}, currentLikes=${currentLikes}`);

      if (alreadyLiked) {
        delete likedBy[userId];
      } else {
        likedBy[userId] = true;
      }

      transaction.update(postRef, {
        likedBy,
        likes: Math.max(0, currentLikes + (alreadyLiked ? -1 : 1)),
      });
    });

    console.log("[DEBUG] Transaction committed successfully");

    // ✅ Optimistic UI update
    setPosts(prev =>
      prev.map(p =>
        p.id === postId
          ? {
              ...p,
              liked: !alreadyLiked,
              likes: alreadyLiked
                ? Math.max(0, p.likes - 1)
                : p.likes + 1,
            }
          : p
      )
    );

    console.log("[DEBUG] Local state updated");
  } catch (err) {
    console.error("[ERROR] Error toggling like:", err);
  } finally {
    likeInProgress.delete(postId);
    console.log("[DEBUG] Like operation finished");
  }
};







  // const updatePostLikes = async (postId: string, newLikes: number) => {
  //   try {
  //     const postRef = db().collection("celebrities").doc(id).collection("posts").doc(postId)
  //     await postRef.update({ likes: newLikes });
  //     setPosts((prev) =>
  //       prev.map((p) => (p.id === postId ? { ...p, likes: newLikes } : p))
  //     );
  //   } catch (err) {
  //     console.error("Error updating likes:", err);
  //   }
  // };
  const windowWidth = Dimensions.get('window').width;
  const panX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollPosition = useRef(0);
  const thumbnailWidth = 90;
  const SCROLL_THRESHOLD = 50;
  const SCROLL_SPEED = 15;
  const [containerWidth, setContainerWidth] = useState(windowWidth - 24);
  const thumbnailCount = segments.length;
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(0);
  const durationRef = useRef(0);
  const maxTranslateXRef = useRef(1);
  const maxX = maxTranslateXRef.current;
  
  const panResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: () => {
      return true;
    },
    onMoveShouldSetPanResponder: () => {
      return true;
    },

    onPanResponderGrant: () => {
      isScrubbing.current = true;
      setPaused(true);
      panX.setOffset(lastOffset.current);
      panX.setValue(0);
    },

    onPanResponderMove: Animated.event(
      [null, { dx: panX }],
      {
        useNativeDriver: false,
        listener: (_, gestureState) => {
          const maxX = maxTranslateXRef.current;
          const d = durationRef.current;

          if (!maxX || !d || d <= TRIM_WINDOW_SEC) {
            return;
          }

          if (maxX <= 0 || d <= TRIM_WINDOW_SEC) {
            return;
          }

          let newX = gestureState.dx + lastOffset.current;
          newX = Math.max(0, Math.min(newX, maxX));

          // Update panX value directly for smoother behavior
          panX.setValue(newX - lastOffset.current);

          const ratio = newX / maxX;
          const maxStart = d - TRIM_WINDOW_SEC;
          const start = Math.max(0, ratio * maxStart);

          trimStartRef.current = start;
          trimEndRef.current = start + TRIM_WINDOW_SEC;

          setTrimStart(start);
          setTrimEnd(trimEndRef.current);

          videoRef.current?.seek(start);
        },
      }
    ),

    onPanResponderRelease: (_, gestureState) => {
      const maxX = maxTranslateXRef.current;
      const d = durationRef.current;

      isScrubbing.current = false;

      let rawX = lastOffset.current + gestureState.dx;
      rawX = Math.max(0, Math.min(rawX, maxX));
      lastOffset.current = rawX;

      // Calculate the ratio and start time for seeking video
      const ratio = rawX / maxX;
      const maxStart = d - TRIM_WINDOW_SEC;
      const start = Math.max(0, ratio * maxStart);

      trimStartRef.current = start;
      trimEndRef.current = start + TRIM_WINDOW_SEC;

      panX.flattenOffset();
      panX.setValue(rawX);

      videoRef.current?.seek(start);
      setPaused(false);
    },
  })
).current;

  const onProgress = (progress: any) => {
    if (!videoLoadedRef.current) return;
    if (isScrubbing.current) return;
    if (isLoopSeekingRef.current) return;

    const currentSec = progress.currentTime; // ✅ correct field

    if (currentSec >= trimEndRef.current - 0.05) {
      isLoopSeekingRef.current = true;
      // Clamp exactly to trim end
      videoRef.current?.seek(trimStartRef.current);
      setPaused(false);

      setTimeout(() => {
        isLoopSeekingRef.current = false;
      }, 120);
    }
  };

  const getTrimTimes = () => {
    return {
      startTime: trimStartRef.current,
      endTime: trimEndRef.current,
    };
  };
  
  const trimAndContinue = async (type: string) => {
    if (selectedMedia?.type !== 'video') {
      setContentType(type);
      goToStep(2);
      return;
    }
    console.log('Inside trim and continue');
    try {
      const { startTime, endTime } = getTrimTimes();

      const startMs = Math.floor(startTime * 1000);
      const endMs = Math.floor(endTime * 1000);

      // Step 1: Trim the video
      const trimResult = await trim(selectedMedia.uri, {
        startTime: startMs,
        endTime: endMs,
      });

      console.log('Trim result:', trimResult);

      let trimmedUri = trimResult.outputPath;

      if (!trimmedUri || typeof trimmedUri !== 'string') {
        throw new Error('Trim returned invalid outputPath');
      }

      // Remove file:// prefix if present, since native module expects plain paths
      if (trimmedUri.startsWith('file://')) {
        trimmedUri = trimmedUri.replace('file://', '');
      }

      // Step 2: Prepare output path for remuxed video
      // For example, save to the app cache directory with a new filename
      // You might want to use react-native-fs to get cache directory path here
      const outputPath = trimmedUri.replace('.mp4', '_remuxed.mp4');

      // Step 3: Call native remuxVideo module (stream copy)
      const remuxedPath = await VideoRemux.remuxVideo(trimmedUri, outputPath);

      console.log('Remuxed video saved at:', remuxedPath);

      // Add file:// prefix back to URI for React Native usage
      const finalUri = remuxedPath.startsWith('file://') ? remuxedPath : `file://${remuxedPath}`;

      const cleanUri = finalUri.startsWith("file://") ? finalUri.slice(7) : finalUri;
      setSelectedMedia({
        ...selectedMedia,
        uri: cleanUri,
        duration: trimResult.duration,
      });

      setContentType(type);
      goToStep(2);

    } catch (e) {
      console.error('Trim or remux failed', e);
    }
  };

  const [postHeights, setPostHeights] = useState<{ [id: string]: number }>({});
  const handleHeightMeasured = (postId: string, measuredHeight: number) => {
    setPostHeights(prev => {
      if (prev[postId] === measuredHeight) return prev; // no change
      return { ...prev, [postId]: measuredHeight };
    });
  };




  
  return (
    <View style={styles.container}>
      {/* PROFILE HEADER */}
      <View style={styles.profileHeader}>
        {profilePicUrl && <Image source={{ uri: profilePicUrl }} style={styles.profilePic} />}
      </View>
      {/* LINKED ACCOUNT UI */}
      {!isAdmin && activeTab === "linked" && (
        <View style={{ flex: 1 }}>
          {loading && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#000", // optional overlay
                zIndex: 1,
              }}
            >
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          <WebView
            source={{ uri: "https://linktr.ee/sajramkisho" }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
          />
        </View> 
      )}

      {/* POSTS SCROLLVIEW */}
      {(!isAdmin || activeTab === "posts") && (
  <View
    style={{
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.12)",
      marginTop: 8,
    }}
  >
    {left.length === 0 && right.length === 0 && !loading ? (
      <View
        style={{
          minHeight: 260,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: "#fff",
          }}
        >
          No posts yet
        </Text>

        

        {/* STATIC SOCIAL PROOF */}
        <View
          style={{
            flexDirection: "row",
            marginTop: 18,
            gap: 16,
          }}
        >
          <Text style={{ color: "#bbb", fontSize: 13 }}>
            ⭐ Popular creator
          </Text>

          <Text style={{ color: "#bbb", fontSize: 13 }}>
            👀 10 Millions of fans
          </Text>
        </View>

        {/* STATIC CTA TEXT */}
        <Text
          style={{
            marginTop: 22,
            fontSize: 13,
            color: "#457aa5",
          }}
        >
          New content coming soon
        </Text>
      </View>
    ) : (
      <ScrollView
        contentContainerStyle={{ padding: 15 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row" }}>
          {/* LEFT COLUMN */}
          <View style={{ flex: 1 }}>
            {left.map((p, i) => (
              <AnimatedPost
                key={p.id || i}
                id={p.id}
                uri={p.uri}
                height={postHeights[p.id] ?? p.h}
                onHeightMeasured={handleHeightMeasured}
                mediaType={p.mediaType}
                initialViews={p.views}
                initialLikes={p.likes}
                liked={p.liked}
                onViewsChange={(v) => updatePostViews(p.id, v)}
                onLikesChange={() => updatePostLikes(p.id, userId)}
                onLongPress={() => {
                  setIsVideoLoading(p.mediaType === "video");
                  setFullScreenPost(p);
                }}
                onPressOut={closeFullScreen}
                onPress={() => {
                  setIsVideoLoading(p.mediaType === "video");
                  setFullScreenPost(p);
                }}
                showOverlay
                thumbnail={p.thumbnail}
              />
            ))}
            {loading && <SkeletonPost height={generateHeight()} />}
          </View>

          {/* RIGHT COLUMN */}
          <View style={{ flex: 1 }}>
            {right.map((p, i) => (
              <AnimatedPost
                key={p.id || i}
                id={p.id}
                uri={p.uri}
                height={postHeights[p.id] ?? p.h}
                onHeightMeasured={handleHeightMeasured}
                mediaType={p.mediaType}
                initialViews={p.views}
                initialLikes={p.likes}
                liked={p.liked}
                onViewsChange={(v) => updatePostViews(p.id, v)}
                onLikesChange={() => updatePostLikes(p.id, userId)}
                onLongPress={() => {
                  setIsVideoLoading(p.mediaType === "video");
                  setFullScreenPost(p);
                }}
                onPressOut={closeFullScreen}
                onPress={() => {
                  setIsVideoLoading(p.mediaType === "video");
                  setFullScreenPost(p);
                }}
                thumbnail={p.thumbnail}
              />
            ))}
            {loading && <SkeletonPost height={generateHeight()} />}
          </View>
        </View>
      </ScrollView>
    )}
  </View>
)}



      
      
      {/* ADMIN ACCOUNT */}
      {isAdmin && (
        <View style={styles.tabBar}>
          {["posts", "linked", "updates"].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab as any)}
              style={[
                styles.tabItem,
                activeTab === tab && styles.tabItemActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}


      {/* FAB BUTTON */}
      {(!isAdmin || activeTab === "posts") && (userId === celebrityUid) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setSelectedMedia(null);
            setModalVisible(true);
          }}
        >
          <Text style={styles.fabText}>＋</Text>
        </TouchableOpacity>
      )}

      {/* ADD LINKED ACCOUNT FAB (ADMIN ONLY) */}
      {isAdmin && activeTab === "linked" && (
        <TouchableOpacity
          style={styles.linkFab}
          onPress={() => setLinkModalVisible(true)}
        >
          <Text style={{ fontSize: 26, color: "#fff" }}>＋</Text>
        </TouchableOpacity>
      )}



      {/* MODAL FOR PICKING & UPLOAD */}
      <Modal visible={modalVisible} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.sheetOverlay}>
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: "flex-end" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 80}
          >
            <View style={styles.sheetContainer}>
              {/* HEADER */}
              <View style={styles.sheetHeader}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedMedia(null);
                    setContentType(null);
                    setDescription("");
                    setStep(0);
                    fadeAnim.setValue(1);
                    slideAnim.setValue(0);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.headerAction}>{t("cancel")}</Text>
                </TouchableOpacity>

                <Text style={styles.headerTitle}>
                  {step === 0 && t("addNewPost")}
                  {step === 1 && t("selectContentType")}
                  {step === 2 && t("writeDescription")}
                </Text>

                <View style={{ width: 60 }} />
              </View>

              {/* ANIMATED CONTENT */}
              <Animated.View
                style={{
                  flex: 1,
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }}
              >
                {/* STEP 0 — PICKER */}
                {step === 0 && (
                  <View style={styles.pickerContainer}>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={async () => {
                        await openImagePicker(false);
                        goToStep(1);
                      }}
                    >
                      <Text style={styles.pickerText}>{t("pickImage")}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={async () => {
                        await openVideoPicker();
                        goToStep(1);
                      }}
                    >
                      <Text style={styles.pickerText}>{t("pickVideo")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={async () => {
                        await openImagePicker(true);
                        goToStep(1);
                      }}
                    >
                      <Text style={styles.pickerText}>{t("openCamera")}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* STEP 1 — MEDIA + CONTENT TYPE */}
                {step === 1 && selectedMedia && (
                  <>
                    {/* ================= MEDIA PREVIEW ================= */}
                    <View style={styles.mediaWrapperWithMargin}>
                      {selectedMedia?.type === "video" ? (
                        <Video
                          ref={videoRef}
                          source={{ uri: selectedMedia.uri }}
                          style={styles.media}
                          resizeMode="cover"
                          paused={paused}
                          repeat={false}
                          onProgress={onProgress}
                          onLoad={async (data) => {
                            if (data.duration) {
                              console.log("Video onLoad data.duration:", data.duration);
                              const durationInSeconds = data.duration > 1000 ? data.duration / 1000 : data.duration;
                              console.log("[onLoad] video duration in seconds:", durationInSeconds);
                              setDuration(durationInSeconds);
                              durationRef.current = durationInSeconds;
                              trimStartRef.current = 0;
                              trimEndRef.current = Math.min(TRIM_WINDOW_SEC, durationInSeconds);
                              
                              
                              setTrimStart(trimStartRef.current);
                              setTrimEnd(trimEndRef.current);
                              lastOffset.current = 0;
                              panX.setValue(0);

                              videoLoadedRef.current = true;
                              generate30SecSegments(data.duration);
                            }
                          }}
                        />
                      ) : (
                        <Image source={{ uri: selectedMedia?.uri }} style={styles.media} />
                      )}
                    </View>
                    
                    {
                    segments.length > 0 && selectedMedia?.type === "video" && (
                      <View
                        style={{
                          paddingVertical: 12,
                          paddingLeft: 0,
                          marginRight: 12,
                          marginLeft: 12,
                          position: "relative",
                        }}
                        onLayout={(e) => {
                          const width = e.nativeEvent.layout.width;
                          console.log("[onLayout] slider width:", width);
                          setContainerWidth(width);
                          maxTranslateXRef.current = Math.max(1, width - thumbnailWidth);
                          console.log("[onLayout] maxTranslateXRef.current:", maxTranslateXRef.current);
                        }}
                      >
                        {/* THUMBNAILS */}
                        <ScrollView
                          ref={scrollViewRef}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ paddingHorizontal: 16, paddingLeft: 0 }}
                          scrollEnabled={true}
                          onScroll={(e) => {
                            scrollPosition.current = e.nativeEvent.contentOffset.x;
                          }}
                          scrollEventThrottle={16}
                        >
                          {segments.map((segment, index) => (
                            <View key={index}>
                              <Image
                                source={{ uri: segment.uri }}
                                style={{
                                  width: thumbnailWidth,
                                  height: 60,
                                  backgroundColor: "#222",
                                }}
                              />
                            </View>
                          ))}

                          
                        </ScrollView>

                        {/* <Animated.View
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            top: 12,
                            left: 0,
                            height: 60,
                            width: panX,
                            backgroundColor: "rgba(0,0,0,0.55)",
                            zIndex: 100,
                          }}
                        />

                        <Animated.View
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            top: 12,
                            right: 0,
                            height: 60,
                            width: Animated.subtract(
                              containerWidth,
                              Animated.add(panX, thumbnailWidth)
                            ),
                            backgroundColor: "rgba(0,0,0,0.55)",
                            zIndex: 100,
                          }}
                        /> */}
  

                        {/* DRAGGABLE SLIDER */}
                          <Animated.View
                            {...panResponder.panHandlers}
                            style={{
                              position: "absolute",
                              top: 12,
                              left: 0,
                              width: thumbnailWidth,
                              height: 60,
                              borderWidth: 2,
                              borderColor: "#fff",
                              borderRadius: 8,
                              backgroundColor: "rgba(255,255,255,0.15)",
                              zIndex: 150,
                              transform: [{ translateX: panX }],
                            }}
                          />
                      </View>
                    )}


                    {/* ================= CONTENT TYPE ================= */}
                    <View style={{ padding: 16 }}>
                      <Text style={styles.sectionLabel}>{t("contentType")}</Text>

                      <View style={styles.typeRow}>
                        {contentTypes.map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[
                              styles.typePill,
                              contentType === type && styles.typePillActive,
                            ]}
                            onPress={() => {
                              trimAndContinue(type);
                            }}
                          >
                            <Text
                              style={[
                                styles.typeText,
                                contentType === type && styles.typeTextActive,
                              ]}
                            >
                              {type}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </>
                )}


                {/* STEP 2 — DESCRIPTION + POST */}
                {step === 2 && (
                  <>
                    <ScrollView
                      style={{ flex: 1 }}
                      contentContainerStyle={{ padding: 16 }}
                      keyboardShouldPersistTaps="handled"
                    >
                      <Text style={styles.sectionLabel}>{t("description")}</Text>

                      <TextInput
                        placeholder="Write something about this post…"
                        placeholderTextColor="#888"
                        style={styles.descriptionInput}
                        multiline
                        value={description}
                        onChangeText={setDescription}
                        maxLength={250}
                        textAlignVertical="top"
                        autoFocus
                      />
                    </ScrollView>

                    <View style={styles.footer}>
                      <TouchableOpacity
                        style={[
                          styles.uploadButton,
                          (!description.trim() || uploading) && { opacity: 0.5 },
                        ]}
                        disabled={!description.trim() || uploading}
                        onPress={uploadPost}
                      >
                        <Text style={styles.uploadText}>
                          {uploading ? t("uploading") : uploaded ? t("uploaded") : t("post")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      {/* LINK ACCOUNT MODAL */}
      <Modal
        visible={linkModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.linkSheet}>
            <Text style={styles.linkTitle}>Link Account</Text>

            <TextInput
              placeholder="Enter celebrity ID"
              placeholderTextColor="#888"
              value={linkId}
              onChangeText={setLinkId}
              style={styles.linkInput}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.linkButton}
              onPress={linkAccount}
            >
              <Text style={styles.linkButtonText}>Link</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setLinkModalVisible(false)}>
              <Text style={{ color: "#888", marginTop: 12 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      {/* FULL SCREEN MODAL */}
      <Modal
        visible={!!fullScreenPost}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={closeFullScreen}
      >
        <View style={styles.fullScreenModal}>

          {/* BACKDROP */}
          <Pressable
            style={styles.backdrop}
            onPress={closeFullScreen}
          />

          {fullScreenPost && (
            <View style={styles.mediaContainer}>

              {/* 🔹 THUMBNAIL (BACKGROUND) */}
              {fullScreenPost.mediaType === "video" &&
                fullScreenPost.thumbnail &&
                isVideoLoading && (
                  <Image
                    source={{ uri: fullScreenPost.thumbnail }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    blurRadius={2}
                  />
                )}

              {/* 🔹 VIDEO */}
              {fullScreenPost.mediaType === "video" ? (
                <Video
                  source={{ uri: fullScreenPost.uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  repeat
                  paused={false}
                  androidViewType="textureView"
                  onLoadStart={() => setIsVideoLoading(true)}
                  onReadyForDisplay={() => setIsVideoLoading(false)}
                  onError={() => setIsVideoLoading(false)}
                />
              ) : (
                <Image
                  source={{ uri: fullScreenPost.uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                />
              )}

              {/* 🔹 LOADER (CENTERED ABOVE ALL) */}
              {isVideoLoading && fullScreenPost.mediaType === "video" && (
                <View style={styles.videoLoader}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}

              {/* TOUCH INTERCEPTOR */}
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={closeFullScreen}
              />
            </View>
          )}

          {/* DESCRIPTION */}
          {fullScreenPost?.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionText}>
                {fullScreenPost.description}
              </Text>
            </View>
          )}

        </View>
      </Modal>

    </View>
  );
}


/* -------------------- STYLES -------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  profileHeader: {
    height: height * 0.28,
    justifyContent: "flex-end",
    alignItems: "center", 
    
  },

  profilePic: {
    width: CARD_WIDTH - 40,
    height: CARD_WIDTH - 40,
    borderRadius: (CARD_WIDTH - 40) / 2,
    borderWidth: 2,
    borderColor: "#444",
    marginBottom: -(height * 0.05),
     zIndex: 1,
  },

  skeleton: {
    width: postWidth,
    borderRadius: 10,
    backgroundColor: "#222",
    marginBottom: POST_GAP,
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: "#1e90ff",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },

  fabText: {
    fontSize: 36,
    color: "white",
    marginBottom: 4,
  },

  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  modalCard: {
    width: "100%",
    backgroundColor: "#222",
    borderRadius: 10,
    padding: 15,
  },

  modalTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    alignSelf: "center",
  },

  actionButton: {
    backgroundColor: "#1e90ff",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 15,
    alignItems: "center",
  },

  actionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  previewContainer: {
    width: "100%",
    alignItems: "center",
  },

  previewImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    marginBottom: 15,
  },

  previewVideo: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    marginBottom: 15,
    backgroundColor: "#000",
  },

  descriptionInputPremium: {
    backgroundColor: "#333",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: "white",
    fontSize: 16,
    marginBottom: 15,
  },

  actionButtonPremium: {
    backgroundColor: "#1e90ff",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 15,
    alignItems: "center",
  },

  actionButtonTextPremium: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },

  bottomButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  secondaryButton: {
    backgroundColor: "#444",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },

  secondaryButtonText: {
    color: "#ddd",
    fontWeight: "600",
  },

  fullScreenModal: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.7)",
  },  
  mediaContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    position: "relative",
  },
  fullScreenMedia: {
    width: "100%",
    height: "100%",
  },

  descriptionContainer: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
  },

  descriptionText: {
    color: "#eee",
    fontSize: 16,
    textAlign: "center",
  },

  // MOD: content type selector buttons

  contentTypeOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#555",
    marginRight: 10,
    marginBottom: 10,
  },

  contentTypeSelected: {
    backgroundColor: "#1e90ff",
    borderColor: "#1e90ff",
  },

  sheetOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.6)",
  justifyContent: "flex-end",
},

sheetContainer: {
  height: "92%",
  backgroundColor: "#0d0d0d",
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  overflow: "hidden",
},

sheetHeader: {
  height: 56,
  paddingHorizontal: 16,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottomWidth: 0.5,
  borderColor: "#222",
},

headerTitle: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "700",
},

headerAction: {
  color: "#aaa",
  fontSize: 15,
},

mediaWrapperWithMargin: {
  marginHorizontal: 16,        // left & right spacing
  borderRadius: 16,
  overflow: "hidden",
  aspectRatio: 1,              // keeps square preview
  backgroundColor: "#111",
  // subtle elevation
  shadowColor: "#000",
  shadowOpacity: 0.25,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
},

media: {
  width: "100%",
  height: "100%",
},

contentArea: {
  flex: 1,
  padding: 16,
},

sectionLabel: {
  color: "#aaa",
  fontSize: 13,
  marginBottom: 8,
  fontWeight: "600",
  marginTop: 8,
  textAlign: 'center'
},

typeRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "center",   // 👈 CENTER ALIGN
  alignItems: "center",
  gap: 10,                    // nice spacing between pills (RN ≥ 0.71)
  marginTop: 12,
},


typePill: {
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 20,
  backgroundColor: "#1c1c1c",
  marginRight: 8,
  marginBottom: 8,
},

typePillActive: {
  backgroundColor: "#fff",
},

typeText: {
  color: "#aaa",
  fontSize: 13,
},

typeTextActive: {
  color: "#000",
  fontWeight: "700",
},

descriptionInput: {
  minHeight: 120,
  backgroundColor: "#1a1a1a",
  borderRadius: 16,
  padding: 14,
  color: "#fff",
  fontSize: 14,
  textAlignVertical: "top",
},

footer: {
  padding: 16,
  borderTopWidth: 0.5,
  borderColor: "#222",
},

uploadButton: {
  backgroundColor: "#fff",
  paddingVertical: 14,
  borderRadius: 16,
  alignItems: "center",
},

uploadText: {
  color: "#000",
  fontSize: 15,
  fontWeight: "700",
},
pickerContainer: {
  flex: 1,
  justifyContent: "center",
  paddingHorizontal: 20,
},

pickerButton: {
  backgroundColor: "#1c1c1c",
  paddingVertical: 18,
  borderRadius: 18,
  marginBottom: 16,
  alignItems: "center",
},

pickerText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "600",
},
trimHandle: {
  width: 14,
  backgroundColor: "#25D366",
  borderRadius: 4,
},

// TAB BAR (Admin only)

  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderBottomWidth: 1,
    borderColor: "#222",
    backgroundColor: "#000",
  },

  tabItem: {
    paddingVertical: 12,
    flex: 1,
    alignItems: "center",
  },

  tabItemActive: {
    borderBottomWidth: 2,
    borderColor: "#fff",
  },

  tabText: {
    color: "#777",
    fontSize: 13,
    letterSpacing: 1,
  },

  tabTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  // LINKED ACCOUNTS LIST
  linkedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#111",
    borderRadius: 12,
    marginBottom: 12,
  },

  linkedAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
    backgroundColor: "#222",
  },

  linkedName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  linkedId: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 2,
  },

  linkedRole: {
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 2,
    color: '#457aa5'
  },

  // LINK ACCOUNT FAB (Admin → Linked tab)
  linkFab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#457aa5",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  // LINK ACCOUNT MODAL (Bottom Sheet Style)
  linkSheet: {
    backgroundColor: "#111",
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },

  linkTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },

  linkInput: {
    backgroundColor: "#222",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    fontSize: 14,
    marginBottom: 14,
  },

  linkButton: {
    backgroundColor: "#457aa5",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  linkButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  // EMPTY STATE (Optional but Recommended)
  emptyStateText: {
    color: "#666",
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },

  bookTitle: {
    color: "#ccc",
    fontSize: 13,
    marginLeft: 8,
    marginBottom: 2,
  },

  socialLink: {
    color: "#457aa5", // twitter blue for example
    fontSize: 14,
    marginRight: 12,
  },
  videoLoader: {
    ...StyleSheet.absoluteFill,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },


});
