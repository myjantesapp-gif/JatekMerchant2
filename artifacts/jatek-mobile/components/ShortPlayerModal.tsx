import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Pressable,
  Animated,
  Easing,
  Platform,
  Share,
  Linking,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Short } from "@/lib/api";
import { trackShortView } from "@/lib/api";
import { getYouTubeThumbnailUrl, getYouTubeVideoId, resolveMediaUrl } from "@/lib/mediaUrl";
import { MediaImage } from "@/components/MediaImage";

const PINK = "#FF4593";
const TURQUOISE = "#00BFA6";

function resolveVideoUrl(url: string): string {
  return resolveMediaUrl(url) ?? "";
}

function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  return videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&enablejsapi=1&loop=1&playlist=${videoId}&rel=0&origin=https%3A%2F%2Fwww.youtube-nocookie.com&widget_referrer=https%3A%2F%2Fwww.youtube-nocookie.com%2F`
    : null;
}

function getVideoHtml(url: string): string {
  const youtubeUrl = getYouTubeEmbedUrl(url);
  if (youtubeUrl) {
    const safeUrl = JSON.stringify(youtubeUrl).replace(/</g, "\\u003c");
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta name="referrer" content="strict-origin-when-cross-origin"><base href="https://www.youtube-nocookie.com/"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#000}</style></head><body><iframe id="short-youtube" src=${safeUrl} referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe><script>(function(){var origin="https://www.youtube-nocookie.com";function send(func,args){var f=document.getElementById("short-youtube");if(f&&f.contentWindow){f.contentWindow.postMessage(JSON.stringify({event:"command",func:func,args:args||[]}),origin)}}window.setShortSound=function(enabled){if(enabled){send("unMute",[]);send("setVolume",[100]);send("playVideo",[])}else{send("mute",[])}}})();</script></body></html>`;
  }
  const safeUrl = JSON.stringify(resolveVideoUrl(url)).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body,video{margin:0;width:100%;height:100%;background:#000;object-fit:cover}video{position:fixed;inset:0}</style></head><body><video id="short-video" autoplay muted loop playsinline controls></video><script>(function(){var v=document.getElementById("short-video");v.onerror=function(){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage("short-video-error")};v.src=${safeUrl};v.load();})();</script></body></html>`;
}

function buildSoundScript(soundEnabled: boolean): string {
  const muted = soundEnabled ? "false" : "true";
  return `(function(){var v=document.getElementById('short-video');if(v){v.muted=${muted};if(!v.muted){var p=v.play();if(p&&p.catch){p.catch(function(){})}}}if(window.setShortSound){window.setShortSound(${soundEnabled})}else{var f=document.querySelector('iframe');if(f&&f.contentWindow){var o='https://www.youtube-nocookie.com';var send=function(func,args){f.contentWindow.postMessage(JSON.stringify({event:'command',func:func,args:args||[]}),o)};${soundEnabled ? "send('unMute',[]);send('setVolume',[100]);send('playVideo',[])" : "send('mute',[])"}}}})();true;`;
}

interface Props {
  visible: boolean;
  shorts: Short[];
  initialIndex: number;
  onClose: () => void;
  onViewCountChanged?: () => void;
}

