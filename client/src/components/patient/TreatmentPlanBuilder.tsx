import { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api";
import ToothChart, { AREA_OPTIONS, PROCEDURE_PRESETS } from "./ToothChart";

interface Props {
    patientId: string;
}

type PlanStatus = "draft" | "presented" | "accepted" | "partially_accepted" | "declined" | "completed" | "cancelled";
type ItemStatus = "proposed" | "accepted" | "declined" | "completed" | "cancelled";
type Priority = "low" | "medium" | "high" | "urgent";

interface TreatmentPlanItem {
    id: string;
    planId: string;
    patientId: string;
    tooth?: string | null;
    area?: string | null;
    procedureName: string;
    category?: string | null;
    description?: string;
    estimatedCost: number;
    priority: Priority;
    status: ItemStatus;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    // Phase 7C: Conversion tracking
    convertedAt?: string | null;
    convertedVisitId?: string | null;
    convertedBillingId?: string | null;
}

interface PlanSummary {
    itemCount: number;
    proposedTotal: number;
    acceptedTotal: number;
    completedTotal: number;
    declinedTotal: number;
    remainingAcceptedTotal: number;
}

interface TreatmentPlanData {
    plan: {
        id: string;
        patientId: string;
        title: string;
        description?: string;
        status: PlanStatus;
        createdAt: string;
        updatedAt: string;
    };
    items: TreatmentPlanItem[];
    summary: PlanSummary;
}

interface TreatmentPlansResponse {
    patientId: string;
    patientName: string;
    plans: TreatmentPlanData[];
}

export function TreatmentPlanBuilder({ patientId }: Props) {
    const [plansData, setPlansData] = useState<TreatmentPlansResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
    const [presentationMode, setPresentationMode] = useState(false);

    useEffect(() => {
        loadPlans();
    }, [patientId]);

    const loadPlans = async () => {
        try {
            const data = await api.treatmentPlans.patient(patientId);
            setPlansData(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const createPlan = async () => {
        const title = prompt("Enter a title for the new treatment plan (e.g., 'Phase 1 Restorative')");
        if (!title || title.trim() === "") {
            alert("Title is required");
            return;
        }

        try {
            await api.treatmentPlans.create(patientId, { title: title.trim() });
            loadPlans();
        } catch (error: any) {
            alert(error?.message || "Failed to create plan");
        }
    };

    if (loading) return <div className="p-4 text-gray-500">Loading treatment plans...</div>;

    const plans = plansData?.plans || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        📋 Treatment Plans
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Treatment plan estimates do NOT affect the patient ledger until converted to billing.
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                        Accepted treatment is not automatically billed.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {plans.length > 0 && (
                        <button
                            onClick={() => setPresentationMode(!presentationMode)}
                            className={`px-3 py-2 text-sm rounded-md font-medium transition ${
                                presentationMode
                                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            {presentationMode ? "🖥️ Exit Presentation" : "🖥️ Presentation Mode"}
                        </button>
                    )}
                    {!presentationMode && (
                        <button
                            onClick={createPlan}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 shadow-sm font-medium"
                        >
                            + New Plan
                        </button>
                    )}
                </div>
            </div>

            {plans.length === 0 ? (
                <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 border border-gray-200 border-dashed">
                    <p className="text-4xl mb-3">📋</p>
                    <p className="font-medium">No treatment plans yet</p>
                    <p className="text-sm mt-1">Click "New Plan" to create a treatment plan</p>
                </div>
            ) : (
                <div className={`space-y-4 ${presentationMode ? "max-w-4xl mx-auto" : ""}`}>
                    {plans.map((planData) => (
                        <TreatmentPlanCard
                            key={planData.plan.id}
                            planData={planData}
                            expanded={expandedPlanId === planData.plan.id}
                            onToggle={() => setExpandedPlanId(expandedPlanId === planData.plan.id ? null : planData.plan.id)}
                            onUpdate={loadPlans}
                            presentationMode={presentationMode}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function TreatmentPlanCard({
    planData,
    expanded,
    onToggle,
    onUpdate,
    presentationMode = false,
}: {
    planData: TreatmentPlanData;
    expanded: boolean;
    onToggle: () => void;
    onUpdate: () => Promise<void>;
    presentationMode?: boolean;
}) {
    const { plan, items, summary } = planData;
    const [addingItem, setAddingItem] = useState(false);
    const [editingItem, setEditingItem] = useState<TreatmentPlanItem | null>(null);
    const [convertingItem, setConvertingItem] = useState<TreatmentPlanItem | null>(null);
    const [convertForm, setConvertForm] = useState({
        visitDate: new Date().toISOString().split("T")[0],
        doctorId: "",
        notes: "",
    });
    const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
    const [showToothChart, setShowToothChart] = useState(false);
    const [newItem, setNewItem] = useState({
        tooth: "",
        area: "",
        procedureName: "",
        category: "",
        description: "",
        estimatedCost: "",
        priority: "medium" as Priority,
        notes: "",
    });

    // Calculate planned teeth for the chart visualization
    const plannedTeeth = useMemo(() => {
        const toothMap = new Map<string, { status: ItemStatus; count: number }>();
        items.forEach((item) => {
            if (item.tooth) {
                const existing = toothMap.get(item.tooth);
                if (existing) {
                    existing.count++;
                    // Priority: completed > accepted > proposed > declined > cancelled
                    const priority = { completed: 4, accepted: 3, proposed: 2, declined: 1, cancelled: 0 };
                    if (priority[item.status] > priority[existing.status]) {
                        existing.status = item.status;
                    }
                } else {
                    toothMap.set(item.tooth, { status: item.status, count: 1 });
                }
            }
        });
        return Array.from(toothMap.entries()).map(([tooth, data]) => ({
            tooth,
            status: data.status,
            count: data.count,
        }));
    }, [items]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
    };

    const getPlanStatusColor = (status: PlanStatus) => {
        switch (status) {
            case "draft": return "bg-gray-100 text-gray-700 border-gray-200";
            case "presented": return "bg-sky-50 text-sky-700 border-sky-200";
            case "accepted": return "bg-emerald-50 text-emerald-700 border-emerald-200";
            case "partially_accepted": return "bg-amber-50 text-amber-700 border-amber-200";
            case "declined": return "bg-rose-50 text-rose-700 border-rose-200";
            case "completed": return "bg-blue-50 text-blue-700 border-blue-200";
            case "cancelled": return "bg-gray-100 text-gray-500 border-gray-200";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const getItemStatusColor = (status: ItemStatus) => {
        switch (status) {
            case "proposed": return "bg-gray-100 text-gray-700";
            case "accepted": return "bg-emerald-50 text-emerald-700";
            case "declined": return "bg-rose-50 text-rose-700";
            case "completed": return "bg-blue-50 text-blue-700";
            case "cancelled": return "bg-gray-100 text-gray-400 line-through";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const getPriorityColor = (priority: Priority) => {
        switch (priority) {
            case "urgent": return "text-rose-600 font-bold";
            case "high": return "text-orange-600 font-semibold";
            case "medium": return "text-amber-600";
            case "low": return "text-gray-500";
            default: return "text-gray-500";
        }
    };

    const updatePlanStatus = async (status: PlanStatus) => {
        try {
            await api.treatmentPlans.update(plan.id, { status });
            await onUpdate();
        } catch (error: any) {
            alert(error?.message || "Failed to update status");
        }
    };

    // Apply procedure preset
    const applyPreset = (preset: typeof PROCEDURE_PRESETS[0]) => {
        setNewItem({
            ...newItem,
            procedureName: preset.name,
            category: preset.category,
            estimatedCost: String(preset.defaultCost),
        });
    };

    // Handle tooth selection from chart
    const handleToothSelect = (tooth: string | null) => {
        setSelectedTooth(tooth);
        if (tooth) {
            setNewItem({ ...newItem, tooth });
            // Auto-suggest area based on tooth
            const toothNum = parseInt(tooth);
            if (toothNum >= 11 && toothNum <= 18) setNewItem({ ...newItem, tooth, area: "Upper Right" });
            else if (toothNum >= 21 && toothNum <= 28) setNewItem({ ...newItem, tooth, area: "Upper Left" });
            else if (toothNum >= 31 && toothNum <= 38) setNewItem({ ...newItem, tooth, area: "Lower Left" });
            else if (toothNum >= 41 && toothNum <= 48) setNewItem({ ...newItem, tooth, area: "Lower Right" });
        } else {
            setNewItem({ ...newItem, tooth: "" });
        }
    };

    const handleAddItem = async () => {
        if (!newItem.procedureName.trim()) {
            alert("Procedure name is required");
            return;
        }

        const cost = Number(newItem.estimatedCost);
        if (isNaN(cost) || cost < 0) {
            alert("Estimated cost must be >= 0");
            return;
        }

        // Validation: require tooth OR area
        if (!newItem.tooth.trim() && !newItem.area) {
            alert("Please select a tooth or specify an area");
            setShowToothChart(true);
            return;
        }

        try {
            await api.treatmentPlans.addItem(plan.id, {
                tooth: newItem.tooth || undefined,
                area: newItem.area || undefined,
                procedureName: newItem.procedureName.trim(),
                category: newItem.category || undefined,
                description: newItem.description || undefined,
                estimatedCost: cost,
                priority: newItem.priority,
                notes: newItem.notes || undefined,
            });
            setAddingItem(false);
            setShowToothChart(false);
            setSelectedTooth(null);
            setNewItem({
                tooth: "",
                area: "",
                procedureName: "",
                category: "",
                description: "",
                estimatedCost: "",
                priority: "medium",
                notes: "",
            });
            await onUpdate();
        } catch (error: any) {
            alert(error?.message || "Failed to add item");
        }
    };

    const handleUpdateItem = async () => {
        if (!editingItem) return;

        if (editingItem.procedureName.trim() === "") {
            alert("Procedure name cannot be empty");
            return;
        }

        if (editingItem.estimatedCost < 0) {
            alert("Estimated cost must be >= 0");
            return;
        }

        try {
            await api.treatmentPlans.updateItem(editingItem.id, {
                tooth: editingItem.tooth || undefined,
                area: editingItem.area || undefined,
                procedureName: editingItem.procedureName.trim(),
                category: editingItem.category || undefined,
                description: editingItem.description || undefined,
                estimatedCost: editingItem.estimatedCost,
                priority: editingItem.priority,
                status: editingItem.status,
                notes: editingItem.notes || undefined,
            });
            setEditingItem(null);
            await onUpdate();
        } catch (error: any) {
            alert(error?.message || "Failed to update item");
        }
    };

    const handleDeleteItem = async (item: TreatmentPlanItem) => {
        if (!confirm(`Are you sure you want to remove "${item.procedureName}"?`)) return;

        try {
            const result = await api.treatmentPlans.deleteItem(item.id);
            alert(result.message);
            await onUpdate();
        } catch (error: any) {
            alert(error?.message || "Failed to delete item");
        }
    };

    const updateItemStatus = async (item: TreatmentPlanItem, newStatus: ItemStatus) => {
        try {
            await api.treatmentPlans.updateItem(item.id, { status: newStatus });
            await onUpdate();
        } catch (error: any) {
            alert(error?.message || "Failed to update status");
        }
    };

    // Phase 7C: Convert accepted item to visit/billing
    const handleConvertItem = async () => {
        if (!convertingItem) return;

        try {
            const result = await api.treatmentPlans.convertItem(convertingItem.id, {
                visitDate: convertForm.visitDate || undefined,
                doctorId: convertForm.doctorId || undefined,
                notes: convertForm.notes || undefined,
            });

            alert(`Successfully converted to Visit #${result.visit.visitNumber} and Billing ${result.billing.status}`);
            setConvertingItem(null);
            setConvertForm({
                visitDate: new Date().toISOString().split("T")[0],
                doctorId: "",
                notes: "",
            });
            await onUpdate();
        } catch (error: any) {
            const message = error?.message || "Failed to convert item";
            if (error?.status === 409) {
                alert(`Already converted: ${message}`);
            } else if (error?.status === 400) {
                alert(`Cannot convert: ${message}`);
            } else {
                alert(message);
            }
        }
    };

    const openConvertModal = (item: TreatmentPlanItem) => {
        setConvertingItem(item);
        setConvertForm({
            visitDate: new Date().toISOString().split("T")[0],
            doctorId: "",
            notes: "",
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header - Always visible */}
            <div
                className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition"
                onClick={onToggle}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{plan.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPlanStatusColor(plan.status)}`}>
                            {plan.status.replace("_", " ").toUpperCase()}
                        </span>
                    </div>
                    <div className="text-sm text-gray-500 flex gap-4 mt-1 flex-wrap">
                        <span>{summary.itemCount} items</span>
                        <span>Proposed: {formatCurrency(summary.proposedTotal)}</span>
                        <span className="text-emerald-600 font-medium">Accepted: {formatCurrency(summary.acceptedTotal)}</span>
                        {summary.completedTotal > 0 && (
                            <span className="text-blue-600">Completed: {formatCurrency(summary.completedTotal)}</span>
                        )}
                        {summary.remainingAcceptedTotal > 0 && (
                            <span className="text-amber-600">Remaining: {formatCurrency(summary.remainingAcceptedTotal)}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                    <select
                        value={plan.status}
                        onChange={(e) => updatePlanStatus(e.target.value as PlanStatus)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs border-gray-300 rounded-md shadow-sm px-2 py-1"
                    >
                        <option value="draft">Draft</option>
                        <option value="presented">Presented</option>
                        <option value="accepted">Accepted</option>
                        <option value="partially_accepted">Partially Accepted</option>
                        <option value="declined">Declined</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <span className="text-gray-400 transform transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                        ▼
                    </span>
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className={`p-4 ${presentationMode ? "bg-white" : ""}`}>
                    {/* Summary Cards */}
                    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 ${presentationMode ? "print:grid-cols-4" : ""}`}>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase">Proposed</p>
                            <p className="text-lg font-bold text-gray-700">{formatCurrency(summary.proposedTotal)}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                            <p className="text-xs text-emerald-600 uppercase">Accepted</p>
                            <p className="text-lg font-bold text-emerald-700">{formatCurrency(summary.acceptedTotal)}</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <p className="text-xs text-blue-600 uppercase">Completed</p>
                            <p className="text-lg font-bold text-blue-700">{formatCurrency(summary.completedTotal)}</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                            <p className="text-xs text-amber-600 uppercase">Remaining</p>
                            <p className="text-lg font-bold text-amber-700">{formatCurrency(summary.remainingAcceptedTotal)}</p>
                        </div>
                    </div>

                    {/* Tooth Chart Visualization */}
                    {!presentationMode && plannedTeeth.length > 0 && (
                        <div className="mb-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Treatment Overview by Tooth</h4>
                            <ToothChart
                                selectedTooth={selectedTooth}
                                onSelectTooth={handleToothSelect}
                                plannedTeeth={plannedTeeth}
                            />
                        </div>
                    )}

                    {/* Items Table */}
                    {items.length > 0 ? (
                        <div className="overflow-x-auto mb-4">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <th className="pb-2">Tooth/Area</th>
                                        <th className="pb-2">Procedure</th>
                                        <th className="pb-2">Priority</th>
                                        <th className="pb-2">Status</th>
                                        <th className="pb-2 text-right">Cost</th>
                                        {!presentationMode && <th className="pb-2 text-center">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map((item) => (
                                        <tr key={item.id} className={item.status === "cancelled" ? "opacity-60" : ""}>
                                            <td className="py-2">
                                                <div className="font-medium text-gray-900">{item.tooth || item.area || "—"}</div>
                                                {item.tooth && item.area && <div className="text-xs text-gray-500">{item.area}</div>}
                                            </td>
                                            <td className="py-2">
                                                <div className="text-gray-900 font-medium">{item.procedureName}</div>
                                                {item.category && <div className="text-xs text-gray-500">{item.category}</div>}
                                                {item.description && <div className="text-xs text-gray-400">{item.description}</div>}
                                            </td>
                                            <td className="py-2">
                                                <span className={`text-xs ${getPriorityColor(item.priority)}`}>
                                                    {item.priority.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="py-2">
                                                {presentationMode ? (
                                                    <span className={`text-xs px-2 py-1 rounded ${getItemStatusColor(item.status)}`}>
                                                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                                    </span>
                                                ) : (
                                                    <select
                                                        value={item.status}
                                                        onChange={(e) => updateItemStatus(item, e.target.value as ItemStatus)}
                                                        className={`text-xs px-2 py-1 rounded border-0 ${getItemStatusColor(item.status)}`}
                                                    >
                                                        <option value="proposed">Proposed</option>
                                                        <option value="accepted">Accepted</option>
                                                        <option value="declined">Declined</option>
                                                        <option value="completed">Completed</option>
                                                        <option value="cancelled">Cancelled</option>
                                                    </select>
                                                )}
                                            </td>
                                            <td className="py-2 text-right font-medium text-gray-900">
                                                {formatCurrency(item.estimatedCost)}
                                            </td>
                                            {!presentationMode && (
                                                <td className="py-2 text-center">
                                                    <div className="flex justify-center gap-1 flex-wrap">
                                                        {/* Convert button for accepted, not-converted items */}
                                                        {item.status === "accepted" && !item.convertedAt && (
                                                            <button
                                                                onClick={() => openConvertModal(item)}
                                                                className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2 py-1 rounded text-xs font-medium"
                                                                title="Convert to Visit/Billing"
                                                            >
                                                                🔄 Convert
                                                            </button>
                                                        )}
                                                        {/* Converted badge for converted items */}
                                                        {(item.convertedAt || item.convertedVisitId) && (
                                                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium" title={`Visit: ${item.convertedVisitId || "N/A"}, Billing: ${item.convertedBillingId || "N/A"}`}>
                                                                ✓ Converted
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => setEditingItem(item)}
                                                            className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs"
                                                            title="Edit"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteItem(item)}
                                                            className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs"
                                                            title="Delete/Cancel"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-4 text-sm bg-gray-50 rounded-lg mb-4">
                            No items in this plan yet.
                        </p>
                    )}

                    {/* Add Item Button */}
                    {!presentationMode && !addingItem && !editingItem && (
                        <button
                            onClick={() => setAddingItem(true)}
                            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 transition font-medium"
                        >
                            + Add Treatment Item
                        </button>
                    )}

                    {/* Add Item Form */}
                    {addingItem && (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
                            <h4 className="font-semibold text-gray-800 mb-3">Add Treatment Item</h4>

                            {/* Procedure Presets */}
                            <div className="mb-4">
                                <label className="block text-xs text-gray-500 mb-2">Quick Select Procedure</label>
                                <div className="flex flex-wrap gap-2">
                                    {PROCEDURE_PRESETS.map((preset) => (
                                        <button
                                            key={preset.name}
                                            type="button"
                                            onClick={() => applyPreset(preset)}
                                            className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md hover:border-primary-400 hover:text-primary-600 transition"
                                        >
                                            {preset.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tooth Chart Toggle */}
                            <div className="mb-3">
                                <button
                                    type="button"
                                    onClick={() => setShowToothChart(!showToothChart)}
                                    className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                                >
                                    {showToothChart ? "▼" : "▶"} Select Tooth from Chart
                                </button>
                                {showToothChart && (
                                    <div className="mt-2">
                                        <ToothChart
                                            selectedTooth={selectedTooth}
                                            onSelectTooth={handleToothSelect}
                                            plannedTeeth={plannedTeeth}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Procedure Name *</label>
                                    <input
                                        type="text"
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        placeholder="e.g., Composite Filling"
                                        value={newItem.procedureName}
                                        onChange={(e) => setNewItem({ ...newItem, procedureName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Estimated Cost *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        placeholder="0.00"
                                        value={newItem.estimatedCost}
                                        onChange={(e) => setNewItem({ ...newItem, estimatedCost: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Tooth (FDI notation)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                            placeholder="e.g., 18"
                                            value={newItem.tooth}
                                            onChange={(e) => {
                                                setNewItem({ ...newItem, tooth: e.target.value });
                                                setSelectedTooth(e.target.value || null);
                                            }}
                                        />
                                        {newItem.tooth && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewItem({ ...newItem, tooth: "" });
                                                    setSelectedTooth(null);
                                                }}
                                                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                                                title="Clear tooth"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">
                                        Area {newItem.tooth ? "(optional)" : "(select tooth or area)"}
                                    </label>
                                    <select
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        value={newItem.area}
                                        onChange={(e) => setNewItem({ ...newItem, area: e.target.value })}
                                    >
                                        {AREA_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Category</label>
                                    <input
                                        type="text"
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        placeholder="e.g., Restorative"
                                        value={newItem.category}
                                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Priority</label>
                                    <select
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        value={newItem.priority}
                                        onChange={(e) => setNewItem({ ...newItem, priority: e.target.value as Priority })}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                                    <input
                                        type="text"
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        placeholder="Optional description"
                                        value={newItem.description}
                                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs text-gray-500 mb-1">Notes</label>
                                    <textarea
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        rows={2}
                                        placeholder="Internal notes..."
                                        value={newItem.notes}
                                        onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setAddingItem(false)}
                                    className="px-4 py-2 text-sm border rounded-md text-gray-600 bg-white hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddItem}
                                    className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium"
                                >
                                    Add Item
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Edit Item Form */}
                    {editingItem && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
                            <h4 className="font-semibold text-gray-800 mb-3">Edit Treatment Item</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Procedure Name *</label>
                                    <input
                                        type="text"
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        value={editingItem.procedureName}
                                        onChange={(e) => setEditingItem({ ...editingItem, procedureName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Estimated Cost *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        value={editingItem.estimatedCost}
                                        onChange={(e) => setEditingItem({ ...editingItem, estimatedCost: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Tooth (FDI notation)</label>
                                    <input
                                        type="text"
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        value={editingItem.tooth || ""}
                                        onChange={(e) => setEditingItem({ ...editingItem, tooth: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Area</label>
                                    <select
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        value={editingItem.area || ""}
                                        onChange={(e) => setEditingItem({ ...editingItem, area: e.target.value || undefined })}
                                    >
                                        {AREA_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Category</label>
                                    <input
                                        type="text"
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        value={editingItem.category || ""}
                                        onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Priority</label>
                                    <select
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        value={editingItem.priority}
                                        onChange={(e) => setEditingItem({ ...editingItem, priority: e.target.value as Priority })}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs text-gray-500 mb-1">Status</label>
                                    <select
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        value={editingItem.status}
                                        onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as ItemStatus })}
                                    >
                                        <option value="proposed">Proposed</option>
                                        <option value="accepted">Accepted</option>
                                        <option value="declined">Declined</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                                    <input
                                        type="text"
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        value={editingItem.description || ""}
                                        onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs text-gray-500 mb-1">Notes</label>
                                    <textarea
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                        rows={2}
                                        value={editingItem.notes || ""}
                                        onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setEditingItem(null)}
                                    className="px-4 py-2 text-sm border rounded-md text-gray-600 bg-white hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateItem}
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Phase 7C: Convert Item Modal */}
                    {convertingItem && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                                <div className="p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        Convert to Visit/Billing
                                    </h3>
                                    <p className="text-sm text-gray-600 mb-4">
                                        <strong className="text-gray-900">{convertingItem.procedureName}</strong>
                                        {convertingItem.tooth && <span> — Tooth {convertingItem.tooth}</span>}
                                        {convertingItem.area && !convertingItem.tooth && <span> — {convertingItem.area}</span>}
                                        <br />
                                        <span className="text-emerald-600 font-medium">{formatCurrency(convertingItem.estimatedCost)}</span>
                                    </p>

                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                                        <p className="text-sm text-amber-800">
                                            <strong>⚠️ Warning:</strong> This will create a real visit and billing charge.
                                            This action cannot be undone or performed twice for the same item.
                                        </p>
                                    </div>

                                    <div className="space-y-3 mb-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Visit Date</label>
                                            <input
                                                type="date"
                                                className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                                value={convertForm.visitDate}
                                                onChange={(e) => setConvertForm({ ...convertForm, visitDate: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Doctor ID (optional)</label>
                                            <input
                                                type="text"
                                                className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                                placeholder="Doctor ID or leave empty"
                                                value={convertForm.doctorId}
                                                onChange={(e) => setConvertForm({ ...convertForm, doctorId: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Additional Notes (optional)</label>
                                            <textarea
                                                className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                                rows={2}
                                                placeholder="Notes for the visit record"
                                                value={convertForm.notes}
                                                onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => setConvertingItem(null)}
                                            className="px-4 py-2 text-sm border rounded-md text-gray-600 bg-white hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleConvertItem}
                                            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-medium"
                                        >
                                            Confirm Conversion
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
