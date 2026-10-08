import { TextStyle, ViewStyle } from 'react-native';

/**
 * Ports of the original shape drawables (layer-lists with negative insets):
 *  - border_accent_left(_wide)  → only the left edge of an accent stroke shows
 *  - border_accent_underline   → only the bottom edge shows
 *  - border_accent_rightleft   → left + right edges show
 *  - inc_dec_btn_backgroud     → filled rect + full 1dp accent outline
 */

/** 2dp (or 4dp wide) accent rail down the left edge of a card. */
export function railLeft(accent: string, width = 4): ViewStyle {
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width,
    backgroundColor: accent,
  };
}

/** 1dp accent underline (`border_accent_underline`). */
export function underline(accent: string, width = 1): TextStyle {
  return {
    borderBottomWidth: width,
    borderBottomColor: accent,
  };
}

/** 2dp accent rails on both vertical edges (`border_accent_rightleft`). */
export function railsBoth(accent: string, width = 2): ViewStyle {
  return {
    borderLeftWidth: width,
    borderRightWidth: width,
    borderLeftColor: accent,
    borderRightColor: accent,
  };
}

/** Accent outline on all four sides (`border_accent_rightleft_orange`). */
export function railsAll(accent: string, width = 2): ViewStyle {
  return {
    borderWidth: width,
    borderColor: accent,
  };
}

/** `inc_dec_btn_backgroud` — deep-background fill with accent outline. */
export function outlineBox(background: string, accent: string, width = 1): ViewStyle {
  return {
    backgroundColor: background,
    borderWidth: width,
    borderColor: accent,
  };
}

/** Card container: 2dp elevation, item background, square corners. */
export function card(background: string): ViewStyle {
  return {
    backgroundColor: background,
    elevation: 2,
    borderRadius: 0,
  };
}

/** `TextViewHeaderStyle` — 14sp header with 5dp margin. */
export function headerTextStyle(color: string): TextStyle {
  return { color };
}
