import React, { useState, useEffect } from 'react';
import { Trophy, Users, Play, RotateCcw, Shuffle, Check, Plus, Trash2, X, AlertCircle, Lock, LogOut, Cloud, CloudOff, Loader2, Settings2 } from 'lucide-react';
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

const CATEGORIES = ['Çift Erkekler', 'Çift Kadınlar', 'Mix Çiftler'];

const App = () => {
  // --- DURUM YÖNETİMİ ---
  const [userRole, setUserRole] = useState(null); 
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [fbUser, setFbUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [phase, setPhase] = useState('setup'); 
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [teams, setTeams] = useState({ 'Çift Erkekler': [], 'Çift Kadınlar': [], 'Mix Çiftler': [] });
  const [brackets, setBrackets] = useState({ 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null });
  const [champions, setChampions] = useState({ 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null });

  const [scoreModal, setScoreModal] = useState({ isOpen: false, category: null, rIdx: null, mIdx: null, matchData: null });
  const [resetModal, setResetModal] = useState({ isOpen: false, password: '', error: '' });

  const sampleTeams = ["Ali & Veli", "Ayşe & Fatma", "Can & Cem", "Deniz & Derya", "Efe & Ege", "Gül & Nur", "Hasan & Hüseyin", "İrem & Sinem", "Kaan & Mert", "Arda & Enes", "Buse & Pelin", "Emre & Melis"];

  // --- TEMEL FONKSİYONLAR (Hataları Önlemek İçin En Üstte) ---
  
  const syncToCloud = async (updates) => {
    if (userRole !== 'admin') return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main');
      await setDoc(docRef, updates, { merge: true });
    } catch (e) { console.error("Bulut senkronizasyon hatası:", e); }
  };

  const handleLogout = () => {
    setUserRole(null);
    setLoginData({ username: '', password: '' });
  };

  const fillRandom = () => {
    if (userRole !== 'admin') return;
    // Mevcut listeyi karıştır ve ilk 8 ismi al
    const shuffled = [...sampleTeams].sort(() => 0.5 - Math.random());
    const randomSelection = shuffled.slice(0, 8);
    
    const newTeams = { ...teams };
    newTeams[activeCategory] = randomSelection;
    setTeams(newTeams);
    syncToCloud({ teams: newTeams });
  };

  const handleNameChange = (index, value) => {
    if (userRole !== 'admin') return;
    const newTeams = { ...teams };
    if (!newTeams[activeCategory]) newTeams[activeCategory] = [];
    newTeams[activeCategory][index] = value;
    setTeams(newTeams);
    syncToCloud({ teams: newTeams });
  };

  const addTeam = () => {
    if (userRole !== 'admin') return;
    const newTeams = { ...teams };
    if (!newTeams[activeCategory]) newTeams[activeCategory] = [];
    newTeams[activeCategory] = [...newTeams[activeCategory], ''];
    setTeams(newTeams);
    syncToCloud({ teams: newTeams });
  };

  const removeTeam = (index) => {
    if (userRole !== 'admin') return;
    const newTeams = { ...teams };
    newTeams[activeCategory].splice(index, 1);
    setTeams(newTeams);
    syncToCloud({ teams: newTeams });
  };

  const handleGlobalReset = () => {
    if (resetModal.password === '1234') {
      const emptyBrackets = { 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null };
      const emptyTeams = { 'Çift Erkekler': [], 'Çift Kadınlar': [], 'Mix Çiftler': [] };
      setPhase('setup');
      setBrackets(emptyBrackets);
      setChampions(emptyBrackets);
      setTeams(emptyTeams);
      syncToCloud({ phase: 'setup', brackets: emptyBrackets, champions: emptyBrackets, teams: emptyTeams });
      setResetModal({ isOpen: false, password: '', error: '' });
    } else {
      setResetModal({ ...resetModal, error: 'Şifre Hatalı!' });
    }
  };

  // --- TURNAVA MANTIĞI ---

  const generateInitialBracket = (validTeams) => {
    const P = Math.pow(2, Math.ceil(Math.log2(validTeams.length)));
    const numMatchesRound0 = P / 2;
    const rounds = [];
    const round0 = [];
    for (let i = 0; i < numMatchesRound0; i++) {
      const t1 = validTeams[i];
      const t2 = (i + numMatchesRound0 < validTeams.length) ? validTeams[i + numMatchesRound0] : null;
      round0.push({ 
        id: `0-${i}`, t1, t2, isBye: t2 === null, winner: t2 === null ? t1 : null, 
        scores: [{t1:'',t2:''}] 
      });
    }
    rounds.push(round0);
    let prevMatches = numMatchesRound0;
    let roundNum = 1;
    while (prevMatches > 1) {
      const currentMatches = prevMatches / 2;
      const round = [];
      for (let i = 0; i < currentMatches; i++) {
        round.push({ 
          id: `${roundNum}-${i}`, t1: rounds[roundNum-1][i*2].winner, t2: rounds[roundNum-1][i*2+1].winner, 
          isBye: false, winner: null, scores: [{t1:'',t2:''}] 
        });
      }
      rounds.push(round);
      prevMatches = currentMatches;
      roundNum++;
    }
    return rounds;
  };

  const startTournament = () => {
    if (userRole !== 'admin') return;
    const newBrackets = { ...brackets };
    CATEGORIES.forEach(cat => {
      const valid = teams[cat]?.filter(t => t && t.trim() !== '') || [];
      if (valid.length >= 2) newBrackets[cat] = generateInitialBracket(valid);
    });
    setBrackets(newBrackets);
    setPhase('bracket');
    syncToCloud({ phase: 'bracket', brackets: newBrackets, teams });
  };

  const handleScoreSave = (rIdx, mIdx, category, newScores) => {
    if (userRole !== 'admin') return;
    const newBrackets = { ...brackets };
    const match = newBrackets[category][rIdx][mIdx];
    match.scores = newScores;
    
    const p1 = parseInt(newScores[0].t1) || 0;
    const p2 = parseInt(newScores[0].t2) || 0;
    const winner = p1 > p2 ? match.t1 : p2 > p1 ? match.t2 : null;
    
    if (winner) {
      match.winner = winner;
      if (rIdx + 1 < newBrackets[category].length) {
        const nextMIdx = Math.floor(mIdx / 2);
        if (mIdx % 2 === 0) newBrackets[category][rIdx + 1][nextMIdx].t1 = winner;
        else newBrackets[category][rIdx + 1][nextMIdx].t2 = winner;
      } else {
        const newChamps = { ...champions, [category]: winner };
        setChampions(newChamps);
        syncToCloud({ champions: newChamps });
      }
    }
    setBrackets(newBrackets);
    setScoreModal({ isOpen: false });
    syncToCloud({ brackets: newBrackets });
  };

  // --- FIREBASE ETKİLEŞİMİ (EFFECTS) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try { await signInAnonymously(auth); } catch (e) { console.error(e); }
      } else { setFbUser(user); }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!fbUser) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.brackets) setBrackets(data.brackets);
        if (data.champions) setChampions(data.champions);
        if (data.phase) setPhase(data.phase);
        if (data.teams) setTeams(data.teams);
        setIsConnected(true);
      }
      setIsLoading(false);
    }, () => {
      setIsConnected(false);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [fbUser]);

  // --- GÖRÜNÜMLER ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-16 h-16 text-emerald-400 animate-spin mb-6" />
        <p className="text-emerald-100 font-black uppercase tracking-[0.3em] text-xs">Sistem Hazırlanıyor</p>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md transform transition-all hover:scale-[1.02] duration-500">
          <div className="flex justify-center mb-10">
            <div className="w-24 h-24 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl rotate-6 animate-in zoom-in duration-700">
              <Trophy size={56} />
            </div>
          </div>
          <h1 className="text-4xl font-black text-center text-slate-900 mb-2 tracking-tighter uppercase italic">Padel Pro</h1>
          <p className="text-center text-slate-400 text-[10px] mb-10 font-black uppercase tracking-[0.4em]">Yönetim Paneli Girişi</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && <div className="bg-red-50 text-red-600 text-[10px] p-3 rounded-xl border border-red-100 text-center font-black uppercase tracking-widest">{loginError}</div>}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Kullanıcı Adı</label>
              <input type="text" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 outline-none font-bold transition-all" placeholder="Admin" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Şifre</label>
              <input type="password" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 outline-none font-bold transition-all" placeholder="••••••••" />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-200 transition-all active:scale-95 uppercase tracking-widest text-xs">Oturum Aç</button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <button onClick={() => setUserRole('guest')} className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-xs">
              <Users size={18} /> Misafir Olarak İzle
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-900">
      {/* HEADER */}
      <header className="bg-[#064e3b] text-white p-4 sm:p-5 shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 group">
            <div className="bg-white/10 p-2.5 rounded-2xl group-hover:bg-white/20 transition-all">
              <Trophy className="text-yellow-400" size={24} />
            </div>
            <div>
              <h1 className="font-black text-xl uppercase tracking-tighter leading-none italic">Padel Fikstür Pro</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></span>
                <span className="text-[9px] font-black opacity-60 tracking-widest uppercase">{isConnected ? 'Canlı' : 'Çevrimdışı'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex flex-col items-end mr-2">
               <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">Erişim Seviyesi</span>
               <span className="text-[11px] font-black uppercase text-emerald-300">{userRole === 'admin' ? 'Yönetici' : 'İzleyici'}</span>
             </div>
             {userRole === 'admin' && (
               <button onClick={() => setResetModal({ ...resetModal, isOpen: true })} className="p-3 bg-red-600/10 hover:bg-red-600 text-white rounded-xl transition-all group border border-red-500/20" title="Sistemi Sıfırla">
                 <RotateCcw size={20} className="group-hover:rotate-180 transition-all duration-700"/>
               </button>
             )}
             <button onClick={handleLogout} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10">
               <LogOut size={20}/>
             </button>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-8 max-w-7xl mx-auto w-full flex flex-col overflow-hidden">
        {/* KATEGORİ SEKMELERİ */}
        <div className="flex gap-3 mb-10 overflow-x-auto no-scrollbar pb-2">
          {CATEGORIES.map(cat => (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)} 
              className={`px-10 py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all duration-500 border-2 ${
                activeCategory === cat 
                ? 'bg-[#064e3b] border-[#064e3b] text-white shadow-2xl shadow-emerald-200/50 -translate-y-1.5' 
                : 'bg-white border-white text-slate-400 hover:border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* --- KURULUM EKRANI --- */}
        {phase === 'setup' && userRole === 'admin' ? (
          <div className="bg-white rounded-[3.5rem] p-8 sm:p-12 border border-slate-200 shadow-2xl shadow-slate-200/40 max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-end mb-12 gap-8">
              <div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">{activeCategory}</h2>
                <div className="flex items-center gap-2 mt-2">
                   <div className="h-1.5 w-12 bg-emerald-500 rounded-full shadow-sm"></div>
                   <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.3em]">Takım Kayıt & Otomasyon</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={fillRandom} className="px-8 py-3.5 text-[10px] font-black bg-slate-50 text-slate-600 rounded-[1.25rem] hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2 uppercase tracking-widest border-2 border-slate-100 shadow-sm">
                  <Shuffle size={16}/> Rastgele Doldur
                </button>
                <button onClick={addTeam} className="px-8 py-3.5 text-[10px] font-black bg-emerald-50 text-emerald-700 rounded-[1.25rem] hover:bg-emerald-100 transition-all flex items-center gap-2 uppercase tracking-widest border-2 border-emerald-100 shadow-sm">
                  <Plus size={16}/> Takım Ekle
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
              {(teams[activeCategory] || []).map((team, index) => (
                <div key={index} className="group bg-slate-50 border-2 border-slate-100 hover:border-emerald-300 p-6 rounded-[2.5rem] transition-all duration-300 flex items-center gap-5 relative shadow-sm hover:shadow-xl">
                  <div className="w-12 h-12 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center font-black text-emerald-600 text-sm shadow-inner group-hover:border-emerald-200">
                    {index + 1}
                  </div>
                  <div className="flex-grow">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Takım İsmi</label>
                    <input 
                      type="text" 
                      value={team} 
                      onChange={(e) => handleNameChange(index, e.target.value)} 
                      className="w-full bg-transparent font-black text-slate-800 outline-none text-xl placeholder:text-slate-300 placeholder:italic" 
                      placeholder="Örn: Kaan & Mert" 
                    />
                  </div>
                  <button onClick={() => removeTeam(index)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 size={20}/>
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={startTournament} 
              className="w-full bg-gradient-to-br from-[#064e3b] to-[#065f46] text-white font-black py-7 rounded-[2.5rem] shadow-2xl shadow-emerald-900/20 flex items-center justify-center gap-4 active:scale-95 hover:scale-[1.01] transition-all text-2xl uppercase tracking-tighter italic"
            >
              <Play size={32} fill="currentColor" className="animate-pulse"/> Turnuvayı Başlat
            </button>
          </div>
        ) : (
          /* --- FİKSTÜR EKRANI --- */
          <div className="flex-grow overflow-x-auto bg-white border border-slate-200 rounded-[4rem] p-8 sm:p-14 shadow-2xl shadow-slate-200/40 animate-in fade-in duration-1000">
            <div className="mb-10 flex justify-between items-end px-4">
               <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tighter text-4xl italic leading-none">{activeCategory}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mt-3 ml-1">Fikstür Görünümü</p>
               </div>
            </div>
            
            {brackets?.[activeCategory] ? (
              <div className="flex gap-20 min-w-max h-full items-center px-6">
                {brackets[activeCategory].map((round, rIdx) => (
                  <div key={rIdx} className="flex flex-col gap-14 w-72">
                    <div className="flex flex-col items-center gap-2 mb-4">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em]">
                        {rIdx === brackets[activeCategory].length - 1 ? 'Şampiyonluk Maçı' : `Tur ${rIdx + 1}`}
                      </h4>
                      <div className="h-1.5 w-12 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    </div>
                    <div className="flex flex-col justify-around gap-12 h-full">
                      {round.map((match, mIdx) => (
                        <div key={mIdx} 
                             className={`group relative bg-white border-2 rounded-[2.5rem] shadow-sm transition-all duration-500 ${userRole === 'admin' && !match.isBye ? 'cursor-pointer hover:border-emerald-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:-translate-y-2' : 'border-slate-100 opacity-90'}`}
                             onClick={() => { if(userRole === 'admin' && !match.isBye && match.t1 && match.t2) setScoreModal({ isOpen: true, category: activeCategory, rIdx, mIdx, matchData: match }); }}>
                          <div className="p-6 space-y-4">
                            {[ 
                               {n: match.t1, s: match.scores?.[0]?.t1 || '0', win: match.winner === match.t1}, 
                               {n: match.t2, s: match.scores?.[0]?.t2 || '0', win: match.winner === match.t2} 
                            ].map((side, i) => (
                              <div key={i} className={`flex justify-between items-center p-4 rounded-[1.5rem] text-sm font-black transition-all duration-700 ${side.win ? 'bg-[#064e3b] text-white shadow-xl scale-[1.05]' : 'bg-slate-50 text-slate-600'}`}>
                                <span className="truncate max-w-[150px] flex items-center gap-3 uppercase tracking-tighter">
                                  {side.win && <Check size={16} className="shrink-0 text-emerald-400"/>}
                                  {side.n || '...'}
                                </span>
                                <span className={`w-10 h-10 flex items-center justify-center rounded-2xl font-black text-lg ${side.win ? 'bg-emerald-500/30' : 'bg-white shadow-inner text-[#064e3b]'}`}>
                                  {side.s}
                                </span>
                              </div>
                            ))}
                          </div>
                          {userRole === 'admin' && !match.winner && match.t1 && match.t2 && (
                             <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-5 py-2 rounded-full uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all shadow-xl">Skor Belirle</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* ŞAMPİYON ALANI */}
                <div className="w-80 flex flex-col items-center gap-10 pl-14 border-l-2 border-dashed border-slate-100">
                   <div className={`p-16 rounded-[4rem] border-8 flex items-center justify-center transition-all duration-1000 ${champions?.[activeCategory] ? 'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 border-yellow-200 shadow-[0_30px_60px_rgba(234,179,8,0.4)] scale-110' : 'bg-slate-50 border-slate-100 border-dashed opacity-30'}`}>
                      <Trophy size={100} className={champions?.[activeCategory] ? 'text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.2)] animate-pulse' : 'text-slate-200'}/>
                   </div>
                   <div className="text-center">
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.6em] mb-3">Şampiyon</p>
                     <p className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none underline decoration-emerald-500 decoration-8 underline-offset-8">{champions?.[activeCategory] || 'BEKLENİYOR'}</p>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-slate-300 gap-8">
                <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center animate-pulse border-2 border-slate-100 shadow-inner">
                  <AlertCircle size={64} className="opacity-10 text-slate-900"/>
                </div>
                <div className="text-center space-y-3">
                  <p className="font-black text-slate-400 text-2xl uppercase tracking-tighter italic">Fikstür Hazırlanıyor</p>
                  <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.3em] max-w-xs mx-auto leading-relaxed">Turnuva direktörü kurulumu tamamladığında sonuçlar burada güncellenecektir.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- MODALLAR (Skor & Sıfırlama) --- */}
      {scoreModal.isOpen && scoreModal.matchData && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-lg z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[4rem] w-full max-w-sm overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
            <div className="bg-[#064e3b] p-10 text-white flex justify-between items-center border-b-8 border-emerald-500/20">
              <h3 className="font-black uppercase tracking-tighter text-3xl italic">Maç Sonucu</h3>
              <button onClick={() => setScoreModal({ isOpen: false })} className="bg-white/10 p-3 rounded-2xl hover:bg-white/20 transition-all hover:rotate-90"><X size={28}/></button>
            </div>
            <div className="p-12 space-y-12">
               {[ {n: scoreModal.matchData.t1, id: 't1'}, {n: scoreModal.matchData.t2, id: 't2'} ].map(side => (
                 <div key={side.id} className="space-y-5">
                   <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] text-center truncate px-6">{side.n}</p>
                   <div className="flex justify-center">
                    <input 
                        type="number" 
                        value={scoreModal.matchData.scores[0][side.id]} 
                        onChange={(e) => {
                          const b = {...brackets};
                          b[activeCategory][scoreModal.rIdx][scoreModal.mIdx].scores[0][side.id] = e.target.value;
                          setBrackets({...b});
                        }}
                        className="w-32 text-center p-8 bg-slate-50 border-4 border-slate-100 rounded-[2.5rem] font-black text-5xl text-[#064e3b] focus:border-emerald-500 outline-none transition-all shadow-inner" 
                    />
                   </div>
                 </div>
               ))}
               <button onClick={() => handleScoreSave(scoreModal.rIdx, scoreModal.mIdx, activeCategory, scoreModal.matchData.scores)} className="w-full bg-slate-900 text-white font-black py-6 rounded-[2.5rem] shadow-2xl active:scale-95 transition-all text-sm tracking-[0.4em] uppercase hover:bg-black">Yayınla</button>
            </div>
          </div>
        </div>
      )}

      {resetModal.isOpen && (
        <div className="fixed inset-0 bg-red-950/95 backdrop-blur-lg z-[110] flex items-center justify-center p-4 animate-in zoom-in duration-300">
          <div className="bg-white rounded-[4rem] w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="bg-red-600 p-10 text-white flex justify-between items-center border-b-8 border-red-500/20">
              <h3 className="font-black uppercase tracking-tighter text-3xl italic text-center w-full">Sıfırla</h3>
              <button onClick={() => setResetModal({ ...resetModal, isOpen: false, error: '' })} className="bg-white/10 p-3 rounded-2xl absolute right-10"><X size={28}/></button>
            </div>
            <div className="p-12 space-y-8 text-center">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-relaxed px-4">Tüm veriler kalıcı olarak silinecektir. Devam etmek için şifreyi girin.</p>
              <div className="space-y-2">
                <input 
                  type="password" 
                  value={resetModal.password} 
                  onChange={(e) => setResetModal({ ...resetModal, password: e.target.value })} 
                  className={`w-full text-center p-6 bg-slate-50 border-4 rounded-[2rem] font-black text-4xl outline-none transition-all ${resetModal.error ? 'border-red-500 animate-pulse' : 'border-slate-100 focus:border-red-600'}`}
                  placeholder="****"
                />
                {resetModal.error && <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.2em]">{resetModal.error}</p>}
              </div>
              <button onClick={handleGlobalReset} className="w-full bg-red-600 text-white font-black py-6 rounded-[2.5rem] shadow-2xl shadow-red-200 active:scale-95 transition-all uppercase tracking-[0.3em] text-xs">Onayla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
