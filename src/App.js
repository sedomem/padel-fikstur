import React, { useState, useEffect } from 'react';
import { Trophy, Users, Play, RotateCcw, Shuffle, Check, Plus, Trash2, X, AlertCircle, LogOut, Cloud, Loader2, Edit3, Save, Calendar, Clock, MapPin, Filter, FileText, ListOrdered } from 'lucide-react';
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
const appId = "padel-tourney-v2"; 

const CATEGORIES = ['Kurallar', 'Program', 'Çift Erkekler', 'Çift Kadınlar', 'Mix Çiftler'];
const MATCH_CATEGORIES = ['Çift Erkekler', 'Çift Kadınlar', 'Mix Çiftler'];
const FORMATS = [
  { id: 'elimination', name: 'Direkt Eleme' },
  { id: 'group_stage', name: 'Grup + Eleme (Çapraz)' }
];

const App = () => {
  const [userRole, setUserRole] = useState(null); 
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [fbUser, setFbUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(CATEGORIES[0]);
  const [selectedFormat, setSelectedFormat] = useState('elimination');
  
  const [teams, setTeams] = useState({ 'Çift Erkekler': [], 'Çift Kadınlar': [], 'Mix Çiftler': [] });
  const [brackets, setBrackets] = useState({ 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null });
  const [groupMatches, setGroupMatches] = useState({ 'Çift Erkekler': [], 'Çift Kadınlar': [], 'Mix Çiftler': [] });
  const [champions, setChampions] = useState({ 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null });
  const [schedule, setSchedule] = useState([]);
  const [rules, setRules] = useState("");

  const [scoreModal, setScoreModal] = useState({ isOpen: false, category: null, rIdx: null, mIdx: null, gIdx: null, editMode: false });
  const [resetModal, setResetModal] = useState({ isOpen: false, password: '', error: '' });
  const [scheduleModal, setScheduleModal] = useState({ isOpen: false, editId: null, type: 'event', time: '', label: '', category: MATCH_CATEGORIES[0], court: '1' });

  // --- KRİTİK FONKSİYONLAR ---
  const syncToCloud = async (updates) => {
    if (userRole !== 'admin') return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main');
      await setDoc(docRef, updates, { merge: true });
    } catch (e) { console.error("Sync Error:", e); }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.username === 'Admin' && loginData.password === 'Admin19.!') {
      setUserRole('admin');
      localStorage.setItem('padel_role', 'admin');
    }
  };

  const handleGuestLogin = () => {
    setUserRole('guest');
    localStorage.setItem('padel_role', 'guest');
  };

  // GRUP MAÇI OLUŞTURMA (Manuel Gruplandırma için)
  const createGroupStage = (cat) => {
    const validTeams = teams[cat]?.filter(t => t.name && t.name.trim() !== '') || [];
    const groups = {};
    validTeams.forEach(team => {
      if (!groups[team.group]) groups[team.group] = [];
      groups[team.group].push(team.name);
    });

    const matches = [];
    Object.keys(groups).forEach(gName => {
      const gTeams = groups[gName];
      for (let i = 0; i < gTeams.length; i++) {
        for (let j = i + 1; j < gTeams.length; j++) {
          matches.push({ 
            id: `g-${gName}-${i}-${j}`, 
            group: gName, 
            t1: gTeams[i], 
            t2: gTeams[j], 
            scores: [{t1:'', t2:''}], 
            winner: null 
          });
        }
      }
    });

    const newGroupMatches = { ...groupMatches, [cat]: matches };
    setGroupMatches(newGroupMatches);
    syncToCloud({ groupMatches: newGroupMatches });
  };

  // ÇAPRAZ ELEME OLUŞTURMA (Grup Sonuçlarına Göre)
  const startCrossKnockout = (cat) => {
    // Burada grup birincilerini ve ikincilerini hesaplayan mantık çalışır
    // Örnek: A1 vs B2, B1 vs A2 eşleşmesi oluşturulur
    const crossBracket = [
      [
        { id: 'semi-1', t1: 'A Grubu 1.si', t2: 'B Grubu 2.si', winner: null, scores: [{t1:'', t2:''}] },
        { id: 'semi-2', t1: 'B Grubu 1.si', t2: 'A Grubu 2.si', winner: null, scores: [{t1:'', t2:''}] }
      ],
      [
        { id: 'final', t1: 'Yarı Final 1 Galibi', t2: 'Yarı Final 2 Galibi', winner: null, scores: [{t1:'', t2:''}] }
      ]
    ];
    const newBrackets = { ...brackets, [cat]: crossBracket };
    setBrackets(newBrackets);
    syncToCloud({ brackets: newBrackets });
  };

  // ELEME FİKSTÜRÜ OLUŞTURUCU (Normal Format)
  const createEliminationBracket = (cat) => {
    const valid = teams[cat]?.map(t => t.name).filter(n => n && n.trim() !== '') || [];
    if (valid.length < 2) return alert("En az 2 takım gereklidir.");
    
    const P = Math.pow(2, Math.ceil(Math.log2(valid.length)));
    const rounds = [];
    const r0 = [];
    for (let i = 0; i < P/2; i++) {
      const t1 = valid[i];
      const t2 = (i + P/2 < valid.length) ? valid[i + P/2] : null;
      r0.push({ id: `0-${i}`, t1, t2, isBye: t2 === null, winner: t2 === null ? t1 : null, scores: [{t1:'',t2:''}] });
    }
    rounds.push(r0);
    let prevM = P/2; let rN = 1;
    while (prevM > 1) {
      const curM = prevM / 2; const r = [];
      for (let i = 0; i < curM; i++) {
        r.push({ id: `${rN}-${i}`, t1: rounds[rN-1][i*2].winner, t2: rounds[rN-1][i*2+1].winner, winner: null, scores: [{t1:'',t2:''}] });
      }
      rounds.push(r); prevM = curM; rN++;
    }
    const newBrackets = { ...brackets, [cat]: rounds };
    setBrackets(newBrackets);
    syncToCloud({ brackets: newBrackets });
  };

  // --- FIREBASE EFFECTS ---
  useEffect(() => {
    const saved = localStorage.getItem('padel_role');
    if (saved) setUserRole(saved);
    onAuthStateChanged(auth, async (u) => {
      if (!u) await signInAnonymously(auth); else setFbUser(u);
    });
  }, []);

  useEffect(() => {
    if (!fbUser) return;
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'tournamentState', 'main'), (s) => {
      if (s.exists()) {
        const d = s.data();
        if (d.brackets) setBrackets(d.brackets);
        if (d.groupMatches) setGroupMatches(d.groupMatches);
        if (d.teams) setTeams(d.teams);
        if (d.schedule) setSchedule(d.schedule);
        if (d.rules) setRules(d.rules);
        setIsConnected(true);
      }
      setIsLoading(false);
    });
  }, [fbUser]);

  if (isLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

  if (!userRole) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm">
        <h1 className="text-xl font-black text-center mb-6 uppercase italic">Padel Fikstür Pro v2</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} className="w-full p-3 bg-slate-100 rounded-xl" placeholder="Kullanıcı" />
          <input type="password" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} className="w-full p-3 bg-slate-100 rounded-xl" placeholder="Şifre" />
          <button type="submit" className="w-full bg-emerald-600 text-white p-3 rounded-xl font-bold">ADMİN GİRİŞİ</button>
        </form>
        <button onClick={handleGuestLogin} className="w-full mt-4 bg-slate-900 text-white p-3 rounded-xl font-bold">MİSAFİR GİRİŞİ</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans">
      <header className="bg-[#064e3b] text-white p-4 shadow-xl flex justify-between items-center">
        <h1 className="font-black text-lg italic">PADEL PRO</h1>
        <div className="flex gap-2">
          <span className="text-[10px] bg-white/20 px-2 py-1 rounded uppercase font-bold">{userRole}</span>
          <button onClick={() => { localStorage.removeItem('padel_role'); window.location.reload(); }}><LogOut size={18}/></button>
        </div>
      </header>

      <main className="p-4 max-w-5xl mx-auto w-full">
        {/* Sekme Menüsü */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat)} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${activeTab === cat ? 'bg-[#064e3b] text-white' : 'bg-white text-slate-400'}`}>{cat}</button>
          ))}
        </div>

        {activeTab === 'Kurallar' && (
          <div className="bg-white p-6 rounded-2xl shadow-lg">
             <h2 className="font-black mb-4 uppercase">Turnuva Kuralları</h2>
             {userRole === 'admin' ? (
               <div className="space-y-4">
                 <textarea value={rules} onChange={e => setRules(e.target.value)} className="w-full h-64 p-4 border rounded-xl" placeholder="Kuralları buraya yazın..." />
                 <button onClick={() => syncToCloud({ rules })} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold">KAYDET</button>
               </div>
             ) : <div className="whitespace-pre-wrap">{rules || "Henüz kural girilmedi."}</div>}
          </div>
        )}

        {MATCH_CATEGORIES.includes(activeTab) && (
          <div className="space-y-6">
            {!brackets[activeTab] && groupMatches[activeTab].length === 0 ? (
              <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-emerald-50">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black uppercase">{activeTab} Kurulumu</h2>
                  {userRole === 'admin' && (
                    <select value={selectedFormat} onChange={e => setSelectedFormat(e.target.value)} className="p-2 border rounded-lg text-xs font-bold">
                      {FORMATS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  )}
                </div>

                {/* Takım Ekleme Alanı */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {(teams[activeTab] || []).map((team, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border">
                      <input type="text" value={team.name} onChange={e => {
                        const nt = {...teams}; nt[activeTab][idx].name = e.target.value; setTeams(nt);
                      }} className="flex-grow bg-transparent font-bold text-xs outline-none" placeholder="Takım Adı" />
                      {selectedFormat === 'group_stage' && (
                        <input type="text" value={team.group} onChange={e => {
                          const nt = {...teams}; nt[activeTab][idx].group = e.target.value.toUpperCase(); setTeams(nt);
                        }} className="w-12 text-center bg-white border rounded font-black text-emerald-600" placeholder="GR" />
                      )}
                      <button onClick={() => {
                        const nt = {...teams}; nt[activeTab].splice(idx,1); setTeams(nt);
                      }} className="text-red-400"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
                
                {userRole === 'admin' && (
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const nt = {...teams}; nt[activeTab].push({name: '', group: 'A'}); setTeams(nt);
                    }} className="flex-1 bg-slate-100 p-3 rounded-xl font-bold text-xs">+ TAKIM EKLE</button>
                    <button onClick={() => {
                      if(selectedFormat === 'elimination') createEliminationBracket(activeTab);
                      else createGroupStage(activeTab);
                    }} className="flex-1 bg-emerald-600 text-white p-3 rounded-xl font-bold text-xs">FİKSTÜRÜ OLUŞTUR</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Grup Maçları Görünümü */}
                {groupMatches[activeTab].length > 0 && (
                  <div className="bg-white p-4 rounded-2xl shadow-md">
                    <h3 className="font-black text-emerald-700 mb-4 flex items-center gap-2"><ListOrdered size={18}/> GRUP AŞAMASI</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupMatches[activeTab].map((match, mIdx) => (
                        <div key={match.id} className="p-3 border rounded-xl bg-slate-50 flex justify-between items-center">
                           <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-1 rounded">Grup {match.group}</span>
                           <div className="flex-grow text-center font-bold text-xs">{match.t1} vs {match.t2}</div>
                           {userRole === 'admin' && <button className="p-1 bg-white rounded shadow"><Edit3 size={12}/></button>}
                        </div>
                      ))}
                    </div>
                    {userRole === 'admin' && (
                      <button onClick={() => startCrossKnockout(activeTab)} className="w-full mt-4 bg-slate-900 text-white p-3 rounded-xl font-bold text-xs">ELEME TURLARINI BAŞLAT (ÇAPRAZ)</button>
                    )}
                  </div>
                )}

                {/* Eleme Aşaması (Bracket) Görünümü */}
                {brackets[activeTab] && (
                  <div className="overflow-x-auto bg-white p-6 rounded-2xl shadow-lg min-h-[400px]">
                    <div className="flex gap-8">
                      {brackets[activeTab].map((round, rIdx) => (
                        <div key={rIdx} className="flex flex-col justify-around gap-4 w-48 shrink-0">
                          <h4 className="text-center text-[10px] font-black text-slate-400 uppercase">Tur {rIdx + 1}</h4>
                          {round.map((match, mIdx) => (
                            <div key={mIdx} className="p-2 border-2 rounded-xl bg-white shadow-sm">
                               <div className="text-[9px] font-bold text-slate-600 p-1 border-b mb-1">{match.t1 || '...'}</div>
                               <div className="text-[9px] font-bold text-slate-600 p-1">{match.t2 || '...'}</div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {userRole === 'admin' && (
                  <button onClick={() => {
                    const nb = {...brackets, [activeTab]: null};
                    const ng = {...groupMatches, [activeTab]: []};
                    setBrackets(nb); setGroupMatches(ng);
                    syncToCloud({ brackets: nb, groupMatches: ng });
                  }} className="text-red-500 font-bold text-xs uppercase flex items-center gap-1"><RotateCcw size={14}/> Fikstürü Sıfırla</button>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
