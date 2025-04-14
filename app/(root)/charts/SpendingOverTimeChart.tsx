// SpendingOverTimeChart.tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, PanResponder, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Polygon, Rect, Text as TextSVG, Circle, Line, G, Svg } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

/**
 * Props for the SpendingOverTimeChart component
 */
interface SpendingOverTimeChartProps {
  data: {
    labels: string[];      // X-axis time labels (e.g., ["Mon", "Tue", ...])
    current: number[];     // Y-axis values representing spending
  };
  timeFrame: "week" | "month" | "6months" | "year";  // Defines temporal resolution
  onTooltipVisibilityChange?: (visible: boolean) => void;  // Optional visibility callback
}

/**
 * Interface for the tooltip position and contents
 */
interface TooltipPosition {
  x: number;     // X position in pixels
  y: number;     // Y position in pixels
  visible: boolean;
  value: number; // actual amount spent
  label: string; // associated label (e.g., "Mon")
  index: number; // data point index
  exactX?: number; // Exact X position for tooltip rendering
  exactY?: number; // Exact Y position for tooltip rendering
}

const SpendingOverTimeChart: React.FC<SpendingOverTimeChartProps> = ({
  data,
  timeFrame,
  onTooltipVisibilityChange
}) => {
  const { isDarkMode } = useTheme();
  const screenWidth = Dimensions.get('window').width - 32; // Account for padding
  const chartHeight = 220;
  
  // Input validation - handle empty data case
  const chartData = data.current.length > 0 ? data.current : [1];
  const labels = data.labels.length > 0 ? data.labels : [''];
  
  // State for touch interaction
  const [isHolding, setIsHolding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({
    x: 0,
    y: 0,
    visible: false,
    value: 0,
    label: '',
    index: 0
  });
  
  // Refs for touch handling
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);
  const chartRef = useRef<View>(null);
  
  // Notify parent component about tooltip visibility changes
  useEffect(() => {
    if (onTooltipVisibilityChange) {
      onTooltipVisibilityChange(tooltipPos.visible);
    }
  }, [tooltipPos.visible, onTooltipVisibilityChange]);
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (longPressTimeout.current) {
        clearTimeout(longPressTimeout.current);
      }
    };
  }, []);
  
  // Helper function to format monetary values based on timeFrame
  const formatLabel = (value: number, label: string): string => {
    // Round to nearest 50
    const roundedValue = Math.round(value / 50) * 50;
    
    // Format based on timeFrame
    switch (timeFrame) {
      case "week":
        return `${label}\n$${roundedValue}`;
      case "month":
        return `Week ${label}\n$${roundedValue}`;
      case "6months":
        return `${label}\n$${roundedValue}`;
      case "year":
        return `Q${label}\n$${roundedValue}`;
      default:
        return `$${roundedValue}`;
    }
  };

  // Helper function to find the closest data point for a given x coordinate
  const findClosestDataPoint = (x: number): TooltipPosition | null => {
    // Chart layout constants
    const yAxisWidth = 54;  // Width reserved for Y-axis labels
    const chartAreaWidth = screenWidth - yAxisWidth;
    
    // Adjust x to account for Y-axis
    const adjustedX = x - yAxisWidth;
    
    // If touch is outside chart area, return null
    if (adjustedX < 0 || adjustedX > chartAreaWidth) return null;
    
    const dataPoints = chartData.length;
    // Calculate segment width based on available space
    const segmentWidth = chartAreaWidth / (dataPoints);
    
    // Find the closest data point
    const index = Math.min(Math.max(0, Math.round(adjustedX / segmentWidth)), dataPoints - 1);
    
    // Calculate exact X position (from left edge of container)
    const exactX = yAxisWidth + (index * segmentWidth);
    
    // Chart dimensions for Y calculation
    const topPadding = 30;
    const bottomPadding = 40;
    const availableHeight = chartHeight - topPadding - bottomPadding;
    
    // Find maximum value for scaling
    const maxValue = Math.max(...chartData, 1);
    const value = chartData[index];
    const percentOfMax = value / maxValue;
    
    // Y position with proper scaling
    const exactY = topPadding + (availableHeight * (1 - percentOfMax));
    
    return {
      index,
      value: chartData[index],
      label: labels[index],
      exactX,
      exactY,
      visible: true,
      x: exactX,   // Include required x property
      y: exactY    // Include required y property
    };
  };
  
  // Set up pan responder for touch interactions
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (evt) => {
        // Capture locationX value immediately
        const locationX = evt.nativeEvent.locationX;
        
        // Start holding timer for long press
        longPressTimeout.current = setTimeout(() => {
          setIsHolding(true);
          const closestPoint = findClosestDataPoint(locationX);
          
          if (closestPoint) {
            setTooltipPos({
              ...closestPoint,
              visible: true
            });
          }
        }, 100); // 100ms delay for long press
      },
      
      onPanResponderMove: (evt) => {
        if (isHolding) {
          setIsDragging(true);
          // Capture locationX value immediately 
          const locationX = evt.nativeEvent.locationX;
          const closestPoint = findClosestDataPoint(locationX);
          
          if (closestPoint) {
            setTooltipPos({
              ...closestPoint,
              visible: true
            });
          }
        }
      },
      
      onPanResponderRelease: () => {
        // Clear timeout if released before long press
        if (longPressTimeout.current) {
          clearTimeout(longPressTimeout.current);
          longPressTimeout.current = null;
        }
        
        // Hide tooltip after delay when released
        setTimeout(() => {
          setTooltipPos(prev => ({...prev, visible: false}));
          setIsHolding(false);
          setIsDragging(false);
        }, 500); // Keep tooltip visible for 500ms after release
      },
      
      onPanResponderTerminate: () => {
        // Handle unexpected termination (e.g., another gesture takes over)
        if (longPressTimeout.current) {
          clearTimeout(longPressTimeout.current);
          longPressTimeout.current = null;
        }
        
        setTooltipPos(prev => ({...prev, visible: false}));
        setIsHolding(false);
        setIsDragging(false);
      }
    })
  ).current;
  
  // Chart configuration
  const chartConfig = {
    backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
    backgroundGradientFrom: isDarkMode ? "#1F2937" : "#FFFFFF",
    backgroundGradientTo: isDarkMode ? "#1F2937" : "#FFFFFF",
    decimalPlaces: 0,
    color: (opacity = 1) => isDarkMode 
      ? `rgba(255, 255, 255, ${opacity})`
      : `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => isDarkMode
      ? `rgba(255, 255, 255, ${opacity})`
      : `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: "4",
      strokeWidth: "1",
      stroke: isDarkMode ? "#3B82F6" : "#1D4ED8",
    },
    formatYLabel: (yLabel: string) => Math.round(parseFloat(yLabel)).toString(),
    propsForBackgroundLines: {
      strokeDasharray: "", // solid background lines
      stroke: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
      strokeWidth: 1,
    },
  };
  
  // Tooltip decorator for the chart
  const renderTooltip = () => {
    if (!tooltipPos.visible) return null;
    
    // Determine if tooltip should be flipped based on position
    const screenCenter = screenWidth / 2;
    const isRightSide = tooltipPos.exactX ? tooltipPos.exactX > screenCenter : false;
    const tooltipWidth = 100;
    const tooltipHeight = 60; // Increased height to accommodate two lines
          
          return (
              <Svg>
        <G x={tooltipPos.exactX || 0} y={tooltipPos.exactY || 0}>
          {/* Tooltip background */}
                  <Rect
            x={isRightSide ? -tooltipWidth - 10 : 10}
            y={-tooltipHeight - 10}
            width={tooltipWidth}
            height={tooltipHeight}
            rx={8}
            fill={isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)'}
            stroke={isDarkMode ? '#4B5563' : '#E5E7EB'}
            strokeWidth={1}
          />
          
          {/* Tooltip pointer */}
          <Polygon
            points={isRightSide ? 
              `-10,0 -20,-10 -20,10` : 
              `10,0 20,-10 20,10`
            }
            fill={isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)'}
            stroke={isDarkMode ? '#4B5563' : '#E5E7EB'}
            strokeWidth={1}
          />
          
          {/* Amount and Label */}
                  <TextSVG
            x={isRightSide ? -tooltipWidth / 2 - 10 : tooltipWidth / 2 + 10}
            y={-tooltipHeight / 2 - 5}
            fontSize={14}
            fontWeight="bold"
            fill={isDarkMode ? '#E5E7EB' : '#1F2937'}
            textAnchor="middle"
          >
            {formatLabel(tooltipPos.value, tooltipPos.label)}
                  </TextSVG>
          
          {/* Active dot */}
          <Circle
            cx={0}
            cy={0}
            r={6}
            fill={isDarkMode ? "#3B82F6" : "#1D4ED8"}
          />
                </G>
              </Svg>
    );
  };
  
  return (
    <View style={{ alignItems: 'center' }}>
      <View 
        ref={chartRef}
        style={{ 
          position: 'relative', 
          width: screenWidth, 
          height: chartHeight 
        }}
        {...panResponder.panHandlers}
      >
        <LineChart
          data={{
            labels: labels,
            datasets: [
              {
                data: chartData
              }
            ]
          }}
          width={screenWidth}
          height={chartHeight}
          chartConfig={chartConfig}
          bezier
          withShadow={false}
          withDots={true}
          withInnerLines={true}
          withOuterLines={true}
          withVerticalLines={false}
          withHorizontalLines={true}
          yAxisInterval={1}
          decorator={() => renderTooltip()}
          style={{
            borderRadius: 16,
          }}
        />
      </View>
    </View>
  );
};

export default SpendingOverTimeChart; 
