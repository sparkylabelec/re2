
import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db, COL_RECRUIT, COL_USERS } from '../firebase';
import { RecruitApplication, UserProfile } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminDashboard: React.FC = () => {
  const [applications, setApplications] = useState<RecruitApplication[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'applications' | 'users'>('applications');
  const [selectedApp, setSelectedApp] = useState<RecruitApplication | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Selection State
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());

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
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

  // Batch Update Status
  const handleBatchUpdateStatus = async (newStatus: RecruitApplication['status']) => {
    if (selectedAppIds.size === 0) return;
    if (!window.confirm(`${selectedAppIds.size}명의 상태를 '${newStatus}'(으)로 변경하시겠습니까?`)) return;

    setLoading(true);
    try {
      const batch = writeBatch(db);
      selectedAppIds.forEach(id => {
        const docRef = doc(db, COL_RECRUIT, id);
        batch.update(docRef, { status: newStatus });
      });
      await batch.commit();
      
      setApplications(prev => prev.map(a => selectedAppIds.has(a.id!) ? { ...a, status: newStatus } : a));
      setSelectedAppIds(new Set());
      alert('일괄 처리가 완료되었습니다.');
    } catch (err) {
      console.error(err);
      alert('일괄 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Excel (CSV) Download Logic
  const downloadAsExcel = () => {
    if (selectedAppIds.size === 0) {
      alert('다운로드할 항목을 먼저 선택해주세요.');
      return;
    }

    const selectedData = applications.filter(app => selectedAppIds.has(app.id!));
    
    // CSV Header
    const headers = ['성명', '이메일', '연락처', '지원분야', '희망급여(만원)', '심사상태', '제출일'];
    
    // CSV Rows
    const rows = selectedData.map(app => [
      app.userName,
      app.email,
      app.phone,
      app.desiredField,
      app.expectedSalary,
      app.status === 'pending' ? '심사대기' : app.status === 'reviewed' ? '검토완료' : app.status === 'accepted' ? '합격' : '불합격',
      new Date(app.createdAt).toLocaleDateString()
    ]);

    // Create CSV String
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Add UTF-8 BOM for Excel Korean support
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `나미나라_입사지원서_명단_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectAll = () => {
    if (selectedAppIds.size === filteredApplications.length) {
      setSelectedAppIds(new Set());
    } else {
      setSelectedAppIds(new Set(filteredApplications.map(app => app.id!)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedAppIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedAppIds(newSet);
  };

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    reviewed: applications.filter(a => a.status === 'reviewed').length,
    accepted: applications.filter(a => a.status === 'accepted').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  const filteredApplications = filterStatus === 'all' 
    ? applications 
    : applications.filter(app => app.status === filterStatus);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">인재 관리 시스템</h1>
          <p className="text-slate-500 mt-2 font-medium">나미나라공화국의 미래를 함께할 인재들을 검토하고 관리합니다.</p>
        </div>
        
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex shadow-sm">
          <button 
            onClick={() => setActiveTab('applications')}
            className={`px-8 py-3 rounded-xl font-black transition-all text-sm ${activeTab === 'applications' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            지원서 관리
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-8 py-3 rounded-xl font-black transition-all text-sm ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            회원 현황
          </button>
        </div>
      </div>

      {activeTab === 'applications' ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Status Summary (a. 지원현황) */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-[6px] border-slate-900">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">전체 지원서</p>
              <p className="text-3xl font-black text-slate-900">{stats.total}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-[6px] border-amber-400">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">심사 대기</p>
              <p className="text-3xl font-black text-amber-500">{stats.pending}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-[6px] border-indigo-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">서류 검토중</p>
              <p className="text-3xl font-black text-indigo-500">{stats.reviewed}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-[6px] border-emerald-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">합격</p>
              <p className="text-3xl font-black text-emerald-500">{stats.accepted}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-[6px] border-rose-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">불합격</p>
              <p className="text-3xl font-black text-rose-500">{stats.rejected}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* List Management (b. 리스트 관리) */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Floating Action Bar for Selections */}
              {selectedAppIds.size > 0 && (
                <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center gap-4 ml-4">
                    <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-xs font-black">{selectedAppIds.size}</span>
                    <p className="text-sm font-bold">항목이 선택되었습니다.</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={downloadAsExcel}
                      className="bg-white text-slate-900 px-6 py-2 rounded-xl text-xs font-black hover:bg-slate-100 transition flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      Excel 다운로드
                    </button>
                    <button 
                      onClick={() => handleBatchUpdateStatus('accepted')}
                      className="bg-emerald-500 text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-emerald-600 transition"
                    >
                      일괄 합격처리
                    </button>
                    <button 
                      onClick={() => setSelectedAppIds(new Set())}
                      className="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/20 transition"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                {/* Filter Header */}
                <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">지원서 리스트</h3>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {['all', 'pending', 'reviewed', 'accepted', 'rejected'].map(s => (
                      <button 
                        key={s}
                        onClick={() => { setFilterStatus(s); setSelectedAppIds(new Set()); }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border shrink-0 ${
                          filterStatus === s 
                          ? 'bg-slate-900 text-white border-slate-900' 
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {s === 'all' ? '전체' : s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-slate-50">
                        <th className="pl-8 py-4 w-10">
                          <input 
                            type="checkbox" 
                            checked={selectedAppIds.size === filteredApplications.length && filteredApplications.length > 0}
                            onChange={toggleSelectAll}
                            className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">지원자 정보</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">지원 분야</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">심사 상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredApplications.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium italic">해당하는 지원서가 없습니다.</td>
                        </tr>
                      ) : (
                        filteredApplications.map((app) => (
                          <tr 
                            key={app.id} 
                            className={`cursor-pointer transition-all group ${selectedAppIds.has(app.id!) ? 'bg-indigo-50/40' : 'hover:bg-slate-50'} ${selectedApp?.id === app.id ? 'bg-indigo-50/70' : ''}`}
                          >
                            <td className="pl-8 py-5" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={selectedAppIds.has(app.id!)}
                                onChange={() => toggleSelectOne(app.id!)}
                                className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-5" onClick={() => setSelectedApp(app)}>
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-14 bg-slate-100 rounded-xl flex-shrink-0 overflow-hidden border border-slate-200 group-hover:scale-105 transition-transform">
                                  {app.photoUrl ? (
                                    <img src={app.photoUrl} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition">{app.userName}</div>
                                  <div className="text-[11px] text-slate-400 font-medium">{app.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-5" onClick={() => setSelectedApp(app)}>
                              <div className="text-sm font-black text-slate-700">{app.desiredField}</div>
                              <div className="text-[11px] text-slate-400 font-medium">{app.expectedSalary}만원</div>
                            </td>
                            <td className="px-8 py-5" onClick={() => setSelectedApp(app)}>
                              <div className="flex justify-center">
                                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                                  app.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                  app.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                  app.status === 'reviewed' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                  'bg-amber-50 text-amber-700 border-amber-100'
                                }`}>
                                  {app.status === 'pending' ? '서류 심사중' : 
                                   app.status === 'reviewed' ? '검토 완료' :
                                   app.status === 'accepted' ? '최종 합격' : '불합격'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Application Detail Side View */}
            <div className="lg:col-span-1 sticky top-24">
              {selectedApp ? (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-right-10 duration-500">
                  {/* Detail Header */}
                  <div className="bg-slate-900 p-8 text-white relative">
                    <button 
                      onClick={() => setSelectedApp(null)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-24 bg-white/10 rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
                        {selectedApp.photoUrl ? (
                          <img src={selectedApp.photoUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                          </div>
                        )}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black">{selectedApp.userName}</h2>
                        <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mt-1">{selectedApp.desiredField} 지원자</p>
                        <div className="mt-3 inline-block px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold">
                          제출일: {new Date(selectedApp.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-8 max-h-[calc(100vh-350px)] overflow-y-auto custom-scrollbar">
                    {/* Status Controller */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">심사 상태 업데이트</label>
                      <div className="flex flex-col gap-2">
                        <select 
                          value={selectedApp.status}
                          onChange={(e) => handleUpdateStatus(selectedApp.id!, e.target.value as any)}
                          className={`w-full px-4 py-4 rounded-2xl text-sm font-black outline-none border-2 transition-all appearance-none cursor-pointer ${
                            selectedApp.status === 'accepted' ? 'border-emerald-500 text-emerald-600 bg-emerald-50/30' :
                            selectedApp.status === 'rejected' ? 'border-rose-500 text-rose-600 bg-rose-50/30' :
                            selectedApp.status === 'reviewed' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/30' :
                            'border-amber-400 text-amber-600 bg-amber-50/30'
                          }`}
                        >
                          <option value="pending">서류 심사 대기</option>
                          <option value="reviewed">서류 검토 완료</option>
                          <option value="accepted">최종 합격</option>
                          <option value="rejected">불합격</option>
                        </select>
                      </div>
                    </div>

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl">
                        <p className="text-[10px] text-slate-400 font-black mb-1">성별 / 생년월일</p>
                        <p className="text-sm font-bold text-slate-700">
                          {selectedApp.gender === 'male' ? '남성' : '여성'} / {selectedApp.birthDate}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl">
                        <p className="text-[10px] text-slate-400 font-black mb-1">연락처</p>
                        <p className="text-sm font-bold text-slate-700">{selectedApp.phone}</p>
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">거주지 주소</h4>
                      <p className="text-sm font-bold text-slate-700">{selectedApp.address}</p>
                      <p className="text-xs font-bold text-indigo-600 mt-1">{selectedApp.detailAddress}</p>
                    </div>

                    {/* Education */}
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">학력 사항</h4>
                      <div className="space-y-2">
                        {selectedApp.education.map((edu, idx) => (
                          <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-black text-slate-900">{edu.schoolMajor}</span>
                              <span className="text-[10px] text-slate-400 font-bold">{edu.graduationYear.split('-')[0]}년 졸업</span>
                            </div>
                            <p className="text-[10px] text-indigo-600 font-bold">{edu.certificates}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Self Intro */}
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">자기 소개서</h4>
                      <div className="bg-slate-50 p-6 rounded-3xl text-sm leading-relaxed text-slate-600 whitespace-pre-wrap font-medium">
                        {selectedApp.selfIntro}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Bar */}
                  <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                    <button className="flex-1 bg-white border border-slate-200 py-4 rounded-2xl text-sm font-black text-slate-700 hover:bg-slate-100 transition shadow-sm">인쇄하기</button>
                    <button 
                      onClick={() => handleUpdateStatus(selectedApp.id!, 'reviewed')}
                      className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl text-sm font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                    >
                      검토 완료 처리
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[3rem] p-16 text-center h-[600px] flex flex-col items-center justify-center animate-in fade-in duration-700">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-2">심사할 지원자를 선택하세요</h4>
                  <p className="text-sm text-slate-400 font-medium leading-relaxed">목록에서 지원자를 클릭하면<br/>상세한 서류 검토 및 합격 처리가 가능합니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Users List Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
          {users.map((u) => (
            <div key={u.uid} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 hover:shadow-xl transition-all group relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-16 h-16 transition-all opacity-10 flex items-center justify-center ${u.role === 'admin' ? 'text-purple-600' : 'text-indigo-600'}`}>
                {u.role === 'admin' ? (
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                ) : (
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                )}
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl mb-4 group-hover:scale-110 transition-transform ${u.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  {u.displayName?.charAt(0) || '?'}
                </div>
                <h4 className="text-xl font-black text-slate-900 mb-1">{u.displayName}</h4>
                <p className="text-xs text-slate-400 font-medium mb-6">{u.email}</p>
                
                <div className="w-full flex items-center justify-between pt-6 border-t border-slate-100">
                  <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                    {u.role === 'admin' ? 'ADMIN' : 'USER'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{new Date(u.createdAt).toLocaleDateString()} 가입</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
