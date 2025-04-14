import React from 'react';
import { View, Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';

interface PieChartData {
  name: string;
  amount: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

interface CategoryBreakdownChartProps {
  data: PieChartData[];
}

const CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = ({ data }) => {
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
    formatYLabel: (yLabel: string) => yLabel,
  };

  return (
    <PieChart
      data={
        data.length > 0
          ? data
          : [
              {
                name: "No Data",
                amount: 1,
                color: "#cccccc",
                legendFontColor: isDarkMode ? "#FFFFFF" : "#000000",
                legendFontSize: 12,
              },
            ]
      }
      width={screenWidth - 48}
      height={220}
      chartConfig={chartConfig}
      accessor="amount"
      backgroundColor="transparent"
      paddingLeft="15"
      absolute
      style={{
        marginVertical: 8,
        borderRadius: 16,
        alignSelf: "center",
      }}
    />
  );
};

export default CategoryBreakdownChart; 