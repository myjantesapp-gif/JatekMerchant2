import { StatusBar } from "expo-status-bar";
import { useRootNavigationState } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Image, Platform, StyleSheet, View, type ImageSourcePropType } from "react-native";
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
import { loadStartupMedia } from "@/lib/startupVideo";

const INTRO_BACKGROUND = colors.light.introBackground;
const INTRO_VIDEO = require("../assets/videos/jatek-intro.mp4");
// Transparent local fallback prevents a visible rectangular image background
// when the remote splash logo is unavailable during the first launch.
const INTRO_LOGO = require("../assets/images/jatek-intro-logo-transparent.png");
const NATIVE_INTRO_DURATION = 2500;
const REDUCE_MOTION_LOGO_DURATION = 350;
const VIDEO_START_DELAY = 260;
const FADE_DURATION = 250;

/**
 * The intro is mounted once by the root layout. It deliberately has no
 * AppState listener: returning from background must never restart it.
 */
export default function SplashOverlay() {
  // Start from bundled media immediately. The API-configured App Storage
  // image can replace the local fallback if it resolves during this launch.
  const [source, setSource] = useState<string | number>(INTRO_VIDEO);
  const [logoSource, setLogoSource] = useState<ImageSourcePropType>(INTRO_LOGO);
  useEffect(() => {
    let active = true;
    void loadStartupMedia(getApiBaseSafe()).then(({ videoUrl, logoUrl }) => {
      const remoteVideoUrl = resolveMediaUrl(videoUrl);
      const remoteLogoUrl = resolveMediaUrl(logoUrl);
      if (!active) return;
      if (remoteVideoUrl) setSource(remoteVideoUrl);
      if (remoteLogoUrl) setLogoSource({ uri: remoteLogoUrl });
    });
    return () => { active = false; };
  }, []);
  if (Platform.OS === "web") {
    return <WebIntroPlayback source={source} logoSource={logoSource} />;
  }
  return <IntroErrorBoundary><IntroPlayback logoSource={logoSource} /></IntroErrorBoundary>;
}

function WebIntroPlayback({ source, logoSource }: { source: string | number; logoSource: ImageSourcePropType }) {
  const rootNavigationState = useRootNavigationState();
  const [mounted, setMounted] = useState(true);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [playbackFinished, setPlaybackFinished] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
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
    const timer = setTimeout(() => setVideoStarted(true), VIDEO_START_DELAY);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion !== false || !videoStarted) return;
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
  }, [reduceMotion, source, videoStarted]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(false), 12000);
    return () => clearTimeout(timer);
  }, []);

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

  const showStaticLogo = reduceMotion !== false || playbackError || !videoStarted;
  return (
    <Animated.View
      style={[styles.root, overlayStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.background}>
        {showStaticLogo ? (
          <AnimatedStaticLogo source={logoSource} reduceMotion={reduceMotion !== false} />
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

function IntroPlayback({ logoSource }: { logoSource: ImageSourcePropType }) {
  const rootNavigationState = useRootNavigationState();
  const [mounted, setMounted] = useState(true);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [playbackFinished, setPlaybackFinished] = useState(false);
  const transitionStarted = useRef(false);
  const opacity = useSharedValue(1);

  const navigationReady = Boolean(rootNavigationState?.key);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (active) setReduceMotion(value); })
      .catch(() => { if (active) setReduceMotion(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // Native mobile uses the dashboard-selected App Storage image for a
    // deterministic 2.5 second intro. Video playback remains available for
    // the web preview, but cannot stretch or shorten the native splash.
    const timer = setTimeout(
      () => setPlaybackFinished(true),
      Math.max(0, NATIVE_INTRO_DURATION - FADE_DURATION),
    );
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

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!mounted) return null;

  return (
    <Animated.View
      style={[styles.root, overlayStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <StatusBar style="light" backgroundColor={INTRO_BACKGROUND} translucent={false} />
      <View style={styles.background}>
        <AnimatedStaticLogo source={logoSource} reduceMotion={reduceMotion !== false} />
      </View>
    </Animated.View>
  );
}

function AnimatedStaticLogo({ source, reduceMotion }: { source: ImageSourcePropType; reduceMotion: boolean }) {
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.94);
  const [imageSource, setImageSource] = useState<ImageSourcePropType>(source);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    setImageSource(source);
  }, [source]);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      scale.value = 1;
      return;
    }
    opacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.back(1.15)) });
  }, [opacity, reduceMotion, scale]);

  return (
    <Animated.View style={[styles.logoFrame, animatedStyle]}>
      <Image
        source={imageSource}
        style={styles.logo}
        resizeMode="contain"
        onError={() => setImageSource(INTRO_LOGO)}
      />
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