import { useState } from "react";
import { api } from "../../lib/api";

interface Tooth {
    code: string;
    label: string;
}

// FDI Notation for permanent teeth
const upperArch: Tooth[] = [
    { code: "18", label: "18" }, { code: "17", label: "17" }, { code: "16", label: "16" }, { code: "15", label: "15" }, { code: "14", label: "14" }, { code: "13", label: "13" }, { code: "12", label: "12" }, { code: "11", label: "11" },
    { code: "21", label: "21" }, { code: "22", label: "22" }, { code: "23", label: "23" }, { code: "24", label: "24" }, { code: "25", label: "25" }, { code: "26", label: "26" }, { code: "27", label: "27" }, { code: "28", label: "28" }
];

const lowerArch: Tooth[] = [
    { code: "48", label: "48" }, { code: "47", label: "47" }, { code: "46", label: "46" }, { code: "45", label: "45" }, { code: "44", label: "44" }, { code: "43", label: "43" }, { code: "42", label: "42" }, { code: "41", label: "41" },
    { code: "31", label: "31" }, { code: "32", label: "32" }, { code: "33", label: "33" }, { code: "34", label: "34" }, { code: "35", label: "35" }, { code: "36", label: "36" }, { code: "37", label: "37" }, { code: "38", label: "38" }
];

interface Props {
    patientId: string;
    chart: any;
    onUpdate: () => void;
}

export function DentalChart({ patientId, chart, onUpdate }: Props) {
    const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
    const [findingType, setFindingType] = useState("");
    const [status, setStatus] = useState("present");
    const [saving, setSaving] = useState(false);

    const getToothStatus = (code: string) => {
        const record = chart?.toothRecords?.find((t: any) => t.toothCode === code);
        return record?.status || "present";
    };

    const getToothFindings = (code: string) => {
        return chart?.dentalFindings?.filter((f: any) => f.toothCode === code && f.status === "active") || [];
    };

    const handleToothClick = (code: string) => {
        setSelectedTooth(code);
        setStatus(getToothStatus(code));
    };

    const handleSaveTooth = async () => {
        if (!selectedTooth) return;
        setSaving(true);
        try {
            await api.dentalCharts.updateTooth(chart.id, selectedTooth, { status });
            onUpdate();
            setSelectedTooth(null);
        } catch (error) {
            console.error(error);
            alert("Failed to update tooth");
        } finally {
            setSaving(false);
        }
    };

    const getToothColor = (statusCode: string) => {
        switch (statusCode) {
            case "missing": return "bg-gray-200 text-gray-500 line-through";
            case "extracted": return "bg-red-100 text-red-600 line-through";
            case "implant": return "bg-blue-100 text-blue-800 border-blue-400 border-2";
            case "crown": return "bg-purple-100 text-purple-800 border-purple-400 border-2";
            default: return "bg-white text-gray-800 hover:bg-blue-50";
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <span className="text-2xl">🦷</span> Odontogram (FDI)
            </h2>

            {/* Chart Grid */}
            <div className="flex flex-col gap-8 mb-8 items-center">
                {/* Upper Arch */}
                <div className="flex flex-col gap-2">
                    <div className="text-center text-sm font-medium text-gray-500 mb-1">Upper Arch</div>
                    <div className="flex justify-center gap-1">
                        <div className="flex gap-1 pr-4 border-r-2 border-gray-300">
                            {upperArch.slice(0, 8).map(t => (
                                <ToothBox 
                                    key={t.code} 
                                    tooth={t} 
                                    status={getToothStatus(t.code)} 
                                    findings={getToothFindings(t.code)}
                                    selected={selectedTooth === t.code}
                                    color={getToothColor(getToothStatus(t.code))}
                                    onClick={() => handleToothClick(t.code)} 
                                />
                            ))}
                        </div>
                        <div className="flex gap-1 pl-4">
                            {upperArch.slice(8).map(t => (
                                <ToothBox 
                                    key={t.code} 
                                    tooth={t} 
                                    status={getToothStatus(t.code)} 
                                    findings={getToothFindings(t.code)}
                                    selected={selectedTooth === t.code}
                                    color={getToothColor(getToothStatus(t.code))}
                                    onClick={() => handleToothClick(t.code)} 
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Lower Arch */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-center gap-1">
                        <div className="flex gap-1 pr-4 border-r-2 border-gray-300">
                            {lowerArch.slice(0, 8).map(t => (
                                <ToothBox 
                                    key={t.code} 
                                    tooth={t} 
                                    status={getToothStatus(t.code)} 
                                    findings={getToothFindings(t.code)}
                                    selected={selectedTooth === t.code}
                                    color={getToothColor(getToothStatus(t.code))}
                                    onClick={() => handleToothClick(t.code)} 
                                />
                            ))}
                        </div>
                        <div className="flex gap-1 pl-4">
                            {lowerArch.slice(8).map(t => (
                                <ToothBox 
                                    key={t.code} 
                                    tooth={t} 
                                    status={getToothStatus(t.code)} 
                                    findings={getToothFindings(t.code)}
                                    selected={selectedTooth === t.code}
                                    color={getToothColor(getToothStatus(t.code))}
                                    onClick={() => handleToothClick(t.code)} 
                                />
                            ))}
                        </div>
                    </div>
                    <div className="text-center text-sm font-medium text-gray-500 mt-1">Lower Arch</div>
                </div>
            </div>

            {/* Tooth Editor Modal/Panel */}
            {selectedTooth && (
                <div className="mt-8 p-4 border rounded-lg bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-lg">Edit Tooth {selectedTooth}</h3>
                        <button onClick={() => setSelectedTooth(null)} className="text-gray-400 hover:text-gray-600">×</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tooth Status</label>
                            <select 
                                value={status} 
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm"
                            >
                                <option value="present">Present (Healthy)</option>
                                <option value="missing">Missing</option>
                                <option value="extracted">Extracted</option>
                                <option value="impacted">Impacted</option>
                                <option value="unerupted">Unerupted</option>
                                <option value="root_remnant">Root Remnant</option>
                                <option value="implant">Implant</option>
                                <option value="crown">Crown</option>
                                <option value="bridge_pontic">Bridge Pontic</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                        <button 
                            onClick={() => setSelectedTooth(null)}
                            className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveTooth}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            Save Tooth State
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ToothBox({ tooth, status, findings, selected, color, onClick }: any) {
    const hasFindings = findings && findings.length > 0;
    
    return (
        <div 
            onClick={onClick}
            className={`
                w-10 h-12 flex flex-col items-center justify-center border rounded cursor-pointer transition-all
                ${selected ? 'ring-2 ring-blue-500 shadow-md transform scale-105 z-10' : 'border-gray-300'}
                ${color}
            `}
            title={status !== 'present' ? status : 'Healthy'}
        >
            <span className="font-semibold text-sm">{tooth.label}</span>
            {hasFindings && (
                <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full -mt-1 -mr-1 border-2 border-white shadow-sm"></div>
            )}
        </div>
    );
}
