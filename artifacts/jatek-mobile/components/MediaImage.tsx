import React, { type ReactNode, useMemo, useState } from "react";
import { type ImageStyle, type StyleProp } from "react-native";
import { Image, type ImageContentFit } from "expo-image";

import { getMediaUrlCandidates } from "@/lib/mediaUrl";

type Props = {
  urls: Array<string | null | undefined>;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageContentFit;
  fallback?: ReactNode;
  accessibilityLabel?: string;
};

/**
 * A backend-media image that advances through valid URL candidates and then
 * renders a real fallback when the network source cannot be decoded or read.
 */
export function MediaImage({
  urls,
  style,
  resizeMode = "cover",
  fallback = null,
  accessibilityLabel,
}: Props) {
  const sourceKey = urls.join("\u0000");
  const candidates = useMemo(() => getMediaUrlCandidates(...urls), [sourceKey]);
  const [failedSource, setFailedSource] = useState({ key: sourceKey, index: 0 });
  // State updates happen after render. Deriving the index for a new key here
  // prevents a recycled list cell from flashing the previous item's image.
  const sourceIndex = failedSource.key === sourceKey ? failedSource.index : 0;
  const uri = candidates[sourceIndex];
  if (!uri) return <>{fallback}</>;

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit={resizeMode}
      cachePolicy="memory-disk"
      recyclingKey={sourceKey}
      transition={0}
      accessibilityLabel={accessibilityLabel}
      onError={() => setFailedSource({ key: sourceKey, index: sourceIndex + 1 })}
    />
  );
}