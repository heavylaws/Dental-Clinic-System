import { useEffect } from "react";
import { format } from "date-fns";

interface Props {
    patient: any;
    plan: any;
    onClose: () => void;
}

export default function TreatmentPlanPrint({ patient, plan, onClose }: Props) {
    useEffect(() => {
        // Automatically open the print dialog when the component mounts
        setTimeout(() => {
            window.print();
        }, 500);

        // Listen for the print dialog to close, then trigger onClose
        const handleAfterPrint = () => onClose();
        window.addEventListener("afterprint", handleAfterPrint);

        return () => window.removeEventListener("afterprint", handleAfterPrint);
    }, [onClose]);

    const formatCurrency = (val: string | number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(val));
    };

    return (
        <div className="print-only fixed inset-0 bg-white z-[9999] p-8" style={{ width: '100vw', minHeight: '100vh' }}>
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🦷</span> DentalClinic
                    </h1>
                    <p className="text-gray-600 mt-1">123 Health Ave, Medical District</p>
                    <p className="text-gray-600">Phone: (555) 123-4567</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wider mb-2">
                        Treatment Plan
                    </h2>
                    <p className="text-gray-600 font-medium">
                        Date: {format(new Date(), "MMMM d, yyyy")}
                    </p>
                    <p className="text-gray-600 font-medium">
                        Plan ID: #{plan.id.toString().padStart(6, '0')}
                    </p>
                </div>
            </div>

            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-8 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Patient Name</p>
                    <p className="text-xl font-bold text-gray-900">{patient.firstName} {patient.lastName}</p>
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Patient ID</p>
                    <p className="text-xl font-bold text-gray-900">{patient.fileNumber}</p>
                </div>
            </div>

            {/* Plan Details */}
            <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Plan: {plan.title}</h3>
                <p className="text-gray-600">This document outlines the recommended dental procedures, their estimated costs, and tooth locations.</p>
            </div>

            {/* Table */}
            <table className="w-full text-left border-collapse mb-8">
                <thead>
                    <tr className="border-b-2 border-gray-300">
                        <th className="py-3 px-4 font-bold text-gray-700 uppercase text-sm w-16">Tooth</th>
                        <th className="py-3 px-4 font-bold text-gray-700 uppercase text-sm">Procedure</th>
                        <th className="py-3 px-4 font-bold text-gray-700 uppercase text-sm text-right w-32">Est. Cost</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {plan.items?.map((item: any, index: number) => (
                        <tr key={index}>
                            <td className="py-4 px-4 font-medium text-gray-900">{item.toothCode || "N/A"}</td>
                            <td className="py-4 px-4">
                                <p className="font-medium text-gray-900">{item.procedureName}</p>
                                {item.procedureCode && <p className="text-sm text-gray-500">{item.procedureCode}</p>}
                            </td>
                            <td className="py-4 px-4 text-right font-medium text-gray-900">
                                {formatCurrency(item.estimatedCost)}
                            </td>
                        </tr>
                    ))}
                    {(!plan.items || plan.items.length === 0) && (
                        <tr>
                            <td colSpan={3} className="py-8 text-center text-gray-500">
                                No procedures listed in this plan.
                            </td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-gray-800">
                        <td colSpan={2} className="py-4 px-4 text-right font-bold text-gray-900">
                            Total Estimated Cost:
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-gray-900 text-lg">
                            {formatCurrency(plan.totalEstimatedCost || 0)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            {/* Signatures */}
            <div className="mt-16 pt-8 border-t border-gray-200 grid grid-cols-2 gap-16">
                <div>
                    <p className="text-xs text-gray-500 mb-8 leading-relaxed">
                        I understand that this is an estimate and actual costs or treatments may change based on clinical findings during the procedure.
                    </p>
                    <div className="border-t border-gray-800 mt-12 pt-2">
                        <p className="font-bold text-gray-800 text-sm">Patient Signature</p>
                        <p className="text-gray-500 text-xs mt-1">Date: ________________</p>
                    </div>
                </div>
                <div>
                    <div className="border-t border-gray-800 mt-20 pt-2">
                        <p className="font-bold text-gray-800 text-sm">Doctor Signature</p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="fixed bottom-8 left-8 right-8 text-center text-sm text-gray-400 border-t border-gray-100 pt-4">
                This document is generated automatically by DentalClinic. Not valid without signature.
            </div>
        </div>
    );
}
