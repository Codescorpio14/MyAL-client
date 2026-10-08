import React, { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, IconName } from '@/components/ui/app-icons';
import { Flyout, FlyoutRect } from '@/components/ui/flyout';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

export interface FabAction {
  key: string;
  icon: IconName;
  onPress: () => void;
}

export interface FabMenuItem {
  key: string;
  label: string;
  onPress: () => void;
}

interface FabMenuProps {
  /** filter / sort / shuffle (+ calendar for seasonal, fav for top). */
  actions: FabAction[];
  /** Long-press Droppy flyout: Set list source / Load all details / Display modes. */
  menuItems: FabMenuItem[];
}

const SUB = 45;
const FAB = 56;
const MARGIN = 16;
/** oguzbilgener library defaults — arc from 180° (left) to 270° (top). */
const START_ANGLE = 180;
const END_ANGLE = 270;

/** One 45dp mini FAB springing out of the main button (720° spin, staggered). */
function ArcButton({
  action,
  index,
  count,
  radius,
  right,
  bottom,
  onPick,
}: {
  action: FabAction;
  index: number;
  count: number;
  radius: number;
  right: number;
  bottom: number;
  onPick: (action: FabAction) => void;
}) {
  const theme = useTheme();
  const [p] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(p, {
      toValue: 1,
      friction: 7,
      tension: 100,
      delay: (count - index) * 20,
      useNativeDriver: true,
    }).start();
  }, [p, count, index]);

  const t = count === 1 ? 1 : index / (count - 1);
  const angle = ((START_ANGLE + (END_ANGLE - START_ANGLE) * t) * Math.PI) / 180;
  const dx = radius * Math.cos(angle);
  const dy = radius * Math.sin(angle);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right,
        bottom,
        width: 0,
        height: 0,
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
        transform: [
          { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [-dx, 0] }) },
          { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-dy, 0] }) },
          { scale: p },
          { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['720deg', '0deg'] }) },
        ],
      }}>
      <Ripple
        borderless
        onPress={() => onPick(action)}
        style={{
          position: 'absolute',
          left: dx - SUB / 2,
          top: dy - SUB / 2,
          width: SUB,
          height: SUB,
          borderRadius: SUB / 2,
          backgroundColor: theme.accent.contrast,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 6,
        }}>
          <AppIcon name={action.icon} size={24} color="#fff" />
      </Ripple>
    </Animated.View>
  );
}

/**
 * Port of the `FloatingActionMenu` built in `InitActionMenu`:
 *  - main FAB: 56dp, `icon_more`, `?AccentColourContrast`, 16dp margins
 *  - sub buttons: 45dp mini FABs, white glyphs, `?AccentColourContrast`
 *  - arc: radius 75dp for 3 items, 95dp for 4, evenly spaced 180°→270°
 *  - long press → `FlyoutMenuBuilder.BuildGenericFlyout` list
 *  - hidden while the keyboard is open (keypad-height check)
 */
export function FabMenu({ actions, menuItems }: FabMenuProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [anchor, setAnchor] = useState<FlyoutRect | null>(null);
  const fabRef = useRef<View>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const radius = actions.length > 3 ? 95 : 75;
  const bottomBase = MARGIN + Math.max(insets.bottom, 0);

  if (keyboard) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {open
        ? actions.map((action, i) => (
            <ArcButton
              key={action.key}
              action={action}
              index={i}
              count={actions.length}
              radius={radius}
              right={MARGIN + FAB / 2}
              bottom={bottomBase + FAB / 2}
              onPick={(picked) => {
                setOpen(false);
                picked.onPress();
              }}
            />
          ))
        : null}

      <Flyout
        visible={anchor !== null}
        anchor={anchor}
        items={menuItems.map((m) => ({ key: m.key, label: m.label }))}
        onSelect={(key) => {
          const item = menuItems.find((m) => m.key === key);
          setAnchor(null);
          item?.onPress();
        }}
        onClose={() => setAnchor(null)}
        alignEnd
      />

      <View
        ref={fabRef}
        style={{ position: 'absolute', right: MARGIN, bottom: bottomBase, width: FAB, height: FAB }}>
        <Ripple
          borderless
          onPress={() => setOpen((v) => !v)}
          onLongPress={() => {
            fabRef.current?.measureInWindow((x, y, width, height) => {
              setAnchor({ x, y, width, height });
            });
          }}
          style={{
            width: FAB,
            height: FAB,
            borderRadius: FAB / 2,
            backgroundColor: theme.accent.contrast,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 6,
          }}>
          <AppIcon name="more" size={24} color="#fff" />
        </Ripple>
      </View>
    </View>
  );
}
