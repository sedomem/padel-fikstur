import React, { useState, useEffect } from 'react';
import { Trophy, Users, Play, RotateCcw, Shuffle, Check, Plus, Trash2, X, AlertCircle, Lock, LogOut, Cloud, CloudOff, Loader2 } from 'lucide-react';
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

// Firebase Servislerini Başlat
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "padel-tourney-v1"; 

const CATEGORIES = ['Çift Erkekler', 'Çift Kadınlar', 'Mix Çiftler'];

const App = () => {
  // Kullanıcı ve Bağlantı Durumları
  const [userRole, setUserRole] = useState(null); 
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [fbUser, setFbUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Turnuva Verileri
  const [phase, setPhase] = useState('setup'); 
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [teams, setTeams] = useState({ 'Çift Erkekler': [], 'Çift Kadınlar': [], 'Mix Çiftler': [] });
  const [brackets, setBrackets] = useState({ 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null });
  const [champions, setChampions] = useState({ 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null });

  const [scoreModal, setScoreModal] = useState({ isOpen: false, category: null, rIdx: null, mIdx: null, matchData: null });

  // 1. Firebase Oturum Yönetimi
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Firebase Auth hatası:", error);
        }
      } else {
        setFbUser(user);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Canlı Veri Senkronizasyonu
  useEffect(() => {
    if (!fbUser) return;

    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Güvenli veri ataması
        if (data.brackets) setBrackets(data.brackets);
        if (data.champions) setChampions(data.champions);
        if (data.phase) setPhase(data.phase);
        if (data.teams) setTeams(data.teams);
        setIsConnected(true);
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Firestore bağlantı hatası:", err);
      setIsConnected(false);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [fbUser]);

  // 3. Veritabanına Yazma (Sadece Admin)
  const syncToCloud = async (updates) => {
    if (userRole !== 'admin') return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main');
      await setDoc(docRef, updates, { merge: true });
    } catch (e) {
      console.error("Cloud güncelleme hatası:", e);
    }
  };

  // --- Olay Yönetimi ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.username === 'Admin' && loginData.password === 'Admin19.!') {
      setUserRole('admin');
      setLoginError('');
    } else {
      setLoginError('Kullanıcı adı veya şifre hatalı!');
    }
  };

  const handleNameChange = (index, value) => {
    if (userRole !== 'admin') return;
    const newTeams = { ...teams };
    if (!newTeams[activeCategory]) newTeams[activeCategory] = [];
    newTeams[activeCategory][index] = value;
    setTeams(newTeams);
    syncToCloud({ teams: newTeams });
  };

  const startTournament = () => {
    if (userRole !== 'admin') return;
    const newBrackets = { ...brackets };
    CATEGORIES.forEach(cat => {
      const valid = teams[cat]?.filter(t => t && t.trim() !== '') || [];
      if (valid.length >= 2) {
        newBrackets[cat] = generateInitialBracket(valid);
      }
    });
    setBrackets(newBrackets);
    setPhase('bracket');
    syncToCloud({ phase: 'bracket', brackets: newBrackets, teams });
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

  // --- GÖRÜNÜMLER ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-slate-600 font-bold uppercase tracking-widest text-xs text-center">Bağlantı Kuruluyor...</p>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="min-h-screen bg-emerald-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <Trophy size={40} />
            </div>
          </div>
          <h1 className="text-3xl font-black text-center text-slate-800 mb-2">Padel Fikstür</h1>
          <p className="text-center text-slate-400 text-sm mb-10 font-medium tracking-tight">Turnuva yönetimi ve canlı takip sistemi.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 text-center font-bold">{loginError}</div>}
            <input type="text" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} className="w-full px-5 py-3 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 outline-none font-semibold" placeholder="Yönetici Adı" />
            <input type="password" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} className="w-full px-5 py-3 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 outline-none font-semibold" placeholder="••••••••" />
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95">ADMİN GİRİŞİ</button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <button onClick={() => setUserRole('guest')} className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold py-4 rounded-2xl flex items-center justify-center gap-3">
              <Users size={20} /> MİSAFİR OLARAK İZLE
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-emerald-800 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="text-yellow-400" />
            <h1 className="font-black text-lg uppercase tracking-tighter">Padel Fikstür Pro</h1>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-black ${isConnected ? 'bg-emerald-700' : 'bg-red-900'}`}>
              {isConnected ? <Cloud size={12}/> : <CloudOff size={12}/>}
              <span>{isConnected ? 'CANLI' : 'BAĞLANTI YOK'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full uppercase">{userRole === 'admin' ? 'Yönetici' : 'İzleyici'}</span>
             <button onClick={() => setUserRole(null)} className="p-2 hover:bg-black/20 rounded-lg transition-colors"><LogOut size={20}/></button>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-6 max-w-7xl mx-auto w-full flex flex-col overflow-hidden">
        <div className="flex gap-2 border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-5 py-3 text-xs font-black uppercase transition-all border-b-4 ${activeCategory === cat ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-400'}`}>{cat}</button>
          ))}
        </div>

        {phase === 'setup' && userRole === 'admin' ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm max-w-2xl mx-auto w-full">
            <h2 className="text-2xl font-black text-slate-800 mb-6">{activeCategory} Kaydı</h2>
            <div className="space-y-3 mb-8 max-h-[400px] overflow-y-auto pr-2">
              {(teams[activeCategory] || []).map((team, index) => (
                <div key={index} className="flex gap-2">
                  <input type="text" value={team} onChange={(e) => handleNameChange(index, e.target.value)} className="flex-grow p-3 border-2 border-slate-100 rounded-xl font-semibold focus:border-emerald-500 outline-none" placeholder={`Takım ${index+1}`} />
                  <button onClick={() => removeTeam(index)} className="p-3 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                </div>
              ))}
              <button onClick={() => { 
                const t = {...teams}; 
                if(!t[activeCategory]) t[activeCategory] = [];
                t[activeCategory] = [...t[activeCategory], '']; 
                setTeams(t); 
              }} className="w-full p-3 border-2 border-dashed border-slate-200 text-slate-400 rounded-xl font-bold hover:border-emerald-300 hover:text-emerald-500 transition-all">+ Takım Ekle</button>
            </div>
            <button onClick={startTournament} className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"><Play/> FİKSTÜRÜ BAŞLAT</button>
          </div>
        ) : (
          <div className="flex-grow overflow-x-auto bg-white border border-slate-200 rounded-3xl p-6 shadow-inner">
            {brackets?.[activeCategory] ? (
              <div className="flex gap-12 min-w-max h-full items-center px-4">
                {brackets[activeCategory].map((round, rIdx) => (
                  <div key={rIdx} className="flex flex-col gap-8 w-56">
                    <h4 className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Tur {rIdx+1}</h4>
                    {round.map((match, mIdx) => (
                      <div key={mIdx} className={`p-3 border-2 rounded-2xl bg-white shadow-sm space-y-2 ${userRole === 'admin' && !match.isBye ? 'cursor-pointer hover:border-emerald-500 transition-all' : 'border-slate-100'}`}
                           onClick={() => { if(userRole === 'admin' && !match.isBye && match.t1 && match.t2) setScoreModal({ isOpen: true, category: activeCategory, rIdx, mIdx, matchData: match }); }}>
                         {[ {n: match.t1, s: match.scores?.[0]?.t1 || '0', win: match.winner === match.t1}, {n: match.t2, s: match.scores?.[0]?.t2 || '0', win: match.winner === match.t2} ].map((side, i) => (
                           <div key={i} className={`flex justify-between p-2 rounded-xl text-xs font-black ${side.win ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600'}`}>
                             <span className="truncate max-w-[120px]">{side.n || '...'}</span>
                             <span>{side.s}</span>
                           </div>
                         ))}
                      </div>
                    ))}
                  </div>
                ))}
                <div className="w-64 flex flex-col items-center gap-4">
                   <div className={`p-10 rounded-full border-4 flex items-center justify-center ${champions?.[activeCategory] ? 'bg-yellow-50 border-yellow-400 shadow-2xl animate-bounce' : 'bg-slate-50 border-slate-200 opacity-20'}`}>
                      <Trophy size={60} className={champions?.[activeCategory] ? 'text-yellow-500' : 'text-slate-400'}/>
                   </div>
                   <div className="text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Şampiyon</p>
                     <p className="text-xl font-black text-slate-800 uppercase tracking-tighter">{champions?.[activeCategory] || 'BEKLENİYOR'}</p>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4">
                <AlertCircle size={60} className="opacity-10"/>
                <p className="font-black text-center text-slate-400">FİKSTÜR HAZIR DEĞİL<br/><span className="text-[10px] font-bold uppercase">Yönetici kurulumu tamamladığında sonuçlar burada görünecek.</span></p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Skor Giriş Paneli */}
      {scoreModal.isOpen && scoreModal.matchData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xs overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
              <span className="font-black uppercase tracking-tighter">Skor Girişi</span>
              <button onClick={() => setScoreModal({ isOpen: false })} className="hover:rotate-90 transition-all"><X/></button>
            </div>
            <div className="p-8 space-y-6">
               {[ {n: scoreModal.matchData.t1, id: 't1'}, {n: scoreModal.matchData.t2, id: 't2'} ].map(side => (
                 <div key={side.id} className="space-y-2 text-center">
                   <p className="text-[10px] font-black text-slate-400 uppercase truncate">{side.n}</p>
                   <input type="number" value={scoreModal.matchData.scores[0][side.id]} 
                          onChange={(e) => {
                            const b = {...brackets};
                            b[activeCategory][scoreModal.rIdx][scoreModal.mIdx].scores[0][side.id] = e.target.value;
                            setBrackets({...b});
                          }}
                          className="w-20 text-center p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-2xl focus:border-emerald-500 outline-none" />
                 </div>
               ))}
               <button onClick={() => handleScoreSave(scoreModal.rIdx, scoreModal.mIdx, activeCategory, scoreModal.matchData.scores)} className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all">KAYDET</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
