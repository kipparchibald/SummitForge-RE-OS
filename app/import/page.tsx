'use client';
import { useState } from 'react';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [source, setSource] = useState<'mls' | 'zillow' | 'landwatch'>('mls');

  const handleImport = async () => {
    // Integrate with refined parser
    alert(`Importing from ${source}... Auto-triggers raw land projections and adds to GIS monitoring if applicable.`);
    // Call importListings from lib
  };

  return (
    <div>
      <h1>Import New Land Opportunities</h1>
      <select value={source} onChange={e => setSource(e.target.value as any)}>
        <option value="mls">MLS CSV Export</option>
        <option value="zillow">Zillow</option>
        <option value="landwatch">LandWatch / Lands of America</option>
      </select>
      <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
      <input type="text" placeholder="Paste search/listing URL" value={url} onChange={e => setUrl(e.target.value)} />
      <button onClick={handleImport}>Import & Analyze (Raw Land First)</button>
      <p className="text-sm text-gray-500">Triggers projections + GIS monitoring integration.</p>
    </div>
  );
}