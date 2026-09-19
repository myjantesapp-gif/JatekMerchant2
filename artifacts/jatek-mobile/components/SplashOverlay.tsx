import { StatusBar } from "expo-status-bar";
import { router, useRootNavigationState } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Image, Platform, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import colors from "@/constants/colors";
import { getApiBaseSafe } from "@/lib/apiBase";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { loadStartupVideoUrl } from "@/lib/startupVideo";

const INTRO_BACKGROUND = colors.light.introBackground;
const INTRO_VIDEO = require("../assets/videos/jatek-intro.mp4");
const INTRO_LOGO = require("../assets/images/jatek-intro-splash.png");
const REDUCE_MOTION_LOGO_DURATION = 350;
const FADE_DURATION = 250;

/**
 * The intro is mounted once by the root layout. It deliberately has no
 * AppState listener: returning from background must never restart it.
 */
export default function SplashOverlay() {
  const [source, setSource] = useState<string | number | null>(null);
  useEffect(() => {
    let active = true;
    void loadStartupVideoUrl(getApiBaseSafe()).then((url) => {
      if (active) setSource(resolveMediaUrl(url) || INTRO_VIDEO);
    });
    return () => { active = false; };
  }, []);
  if (source === null) {
    return <View style={styles.root}><View style={styles.logoFrame}>
      <Image source={INTRO_LOGO} style={styles.logo} resizeMode="contain" />
    </View></View>;
  }
  if (Platform.OS === "web") {
    return <WebIntroPlayback source={source} />;
  }
  return <IntroErrorBoundary><IntroPlayback source={source} /></IntroErrorBoundary>;
}

function WebIntroPlayback({ source }: { source: string | number }) {
  const rootNavigationState = useRootNavigationState();
  const [mounted, setMounted] = useState(true);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [playbackFinished, setPlaybackFinished] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const transitionStarted = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const opacity = useSharedValue(1);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const navigationReady = Boolean(rootNavigationState?.key);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (active) setReduceMotion(value); })
      .catch(() => { if (active) setReduceMotion(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion !== false) return;
    const video = videoRef.current;
    if (!video) return;
    const start = () => {
      void video.play().catch(() => {
        // Browsers can reject autoplay even for a muted video. The logo
        // fallback remains available and the app must still continue.
        setPlaybackError(true);
        setPlaybackFinished(true);
      });
    };
    if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) start();
    else video.addEventListener("canplay", start, { once: true });
    return () => video.removeEventListener("canplay", start);
  }, [reduceMotion, source]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(false), 12000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (reduceMotion !== true) return;
    const timer = setTimeout(() => setPlaybackFinished(true), REDUCE_MOTION_LOGO_DURATION);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    if (!playbackFinished || !navigationReady || transitionStarted.current) return;
    transitionStarted.current = true;
    if (reduceMotion) {
      setMounted(false);
      return;
    }
    opacity.value = withTiming(
      0,
      { duration: FADE_DURATION, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [navigationReady, opacity, playbackFinished, reduceMotion]);

  if (!mounted) return null;

  const showStaticLogo = reduceMotion !== false || playbackError;
  return (
    <Animated.View
      style={[styles.root, overlayStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.background}>
        {showStaticLogo ? (
          <View style={styles.logoFrame}>
            <Image source={INTRO_LOGO} style={styles.logo} resizeMode="contain" />
          </View>
        ) : (
          React.createElement("video", {
            ref: videoRef,
            src: source,
            autoPlay: true,
            muted: true,
            playsInline: true,
            preload: "auto",
            onEnded: () => setPlaybackFinished(true),
            onError: () => {
              setPlaybackError(true);
              setPlaybackFinished(true);
            },
            "aria-hidden": true,
            style: styles.webVideo,
          })
        )}
      </View>
    </Animated.View>
  );
}

/** A native video initialization failure must not take down the application. */
class IntroErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { console.warn("[SplashOverlay] intro unavailable; continuing to app"); }
  render() { return this.state.failed ? null : this.props.children; }
}

