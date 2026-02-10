
import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db, COL_RECRUIT, COL_USERS } from '../firebase';
import { RecruitApplication, UserProfile } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import * as XLSX from 'xlsx';
import { 
  Search, Users, FileText, CheckCircle, XCircle, Clock, 
  Eye, Download, Filter, Mail, Phone, Calendar, FileSpreadsheet
} from 'lucide-react';

/* --- Helper UI Components --- */

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => (
  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative group hover:shadow-xl transition-all duration-500">
    <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 -translate-y-10 translate-x-10 rounded-full group-hover:scale-150 transition-transform duration-700`}></div>
    <div className={`${color} w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-2xl shadow-${color}/30 transform group-hover:rotate-12 transition-transform`}>
      {React.cloneElement(icon as React.ReactElement, { className: 'w-7 h-7' })}
    </div>
    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
    <p className="text-4xl font-black text-slate-900 mt-2 tracking-tighter">{value}</p>
  </div>
);

interface FilterButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
  color?: string;
}

const FilterButton: React.FC<FilterButtonProps> = ({ active, label, onClick, color = 'slate' }) => {
  const themes: Record<string, string> = {
    slate: active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200/50 bg-white',
    amber: active ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' : 'text-amber-600 bg-amber-50 hover:bg-amber-100',
    indigo: active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100',
    emerald: active ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100',
    rose: active ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' : 'text-rose-600 bg-rose-50 hover:bg-rose-100',
  };
  return (
    <button onClick={onClick} className={`px-8 py-4 rounded-2xl text-[11px] font-black transition-all border border-transparent ${themes[color]}`}>
      {label}
    </button>
  );
};

interface StatusBadgeProps {
  status: RecruitApplication['status'];
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const map = {
    pending: { label: '심사대기', class: 'bg-amber-50 text-amber-600 border-amber-100' },
    reviewed: { label: '검토완료', class: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    accepted: { label: '최종합격', class: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    rejected: { label: '불합격', class: 'bg-rose-50 text-rose-600 border-rose-100' },
  };
  const config = map[status];
  return (
    <span className={`px-5 py-2 rounded-full text-[10px] font-black border uppercase tracking-widest flex items-center gap-2 ${config.class}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {config.label}
    </span>
  );
};

interface ContactBoxProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const ContactBox: React.FC<ContactBoxProps> = ({ icon, label, value }) => (
  <div className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-colors">
    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
      {icon}
    </div>
    <div>
      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-black text-slate-700">{value}</p>
    </div>
  </div>
);

interface LabelProps {
  children: React.ReactNode;
}

const Label: React.FC<LabelProps> = ({ children }) => (
  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">{children}</h4>
);

/* --- Main Admin Dashboard Component --- */

