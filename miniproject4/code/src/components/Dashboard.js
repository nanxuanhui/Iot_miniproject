import React, { useState, useEffect, useCallback } from "react";
import TemperatureChart from "./TemperatureChart";
import HumidityChart from "./HumidityChart";
import StatusCard from "./StatusCard";
import { fetchData, searchTemperature } from "../services/api";
import { deleteOldData } from "../services/databaseService";
import { useAuth } from "../contexts/AuthContext";
import TemperatureSearch from "./TemperatureSearch";
import "../styles/Dashboard.css";
import { Link } from "react-router-dom";

const Dashboard = () => {
    const { logout } = useAuth();
    const [data, setData] = useState([]);
    const [latest, setLatest] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [error, setError] = useState(null);
    const [searchResults, setSearchResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchInfo, setSearchInfo] = useState(null);

    const updateData = useCallback(async () => {
        if (isSearching) return; // 如果正在搜索，不更新实时数据

        try {
            const newData = await fetchData();
            
            if (newData && newData.length > 0) {
                // 按时间戳排序，确保最新的数据在最后
                const sortedData = newData.sort((a, b) => a.timestamp - b.timestamp);
                const newLatest = sortedData[sortedData.length - 1];
                
                // 只有当最新数据的时间戳不同时才更新状态
                if (!latest || newLatest.timestamp !== latest.timestamp) {
                    console.log('实时数据已更新:', {
                        新数据: newLatest,
                        时间: new Date(newLatest.timestamp * 1000).toLocaleString('zh-CN')
                    });
                    
                    setData(sortedData);
                    setLatest(newLatest);
                    setLastUpdate(new Date().toLocaleString('zh-CN'));
                    setError(null);
                }
            }
        } catch (err) {
            console.error('更新数据失败:', err);
            setError('获取数据失败，请稍后重试');
        }
    }, [latest, isSearching]);

    useEffect(() => {
        // 组件挂载时立即获取数据
        updateData();
        
        // 设置定时器，每秒更新一次数据
        const interval = setInterval(updateData, 1000);

        // 清理旧数据（保留30天）
        deleteOldData(30).catch(err => {
            console.error('清理旧数据失败:', err);
        });

        // 组件卸载时清理定时器
        return () => clearInterval(interval);
    }, [updateData]);

    const handleSearchResults = async (results) => {
        if (results) {
            setSearchResults(results.data);
            setIsSearching(true);
            setSearchInfo({
                type: results.operator === 'above' ? 'above' : 'below',
                threshold: results.threshold,
                count: results.total
            });
        } else {
            handleClearSearch();
        }
    };

    const handleClearSearch = () => {
        setSearchResults(null);
        setIsSearching(false);
        setSearchInfo(null);
        updateData(); // Clear search and update data immediately
    };

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>ESP32 Monitoring System</h1>
                <div className="header-actions">
                    <Link to="/temperature-search" className="search-link">
                        Temperature Search
                    </Link>
                    <button onClick={logout} className="logout-button">
                        Logout
                    </button>
                </div>
            </div>

            <div className="data-status">
                <div className="update-info">
                    <span>Last Update: {lastUpdate || '--'}</span>
                    {error && (
                        <span className="error-message">
                            Failed to fetch data. Please try again later.
                        </span>
                    )}
                    {searchInfo && (
                        <span className="search-status">
                            Currently showing: {searchInfo.count} records {searchInfo.type} {searchInfo.threshold}°C
                        </span>
                    )}
                </div>
            </div>
            
            <div className="dashboard-grid">
                <StatusCard latest={latest} />
                <TemperatureSearch 
                    onSearchResults={handleSearchResults} 
                    onClear={handleClearSearch}
                />
                <div className="charts-row">
                    <div className="chart-wrapper">
                        <TemperatureChart 
                            data={searchResults || data} 
                            isSearching={isSearching}
                        />
                    </div>
                    <div className="chart-wrapper">
                        <HumidityChart 
                            data={searchResults || data}
                            isSearching={isSearching}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
