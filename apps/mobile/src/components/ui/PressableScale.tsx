import { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Basılınca hafifçe küçülen, bırakınca geri zıplayan dokunma geri bildirimi.
 * `react-native-reanimated` eklemeden native `Animated` API'siyle — ekstra
 * babel plugin/derleme yapılandırması gerektirmez.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  haptic = false,
  disabled,
  ...rest
}: PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function animateTo(value: number) {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  }

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(event) => {
        animateTo(scaleTo);
        rest.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        rest.onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        rest.onPress?.(event);
      }}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity: disabled ? 0.5 : 1 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
