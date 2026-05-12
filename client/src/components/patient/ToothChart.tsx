import { useState, useMemo } from "react";

interface Props {
    selectedTooth: string | null;
    onSelectTooth: (tooth: string | null) => void;
    plannedTeeth?: { tooth: string; status: string; count: number }[];
    multiSelect?: boolean;
    selectedTeeth?: string[];
    onSelectTeeth?: (teeth: string[]) => void;
}

// FDI World Dental Federation notation (adult teeth)
// Quadrant 1 (Upper Right): 18-11
// Quadrant 2 (Upper Left): 21-28
// Quadrant 3 (Lower Left): 31-38
// Quadrant 4 (Lower Right): 48-41

const UPPER_RIGHT = ["18", "17", "16", "15", "14", "13", "12", "11"];
const UPPER_LEFT = ["21", "22", "23", "24", "25", "26", "27", "28"];
const LOWER_LEFT = ["31", "32", "33", "34", "35", "36", "37", "38"];
const LOWER_RIGHT = ["48", "47", "46", "45", "44", "43", "42", "41"];

const ALL_TEETH = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_LEFT, ...LOWER_RIGHT];

export const AREA_OPTIONS = [
    { value: "", label: "— Select Area —" },
    { value: "Upper Arch", label: "Upper Arch" },
    { value: "Lower Arch", label: "Lower Arch" },
    { value: "Upper Right", label: "Upper Right" },
    { value: "Upper Left", label: "Upper Left" },
    { value: "Lower Right", label: "Lower Right" },
    { value: "Lower Left", label: "Lower Left" },
    { value: "Full Mouth", label: "Full Mouth" },
    { value: "Anterior", label: "Anterior" },
    { value: "Posterior", label: "Posterior" },
    { value: "Other", label: "Other" },
];

// Procedure presets for quick selection
export const PROCEDURE_PRESETS = [
    { name: "Composite Filling", category: "Restorative", defaultCost: 150 },
    { name: "Root Canal Treatment", category: "Endodontics", defaultCost: 800 },
    { name: "Crown (Porcelain)", category: "Prosthodontics", defaultCost: 1200 },
    { name: "Extraction", category: "Oral Surgery", defaultCost: 200 },
    { name: "Professional Cleaning", category: "Preventive", defaultCost: 120 },
    { name: "Teeth Whitening", category: "Cosmetic", defaultCost: 400 },
    { name: "Dental Implant", category: "Implantology", defaultCost: 3000 },
    { name: "Complete Denture", category: "Prosthodontics", defaultCost: 2500 },
    { name: "Orthodontic Consultation", category: "Orthodontics", defaultCost: 100 },
    { name: "Periodontal Scaling", category: "Periodontics", defaultCost: 250 },
];

