import React, { useState } from 'react';
import { searchTemperature } from '../services/api';
import { Link } from 'react-router-dom';
import '../styles/TemperatureSearch.css';

const TemperatureSearchPage = () => {
    const [threshold, setThreshold] = useState('');
    const [condition, setCondition] = useState('above');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await searchTemperature(parseFloat(threshold), condition);
            if (result.error) {
                setError(result.error);
            } else {
                setSearchResults(result.data);
            }
        } catch (err) {
            setError('Search failed, please try again');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp * 1000).toLocaleString('en-US');
    };

    return (
        <div className="temperature-search-page">
            <div className="page-header">
                <Link to="/dashboard" className="back-button">
                    ← Back to Dashboard
                </Link>
                <h2>Temperature Search</h2>
            </div>
            
            <div className="search-container">
                <form onSubmit={handleSearch} className="search-form">
                    <div className="form-group">
                        <label>Temperature (°C)</label>
                        <input
                            type="number"
                            value={threshold}
                            onChange={(e) => setThreshold(e.target.value)}
                            placeholder="Enter value"
                            step="0.1"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Condition</label>
                        <select
                            value={condition}
                            onChange={(e) => setCondition(e.target.value)}
                            required
                        >
                            <option value="above">Above</option>
                            <option value="below">Below</option>
                        </select>
                    </div>

                    <button type="submit" disabled={loading} className="search-button">
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </form>

                {error && <div className="error-message">{error}</div>}
            </div>

            {searchResults.length > 0 && (
                <div className="results-container">
                    <h3>Search Results</h3>
                    <div className="results-summary">
                        Found {searchResults.length} records {condition === 'above' ? 'above' : 'below'} {threshold}°C
                    </div>
                    
                    <div className="results-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Temperature (°C)</th>
                                    <th>Humidity (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchResults.map((record, index) => (
                                    <tr key={index}>
                                        <td>{formatTime(record.timestamp)}</td>
                                        <td>{record.temperature.toFixed(1)}</td>
                                        <td>{record.humidity.toFixed(1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemperatureSearchPage; 