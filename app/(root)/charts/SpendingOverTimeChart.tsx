import React, { useState, useRef } from 'react';
import { View, Dimensions, Pressable, Animated, PanResponder } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Rect, Text as TextSVG, Svg, G, Polygon } from "react-native-svg";
import { useTheme } from '../context/ThemeContext';

interface SpendingOverTimeChartProps {
  data: {
    labels: string[];
    current: number[];
  };
  timeFrame: "week" | "month" | "6months" | "year";
  onTooltipVisibilityChange?: (visible: boolean) => void;
}

interface TooltipPosition {
  x: number;
  y: number;
  visible: boolean;
  value: number;
  label: string;
}

const SpendingOverTimeChart: React.FC<SpendingOverTimeChartProps> = ({
  data,
  timeFrame,
  onTooltipVisibilityChange,
}) => {
  const { isDarkMode } = useTheme();
  const chartWidth = Dimensions.get("window").width;
  const pressTimeout = useRef<NodeJS.Timeout>();
  const [isHolding, setIsHolding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({
    x: 0,
    y: 0,
    visible: false,
    value: 0,
    label: "",
  });

  const chartConfig = {
    backgroundColor: "transparent",
    backgroundGradientFrom: isDarkMode ? "#1F2937" : "#FFFFFF",
    backgroundGradientTo: isDarkMode ? "#1F2937" : "#FFFFFF",
    decimalPlaces: 0,
    color: (opacity = 1) =>
      isDarkMode
        ? `rgba(255, 255, 255, ${opacity})`
        : `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) =>
      isDarkMode
        ? `rgba(255, 255, 255, ${opacity})`
        : `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "4",
      strokeWidth: "1",
      stroke: isDarkMode ? "#3B82F6" : "#1D4ED8",
    },
    formatYLabel: (value: number) => Math.round(value).toString(),
    propsForBackgroundLines: {
      strokeDasharray: "",
      stroke: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
      strokeWidth: 1,
    },
  };

  const roundToNearest50 = (value: number): number => {
    return Math.round(value / 50) * 50;
  };

  // Create pan responder for horizontal dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal movements
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: (event) => {
        setIsDragging(true);
        const { locationX } = event.nativeEvent;
        const dataPoint = findClosestDataPoint(locationX);
        if (dataPoint) {
          setTooltipPos({
            x: dataPoint.exactX,
            y: dataPoint.exactY,
            visible: true,
            value: dataPoint.value,
            label: dataPoint.label
          });
          onTooltipVisibilityChange?.(true);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        // Use the initial touch position plus the gesture movement
        const touchX = gestureState.moveX;
        const dataPoint = findClosestDataPoint(touchX);
        if (dataPoint) {
          setTooltipPos({
            x: dataPoint.exactX,
            y: dataPoint.exactY,
            visible: true,
            value: dataPoint.value,
            label: dataPoint.label
          });
        }
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
        updateTooltipVisibility(false);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        updateTooltipVisibility(false);
      }
    })
  ).current;

  // Update parent component when tooltip visibility changes
  const updateTooltipVisibility = (visible: boolean) => {
    setTooltipPos(prev => ({ ...prev, visible }));
    onTooltipVisibilityChange?.(visible);
  };

  const handlePressIn = (event: any) => {
    if (isDragging) return;
    
    const { locationX, locationY } = event.nativeEvent;
    const dataPoint = findClosestDataPoint(locationX);
    
    if (!dataPoint) return;
    
    pressTimeout.current = setTimeout(() => {
      setIsHolding(true);
      setTooltipPos({
        x: dataPoint.exactX,
        y: dataPoint.exactY,
        visible: true,
        value: dataPoint.value,
        label: dataPoint.label
      });
      onTooltipVisibilityChange?.(true);
    }, 200);
  };

  const handlePressOut = () => {
    if (isDragging) return;
    
    if (pressTimeout.current) {
      clearTimeout(pressTimeout.current);
      pressTimeout.current = undefined;
    }
    setIsHolding(false);
    updateTooltipVisibility(false);
  };

  const handleDataPointClick = (dataPoint: any) => {
    if (isHolding) return; // Don't handle tap if we're holding
    
    if (dataPoint.index === undefined || dataPoint.value === undefined) return;
    
    const label = data.labels[dataPoint.index];
    const isSamePoint = tooltipPos.x === dataPoint.x && tooltipPos.y === dataPoint.y;
    
    if (isSamePoint) {
      updateTooltipVisibility(!tooltipPos.visible);
    } else {
      setTooltipPos({
        x: dataPoint.x,
        y: dataPoint.y,
        visible: true,
        value: dataPoint.value,
        label
      });
    }
  };

  // Helper function to find the closest data point for a given x coordinate
  const findClosestDataPoint = (x: number) => {
    if (!data.current.length) return null;
    
    // Chart layout constants based on react-native-chart-kit's internal layout
    const yAxisWidth = 54;  // Width reserved for Y-axis labels
    const chartAreaWidth = chartWidth - yAxisWidth;
    
    // Adjust x to account for Y-axis
    const adjustedX = x - yAxisWidth;
    
    // If touch is outside actual chart area, return null
    if (adjustedX < 0 || adjustedX > chartAreaWidth) return null;
    
    const dataPoints = data.current.length;
    // Calculate segment width based on available space
    const segmentWidth = chartAreaWidth / (dataPoints);
    
    // Find the closest data point
    const index = Math.round(adjustedX / segmentWidth);
    if (index < 0 || index >= dataPoints) return null;
    
    // Calculate exact X position (from left edge of container)
    const exactX = yAxisWidth + (index * segmentWidth);
    
    // Calculate Y position
    const chartHeight = 220;
    const topPadding = 30;
    const bottomPadding = 40;
    const availableHeight = chartHeight - topPadding - bottomPadding;
    
    const maxValue = Math.max(...data.current, 1);
    const value = data.current[index];
    const percentOfMax = value / maxValue;
    
    // Y position calculation with proper scaling
    const exactY = topPadding + (availableHeight * (1 - percentOfMax));
    
    return {
      index,
      value: data.current[index],
      label: data.labels[index],
      exactX: exactX,
      exactY: exactY
    };
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ position: 'relative' }}
      {...panResponder.panHandlers}
    >
      <LineChart
        data={{
          labels: data.labels,
          datasets: [
            {
              data: data.current.length > 0 ? data.current : [1],
              color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
              strokeWidth: 2,
            },
          ],
        }}
        width={chartWidth}
        height={220}
        chartConfig={{
          ...chartConfig,
          decimalPlaces: 0,
          formatYLabel: (value) => roundToNearest50(Number(value)).toString(),
          count: 5,
        }}
        bezier
        style={{
          marginVertical: 4,
          borderRadius: 16,
          alignSelf: "center",
        }}
        withVerticalLabels={true}
        withDots={true}
        withInnerLines={true}
        withOuterLines={true}
        withVerticalLines={true}
        withHorizontalLines={true}
        withShadow={false}
        segments={4}
        fromZero={true}
        yAxisLabel="$"
        yAxisSuffix=""
        decorator={() => {
          if (!tooltipPos.visible) return null;
          
          const tipW = 100;
          const tipH = 40;
          const tipX = 5;
          const tipY = -9;
          const tipTxtX = 12;
          const tipTxtY = 6;
          const posY = tooltipPos.y;
          const posX = tooltipPos.x;
          
          // Calculate position based on available space
          let finalTipX = tipX;
          let finalTipTxtX = tipTxtX;
          let finalBoxPosX = posX;
          let arrowPoints = "";
          
          if (posX > chartWidth - tipW) {
            finalTipX = -(tipX + tipW);
            finalTipTxtX = tipTxtX - tipW - 6;
            // Arrow pointing left
            arrowPoints = `${posX},${posY} ${posX - 8},${posY - 4} ${posX - 8},${posY + 4}`;
          } else {
            // Arrow pointing right
            arrowPoints = `${posX},${posY} ${posX + 8},${posY - 4} ${posX + 8},${posY + 4}`;
          }
          
          const boxPosX = finalBoxPosX < 40 ? 40 : finalBoxPosX;
          
          return (
            <View>
              <Svg>
                {/* Arrow pointing to data point */}
                <Polygon
                  points={arrowPoints}
                  fill={isDarkMode ? "#4B5563" : "#E5E7EB"}
                  stroke={isDarkMode ? "#4B5563" : "#E5E7EB"}
                  strokeWidth="1"
                />
                {/* Tooltip Background */}
                <G x={boxPosX < 40 ? 40 : boxPosX} y={posY}>
                  <Rect
                    x={finalTipX + 1}
                    y={tipY - 1}
                    width={tipW - 2}
                    height={tipH - 2}
                    fill={isDarkMode ? "rgba(31, 41, 55, 0.9)" : "rgba(255, 255, 255, 0.9)"}
                    rx={2}
                    ry={2}
                  />
                  <Rect
                    x={finalTipX}
                    y={tipY}
                    width={tipW}
                    height={tipH}
                    rx={2}
                    ry={2}
                    fill="transparent"
                    stroke={isDarkMode ? "#4B5563" : "#E5E7EB"}
                  />
                  {/* Value Text */}
                  <TextSVG
                    x={finalTipTxtX}
                    y={tipTxtY}
                    fontSize="12"
                    textAnchor="start"
                    fill={isDarkMode ? "#E5E7EB" : "#1F2937"}
                  >
                    Spent: ${roundToNearest50(tooltipPos.value)}
                  </TextSVG>
                  {/* Label Text */}
                  <TextSVG
                    x={finalTipTxtX}
                    y={tipTxtY + 14}
                    fontSize="10"
                    textAnchor="start"
                    fill={isDarkMode ? "#9CA3AF" : "#6B7280"}
                  >
                    {timeFrame === 'week' ? 'Day' : timeFrame === 'month' ? 'Week' : timeFrame === '6months' ? 'Month' : 'Quarter'}: {tooltipPos.label}
                  </TextSVG>
                </G>
              </Svg>
            </View>
          );
        }}
        onDataPointClick={handleDataPointClick}
      />
    </Pressable>
  );
};

export default SpendingOverTimeChart; 