export function ToothChart({
    selectedTooth,
    onSelectTooth,
    plannedTeeth = [],
    multiSelect = false,
    selectedTeeth = [],
    onSelectTeeth,
}: Props) {
    const [hoveredTooth, setHoveredTooth] = useState<string | null>(null);

    // Create a map of tooth -> status/count for quick lookup
    const plannedTeethMap = useMemo(() => {
        const map = new Map<string, { status: string; count: number }>();
        plannedTeeth.forEach((pt) => {
            map.set(pt.tooth, { status: pt.status, count: pt.count });
        });
        return map;
    }, [plannedTeeth]);

    const handleToothClick = (tooth: string) => {
        if (multiSelect && onSelectTeeth) {
            const isSelected = selectedTeeth.includes(tooth);
            if (isSelected) {
                onSelectTeeth(selectedTeeth.filter((t) => t !== tooth));
            } else {
                onSelectTeeth([...selectedTeeth, tooth]);
            }
        } else {
            if (selectedTooth === tooth) {
                onSelectTooth(null);
            } else {
                onSelectTooth(tooth);
            }
        }
    };

    const getToothStatusColor = (tooth: string): string => {
        const planned = plannedTeethMap.get(tooth);
        if (!planned) return "";

        switch (planned.status) {
            case "proposed":
                return "bg-yellow-200 border-yellow-400";
            case "accepted":
                return "bg-emerald-200 border-emerald-400";
            case "completed":
                return "bg-blue-200 border-blue-400";
            case "declined":
            case "cancelled":
                return "bg-gray-200 border-gray-400";
            default:
                return "bg-gray-100 border-gray-300";
        }
    };

    const isSelected = (tooth: string): boolean => {
        if (multiSelect) {
            return selectedTeeth.includes(tooth);
        }
        return selectedTooth === tooth;
    };

    const ToothButton = ({ tooth, isLower = false }: { tooth: string; isLower?: boolean }) => {
        const selected = isSelected(tooth);
        const planned = plannedTeethMap.get(tooth);
        const statusColor = getToothStatusColor(tooth);

        return (
            <button
                type="button"
                onClick={() => handleToothClick(tooth)}
                onMouseEnter={() => setHoveredTooth(tooth)}
                onMouseLeave={() => setHoveredTooth(null)}
                className={`
                    relative w-10 h-10 md:w-12 md:h-12 rounded-full border-2 font-semibold text-xs md:text-sm
                    transition-all duration-150 flex items-center justify-center
                    ${selected
                        ? "bg-primary-500 text-white border-primary-600 shadow-md scale-110"
                        : "bg-white text-gray-700 border-gray-300 hover:border-primary-400 hover:bg-primary-50"
                    }
                    ${statusColor && !selected ? statusColor : ""}
                    ${hoveredTooth === tooth && !selected ? "ring-2 ring-primary-200" : ""}
                `}
                title={`Tooth ${tooth}${planned ? ` (${planned.count} item${planned.count > 1 ? "s" : ""})` : ""}`}
            >
                {tooth}
                {planned && planned.count > 1 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                        {planned.count}
                    </span>
                )}
            </button>
        );
    };

    const ToothRow = ({ teeth, isLower = false }: { teeth: string[]; isLower?: boolean }) => (
        <div className="flex gap-1 md:gap-2 justify-center">
            {teeth.map((tooth) => (
                <ToothButton key={tooth} tooth={tooth} isLower={isLower} />
            ))}
        </div>
    );

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-4 justify-center">
                <span className="font-medium">Plan markers:</span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-yellow-200 border border-yellow-400"></span>
                    Proposed
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-emerald-200 border border-emerald-400"></span>
                    Accepted
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-200 border border-blue-400"></span>
                    Completed
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-gray-200 border border-gray-400"></span>
                    Declined
                </span>
            </div>

            {/* Chart */}
            <div className="space-y-3">
                {/* Upper arch label */}
                <div className="text-center text-xs text-gray-500 font-medium uppercase tracking-wider">
                    Upper Arch (Right → Left)
                </div>

                {/* Upper Right */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8 text-right">UR</span>
                    <ToothRow teeth={UPPER_RIGHT} />
                </div>

                {/* Upper Left */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8 text-right">UL</span>
                    <ToothRow teeth={UPPER_LEFT} />
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-200 my-2"></div>

                {/* Lower Left */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8 text-right">LL</span>
                    <ToothRow teeth={LOWER_LEFT} />
                </div>

                {/* Lower Right */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8 text-right">LR</span>
                    <ToothRow teeth={LOWER_RIGHT} />
                </div>

                {/* Lower arch label */}
                <div className="text-center text-xs text-gray-500 font-medium uppercase tracking-wider">
                    Lower Arch (Left → Right)
                </div>
            </div>

            {/* Notation explanation */}
            <div className="mt-4 text-xs text-gray-500 text-center">
                FDI World Dental Federation notation • {" "}
                {selectedTooth ? `Selected: Tooth ${selectedTooth}` : multiSelect ? `${selectedTeeth.length} teeth selected` : "Click a tooth to select"}
            </div>
        </div>
    );
}

// Helper function to get teeth for an area
export function getTeethForArea(area: string): string[] {
    switch (area) {
        case "Upper Arch":
            return [...UPPER_RIGHT, ...UPPER_LEFT];
        case "Lower Arch":
            return [...LOWER_LEFT, ...LOWER_RIGHT];
        case "Upper Right":
            return [...UPPER_RIGHT];
        case "Upper Left":
            return [...UPPER_LEFT];
        case "Lower Right":
            return [...LOWER_RIGHT];
        case "Lower Left":
            return [...LOWER_LEFT];
        case "Full Mouth":
            return [...ALL_TEETH];
        case "Anterior":
            return ["13", "12", "11", "21", "22", "23", "43", "42", "41", "31", "32", "33"];
        case "Posterior":
            return ["18", "17", "16", "15", "14", "24", "25", "26", "27", "28",
                    "38", "37", "36", "35", "34", "44", "45", "46", "47", "48"];
        default:
            return [];
    }
}

// Helper to validate if a string is a valid FDI tooth number
export function isValidTooth(tooth: string): boolean {
    return ALL_TEETH.includes(tooth);
}

export default ToothChart;
