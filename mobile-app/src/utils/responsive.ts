import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * Linear scale based on screen width relative to a standard 375px-wide design.
 */
export function scale(size: number): number {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
}

/**
 * Linear scale based on screen height.
 */
export function verticalScale(size: number): number {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
}

/**
 * Moderate scale: a damped scaling factor so fonts don't get too large on tablets
 * or too small on compact phones. `factor` controls the scaling intensity (0 = no
 * scaling, 1 = full linear scaling). Default factor is 0.5.
 */
export function moderateScale(size: number, factor: number = 0.5): number {
  return size + (scale(size) - size) * factor;
}

/**
 * Responsive font size. Uses moderateScale with PixelRatio rounding so text
 * snaps to whole pixel boundaries and stays crisp.
 */
export function responsiveFontSize(size: number): number {
  const newSize = moderateScale(size, 0.4);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export const rf = responsiveFontSize;

export { SCREEN_WIDTH, SCREEN_HEIGHT };
