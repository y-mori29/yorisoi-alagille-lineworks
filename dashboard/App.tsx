import React, { useState, useRef, useEffect } from 'react';
import { Home, Settings, LogOut } from 'lucide-react';
import { MOCK_ROUNDS } from './data/mockData';
import { api } from './services/api';
import { RoundList } from './components/RoundList';
import { RoundDetail } from './components/RoundDetail';
import { PatientSidebar } from './components/PatientSidebar';
import { RecordList } from './components/RecordList';
import { PatientRecordDetail } from './components/PatientRecordDetail';
import { SoapView } from './components/SoapView';
import { CsvImportModal } from './components/CsvImportModal';
import { Round, Visit, ClinicalData, Patient, Facility } from './types';
import { SimpleModal } from './components/SimpleModal';
import { Toast } from './components/ui/Toast';
import { calculateAge } from './utils/dateUtils';
import { FacilityBoard } from './components/FacilityBoard';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { FacilityManagerModal } from './components/FacilityManagerModal';
import { PatientManagerView } from './components/PatientManagerView';
import { KnowledgeManagerView } from './components/KnowledgeManagerView';
import { authService } from './services/authService';
import { User } from './services/authService';
import { BookOpen } from 'lucide-react';

// Helper to create dummy clinical data
const generateDummyClinicalData = (patientName: string, date: string): ClinicalData => ({
  soap: {
    s: "特になし。",
    o: "バイタル安定。",
    a: "現状維持。",
    p: "次回定期訪問。"
  },
  home_visit: {
    basic_info: `${date} ${patientName}`,
    chief_complaint: "なし",
    observation_treatment: "特記事項なし",
    medication_instruction: "定期処方継続",
    next_plan_handover: "予定通り"
  },
  pharmacy_focus: {
    medications: [],
    adherence: "良好",
    side_effects: [],
    drug_related_problems: [],
    labs_and_monitoring: [],
    patient_education: [],
    follow_up: ""
  },
  alerts: {
    red_flags: [],
    need_to_contact_physician: []
  },
  meta: {
    main_problems: [],
    note_for_pharmacy: ""
  }
});