export function ShortPlayerModal({ visible, shorts, initialIndex, onClose, onViewCountChanged }: Props) {
  const listRef = useRef<FlatList<Short>>(null);
  const viewSessionRef = useRef("");
  const viewedShortIdsRef = useRef(new Set<number>());
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeInitialIndex = shorts.length ? Math.max(0, Math.min(initialIndex, shorts.length - 1)) : 0;
  const [index, setIndex] = useState(safeInitialIndex);

  useEffect(() => {
    if (visible) setIndex(safeInitialIndex);
  }, [visible, safeInitialIndex]);

  useEffect(() => {
    if (visible) {
      viewSessionRef.current ||= `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      return;
    }
    viewSessionRef.current = "";
    viewedShortIdsRef.current.clear();
  }, [visible]);

  useEffect(() => {
    const short = shorts[index];
    if (
      !visible ||
      !short ||
      !resolveMediaUrl(short.videoUrl) ||
      viewedShortIdsRef.current.has(short.id)
    ) return;

    viewedShortIdsRef.current.add(short.id);
    void trackShortView(short.id, viewSessionRef.current)
      .then(() => onViewCountChanged?.())
      .catch(() => {
        // Permit an explicit replay retry after a transient API failure.
        viewedShortIdsRef.current.delete(short.id);
      });
  }, [index, onViewCountChanged, shorts, visible]);

  useEffect(() => {
    if (visible && shorts.length && listRef.current) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: safeInitialIndex, animated: false });
      });
    }
  }, [visible, safeInitialIndex, shorts.length, screenHeight]);

  const onScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.max(0, Math.min(Math.round(y / screenHeight), Math.max(shorts.length - 1, 0)));
    if (i !== index) setIndex(i);
  };

  const goToRestaurant = (id: number | null | undefined) => {
    onClose();
    if (id == null) return;
    setTimeout(() => router.push({ pathname: "/restaurant/[id]", params: { id: String(id) } }), 200);
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        {shorts.length > 0 ? (
          <FlatList
            ref={listRef}
            data={shorts}
            extraData={index}
            keyExtractor={(r) => String(r.id)}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={screenHeight}
            decelerationRate="normal"
            onScroll={onScroll}
            scrollEventThrottle={16}
            getItemLayout={(_, i) => ({ length: screenHeight, offset: screenHeight * i, index: i })}
            initialScrollIndex={safeInitialIndex}
            onScrollToIndexFailed={() => {
              listRef.current?.scrollToOffset({ offset: safeInitialIndex * screenHeight, animated: false });
            }}
            renderItem={({ item, index: i }) => (
              <ShortFrame
                short={item}
                active={visible && i === index}
                onOpen={() => goToRestaurant(item.restaurantId)}
                hasRestaurant={item.restaurantId != null}
                width={screenWidth}
                height={screenHeight}
                topInset={insets.top}
                bottomInset={insets.bottom}
              />
            )}
          />
        ) : (
          <View style={[styles.empty, { paddingTop: insets.top + 64 }]}>
            <Ionicons name="videocam-off-outline" size={48} color="rgba(255,255,255,0.7)" />
            <Text style={styles.emptyTitle}>Aucune vidéo disponible</Text>
            <Text style={styles.emptyText}>Revenez plus tard pour découvrir de nouveaux contenus.</Text>
          </View>
        )}

        {/* Top bar */}
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Shorts gourmands</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hint */}
        {index === 0 && (
          <View style={[styles.hint, { bottom: screenHeight * 0.4, pointerEvents: "none" }]}>
            <Ionicons name="chevron-up" size={18} color="rgba(255,255,255,0.85)" />
            <Text style={styles.hintText}>Glisse vers le haut</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

function ShortFrame({
  short,
  active,
  onOpen,
  hasRestaurant,
  width,
  height,
  topInset: _topInset,
  bottomInset,
}: {
  short: Short;
  active: boolean;
  onOpen: () => void;
  hasRestaurant: boolean;
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
}) {
  const heart = useRef(new Animated.Value(1)).current;
  const heartBurst = useRef(new Animated.Value(0)).current;
  const [liked, setLiked] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const playPulse = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!active) setSoundEnabled(false);
  }, [active]);

  useEffect(() => {
    if (active) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(playPulse, { toValue: 1.12, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(playPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loopRef.current = loop;
      loop.start();
      return () => {
        loop.stop();
        loopRef.current = null;
        playPulse.setValue(1);
      };
    } else {
      loopRef.current?.stop();
      loopRef.current = null;
      playPulse.setValue(1);
    }
  }, [active, playPulse]);

  const onLike = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked((v) => !v);
    Animated.sequence([
      Animated.spring(heart, { toValue: 1.4, useNativeDriver: true, friction: 3 }),
      Animated.spring(heart, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    heartBurst.setValue(0);
    Animated.timing(heartBurst, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  };

  const onShare = async () => {
    try {
      await Share.share({
        message: `Découvre ${short.title} sur Jatek`,
      });
    } catch {
      onOpen();
    }
  };

  const burstOpacity = heartBurst.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] });
  const burstScale = heartBurst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] });
  const playableVideoUrl = resolveMediaUrl(short.videoUrl);

  return (
    <View style={[styles.frame, { width, height }]}>
      {playableVideoUrl && active ? (
        <ShortVideo url={playableVideoUrl} poster={short.imageUrl} soundEnabled={soundEnabled} />
      ) : (
        <ShortPoster short={short} />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.35)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* The pulse is an affordance for image-only Shorts; videos autoplay. */}
      {!playableVideoUrl && (
        <Animated.View style={[styles.playWrap, { transform: [{ scale: playPulse }] }]}>
          <View style={styles.playDot}>
            <Ionicons name="play" size={36} color="#fff" />
          </View>
        </Animated.View>
      )}

      {/* Like burst */}
      <Animated.View
        style={[styles.burst, { opacity: burstOpacity, transform: [{ scale: burstScale }], pointerEvents: "none" }]}
      >
        <Ionicons name="heart" size={120} color={PINK} />
      </Animated.View>

      {/* Right side actions */}
      <View style={[styles.sideActions, { bottom: bottomInset + 150 }]}>
        <Pressable onPress={onLike} style={styles.sideBtn}>
          <Animated.View style={{ transform: [{ scale: heart }] }}>
            <Ionicons name={liked ? "heart" : "heart-outline"} size={32} color={liked ? PINK : "#fff"} />
          </Animated.View>
          <Text style={styles.sideBtnText}>{Math.floor(((short.id * 37) % 280) + (liked ? 121 : 120))}</Text>
        </Pressable>
        <Pressable onPress={onOpen} style={styles.sideBtn}>
          <Ionicons name="chatbubble-ellipses-outline" size={30} color="#fff" />
          <Text style={styles.sideBtnText}>{Math.floor(((short.id * 13) % 90) + 12)}</Text>
        </Pressable>
        {playableVideoUrl && (
          <Pressable
            onPress={() => setSoundEnabled((enabled) => !enabled)}
            style={styles.sideBtn}
            accessibilityRole="button"
            accessibilityLabel={soundEnabled ? "Couper le son" : "Activer le son"}
          >
            <Ionicons name={soundEnabled ? "volume-high" : "volume-mute"} size={30} color="#fff" />
            <Text style={styles.sideBtnText}>{soundEnabled ? "Son" : "Muet"}</Text>
          </Pressable>
        )}
        <Pressable onPress={onShare} style={styles.sideBtn}>
          <Ionicons name="share-social-outline" size={30} color="#fff" />
          <Text style={styles.sideBtnText}>Partage</Text>
        </Pressable>
      </View>

      {hasRestaurant && (
        <Pressable
          onPress={onOpen}
          style={[styles.openCta, { bottom: bottomInset + 24 }]}
          accessibilityRole="button"
          accessibilityLabel="Voir le menu du restaurant"
        >
          <Ionicons name="restaurant" size={16} color="#fff" />
          <Text style={styles.openCtaText}>Voir le menu</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

function ShortVideo({
  url,
  poster,
  soundEnabled,
}: {
  url: string;
  poster?: string | null;
  soundEnabled: boolean;
}) {
  const nativeWebViewRef = useRef<WebView>(null);
  const webVideoRef = useRef<any>(null);
  const webFrameRef = useRef<any>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const youtubeUrl = getYouTubeEmbedUrl(url);
  const posterUrl = resolveMediaUrl(poster) ?? getYouTubeThumbnailUrl(url);

  useEffect(() => {
    setVideoFailed(false);
  }, [url]);

  useEffect(() => {
    if (Platform.OS === "web") {
      const target = youtubeUrl ? webFrameRef.current : webVideoRef.current;
      if (youtubeUrl) {
        const sendSoundCommands = () => {
          if (!target?.contentWindow) return;
          const origin = "https://www.youtube-nocookie.com";
          const send = (func: string, args: unknown[] = []) =>
            target.contentWindow.postMessage(JSON.stringify({ event: "command", func, args }), origin);
          if (soundEnabled) {
            send("unMute");
            send("setVolume", [100]);
            send("playVideo");
          } else {
            send("mute");
          }
        };
        sendSoundCommands();
        const retry = setTimeout(sendSoundCommands, 300);
        return () => clearTimeout(retry);
      } else if (target) {
        target.muted = !soundEnabled;
        if (soundEnabled) void target.play?.().catch?.(() => {});
      }
      return;
    }
    nativeWebViewRef.current?.injectJavaScript(buildSoundScript(soundEnabled));
  }, [soundEnabled, youtubeUrl]);

  useEffect(() => {
    return () => {
      if (Platform.OS === "web") {
        if (youtubeUrl) {
          webFrameRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func: "stopVideo", args: [] }),
            "*",
          );
        } else if (webVideoRef.current) {
          webVideoRef.current.pause?.();
          webVideoRef.current.removeAttribute?.("src");
          webVideoRef.current.load?.();
        }
      } else {
        nativeWebViewRef.current?.injectJavaScript(
          "(function(){var v=document.getElementById('short-video');if(v){v.pause();v.removeAttribute('src');v.load();}})();true;",
        );
      }
    };
  }, [url, youtubeUrl]);

  // React Native Web does not support react-native-webview. Use native HTML
  // media elements there so Shorts still autoplay instead of showing a poster
  // placeholder in the web/mobile preview.
  if (Platform.OS === "web") {
    if (videoFailed) {
      return posterUrl ? (
        <View style={styles.bg}>
          <MediaImage
            urls={[posterUrl]}
            style={StyleSheet.absoluteFill}
            fallback={<View style={[StyleSheet.absoluteFill, { backgroundColor: "#111" }]} />}
          />
          <View style={styles.videoFallback}><Ionicons name="alert-circle-outline" size={24} color="#fff" /><Text style={styles.videoFallbackText}>Vidéo indisponible</Text></View>
        </View>
      ) : (
        <View style={[styles.bg, { backgroundColor: "#111" }]}>
          <View style={styles.videoFallback}><Ionicons name="alert-circle-outline" size={24} color="#fff" /><Text style={styles.videoFallbackText}>Vidéo indisponible</Text></View>
        </View>
      );
    }

    if (youtubeUrl) {
      return React.createElement("iframe", {
        ref: webFrameRef,
        src: youtubeUrl,
        title: "Short vidéo",
        allow: "autoplay; encrypted-media; picture-in-picture",
        referrerPolicy: "strict-origin-when-cross-origin",
        allowFullScreen: true,
        style: styles.webMedia,
        onError: () => setVideoFailed(true),
      });
    }

    return React.createElement("video", {
      ref: webVideoRef,
      src: resolveVideoUrl(url),
      poster: poster ? resolveMediaUrl(poster) : getYouTubeThumbnailUrl(url),
      autoPlay: true,
      muted: !soundEnabled,
      loop: true,
      playsInline: true,
      preload: "auto",
      "aria-label": "Short vidéo",
      style: styles.webMedia,
      onError: () => setVideoFailed(true),
    });
  }

  if (videoFailed) {
    return posterUrl ? (
      <View style={styles.bg}>
        <MediaImage
          urls={[posterUrl]}
          style={StyleSheet.absoluteFill}
          fallback={<View style={[StyleSheet.absoluteFill, { backgroundColor: "#111" }]} />}
        />
        <View style={styles.videoFallback}><Ionicons name="alert-circle-outline" size={24} color="#fff" /><Text style={styles.videoFallbackText}>Vidéo indisponible</Text></View>
      </View>
    ) : (
      <View style={[styles.bg, { backgroundColor: "#111" }]}>
        <View style={styles.videoFallback}><Ionicons name="alert-circle-outline" size={24} color="#fff" /><Text style={styles.videoFallbackText}>Vidéo indisponible</Text></View>
      </View>
    );
  }

  return (
    <WebView
      ref={nativeWebViewRef}
      source={{
        html: getVideoHtml(url),
        ...(youtubeUrl ? { baseUrl: "https://www.youtube-nocookie.com/" } : {}),
      }}
      style={styles.bg}
      originWhitelist={["*"]}
      scrollEnabled={false}
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      thirdPartyCookiesEnabled
      sharedCookiesEnabled
      javaScriptEnabled
      onLoadEnd={() => nativeWebViewRef.current?.injectJavaScript(buildSoundScript(soundEnabled))}
      onMessage={(event) => {
        if (event.nativeEvent.data === "short-video-error") setVideoFailed(true);
      }}
      onError={() => setVideoFailed(true)}
      onHttpError={(event) => {
        if (event.nativeEvent.statusCode >= 400) setVideoFailed(true);
      }}
    />
  );
}

function ShortPoster({ short }: { short: Short }) {
  return (
    <MediaImage
      urls={[short.imageUrl, getYouTubeThumbnailUrl(short.videoUrl)]}
      style={styles.bg}
      fallback={
        <View style={[styles.bg, styles.posterFallback]}>
          <Ionicons name="videocam-outline" size={42} color="rgba(255,255,255,0.72)" />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: "100%", height: "100%", backgroundColor: "#000" },
  frame: { position: "relative", width: "100%", height: "100%" },
  bg: { width: "100%", height: "100%" },
  posterFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#111" },
  webMedia: {
    width: "100%",
    height: "100%",
    display: "block",
    border: 0,
    backgroundColor: "#000",
    objectFit: "cover",
  } as any,
  videoFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  videoFallbackText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  empty: { flex: 1, alignItems: "center", paddingHorizontal: 36, gap: 10 },
  emptyTitle: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center", marginTop: 8 },
  emptyText: { color: "rgba(255,255,255,0.72)", fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 20 },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  hint: {
    position: "absolute",
    alignSelf: "center",
    alignItems: "center",
    gap: 4,
  },
  hintText: { color: "rgba(255,255,255,0.85)", fontFamily: "Inter_600SemiBold", fontSize: 12 },

  playWrap: { position: "absolute", top: "42%", alignSelf: "center" },
  playDot: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "rgba(255,69,147,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
  burst: { position: "absolute", top: "35%", alignSelf: "center" },

  sideActions: {
    position: "absolute",
    right: 12,
    bottom: 160,
    alignItems: "center",
    gap: 22,
  },
  sideBtn: { alignItems: "center", gap: 4 },
  sideBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 },

  bottomInfo: { position: "absolute", left: 16, right: 90, bottom: 50, gap: 10 },
  handleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  handleAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TURQUOISE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  handleAvatarText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  handleText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  followPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: PINK,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  followText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 11 },
  caption: { color: "#fff", fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  openCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PINK,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#fff",
  },
  openCtaText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: 0.3 },
});