const AdminDashboard: React.FC = () => {
  const [applications, setApplications] = useState<RecruitApplication[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'applications' | 'users'>('applications');
  const [selectedApp, setSelectedApp] = useState<RecruitApplication | null>(null);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filtering & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [appSnap, userSnap] = await Promise.all([
          getDocs(query(collection(db, COL_RECRUIT), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, COL_USERS), orderBy('createdAt', 'desc')))
        ]);

        setApplications(appSnap.docs.map(d => ({ id: d.id, ...d.data() } as RecruitApplication)));
        setUsers(userSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      } catch (error) {
        console.error("관리자 데이터 로딩 오류:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 지원 현황 통계 (Memoized)
  const stats = useMemo(() => {
    return {
      total: applications.length,
      pending: applications.filter(a => a.status === 'pending').length,
      reviewed: applications.filter(a => a.status === 'reviewed').length,
      accepted: applications.filter(a => a.status === 'accepted').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
    };
  }, [applications]);

  // 리스트 필터링 로직 (Memoized)
  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const matchesSearch = 
        app.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        app.desiredField.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [applications, searchTerm, statusFilter]);

  // Selection Logic
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredApplications.length && filteredApplications.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApplications.map(app => app.id as string)));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 행 클릭 이벤트 방지
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleUpdateStatus = async (appId: string, newStatus: RecruitApplication['status']) => {
    try {
      const docRef = doc(db, COL_RECRUIT, appId);
      await updateDoc(docRef, { status: newStatus });
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
      if (selectedApp?.id === appId) {
        setSelectedApp(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      console.error(err);
      alert('상태 업데이트 중 오류가 발생했습니다.');
    }
  };

  const downloadExcel = () => {
    if (selectedIds.size === 0) {
      alert('다운로드할 항목을 선택해주세요.');
      return;
    }

    const dataToExport = applications
      .filter(app => selectedIds.has(app.id as string))
      .map(app => ({
        "성명": app.userName,
        "이메일": app.email,
        "전화번호": app.phone,
        "성별": app.gender === 'male' ? '남성' : '여성',
        "생년월일": app.birthDate,
        "지원분야": app.desiredField,
        "희망연봉(만원)": app.expectedSalary,
        "주소": `${app.address} ${app.detailAddress}`,
        "진행상태": app.status === 'pending' ? '심사대기' : app.status === 'reviewed' ? '검토완료' : app.status === 'accepted' ? '합격' : '불합격',
        "제출일": new Date(app.createdAt).toLocaleString()
      }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "지원서_리스트");
    
    // 열 너비 자동 조정
    const wscols = [
      {wch: 15}, {wch: 25}, {wch: 20}, {wch: 10}, {wch: 15},
      {wch: 20}, {wch: 15}, {wch: 40}, {wch: 15}, {wch: 25}
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `입사지원서_관리_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4">
      {/* 1. Header & Title */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter italic">ADMIN CENTER</h1>
          <p className="text-slate-500 mt-3 font-medium text-lg">전체 입사지원 현황과 인재 풀을 전문적으로 관리합니다.</p>
        </div>
        {selectedIds.size > 0 && (
          <button 
            onClick={downloadExcel}
            className="flex items-center gap-3 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-emerald-700 transition shadow-xl shadow-emerald-100 animate-in fade-in zoom-in duration-300"
          >
            <FileSpreadsheet className="w-5 h-5" />
            선택 항목 Excel 다운로드 ({selectedIds.size})
          </button>
        )}
      </div>

      {/* 2. 입사지원서 지원현황 (Stat Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
        <StatCard label="전체 지원" value={stats.total} icon={<FileText />} color="bg-slate-900" />
        <StatCard label="심사 대기" value={stats.pending} icon={<Clock />} color="bg-amber-500" />
        <StatCard label="검토 완료" value={stats.reviewed} icon={<Eye />} color="bg-indigo-600" />
        <StatCard label="최종 합격" value={stats.accepted} icon={<CheckCircle />} color="bg-emerald-500" />
        <StatCard label="불합격" value={stats.rejected} icon={<XCircle />} color="bg-rose-500" />
      </div>

      {/* 3. Main Dashboard Board */}
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex bg-slate-50/50 p-3 border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('applications')}
            className={`flex items-center gap-3 px-10 py-5 rounded-[2rem] font-black transition-all duration-300 ${activeTab === 'applications' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <FileText className="w-5 h-5" />
            지원서 리스트 관리
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-3 px-10 py-5 rounded-[2rem] font-black transition-all duration-300 ${activeTab === 'users' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Users className="w-5 h-5" />
            전체 회원 관리
          </button>
        </div>

        <div className="p-10">
          {activeTab === 'applications' ? (
            <div className="space-y-8">
              {/* Filter & Search Bar */}
              <div className="flex flex-col xl:flex-row gap-6 justify-between items-center bg-slate-50 p-6 rounded-[2rem]">
                <div className="relative w-full xl:w-[400px]">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="지원자 이름 또는 분야 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 transition outline-none text-sm font-bold shadow-sm"
                  />
                </div>
                <div className="flex gap-2 w-full xl:w-auto overflow-x-auto no-scrollbar">
                  <FilterButton active={statusFilter === 'all'} label="ALL" onClick={() => setStatusFilter('all')} />
                  <FilterButton active={statusFilter === 'pending'} label="PENDING" color="amber" onClick={() => setStatusFilter('pending')} />
                  <FilterButton active={statusFilter === 'reviewed'} label="REVIEWED" color="indigo" onClick={() => setStatusFilter('reviewed')} />
                  <FilterButton active={statusFilter === 'accepted'} label="ACCEPTED" color="emerald" onClick={() => setStatusFilter('accepted')} />
                  <FilterButton active={statusFilter === 'rejected'} label="REJECTED" color="rose" onClick={() => setStatusFilter('rejected')} />
                </div>
              </div>

              {/* List & Detail View */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                {/* Application List (Table) */}
                <div className="xl:col-span-8">
                  <div className="overflow-x-auto bg-white rounded-[2rem] border border-slate-100">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/30">
                          <th className="px-6 py-6 w-12 text-center">
                            <input 
                              type="checkbox" 
                              checked={filteredApplications.length > 0 && selectedIds.size === filteredApplications.length}
                              onChange={toggleSelectAll}
                              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                            />
                          </th>
                          <th className="px-6 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">지원자</th>
                          <th className="px-6 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">지원분야/급여</th>
                          <th className="px-6 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">제출일</th>
                          <th className="px-6 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">진행상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredApplications.length === 0 ? (
                          <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic">검색 결과가 없습니다.</td></tr>
                        ) : (
                          filteredApplications.map(app => (
                            <tr 
                              key={app.id} 
                              onClick={() => setSelectedApp(app)}
                              className={`cursor-pointer transition-all group ${selectedApp?.id === app.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'} ${selectedIds.has(app.id as string) ? 'bg-slate-50/80' : ''}`}
                            >
                              <td className="px-6 py-6 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={selectedIds.has(app.id as string)}
                                  onClick={(e) => toggleSelectOne(app.id as string, e)}
                                  onChange={() => {}} // onClick에서 처리
                                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                                />
                              </td>
                              <td className="px-6 py-6">
                                <div className="flex items-center gap-5">
                                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200 group-hover:scale-105 transition-transform">
                                    {app.photoUrl ? <img src={app.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Users className="w-6 h-6" /></div>}
                                  </div>
                                  <div>
                                    <div className="font-black text-slate-900 text-base">{app.userName}</div>
                                    <div className="text-[11px] text-slate-400 font-bold">{app.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <div className="text-sm font-black text-slate-700">{app.desiredField}</div>
                                <div className="text-[10px] text-indigo-500 font-black mt-1">희망 {app.expectedSalary}만원</div>
                              </td>
                              <td className="px-6 py-6 text-xs text-slate-500 font-bold">
                                {new Date(app.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-6">
                                <div className="flex justify-center"><StatusBadge status={app.status} /></div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Selected Application Detail Sidebar */}
                <div className="xl:col-span-4">
                  {selectedApp ? (
                    <div className="bg-slate-50/70 rounded-[2.5rem] border border-slate-200 p-10 sticky top-28 max-h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar shadow-xl shadow-slate-200/20">
                      <div className="flex justify-between items-start mb-10">
                        <div className="flex gap-6">
                          <div className="w-24 h-32 bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border-4 border-white">
                            {selectedApp.photoUrl && <img src={selectedApp.photoUrl} className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedApp.userName}</h2>
                            <p className="text-indigo-600 text-sm font-black mt-1">{selectedApp.desiredField} 지원</p>
                            <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold mt-3">
                              <Calendar className="w-3 h-3" /> {selectedApp.birthDate}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => setSelectedApp(null)} className="p-2 hover:bg-white rounded-full transition shadow-sm">
                          <XCircle className="w-7 h-7 text-slate-300" />
                        </button>
                      </div>

                      <div className="space-y-10">
                        {/* Status Management */}
                        <section>
                          <Label>심사 결과 변경</Label>
                          <div className="grid grid-cols-2 gap-3 mt-4">
                            {['pending', 'reviewed', 'accepted', 'rejected'].map((s) => (
                              <button
                                key={s}
                                onClick={() => handleUpdateStatus(selectedApp.id!, s as any)}
                                className={`py-4 rounded-2xl text-[11px] font-black transition-all border-2 shadow-sm ${
                                  selectedApp.status === s 
                                  ? 'bg-slate-900 border-slate-900 text-white scale-105' 
                                  : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                                }`}
                              >
                                {s === 'pending' ? '심사대기' : s === 'reviewed' ? '검토완료' : s === 'accepted' ? '합격' : '불합격'}
                              </button>
                            ))}
                          </div>
                        </section>

                        {/* Contact Info */}
                        <section className="grid grid-cols-1 gap-3">
                           <ContactBox icon={<Phone className="w-4 h-4" />} label="Phone" value={selectedApp.phone} />
                           <ContactBox icon={<Mail className="w-4 h-4" />} label="Email" value={selectedApp.email} />
                        </section>

                        {/* Education/Experience */}
                        <section>
                          <Label>주요 이력</Label>
                          <div className="mt-4 space-y-3">
                            {selectedApp.education.map((edu, i) => (
                              <div key={i} className="text-xs bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-black text-slate-900">{edu.schoolMajor}</span>
                                  <span className="text-[10px] text-indigo-500 font-black">학력</span>
                                </div>
                                <p className="text-slate-400 font-bold">{edu.admissionYear} ~ {edu.graduationYear}</p>
                              </div>
                            ))}
                          </div>
                        </section>

                        {/* Self Intro */}
                        <section>
                          <Label>자기소개서</Label>
                          <div className="mt-4 text-xs text-slate-600 bg-white p-6 rounded-[2rem] border border-slate-100 leading-relaxed max-h-60 overflow-y-auto custom-scrollbar font-medium shadow-inner">
                            {selectedApp.selfIntro || "기재된 자기소개 내용이 없습니다."}
                          </div>
                        </section>

                        {/* Actions */}
                        <div className="flex gap-4 pt-6">
                          <button className="flex-1 flex items-center justify-center gap-3 bg-indigo-600 text-white py-5 rounded-[2rem] text-sm font-black hover:bg-indigo-700 transition shadow-xl shadow-indigo-100">
                             <FileText className="w-5 h-5" /> 전문 심사표 출력
                          </button>
                          <button 
                            className="p-5 bg-slate-900 text-white rounded-[2rem] hover:bg-slate-800 transition shadow-xl shadow-slate-200"
                            onClick={() => {
                              setSelectedIds(new Set([selectedApp.id as string]));
                              setTimeout(downloadExcel, 100);
                            }}
                          >
                            <Download className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[600px] flex flex-col items-center justify-center text-center p-16 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-200">
                      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 shadow-xl shadow-slate-200/50">
                        <Search className="w-10 h-10 text-slate-300" />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">선택된 지원서가 없습니다</h3>
                      <p className="text-sm text-slate-400 font-bold leading-relaxed">
                        왼쪽 리스트에서 지원자를 선택하여<br/>
                        상세 이력 확인 및 채용 프로세스를 진행하세요.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* User Management Table Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
              {users.map((u) => (
                <div key={u.uid} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 -translate-y-12 translate-x-12 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
                  <div className="flex flex-col items-center mb-8 relative z-10">
                    <div className="w-20 h-20 bg-slate-900 rounded-[1.5rem] flex items-center justify-center font-black text-white text-3xl group-hover:rotate-12 transition-all duration-500">
                      {u.displayName?.charAt(0) || '?'}
                    </div>
                    <h4 className="font-black text-slate-900 mt-6 text-xl tracking-tight">{u.displayName}</h4>
                    <p className="text-xs text-slate-400 font-bold mt-1">{u.email}</p>
                  </div>
                  
                  <div className="flex flex-col gap-4 pt-8 border-t border-slate-50 relative z-10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">ROLE</span>
                      <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                        {u.role}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">JOINED</span>
                      <span className="text-[10px] text-slate-500 font-bold">{new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
