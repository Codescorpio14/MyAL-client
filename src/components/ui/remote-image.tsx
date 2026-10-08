import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-context';

interface RemoteImageProps {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: 'cover' | 'contain';
  /** Spinner shown until the bitmap arrives (FFImageLoading placeholder). */
  showPlaceholder?: boolean;
  radius?: number;
}

/** Port of `ImageViewAsync` — image with an in-place loading indicator. */
export function RemoteImage({
  uri,
  style,
  contentFit = 'cover',
  showPlaceholder = true,
  radius = 0,
}: RemoteImageProps) {
  const theme = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <View style={[{ overflow: 'hidden', borderRadius: radius, backgroundColor: theme.brush.animeItemInnerBackground }, style]}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={150}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          cachePolicy="memory-disk"
        />
      ) : null}
      {showPlaceholder && uri && !loaded && !failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <ActivityIndicator size="small" color={theme.accentColor} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
