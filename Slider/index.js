import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import styles from './styles';
import Rails from './Rails';
import Thumb from './Thumb';
import Label from './Label';
import {useBoundsLayout, useLowHigh, useWidthLayout} from './hooks';
import {clamp, getValueForPosition, isLowCloser} from './helpers';

const trueFunc = () => true;

const Slider = ({ style, min, max, step, low: lowProp, high: highProp, onValueChanged }) => {

  const { low, high, setLow, setHigh } = useLowHigh(lowProp, highProp, min, max);
  const lowThumbXRef = useRef(new Animated.Value(0));
  const highThumbXRef = useRef(new Animated.Value(0));
  const labelXRef = useRef(new Animated.Value(0));
  const labelYRef = useRef(new Animated.Value(0));
  const labelWidthRef = useRef(0);
  const { current: lowThumbX } = lowThumbXRef;
  const { current: highThumbX } = highThumbXRef;
  const { current: labelX } = labelXRef;
  const { current: labelY } = labelYRef;
  const gestureStateRef = useRef({ isLow: true, lastValue: 0, lastPosition: 0 });

  const containerWidthRef = useRef(0);
  const thumbWidthRef = useRef(0);
  const handleFixedLayoutsChange = useCallback(() => {
    const { current: containerWidth } = containerWidthRef;
    const { current: thumbWidth } = thumbWidthRef;
    if (!thumbWidth || !containerWidth) {
      return;
    }
    const { current: lowThumbX } = lowThumbXRef;
    const { current: highThumbX } = highThumbXRef;
    const lowPosition = (low - min) / (max - min) * (containerWidth - thumbWidth);
    const highPosition = (high - min) / (max - min) * (containerWidth - thumbWidth);
    lowThumbX.setValue(lowPosition);
    highThumbX.setValue(highPosition);
  }, [containerWidthRef, high, low, max, min, thumbWidthRef]);

  const handleContainerLayout = useWidthLayout(containerWidthRef, handleFixedLayoutsChange);
  const handleThumbLayout = useWidthLayout(thumbWidthRef, handleFixedLayoutsChange);

  const handleLabelLayoutChange = useCallback((width, height) => {
    labelYRef.current.setValue(-height);
    labelXRef.current.setValue(gestureStateRef.current.lastPosition - width / 2 + thumbWidthRef.current / 2);
    labelWidthRef.current = width;
  }, []);
  const [labelBoundsRef, handleLabelLayout] = useBoundsLayout(handleLabelLayoutChange);

  const lowTransform = { transform: [{translateX: lowThumbX}]};
  const highTransform = { transform: [{translateX: highThumbX}]};
  const labelTransform = { transform: [{translateX: labelX}, {translateY: labelY}]};

  const inPropsRef = useRef({ low, high, min, max, step });
  Object.assign(inPropsRef.current, { low, high, min, max, step });

  const { isLow } = gestureStateRef.current;
  // Always update values of refs so pan responder will have updated values
  const pointerX = useRef(new Animated.Value(0)).current;

  const { panHandlers } = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: trueFunc,
      onStartShouldSetPanResponderCapture: trueFunc,
      onMoveShouldSetPanResponder: trueFunc,
      onMoveShouldSetPanResponderCapture: trueFunc,
      onPanResponderTerminationRequest: trueFunc,
      onPanResponderTerminate: trueFunc,
      onShouldBlockNativeResponder: trueFunc,
      onPanResponderRelease: trueFunc,

      onPanResponderGrant: ({ nativeEvent }, gestureState) => {
        const { numberActiveTouches } = gestureState;
        if (numberActiveTouches > 1) {
          return;
        }
        const { current: lowThumbX } = lowThumbXRef;
        const { current: highThumbX } = highThumbXRef;
        const { locationX: downX, pageX } = nativeEvent;
        const containerX = pageX - downX;

        const { low, high, min, max, step } = inPropsRef.current;
        const thumbWidth = thumbWidthRef.current;
        const containerWidth = containerWidthRef.current;

        const lowPosition = thumbWidth / 2 + (low - min) / (max - min) * (containerWidth - thumbWidth);
        const highPosition = thumbWidth / 2 + (high - min) / (max - min) * (containerWidth - thumbWidth);

        const isLow = isLowCloser(downX, lowPosition, highPosition);
        gestureStateRef.current.isLow = isLow;

        pointerX.removeAllListeners();
        pointerX.addListener(({ value: pointerPosition }) => {
          const positionInView = pointerPosition - containerX;
          const value = getValueForPosition(positionInView, containerWidth, thumbWidth, min, max, step);
          const availableSpace = containerWidth - thumbWidth;
          const absolutePosition = clamp((value - min) / (max - min) * availableSpace, 0, availableSpace) ;

          // Set value with setter hook only if it's changed to avoid unnecessary re-renders.
          if (value !== gestureStateRef.current.lastValue) {
            gestureStateRef.current.lastValue = value;
            gestureStateRef.current.lastPosition = absolutePosition;
            (isLow ? lowThumbX : highThumbX).setValue(absolutePosition);
            if (onValueChanged) {
              onValueChanged(isLow ? value : low, isLow ? high : value);
              (isLow ? setLow : setHigh)(value);
              labelXRef.current.setValue(absolutePosition - labelWidthRef.current / 2 + thumbWidth / 2);
            }
          }
        });
      },

      onPanResponderMove: Animated.event([null, { moveX: pointerX }]),
    });
  }, [pointerX, onValueChanged, setLow, setHigh]);

  return (
    <View
      style={[style, styles.root]}
      onLayout={handleContainerLayout}
    >
      <Animated.View
        style={[styles.lowThumbContainer, lowTransform]}
        onLayout={handleThumbLayout}
      >
        <Thumb/>
      </Animated.View>
      <Animated.View
        style={[styles.highThumbContainer, highTransform]}
      >
        <Thumb/>
      </Animated.View>
      <View style={[styles.railsContainer, { marginHorizontal: thumbWidthRef.current / 2 }]}>
        <Rails/>
      </View>
      <Animated.View style={[styles.labelContainer, labelTransform]}>
        <Label
          text={`Value: ${Math.round(isLow ? low : high)}`}
          onLayout={handleLabelLayout}
        />
      </Animated.View>
      <View { ...panHandlers } style={styles.touchableArea} collapsable={false}/>
    </View>
  );
};

export default Slider;