'use client';
import { useState, useEffect } from 'react';

export default function MonitoringDashboard() {
  const [watchedAreas, setWatchedAreas] = useState([]);
  const [results, setResults] = useState(null);

  useEffect(() => {
    // Fetch watched areas from Supabase
    fetchWatchedAreas();
  }, []);

  const fetchWatchedAreas = async () => {
    // TODO: Supabase query
    setWatchedAreas([{ id: '1', name: 'Teton Heights Area', geometry: '...' }]);
  };

  const checkNow = async (id) => {
    const res = await checkForNewOpportunities(id);
    setResults(res);
  };

  return (
    <div>
      <h1>GIS Monitoring Dashboard</h1>
      <p>Monitor Jefferson County areas for new land opportunities using existing GIS data.</p>
      <ul>
        {watchedAreas.map(area => (
          <li key={area.id}>
            {area.name} <button onClick={() => checkNow(area.id)}>Check Now</button>
          </li>
        ))}
      </ul>
      {results && <pre>{JSON.stringify(results, null, 2)}</pre>}
    </div>
  );
}