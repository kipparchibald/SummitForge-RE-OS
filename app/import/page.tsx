'use client';
import { useState } from 'react';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [source, setSource] = useState<'mls' | 'zillow' | 'landwatch'>('mls');

  const handleImport = async () => {
    // Call API route or server action with file or url
    alert(`Importing from ${source}... (triggers raw land projections)`);
    // TODO: integrate with lib/import/listings.ts
  };

  return (
    <div>
      <h1>Import New Land Opportunities</h1>
      <select value={source} onChange={e => setSource(e.target.value as any)}>
        <option value="mls">MLS CSV Export</option>
        <option value="zillow">Zillow (paste URL or upload export)</option>
        <option value="landwatch">LandWatch / Lands of America</option>
      </select>
      <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
      <input type="text" placeholder="Paste search or listing URL" value={url} onChange={e => setUrl(e.target.value)} />
      <button onClick={handleImport}>Import & Run Projections</button>
      <p className="text-sm text-gray-500">Raw land listings will automatically trigger lot yield, infra estimates, and IRR projections.</p>
    </div>
  );
}