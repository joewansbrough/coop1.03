'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import StatCard from '../../../components/StatCard';
import { useTransactions, useUser } from '../../../hooks/useCoopData';
import type { Transaction } from '../../../types';

export default function AdminReportsPage() {
  const { data: user } = useUser();
  const { data: transactions = [], isLoading: isTransactionsLoading } = useTransactions();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isAdmin = !!user?.isAdmin;
  const tenantId = user?.tenantId ?? null;
  const myTransactions = useMemo(() => {
    if (!tenantId) return [];
    return transactions
      .filter(tx => tx.tenantId === tenantId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, tenantId]);

  const coopIncome = useMemo(() => {
    return transactions.reduce((sum, tx) => {
      if (tx.direction === 'DEBIT' && tx.status === 'PAID') {
        return sum + tx.amount;
      }
      return sum;
    }, 0);
  }, [transactions]);

  const chartData = useMemo(() => [
    { name: 'Income', amount: coopIncome, fill: '#10b981' },
    { name: 'Budget', amount: 0, fill: '#3b82f6' },
    { name: 'Expenses', amount: 0, fill: '#f43f5e' },
  ], [coopIncome]);

  const pieData = useMemo(() => [
    { name: 'Housing Charges', value: coopIncome > 0 ? 100 : 0, fill: '#10b981' },
    { name: 'Maintenance Fees', value: 0, fill: '#3b82f6' },
    { name: 'Parking/Misc', value: 0, fill: '#f59e0b' },
  ], [coopIncome]);

  const createTransaction = useMutation<Transaction, Error, {
    amount: number;
    currency: string;
    type: string;
    description: string;
    direction?: 'DEBIT' | 'CREDIT';
    status?: 'PENDING' | 'PAID' | 'FAILED';
  }>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData?.error ?? 'Unable to record transaction');
      }
      return res.json();
    },
    onSuccess: () => {
      setStatusMessage('Payment recorded in the ledger.');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error) => {
      setStatusMessage(error.message || 'Payment could not be recorded.');
    }
  });

  const handlePayment = () => {
    if (createTransaction.isLoading || user?.isGuest || !tenantId) return;
    setStatusMessage(null);
    createTransaction.mutate({
      amount: 250,
      currency: 'cad',
      type: 'Housing Payment',
      description: 'Manual payment recorded through portal',
      direction: 'CREDIT',
      status: 'PAID',
    });
  };

  const paymentDisabled = createTransaction.isLoading || user?.isGuest || !tenantId;

  if (!user) return null;

  return (
    <div className="space-y-6 pb-12 transition-colors duration-200 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Association Ledger</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Secure financial tracking for {isAdmin ? 'the co-operative' : 'your residence'}.</p>
        </div>
        <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'overview' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
            >
              Executive Summary
            </button>
          )}
          <button 
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'ledger' ? (activeTab === 'ledger' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400' : '') : 'text-slate-600 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
          >
            Personal Ledger
          </button>
        </div>
      </div>

      {activeTab === 'overview' && isAdmin ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard label="Total Revenue (Monthly)" value={`$${coopIncome.toLocaleString()}`} icon="fa-sack-dollar" color="bg-emerald-500" />
            <StatCard label="Projected Burn" value="$0" icon="fa-file-invoice-dollar" color="bg-rose-500" />
            <StatCard label="Reserve Health" value="Stable" icon="fa-vault" color="bg-blue-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-50 dark:border-white/5 pb-4">Revenue Performance</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-5" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontStyle="bold" />
                    <YAxis axisLine={false} tickLine={false} fontSize={10} />
                    <Tooltip cursor={{fill: '#f8fafc', opacity: 0.1}} contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#0f172a', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: '900' }} />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-50 dark:border-white/5 pb-4">Allocation Breakdown</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={{fontSize: 8, fontWeight: 'bold'}} paddingAngle={4}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#0f172a' }} itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: '900' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-[10rem] pointer-events-none dark:text-white"><i className="fa-solid fa-piggy-bank"></i></div>
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-3xl border border-emerald-50 dark:border-emerald-900">
                <i className="fa-solid fa-receipt"></i>
              </div>
              <div>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white">Balance: $0.00</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight mt-1">Next Settlement: <span className="text-emerald-600 dark:text-emerald-400">Apr 01, 2026</span></p>
              </div>
            </div>
            <button 
              onClick={handlePayment}
              disabled={paymentDisabled}
              className={`w-full md:w-auto px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
                paymentDisabled ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {createTransaction.isLoading ? 'Processing...' : 'Submit Payment'}
            </button>
            {statusMessage && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-300 font-bold uppercase tracking-tight mt-2">
                {statusMessage}
              </p>
            )}
            {isTransactionsLoading && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-tight mt-2">
                Loading ledger entries…
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <h4 className="font-black text-slate-800 dark:text-white text-xs uppercase tracking-widest">Historical Settlements</h4>
              <button className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900 px-4 py-2 rounded-xl transition-all uppercase tracking-widest">Download PDF Summary</button>
            </div>

            <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/5">
              {myTransactions.length > 0 ? myTransactions.map(t => (
                <div key={t.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">{t.type}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-0.5">{t.description}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{new Date(t.date).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-black text-slate-900 dark:text-white shrink-0">${t.amount.toFixed(2)}</span>
                </div>
              )) : (
                <div className="px-6 py-12 text-center text-slate-400 text-xs italic">No transactions found.</div>
              )}
            </div>

            <table className="hidden sm:table w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Effective Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {myTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-bold">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200 font-black">{t.type}</td>
                    <td className="px-6 py-4 text-[10px] text-slate-400 font-black uppercase">{t.description}</td>
                    <td className="px-8 py-4 text-sm text-slate-900 dark:text-white font-black text-right">${t.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
