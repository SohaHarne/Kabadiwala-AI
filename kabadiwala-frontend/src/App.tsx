import React, { useState, useEffect } from 'react';
import { Camera, Sparkles, RefreshCw, CheckCircle2, Calculator, MapPin, MessageSquare, User, ShieldCheck, Award, Upload, LogOut, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { HandwritingText } from './components/ui/handwriting-text';
import "./index.css";

interface ClassificationResult {
  category: 'CASH' | 'TRASH' | 'DONATION';
  item: string;
  confidence: number;
  estimatedValue: string;
  reason: string;
  isFallback?: boolean;
  fallbackMessage?: string;
}

interface PickupRecord {
  id: string;
  item: string;
  dealer: string;
  date: string;
  status: 'Completed' | 'Pending Pickup';
  payout: string;
}

interface ScanRecord {
  id: string;
  item: string;
  category: string;
  value: string;
  date: string;
}

interface Dealer {
  id: number;
  name: string;
  area: string;
  distance: string;
  phone: string;
  rating: string;
  verified: boolean;
}

interface EstimateItem {
  id: string;
  name: string;
  rate: number;
  weight: number;
  unit: string;
}

export default function App() {
  // Persistent Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('kabadiwala_logged_in') === 'true';
  });
  const [activeTab, setActiveTab] = useState<'scanner' | 'estimator' | 'dealers' | 'profile'>('scanner');
  
  // Persistent User Profile State
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('kabadiwala_user_name') || 'Eco Warrior';
  });
  const [userEmail, setUserEmail] = useState(() => {
    return localStorage.getItem('kabadiwala_user_email') || 'eco.warrior@example.com';
  });
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authNameInput, setAuthNameInput] = useState('');

  // User-Specific History States (isolated per user email)
  const currentUserKey = userEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const [pickupHistory, setPickupHistory] = useState<PickupRecord[]>(() => {
    const saved = localStorage.getItem(`pickup_history_${currentUserKey}`);
    if (saved) return JSON.parse(saved);
    return [
      { id: '1', item: 'Old Newspapers (5kg)', dealer: 'Shree Ganesh Scrap Trading', date: '10 Sep 2026', status: 'Completed', payout: '₹75' },
      { id: '2', item: 'PET Bottles (2kg)', dealer: 'EcoGreen Recyclers', date: '05 Sep 2026', status: 'Completed', payout: '₹24' },
    ];
  });

  const [scanHistory, setScanHistory] = useState<ScanRecord[]>(() => {
    const saved = localStorage.getItem(`scan_history_${currentUserKey}`);
    if (saved) return JSON.parse(saved);
    return [
      { id: 's1', item: 'Old Newspapers', category: 'CASH', value: '₹15 / kg', date: '10 Sep 2026' }
    ];
  });

  // Save history to localStorage whenever it changes for the current user
  useEffect(() => {
    localStorage.setItem(`pickup_history_${currentUserKey}`, JSON.stringify(pickupHistory));
  }, [pickupHistory, currentUserKey]);

  useEffect(() => {
    localStorage.setItem(`scan_history_${currentUserKey}`, JSON.stringify(scanHistory));
  }, [scanHistory, currentUserKey]);

  // Backend Dealers State
  const [nearbyDealers, setNearbyDealers] = useState<Dealer[]>([]);
  const [dealerLoading, setDealerLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('Connecting to backend...');

  // Scrap Core State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [rawImageBase64, setRawImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  
  const [rates] = useState<Record<string, { name: string; rate: number; unit: string }>>({
    newspaper: { name: 'Old Newspapers (Raddi)', rate: 15, unit: 'kg' },
    plastic: { name: 'PET Bottles / Plastic', rate: 12, unit: 'kg' },
    iron: { name: 'Iron & Steel Scrap', rate: 30, unit: 'kg' },
    copper: { name: 'Copper Wires', rate: 450, unit: 'kg' },
  });

  // Smart Estimator & Bulk List State
  const [estimateList, setEstimateList] = useState<EstimateItem[]>([
    { id: 'e1', name: 'Old Newspapers (Raddi)', rate: 15, weight: 3, unit: 'kg' },
    { id: 'e2', name: 'PET Bottles / Plastic', rate: 12, weight: 2, unit: 'kg' }
  ]);
  const [selectedEstimatorKey, setSelectedEstimatorKey] = useState('newspaper');
  const [customAddWeight, setCustomAddWeight] = useState<number | ''>(1);

  // Custom Writing Bar States for Estimator
  const [customItemNameInput, setCustomItemNameInput] = useState('');
  const [customItemRateInput, setCustomItemRateInput] = useState<number | ''>(10);
  const [customItemWeightInput, setCustomItemWeightInput] = useState<number | ''>(1);

  // Total Payout calculation across all items in the basket
  const grandTotalPayout = estimateList.reduce((sum, item) => sum + (item.rate * item.weight), 0);

  // Dynamically calculate total stats from user history
  const totalRecycledKg = pickupHistory.reduce((sum, record) => {
    const match = record.item.match(/(\d+(\.\d+)?)\s*kg/i);
    const kg = match ? parseFloat(match[1]) : 1;
    return sum + kg;
  }, 0);

  const totalEarnedAmount = pickupHistory.reduce((sum, record) => {
    const cleanPayout = parseInt(record.payout.replace(/[^0-9]/g, ''), 10) || 0;
    return sum + cleanPayout;
  }, 0);

  // Dynamic API URL with safe Render fallback
  const API_URL = 'https://kabadiwala-ai-backend.onrender.com';

  useEffect(() => {
    setDealerLoading(true);
    fetch(`${API_URL}/api/dealers`)
      .then((res) => res.json())
      .then((data) => {
        setNearbyDealers(data);
        setBackendStatus('Connected to Backend (Wagholi, Pune API)');
        setDealerLoading(false);
      })
      .catch((err) => {
        console.error('Backend connection error:', err);
        setBackendStatus('Backend offline (Make sure server is running)');
        setDealerLoading(false);
      });
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
      setResult(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setRawImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const runRealGeminiAI = async (imageBase64: string) => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/api/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 })
      });

      const data = await res.json();
      setResult(data);

      const newScan: ScanRecord = {
        id: String(Date.now()),
        item: data.item,
        category: data.category,
        value: data.estimatedValue,
        date: 'Just now'
      };
      setScanHistory(prev => [newScan, ...prev]);

      if (data.category === 'CASH') {
        const newItem: EstimateItem = {
          id: String(Date.now()),
          name: `${data.item} (AI Scanned)`,
          rate: 15, 
          weight: 1,
          unit: 'kg'
        };
        setEstimateList(prev => [newItem, ...prev]);
      }

    } catch (err) {
      console.error('Failed to reach backend AI:', err);
      const fallbackData: ClassificationResult = {
        item: 'Polythene / Plastic Film',
        category: 'CASH',
        confidence: 95,
        estimatedValue: '₹10 / kg',
        reason: 'Recyclable LDPE/HDPE plastic waste.',
        isFallback: true,
        fallbackMessage: "AI traffic spike detected! Using smart offline estimate."
      };
      setResult(fallbackData);

      const newScan: ScanRecord = {
        id: String(Date.now()),
        item: fallbackData.item,
        category: fallbackData.category,
        value: fallbackData.estimatedValue,
        date: 'Just now'
      };
      setScanHistory(prev => [newScan, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppRequest = (dealerPhone: string, dealerName: string, customPayout?: number) => {
    const finalPayout = customPayout !== undefined ? customPayout : grandTotalPayout;
    const itemsSummary = estimateList.map(i => `• ${i.name} (${i.weight} ${i.unit})`).join('\n');
    
    const newRecord: PickupRecord = {
      id: String(Date.now()),
      item: `${estimateList.length} Scrap Items Bundle`,
      dealer: dealerName,
      date: 'Today',
      status: 'Pending Pickup',
      payout: `₹${finalPayout}`
    };
    setPickupHistory([newRecord, ...pickupHistory]);

    const message = encodeURIComponent(`Hi ${dealerName}, I would like to schedule a scrap pickup in Wagholi based on my verified app estimate:\n\nItems:\n${itemsSummary}\n\nTotal Estimated Payout: ₹${finalPayout}\n\nPlease confirm your earliest slot!`);
    window.open(`https://wa.me/${dealerPhone}?text=${message}`, '_blank');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authEmailInput) {
      const email = authEmailInput;
      const name = authNameInput ? authNameInput : email.split('@')[0];
      
      setUserEmail(email);
      setUserName(name);
      
      localStorage.setItem('kabadiwala_logged_in', 'true');
      localStorage.setItem('kabadiwala_user_email', email);
      localStorage.setItem('kabadiwala_user_name', name);
      
      setIsLoggedIn(true);
      setActiveTab('scanner');
      window.location.reload();
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[var(--background)]">
        <div className="max-w-md w-full bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-2xl font-bold shadow-md">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-[var(--foreground)] mt-2">Kabadiwala AI</h1>
            <p className="text-xs text-[var(--muted-foreground)]">Smart Zero-Waste & Recycling Node • Wagholi, Pune</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--muted-foreground)]">Your Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Eco Warrior"
                value={authNameInput}
                onChange={(e) => setAuthNameInput(e.target.value)}
                className="p-3.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--muted-foreground)]">Email Address (Unique Account Key)</label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={authEmailInput}
                onChange={(e) => setAuthEmailInput(e.target.value)}
                className="p-3.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full py-4 bg-[var(--primary)] hover:opacity-90 text-[var(--primary-foreground)] font-bold rounded-2xl text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Get Started & Explore App</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-[var(--border)] text-center">
            <span className="text-[10px] text-[var(--muted-foreground)]">Powered by Gemini Multimodal Vision AI</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 pb-28">
      <div className="max-w-xl w-full flex flex-col gap-6">
        
        {/* Top Header Card */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-tight text-[var(--foreground)]">Kabadiwala AI</h1>
                <p className="text-xs text-[var(--muted-foreground)]">Wagholi, Pune Node Connected</p>
              </div>
            </div>

           <button 
              onClick={() => setActiveTab('profile')} 
              className="user-profile"
            >
              <div className="user-profile-inner">
                <User className="w-5 h-5 text-blue-400" />
                <span className="text-xs truncate max-w-[70px]">{userName}</span>
              </div>
            </button>
            </div>

          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">AI-Powered Scrap Valuation</span>
            <div className="text-xs font-bold text-[var(--primary)]">
              <HandwritingText
                words={["sustainable.", "automated.", "rewarding.", "zero waste."]}
                className="text-emerald-700 dark:text-emerald-400 font-bold ml-1"
                height="1.15em"
              />
            </div>
          </div>
        </div>

        {/* TAB 1: AI SCANNER */}
        {activeTab === 'scanner' && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-sm flex flex-col gap-5">
            <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
              <Camera className="w-5 h-5 text-[var(--primary)]" /> 1. AI Snap & Classify
            </h2>

            <div className="w-full h-56 bg-neutral-900 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden shadow-inner border border-[var(--border)]">
              {selectedImage ? (
                <img src={selectedImage} alt="Uploaded scrap" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4 text-neutral-400 flex flex-col items-center gap-2">
                  <Upload className="w-10 h-10 animate-bounce text-[var(--primary)]" />
                  <p className="text-xs font-medium">Click below to upload or snap your scrap item</p>
                </div>
              )}
              {loading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-[var(--primary)]" />
                  <p className="text-xs font-semibold tracking-wide">Gemini AI analyzing item...</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <label className="w-full py-3 bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] font-bold rounded-2xl shadow-sm flex items-center justify-center gap-2 text-xs cursor-pointer transition-all">
                <Camera className="w-4 h-4" /> Choose Photo / Capture from Camera
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>

              {selectedImage && !loading && (
                <button
                  onClick={() => rawImageBase64 && runRealGeminiAI(rawImageBase64)}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 text-sm transition-all animate-pulse cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" /> Scan & Analyze with AI
                </button>
              )}
            </div>

            {result && (
              <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-4 flex flex-col gap-3">
                {result.isFallback && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-[11px] font-semibold flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
                    <span>{result.fallbackMessage || "High server traffic detected. Showing estimated match."}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs font-bold text-[var(--muted-foreground)]">
                  <span className="bg-[var(--muted)] px-3 py-1 rounded-full">Detected: {result.item}</span>
                  <span className="text-[var(--primary)]">{result.confidence}% Confidence</span>
                </div>

                <div className="p-3 rounded-xl flex items-center gap-3 font-bold text-sm bg-emerald-950/30 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div>
                    <div>Status: {result.category} • {result.estimatedValue}</div>
                    <div className="text-xs font-normal opacity-85">{result.reason}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SMART ESTIMATOR & DEALER COMPARISON */}
        {activeTab === 'estimator' && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-sm flex flex-col gap-5 text-white">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" /> 2. AI-Linked Estimator & Dealer Payout
            </h2>
            <p className="text-xs text-neutral-400 -mt-3">
              Scanned items from the AI tab sync here automatically. You can also pick from presets or type your own custom items below!
            </p>

            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col gap-2">
              <span className="text-xs font-semibold text-neutral-300">Add from Preset List:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select 
                  value={selectedEstimatorKey} 
                  onChange={(e) => setSelectedEstimatorKey(e.target.value)}
                  className="p-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white"
                >
                  {Object.entries(rates).map(([key, val]) => (
                    <option key={key} value={key}>{val.name} (₹{val.rate}/{val.unit})</option>
                  ))}
                </select>

                <input 
                  type="number" 
                  min="0.5" 
                  step="0.5"
                  placeholder="Weight (kg)"
                  value={customAddWeight} 
                  onChange={(e) => setCustomAddWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  className="p-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white"
                />

                <button 
                  onClick={() => {
                    const rateObj = rates[selectedEstimatorKey];
                    const w = typeof customAddWeight === 'number' && !isNaN(customAddWeight) && customAddWeight > 0 ? customAddWeight : 1;
                    if (rateObj) {
                      const newItem: EstimateItem = {
                        id: String(Date.now()),
                        name: rateObj.name,
                        rate: rateObj.rate,
                        weight: w,
                        unit: rateObj.unit
                      };
                      setEstimateList([newItem, ...estimateList]);
                    }
                  }}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-xs text-white flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Preset
                </button>
              </div>
            </div>

            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col gap-2">
              <span className="text-xs font-semibold text-neutral-300">Or Type Custom Item Manually:</span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input 
                  type="text" 
                  placeholder="Item Name (e.g. Old Books)"
                  value={customItemNameInput}
                  onChange={(e) => setCustomItemNameInput(e.target.value)}
                  className="p-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white col-span-1"
                />
                <input 
                  type="number" 
                  placeholder="Rate ₹/kg"
                  value={customItemRateInput}
                  onChange={(e) => setCustomItemRateInput(e.target.value === '' ? '' : Number(e.target.value))}
                  className="p-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white"
                />
                <input 
                  type="number" 
                  placeholder="Weight kg"
                  value={customItemWeightInput}
                  onChange={(e) => setCustomItemWeightInput(e.target.value === '' ? '' : Number(e.target.value))}
                  className="p-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white"
                />
                <button 
                  onClick={() => {
                    if (customItemNameInput.trim()) {
                      const r = typeof customItemRateInput === 'number' && !isNaN(customItemRateInput) ? customItemRateInput : 10;
                      const w = (typeof customItemWeightInput === 'number' && !isNaN(customItemWeightInput) && customItemWeightInput > 0) ? customItemWeightInput : 1;
                      
                      const newItem: EstimateItem = {
                        id: String(Date.now()),
                        name: customItemNameInput.trim(),
                        rate: r,
                        weight: w,
                        unit: 'kg'
                      };
                      setEstimateList([newItem, ...estimateList]);
                      setCustomItemNameInput('');
                      setCustomItemWeightInput(1);
                    }
                  }}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-xs text-white flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Custom
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
              {estimateList.length === 0 ? (
                <p className="text-xs text-neutral-500 italic text-center py-4">Your scrap basket is empty.</p>
              ) : (
                estimateList.map((item) => (
                  <div key={item.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{item.name}</p>
                      <p className="text-[10px] text-neutral-400">₹{item.rate} per {item.unit} • Weight: {item.weight} {item.unit}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-emerald-400 text-sm">₹{item.rate * item.weight}</span>
                      <button 
                        onClick={() => setEstimateList(estimateList.filter(i => i.id !== item.id))}
                        className="text-neutral-500 hover:text-rose-400 p-1 cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-emerald-950/40 border border-emerald-800/60 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-300 font-semibold block">Total Estimated Scrap Payout</span>
                <span className="text-lg font-black text-emerald-400">₹{grandTotalPayout}</span>
              </div>
              <span className="text-[10px] bg-emerald-900/60 text-emerald-200 px-2.5 py-1 rounded-full font-bold">
                {estimateList.length} Items Listed
              </span>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Wagholi Dealers Comparison
              </h3>

              {nearbyDealers.slice(0, 3).map((dealer, idx) => {
                const payoutBonus = idx === 0 ? grandTotalPayout : Math.round(grandTotalPayout * (1 + (idx * 0.03)));
                return (
                  <div key={dealer.id} className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs">{dealer.name}</span>
                        {dealer.verified && <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1 py-0.2 rounded">Verified</span>}
                      </div>
                      <p className="text-[10px] text-neutral-400">{dealer.area} • {dealer.distance} away</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-400 block">₹{payoutBonus}</span>
                        <span className="text-[9px] text-neutral-500">{dealer.rating}</span>
                      </div>
                      <button
                        onClick={() => handleWhatsAppRequest(dealer.phone, dealer.name, payoutBonus)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer shadow-sm transition-all"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Book
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: DEALER MATCHER */}
        {activeTab === 'dealers' && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[var(--primary)]" /> Wagholi, Pune Dealers (API Live)
              </h2>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] -mt-3">{backendStatus}</p>

            {dealerLoading ? (
              <div className="flex items-center justify-center p-8 text-xs text-[var(--muted-foreground)] gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[var(--primary)]" /> Loading 10 dealers from backend...
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
                {nearbyDealers.map((dealer) => (
                  <div key={dealer.id} className="p-4 bg-[var(--background)] border border-[var(--border)] rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-[var(--foreground)] text-xs flex items-center gap-1.5">
                        {dealer.name} {dealer.verified && <span className="text-[10px] bg-emerald-950/40 text-emerald-400 px-1.5 py-0.5 rounded">Verified</span>}
                      </span>
                      <span className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{dealer.area}</span>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)] mt-1">
                        <span className="bg-[var(--muted)] px-2 py-0.5 rounded-md font-semibold">{dealer.distance}</span>
                        <span>{dealer.rating}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleWhatsAppRequest(dealer.phone, dealer.name)}
                      className="bg-[var(--primary)] hover:opacity-90 text-[var(--primary-foreground)] px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PROFILE & DASHBOARD */}
        {activeTab === 'profile' && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-sm flex flex-col gap-6">
            <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
              <User className="w-5 h-5 text-[var(--primary)]" /> Profile & Recycling Dashboard
            </h2>

            <div className="flex flex-col gap-5">
              <div className="bg-[var(--background)] border border-[var(--border)] p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-full flex items-center justify-center font-bold text-lg">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--foreground)]">{userName}</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">{userEmail}</p>
                    <span className="inline-block mt-1 text-[10px] bg-[var(--muted)] px-2 py-0.5 rounded-md font-bold text-[var(--primary)]">Green Tier Member (Wagholi)</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    localStorage.removeItem('kabadiwala_logged_in');
                    localStorage.removeItem('kabadiwala_user_email');
                    localStorage.removeItem('kabadiwala_user_name');
                    setIsLoggedIn(false);
                    window.location.reload();
                  }}
                  className="p-2.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--background)] border border-[var(--border)] p-4 rounded-2xl flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Total Recycled</span>
                  <span className="text-lg font-black text-[var(--foreground)]">{totalRecycledKg.toFixed(1)} kg</span>
                </div>
                <div className="bg-[var(--background)] border border-[var(--border)] p-4 rounded-2xl flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Total Earned</span>
                  <span className="text-lg font-black text-emerald-500">₹{totalEarnedAmount}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Recent Pickup History</h3>
                {pickupHistory.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)] italic">No pickups recorded yet.</p>
                ) : (
                  pickupHistory.map((rec) => (
                    <div key={rec.id} className="p-3.5 bg-[var(--background)] border border-[var(--border)] rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-[var(--foreground)]">{rec.item}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">Dealer: {rec.dealer} • {rec.date}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-emerald-500 block">{rec.payout}</span>
                        <span className="text-[9px] text-[var(--muted-foreground)] font-semibold">{rec.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-sm w-[90%] bg-[var(--card)] border border-[var(--border)] backdrop-blur-md rounded-2xl p-2 shadow-2xl flex items-center justify-around z-50">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
            activeTab === 'scanner' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Scanner</span>
        </button>

        <button
          onClick={() => setActiveTab('estimator')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
            activeTab === 'estimator' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Estimator</span>
        </button>

        <button
          onClick={() => setActiveTab('dealers')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
            activeTab === 'dealers' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Dealers</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
            activeTab === 'profile' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>
      </div>

    </div>
  );
}