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
  const rootNavigationState = useRootNavigationState();
  const [mounted, setMounted] = useState(true);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [playbackFinished, setPlaybackFinished] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [configuredVideoUrl, setConfiguredVideoUrl] = useState<string | null>(null);
  const transitionStarted = useRef(false);
  const playbackStarted = useRef(false);
  const opacity = useSharedValue(1);

  const player = useVideoPlayer(INTRO_VIDEO, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
    videoPlayer.audioMixingMode = "auto";
    videoPlayer.staysActiveInBackground = false;
    videoPlayer.keepScreenOnWhilePlaying = true;
  });

  const navigationReady = Boolean(rootNavigationState?.key);

  useEffect(() => {
    let active = true;
    void fetch(`${getApiBaseSafe()}/api/app-config`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`App config HTTP ${response.status}`);
        return response.json() as Promise<{ splashVideoUrl?: unknown }>;
      })
      .then(async (config) => {
        const remoteUrl = typeof config.splashVideoUrl === "string"
          ? resolveMediaUrl(config.splashVideoUrl)
          : null;
        if (!active || !remoteUrl) return;
        await player.replaceAsync(remoteUrl);
        if (active) setConfiguredVideoUrl(remoteUrl);
      })
      .catch((error) => console.warn("[SplashOverlay] using bundled intro:", error));
    return () => { active = false; };
  }, [player]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

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

    return () => {
      endSubscription.remove();
      statusSubscription.remove();
    };
  }, [player]);

  useEffect(() => {
    if (reduceMotion !== false || playbackStarted.current || playbackError) return;
    playbackStarted.current = true;
    // Give the startup config request a brief opportunity to replace the
    // bundled asset. Network failures still fall back to the local intro.
    const timer = setTimeout(() => {
      if (!playbackStarted.current) {
        playbackStarted.current = true;
        player.play();
      }
    }, configuredVideoUrl ? 0 : 450);
    return () => clearTimeout(timer);
  }, [configuredVideoUrl, playbackError, player, reduceMotion]);

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
  const showStaticLogo = reduceMotion !== false || playbackError;

  if (!mounted) return null;

  return (
    <Animated.View
      style={[styles.root, overlayStyle, { pointerEvents: "none" }]}
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
            contentFit="contain"
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
});