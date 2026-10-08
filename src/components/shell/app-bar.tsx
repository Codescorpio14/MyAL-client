import React, { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, IconName } from '@/components/ui/app-icons';
import { AppText } from '@/components/ui/app-text';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

const APP_BAR_HEIGHT = 50;

export interface AppBarSearchProps {
  hint?: string;
  value: string;
  onChange: (text: string) => void;
  onSubmit?: (text: string) => void;
  onClose?: () => void;
}

interface AppBarProps {
  title: string;
  subtitle?: string;
  /** Tapping the status/title opens the page's filter flyout. */
  onTitlePress?: () => void;
  onMenuPress?: () => void;
  /** Rendered only when provided (binds `RefreshButtonVisibility`). */
  onRefresh?: () => void;
  search?: AppBarSearchProps;
  /** Extra controls pushed to the right (before search/refresh). */
  right?: React.ReactNode;
}

/**
 * The single global app bar from `MainPage.xml`:
 * 50dp bar (`?BrushAppBarUpper`, elevation 5), hamburger, 15sp title +
 * 13sp subtitle, collapsible SearchView and refresh button.
 */
export function AppBar({
  title,
  subtitle,
  onTitlePress,
  onMenuPress,
  onRefresh,
  search,
  right,
}: AppBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const glyphColor = '#fff';

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top,
          backgroundColor: theme.brush.appBarUpper,
          elevation: 5,
        },
      ]}>
      <View style={styles.row}>
        <Ripple
          borderless
          onPress={searchOpen ? () => {
            setSearchOpen(false);
            search?.onClose?.();
          } : onMenuPress}
          style={styles.square50}>
          <AppIcon name={searchOpen ? 'close' : 'hamburger'} size={24} color={glyphColor} />
        </Ripple>

        {searchOpen && search ? (
          <TextInput
            ref={inputRef}
            autoFocus
            value={search.value}
            onChangeText={search.onChange}
            onSubmitEditing={() => search.onSubmit?.(search.value)}
            placeholder={search.hint}
            placeholderTextColor="rgba(255,255,255,0.7)"
            selectionColor={theme.accentColor}
            style={styles.searchInput}
            returnKeyType="search"
          />
        ) : (
          <Ripple onPress={onTitlePress ? () => onTitlePress() : undefined} style={styles.titleBlock}>
            <AppText
              size={theme.fontSize.appBarTitle}
              color={theme.brush.appBarText}
              numberOfLines={subtitle ? 1 : 2}
              ellipsizeMode="tail">
              {title}
            </AppText>
            {subtitle ? (
              <AppText size={theme.fontSize.appBarSubtitle} color={theme.semantic.textAccentContrast} numberOfLines={1}>
                {subtitle}
              </AppText>
            ) : null}
          </Ripple>
        )}

        {right}

        {search ? (
          <Ripple
            borderless
            onPress={() => {
              setSearchOpen(true);
            }}
            style={styles.square50}>
            <AppIcon name="search" size={24} color={glyphColor} />
          </Ripple>
        ) : null}

        {onRefresh ? (
          <Ripple borderless onPress={onRefresh} style={styles.refreshBtn}>
            <AppIcon name="reload" size={20} color={glyphColor} />
          </Ripple>
        ) : null}
      </View>
    </View>
  );
}

export interface AppBarHandle {
  title: string;
  icon?: IconName;
}

const styles = StyleSheet.create({
  bar: { width: '100%' },
  row: {
    height: APP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  square50: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    paddingHorizontal: 5,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    marginRight: 20,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 4,
  },
});
