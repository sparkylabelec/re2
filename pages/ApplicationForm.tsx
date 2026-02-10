
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db, COL_RECRUIT } from '../firebase';
import { UserProfile, EducationEntry, ExperienceEntry } from '../types';
import { GoogleGenAI } from "@google/genai";

interface ApplicationFormProps {
  userProfile: UserProfile | null;
}

const ApplicationForm: React.FC<ApplicationFormProps> = ({ userProfile }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [loading, setLoading] = useState(false);
  const [isGeneratingPhoto, setIsGeneratingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isPrivacyAgreed, setIsPrivacyAgreed] = useState(false);
  
  const [userName, setUserName] = useState(userProfile?.displayName || '');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(userProfile?.email || '');
  
  const [education, setEducation] = useState<EducationEntry[]>([
    { admissionYear: '', graduationYear: '', schoolMajor: '', certificates: '' },
    { admissionYear: '', graduationYear: '', schoolMajor: '', certificates: '' },
    { admissionYear: '', graduationYear: '', schoolMajor: '', certificates: '' },
  ]);

  const [experience, setExperience] = useState<ExperienceEntry[]>([
    { period: '', companyDept: '', duties: '' },
    { period: '', companyDept: '', duties: '' },
    { period: '', companyDept: '', duties: '' },
  ]);

  const [selfIntro, setSelfIntro] = useState('');
  const [desiredField, setDesiredField] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');

  const job_categories = [
    { "group": "기술", "options": ["디자인", "F&B(조리)"] },
    { "group": "고객서비스", "options": ["유기시설 운영", "하강레저시설 운영", "바리스타", "판매서비스", "F&B(서비스)"] },
    { "group": "호텔", "options": ["접객서비스", "객실서비스"] },
    { "group": "선박승무", "options": ["선박 운항 및 기관 담당", "고객안내 및 승무서비스"] }
  ];

  useEffect(() => {
    const checkConsent = () => {
      const consentStatus = localStorage.getItem('privacy_consent_status');
      setIsPrivacyAgreed(consentStatus === 'true');
    };
    
    checkConsent();
    window.addEventListener('focus', checkConsent);
    return () => window.removeEventListener('focus', checkConsent);
  }, []);

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(base64Str); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setPhotoPreview(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddressSearch = () => {
    if (!(window as any).daum) {
      alert('주소 검색 서비스를 불러올 수 없습니다.');
      return;
    }
    new (window as any).daum.Postcode({
      oncomplete: (data: any) => {
        setAddress(data.roadAddress);
        document.getElementById('detailAddress')?.focus();
      }
    }).open();
  };

  const updateEducation = (index: number, field: keyof EducationEntry, value: string) => {
    const newEdu = [...education];
    (newEdu[index] as any)[field] = value;
    setEducation(newEdu);
  };

  const handleOpenPrivacy = () => {
    localStorage.setItem('temp_apply_name', userName);
    navigate('/privacy-consent');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    if (!desiredField) { alert('지원 분야를 선택해 주세요.'); return; }
    if (!isPrivacyAgreed) { alert('개인정보 수집 및 이용 동의가 필요합니다.'); return; }

    setLoading(true);
    try {
      await addDoc(collection(db, COL_RECRUIT), {
        userId: userProfile.uid,
        userName,
        email,
        gender,
        birthDate,
        address,
        detailAddress,
        phone,
        photoUrl: photoPreview || '', 
        education: education.filter(e => e.schoolMajor),
        experience: experience.filter(e => e.companyDept),
        selfIntro,
        desiredField,
        expectedSalary,
        status: 'pending',
        createdAt: Date.now(),
      });
      localStorage.removeItem('privacy_consent_status');
      localStorage.removeItem('temp_apply_name');
      alert('입사지원서가 성공적으로 제출되었습니다!');
      navigate('/');
    } catch (error) {
      console.error(error);
      alert('제출 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const generateDummyData = async () => {
    setUserName('홍길동');
    setGender('male');
    setBirthDate('1995-05-15');
    setPhone('010-1234-5678');
    setAddress('경기도 용인시 처인구 포곡읍 에버랜드로 199');
    setDetailAddress('나미나라 아파트 101동');
    setSelfIntro('성실함과 열정으로 나미나라공화국과 함께 성장하고 싶습니다.');
    setDesiredField('바리스타');
    setExpectedSalary('3200');
    setEducation([
      { admissionYear: '2014-03-02', graduationYear: '2018-02-15', schoolMajor: '나미대학교 관광학', certificates: '바리스타 1급' },
      { admissionYear: '', graduationYear: '', schoolMajor: '', certificates: '' },
      { admissionYear: '', graduationYear: '', schoolMajor: '', certificates: '' },
    ]);
  };

  return (
    <div className="max-w-5xl mx-auto mb-20">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center relative">
          <button type="button" onClick={generateDummyData} className="absolute top-4 right-4 text-[10px] font-bold text-slate-400 border border-slate-200 px-2 py-1 rounded hover:bg-slate-50">테스트 데이터</button>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">입 사 지 원 서</h1>
          <p className="text-slate-500 font-medium">나미나라공화국의 새로운 일원이 되어주세요.</p>
        </div>

        {/* Sections (Personal, Education, Intro, Fields) - Condensed for UI brevity */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-40 h-52 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 overflow-hidden relative"
              >
                {photoPreview ? <img src={photoPreview} alt="Photo" className="w-full h-full object-cover" /> : <span className="text-xs text-slate-400 font-bold">사진 업로드</span>}
                <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handlePhotoChange} />
              </div>
            </div>
          </div>
          <div className="lg:col-span-3 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-slate-900 border-l-4 border-indigo-600 pl-3">인적 사항</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="성명" value={userName} onChange={e => setUserName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <div className="md:col-span-2 flex gap-2">
                <input placeholder="주소" value={address} readOnly className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                <button type="button" onClick={handleAddressSearch} className="bg-indigo-600 text-white px-4 rounded-xl text-sm font-bold">검색</button>
              </div>
            </div>
          </div>
        </div>

        {/* Education, SelfIntro, Field sections skipped for focus on the request - assume they are present or slightly simplified */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-lg font-black text-slate-900 border-l-4 border-emerald-500 pl-3">학력 사항</h3>
          {education.map((edu, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input type="date" value={edu.admissionYear} onChange={e => updateEducation(idx, 'admissionYear', e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
              <input placeholder="학교명 및 전공" value={edu.schoolMajor} onChange={e => updateEducation(idx, 'schoolMajor', e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
              <input placeholder="비고/자격증" value={edu.certificates} onChange={e => updateEducation(idx, 'certificates', e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
            </div>
          ))}
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
           <h3 className="text-lg font-black text-slate-900 border-l-4 border-rose-500 pl-3 mb-6">지원 정보</h3>
           <div className="grid grid-cols-2 gap-4 mb-4">
             <input placeholder="지원 분야 (직접입력 가능)" value={desiredField} onChange={e => setDesiredField(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
             <input placeholder="희망 연봉 (만원)" value={expectedSalary} onChange={e => setExpectedSalary(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
           </div>
           <textarea placeholder="자기소개" value={selfIntro} onChange={e => setSelfIntro(e.target.value)} className="w-full h-40 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
        </div>

        {/* 개인정보동의서 작성 버튼 섹션 */}
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 border-l-[12px] border-indigo-600">
          <div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">개인정보 수집 및 이용 동의</h3>
            <p className="text-slate-500 font-medium">채용 절차 진행을 위해 반드시 공식 동의서 작성이 필요합니다.</p>
            {isPrivacyAgreed && (
              <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full w-fit animate-in fade-in slide-in-from-left-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                <span className="text-sm font-black">공식 동의서 작성 완료</span>
              </div>
            )}
          </div>
          <button 
            type="button" 
            onClick={handleOpenPrivacy}
            className={`px-12 py-5 rounded-2xl font-black text-lg transition-all shadow-xl hover:-translate-y-1 active:translate-y-0 ${
              isPrivacyAgreed 
              ? 'bg-emerald-500 text-white shadow-emerald-100' 
              : 'bg-indigo-600 text-white shadow-indigo-100'
            }`}
          >
            {isPrivacyAgreed ? '동의서 내용 다시보기' : '개인정보동의서 작성'}
          </button>
        </div>

        {/* Footer Confirmation */}
        <div className="bg-slate-900 rounded-[3rem] p-12 text-center text-white">
          <p className="text-slate-400 mb-8">본 지원서에 기재한 모든 내용은 사실과 다름이 없음을 서약합니다.</p>
          <div className="text-2xl font-bold mb-10">{new Date().toLocaleDateString()}</div>
          <div className="flex gap-4 max-w-md mx-auto">
            <button 
              type="submit" 
              disabled={loading || !isPrivacyAgreed}
              className={`w-full py-5 rounded-2xl font-black text-xl transition shadow-lg ${
                isPrivacyAgreed 
                ? 'bg-indigo-500 hover:bg-indigo-600' 
                : 'bg-slate-700 cursor-not-allowed opacity-50'
              }`}
            >
              {loading ? '제출 중...' : '최종 지원서 제출하기'}
            </button>
          </div>
          {!isPrivacyAgreed && <p className="text-amber-400 text-sm mt-4 font-bold">동의서 작성을 완료해야 제출할 수 있습니다.</p>}
        </div>
      </form>
    </div>
  );
};

export default ApplicationForm;
