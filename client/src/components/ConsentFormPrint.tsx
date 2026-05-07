import { useEffect } from "react";
import { format } from "date-fns";

interface Props {
    patient: any;
    procedureName: string;
    onClose: () => void;
}

export default function ConsentFormPrint({ patient, procedureName, onClose }: Props) {
    useEffect(() => {
        setTimeout(() => {
            window.print();
        }, 500);

        const handleAfterPrint = () => onClose();
        window.addEventListener("afterprint", handleAfterPrint);

        return () => window.removeEventListener("afterprint", handleAfterPrint);
    }, [onClose]);

    return (
        <div className="print-only fixed inset-0 bg-white z-[9999] p-8" style={{ width: '100vw', minHeight: '100vh' }}>
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🦷</span> DentalClinic
                    </h1>
                    <p className="text-gray-600 mt-1">123 Health Ave, Medical District</p>
                    <p className="text-gray-600">Phone: (555) 123-4567</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wider mb-2">
                        Consent Form
                    </h2>
                    <p className="text-gray-600 font-medium">
                        Date: {format(new Date(), "MMMM d, yyyy")}
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

            {/* Body */}
            <div className="prose prose-sm max-w-none text-gray-800">
                <h3 className="text-lg font-bold mb-4">Informed Consent for: {procedureName || "Dental Treatment"}</h3>
                
                <p className="mb-4">
                    I, the undersigned, hereby authorize the dentist(s) at DentalClinic and their designated staff to perform the following procedure(s): <strong>{procedureName || "Dental Treatment"}</strong>.
                </p>

                <p className="mb-4">
                    The doctor has explained to me the nature of the condition, the proposed treatment, the anticipated results, and the alternative forms of treatment, including no treatment. 
                    I understand that dentistry is not an exact science and that no specific results can be guaranteed.
                </p>

                <p className="mb-4">
                    I have been informed of the potential risks and complications associated with this procedure, which may include but are not limited to:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-1">
                    <li>Pain, swelling, or discomfort during and after the procedure.</li>
                    <li>Bleeding that may require further treatment.</li>
                    <li>Infection requiring antibiotics or further surgical intervention.</li>
                    <li>Damage to adjacent teeth, restorations, or surrounding tissue.</li>
                    <li>Nerve injury, which could result in temporary or permanent numbness or altered sensation.</li>
                    <li>Need for further unforeseen procedures.</li>
                </ul>

                <p className="mb-8">
                    I have had the opportunity to ask questions regarding the procedure, the risks, and the alternatives, and all of my questions have been answered to my satisfaction. 
                    I voluntarily consent to the administration of any local anesthetics or other medications deemed necessary by the dentist.
                </p>
            </div>

            {/* Signatures */}
            <div className="mt-16 pt-8 border-t border-gray-200 grid grid-cols-2 gap-16">
                <div>
                    <div className="border-t border-gray-800 mt-12 pt-2">
                        <p className="font-bold text-gray-800 text-sm">Patient Signature (or Guardian)</p>
                        <p className="text-gray-500 text-xs mt-1">Date: ________________</p>
                    </div>
                </div>
                <div>
                    <div className="border-t border-gray-800 mt-12 pt-2">
                        <p className="font-bold text-gray-800 text-sm">Doctor Signature</p>
                        <p className="text-gray-500 text-xs mt-1">Date: ________________</p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="fixed bottom-8 left-8 right-8 text-center text-sm text-gray-400 border-t border-gray-100 pt-4">
                This document is generated automatically by DentalClinic. Original copy to be kept in patient records.
            </div>
        </div>
    );
}
