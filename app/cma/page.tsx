'use client';

export default function CMABuilder() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold mb-2">CMA Builder</h1>
      <p className="text-gray-600 mb-8">Smart Comparable Market Analysis using real Navica data</p>

      <div className="bg-white border border-gray-200 rounded-3xl p-8">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold mb-2">CMA Tool Coming Soon</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            This section will allow you to generate professional CMAs with smart comp selection, 
            adjustments, and one-click PDF export.
          </p>
          <button className="mt-6 px-6 py-3 bg-black text-white rounded-2xl text-sm font-medium">
            Start New CMA
          </button>
        </div>
      </div>
    </div>
  );
}
