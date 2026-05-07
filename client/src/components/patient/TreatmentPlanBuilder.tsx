import { useState, useEffect } from "react";
import { api } from "../../lib/api";

interface Props {
    patientId: string;
}

export function TreatmentPlanBuilder({ patientId }: Props) {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [catalog, setCatalog] = useState<any[]>([]);

    useEffect(() => {
        loadPlans();
        loadCatalog();
    }, [patientId]);

    const loadPlans = async () => {
        try {
            const data = await api.treatmentPlans.forPatient(patientId);
            setPlans(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadCatalog = async () => {
        try {
            const data = await api.procedureCatalog.list();
            setCatalog(data);
        } catch (error) {
            console.error(error);
        }
    };

    const createPlan = async () => {
        const title = prompt("Enter a title for the new treatment plan (e.g., 'Phase 1 Restorative')");
        if (!title) return;

        try {
            await api.treatmentPlans.create({
                patientId,
                title,
                priority: "normal"
            });
            loadPlans();
        } catch (error) {
            alert("Failed to create plan");
        }
    };

    if (loading) return <div className="p-4 text-gray-500">Loading treatment plans...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    📋 Treatment Plans
                </h2>
                <button 
                    onClick={createPlan}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
                >
                    + New Plan
                </button>
            </div>

            {plans.length === 0 ? (
                <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 border border-gray-200 border-dashed">
                    No treatment plans created yet. Click "New Plan" to start.
                </div>
            ) : (
                <div className="space-y-6">
                    {plans.map(plan => (
                        <TreatmentPlanCard 
                            key={plan.id} 
                            plan={plan} 
                            catalog={catalog}
                            onUpdate={loadPlans} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function TreatmentPlanCard({ plan, catalog, onUpdate }: { plan: any, catalog: any[], onUpdate: () => void }) {
    const [addingItem, setAddingItem] = useState(false);
    const [newItem, setNewItem] = useState({
        toothCode: "",
        procedureCode: "",
        procedureName: "",
        estimatedCost: "0"
    });

    const handleCatalogSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const proc = catalog.find(p => p.id === e.target.value);
        if (proc) {
            setNewItem({
                ...newItem,
                procedureCode: proc.code || "",
                procedureName: proc.name,
                estimatedCost: proc.defaultPrice
            });
        }
    };

    const handleAddItem = async () => {
        if (!newItem.procedureName) return;
        try {
            await api.treatmentPlans.addItem(plan.id, {
                ...newItem,
                patientId: plan.patientId
            });
            setAddingItem(false);
            setNewItem({ toothCode: "", procedureCode: "", procedureName: "", estimatedCost: "0" });
            onUpdate();
        } catch (error) {
            alert("Failed to add item");
        }
    };

    const handleDeletePlan = async () => {
        if (!confirm("Are you sure you want to delete this treatment plan?")) return;
        try {
            await api.treatmentPlans.delete(plan.id);
            onUpdate();
        } catch (error) {
            alert("Failed to delete plan");
        }
    };

    const updateStatus = async (status: string) => {
        try {
            await api.treatmentPlans.update(plan.id, { status });
            onUpdate();
        } catch (error) {
            alert("Failed to update status");
        }
    };

    const formatCurrency = (val: string) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(val));
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "draft": return "bg-gray-100 text-gray-800";
            case "presented": return "bg-yellow-100 text-yellow-800";
            case "accepted": return "bg-green-100 text-green-800";
            case "completed": return "bg-blue-100 text-blue-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">{plan.title}</h3>
                    <div className="text-sm text-gray-500 flex gap-4 mt-1">
                        <span>Created: {new Date(plan.createdAt).toLocaleDateString()}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                            {plan.status.toUpperCase()}
                        </span>
                        <span className="font-medium text-gray-900">Total: {formatCurrency(plan.totalEstimatedCost)}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <select 
                        value={plan.status}
                        onChange={(e) => updateStatus(e.target.value)}
                        className="text-sm border-gray-300 rounded-md shadow-sm"
                    >
                        <option value="draft">Draft</option>
                        <option value="presented">Presented</option>
                        <option value="accepted">Accepted</option>
                        <option value="completed">Completed</option>
                    </select>
                    <button onClick={handleDeletePlan} className="text-red-500 hover:bg-red-50 px-3 py-1 rounded">Delete</button>
                </div>
            </div>

            <div className="p-6">
                {plan.items && plan.items.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200 mb-4">
                        <thead>
                            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th className="pb-3">Tooth</th>
                                <th className="pb-3">Procedure</th>
                                <th className="pb-3 text-right">Cost</th>
                                <th className="pb-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {plan.items.map((item: any) => (
                                <tr key={item.id}>
                                    <td className="py-3 font-medium">{item.toothCode || "N/A"}</td>
                                    <td className="py-3">
                                        <div className="text-gray-900">{item.procedureName}</div>
                                        {item.procedureCode && <div className="text-xs text-gray-500">{item.procedureCode}</div>}
                                    </td>
                                    <td className="py-3 text-right text-gray-900">{formatCurrency(item.estimatedCost)}</td>
                                    <td className="py-3 text-center">
                                        <span className={`px-2 py-1 text-xs rounded-full ${item.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-gray-500 text-center py-4 text-sm">No procedures added to this plan yet.</p>
                )}

                {addingItem ? (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-4">
                        <div className="grid grid-cols-12 gap-4 mb-4">
                            <div className="col-span-2">
                                <label className="block text-xs text-gray-500 mb-1">Tooth</label>
                                <input 
                                    type="text" 
                                    className="w-full border-gray-300 rounded shadow-sm text-sm"
                                    placeholder="e.g. 18"
                                    value={newItem.toothCode}
                                    onChange={e => setNewItem({...newItem, toothCode: e.target.value})}
                                />
                            </div>
                            <div className="col-span-6">
                                <label className="block text-xs text-gray-500 mb-1">Procedure</label>
                                <select 
                                    className="w-full border-gray-300 rounded shadow-sm text-sm mb-2"
                                    onChange={handleCatalogSelect}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Select from catalog...</option>
                                    {catalog.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({formatCurrency(c.defaultPrice)})</option>
                                    ))}
                                </select>
                                <input 
                                    type="text" 
                                    className="w-full border-gray-300 rounded shadow-sm text-sm"
                                    placeholder="Or type custom procedure..."
                                    value={newItem.procedureName}
                                    onChange={e => setNewItem({...newItem, procedureName: e.target.value})}
                                />
                            </div>
                            <div className="col-span-4">
                                <label className="block text-xs text-gray-500 mb-1">Cost</label>
                                <input 
                                    type="number" 
                                    className="w-full border-gray-300 rounded shadow-sm text-sm"
                                    value={newItem.estimatedCost}
                                    onChange={e => setNewItem({...newItem, estimatedCost: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => setAddingItem(false)}
                                className="px-3 py-1.5 text-sm border rounded text-gray-600 bg-white"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleAddItem}
                                disabled={!newItem.procedureName}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
                            >
                                Add Procedure
                            </button>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={() => setAddingItem(true)}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                        <span>+</span> Add Procedure
                    </button>
                )}
            </div>
        </div>
    );
}