function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App Data State
  const [rounds, setRounds] = useState<Round[]>(MOCK_ROUNDS);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // UI States for Modals
  const [isAddFacilityOpen, setIsAddFacilityOpen] = useState(false);
  const [isFacilityManagerOpen, setIsFacilityManagerOpen] = useState(false);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [newFacilityName, setNewFacilityName] = useState('');
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientKana, setNewPatientKana] = useState('');
  const [newPatientDob, setNewPatientDob] = useState('');
  const [newPatientGender, setNewPatientGender] = useState('female');
  const [newPatientFacilityId, setNewPatientFacilityId] = useState('');

  // View Mode
  const [viewMode, setViewMode] = useState<'BOARD' | 'PATIENTS' | 'ADMIN' | 'KNOWLEDGE'>('BOARD');
  const [currentFacilityId, setCurrentFacilityId] = useState<string | null>(null);
  const [boardDataLength, setBoardDataLength] = useState<any>(null);

  // Toast State
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  /** 患者ドロワー／記録詳細を閉じるときは recordId も必ずリセット（別患者選択時の undefined record クラッシュ防止） */
  const closePatientDrawer = () => {
    setSelectedRecordId(null);
    setSelectedPatientId(null);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      // Fetch data on login
      if (currentUser) {
        loadData();
      }
    });

    // Auto-refresh polling every 30 seconds
    const interval = setInterval(() => {
      if (!authLoading) {
        loadData();
      }
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [authLoading]);

  // Handlers for Adding Data (Modal)
  const handleCreateFacility = async () => {
    if (!newFacilityName.trim()) return;
    try {
      await api.createFacility(newFacilityName, "未分類");
      await loadData();
      showToast(`${newFacilityName}を追加しました`, 'success');
      setNewFacilityName('');
      setIsAddFacilityOpen(false);
    } catch (e) {
      showToast("施設の追加に失敗しました", 'info');
    }
  };

  const handleCreatePatient = async () => {
    if (!newPatientName.trim()) {
      showToast("患者名を入力してください", 'info');
      return;
    }
    if (!newPatientFacilityId) {
      showToast("施設を選択してください", 'info');
      return;
    }

    try {
      // Pass gender, dob, kana
      const admitRes = await api.admitPatient(
        newPatientFacilityId,
        newPatientName,
        newPatientKana,
        newPatientDob,
        newPatientGender
      );
      await loadData();
      showToast(`${newPatientName}を追加しました`, 'success');
      setNewPatientName('');
      setNewPatientKana('');
      setNewPatientDob('');
      setNewPatientGender('female');
      setIsAddPatientOpen(false);
    } catch (e) {
      console.error(e);
      showToast("患者の追加に失敗しました", 'info');
    }
  };


  // Fetch Data
  const loadData = async () => {
    try {
      const [facs, pats] = await Promise.all([
        api.fetchFacilities(),
        api.fetchPatients()
      ]);
      const validPatients = pats.map((p: any) => ({
        id: p.id,
        name: p.name,
        kana: p.kana || '',
        birthDate: p.dob || p.birthDate || '1900-01-01',
        age: calculateAge(p.dob || p.birthDate || '1900-01-01'),
        gender: p.gender || 'female',
        avatarColor: '#888888',
        facility_id: p.facilityId,
        room_number: p.roomNumber || '',
        records: p.records || []
      }));

      const validFacilities = facs.map((f: any) => ({
        id: f.id,
        name: f.name,
        patients: validPatients.filter((p: any) => p.facility_id === f.id)
      }));

      setFacilities(validFacilities);
      setPatients(validPatients);

      if (!currentFacilityId && validFacilities.length > 0) {
        setCurrentFacilityId(validFacilities[0].id);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    // view mode resets or not needed as LoginScreen takes over
    setViewMode('BOARD');
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!user) return <LoginScreen />;

  // Render logic based on selection and view mode...
  const selectedPatient = selectedPatientId ? patients.find(p => p.id === selectedPatientId) : null;
  const selectedRecord =
    selectedPatient && selectedRecordId
      ? selectedPatient.records.find((r) => r.id === selectedRecordId)
      : undefined;
  const currentFacility = facilities.find(f => f.id === currentFacilityId);

  return (
    <div className="flex h-screen bg-white">
      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Sidebar / Navigation (Only visible in BOARD/LIST mode, maybe hidden in ADMIN or different layout?) */}
      {viewMode !== 'ADMIN' && (
        <div className="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col">
          {/* Header / Facility Selector */}
          <h1 className="text-xl font-bold text-teal-600 mb-4">よりそいPro <span className="text-xs bg-gray-100 text-gray-500 px-1 py-0.5 rounded">Home Visit</span></h1>

          <div className="flex flex-col gap-1 mb-6">
            <button
              onClick={() => setViewMode('BOARD')}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-bold transition-colors ${viewMode === 'BOARD' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Home size={18} />
              施設ボード
            </button>
            <button
              onClick={() => setViewMode('PATIENTS')}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-bold transition-colors ${viewMode === 'PATIENTS' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              患者一覧
            </button>
            <button
              onClick={() => setViewMode('KNOWLEDGE')}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-bold transition-colors ${viewMode === 'KNOWLEDGE' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <BookOpen size={18} />
              AI学習資料 (マニュアル等)
            </button>
          </div>

          {viewMode === 'BOARD' && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-gray-400">表示中の施設</span>
                <button
                  onClick={() => setIsFacilityManagerOpen(true)}
                  className="text-gray-400 hover:text-teal-600"
                  title="施設管理"
                >
                  <Settings size={12} />
                </button>
              </div>
              <div className="flex gap-2">
                <select
                  className="w-full text-sm p-2 border border-gray-300 rounded bg-gray-50 focus:bg-white transition-colors text-gray-700 font-bold"
                  value={currentFacilityId || ''}
                  onChange={(e) => setCurrentFacilityId(e.target.value)}
                >
                  <option value="" disabled>施設を選択...</option>
                  {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <button
                  onClick={() => setIsAddFacilityOpen(true)}
                  className="px-2 py-1 bg-white border border-teal-600 text-teal-600 rounded shadow-sm hover:bg-teal-50 transition-colors"
                  title="施設を追加"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Content: Facility Info or Patient List Sidebar (removed list toggle) */}
          {viewMode === 'BOARD' && (
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="text-xs text-gray-500 mb-4">
                <p className="font-bold mb-1">現在: {currentFacility?.name || '未選択'}</p>
                <p>この画面では、施設内の患者の部屋移動や入院・退院・外泊などのステータス管理をドラッグ＆ドロップで行えます。</p>
              </div>
              <button
                onClick={() => setIsAddPatientOpen(true)}
                className="w-full py-2 bg-white border border-teal-500 text-teal-600 rounded font-bold text-sm hover:bg-teal-50 shadow-sm flex items-center justify-center gap-2"
              >
                <span>+ 患者登録</span>
              </button>
            </div>
          )}

          {/* User Profile */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold">
                    {user.displayName?.[0] || 'U'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-700">ログイン中</p>
                    <p className="text-xs text-gray-500">{user.displayName || '担当者A'}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600" title="ログアウト">
                  <LogOut size={16} />
                </button>
              </div>
              <button
                onClick={() => setViewMode('ADMIN')}
                className="text-xs flex items-center gap-1 text-gray-500 hover:text-teal-600 mt-2 font-bold"
              >
                <Settings size={14} /> アカウント管理設定
              </button>
            </div>
          </div>
        </div>
      )
      }

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 relative">
        {/* Header (Different for Admin?) - Reuse existing components logic */}
        {viewMode !== 'ADMIN' && (
          <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="" className="h-6 opacity-0 w-0" />
              <h2 className="font-bold text-gray-700">
                {viewMode === 'BOARD' ? '施設ボード' : viewMode === 'PATIENTS' ? '患者一覧' : viewMode === 'KNOWLEDGE' ? 'AI学習資料 (マニュアル等)' : 'カルテ一覧'}
              </h2>
            </div>
          </div>
        )}

        {/* View Switch */}
        {viewMode === 'ADMIN' ? (
          <div className="flex flex-col h-full">
            <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-4">
              <button onClick={() => setViewMode('BOARD')} className="font-bold text-gray-500 hover:text-gray-800">← 戻る</button>
            </div>
            <AdminDashboard />
          </div>
        ) : viewMode === 'KNOWLEDGE' ? (
          <KnowledgeManagerView />
        ) : viewMode === 'BOARD' ? (
          currentFacilityId ? (
            <FacilityBoard
              facilityId={currentFacilityId}
              onPatientClick={(id) => {
                setSelectedRecordId(null);
                setSelectedPatientId(id);
              }}
              onBoardUpdate={loadData}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              左のサイドバーから施設を選択してください
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <PatientManagerView
              patients={patients}
              facilities={facilities}
              onUpdate={loadData}
              onPatientClick={(id) => {
                setSelectedRecordId(null);
                setSelectedPatientId(id);
                setViewMode('BOARD');
              }}
            />
          </div>
        )}

        {/* 患者ワークスペース（施設ボードから）— 全画面に近いレイヤ */}
        {viewMode === 'BOARD' && selectedPatientId && selectedPatient && (
          <div className="fixed inset-0 z-[60] flex flex-col bg-gray-50">
            <header className="shrink-0 flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 bg-white shadow-sm">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">患者ワークスペース</p>
                <p className="font-bold text-gray-900 truncate">
                  {selectedPatient.name}
                  <span className="text-sm font-normal text-gray-500 ml-2">様（{selectedPatient.age}歳）</span>
                </p>
              </div>
              <button
                type="button"
                onClick={closePatientDrawer}
                className="shrink-0 px-4 py-2 rounded-lg text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200"
              >
                閉じて施設ボードへ
              </button>
            </header>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {selectedRecordId ? (
                selectedRecord ? (
                  <PatientRecordDetail
                    patient={selectedPatient}
                    record={selectedRecord}
                    onBack={() => setSelectedRecordId(null)}
                    onClose={closePatientDrawer}
                    onSelectRecord={setSelectedRecordId}
                    onRecordsMutated={loadData}
                    onUpdateRecord={(data) => {
                      setPatients(prev => prev.map(p =>
                        p.id === selectedPatient.id ? {
                          ...p,
                          records: p.records.map(r => r.id === selectedRecordId ? { ...r, clinicalData: data } : r)
                        } : p
                      ));
                    }}
                  />
                ) : (
                  <div className="p-6 text-sm text-gray-600 flex-1 overflow-auto">
                    記録が見つかりません。一覧に戻ってください。
                    <button type="button" className="ml-2 text-teal-600 font-bold" onClick={() => setSelectedRecordId(null)}>一覧へ</button>
                  </div>
                )
              ) : (
                <RecordList
                  patient={selectedPatient}
                  onSelectRecord={setSelectedRecordId}
                />
              )}
            </div>
          </div>
        )}

      </div>

      {/* Modals */}
      <SimpleModal
        isOpen={isAddFacilityOpen}
        onClose={() => setIsAddFacilityOpen(false)}
        title="新規施設追加"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">施設名</label>
            <input
              className="w-full border p-2 rounded"
              placeholder="〇〇クリニック"
              value={newFacilityName}
              onChange={e => setNewFacilityName(e.target.value)}
            />
          </div>
          <button
            onClick={handleCreateFacility}
            className="w-full py-2 bg-teal-600 text-white font-bold rounded hover:bg-teal-700"
          >
            作成
          </button>
        </div>
      </SimpleModal>

      <SimpleModal
        isOpen={isAddPatientOpen}
        onClose={() => setIsAddPatientOpen(false)}
        title="新規患者登録"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">氏名</label>
            <input
              className="w-full border p-2 rounded"
              placeholder="山田 太郎"
              value={newPatientName}
              onChange={e => setNewPatientName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">フリガナ</label>
            <input
              className="w-full border p-2 rounded"
              placeholder="ヤマダ タロウ"
              value={newPatientKana}
              onChange={e => setNewPatientKana(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">生年月日</label>
              <input
                type="date"
                className="w-full border p-2 rounded"
                value={newPatientDob}
                onChange={e => setNewPatientDob(e.target.value)}
              />
            </div>
            <div className="w-1/3">
              <label className="block text-sm font-bold text-gray-700 mb-1">性別</label>
              <select
                className="w-full border p-2 rounded"
                value={newPatientGender}
                onChange={e => setNewPatientGender(e.target.value)}
              >
                <option value="female">女性</option>
                <option value="male">男性</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">所属施設</label>
            <select
              className="w-full border p-2 rounded"
              value={newPatientFacilityId}
              onChange={e => setNewPatientFacilityId(e.target.value)}
            >
              <option value="">選択してください</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">※登録後、自動的に未配置リストに追加されます</p>
          </div>
          <button
            onClick={handleCreatePatient}
            className="w-full py-2 bg-teal-600 text-white font-bold rounded hover:bg-teal-700"
          >
            登録
          </button>
        </div>
      </SimpleModal>

      <FacilityManagerModal
        isOpen={isFacilityManagerOpen}
        onClose={() => setIsFacilityManagerOpen(false)}
        facilities={facilities}
        onUpdate={loadData}
      />

    </div >
  );
}

export default App;