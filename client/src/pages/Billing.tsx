import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";

function getGmtDateString() {
    return new Date().toISOString().split("T")[0];
}

export default function Billing() {
    const [startDate, setStartDate] = useState(getGmtDateString());
    const [endDate, setEndDate] = useState(getGmtDateString());
    const navigate = useNavigate();

    const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: api.auth.me });

    const balancesQuery = useQuery({
        queryKey: ["ledger", "patients"],
        queryFn: () => api.ledger.patients(),
    });

    const { data: billingData, isLoading } = useQuery({
        queryKey: ["billing", startDate, endDate],
        queryFn: () => api.billing.get(startDate, endDate),
        refetchInterval: 30000,
    });

    const agingQuery = useQuery({
        queryKey: ["ledger", "aging"],
        queryFn: () => api.ledger.aging(),
        refetchInterval: 60000,
    });

    if (isLoading && !billingData) {
        return (
            <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const { items = [], totalBilled = 0, totalPaid = 0, outstanding = 0 } = billingData || {};

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900">💰 Billing Overview</h1>

                <div className="flex items-center gap-4">
                    {user?.role === "admin" && (
                        <a
                            href={`/api/reports/export/billing?startDate=${startDate}&endDate=${endDate}`}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-xl hover:bg-emerald-100 transition border border-emerald-200 shadow-sm"
                            title="Export to CSV"
                        >
                            <span className="text-xl">📥</span>
                            <span className="hidden sm:inline">Export CSV</span>
                        </a>
                    )}
                    {/* ─── Date Filter ─── */}
                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="border-none bg-transparent font-medium text-gray-700 outline-none cursor-pointer"
                        />
                        <span className="text-gray-400">→</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="border-none bg-transparent font-medium text-gray-700 outline-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* ─── Summary ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 md:gap-0">
                <div className="text-center md:text-left">
                    <p className="text-gray-500 font-medium uppercase tracking-wide text-sm mb-1">Total Billed</p>
                    <p className="text-4xl font-extrabold text-gray-900">${Number(totalBilled).toLocaleString()}</p>
                </div>
                <div className="hidden md:block h-12 w-[1px] bg-gray-200"></div>
                <div className="text-center md:text-left">
                    <p className="text-gray-500 font-medium uppercase tracking-wide text-sm mb-1">Total Collected</p>
                    <p className="text-4xl font-extrabold text-accent-600">${Number(totalPaid).toLocaleString()}</p>
                </div>
                <div className="hidden md:block h-12 w-[1px] bg-gray-200"></div>
                <div className="text-center md:text-left">
                    <p className="text-gray-500 font-medium uppercase tracking-wide text-sm mb-1">Outstanding</p>
                    <p className="text-4xl font-extrabold text-danger-600">${Number(outstanding).toLocaleString()}</p>
                </div>
            </div>

            {/* ─── Aging Summary (Phase 6D1) ───────────────────────────── */}
            {agingQuery.isLoading ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex items-center gap-3 text-gray-500">
                        <div className="animate-spin h-5 w-5 border-b-2 border-gray-600"></div>
                        <span>Loading aging report...</span>
                    </div>
                </div>
            ) : agingQuery.isError ? (
                <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6 mb-8 text-red-600">
                    Unable to load aging report.
                </div>
            ) : agingQuery.data && agingQuery.data.patients.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Aging Summary</h2>
                            <p className="text-sm text-gray-500">
                                As of {new Date(agingQuery.data.asOf).toLocaleString()} · {agingQuery.data.totals.patientCount} patients · {agingQuery.data.totals.overduePatientCount} overdue
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Total Outstanding</p>
                            <p className="text-2xl font-extrabold text-gray-900">${agingQuery.data.totals.totalBalance.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                            <p className="text-xs font-semibold text-emerald-600 uppercase mb-1">0–30 Days</p>
                            <p className="text-xl font-bold text-emerald-700">${agingQuery.data.totals.current.toLocaleString()}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                            <p className="text-xs font-semibold text-amber-600 uppercase mb-1">31–60 Days</p>
                            <p className="text-xl font-bold text-amber-700">${agingQuery.data.totals.days31to60.toLocaleString()}</p>
                        </div>
                        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                            <p className="text-xs font-semibold text-orange-600 uppercase mb-1">61–90 Days</p>
                            <p className="text-xl font-bold text-orange-700">${agingQuery.data.totals.days61to90.toLocaleString()}</p>
                        </div>
                        <div className="bg-rose-50 rounded-xl p-4 border border-rose-200">
                            <p className="text-xs font-semibold text-rose-600 uppercase mb-1">90+ Days</p>
                            <p className="text-xl font-bold text-rose-700">${agingQuery.data.totals.over90.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Aging Patient Table (Phase 6D1) ─────────────────────── */}
            {agingQuery.data && agingQuery.data.patients.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-bold text-gray-900">Aging by Patient</h2>
                        <p className="text-sm text-gray-500">Click a patient to view their account ledger</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600">Patient</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-right">Total Balance</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-right">0–30</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-right">31–60</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-right">61–90</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-right">90+</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600">Oldest Unpaid</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600">Last Payment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {agingQuery.data.patients.map((patient: any) => (
                                    <tr
                                        key={patient.patientId}
                                        className="hover:bg-gray-50 transition cursor-pointer"
                                        onClick={() => navigate(`/patient/${patient.patientId}`)}
                                    >
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-900">{patient.patientName}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${patient.totalBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                ${patient.totalBalance.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-emerald-600">
                                            {patient.buckets.current > 0 ? `$${patient.buckets.current.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-right text-amber-600">
                                            {patient.buckets.days31to60 > 0 ? `$${patient.buckets.days31to60.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-right text-orange-600">
                                            {patient.buckets.days61to90 > 0 ? `$${patient.buckets.days61to90.toLocaleString()}` : '—'}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-medium ${patient.buckets.over90 > 0 ? 'text-rose-600 bg-rose-50' : ''}`}>
                                            {patient.buckets.over90 > 0 ? `$${patient.buckets.over90.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {patient.oldestUnpaidDate
                                                ? new Date(patient.oldestUnpaidDate).toLocaleDateString()
                                                : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {patient.lastPaymentDate
                                                ? new Date(patient.lastPaymentDate).toLocaleDateString()
                                                : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── Patient Account Balances ───────────────────────────── */}
            {balancesQuery.isLoading ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8 text-center text-gray-500">
                    Loading patient account balances...
                </div>
            ) : balancesQuery.isError ? (
                <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 mb-8 text-center text-red-600">
                    Unable to load patient account balances.
                </div>
            ) : balancesQuery.data && balancesQuery.data.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-bold text-gray-900">Patient Account Balances</h2>
                        <p className="text-sm text-gray-500">Click a patient to view their ledger</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600">Patient</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-right">Total Charged</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-right">Total Paid</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-right">Balance</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-600">Last Activity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {balancesQuery.isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading...</td>
                                    </tr>
                                ) : (
                                    balancesQuery.data
                                        .filter((p: any) => p.balance !== 0 || p.charged > 0) // Show patients with activity
                                        .map((patient: any) => (
                                            <tr
                                                key={patient.patientId}
                                                className="hover:bg-gray-50 transition cursor-pointer"
                                                onClick={() => navigate(`/patient/${patient.patientId}`)}
                                            >
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-gray-900">{patient.patientName}</p>
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-gray-600">
                                                    ${patient.charged.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-emerald-600">
                                                    ${patient.paid.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`font-bold ${patient.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        ${patient.balance.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {patient.lastActivityDate
                                                        ? new Date(patient.lastActivityDate).toLocaleDateString()
                                                        : '—'}
                                                </td>
                                            </tr>
                                        ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── Transactions Table ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-gray-600">Patient</th>
                            <th className="px-6 py-4 font-semibold text-gray-600">Date/Time</th>
                            <th className="px-6 py-4 font-semibold text-gray-600">Status</th>
                            <th className="px-6 py-4 font-semibold text-gray-600 text-right">Amount</th>
                            <th className="px-6 py-4 font-semibold text-gray-600 text-right">Paid</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                    No transactions found for this period
                                </td>
                            </tr>
                        ) : (
                            items.map((item: any) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-gray-900">{item.patientName}</p>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 font-mono text-sm">
                                        {new Date(item.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block
                                            ${item.status === 'paid' ? 'bg-accent-100 text-accent-700' :
                                                item.status === 'partial' ? 'bg-warm-100 text-warm-600' :
                                                    'bg-danger-100 text-danger-600'
                                            }`}
                                        >
                                            {item.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-right">
                                        ${Number(item.totalAmount).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-right text-gray-500">
                                        ${Number(item.paidAmount).toFixed(2)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
