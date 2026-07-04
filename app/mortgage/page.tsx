'use client';

import React, { useState, useEffect } from 'react';

export default function MortgageCalculator() {
  const [loanAmount, setLoanAmount] = useState(450000);
  const [downPayment, setDownPayment] = useState(90000);
  const [interestRate, setInterestRate] = useState(6.75);
  const [loanTerm, setLoanTerm] = useState(30);

  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [totalPayment, setTotalPayment] = useState(0);
  const [totalInterest, setTotalInterest] = useState(0);

  const principal = loanAmount - downPayment;

  useEffect(() => {
    if (principal > 0 && interestRate > 0 && loanTerm > 0) {
      const monthlyRate = interestRate / 100 / 12;
      const numberOfPayments = loanTerm * 12;

      const payment =
        (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
        (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

      const total = payment * numberOfPayments;
      const interest = total - principal;

      setMonthlyPayment(Math.round(payment));
      setTotalPayment(Math.round(total));
      setTotalInterest(Math.round(interest));
    }
  }, [loanAmount, downPayment, interestRate, loanTerm]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Mortgage Calculator</h1>
        <p className="text-gray-600 mt-1">Quick estimates for Jefferson County purchases</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Inputs */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-3xl p-8">
          <div className="space-y-8">
            
            {/* Loan Amount */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Purchase Price</label>
                <span className="text-sm font-semibold">{formatCurrency(loanAmount)}</span>
              </div>
              <input
                type="range"
                min="150000"
                max="1200000"
                step="10000"
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="w-full accent-black"
              />
              <input
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="mt-2 w-full border border-gray-300 rounded-2xl px-4 py-2 text-sm"
              />
            </div>

            {/* Down Payment */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Down Payment</label>
                <span className="text-sm font-semibold">{formatCurrency(downPayment)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={loanAmount * 0.5}
                step="5000"
                value={downPayment}
                onChange={(e) => setDownPayment(Number(e.target.value))}
                className="w-full accent-black"
              />
              <div className="flex gap-2 mt-2">
                <input
                  type="number"
                  value={downPayment}
                  onChange={(e) => setDownPayment(Number(e.target.value))}
                  className="flex-1 border border-gray-300 rounded-2xl px-4 py-2 text-sm"
                />
                <div className="px-4 py-2 bg-gray-100 rounded-2xl text-sm flex items-center">
                  {((downPayment / loanAmount) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Interest Rate */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Interest Rate</label>
                <span className="text-sm font-semibold">{interestRate}%</span>
              </div>
              <input
                type="range"
                min="3"
                max="9"
                step="0.125"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full accent-black"
              />
              <input
                type="number"
                step="0.125"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="mt-2 w-full border border-gray-300 rounded-2xl px-4 py-2 text-sm"
              />
            </div>

            {/* Loan Term */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Loan Term</label>
                <span className="text-sm font-semibold">{loanTerm} years</span>
              </div>
              <div className="flex gap-3">
                {[15, 20, 30].map((term) => (
                  <button
                    key={term}
                    onClick={() => setLoanTerm(term)}
                    className={`flex-1 py-3 rounded-2xl text-sm font-medium border transition ${
                      loanTerm === term 
                        ? 'bg-black text-white border-black' 
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {term} years
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 bg-black text-white rounded-3xl p-8 flex flex-col">
          <div className="text-sm uppercase tracking-widest text-gray-400 mb-2">Estimated Monthly Payment</div>
          <div className="text-6xl font-semibold tracking-tighter mb-8">
            {formatCurrency(monthlyPayment)}
          </div>

          <div className="space-y-4 text-sm flex-1">
            <div className="flex justify-between py-3 border-b border-white/20">
              <span className="text-gray-400">Loan Amount</span>
              <span className="font-medium">{formatCurrency(principal)}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/20">
              <span className="text-gray-400">Total of Payments</span>
              <span className="font-medium">{formatCurrency(totalPayment)}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/20">
              <span className="text-gray-400">Total Interest</span>
              <span className="font-medium text-red-400">{formatCurrency(totalInterest)}</span>
            </div>
          </div>

          <div className="mt-auto pt-6 text-xs text-gray-400">
            * Estimates only. Actual rates and payments may vary. Consult your lender.
          </div>
        </div>

      </div>
    </div>
  );
}
