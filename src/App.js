import React, { useState, useEffect } from 'react';
import { Trophy, Users, Play, RotateCcw, Shuffle, Check, Plus, Trash2, X, AlertCircle, Lock, LogOut, Cloud, CloudOff, Loader2, Save, Edit3 } from 'lucide-react';
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

  const [scoreModal, setScoreModal] = useState({ isOpen: false, category: null, rIdx: null, mIdx: null, matchData: null, editMode: false });
  const [resetModal, setResetModal] = useState({ isOpen: false, password: '', error: '' });

  const sampleTeams = ["Ali & Veli", "Ayşe & Fatma", "Can & Cem", "Deniz & Derya", "Efe & Ege", "Gül & Nur", "Hasan & Hüseyin", "İrem & Sinem"];

  // --- 1. OTURUM KALICILIĞI (SAYFA YENİLENSE DE ÇIKMAZ) ---
  useEffect(() => {
    const savedRole = localStorage.getItem('padel_user_role');
    if (savedRole) setUserRole(savedRole);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try { await signInAnonymously(auth); } catch (e) { console.error(e); }
      } else { setFbUser(user); }
    });
    return () => unsubscribe();
  }, []);

  // --- 2. CANLI VERİ SENKRONİZASYONU ---
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

  // --- 3. FONKSİYONLAR ---

  const syncToCloud = async (updates) => {
    if (userRole !== 'admin') return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main');
      await setDoc(docRef, updates, { merge: true });
    } catch (e) { console.error("Sync error:", e); }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.username === 'Admin' && loginData.password === 'Admin19.!') {
      setUserRole('admin');
      localStorage.setItem('padel_user_role', 'admin');
      setLoginError('');
    } else {
      setLoginError('Hatalı giriş bilgileri!');
    }
  };

  const handleGuestLogin = () => {
    setUserRole('guest');
    localStorage.setItem('padel_user_role', 'guest');
  };

  const handleLogout = () => {
    setUserRole(null);
    localStorage.removeItem('padel_user_role');
    setLoginData({ username: '', password: '' });
  };

  const fillRandom = () => {
    if (userRole !== 'admin') return;
    const shuffled = [...sampleTeams].sort(() => 0.5 - Math.random());
    const newTeams = { ...teams };
    newTeams[activeCategory] = shuffled.slice(0, 8);
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
      const emptyState = { 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null };
      const emptyTeams = { 'Çift Erkekler': [], 'Çift Kadınlar': [], 'Mix Çiftler': [] };
      setPhase('setup');
      setBrackets(emptyState);
      setChampions(emptyState);
      setTeams(emptyTeams);
      syncToCloud({ phase: 'setup', brackets: emptyState, champions: emptyState, teams: emptyTeams });
      setResetModal({ isOpen: false, password: '', error: '' });
    } else {
      setResetModal({ ...resetModal, error: 'Şifre Hatalı!' });
    }
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

  const clearMatch = (rIdx, mIdx, category) => {
    if (userRole !== 'admin') return;
    const newBrackets = { ...brackets };
    const clearRec = (ri, mi) => {
      const match = newBrackets[category][ri][mi];
      match.winner = null;
      match.scores = [{t1:'',t2:''}];
      if (ri + 1 < newBrackets[category].length) {
        const nextMi = Math.floor(mi / 2);
        if (mi % 2 === 0) newBrackets[category][ri + 1][nextMi].t1 = null;
        else newBrackets[category][ri + 1][nextMi].t2 = null;
        clearRec(ri + 1, nextMi);
      }
    };
    clearRec(rIdx, mIdx);
    setBrackets(newBrackets);
    setChampions({ ...champions, [category]: null });
    setScoreModal({ isOpen: false });
    syncToCloud({ brackets: newBrackets, champions: { ...champions, [category]: null } });
  };

  // --- UI BİLEŞENLERİ ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
        <p className="text-emerald-100 font-bold uppercase tracking-widest text-[9px]">Yükleniyor...</p>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
              <Trophy size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-black text-center text-slate-900 mb-6 uppercase italic">Padel Fikstür Pro</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && <div className="bg-red-50 text-red-600 text-[10px] p-2 rounded-lg text-center font-bold">{loginError}</div>}
            <input type="text" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm" placeholder="Kullanıcı Adı" />
            <input type="password" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm" placeholder="Şifre" />
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl shadow-lg transition-all text-xs tracking-widest">ADMİN GİRİŞİ</button>
          </form>
          <button onClick={handleGuestLogin} className="w-full mt-4 bg-slate-900 hover:bg-black text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all text-xs tracking-widest">
            <Users size={16} /> MİSAFİR OLARAK İZLE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans text-slate-900">
      <header className="bg-[#064e3b] text-white p-3 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="text-yellow-400" size={18} />
            <h1 className="font-black text-sm sm:text-base uppercase tracking-tighter italic">Padel Fikstür Pro</h1>
            <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded text-[7px] font-black ${isConnected ? 'bg-emerald-400/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
              <Cloud size={10}/> <span>{isConnected ? 'CANLI' : '...'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[8px] font-black bg-white/10 px-2 py-1 rounded uppercase tracking-widest">{userRole === 'admin' ? 'YÖNETİCİ' : 'İZLEYİCİ'}</span>
             {userRole === 'admin' && (
               <button onClick={() => setResetModal({ ...resetModal, isOpen: true })} className="p-2 bg-red-600/20 hover:bg-red-600 rounded-lg transition-all" title="Sıfırla"><RotateCcw size={14}/></button>
             )}
             <button onClick={handleLogout} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"><LogOut size={14}/></button>
          </div>
        </div>
      </header>

      <main className="flex-grow p-3 sm:p-4 max-w-7xl mx-auto w-full flex flex-col overflow-hidden">
        <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeCategory === cat ? 'bg-[#064e3b] text-white shadow-md' : 'bg-white text-slate-400 shadow-sm'}`}>{cat}</button>
          ))}
        </div>

        {phase === 'setup' && userRole === 'admin' ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xl max-w-3xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-slate-900 uppercase italic">Takım Kaydı</h2>
              <div className="flex gap-2">
                <button onClick={fillRandom} className="px-3 py-1.5 text-[8px] font-black bg-slate-100 rounded-lg flex items-center gap-1 uppercase tracking-widest shadow-sm"><Shuffle size={12}/> Rastgele</button>
                <button onClick={addTeam} className="px-3 py-1.5 text-[8px] font-black bg-emerald-50 text-emerald-700 rounded-lg flex items-center gap-1 uppercase tracking-widest shadow-sm"><Plus size={12}/> Ekle</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
              {(teams[activeCategory] || []).map((team, index) => (
                <div key={index} className="group bg-slate-50 border border-slate-100 p-2 rounded-lg flex items-center gap-2 shadow-sm">
                  <span className="w-5 text-[9px] font-black text-slate-300">{index + 1}</span>
                  <input type="text" value={team} onChange={(e) => handleNameChange(index, e.target.value)} className="flex-grow bg-transparent font-bold text-slate-800 outline-none text-xs" placeholder="Takım Adı" />
                  <button onClick={() => removeTeam(index)} className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
            <button onClick={startTournament} className="w-full bg-[#064e3b] text-white font-black py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-widest italic"><Play size={16} fill="currentColor"/> Fikstürü Oluştur</button>
          </div>
        ) : (
          <div className="flex-grow overflow-x-auto bg-white border border-slate-200 rounded-2xl p-4 shadow-inner">
            {brackets?.[activeCategory] ? (
              <div className="flex gap-8 min-w-max h-full items-center px-2">
                {brackets[activeCategory].map((round, rIdx) => (
                  <div key={rIdx} className="flex flex-col gap-6 w-48">
                    <h4 className="text-center text-[8px] font-black text-slate-400 uppercase tracking-widest">{rIdx === brackets[activeCategory].length - 1 ? 'FİNAL' : `TUR ${rIdx + 1}`}</h4>
                    <div className="flex flex-col justify-around gap-4 h-full">
                      {round.map((match, mIdx) => (
                        <div key={mIdx} 
                             className={`group relative bg-white border-2 rounded-xl shadow-sm transition-all duration-300 ${userRole === 'admin' && !match.isBye ? 'cursor-pointer hover:border-emerald-500' : 'border-slate-50'}`}
                             onClick={() => { if(userRole === 'admin' && !match.isBye && match.t1 && match.t2) setScoreModal({ isOpen: true, category: activeCategory, rIdx, mIdx, matchData: match, editMode: false }); }}>
                          <div className="p-2 space-y-1.5">
                            {[ {id:'t1', n: match.t1, s: match.scores?.[0]?.t1 || '0', win: match.winner === match.t1}, {id:'t2', n: match.t2, s: match.scores?.[0]?.t2 || '0', win: match.winner === match.t2} ].map((side, i) => (
                              <div key={i} className={`flex justify-between items-center p-1.5 rounded-lg text-[10px] font-black transition-all ${side.win ? 'bg-[#064e3b] text-white shadow-md' : 'bg-slate-50 text-slate-600'}`}>
                                <span className="truncate max-w-[100px]">{side.win && <Check size={10} className="inline mr-1"/>}{side.n || '...'}</span>
                                <span className={`w-5 h-5 flex items-center justify-center rounded-md font-black ${side.win ? 'bg-emerald-500/30' : 'bg-white border text-[#064e3b]'}`}>{side.s}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="w-48 flex flex-col items-center gap-4 pl-6 border-l border-slate-100">
                   <div className={`p-8 rounded-3xl border-4 flex items-center justify-center transition-all ${champions?.[activeCategory] ? 'bg-yellow-50 border-yellow-400 shadow-lg animate-bounce' : 'bg-slate-50 border-slate-200 opacity-30'}`}>
                      <Trophy size={32} className={champions?.[activeCategory] ? 'text-yellow-500' : 'text-slate-300'}/>
                   </div>
                   <div className="text-center">
                     <p className="text-[8px] font-black text-slate-400 uppercase">Şampiyon</p>
                     <p className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">{champions?.[activeCategory] || '...'}</p>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-300">
                <AlertCircle size={32} className="opacity-10 mb-2"/>
                <p className="font-black text-[10px] uppercase tracking-widest text-center">Fikstür Hazırlanıyor...<br/><span className="font-normal opacity-60">Admin kurulumu tamamladığında canlı sonuçlar akacaktır.</span></p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- SKOR & DÜZENLEME MODAL --- */}
      {scoreModal.isOpen && scoreModal.matchData && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-[#064e3b] p-4 text-white flex justify-between items-center">
              <h3 className="font-black uppercase text-xs italic">{scoreModal.editMode ? 'Takımları Düzenle' : 'Maç Sonucu'}</h3>
              <button onClick={() => setScoreModal({ ...scoreModal, isOpen: false })}><X size={18}/></button>
            </div>
            <div className="p-6 space-y-6">
               {[ {n: scoreModal.matchData.t1, id: 't1'}, {n: scoreModal.matchData.t2, id: 't2'} ].map(side => (
                 <div key={side.id} className="space-y-2 text-center">
                   {scoreModal.editMode ? (
                     <input type="text" value={side.n} onChange={(e) => {
                       const b = {...brackets}; b[activeCategory][scoreModal.rIdx][scoreModal.mIdx][side.id] = e.target.value; setBrackets({...b});
                     }} className="w-full p-2.5 bg-slate-50 border rounded-lg font-bold text-xs outline-none focus:ring-1 focus:ring-emerald-500" />
                   ) : (
                     <>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{side.n}</p>
                        <input type="number" value={scoreModal.matchData.scores[0][side.id]} onChange={(e) => {
                          const b = {...brackets}; b[activeCategory][scoreModal.rIdx][scoreModal.mIdx].scores[0][side.id] = e.target.value; setBrackets({...b});
                        }} className="w-16 text-center p-2 bg-slate-50 border rounded-xl font-black text-xl text-emerald-700" />
                     </>
                   )}
                 </div>
               ))}
               <div className="space-y-2 pt-2 border-t">
                  <button onClick={() => scoreModal.editMode ? syncToCloud({ brackets }) : handleScoreSave(scoreModal.rIdx, scoreModal.mIdx, activeCategory, scoreModal.matchData.scores)} className="w-full bg-[#064e3b] text-white font-black py-3 rounded-lg text-[9px] tracking-widest flex items-center justify-center gap-2">
                    {scoreModal.editMode ? <Save size={12}/> : null} {scoreModal.editMode ? 'DEĞİŞİKLİKLERİ KAYDET' : 'SKORU KAYDET VE YAYINLA'}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setScoreModal({ ...scoreModal, editMode: !scoreModal.editMode })} className="flex-1 bg-slate-100 text-slate-600 font-bold py-2 rounded-lg text-[8px] uppercase flex items-center justify-center gap-1">
                      {scoreModal.editMode ? <X size={12}/> : <Edit3 size={12}/>} {scoreModal.editMode ? 'İptal' : 'İsimleri Düzenle'}
                    </button>
                    {!scoreModal.editMode && (
                      <button onClick={() => clearMatch(scoreModal.rIdx, scoreModal.mIdx, activeCategory)} className="flex-1 bg-red-50 text-red-600 font-bold py-2 rounded-lg text-[8px] uppercase flex items-center justify-center gap-1">
                        <RotateCcw size={12}/> Maçı Sıfırla
                      </button>
                    )}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SIFIRLAMA MODAL --- */}
      {resetModal.isOpen && (
        <div className="fixed inset-0 bg-red-950/90 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-in zoom-in duration-200">
            <h3 className="font-black uppercase text-sm text-red-600 mb-4 text-center">TÜMÜNÜ SIFIRLA</h3>
            <p className="text-[10px] font-bold text-slate-500 mb-4 text-center">Tüm kategorileri silmek için '1234' giriniz.</p>
            <input type="password" value={resetModal.password} onChange={(e) => setResetModal({ ...resetModal, password: e.target.value })} className={`w-full text-center p-3 bg-slate-50 border-2 rounded-xl font-black text-xl mb-4 ${resetModal.error ? 'border-red-500' : 'border-slate-100'}`} placeholder="****" />
            <div className="flex gap-2">
              <button onClick={() => setResetModal({ ...resetModal, isOpen: false, error: '' })} className="flex-1 bg-slate-100 font-black py-3 rounded-xl text-[10px]">İPTAL</button>
              <button onClick={handleGlobalReset} className="flex-1 bg-red-600 text-white font-black py-3 rounded-xl text-[10px] shadow-lg">ONAYLA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
