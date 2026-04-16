import React, { useState } from 'react';
import { Trophy, Users, Play, RotateCcw, Shuffle, Check, Plus, Trash2, X, AlertCircle } from 'lucide-react';

const CATEGORIES = ['Çift Erkekler', 'Çift Kadınlar', 'Mix Çiftler'];

const App = () => {
  const [phase, setPhase] = useState('setup'); // 'setup' or 'bracket'
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  
  // Setup states
  const [teams, setTeams] = useState({
    'Çift Erkekler': Array(4).fill(''),
    'Çift Kadınlar': Array(4).fill(''),
    'Mix Çiftler': Array(4).fill('')
  });

  // Bracket states
  const [brackets, setBrackets] = useState({
    'Çift Erkekler': null,
    'Çift Kadınlar': null,
    'Mix Çiftler': null
  });
  const [champions, setChampions] = useState({
    'Çift Erkekler': null,
    'Çift Kadınlar': null,
    'Mix Çiftler': null
  });

  // Yeni: Skor Modal State
  const [scoreModal, setScoreModal] = useState({
    isOpen: false,
    category: null,
    rIdx: null,
    mIdx: null,
    matchData: null
  });

  const sampleTeams = [
    "Ali & Veli", "Ayşe & Fatma", "Can & Cem", "Deniz & Derya",
    "Efe & Ege", "Gül & Nur", "Hasan & Hüseyin", "İrem & Sinem",
    "Kaan & Mert", "Leyla & Mecnun", "Polat & Memati", "Aslı & Kerem",
    "Burak & Onur", "Selin & Pelin", "Emre & Cenk", "Zeynep & Elif"
  ];

  // --- Setup Handlers ---

  const handleNameChange = (index, value) => {
    setTeams(prev => {
      const newTeams = [...prev[activeCategory]];
      newTeams[index] = value;
      return { ...prev, [activeCategory]: newTeams };
    });
  };

  const addTeam = () => {
    setTeams(prev => ({
      ...prev,
      [activeCategory]: [...prev[activeCategory], '']
    }));
  };

  const removeTeam = (index) => {
    setTeams(prev => {
      const newTeams = [...prev[activeCategory]];
      newTeams.splice(index, 1);
      return { ...prev, [activeCategory]: newTeams };
    });
  };

  const fillRandom = () => {
    const shuffled = [...sampleTeams].sort(() => 0.5 - Math.random());
    setTeams(prev => {
      const currentCount = prev[activeCategory].length;
      const newTeams = Array(currentCount).fill('').map((_, i) => shuffled[i % shuffled.length]);
      return { ...prev, [activeCategory]: newTeams };
    });
  };

  // --- Bracket Generation Logic ---

  const generateInitialBracket = (teamList) => {
    const validTeams = teamList.filter(t => t.trim() !== '');
    if (validTeams.length < 2) return null;

    const P = Math.pow(2, Math.ceil(Math.log2(validTeams.length)));
    const numByes = P - validTeams.length;
    const numMatchesRound0 = P / 2;

    const rounds = [];
    const round0 = [];
    
    // R0: Eşleşmeleri ve BAY geçenleri belirle
    for (let i = 0; i < numMatchesRound0; i++) {
      const t1 = validTeams[i];
      // Eğer sıradaki index takımlar listesinin içindeyse eşleştir, yoksa BAY geçer
      const t2 = (i + numMatchesRound0 < validTeams.length) ? validTeams[i + numMatchesRound0] : null;
      
      round0.push({
        id: `0-${i}`,
        t1,
        t2,
        isBye: t2 === null,
        winner: t2 === null ? t1 : null, // BAY geçen otomatik kazanır
        scores: [{t1: '', t2: ''}, {t1: '', t2: ''}, {t1: '', t2: ''}]
      });
    }
    rounds.push(round0);

    // Sonraki turların boş şablonunu oluştur
    let prevRoundMatches = numMatchesRound0;
    let roundNum = 1;
    while (prevRoundMatches > 1) {
      const currentRoundMatches = prevRoundMatches / 2;
      const round = [];
      for (let i = 0; i < currentRoundMatches; i++) {
        const prevM1 = rounds[roundNum - 1][i * 2];
        const prevM2 = rounds[roundNum - 1][i * 2 + 1];
        
        // Önceki turdan BAY geçerek gelen varsa doğrudan bu tura yerleştir
        const t1 = prevM1.winner; 
        const t2 = prevM2.winner;
        
        round.push({
          id: `${roundNum}-${i}`,
          t1,
          t2,
          isBye: false,
          winner: null,
          scores: [{t1: '', t2: ''}, {t1: '', t2: ''}, {t1: '', t2: ''}]
        });
      }
      rounds.push(round);
      prevRoundMatches = currentRoundMatches;
      roundNum++;
    }
    return rounds;
  };

  const startTournament = () => {
    const newBrackets = { 'Çift Erkekler': null, 'Çift Kadınlar': null, 'Mix Çiftler': null };
    let hasValid = false;

    CATEGORIES.forEach(cat => {
      const validTeams = teams[cat].filter(t => t.trim() !== '');
      if (validTeams.length >= 2) {
        newBrackets[cat] = generateInitialBracket(validTeams);
        hasValid = true;
      }
    });

    if (!hasValid) {
      alert("Fikstür oluşturabilmek için en az bir kategoriye en az 2 takım eklemelisiniz!");
      return;
    }

    setBrackets(newBrackets);
    // İlk geçerli kategori sekmesini aktif et
    const firstValid = CATEGORIES.find(c => newBrackets[c] !== null);
    if (firstValid) setActiveCategory(firstValid);
    
    setPhase('bracket');
  };

  const resetTournament = () => {
    if (confirm("Kurulum ekranına dönmek istediğinize emin misiniz? Fikstür ilerlemeniz kaybolacak.")) {
      setPhase('setup');
    }
  };

  // --- Match Progression Logic ---

  const calculateWinner = (scores, t1, t2) => {
    if (!t1 || !t2) return null;
    
    let t1Sets = 0; let t2Sets = 0;
    let t1Games = 0; let t2Games = 0;

    scores.forEach(s => {
      const s1 = parseInt(s.t1);
      const s2 = parseInt(s.t2);
      if (!isNaN(s1) && !isNaN(s2)) {
        t1Games += s1;
        t2Games += s2;
        if (s1 > s2) t1Sets++;
        else if (s2 > s1) t2Sets++;
      }
    });

    if (t1Sets === 0 && t2Sets === 0 && t1Games === 0 && t2Games === 0) return null;

    // 1. Set üstünlüğü
    if (t1Sets > t2Sets) return t1;
    if (t2Sets > t1Sets) return t2;

    // 2. Beraberlikte Oyun Averajı (Turnuva Direktörü Kuralı)
    if (t1Games > t2Games) return t1;
    if (t2Games > t1Games) return t2;

    return null; // Tam eşitlik
  };

  const handleScoreSave = (rIdx, mIdx, category, newScores, manualWinner = null) => {
    const newBrackets = { ...brackets };
    const catBracket = newBrackets[category].map(round => 
      round.map(match => ({ ...match }))
    );

    const match = catBracket[rIdx][mIdx];
    if (match.isBye) return;

    match.scores = newScores;
    
    // Kazananı belirle (Manuel veya Otomatik)
    const calculatedWinner = calculateWinner(newScores, match.t1, match.t2);
    const finalWinner = manualWinner || calculatedWinner;

    // Eğer kazanan değiştiyse veya skor girildiyse güncelle
    if (match.winner !== finalWinner || newScores) {
      match.winner = finalWinner;

      // Sonraki turlara aktar
      if (rIdx + 1 < catBracket.length) {
        const nextMIdx = Math.floor(mIdx / 2);
        const isT1 = mIdx % 2 === 0;

        if (isT1) {
          catBracket[rIdx + 1][nextMIdx].t1 = finalWinner;
        } else {
          catBracket[rIdx + 1][nextMIdx].t2 = finalWinner;
        }

        // Seçim değişirse ileri turlardaki verileri temizle
        const clearSubsequent = (currentRIdx, currentMIdx) => {
          const m = catBracket[currentRIdx][currentMIdx];
          m.winner = null;
          if(m.scores) {
             m.scores = [{t1: '', t2: ''}, {t1: '', t2: ''}, {t1: '', t2: ''}];
          }
          if (currentRIdx + 1 < catBracket.length) {
            const nextNextMIdx = Math.floor(currentMIdx / 2);
            const nextIsT1 = currentMIdx % 2 === 0;
            if (nextIsT1) catBracket[currentRIdx + 1][nextNextMIdx].t1 = null;
            else catBracket[currentRIdx + 1][nextNextMIdx].t2 = null;
            clearSubsequent(currentRIdx + 1, nextNextMIdx);
          } else {
            setChampions(prev => ({...prev, [category]: null}));
          }
        };
        clearSubsequent(rIdx + 1, nextMIdx);
        
      } else {
        // Şampiyon belirlendi
        setChampions(prev => ({...prev, [category]: finalWinner}));
      }
    }

    newBrackets[category] = catBracket;
    setBrackets(newBrackets);
    setScoreModal({ isOpen: false, category: null, rIdx: null, mIdx: null, matchData: null });
  };

  const getRoundName = (idx, total) => {
    if (idx === total - 1) return "Final";
    if (idx === total - 2) return "Yarı Final";
    if (idx === total - 3) return "Çeyrek Final";
    return `Tur ${idx + 1}`;
  };

  const MatchCard = ({ match, rIdx, mIdx, category }) => {
    const { t1, t2, winner, isBye, scores } = match;

    const openScoreModal = () => {
      if (isBye || !t1 || !t2) return; // Eksik maçlara skor girilemez
      setScoreModal({
        isOpen: true,
        category,
        rIdx,
        mIdx,
        matchData: match
      });
    };

    return (
      <div className="w-56 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col mb-4 shrink-0 transition-all hover:shadow-md">
        <div className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold text-center py-1 border-b border-slate-200 tracking-wider">
          Maç {mIdx + 1}
        </div>
        
        <div className="flex flex-col cursor-pointer" onClick={openScoreModal}>
          {/* Takım 1 Satırı */}
          <div className={`p-2 flex items-center border-b border-slate-100 transition-colors ${winner === t1 && t1 && !isBye ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}>
            <div className="flex-grow truncate text-sm flex items-center">
              {winner === t1 && !isBye && <Check size={14} className="mr-1 text-emerald-600 shrink-0" />}
              {t1 || <span className="text-slate-400 italic">Belirlenmedi</span>}
            </div>
            {!isBye && scores && (
              <div className="flex space-x-1 ml-2 shrink-0">
                {scores.map((s, i) => (
                  <span key={`t1-s${i}`} className="w-5 h-6 flex items-center justify-center bg-slate-100 border border-slate-200 rounded text-xs font-medium text-slate-700">
                    {s.t1 !== '' ? s.t1 : '-'}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Takım 2 Satırı */}
          <div className={`p-2 flex items-center transition-colors ${winner === t2 && t2 && !isBye ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}>
            <div className="flex-grow truncate text-sm flex items-center">
              {winner === t2 && !isBye && <Check size={14} className="mr-1 text-emerald-600 shrink-0" />}
              {isBye ? <span className="text-slate-400 font-semibold italic text-xs tracking-wider">BAY GEÇİYOR</span> : (t2 || <span className="text-slate-400 italic">Belirlenmedi</span>)}
            </div>
            {!isBye && scores && (
              <div className="flex space-x-1 ml-2 shrink-0">
                {scores.map((s, i) => (
                  <span key={`t2-s${i}`} className="w-5 h-6 flex items-center justify-center bg-slate-100 border border-slate-200 rounded text-xs font-medium text-slate-700">
                    {s.t2 !== '' ? s.t2 : '-'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {!isBye && t1 && t2 && (
           <div className="bg-slate-50 border-t border-slate-100 text-center py-1.5 cursor-pointer hover:bg-slate-100 transition-colors" onClick={openScoreModal}>
             <span className="text-[10px] font-semibold text-slate-500 uppercase">Skor Gir / Karar Ver</span>
           </div>
        )}
      </div>
    );
  };

  // --- Score Modal Component ---
  const ScoreModal = () => {
    if (!scoreModal.isOpen || !scoreModal.matchData) return null;
    
    const [tempScores, setTempScores] = useState([...scoreModal.matchData.scores.map(s => ({...s}))]);
    const [manualWinner, setManualWinner] = useState(null);
    
    const { t1, t2 } = scoreModal.matchData;

    const handleScoreInput = (setIndex, team, value) => {
      const newScores = [...tempScores];
      newScores[setIndex][team] = value;
      setTempScores(newScores);
      setManualWinner(null); // Skor değişince manuel kazananı sıfırla
    };

    const autoWinner = calculateWinner(tempScores, t1, t2);

    return (
      <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
          <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
            <h3 className="font-bold text-lg">Skor Girişi</h3>
            <button onClick={() => setScoreModal({ isOpen: false })} className="text-emerald-100 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6">
            <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg flex items-start text-xs border border-blue-100">
              <AlertCircle size={16} className="mr-2 shrink-0 mt-0.5" />
              <p>Sistem kazananı set sayısına göre belirler. Setler berabereyse (ör: 1-1 ama maç yarım kaldı), <strong>oyun averajına</strong> (toplam oyun sayısı) göre hesaplar. Hükmen galibiyet için manuel seçim yapabilirsiniz.</p>
            </div>

            {/* Score Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-1/2">Takım</th>
                    <th className="px-2 py-3 text-center">Set 1</th>
                    <th className="px-2 py-3 text-center">Set 2</th>
                    <th className="px-2 py-3 text-center">Set 3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 font-medium text-slate-800 truncate">{t1}</td>
                    {[0, 1, 2].map(i => (
                      <td key={`t1-input-${i}`} className="px-2 py-2">
                        <input type="number" min="0" max="99" value={tempScores[i].t1} onChange={(e) => handleScoreInput(i, 't1', e.target.value)} className="w-12 text-center p-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-slate-800 truncate">{t2}</td>
                    {[0, 1, 2].map(i => (
                      <td key={`t2-input-${i}`} className="px-2 py-2">
                        <input type="number" min="0" max="99" value={tempScores[i].t2} onChange={(e) => handleScoreInput(i, 't2', e.target.value)} className="w-12 text-center p-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Status & Manual Override */}
            <div className="flex flex-col space-y-4 mb-2">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-sm font-semibold text-slate-600">Sistem Kararı:</span>
                <span className={`text-sm font-bold ${autoWinner ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {autoWinner ? `${autoWinner} Kazanıyor` : 'Skor Bekleniyor...'}
                </span>
              </div>
              
              <div className="border-t border-slate-200 pt-4">
                <span className="text-xs font-semibold text-slate-500 uppercase mb-2 block">Manuel / Hükmen Karar Seçimi</span>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setManualWinner(manualWinner === t1 ? null : t1)}
                    className={`flex-1 py-2 text-xs font-bold rounded border transition-colors ${manualWinner === t1 ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                  >
                    {t1}
                  </button>
                  <button 
                    onClick={() => setManualWinner(manualWinner === t2 ? null : t2)}
                    className={`flex-1 py-2 text-xs font-bold rounded border transition-colors ${manualWinner === t2 ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                  >
                    {t2}
                  </button>
                </div>
              </div>
            </div>

          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
            <button onClick={() => setScoreModal({ isOpen: false })} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
              İptal
            </button>
            <button 
              onClick={() => handleScoreSave(scoreModal.rIdx, scoreModal.mIdx, scoreModal.category, tempScores, manualWinner)}
              disabled={!autoWinner && !manualWinner}
              className={`px-6 py-2 text-sm font-medium rounded-lg shadow-sm transition-colors ${
                (!autoWinner && !manualWinner) ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              Sonucu Kaydet
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-emerald-700 text-white shadow-md p-6 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Trophy size={32} className="text-yellow-400" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Padel Fikstür Pro</h1>
          </div>
          {phase === 'bracket' && (
            <button 
              onClick={resetTournament}
              className="flex items-center space-x-2 bg-emerald-800 hover:bg-emerald-900 px-4 py-2 rounded-full text-sm font-medium transition-colors"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Kuruluma Dön</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-6xl mx-auto w-full p-4 sm:p-6 flex flex-col overflow-hidden">
        
        {/* Category Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-200 mb-6 shrink-0">
          {CATEGORIES.map(cat => {
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 sm:px-6 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {phase === 'setup' ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 w-full max-w-3xl mx-auto overflow-y-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full mb-4">
                <Users size={24} />
              </div>
              <h2 className="text-2xl font-semibold text-slate-800 mb-2">{activeCategory} Takımları</h2>
              <p className="text-slate-500 text-sm">Bu kategori için takımları ekleyin. Boş bırakılan takımlar fikstüre dahil edilmez.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {teams[activeCategory].map((team, index) => (
                <div key={index} className="flex items-center space-x-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="flex-grow flex flex-col">
                    <label className="text-xs font-semibold text-slate-500 mb-1 ml-1 uppercase">Takım {index + 1}</label>
                    <input
                      type="text"
                      value={team}
                      onChange={(e) => handleNameChange(index, e.target.value)}
                      placeholder="Örn: Ali & Veli"
                      className="px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
                    />
                  </div>
                  <button 
                    onClick={() => removeTeam(index)} 
                    className="mt-5 p-2 text-slate-400 hover:text-red-500 transition-colors" 
                    title="Takımı Sil"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="flex mb-8">
              <button 
                onClick={addTeam} 
                className="flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={16} className="mr-2" /> Yeni Takım Ekle
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-4 border-t border-slate-100 pt-6">
              <button 
                onClick={fillRandom}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-2.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-lg font-medium transition-colors"
              >
                <Shuffle size={18} />
                <span>Rastgele Doldur</span>
              </button>
              <button 
                onClick={startTournament}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-sm transition-all hover:shadow"
              >
                <Play size={18} />
                <span>Tüm Fikstürleri Oluştur</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-grow flex flex-col overflow-hidden">
            <div className="text-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-slate-700">{activeCategory} Fikstürü</h2>
              <p className="text-slate-500 text-sm mt-1">Kazananı belirlemek için eşleşmelerde takımın üzerine tıklayın.</p>
            </div>
            
            <div className="flex-grow overflow-x-auto pb-8 bg-white border border-slate-200 rounded-xl shadow-inner p-6">
              {brackets[activeCategory] ? (
                <div className="flex justify-start min-w-max h-full gap-12 px-4">
                  
                  {/* Dinamik Turlar */}
                  {brackets[activeCategory].map((round, rIdx) => (
                    <div key={`round-${rIdx}`} className="flex flex-col justify-around w-48 shrink-0 py-4 gap-6">
                      <h3 className="text-center font-bold text-slate-400 uppercase tracking-widest text-[11px] mb-2">
                        {getRoundName(rIdx, brackets[activeCategory].length)}
                      </h3>
                      <div className="flex flex-col justify-around h-full gap-4">
                        {round.map((match, mIdx) => (
                          <MatchCard 
                            key={`match-${rIdx}-${mIdx}`} 
                            match={match} 
                            rIdx={rIdx} 
                            mIdx={mIdx} 
                            category={activeCategory}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Şampiyon Kartı */}
                  <div className="flex flex-col justify-center items-center w-56 shrink-0 py-8 ml-4">
                    <h3 className="text-center font-bold text-emerald-600 uppercase tracking-widest text-[11px] mb-6">
                      Şampiyon
                    </h3>
                    <div className={`w-full p-8 flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-300 ${
                      champions[activeCategory] ? 'bg-emerald-50 border-emerald-400 shadow-xl scale-105' : 'bg-slate-50 border-slate-200 border-dashed'
                    }`}>
                      <Trophy size={56} className={`mb-4 transition-colors duration-300 ${champions[activeCategory] ? 'text-yellow-500' : 'text-slate-300'}`} />
                      <span className={`text-xl font-extrabold text-center transition-colors duration-300 ${champions[activeCategory] ? 'text-emerald-800' : 'text-slate-400'}`}>
                        {champions[activeCategory] || 'Bekleniyor'}
                      </span>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-500">
                  <AlertCircle size={48} className="text-slate-300 mb-4" />
                  <p className="text-lg font-medium text-slate-600">Bu kategori için fikstür bulunmuyor</p>
                  <p className="text-sm mt-2 text-center max-w-md">Kurulum aşamasında yeterli takım (en az 2) eklenmediği için bu kategoriye ait eşleşmeler oluşturulamadı. Üstten "Kuruluma Dön" butonuna basarak takım ekleyebilirsiniz.</p>
                </div>
              )}
            </div>
          </div>
        )}
        <ScoreModal />
      </main>
    </div>
  );
};

export default App;
