import React, { useState, useEffect } from 'react';
import { Trophy, Users, Play, RotateCcw, Shuffle, Check, Plus, Trash2, X, AlertCircle, Lock, LogOut, Cloud, CloudOff, Loader2, Settings2, Edit3, Save, Calendar, Clock, MapPin, Filter, FileText } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

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

const CATEGORIES = ['Kurallar', 'Program', 'Çift Erkekler', 'Çift Kadınlar', 'Mix Çiftler'];
const MATCH_CATEGORIES = ['Çift Erkekler', 'Çift Kadınlar', 'Mix Çiftler'];

const App = () => {
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
  const [rules, setRules] = useState("Turnuva kuralları henüz belirlenmedi.");
  const [scoreModal, setScoreModal] = useState({ isOpen: false, category: null, rIdx: null, mIdx: null, editMode: false });
  const [resetModal, setResetModal] = useState({ isOpen: false, password: '', error: '' });
  const [scheduleModal, setScheduleModal] = useState({ isOpen: false, type: 'event', time: '', label: '', category: MATCH_CATEGORIES[0], court: '1' });

  const sampleTeams = ["Ali & Veli", "Ayşe & Fatma", "Can & Cem", "Deniz & Derya", "Efe & Ege", "Gül & Nur", "Hasan & Hüseyin", "İrem & Sinem"];

  const syncToCloud = async (updates) => {
    if (userRole !== 'admin') return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main');
      await setDoc(docRef, updates, { merge: true });
    } catch (e) { console.error("Sync Hatası:", e); }
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

  const handleSaveRules = () => {
    syncToCloud({ rules });
    alert("Kurallar başarıyla kaydedildi.");
  };

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
    } catch (err) { console.error(err); }
  };

  const removeScheduleItem = (id) => {
    const newSchedule = (schedule || []).filter(item => item.id !== id);
    setSchedule(newSchedule);
    syncToCloud({ schedule: newSchedule });
  };

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

  const createCategoryBracket = (cat) => {
    if (userRole !== 'admin') return;
    const validTeams = teams[cat]?.filter(t => t && t.trim() !== '') || [];
    if (validTeams.length < 2) { alert("En az 2 takım girmelisiniz!"); return; }
    const newBrackets = { ...brackets };
    newBrackets[cat] = generateInitialBracket(validTeams);
    setBrackets(newBrackets);
    syncToCloud({ brackets: newBrackets, teams });
  };

  const resetCategoryBracket = (cat) => {
    if (window.confirm(`${cat} fikstürünü iptal etmek istediğinize emin misiniz?`)) {
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
      setBrackets(emptyState); setChampions(emptyState); setTeams(emptyTeams); setSchedule([]); setRules("Turnuva kuralları belirlenmedi.");
      syncToCloud({ brackets: emptyState, champions: emptyState, teams: emptyTeams, schedule: [], rules: "Turnuva kuralları belirlenmedi." });
      setResetModal({ isOpen: false, password: '', error: '' });
    } else { setResetModal({ ...resetModal, error: 'Şifre Hatalı!' }); }
  };

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
        setChampions(nc); syncToCloud({ champions: nc });
      }
    }
    setBrackets(newBrackets); setScoreModal({ isOpen: false, category: null, rIdx: null, mIdx: null, editMode: false });
    syncToCloud({ brackets: newBrackets });
  };

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
        if (d.rules !== undefined) setRules(d.rules);
        setIsConnected(true);
      }
      setIsLoading(false);
    });
    return () => unsub();
  }, [fbUser]);

  if (isLoading) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white"><Loader2 className="animate-spin mb-2" />Yükleniyor...</div>;

  if (!userRole) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm">
        <h1 className="text-xl font-black text-center text-slate-900 mb-6 uppercase italic">Padel Fikstür Pro</h1>
        <form onSubmit={handleLogin} className="space-y-3">
          {loginError && <div className="bg-red-50 text-red-600 text-[10px] p-2 rounded-lg text-center font-bold">{loginError}</div>}
          <input type="text" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs outline-none" placeholder="Kullanıcı Adı" />
          <input type="password" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs outline-none" placeholder="Şifre" />
          <button type="submit" className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl shadow-md uppercase text-[10px]">GİRİŞ YAP</button>
        </form>
        <button onClick={handleGuestLogin} className="w-full mt-3 bg-slate-900 text-white font-black py-3 rounded-xl uppercase text-[10px]">MİSAFİR GİRİŞİ</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans text-slate-900">
      <header className="bg-[#064e3b] text-white p-3 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="font-black text-sm uppercase italic">Padel Fikstür Pro</h1>
          <div className="flex items-center gap-2">
            <span className="text-[7px] font-black bg-white/10 px-2 py-1 rounded">{userRole === 'admin' ? 'ADMİN' : 'İZLEYİCİ'}</span>
            <button onClick={handleLogout} className="p-1.5 bg-white/5 rounded-lg"><LogOut size={14}/></button>
          </div>
        </div>
      </header>
      <main className="flex-grow p-3 sm:p-4 max-w-7xl mx-auto w-full flex flex-col overflow-hidden">
        <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat)} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg whitespace-nowrap ${activeTab === cat ? 'bg-[#064e3b] text-white shadow-md' : 'bg-white text-slate-400 shadow-sm'}`}>{cat}</button>
          ))}
        </div>
        {activeTab === 'Kurallar' ? (
          <div className="bg-white rounded-2xl p-6 border shadow-xl max-w-4xl mx-auto w-full">
            <h2 className="text-lg font-black uppercase italic mb-6">Turnuva Kuralları</h2>
            {userRole === 'admin' ? (
              <div className="space-y-4">
                <textarea value={rules} onChange={(e) => setRules(e.target.value)} className="w-full h-64 p-4 bg-slate-50 border rounded-xl font-medium text-sm outline-none" />
                <button onClick={handleSaveRules} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-md">Yayınla</button>
              </div>
            ) : ( <div className="bg-slate-50 p-6 rounded-xl border text-sm leading-relaxed whitespace-pre-wrap">{rules}</div> )}
          </div>
        ) : activeTab === 'Program' ? (
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl border">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-black uppercase italic">Turnuva Akışı</h2>
              {userRole === 'admin' && ( <button onClick={() => setScheduleModal({ ...scheduleModal, isOpen: true })} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black">+ EKLE</button> )}
            </div>
            <div className="space-y-4">
              {(schedule || []).sort((a,b) => String(a.time).localeCompare(String(b.time))).map(item => (
                <div key={item.id} className="p-3 bg-slate-50 border rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-black text-emerald-800 bg-white px-2 py-0.5 rounded shadow-sm mr-2">{item.time}</span>
                    <span className="text-xs font-black text-slate-800 uppercase">{item.label}</span>
                  </div>
                  {userRole === 'admin' && ( <button onClick={() => removeScheduleItem(item.id)} className="text-red-500"><Trash2 size={14}/></button> )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          !brackets?.[activeTab] ? (
            <div className="bg-white rounded-2xl p-6 border shadow-xl max-w-3xl mx-auto w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-black uppercase italic">{activeTab} Kaydı</h2>
                {userRole === 'admin' && (
                  <div className="flex gap-2">
                    <button onClick={fillRandom} className="px-3 py-1.5 text-[8px] font-black bg-slate-100 rounded-lg uppercase">Rastgele</button>
                    <button onClick={addTeam} className="px-3 py-1.5 text-[8px] font-black bg-emerald-50 text-emerald-700 rounded-lg uppercase">+ Ekle</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 max-h-[300px] overflow-y-auto">
                {(teams[activeTab] || []).map((team, index) => (
                  <div key={index} className="bg-slate-50 border p-2 rounded-lg flex items-center gap-2">
                    <span className="text-[8px] font-black text-slate-300">#{index+1}</span>
                    {userRole === 'admin' ? (
                      <input type="text" value={team} onChange={(e) => handleNameChange(index, e.target.value)} className="flex-grow bg-transparent font-bold text-xs outline-none" />
                    ) : ( <span className="flex-grow font-bold text-xs">{team || 'Bekleniyor...'}</span> )}
                  </div>
                ))}
              </div>
              {userRole === 'admin' && ( <button onClick={() => createCategoryBracket(activeTab)} className="w-full bg-[#064e3b] text-white font-black py-3.5 rounded-xl text-xs uppercase italic">Fikstürü Oluştur</button> )}
            </div>
          ) : (
            <div className="flex-grow overflow-x-auto bg-white border rounded-2xl p-4 shadow-inner">
              <div className="flex justify-between mb-4">
                <h3 className="text-xs font-black uppercase text-slate-400">{activeTab}</h3>
                {userRole === 'admin' && ( <button onClick={() => resetCategoryBracket(activeTab)} className="text-red-600 text-[8px] font-black uppercase">İPTAL ET</button> )}
              </div>
              <div className="flex gap-8 min-w-max h-full items-center">
                {brackets[activeTab].map((round, rIdx) => (
                  <div key={rIdx} className="flex flex-col gap-6 w-44">
                    <div className="flex flex-col justify-around gap-4 h-full">
                      {round.map((match, mIdx) => (
                        <div key={mIdx} className="relative group">
                          {userRole === 'admin' && !match.isBye && (
                            <button onClick={() => setScoreModal({ isOpen: true, category: activeTab, rIdx, mIdx, editMode: true })} className="absolute -top-2 -right-2 z-10 p-1 bg-slate-800 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"><Edit3 size={10}/></button>
                          )}
                          <div className={`p-2 border-2 rounded-xl transition-all ${userRole === 'admin' && !match.isBye ? 'cursor-pointer hover:border-emerald-500' : 'border-slate-50'}`} onClick={() => { if(userRole === 'admin' && !match.isBye && match.t1 && match.t2) setScoreModal({ isOpen: true, category: activeTab, rIdx, mIdx, editMode: false }); }}>
                            {[ {n: match.t1, s: match.scores?.[0]?.t1 || '0', win: match.winner === match.t1}, {n: match.t2, s: match.scores?.[0]?.t2 || '0', win: match.winner === match.t2} ].map((side, i) => (
                              <div key={i} className={`flex justify-between items-center p-1.5 rounded-lg text-[9px] font-black mb-1 ${side.win ? 'bg-[#064e3b] text-white' : 'bg-slate-50 text-slate-600'}`}>
                                <span className="truncate max-w-[90px]">{side.n || '...'}</span>
                                <span className="w-4 h-4 flex items-center justify-center rounded-md text-[8px] bg-white border text-[#064e3b]">{side.s}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </main>
      {scheduleModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-black uppercase text-xs">Programa Ekle</h3>
            <input type="time" value={scheduleModal.time} onChange={e => setScheduleModal({...scheduleModal, time: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg" />
            <input type="text" value={scheduleModal.label} onChange={e => setScheduleModal({...scheduleModal, label: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg" placeholder="Etkinlik Adı" />
            <button onClick={handleAddSchedule} className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl uppercase text-xs">Kaydet</button>
            <button onClick={() => setScheduleModal({ ...scheduleModal, isOpen: false })} className="w-full text-xs font-bold text-slate-400 uppercase">İptal</button>
          </div>
        </div>
      )}
      {scoreModal.isOpen && currentMatch && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-black uppercase text-xs">{scoreModal.editMode ? 'Eşleşmeyi Düzenle' : 'Skor Gir'}</h3>
            {[ {n: currentMatch.t1, id: 't1'}, {n: currentMatch.t2, id: 't2'} ].map(side => (
              <div key={side.id} className="flex flex-col gap-2">
                <span className="text-[9px] font-black uppercase text-slate-400">{side.n || '...'}</span>
                {scoreModal.editMode ? (
                  <input type="text" value={side.n || ''} onChange={(e) => { const nb = {...brackets}; nb[smCat][smR][smM][side.id] = e.target.value; setBrackets(nb); }} className="w-full p-2 bg-slate-50 border rounded-lg text-xs font-bold" />
                ) : (
                  <input type="number" value={currentMatch.scores[0][side.id]} onChange={(e) => { const nb = {...brackets}; nb[smCat][smR][smM].scores[0][side.id] = e.target.value; setBrackets(nb); }} className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-xl text-center" />
                )}
              </div>
            ))}
            <button onClick={scoreModal.editMode ? () => { syncToCloud({ brackets }); setScoreModal({ isOpen: false, category: null, rIdx: null, mIdx: null, editMode: false }); } : handleScoreSave} className="w-full bg-[#064e3b] text-white font-black py-3 rounded-xl text-xs uppercase">Kaydet</button>
            <button onClick={() => setScoreModal({ isOpen: false, category: null, rIdx: null, mIdx: null, editMode: false })} className="w-full text-xs font-bold text-slate-400 uppercase">İptal</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
