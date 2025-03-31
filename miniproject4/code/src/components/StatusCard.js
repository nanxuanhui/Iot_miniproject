import React from 'react';
import '../styles/StatusCard.css';

const StatusCard = ({ latest }) => {
  // 如果没有数据，显示加载状态
  if (!latest) {
    return (
      <div className="status-card">
        <div className="status-content">
          <div className="status-loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="status-card">
      <div className="status-content">
        <div className="status-item">
          <div className="status-icon temperature-icon">
            <i className="fas fa-thermometer-half"></i>
          </div>
          <div className="status-info">
            <div className="status-label">Current Temperature</div>
            <div className="status-value">{latest.temperature.toFixed(1)}°C</div>
            <div className="status-trend">
              {latest.temperature > 25 ? (
                <span className="trend-up">Temperature High</span>
              ) : latest.temperature < 20 ? (
                <span className="trend-down">Temperature Low</span>
              ) : (
                <span className="trend-normal">Temperature Normal</span>
              )}
            </div>
          </div>
        </div>
        <div className="status-item">
          <div className="status-icon humidity-icon">
            <i className="fas fa-tint"></i>
          </div>
          <div className="status-info">
            <div className="status-label">Current Humidity</div>
            <div className="status-value">{latest.humidity.toFixed(1)}%</div>
            <div className="status-trend">
              {latest.humidity > 60 ? (
                <span className="trend-up">Humidity High</span>
              ) : latest.humidity < 40 ? (
                <span className="trend-down">Humidity Low</span>
              ) : (
                <span className="trend-normal">Humidity Normal</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(StatusCard);