function IntroPlayback({ source }: { source: string | number }) {
  const rootNavigationState = useRootNavigationState();
  const [mounted, setMounted] = useState(true);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [playbackFinished, setPlaybackFinished] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const transitionStarted = useRef(false);
  const playbackStarted = useRef(false);
  const opacity = useSharedValue(1);

  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
    videoPlayer.audioMixingMode = "auto";
    videoPlayer.staysActiveInBackground = false;
    videoPlayer.keepScreenOnWhilePlaying = true;
  });

  const navigationReady = Boolean(rootNavigationState?.key);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (active) setReduceMotion(value); })
      .catch(() => { if (active) setReduceMotion(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Hard deadline, independent of navigation readiness: never obscure
      // the application's own recovery UI if navigation itself has failed.
      try { player.pause(); } catch { /* Failed native players may reject pause. */ }
      setMounted(false);
    }, 12000);
    return () => clearTimeout(timer);
  }, [player]);

  useEffect(() => {
    const endSubscription = player.addListener("playToEnd", () => {
      setPlaybackFinished(true);
    });
    const statusSubscription = player.addListener("statusChange", ({ status }) => {
      if (status === "error") {
        setPlaybackError(true);
        setPlaybackFinished(true);
      }
    });
    if (player.status === "error") {
      setPlaybackError(true);
      setPlaybackFinished(true);
    }

    return () => {
      endSubscription.remove();
      statusSubscription.remove();
    };
  }, [player]);

  useEffect(() => {
    if (reduceMotion !== false || playbackStarted.current || playbackError) return;
    playbackStarted.current = true;
    try { player.play(); }
    catch {
      setPlaybackError(true);
      setPlaybackFinished(true);
    }
  }, [playbackError, player, reduceMotion]);

  useEffect(() => {
    if (reduceMotion !== true) return;
    const timer = setTimeout(() => setPlaybackFinished(true), REDUCE_MOTION_LOGO_DURATION);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    // Preload the tab tree while the local intro asset is playing. The actual
    // route/data state remains controlled by the existing auth redirect.
    void router.prefetch("/(tabs)");
  }, []);

  useEffect(() => {
    if (!playbackFinished || !navigationReady || transitionStarted.current) return;
    transitionStarted.current = true;
    try { player.pause(); } catch { /* Player may already have failed. */ }

    if (reduceMotion) {
      setMounted(false);
      return;
    }

    opacity.value = withTiming(
      0,
      { duration: FADE_DURATION, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [navigationReady, opacity, playbackFinished, reduceMotion, player]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const showStaticLogo = reduceMotion !== false || playbackError;

  if (!mounted) return null;

  return (
    <Animated.View
      style={[styles.root, overlayStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <StatusBar style="light" backgroundColor={INTRO_BACKGROUND} translucent={false} />
      <View style={styles.background}>
        {showStaticLogo ? (
          <View style={styles.logoFrame}>
            <Image source={INTRO_LOGO} style={styles.logo} resizeMode="contain" />
          </View>
        ) : (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            // The intro asset is a portrait 1080x1920 video. Cover keeps it
            // edge-to-edge on modern phones instead of leaving letterboxing.
            // The pink background remains visible behind the video on devices
            // with a different aspect ratio.
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
            fullscreenOptions={{ enable: false }}
            requiresLinearPlayback
            useExoShutter={false}
            // TextureView keeps the native video surface compatible with the
            // 250 ms alpha transition while remaining hardware accelerated.
            surfaceType={Platform.OS === "android" ? "textureView" : undefined}
          />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: INTRO_BACKGROUND,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: INTRO_BACKGROUND,
  },
  logoFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 44,
  },
  logo: {
    width: "100%",
    maxWidth: 280,
    height: 110,
  },
  webVideo: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
    backgroundColor: INTRO_BACKGROUND,
  } as any,
});