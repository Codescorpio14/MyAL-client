import React, { useMemo } from 'react';
import { Dimensions, Modal, Pressable, StyleProp, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

export interface FlyoutRect {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface FlyoutItem {
  key: string;
  label: string;
  selected?: boolean;
}

interface FlyoutProps {
  visible: boolean;
  /** Window coordinates of the anchor view. */
  anchor?: FlyoutRect | null;
  items: FlyoutItem[];
  onSelect: (key: string) => void;
  onClose: () => void;
  /** Right-align the panel with the anchor's right edge. */
  alignEnd?: boolean;
  minWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Port of `FlyoutMenuBuilder.BuildGenericFlyout` (Droppy popup):
 *  - `?BrushFlyoutBackground` panel with 10dp corners
 *  - 30dp rows, 100dp/150dp widths (`dimens.xml`)
 *  - dismisses on any outside touch
 */
export function Flyout({ visible, anchor, items, onSelect, onClose, alignEnd, minWidth = 100, style }: FlyoutProps) {
  const theme = useTheme();

  // Position is pure derivation from the anchor rect — compute on every render
  // instead of driving it with effect state (`FlyoutMenuBuilder` popup maths).
  const position = useMemo(() => {
    if (!anchor || items.length === 0) return null;
    const screen = Dimensions.get('window');
    const estimatedWidth = Math.max(minWidth, 150, ...items.map((i) => i.label.length * 7.5 + 32));
    const anchorHeight = anchor.height ?? 30;

    let left = alignEnd ? anchor.x + (anchor.width ?? 0) - estimatedWidth : anchor.x;
    let top = anchor.y + anchorHeight;
    if (top + items.length * 30 + 16 > screen.height) top = Math.max(8, anchor.y - items.length * 30 - 8);
    left = Math.max(8, Math.min(left, screen.width - estimatedWidth - 8));
    return { left, top };
  }, [anchor, items, alignEnd, minWidth]);

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: position?.left ?? 0,
          top: position?.top ?? 0,
          minWidth,
          backgroundColor: theme.brush.flyoutBackground,
          borderRadius: theme.radii.dialog,
          elevation: 8,
          overflow: 'hidden',
          paddingVertical: 4,
          ...((style as object) ?? {}),
        }}>
        {items.map((item) => (
          <Ripple
            key={item.key}
            onPress={() => {
              onSelect(item.key);
              onClose();
            }}
            style={{
              minHeight: 30,
              justifyContent: 'center',
              paddingHorizontal: 14,
              backgroundColor: item.selected ? theme.brush.selectedDialogItem : undefined,
            }}>
            <AppText size={theme.fontSize.normal} color={theme.brush.text}>
              {item.label}
            </AppText>
          </Ripple>
        ))}
      </View>
    </Modal>
  );
}

/** Measures a view's window rect — pass the result to `<Flyout anchor=…>`. */
export async function measureAnchor(ref: { current?: View | null } | null): Promise<FlyoutRect | null> {
  const node = ref?.current;
  if (!node) return null;
  return new Promise((resolve) => {
    node.measureInWindow?.((x: number, y: number, width: number, height: number) => {
      resolve({ x, y, width, height });
    }) ?? resolve(null);
  });
}
