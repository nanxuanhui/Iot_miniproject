import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import '../styles/Chart.css';

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const TemperatureChart = ({ data, isSearching }) => {
  // 使用 useMemo 优化数据处理
  const chartData = useMemo(() => {
    // 确保数据按时间戳排序，并只显示最近20条数据
    const sortedData = [...data]
      .sort((a, b) => new Date(a.timestamp * 1000) - new Date(b.timestamp * 1000))
      .slice(-20);

    return {
      labels: sortedData.map(item => {
        const date = new Date(item.timestamp * 1000);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }),
      datasets: [
        {
          label: 'Temperature (°C)',
          data: sortedData.map(item => item.temperature),
          borderColor: '#ff6b6b',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          tension: 0.1,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5
        }
      ]
    };
  }, [data]); // 只在 data 变化时重新计算

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: isSearching ? 0 : 150 // 搜索时禁用动画，实时更新时使用短动画
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 14
          }
        }
      },
      title: {
        display: true,
        text: isSearching ? 'Temperature Search Results' : 'Real-time Temperature Trend',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            const value = context.raw;
            return `Temperature: ${value.toFixed(1)}°C`;
          },
          title: (tooltipItems) => {
            return `Time: ${tooltipItems[0].label}`;
          }
        }
      }
    },
    scales: {
      y: {
        min: Math.floor(Math.min(...data.map(item => item.temperature)) - 1),
        max: Math.ceil(Math.max(...data.map(item => item.temperature)) + 1),
        title: {
          display: true,
          text: 'Temperature (°C)',
          font: {
            size: 14
          }
        },
        ticks: {
          font: {
            size: 12
          },
          callback: (value) => `${value}°C`
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time',
          font: {
            size: 14
          }
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: {
            size: 12
          }
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  }), [data, isSearching]); // 依赖于 data 和 isSearching

  return (
    <div className="chart-container">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default React.memo(TemperatureChart);
