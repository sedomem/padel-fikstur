import React, { useState, useEffect } from 'react';
import { Trophy, Users, Play, RotateCcw, Shuffle, Check, Plus, Trash2, X, AlertCircle, Lock, LogOut, Cloud, CloudOff, Loader2, Settings2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- FIREBASE KONFİGÜRASYONU ---
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

  const sampleTeams = ["Ali & Veli", "Ayşe & Fatma", "Can & Cem", "Deniz & Derya", "Efe & Ege", "Gül & Nur", "Hasan & Hüseyin", "İrem & Sinem"];

  // --- FIREBASE ETKİLEŞİMİ ---
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

  const syncToCloud = async (updates) => {
    if (userRole !== 'admin') return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main');
      await setDoc(docRef, updates, { merge: true });
    } catch (e) { console.error(e); }
  };

  // --- AKSİYONLAR ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.username === 'Admin' && loginData.password === 'Admin19.!') {
      setUserRole('admin');
      setLoginError('');
    } else {
      setLoginError('Yetkisiz erişim denemesi!');
    }
  };

  const handleLogout = () => {
    setUserRole(null);
    setLoginData({ username: '', password: '' });
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
    newTeams[activeCategory] = [...(newTeams[activeCategory] || []), ''];
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
      setPhase('setup');
      setBrackets(emptyBrackets);
      setChampions(emptyBrackets);
      syncToCloud({ phase: 'setup', brackets: emptyBrackets, champions: emptyBrackets });
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
      round0.push({ 
        id: `0-${i}`, t1, t2, isBye: t2 === null, winner: t2 === null ? t1 : null, 
        scores: [{t1:'',t2:''},{t1:'',t2:''},{t1:'',t2:''}] 
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
          isBye: false, winner: null, scores: [{t1:'',t2:''},{t1:'',t2:''},{t1:'',t2:''}] 
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
    
    let s1 = 0, s2 = 0;
    newScores.forEach(s => { 
      const p1 = parseInt(s.t1) || 0;
      const p2 = parseInt(s.t2) || 0;
      if(p1 > p2) s1++; else if(p2 > p1) s2++; 
    });
    
    const winner = s1 > s2 ? match.t1 : s2 > s1 ? match.t2 : null;
    
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

  // --- UI BİLEŞENLERİ ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-16 h-16 text-emerald-400 animate-spin mb-4" />
        <p className="text-emerald-100 font-black uppercase tracking-[0.3em] text-xs">Sistem Yükleniyor</p>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md transform transition-all">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl rotate-3">
              <Trophy size={48} />
            </div>
          </div>
          <h1 className="text-4xl font-black text-center text-slate-900 mb-2 tracking-tighter">PADEL PRO</h1>
          <p className="text-center text-slate-400 text-sm mb-10 font-bold uppercase tracking-widest">Turnuva Yönetim Paneli</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && <div className="bg-red-50 text-red-600 text-[10px] p-3 rounded-xl border border-red-100 text-center font-black uppercase tracking-widest">{loginError}</div>}
            <input type="text" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 outline-none font-bold transition-all" placeholder="Kullanıcı" />
            <input type="password" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 outline-none font-bold transition-all" placeholder="Şifre" />
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-200 transition-all active:scale-95 uppercase tracking-widest">Admin Girişi</button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <button onClick={() => setUserRole('guest')} className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-sm">
              <Users size={20} /> Misafir Girişi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-900">
      {/* HEADER */}
      <header className="bg-emerald-800 text-white p-4 sm:p-5 shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-2 rounded-xl">
              <Trophy className="text-yellow-400" size={24} />
            </div>
            <div>
              <h1 className="font-black text-xl uppercase tracking-tighter leading-none">Padel Fikstür Pro</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full animate-pulse ${isConnected ? 'bg-emerald-400' : 'bg-red-500'}`}></span>
                <span className="text-[10px] font-black opacity-70 tracking-widest uppercase">{isConnected ? 'Canlı Bağlantı' : 'Bağlantı Yok'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex flex-col items-end">
               <span className="text-[10px] font-black opacity-50 uppercase tracking-widest">Mod</span>
               <span className="text-xs font-black uppercase">{userRole === 'admin' ? 'Yönetici' : 'İzleyici'}</span>
             </div>
             {userRole === 'admin' && (
               <button onClick={() => setResetModal({ ...resetModal, isOpen: true })} className="p-3 bg-red-600/20 hover:bg-red-600 text-white rounded-xl transition-all group" title="Tüm Turnuvayı Sıfırla">
                 <Settings2 size={20} className="group-hover:rotate-90 transition-all"/>
               </button>
             )}
             <button onClick={handleLogout} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
               <LogOut size={20}/>
             </button>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-8 max-w-7xl mx-auto w-full flex flex-col overflow-hidden">
        {/* KATEGORİ SEKMELERİ */}
        <div className="flex gap-4 mb-8 overflow-x-auto no-scrollbar pb-2">
          {CATEGORIES.map(cat => (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)} 
              className={`px-8 py-4 text-xs font-black uppercase tracking-[0.2em] rounded-2xl transition-all duration-300 border-2 ${
                activeCategory === cat 
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-100 -translate-y-1' 
                : 'bg-white border-white text-slate-400 hover:border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* --- KURULUM EKRANI --- */}
        {phase === 'setup' && userRole === 'admin' ? (
          <div className="bg-white rounded-[3rem] p-8 sm:p-12 border border-slate-200 shadow-2xl shadow-slate-200/50 max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-end mb-10 gap-6">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">{activeCategory}</h2>
                <p className="text-slate-400 font-bold mt-1 uppercase text-xs tracking-widest">Takım Kayıt Ve Eşleştirme</p>
              </div>
              <div className="flex gap-3">
                <button onClick={fillRandom} className="px-6 py-3 text-xs font-black bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all flex items-center gap-2 uppercase">
                  <Shuffle size={16}/> Örnek Doldur
                </button>
                <button onClick={addTeam} className="px-6 py-3 text-xs font-black bg-emerald-100 text-emerald-600 rounded-2xl hover:bg-emerald-200 transition-all flex items-center gap-2 uppercase">
                  <Plus size={16}/> Takım Ekle
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
              {(teams[activeCategory] || []).map((team, index) => (
                <div key={index} className="group bg-slate-50 border-2 border-transparent hover:border-emerald-200 p-5 rounded-3xl transition-all flex items-center gap-4 relative shadow-sm hover:shadow-md">
                  <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center font-black text-slate-300 text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-grow">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Takım Adı</label>
                    <input 
                      type="text" 
                      value={team} 
                      onChange={(e) => handleNameChange(index, e.target.value)} 
                      className="w-full bg-transparent font-black text-slate-800 outline-none text-lg placeholder:text-slate-300" 
                      placeholder="Örn: Ayşe & Fatma" 
                    />
                  </div>
                  <button onClick={() => removeTeam(index)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 size={20}/>
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={startTournament} 
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-emerald-200 flex items-center justify-center gap-4 active:scale-95 transition-all text-xl uppercase tracking-tighter italic"
            >
              <Play size={28} fill="currentColor"/> Fikstürü Oluştur Ve Yayına Al
            </button>
          </div>
        ) : (
          /* --- FİKSTÜR EKRANI --- */
          <div className="flex-grow overflow-x-auto bg-white border border-slate-200 rounded-[3.5rem] p-8 sm:p-12 shadow-2xl shadow-slate-200/50 animate-in fade-in duration-700">
            {brackets?.[activeCategory] ? (
              <div className="flex gap-16 min-w-max h-full items-center">
                {brackets[activeCategory].map((round, rIdx) => (
                  <div key={rIdx} className="flex flex-col gap-10 w-64">
                    <div className="text-center space-y-1 mb-4">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">
                        {rIdx === brackets[activeCategory].length - 1 ? 'Büyük Final' : `Tur ${rIdx + 1}`}
                      </h4>
                      <div className="h-1 w-8 bg-emerald-500 mx-auto rounded-full"></div>
                    </div>
                    <div className="flex flex-col justify-around gap-8 h-full">
                      {round.map((match, mIdx) => (
                        <div key={mIdx} 
                             className={`group relative bg-white border-2 rounded-[2rem] shadow-sm transition-all duration-300 ${userRole === 'admin' && !match.isBye ? 'cursor-pointer hover:border-emerald-500 hover:shadow-2xl hover:-translate-y-1' : 'border-slate-100'}`}
                             onClick={() => { if(userRole === 'admin' && !match.isBye && match.t1 && match.t2) setScoreModal({ isOpen: true, category: activeCategory, rIdx, mIdx, matchData: match }); }}>
                          <div className="p-5 space-y-3">
                            {[ 
                               {n: match.t1, s: match.scores?.[0]?.t1 || '0', win: match.winner === match.t1}, 
                               {n: match.t2, s: match.scores?.[0]?.t2 || '0', win: match.winner === match.t2} 
                            ].map((side, i) => (
                              <div key={i} className={`flex justify-between items-center p-3 rounded-2xl text-[13px] font-black transition-all duration-500 ${side.win ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-50 text-slate-700'}`}>
                                <span className="truncate max-w-[140px] flex items-center gap-2">
                                  {side.win && <Check size={14} className="shrink-0"/>}
                                  {side.n || '...'}
                                </span>
                                <span className={`w-8 h-8 flex items-center justify-center rounded-xl font-black ${side.win ? 'bg-emerald-500/50' : 'bg-white shadow-inner text-emerald-600'}`}>
                                  {side.s}
                                </span>
                              </div>
                            ))}
                          </div>
                          {userRole === 'admin' && !match.winner && match.t1 && match.t2 && (
                             <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Skor Gir</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* ŞAMPİYON ALANI */}
                <div className="w-72 flex flex-col items-center gap-8 pl-10 border-l border-slate-100">
                   <div className={`p-14 rounded-[3.5rem] border-8 flex items-center justify-center transition-all duration-1000 ${champions?.[activeCategory] ? 'bg-gradient-to-br from-yellow-400 to-orange-500 border-yellow-200 shadow-[0_20px_50px_rgba(234,179,8,0.3)] scale-110' : 'bg-slate-50 border-slate-100 border-dashed opacity-40'}`}>
                      <Trophy size={80} className={champions?.[activeCategory] ? 'text-white drop-shadow-lg' : 'text-slate-200'}/>
                   </div>
                   <div className="text-center">
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] mb-2">Şampiyon</p>
                     <p className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{champions?.[activeCategory] || 'Bekleniyor'}</p>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-slate-300 gap-6">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center animate-pulse">
                  <AlertCircle size={48} className="opacity-20 text-slate-900"/>
                </div>
                <p className="font-black text-center text-slate-400 max-w-sm uppercase tracking-widest leading-loose">
                  Fikstür Hazırlanıyor...<br/>
                  <span className="text-[10px] text-slate-300 font-bold">Admin kurulumu tamamladığında canlı sonuçlar burada akacaktır.</span>
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- SKOR MODAL --- */}
      {scoreModal.isOpen && scoreModal.matchData && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-sm overflow-hidden animate-in zoom-in duration-300 shadow-2xl">
            <div className="bg-emerald-600 p-8 text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Canlı Sonuç</span>
                <h3 className="font-black uppercase tracking-tighter text-2xl italic">Skor Girişi</h3>
              </div>
              <button onClick={() => setScoreModal({ isOpen: false })} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-all"><X size={24}/></button>
            </div>
            <div className="p-10 space-y-10">
               {[ {n: scoreModal.matchData.t1, id: 't1'}, {n: scoreModal.matchData.t2, id: 't2'} ].map(side => (
                 <div key={side.id} className="space-y-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center truncate px-4">{side.n}</p>
                   <div className="flex justify-center">
                    <input 
                        type="number" 
                        value={scoreModal.matchData.scores[0][side.id]} 
                        onChange={(e) => {
                          const b = {...brackets};
                          b[activeCategory][scoreModal.rIdx][scoreModal.mIdx].scores[0][side.id] = e.target.value;
                          setBrackets({...b});
                        }}
                        className="w-28 text-center p-6 bg-slate-50 border-4 border-slate-100 rounded-[2rem] font-black text-4xl text-emerald-600 focus:border-emerald-500 outline-none transition-all shadow-inner" 
                    />
                   </div>
                 </div>
               ))}
               <button onClick={() => handleScoreSave(scoreModal.rIdx, scoreModal.mIdx, activeCategory, scoreModal.matchData.scores)} className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-2xl active:scale-95 transition-all text-sm tracking-[0.3em] uppercase">Kaydet Ve Yayınla</button>
            </div>
          </div>
        </div>
      )}

      {/* --- SIFIRLAMA MODAL --- */}
      {resetModal.isOpen && (
        <div className="fixed inset-0 bg-red-950/90 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-sm overflow-hidden animate-in zoom-in duration-300 shadow-2xl">
            <div className="bg-red-600 p-8 text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Güvenlik</span>
                <h3 className="font-black uppercase tracking-tighter text-2xl italic">Tümünü Sıfırla</h3>
              </div>
              <button onClick={() => setResetModal({ ...resetModal, isOpen: false, error: '' })} className="bg-white/10 p-2 rounded-xl"><X size={24}/></button>
            </div>
            <div className="p-10 space-y-6 text-center">
              <p className="text-sm font-bold text-slate-500 uppercase leading-relaxed">Tüm kategorilerdeki fikstür ve takımlar silinecektir. Lütfen sıfırlama şifresini girin.</p>
              
              <input 
                type="password" 
                value={resetModal.password} 
                onChange={(e) => setResetModal({ ...resetModal, password: e.target.value })} 
                className={`w-full text-center p-4 bg-slate-50 border-2 rounded-2xl font-black text-2xl outline-none transition-all ${resetModal.error ? 'border-red-500' : 'border-slate-100 focus:border-red-500'}`}
                placeholder="****"
              />
              {resetModal.error && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{resetModal.error}</p>}
              
              <button onClick={handleGlobalReset} className="w-full bg-red-600 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-red-100 active:scale-95 transition-all uppercase tracking-widest text-sm">
                Sıfırlamayı Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
