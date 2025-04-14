import React from 'react';
import { View, Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';

interface AverageSpendingChartProps {
  data: {
    labels: string[];
    datasets: {
      data: number[];
      color?: (opacity: number) => string;
    }[];
  };
}

const AverageSpendingChart: React.FC<AverageSpendingChartProps> = ({ data }) => {
  const { isDarkMode } = useTheme();
  const screenWidth = Dimensions.get("window").width;

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
    formatYLabel: (value: number) => Math.round(value).toString(),
    propsForBackgroundLines: {
      strokeDasharray: "",
      stroke: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
      strokeWidth: 1,
    },
  };

  return (
    <BarChart
      data={data}
      width={screenWidth - 48}
      height={220}
      yAxisLabel="$"
      yAxisSuffix=""
      chartConfig={{
        ...chartConfig,
        decimalPlaces: 0,
        formatYLabel: (value) => Math.round(Number(value)).toString(),
      }}
      style={{
        marginVertical: 8,
        borderRadius: 16,
        alignSelf: "center",
      }}
    />
  );
};

export default AverageSpendingChart; 