import React, { useState } from 'react';
import { searchTemperature } from '../services/api';
import '../styles/TemperatureSearch.css';

const TemperatureSearch = ({ onSearchResults, onClear }) => {
  const [threshold, setThreshold] = useState('');
  const [operator, setOperator] = useState('above');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchInfo, setSearchInfo] = useState(null);
  const [searchDetails, setSearchDetails] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!threshold || isNaN(threshold)) {
      setError('Please enter a valid temperature value');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await searchTemperature(parseFloat(threshold), operator);
      
      if (result.error) {
        setError(result.error);
        onSearchResults(null);
        setSearchDetails(null);
      } else {
        const sortedData = [...result.data].sort((a, b) => b.timestamp - a.timestamp);
        setSearchInfo({
          threshold: parseFloat(threshold),
          operator: operator,
          total: result.total
        });
        setSearchDetails({
          latest: sortedData[0],
          oldest: sortedData[sortedData.length - 1]
        });
        onSearchResults(result);
      }
    } catch (err) {
      setError('Search failed, please try again');
      onSearchResults(null);
      setSearchDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setThreshold('');
    setOperator('above');
    setError('');
    setSearchInfo(null);
    setSearchDetails(null);
    onClear();
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="dashboard-temperature-search">
      <h3>Temperature Search</h3>
      <form onSubmit={handleSearch} className="dashboard-search-form">
        <div className="dashboard-search-inputs">
          <div className="dashboard-input-group">
            <label htmlFor="threshold">Temperature Threshold (°C)</label>
            <input
              id="threshold"
              type="number"
              step="0.1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="Enter temperature"
            />
          </div>
          <div className="dashboard-input-group">
            <label htmlFor="operator">Condition</label>
            <select
              id="operator"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            >
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </div>
          <div className="dashboard-button-group">
            <button type="submit" disabled={loading} className="dashboard-search-button">
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button type="button" onClick={handleClear} className="dashboard-clear-button">
              Clear Search
            </button>
          </div>
        </div>
      </form>
      
      {error && (
        <div className="dashboard-search-error">
          {error}
        </div>
      )}
      
      {searchInfo && searchDetails && (
        <div className="dashboard-search-info">
          <div>Found {searchInfo.total} records {searchInfo.operator === 'above' ? 'above' : 'below'} 
          {searchInfo.threshold}°C</div>
          <div className="dashboard-search-details">
            <div className="dashboard-detail-item">
              <span className="dashboard-detail-label">Latest Record:</span>
              <span className="dashboard-detail-value">
                {searchDetails.latest.temperature.toFixed(1)}°C
              </span>
              <span className="dashboard-detail-time">
                ({formatTime(searchDetails.latest.timestamp)})
              </span>
            </div>
            <div className="dashboard-detail-item">
              <span className="dashboard-detail-label">Earliest Record:</span>
              <span className="dashboard-detail-value">
                {searchDetails.oldest.temperature.toFixed(1)}°C
              </span>
              <span className="dashboard-detail-time">
                ({formatTime(searchDetails.oldest.timestamp)})
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemperatureSearch; 