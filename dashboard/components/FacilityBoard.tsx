import React, { useEffect, useState, useMemo } from 'react';
import { DndContext, DragOverlay, useDraggable, useDroppable, closestCorners, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { api, FacilityBoard as BoardData, PatientCard } from '../services/api';
import { User, Activity, Home, AlertCircle, Info, Layers } from 'lucide-react';

// Draggable Card
const DraggableCard: React.FC<{ patient: PatientCard, onClick: (id: string) => void }> = ({ patient, onClick }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: patient.patientId,
        data: patient
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : 1,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={style}
            onClick={() => onClick(patient.patientId)}
            className={`bg-white p-2 rounded shadow-sm border border-gray-200 text-sm cursor-pointer hover:shadow-md transition-shadow ${patient.stayType === 'SHORT' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-blue-500'} ${isDragging ? 'opacity-50' : ''}`}
        >
            <div className="font-bold text-gray-800 flex items-center justify-between">
                <span>{patient.displayName}</span>
                {patient.stayType === 'SHORT' && <span className="text-[10px] bg-green-100 text-green-800 px-1 rounded">SS</span>}
            </div>
            {patient.alerts && patient.alerts.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                    {patient.alerts.map((a, i) => (
                        <span key={i} className="text-[10px] bg-red-100 text-red-600 px-1 rounded flex items-center">
                            <AlertCircle size={8} className="mr-0.5" /> {a}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

// Droppable Lane/Room
const DroppableArea = ({ id, children, title, className, type }: any) => {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
        data: { type, id } // type: 'ROOM' | 'UNASSIGNED' | 'AWAY'
    });

    return (
        <div ref={setNodeRef} className={`flex-1 min-h-[100px] transition-colors ${isOver ? 'bg-blue-50 ring-2 ring-blue-300' : ''} ${className}`}>
            {title && <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">{title}</h3>}
            <div className="space-y-2">
                {children}
            </div>
        </div>
    );
};

export const FacilityBoard = ({ facilityId, onPatientClick, onBoardUpdate }: { facilityId: string, onPatientClick?: (id: string) => void, onBoardUpdate?: () => void }) => {
    const [board, setBoard] = useState<BoardData | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isSetupOpen, setIsSetupOpen] = useState(false);

    // Flexible Setup State
    const [floorsConfig, setFloorsConfig] = useState<{ floor: number, count: number }[]>([{ floor: 1, count: 10 }]);

    // Floor Selection State
    const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

    // Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const fetchBoard = async () => {
        try {
            const data = await api.fetchBoard(facilityId);
            setBoard(data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchBoard();
        const interval = setInterval(() => {
            fetchBoard();
        }, 30000);
        return () => clearInterval(interval);
    }, [facilityId]);

    // Compute available floors and set default
    const availableFloors = useMemo(() => {
        if (!board || board.rooms.length === 0) return [];
        const floors = new Set<number>();
        board.rooms.forEach(r => {
            // Assume 3 digit: 101 -> floor 1. 4 digit: 1001 -> floor 10.
            const floor = Math.floor(parseInt(r.label) / 100);
            if (!isNaN(floor)) floors.add(floor);
        });
        return Array.from(floors).sort((a, b) => a - b);
    }, [board]);

    useEffect(() => {
        if (availableFloors.length > 0 && selectedFloor === null) {
            setSelectedFloor(availableFloors[0]);
        }
    }, [availableFloors, selectedFloor]);


    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = async (event: any) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const patientId = active.id;
        const targetData = over.data.current;
        let toPayload: any = {};

        if (targetData.type === 'UNASSIGNED') toPayload = { kind: 'UNASSIGNED' };
        else if (targetData.type === 'AWAY') toPayload = { kind: 'AWAY_HOSPITAL' };
        else if (targetData.type === 'ROOM') toPayload = { kind: 'ROOM', roomId: targetData.id };
        else return;

        try {
            await api.moveOccupancy(facilityId, patientId, toPayload);
            fetchBoard();
            if (onBoardUpdate) onBoardUpdate();
        } catch (e) {
            alert('移動に失敗しました');
        }
    };

    const handleCreateRooms = async () => {
        const roomsToCreate = [];
        for (const cfg of floorsConfig) {
            for (let r = 1; r <= cfg.count; r++) {
                const roomNum = (cfg.floor * 100) + r;
                roomsToCreate.push({ label: `${roomNum}` });
            }
        }

        try {
            await api.createRooms(facilityId, roomsToCreate);
            setIsSetupOpen(false);
            fetchBoard();
            if (onBoardUpdate) onBoardUpdate();
        } catch (e) {
            alert('部屋の作成に失敗しました');
        }
    };

    if (!board) return <div className="p-10 text-center text-gray-500">Loading Board...</div>;

    const unassignedCount = board.lanes.unassigned.length;
    const awayCount = board.lanes.awayHospital.length;

    // Filter rooms by floor
    const displayedRooms = selectedFloor
        ? board.rooms.filter(r => Math.floor(parseInt(r.label) / 100) === selectedFloor)
        : board.rooms;

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
            <div className="flex flex-col h-full bg-gray-100 relative overflow-hidden">

                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white shadow-sm h-14 z-20 sticky top-0">
                    <h2 className="font-bold text-lg flex items-center text-gray-800">
                        <Home className="mr-2 text-teal-600" size={24} />
                        {board.facility.name}
                    </h2>

                    <div className="flex items-center gap-4">
                        {board.rooms.length === 0 && (
                            <button onClick={() => setIsSetupOpen(true)} className="px-4 py-1.5 bg-teal-600 text-white text-sm rounded-full hover:bg-teal-700 font-bold shadow-sm flex items-center gap-1">
                                <Home size={14} /> 部屋作成
                            </button>
                        )}
                        <span className="text-xs text-gray-400">ドラッグ＆ドロップで部屋移動</span>
                    </div>
                </div>

                {/* Floor Tabs */}
                {availableFloors.length > 0 && (
                    <div className="px-4 pt-2 bg-slate-50 flex gap-1 overflow-x-auto shadow-inner border-b border-gray-200">
                        <div className="flex items-center mr-2 text-gray-400 text-xs font-bold uppercase tracking-wider">
                            <Layers size={14} className="mr-1" /> Floor
                        </div>
                        {availableFloors.map(floor => (
                            <button
                                key={floor}
                                onClick={() => setSelectedFloor(floor)}
                                className={`px-5 py-2 rounded-t-lg font-bold text-sm transition-all shadow-sm border-t border-l border-r ${selectedFloor === floor
                                    ? 'bg-white text-teal-700 border-gray-200 border-b-white translate-y-[1px]'
                                    : 'bg-gray-200 text-gray-500 border-transparent hover:bg-gray-300'
                                    }`}
                            >
                                {floor}F
                            </button>
                        ))}
                    </div>
                )}

                {/* Main Content: Rooms Grid */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 relative custom-scrollbar">
                    {board.rooms.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <div className="bg-white p-8 rounded-xl shadow border border-gray-200 text-center">
                                <Home size={48} className="mx-auto text-gray-300 mb-4" />
                                <h3 className="font-bold text-gray-600 mb-2">部屋がありません</h3>
                                <p className="text-sm text-gray-400 mb-6">右上の「部屋作成」ボタンから設定を行ってください。</p>
                                <button onClick={() => setIsSetupOpen(true)} className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow font-bold hover:bg-blue-700">
                                    セットアップ画面を開く
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 pb-4">
                            {displayedRooms.length > 0 ? (
                                displayedRooms.map(room => (
                                    <div key={room.roomId} className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-[150px] transition-all hover:shadow-md hover:border-blue-400 group relative">
                                        <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50/50 rounded-t-lg">
                                            <span className="font-bold text-lg text-gray-700">{room.label.replace('号室', '')}</span>
                                            {room.patients.length > 0 && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold">入居中</span>}
                                        </div>
                                        <DroppableArea id={room.roomId} type="ROOM" className="flex-1 p-2 min-h-0 relative">
                                            {room.patients.length > 0 ? (
                                                room.patients.map(p => (
                                                    <DraggableCard key={p.patientId} patient={p} onClick={(id) => onPatientClick && onPatientClick(id)} />
                                                ))
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-gray-200 text-xs font-medium italic group-hover:text-gray-300">
                                                    空室
                                                </div>
                                            )}
                                        </DroppableArea>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full text-center text-gray-400 py-10">このフロアに部屋はありません</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Bottom Zones: Unassigned & Away */}
                <div className="bg-white border-t border-gray-200 p-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 flex gap-4 h-48">
                    {/* Unassigned Zone */}
                    <div className="flex-1 flex flex-col bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <User size={16} className="text-gray-500" />
                                <span className="font-bold text-gray-700 text-sm">未配置リスト</span>
                                <span className="text-xs text-gray-400">({unassignedCount}名)</span>
                            </div>
                        </div>
                        <DroppableArea id="lane-unassigned" type="UNASSIGNED" className="flex-1 p-2 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                {board.lanes.unassigned.map(p => <DraggableCard key={p.patientId} patient={p} onClick={(id) => onPatientClick && onPatientClick(id)} />)}
                            </div>
                            {unassignedCount === 0 && <div className="text-center text-gray-400 text-xs mt-4">対象者なし</div>}
                        </DroppableArea>
                    </div>

                    {/* Away Zone */}
                    <div className="flex-1 flex flex-col bg-red-50/30 rounded-lg border border-red-100 overflow-hidden">
                        <div className="px-3 py-2 bg-red-50 border-b border-red-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Activity size={16} className="text-red-500" />
                                <span className="font-bold text-red-700 text-sm">入院/不在リスト</span>
                                <span className="text-xs text-red-400">({awayCount}名)</span>
                            </div>
                        </div>
                        <DroppableArea id="lane-away" type="AWAY" className="flex-1 p-2 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                {board.lanes.awayHospital.map(p => <DraggableCard key={p.patientId} patient={p} onClick={(id) => onPatientClick && onPatientClick(id)} />)}
                            </div>
                            {awayCount === 0 && <div className="text-center text-red-300 text-xs mt-4">対象者なし</div>}
                        </DroppableArea>
                    </div>
                </div>

                {/* Flexible Setup Modal */}
                {isSetupOpen && (
                    <div className="absolute inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
                        <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
                            <h3 className="font-bold text-xl mb-4 text-gray-800 flex items-center gap-2">
                                <Home className="text-teal-600" /> 居室構成のセットアップ
                            </h3>
                            <div className="space-y-4">
                                <p className="text-xs text-gray-500">フロアごとに部屋数を指定してください。既存の設定に追加されます。</p>

                                {floorsConfig.map((cfg, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-gray-50 p-2 rounded border border-gray-200">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-500 block">階数</label>
                                            <div className="flex items-center gap-1">
                                                <input type="number" value={cfg.floor}
                                                    onChange={e => {
                                                        const val = parseInt(e.target.value);
                                                        const newCfg = [...floorsConfig];
                                                        newCfg[idx].floor = val;
                                                        setFloorsConfig(newCfg);
                                                    }}
                                                    className="w-full font-bold border-b border-gray-300 focus:border-teal-500 bg-transparent py-1 outline-none text-center"
                                                />
                                                <span className="text-xs text-gray-400">階</span>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-500 block">部屋数</label>
                                            <div className="flex items-center gap-1">
                                                <input type="number" value={cfg.count}
                                                    onChange={e => {
                                                        const val = parseInt(e.target.value);
                                                        const newCfg = [...floorsConfig];
                                                        newCfg[idx].count = val;
                                                        setFloorsConfig(newCfg);
                                                    }}
                                                    className="w-full font-bold border-b border-gray-300 focus:border-teal-500 bg-transparent py-1 outline-none text-center"
                                                />
                                                <span className="text-xs text-gray-400">部屋</span>
                                            </div>
                                        </div>
                                        {floorsConfig.length > 1 && (
                                            <button onClick={() => setFloorsConfig(floorsConfig.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">×</button>
                                        )}
                                    </div>
                                ))}

                                <button onClick={() => setFloorsConfig([...floorsConfig, { floor: floorsConfig.length + 1, count: 10 }])} className="w-full py-2 border-2 border-dashed border-gray-200 text-gray-400 rounded hover:border-teal-500 hover:text-teal-600 text-sm font-bold transition-colors">
                                    + フロアを追加
                                </button>

                                <div className="pt-4 flex gap-3 border-t border-gray-100 mt-4">
                                    <button onClick={() => setIsSetupOpen(false)} className="flex-1 py-3 text-gray-500 font-bold text-sm hover:bg-gray-50 rounded">キャンセル</button>
                                    <button onClick={handleCreateRooms} className="flex-1 py-3 bg-teal-600 text-white rounded shadow-lg hover:bg-teal-700 font-bold text-sm transform active:scale-95 transition-all">
                                        構成を保存・作成
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DndContext>
    );
};
