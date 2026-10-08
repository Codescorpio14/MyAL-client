import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { AppIcon, IconName } from '@/components/ui/app-icons';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

export interface DialogOption {
  key: string;
  label: string;
  icon?: IconName;
}

/**
 * Port of `AnimeUpdateDialogBuilder.BuildStatusDialog` / `BuildScoreDialog` —
 * an AlertDialog with a single-choice list (10dp corners like `dialog_bg`).
 */
export function OptionsDialog({
  visible,
  title,
  options,
  selectedKey,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  title: string;
  options: DialogOption[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={[styles.dialog, { backgroundColor: theme.brush.flyoutBackground }]}>
          <AppText size={theme.fontSize.dialogTitle} color={theme.brush.text} style={styles.dialogTitle}>
            {title}
          </AppText>

          <View style={{ maxHeight: 360 }}>
            {options.map((option) => {
              const selected = option.key === selectedKey;
              return (
                <Ripple
                  key={option.key}
                  onPress={() => onSelect(option.key)}
                  style={[
                    styles.optionRow,
                    selected ? { backgroundColor: theme.brush.selectedDialogItem } : null,
                  ]}>
                  {option.icon ? (
                    <AppIcon
                      name={option.icon}
                      size={24}
                      color={selected ? theme.accentColor : theme.brush.text}
                      style={{ marginRight: 16 }}
                    />
                  ) : null}
                  <AppText size={theme.fontSize.medium} color={selected ? theme.accentColor : theme.brush.text}>
                    {option.label}
                  </AppText>
                </Ripple>
              );
            })}
          </View>

          <View style={styles.buttonRow}>
            <Ripple onPress={onCancel} style={styles.dialogButton}>
              <AppText size={theme.fontSize.normal} color={theme.accentColor} style={styles.buttonLabel}>
                CANCEL
              </AppText>
            </Ripple>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Port of `AnimeUpdateDialogBuilder.BuildWatchedDialog` — pick an episode /
 * chapter progress with -/+ and OK.
 */
export function ProgressDialog({
  visible,
  title,
  value,
  total,
  onChange,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  value: number;
  total?: number;
  onChange: (next: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  if (!visible) return null;

  const dec = () => onChange(Math.max(0, value - 1));
  const inc = () => onChange(total ? Math.min(total, value + 1) : value + 1);

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={[styles.dialog, { backgroundColor: theme.brush.flyoutBackground }]}>
          <AppText size={theme.fontSize.dialogTitle} color={theme.brush.text} style={styles.dialogTitle}>
            {title}
          </AppText>

          <View style={styles.stepperRow}>
            <Ripple onPress={dec} borderless style={[styles.stepBtn, { backgroundColor: theme.accentDark }]}>
              <AppIcon name="minus" size={24} color="#fff" />
            </Ripple>

            <AppText size={theme.fontSize.huge} color={theme.brush.text} style={{ minWidth: 90, textAlign: 'center' }}>
              {total ? `${value}/${total}` : String(value)}
            </AppText>

            <Ripple onPress={inc} borderless style={[styles.stepBtn, { backgroundColor: theme.accentDark }]}>
              <AppIcon name="add" size={24} color="#fff" />
            </Ripple>
          </View>

          <View style={styles.buttonRow}>
            <Ripple onPress={onCancel} style={styles.dialogButton}>
              <AppText size={theme.fontSize.normal} color={theme.accentColor} style={styles.buttonLabel}>
                CANCEL
              </AppText>
            </Ripple>
            <Ripple onPress={onConfirm} style={styles.dialogButton}>
              <AppText size={theme.fontSize.normal} color={theme.accentColor} style={styles.buttonLabel}>
                OK
              </AppText>
            </Ripple>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 10,
    elevation: 8,
    paddingBottom: 4,
  },
  dialogTitle: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 20,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  dialogButton: {
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonLabel: { letterSpacing: 0.8 },
});
