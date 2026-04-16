import React, { useState, useEffect } from 'react';
import { Trophy, Users, Play, RotateCcw, Shuffle, Check, Plus, Trash2, X, AlertCircle, Lock, LogOut, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- FIREBASE YAPILANDIRMASI (Resimdeki Bilgilerle Güncellendi) ---
const firebaseConfig = {
  apiKey: "AIzaSyDGwLbn64sA3sUhJ8kiT_zr-2dsKSzpN_8",
  authDomain: "padel-fikstur.firebaseapp.com",
  projectId: "padel-fikstur",
  storageBucket: "padel-fikstur.firebasestorage.app",
  messagingSenderId: "698895837405",
  appId: "1:698895837405:web:f478ec7488f6f5388bd334",
  measurementId: "G-CE61VW0HJ3"
};

// Firebase başlatma
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'padel-app-live';

const CATEGORIES = ['Çift Erkekler', 'Çift Kadınlar', 'Mix Çiftler'];

const App = () => {
  // Giriş ve Yetkilendirme Durumları
  const [userRole, setUserRole] = useState(null); // 'admin', 'guest' veya null
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  // Bulut Veri Durumları
  const [fbUser, setFbUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Turnuva Durumları
  const [phase, setPhase] = useState('setup'); 
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [teams, setTeams] = useState({ 'Çift Erkekler': [], 'Çift Kadınlar': [], 'Mix Çiftler': [] });
  const [brackets, setBrackets] = useState({ 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null });
  const [champions, setChampions] = useState({ 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null });

  const [scoreModal, setScoreModal] = useState({ isOpen: false, category: null, rIdx: null, mIdx: null, matchData: null });

  const sampleTeams = ["Ali & Veli", "Ayşe & Fatma", "Can & Cem", "Deniz & Derya", "Efe & Ege", "Gül & Nur", "Hasan & Hüseyin", "İrem & Sinem"];

  // 1. Firebase Auth ve Veri Dinleme
  useEffect(() => {
    // Anonim giriş (Veri okuyabilmek için şart)
    signInAnonymously(auth).catch(err => console.error("Auth hatası:", err));

    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      setFbUser(user);
    });

    return () => authUnsubscribe();
  }, []);

  // 2. Canlı Veri Senkronizasyonu
  useEffect(() => {
    if (!fbUser) return;

    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main');
    const snapUnsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.brackets) setBrackets(data.brackets);
        if (data.champions) setChampions(data.champions);
        if (data.phase) setPhase(data.phase);
        if (data.teams) setTeams(data.teams);
        setIsConnected(true);
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Senkronizasyon hatası:", err);
      setIsConnected(false);
      setIsLoading(false);
    });

    return () => snapUnsubscribe();
  }, [fbUser]);

  // Buluta Veri Yazma (Sadece Admin)
  const updateDb = async (updates) => {
    if (userRole !== 'admin') return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main');
      await setDoc(docRef, updates, { merge: true });
    } catch (e) {
      console.error("Kaydetme hatası:", e);
    }
  };

  // --- Handlers ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.username === 'Admin' && loginData.password === 'Admin19.!') {
      setUserRole('admin');
      setLoginError('');
    } else {
      setLoginError('Hatalı kullanıcı adı veya şifre!');
    }
  };

  const handleGuestLogin = () => {
    setUserRole('guest');
  };

  const handleLogout = () => {
    setUserRole(null);
    setLoginData({ username: '', password: '' });
  };

  const handleNameChange = (index, value) => {
    if (userRole !== 'admin') return;
    const newTeams = { ...teams };
    newTeams[activeCategory][index] = value;
    setTeams(newTeams);
    // Debounced save
    clearTimeout(window.saveTimeout);
    window.saveTimeout = setTimeout(() => updateDb({ teams: newTeams }), 1000);
  };

  const addTeam = () => {
    if (userRole !== 'admin') return;
    const newTeams = { ...teams };
    newTeams[activeCategory] = [...(newTeams[activeCategory] || []), ''];
    setTeams(newTeams);
    updateDb({ teams: newTeams });
  };

  const removeTeam = (index) => {
    if (userRole !== 'admin') return;
    const newTeams = { ...teams };
    newTeams[activeCategory].splice(index, 1);
    setTeams(newTeams);
    updateDb({ teams: newTeams });
  };

  const fillRandom = () => {
    if (userRole !== 'admin') return;
    const shuffled = [...sampleTeams].sort(() => 0.5 - Math.random());
    const newTeams = { ...teams };
    newTeams[activeCategory] = Array(8).fill('').map((_, i) => shuffled[i % shuffled.length]);
    setTeams(newTeams);
    updateDb({ teams: newTeams });
  };

  const generateInitialBracket = (teamList) => {
    const validTeams = teamList.filter(t => t.trim() !== '');
    if (validTeams.length < 2) return null;
    const P = Math.pow(2, Math.ceil(Math.log2(validTeams.length)));
    const numMatchesRound0 = P / 2;
    const rounds = [];
    const round0 = [];
    for (let i = 0; i < numMatchesRound0; i++) {
      const t1 = validTeams[i];
      const t2 = (i + numMatchesRound0 < validTeams.length) ? validTeams[i + numMatchesRound0] : null;
      round0.push({ id: `0-${i}`, t1, t2, isBye: t2 === null, winner: t2 === null ? t1 : null, scores: [{t1:'',t2:''},{t1:'',t2:''},{t1:'',t2:''}] });
    }
    rounds.push(round0);
    let prevMatches = numMatchesRound0;
    let roundNum = 1;
    while (prevMatches > 1) {
      const currentMatches = prevMatches / 2;
      const round = [];
      for (let i = 0; i < currentMatches; i++) {
        round.push({ id: `${roundNum}-${i}`, t1: rounds[roundNum-1][i*2].winner, t2: rounds[roundNum-1][i*2+1].winner, isBye: false, winner: null, scores: [{t1:'',t2:''},{t1:'',t2:''},{t1:'',t2:''}] });
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
      if (teams[cat]?.length >= 2) newBrackets[cat] = generateInitialBracket(teams[cat]);
    });
    setBrackets(newBrackets);
    setPhase('bracket');
    updateDb({ phase: 'bracket', brackets: newBrackets, teams });
  };

  const resetTournament = () => {
    if (userRole === 'admin' && window.confirm("Tüm verileri silip kuruluma dönmek istediğinize emin misiniz?")) {
      const emptyBrackets = { 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null };
      updateDb({ phase: 'setup', brackets: emptyBrackets, champions: emptyBrackets });
    }
  };

  // Maç sonucu hesaplama ve kaydetme (Kısaltılmış versiyon)
  const handleScoreSave = (rIdx, mIdx, category, newScores, manualWinner = null) => {
    if (userRole !== 'admin') return;
    const newBrackets = { ...brackets };
    const round = newBrackets[category][rIdx];
    const match = round[mIdx];
    match.scores = newScores;
    // Basit kazanan tespiti (Set odaklı)
    let s1 = 0, s2 = 0;
    newScores.forEach(s => { if(parseInt(s.t1)>parseInt(s.t2)) s1++; else if(parseInt(s.t2)>parseInt(s.t1)) s2++; });
    const finalWinner = manualWinner || (s1 > s2 ? match.t1 : s2 > s1 ? match.t2 : null);
    
    if (finalWinner) {
      match.winner = finalWinner;
      if (rIdx + 1 < newBrackets[category].length) {
        const nextMIdx = Math.floor(mIdx / 2);
        if (mIdx % 2 === 0) newBrackets[category][rIdx + 1][nextMIdx].t1 = finalWinner;
        else newBrackets[category][rIdx + 1][nextMIdx].t2 = finalWinner;
      } else {
        const newChamps = { ...champions, [category]: finalWinner };
        setChampions(newChamps);
        updateDb({ champions: newChamps });
      }
    }
    setBrackets(newBrackets);
    setScoreModal({ isOpen: false });
    updateDb({ brackets: newBrackets });
  };

  // --- RENDERING ---

  // Yükleme Ekranı
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Sistem Yükleniyor...</p>
      </div>
    );
  }

  // Giriş Ekranı (BEKÇİ)
  if (!userRole) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
              <Trophy size={40} />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-center text-slate-800 mb-2 tracking-tight">Padel Fikstür Pro</h1>
          <p className="text-center text-slate-500 text-sm mb-10">Turnuvayı yönetin veya canlı takip edin.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-100 text-center font-bold uppercase tracking-wide">{loginError}</div>}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Kullanıcı Adı</label>
              <input type="text" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="Admin" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Şifre</label>
              <input type="password" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="••••••••" />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-200 transition-all transform active:scale-95">Admin Olarak Giriş Yap</button>
          </form>

          <div className="mt-10 pt-6 border-t border-slate-100">
            <button onClick={handleGuestLogin} className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
              <Users size={20} /> Misafir Olarak İzle
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ANA UYGULAMA EKRANI
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      <header className="bg-emerald-800 text-white shadow-lg p-4 sm:p-5 shrink-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Trophy size={28} className="text-yellow-400 shrink-0" />
            <h1 className="text-lg sm:text-xl font-black tracking-tighter uppercase">Padel Fikstür Pro</h1>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold ${isConnected ? 'bg-emerald-700 text-emerald-200' : 'bg-red-900/50 text-red-200'}`}>
               {isConnected ? <Cloud size={14}/> : <CloudOff size={14}/>}
               <span className="hidden sm:inline">{isConnected ? 'CANLI' : 'BAĞLANTI YOK'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold border ${userRole === 'admin' ? 'bg-emerald-900/50 border-emerald-500 text-emerald-100' : 'bg-slate-700/50 border-slate-500 text-slate-200'}`}>
              {userRole === 'admin' ? <Lock size={12}/> : <Users size={12}/>}
              {userRole === 'admin' ? 'YÖNETİCİ' : 'İZLEYİCİ'}
            </div>
            {phase === 'bracket' && userRole === 'admin' && (
              <button onClick={resetTournament} className="bg-red-700 hover:bg-red-800 p-2 rounded-lg transition-colors"><RotateCcw size={18} /></button>
            )}
            <button onClick={handleLogout} className="bg-emerald-900 hover:bg-black p-2 rounded-lg transition-colors"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full p-4 sm:p-6 flex flex-col overflow-hidden">
        {/* Sekmeler */}
        <div className="flex space-x-2 border-b border-slate-200 mb-6 shrink-0 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-5 py-3 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeCategory === cat ? 'border-emerald-600 text-emerald-800 bg-emerald-50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{cat}</button>
          ))}
        </div>

        {phase === 'setup' && userRole === 'admin' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-4xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-black text-slate-800">{activeCategory} Takım Listesi</h2>
                <p className="text-slate-500 text-sm">Takımları ekleyin veya güncelleyin.</p>
              </div>
              <div className="flex gap-2">
                 <button onClick={fillRandom} className="px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 flex items-center gap-2"><Shuffle size={16}/> Rastgele</button>
                 <button onClick={addTeam} className="px-4 py-2 text-xs font-bold bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 flex items-center gap-2"><Plus size={16}/> Ekle</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10 max-h-[400px] overflow-y-auto pr-2">
              {teams[activeCategory]?.map((team, index) => (
                <div key={index} className="flex items-center gap-2 group">
                  <span className="w-6 text-[10px] font-black text-slate-300">#{index+1}</span>
                  <input type="text" value={team} onChange={(e) => handleNameChange(index, e.target.value)} placeholder="Takım Adı" className="flex-grow px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-semibold" />
                  <button onClick={() => removeTeam(index)} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>

            <button onClick={startTournament} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 transition-all">
              <Play size={24}/> FİKSTÜRÜ OLUŞTUR VE YAYINLA
            </button>
          </div>
        ) : (
          <div className="flex-grow flex flex-col overflow-hidden">
            <div className="flex-grow overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-inner p-6">
              {brackets[activeCategory] ? (
                <div className="flex gap-12 min-w-max h-full items-center">
                  {brackets[activeCategory].map((round, rIdx) => (
                    <div key={rIdx} className="flex flex-col gap-8 w-60">
                      <h4 className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{getRoundName(rIdx, brackets[activeCategory].length)}</h4>
                      <div className="flex flex-col justify-around gap-6 h-full">
                        {round.map((match, mIdx) => (
                          <div key={mIdx} 
                               className={`bg-white border-2 rounded-2xl shadow-sm overflow-hidden transition-all ${userRole === 'admin' ? 'cursor-pointer hover:border-emerald-500 hover:shadow-lg' : ''} ${match.winner ? 'border-slate-100' : 'border-slate-200'}`}
                               onClick={() => { if(userRole === 'admin') setScoreModal({ isOpen: true, category: activeCategory, rIdx, mIdx, matchData: match }); }}>
                            <div className="p-3 space-y-2">
                              {[ {t: match.t1, s: match.scores[0].t1, isWinner: match.winner === match.t1}, {t: match.t2, s: match.scores[0].t2, isWinner: match.winner === match.t2}].map((side, idx) => (
                                <div key={idx} className={`flex items-center justify-between p-2 rounded-xl transition-all ${side.isWinner ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-50 text-slate-700'}`}>
                                  <span className="text-xs font-black truncate max-w-[140px]">{side.isWinner && <Check size={12} className="inline mr-1"/>}{side.t || '...'}</span>
                                  <span className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-lg ${side.isWinner ? 'bg-emerald-500' : 'bg-white border border-slate-200'}`}>{side.s || '0'}</span>
                                </div>
                              ))}
                            </div>
                            {userRole === 'admin' && !match.winner && match.t1 && match.t2 && (
                               <div className="bg-slate-50 py-1.5 text-center text-[9px] font-black text-slate-400 uppercase border-t border-slate-100">Skor Gir</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-col items-center w-64 pt-8">
                     <div className={`p-8 rounded-[2.5rem] border-4 flex flex-col items-center gap-4 transition-all duration-500 ${champions[activeCategory] ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-400 shadow-2xl scale-110' : 'bg-slate-50 border-slate-200 border-dashed opacity-50'}`}>
                        <Trophy size={64} className={champions[activeCategory] ? 'text-yellow-500 animate-bounce' : 'text-slate-200'}/>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-1">Şampiyon</p>
                          <h3 className={`text-xl font-black ${champions[activeCategory] ? 'text-slate-900' : 'text-slate-300'}`}>{champions[activeCategory] || 'BEKLENİYOR'}</h3>
                        </div>
                     </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                  <AlertCircle size={64} className="opacity-20"/>
                  <p className="font-bold text-center">Fikstür henüz oluşturulmadı.<br/><span className="text-xs font-normal">Yönetici ayarları yaptıktan sonra burada görünecek.</span></p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* SKOR GİRİŞ MODAL (Sadece Admin) */}
      {scoreModal.isOpen && userRole === 'admin' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
              <h3 className="font-black text-xl uppercase tracking-tighter italic">Skor Girişi</h3>
              <button onClick={() => setScoreModal({ isOpen: false })}><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
               {[ {name: scoreModal.matchData.t1, id: 't1'}, {name: scoreModal.matchData.t2, id: 't2'} ].map(side => (
                 <div key={side.id} className="space-y-3">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{side.name}</p>
                   <div className="flex gap-2">
                     {[0,1,2].map(sIdx => (
                        <input key={sIdx} type="number" 
                               value={scoreModal.matchData.scores[sIdx][side.id]} 
                               onChange={(e) => {
                                 const val = e.target.value;
                                 const newB = {...brackets};
                                 newB[activeCategory][scoreModal.rIdx][scoreModal.mIdx].scores[sIdx][side.id] = val;
                                 setBrackets({...newB});
                               }}
                               className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-center font-black text-lg focus:border-emerald-500 outline-none transition-all" />
                     ))}
                   </div>
                 </div>
               ))}
               <button onClick={() => handleScoreSave(scoreModal.rIdx, scoreModal.mIdx, activeCategory, scoreModal.matchData.scores)}
                       className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95">KAYDET VE İLERLE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
