import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

export interface TabDef {
  key: string;
  label: string;
}

interface TabStripProps {
  tabs: TabDef[];
  activeKey: string;
  onChange: (key: string) => void;
  /** 25dp for most pages, 55dp for Calendar/Profile (`dimens.xml`). */
  height?: number;
}

/**
 * Port of `PagerSlidingTabStrip` (as configured in MALClient):
 *  - background `?BrushPivotHeaderBackground`
 *  - 14sp labels, unselected alpha 150/255, tabs centered (`CenterTabs()`)
 *  - 2dp indicator under the selected tab
 */
export function TabStrip({ tabs, activeKey, onChange, height = 25 }: TabStripProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { height, backgroundColor: theme.brush.pivotHeaderBackground }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Ripple
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={[
                styles.tab,
                {
                  height,
                  paddingHorizontal: 12,
                  borderBottomWidth: active ? 2 : 0,
                  borderBottomColor: theme.brush.text,
                },
              ]}>
              <AppText
                size={theme.fontSize.normal}
                color={theme.brush.text}
                style={{ opacity: active ? 1 : 150 / 255 }}>
                {tab.label}
              </AppText>
            </Ripple>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  scrollContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  tab: { alignItems: 'center', justifyContent: 'center' },
});
