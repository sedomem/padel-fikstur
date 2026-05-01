import React, { useState, useEffect } from 'react';
import { Trophy, Users, Play, RotateCcw, Shuffle, Check, Plus, Trash2, X, AlertCircle, Lock, LogOut, Cloud, CloudOff, Loader2, Settings2, Edit3, Save, Calendar, Clock, MapPin, Filter } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- FIREBASE YAPILANDIRMASI ---
const firebaseConfig = {
  apiKey: "AIzaSyDGwLbn64sA3sUhJ8kiT_zr-2dsKSzpN_8",
  authDomain: "padel-fikstur.firebaseapp.com",
  projectId: "padel-fikstur",
  storageBucket: "padel-fikstur.firebasestorage.app",
  messagingSenderId: "698895837405",
  appId: "1:698895837405:web:f478ec7488f6f5388bd334",
  measurementId: "G-CE61VW0HJ3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "padel-tourney-v1"; 

const CATEGORIES = ['Program', 'Çift Erkekler', 'Çift Kadınlar', 'Mix Çiftler'];
const MATCH_CATEGORIES = ['Çift Erkekler', 'Çift Kadınlar', 'Mix Çiftler'];

const App = () => {
  // --- DURUM YÖNETİMİ ---
  const [userRole, setUserRole] = useState(null); 
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [fbUser, setFbUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(CATEGORIES[0]);
  const [scheduleFilter, setScheduleFilter] = useState('Tümü');
  
  const [teams, setTeams] = useState({ 'Çift Erkekler': [], 'Çift Kadınlar': [], 'Mix Çiftler': [] });
  const [brackets, setBrackets] = useState({ 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null });
  const [champions, setChampions] = useState({ 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null });
  const [schedule, setSchedule] = useState([]);

  const [scoreModal, setScoreModal] = useState({ isOpen: false, category: null, rIdx: null, mIdx: null, editMode: false });
  const [resetModal, setResetModal] = useState({ isOpen: false, password: '', error: '' });
  const [scheduleModal, setScheduleModal] = useState({ isOpen: false, type: 'event', time: '', label: '', category: MATCH_CATEGORIES[0], court: '1' });

  const sampleTeams = ["Ali & Veli", "Ayşe & Fatma", "Can & Cem", "Deniz & Derya", "Efe & Ege", "Gül & Nur", "Hasan & Hüseyin", "İrem & Sinem"];

  // --- KRİTİK FONKSİYONLAR ---
  
  const syncToCloud = async (updates) => {
    if (userRole !== 'admin') return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main');
      await setDoc(docRef, updates, { merge: true });
    } catch (e) { console.error("Bulut Senkronizasyon Hatası:", e); }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.username === 'Admin' && loginData.password === 'Admin19.!') {
      setUserRole('admin');
      localStorage.setItem('padel_role', 'admin');
      setLoginError('');
    } else {
      setLoginError('Kullanıcı adı veya şifre hatalı!');
    }
  };

  const handleGuestLogin = () => {
    setUserRole('guest');
    localStorage.setItem('padel_role', 'guest');
  };

  const handleLogout = () => {
    setUserRole(null);
    localStorage.removeItem('padel_role');
  };

  // PROGRAM YÖNETİMİ
  const handleAddSchedule = () => {
    try {
      const newItem = {
        id: Date.now(),
        type: scheduleModal.type || 'event',
        time: scheduleModal.time || "00:00",
        label: scheduleModal.label || "İsimsiz Etkinlik",
        category: scheduleModal.type === 'match' ? (scheduleModal.category || MATCH_CATEGORIES[0]) : 'Genel',
        court: scheduleModal.type === 'match' ? (scheduleModal.court || '1') : null
      };
      const newSchedule = [...(schedule || []), newItem]; 
      setSchedule(newSchedule);
      syncToCloud({ schedule: newSchedule });
      setScheduleModal({ isOpen: false, type: 'event', time: '', label: '', category: MATCH_CATEGORIES[0], court: '1' });
    } catch (err) {
      console.error(err);
      alert("Program eklenirken hata oluştu.");
    }
  };

  const removeScheduleItem = (id) => {
    const newSchedule = (schedule || []).filter(item => item.id !== id);
    setSchedule(newSchedule);
    syncToCloud({ schedule: newSchedule });
  };

  // TAKIM VE FİKSTÜR YÖNETİMİ
  const fillRandom = () => {
    const shuffled = [...sampleTeams].sort(() => 0.5 - Math.random());
    const newTeams = { ...teams, [activeTab]: shuffled.slice(0, 8) };
    setTeams(newTeams);
    syncToCloud({ teams: newTeams });
  };

  const handleNameChange = (index, value) => {
    const newTeams = { ...teams };
    newTeams[activeTab][index] = value;
    setTeams(newTeams);
    syncToCloud({ teams: newTeams });
  };

  const addTeam = () => {
    const newTeams = { ...teams, [activeTab]: [...(teams[activeTab] || []), ''] };
    setTeams(newTeams);
    syncToCloud({ teams: newTeams });
  };

  const removeTeam = (index) => {
    const newTeams = { ...teams };
    newTeams[activeTab].splice(index, 1);
    setTeams(newTeams);
    syncToCloud({ teams: newTeams });
  };

  const generateInitialBracket = (validTeams) => {
    const P = Math.pow(2, Math.ceil(Math.log2(validTeams.length)));
    const numMatchesRound0 = P / 2;
    const rounds = [];
    const round0 = [];
    for (let i = 0; i < numMatchesRound0; i++) {
      const t1 = validTeams[i];
      const t2 = (i + numMatchesRound0 < validTeams.length) ? validTeams[i + numMatchesRound0] : null;
      round0.push({ id: `0-${i}`, t1, t2, isBye: t2 === null, winner: t2 === null ? t1 : null, scores: [{t1:'',t2:''}] });
    }
    rounds.push(round0);
    let prevMatches = numMatchesRound0;
    let roundNum = 1;
    while (prevMatches > 1) {
      const currentMatches = prevMatches / 2;
      const round = [];
      for (let i = 0; i < currentMatches; i++) {
        round.push({ id: `${roundNum}-${i}`, t1: rounds[roundNum-1][i*2].winner, t2: rounds[roundNum-1][i*2+1].winner, isBye: false, winner: null, scores: [{t1:'',t2:''}] });
      }
      rounds.push(round);
      prevMatches = currentMatches;
      roundNum++;
    }
    return rounds;
  };

  // BAĞIMSIZ KATEGORİ FİKSTÜR OLUŞTURUCU (Tamamen İzole Edildi)
  const createCategoryBracket = (cat) => {
    if (userRole !== 'admin') return;
    const validTeams = teams[cat]?.filter(t => t && t.trim() !== '') || [];
    if (validTeams.length < 2) {
      alert(`${cat} kategorisinde fikstür için en az 2 takım girmelisiniz!`);
      return;
    }
    const newBrackets = { ...brackets };
    newBrackets[cat] = generateInitialBracket(validTeams);
    setBrackets(newBrackets);
    syncToCloud({ brackets: newBrackets, teams });
  };

  // KATEGORİ FİKSTÜRÜNÜ İPTAL ET
  const resetCategoryBracket = (cat) => {
    if (window.confirm(`${cat} fikstürünü iptal edip takım kayıt ekranına dönmek istediğinize emin misiniz? (Tüm maç sonuçları silinir)`)) {
      const newBrackets = { ...brackets, [cat]: null };
      const newChamps = { ...champions, [cat]: null };
      setBrackets(newBrackets);
      setChampions(newChamps);
      syncToCloud({ brackets: newBrackets, champions: newChamps });
    }
  };

  const handleGlobalReset = () => {
    if (resetModal.password === '1234') {
      const emptyState = { 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null };
      const emptyTeams = { 'Çift Erkekler': [], 'Çift Kadınlar': [], 'Mix Çiftler': [] };
      setBrackets(emptyState);
      setChampions(emptyState);
      setTeams(emptyTeams);
      setSchedule([]);
      syncToCloud({ brackets: emptyState, champions: emptyState, teams: emptyTeams, schedule: [] });
      setResetModal({ isOpen: false, password: '', error: '' });
      setActiveTab('Program');
    } else {
      setResetModal({ ...resetModal, error: 'Şifre Hatalı!' });
    }
  };

  // CANLI MAÇ VERİSİ (Stale State ve Beyaz Ekranı Önler)
  const smCat = scoreModal.category;
  const smR = scoreModal.rIdx;
  const smM = scoreModal.mIdx;
  const currentMatch = (scoreModal.isOpen && smCat && brackets?.[smCat]) ? brackets[smCat][smR][smM] : null;

  const handleScoreSave = () => {
    if (userRole !== 'admin' || !currentMatch) return;
    const newBrackets = { ...brackets };
    const p1 = parseInt(currentMatch.scores[0].t1) || 0;
    const p2 = parseInt(currentMatch.scores[0].t2) || 0;
    const winner = p1 > p2 ? currentMatch.t1 : p2 > p1 ? currentMatch.t2 : null;
    
    if (winner) {
      newBrackets[smCat][smR][smM].winner = winner;
      if (smR + 1 < newBrackets[smCat].length) {
        const nextMi = Math.floor(smM / 2);
        if (smM % 2 === 0) newBrackets[smCat][smR+1][nextMi].t1 = winner;
        else newBrackets[smCat][smR+1][nextMi].t2 = winner;
      } else {
        const nc = { ...champions, [smCat]: winner };
        setChampions(nc);
        syncToCloud({ champions: nc });
      }
    }
    setBrackets(newBrackets);
    setScoreModal({ isOpen: false, category: null, rIdx: null, mIdx: null, editMode: false });
    syncToCloud({ brackets: newBrackets });
  };

  const handleEditSave = () => {
    syncToCloud({ brackets });
    setScoreModal({ isOpen: false, category: null, rIdx: null, mIdx: null, editMode: false });
  };

  const clearMatch = () => {
    if (userRole !== 'admin' || !currentMatch) return;
    const newBrackets = { ...brackets };
    const clearRec = (ri, mi) => {
      const m = newBrackets[smCat][ri][mi];
      m.winner = null; m.scores = [{t1:'',t2:''}];
      if (ri + 1 < newBrackets[smCat].length) {
        const nMi = Math.floor(mi / 2);
        if (mi % 2 === 0) newBrackets[smCat][ri + 1][nMi].t1 = null;
        else newBrackets[smCat][ri + 1][nMi].t2 = null;
        clearRec(ri + 1, nMi);
      }
    };
    clearRec(smR, smM);
    const updChamps = { ...champions, [smCat]: null };
    setBrackets(newBrackets);
    setChampions(updChamps);
    setScoreModal({ isOpen: false, category: null, rIdx: null, mIdx: null, editMode: false });
    syncToCloud({ brackets: newBrackets, champions: updChamps });
  };

  // --- FIREBASE EFFECTS ---
  useEffect(() => {
    const saved = localStorage.getItem('padel_role');
    if (saved) setUserRole(saved);
    onAuthStateChanged(auth, async (u) => {
      if (!u) { try { await signInAnonymously(auth); } catch(e){} } else { setFbUser(u); }
    });
  }, []);

  useEffect(() => {
    if (!fbUser) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main'), (s) => {
      if (s.exists()) {
        const d = s.data();
        if (d.brackets) setBrackets(d.brackets);
        if (d.champions) setChampions(d.champions);
        if (d.teams) setTeams(d.teams);
        if (d.schedule !== undefined) setSchedule(d.schedule || []);
        setIsConnected(true);
      }
      setIsLoading(false);
    });
    return () => unsub();
  }, [fbUser]);

  // --- UI YARDIMCILARI ---
  const isBracketGenerated = activeTab !== 'Program' && Array.isArray(brackets?.[activeTab]);

  // --- YÜKLENİYOR VE GİRİŞ ---
  if (isLoading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
      <p className="text-emerald-100 font-bold text-[8px] tracking-widest">SİSTEME BAĞLANILIYOR</p>
    </div>
  );

  if (!userRole) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm">
        <div className="flex justify-center mb-6"><div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg rotate-3"><Trophy size={28} /></div></div>
        <h1 className="text-xl font-black text-center text-slate-900 mb-6 uppercase italic">Padel Fikstür Pro</h1>
        <form onSubmit={handleLogin} className="space-y-3">
          {loginError && <div className="bg-red-50 text-red-600 text-[9px] p-2 rounded-lg text-center font-bold">{loginError}</div>}
          <input type="text" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border rounded-xl font-bold text-xs outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Kullanıcı Adı" />
          <input type="password" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border rounded-xl font-bold text-xs outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Şifre" />
          <button type="submit" className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl shadow-md uppercase text-[10px] tracking-widest active:scale-95 transition-all">YÖNETİCİ GİRİŞİ</button>
        </form>
        <button onClick={handleGuestLogin} className="w-full mt-3 bg-slate-900 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest"><Users size={14} /> MİSAFİR GİRİŞİ</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans text-slate-900">
      <header className="bg-[#064e3b] text-white p-3 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="text-yellow-400" size={18} />
            <h1 className="font-black text-sm uppercase italic">Padel Fikstür Pro</h1>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[7px] font-black ${isConnected ? 'bg-emerald-400/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
              {isConnected ? <Cloud size={10}/> : <CloudOff size={10}/>}
              <span>{isConnected ? 'CANLI' : '...'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[7px] font-black bg-white/10 px-2 py-1 rounded uppercase">{userRole === 'admin' ? 'ADMİN' : 'İZLEYİCİ'}</span>
             {userRole === 'admin' && (
               <button onClick={() => setResetModal({ isOpen: true, password: '', error: '' })} className="p-1.5 bg-red-600/20 hover:bg-red-600 rounded-lg transition-all" title="Master Reset"><RotateCcw size={14}/></button>
             )}
             <button onClick={handleLogout} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all" title="Çıkış Yap"><LogOut size={14}/></button>
          </div>
        </div>
      </header>

      <main className="flex-grow p-3 sm:p-4 max-w-7xl mx-auto w-full flex flex-col overflow-hidden">
        <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat)} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === cat ? 'bg-[#064e3b] text-white shadow-md' : 'bg-white text-slate-400 hover:text-slate-600'}`}>{cat}</button>
          ))}
        </div>

        {/* --- PROGRAM / TAKVİM GÖRÜNÜMÜ --- */}
        {activeTab === 'Program' ? (
          <div className="flex flex-col gap-4 animate-in fade-in">
             <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                <Filter size={12} className="text-slate-400 shrink-0" />
                {['Tümü', ...MATCH_CATEGORIES, 'Genel'].map(f => (
                  <button key={f} onClick={() => setScheduleFilter(f)} className={`px-3 py-1 rounded-full text-[8px] font-black uppercase transition-all border ${scheduleFilter === f ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{f}</button>
                ))}
             </div>

             <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl border relative">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-sm font-black uppercase italic flex items-center gap-2"><Calendar size={16} className="text-emerald-600"/> Turnuva Akışı</h2>
                  {userRole === 'admin' && (
                    <button onClick={() => setScheduleModal({ ...scheduleModal, isOpen: true })} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black flex items-center gap-1.5 active:scale-95 transition-all"><Plus size={12}/> YENİ EKLE</button>
                  )}
                </div>

                <div className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                   {(schedule || [])
                    .filter(i => scheduleFilter === 'Tümü' || i.category === scheduleFilter || (scheduleFilter === 'Genel' && i.type === 'event'))
                    .sort((a,b) => String(a.time || "00:00").localeCompare(String(b.time || "00:00"))) // Sıralama Çökme Koruması
                    .map(item => (
                      <div key={item.id} className="relative pl-8 group">
                         <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${item.type === 'match' ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                           {item.type === 'match' ? <Play size={8} fill="white" className="text-white"/> : <Clock size={8} className="text-white"/>}
                         </div>
                         <div className={`p-3 rounded-xl border transition-all hover:shadow-md ${item.type === 'match' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex justify-between items-start">
                               <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                     <span className="text-[10px] font-black text-emerald-800 bg-white px-2 py-0.5 rounded shadow-sm">{item.time || "00:00"}</span>
                                     {item.type === 'match' && (
                                       <span className="text-[7px] font-black bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded uppercase">{item.category}</span>
                                     )}
                                  </div>
                                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.label}</h3>
                                  {item.court && (
                                    <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase">
                                       <MapPin size={10}/> Kort {item.court}
                                    </div>
                                  )}
                               </div>
                               {userRole === 'admin' && (
                                 <button onClick={() => removeScheduleItem(item.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={14}/></button>
                               )}
                            </div>
                         </div>
                      </div>
                   ))}
                   {(!schedule || schedule.length === 0) && (
                     <p className="text-center py-10 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Henüz program akışı girilmedi.</p>
                   )}
                </div>
             </div>
          </div>
        ) : (
          /* --- BAĞIMSIZ TURNUVA KATEGORİSİ GÖRÜNÜMÜ --- */
          !isBracketGenerated ? (
            <div className="bg-white rounded-2xl p-6 border shadow-xl max-w-3xl mx-auto w-full animate-in fade-in">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-sm font-black uppercase italic">{activeTab} Takım Kaydı</h2>
                  {userRole === 'guest' && <p className="text-[8px] font-black text-emerald-600 uppercase animate-pulse mt-1">Yönetici takımları hazırlıyor...</p>}
                </div>
                {userRole === 'admin' && (
                  <div className="flex gap-2">
                    <button onClick={fillRandom} className="px-3 py-1.5 text-[8px] font-black bg-slate-100 rounded-lg flex items-center gap-1 uppercase hover:bg-slate-200 transition-colors"><Shuffle size={12}/> Rastgele</button>
                    <button onClick={addTeam} className="px-3 py-1.5 text-[8px] font-black bg-emerald-50 text-emerald-700 rounded-lg flex items-center gap-1 uppercase hover:bg-emerald-100 transition-colors"><Plus size={12}/> Ekle</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 max-h-[300px] overflow-y-auto pr-2">
                {(teams[activeTab] || []).map((team, index) => (
                  <div key={index} className="group bg-slate-50 border p-2 rounded-lg flex items-center gap-2 transition-all hover:border-emerald-200">
                    <span className="w-4 text-[8px] font-black text-slate-300">#{index+1}</span>
                    {userRole === 'admin' ? (
                      <input type="text" value={team} onChange={(e) => handleNameChange(index, e.target.value)} className="flex-grow bg-transparent font-bold text-xs outline-none" placeholder="Takım Adı" />
                    ) : (
                      <span className="flex-grow font-bold text-xs text-slate-700">{team || 'Bekleniyor...'}</span>
                    )}
                    {userRole === 'admin' && (
                      <button onClick={() => removeTeam(index)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12}/></button>
                    )}
                  </div>
                ))}
                {(!teams[activeTab] || teams[activeTab].length === 0) && userRole === 'guest' && (
                   <p className="text-[9px] font-bold text-slate-400 col-span-full text-center py-4 uppercase tracking-widest">Bu kategoriye henüz takım eklenmedi.</p>
                )}
              </div>
              {userRole === 'admin' && (
                <button onClick={() => createCategoryBracket(activeTab)} className="w-full bg-[#064e3b] text-white font-black py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-widest italic active:scale-95 transition-all"><Play size={16} fill="currentColor"/> {activeTab} Fikstürünü Oluştur</button>
              )}
            </div>
          ) : (
            <div className="flex-grow overflow-x-auto bg-white border rounded-2xl p-4 shadow-inner animate-in fade-in">
              <div className="flex justify-between items-center mb-4 px-2">
                 <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">{activeTab} Eşleşmeleri</h3>
                 {userRole === 'admin' && (
                   <button onClick={() => resetCategoryBracket(activeTab)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[8px] font-black flex items-center gap-1 hover:bg-red-100 transition-colors uppercase"><RotateCcw size={12}/> Fikstürü İptal Et</button>
                 )}
              </div>
              
              <div className="flex gap-8 min-w-max h-full items-center px-2">
                {brackets[activeTab].map((round, rIdx) => (
                  <div key={rIdx} className="flex flex-col gap-6 w-44">
                    <h4 className="text-center text-[7px] font-black text-slate-400 uppercase tracking-widest">{rIdx === brackets[activeTab].length - 1 ? 'BÜYÜK FİNAL' : `TUR ${rIdx + 1}`}</h4>
                    <div className="flex flex-col justify-around gap-4 h-full">
                      {round.map((match, mIdx) => (
                        <div key={mIdx} 
                             className={`group relative bg-white border-2 rounded-xl shadow-sm transition-all ${userRole === 'admin' && !match.isBye ? 'cursor-pointer hover:border-emerald-500' : 'border-slate-50'}`}
                             onClick={() => { if(userRole === 'admin' && !match.isBye && match.t1 && match.t2) setScoreModal({ isOpen: true, category: activeTab, rIdx, mIdx, editMode: false }); }}>
                          <div className="p-2 space-y-1.5">
                            {[ {n: match.t1, s: match.scores?.[0]?.t1 || '0', win: match.winner === match.t1}, {n: match.t2, s: match.scores?.[0]?.t2 || '0', win: match.winner === match.t2} ].map((side, i) => (
                              <div key={i} className={`flex justify-between items-center p-1.5 rounded-lg text-[9px] font-black transition-all ${side.win ? 'bg-[#064e3b] text-white' : 'bg-slate-50 text-slate-600'}`}>
                                <span className="truncate max-w-[90px] flex items-center gap-1.5">{side.win && <Check size={10}/>}{side.n || '...'}</span>
                                <span className={`w-4 h-4 flex items-center justify-center rounded-md text-[8px] font-black ${side.win ? 'bg-emerald-400/30' : 'bg-white border text-[#064e3b]'}`}>{side.s}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="w-40 flex flex-col items-center gap-4 pl-6 border-l border-slate-100">
                   <div className={`p-8 rounded-3xl border-4 flex items-center justify-center ${champions?.[activeTab] ? 'bg-yellow-50 border-yellow-400 shadow-lg animate-bounce' : 'bg-slate-50 border-slate-200 opacity-20'}`}>
                      <Trophy size={32} className={champions?.[activeTab] ? 'text-yellow-500' : 'text-slate-300'}/>
                   </div>
                   <div className="text-center">
                     <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Şampiyon</p>
                     <p className="text-xs font-black text-slate-900 uppercase italic leading-tight">{champions?.[activeTab] || '...'}</p>
                   </div>
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {/* --- PROGRAM EKLEME MODAL (ADMİN) --- */}
      {scheduleModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 shadow-2xl">
             <div className="bg-[#064e3b] p-4 text-white flex justify-between items-center">
                <h3 className="font-black uppercase text-xs italic tracking-widest">Programa Ekle</h3>
                <button onClick={() => setScheduleModal({ ...scheduleModal, isOpen: false })}><X size={18}/></button>
             </div>
             <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => setScheduleModal({...scheduleModal, type: 'event'})} className={`py-2 rounded-lg text-[9px] font-black border transition-all ${scheduleModal.type === 'event' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-400'}`}>GENEL ETKİNLİK</button>
                   <button onClick={() => setScheduleModal({...scheduleModal, type: 'match'})} className={`py-2 rounded-lg text-[9px] font-black border transition-all ${scheduleModal.type === 'match' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-400'}`}>MAÇ PROGRAMI</button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Saat</label>
                    <input type="time" value={scheduleModal.time} onChange={e => setScheduleModal({...scheduleModal, time: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg text-xs font-bold outline-none focus:border-emerald-500" />
                  </div>
                  {scheduleModal.type === 'match' && (
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Kort</label>
                      <select value={scheduleModal.court} onChange={e => setScheduleModal({...scheduleModal, court: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg text-xs font-bold outline-none focus:border-emerald-500">
                        <option value="1">Kort 1</option><option value="2">Kort 2</option><option value="3">Kort 3</option>
                      </select>
                    </div>
                  )}
                </div>

                {scheduleModal.type === 'match' && (
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Kategori</label>
                    <select value={scheduleModal.category} onChange={e => setScheduleModal({...scheduleModal, category: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg text-xs font-bold outline-none focus:border-emerald-500">
                      {MATCH_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">{scheduleModal.type === 'match' ? 'Eşleşme' : 'Etkinlik Adı'}</label>
                  <input type="text" value={scheduleModal.label} onChange={e => setScheduleModal({...scheduleModal, label: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg text-xs font-bold outline-none focus:border-emerald-500" placeholder={scheduleModal.type === 'match' ? "Örn: Takım A vs Takım B" : "Örn: Öğle Yemeği"} />
                </div>

                <button onClick={handleAddSchedule} className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl text-[10px] tracking-widest uppercase shadow-lg active:scale-95 transition-all mt-2">KAYDET VE YAYINLA</button>
             </div>
          </div>
        </div>
      )}

      {/* --- SKOR & DÜZENLEME MODAL --- */}
      {scoreModal.isOpen && currentMatch && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 shadow-2xl">
            <div className="bg-[#064e3b] p-4 text-white flex justify-between items-center">
              <h3 className="font-black uppercase text-xs italic tracking-widest">{scoreModal.editMode ? 'Takımları Düzenle' : 'Maç Sonucu'}</h3>
              <button onClick={() => setScoreModal({ isOpen: false, category: null, rIdx: null, mIdx: null, editMode: false })}><X size={18}/></button>
            </div>
            <div className="p-6 space-y-6 text-center">
               {[ {n: currentMatch.t1, id: 't1'}, {n: currentMatch.t2, id: 't2'} ].map(side => (
                 <div key={side.id} className="space-y-2">
                   {scoreModal.editMode ? (
                     <div className="text-left space-y-1 px-4">
                       <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Takım İsmi</label>
                       <input type="text" value={side.n || ''} onChange={(e) => {
                         const nb = {...brackets}; nb[smCat][smR][smM][side.id] = e.target.value; setBrackets(nb);
                       }} className="w-full p-2.5 bg-slate-50 border rounded-lg font-bold text-xs outline-none focus:ring-1 focus:ring-emerald-500" />
                     </div>
                   ) : (
                     <>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate px-6 leading-tight">{side.n || '...'}</p>
                        <input type="number" value={currentMatch.scores[0][side.id]} onChange={(e) => {
                          const nb = {...brackets}; nb[smCat][smR][smM].scores[0][side.id] = e.target.value; setBrackets(nb);
                        }} className="w-16 text-center p-2 bg-slate-50 border rounded-xl font-black text-xl text-emerald-700 shadow-inner outline-none" />
                     </>
                   )}
                 </div>
               ))}
               <div className="space-y-2 pt-2 border-t px-2">
                  <button onClick={() => scoreModal.editMode ? handleEditSave() : handleScoreSave()} className="w-full bg-[#064e3b] text-white font-black py-3 rounded-lg text-[9px] tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                    {scoreModal.editMode ? <Save size={12}/> : null} {scoreModal.editMode ? 'KAYDET' : 'SKORU YAYINLA'}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setScoreModal({ ...scoreModal, editMode: !scoreModal.editMode })} className="flex-1 bg-slate-100 text-slate-600 font-bold py-2 rounded-lg text-[8px] uppercase flex items-center justify-center gap-1 hover:bg-slate-200 transition-colors">
                      {scoreModal.editMode ? <X size={12}/> : <Edit3 size={12}/>} {scoreModal.editMode ? 'İptal' : 'Düzenle'}
                    </button>
                    {!scoreModal.editMode && (
                      <button onClick={clearMatch} className="flex-1 bg-red-50 text-red-600 font-bold py-2 rounded-lg text-[8px] uppercase flex items-center justify-center gap-1 hover:bg-red-100 transition-colors">
                        <RotateCcw size={12}/> Sıfırla
                      </button>
                    )}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MASTER RESET MODAL --- */}
      {resetModal.isOpen && (
        <div className="fixed inset-0 bg-red-950/90 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-in zoom-in duration-200 text-center">
            <h3 className="font-black uppercase text-sm text-red-600 mb-4 tracking-widest italic">MASTER RESET</h3>
            <p className="text-[9px] font-bold text-slate-500 mb-4 uppercase">Her şeyi silmek için şifreyi (1234) girin.</p>
            <input type="password" value={resetModal.password} onChange={(e) => setResetModal({ ...resetModal, password: e.target.value })} className={`w-full text-center p-3 bg-slate-50 border-2 rounded-xl font-black text-xl mb-4 outline-none ${resetModal.error ? 'border-red-500' : 'border-slate-100 focus:border-red-600'}`} placeholder="****" />
            {resetModal.error && <p className="text-red-600 text-[8px] font-bold uppercase mb-2">{resetModal.error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setResetModal({ ...resetModal, isOpen: false, error: '' })} className="flex-1 bg-slate-100 font-black py-3 rounded-xl text-[10px] uppercase hover:bg-slate-200 transition-colors">İPTAL</button>
              <button onClick={handleGlobalReset} className="flex-1 bg-red-600 text-white font-black py-3 rounded-xl text-[10px] uppercase shadow-lg active:scale-95 transition-all">ONAYLA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
