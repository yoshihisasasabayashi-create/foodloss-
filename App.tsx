import React, { useState, useEffect, useRef } from 'react';
import { generateDeliveryUpdate } from './services/geminiService';
import { MapComponent } from './components/MapComponent';
import { Coordinates, DeliveryMessage, UserRole, TrackingSession, P2PData } from './types';

// Icons
const TruckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
);
const ShareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
);
const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
);

declare global {
  interface Window {
    Peer: any;
  }
}

export default function App() {
  // Determine Role based on URL hash
  const initialPeerId = window.location.hash.replace('#', '');
  const [role, setRole] = useState<UserRole>(initialPeerId ? UserRole.CUSTOMER : UserRole.DRIVER);
  
  // State
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [messages, setMessages] = useState<DeliveryMessage[]>([]);
  const [session, setSession] = useState<TrackingSession>({
    isActive: false,
    startTime: null,
    deliveryId: '',
  });
  
  // UI State
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locationContext, setLocationContext] = useState("市街地");
  const [peerStatus, setPeerStatus] = useState<string>('初期化中...');
  const [viewerCount, setViewerCount] = useState(0);

  // Refs for P2P
  const peerRef = useRef<any>(null);
  const connectionsRef = useRef<any[]>([]);

  // 1. Initialize PeerJS
  useEffect(() => {
    if (!window.Peer) return;

    const isDriver = role === UserRole.DRIVER;
    
    // Driver: Generate a random ID prefixed with 'wagashi-'
    // Customer: Use the ID from URL
    const myId = isDriver 
      ? `wagashi-${Math.random().toString(36).substr(2, 6)}` 
      : undefined; // Customers get auto-assigned random IDs by PeerJS

    const peer = new window.Peer(myId, {
      debug: 1,
    });

    peer.on('open', (id: string) => {
      console.log('My Peer ID is: ' + id);
      if (isDriver) {
        setSession(prev => ({ ...prev, deliveryId: id }));
        setPeerStatus('待機中');
      } else {
        setPeerStatus('接続準備完了');
        // If customer, connect to driver immediately
        connectToDriver(peer, initialPeerId);
      }
    });

    peer.on('connection', (conn: any) => {
      // Logic for Driver receiving connections
      if (isDriver) {
        connectionsRef.current.push(conn);
        setViewerCount(prev => prev + 1);
        
        conn.on('open', () => {
          // Send current state to new viewer
          const syncData: P2PData = {
            type: 'SYNC_STATE',
            payload: { coordinates, messages }
          };
          conn.send(syncData);
        });

        conn.on('close', () => {
          connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
          setViewerCount(prev => Math.max(0, prev - 1));
        });
      }
    });

    peer.on('error', (err: any) => {
      console.error('Peer error', err);
      if (err.type === 'peer-unavailable') {
        setErrorMsg('配達員が見つかりません。リンクが正しいか確認してください。');
        setPeerStatus('接続エラー');
      } else {
        setErrorMsg('通信エラーが発生しました: ' + err.type);
      }
    });

    peerRef.current = peer;

    return () => {
      peer.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Customer: Connect to Driver
  const connectToDriver = (peer: any, driverId: string) => {
    setPeerStatus('配達員に接続中...');
    const conn = peer.connect(driverId);

    conn.on('open', () => {
      setPeerStatus('接続完了');
      setSession(prev => ({ ...prev, isActive: true, deliveryId: driverId }));
      setErrorMsg(null);
    });

    conn.on('data', (data: P2PData) => {
      handleIncomingData(data);
    });

    conn.on('close', () => {
      setPeerStatus('切断されました');
      setSession(prev => ({ ...prev, isActive: false }));
      alert('配達員との接続が切れました（配達終了または通信切断）');
    });
  };

  // Customer: Handle Data
  const handleIncomingData = (data: P2PData) => {
    switch (data.type) {
      case 'LOCATION_UPDATE':
        setCoordinates(data.payload);
        break;
      case 'MESSAGE_ADD':
        setMessages(prev => [data.payload, ...prev]);
        break;
      case 'SYNC_STATE':
        setCoordinates(data.payload.coordinates);
        setMessages(data.payload.messages);
        break;
      case 'SESSION_END':
        setSession(prev => ({ ...prev, isActive: false }));
        setPeerStatus('配達終了');
        break;
    }
  };

  // Driver: Broadcast Data Helper
  const broadcast = (data: P2PData) => {
    connectionsRef.current.forEach(conn => {
      if (conn.open) {
        conn.send(data);
      }
    });
  };

  // Driver: Watch Geolocation
  useEffect(() => {
    let watchId: number | null = null;

    if (role === UserRole.DRIVER && session.isActive) {
      if (!navigator.geolocation) {
        setErrorMsg('お使いのブラウザは位置情報をサポートしていません');
        return;
      }

      setPeerStatus('配信中');

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newCoords = { latitude, longitude };
          
          setCoordinates(newCoords);
          setErrorMsg(null);
          
          // Broadcast to viewers
          broadcast({ type: 'LOCATION_UPDATE', payload: newCoords });
        },
        (error) => {
          console.error("Geo error:", error);
          setErrorMsg('位置情報を取得できません。権限を確認してください。');
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, session.isActive]);

  // Actions
  const toggleDelivery = () => {
    if (session.isActive) {
      // Stop delivery
      setSession(prev => ({ ...prev, isActive: false }));
      setPeerStatus('待機中');
      addMessage('system', '配達を完了しました。');
      broadcast({ type: 'SESSION_END' });
    } else {
      // Start delivery
      setSession(prev => ({ ...prev, isActive: true, startTime: new Date() }));
      addMessage('system', '配達を開始しました。位置情報を共有中。');
    }
  };

  const addMessage = (type: 'system' | 'ai', text: string) => {
    const newMessage: DeliveryMessage = { 
      id: Date.now().toString(), 
      text, 
      timestamp: new Date().toISOString(), // Use ISO string for serialization safety
      type 
    };
    
    setMessages(prev => [newMessage, ...prev]);
    
    // Broadcast if driver
    if (role === UserRole.DRIVER) {
      broadcast({ type: 'MESSAGE_ADD', payload: newMessage });
    }
  };

  const handleGenerateUpdate = async () => {
    if (!session.isActive) return;
    setIsGeneratingMessage(true);
    
    const contexts = ["桜並木", "商店街", "大通り", "静かな住宅街", "川沿い"];
    const randomContext = contexts[Math.floor(Math.random() * contexts.length)];
    setLocationContext(randomContext);

    const text = await generateDeliveryUpdate("晴れ", randomContext, "順調");
    addMessage('ai', text);
    setIsGeneratingMessage(false);
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#${session.deliveryId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`共有リンクをコピーしました！\nこのリンクをお客様に送ってください。\n\n${url}`);
    });
  };

  // Render Helpers
  const renderDriverControls = () => (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-stone-100 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
            <TruckIcon />
            {session.isActive ? '配達中 (ON AIR)' : '待機中 (Offline)'}
          </h2>
          <p className="text-xs text-stone-500 mt-1 flex items-center gap-1">
             <span className={`w-2 h-2 rounded-full ${session.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></span>
             ステータス: {peerStatus}
          </p>
          {session.isActive && (
             <p className="text-xs text-stone-500 mt-1">現在の閲覧者: {viewerCount}人</p>
          )}
        </div>
        <div className={`w-3 h-3 rounded-full ${session.isActive ? 'bg-red-500 animate-pulse' : 'bg-stone-300'}`} />
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
          {errorMsg}
        </div>
      )}

      <button
        onClick={toggleDelivery}
        className={`w-full py-4 rounded-xl font-bold text-lg shadow-md transition-all transform active:scale-95 ${
          session.isActive
            ? 'bg-stone-100 text-stone-600 border-2 border-stone-200 hover:bg-stone-200'
            : 'bg-green-700 text-white hover:bg-green-800'
        }`}
      >
        {session.isActive ? '配達を終了する' : '配達を開始する'}
      </button>

      {session.isActive && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleGenerateUpdate}
            disabled={isGeneratingMessage}
            className="col-span-1 bg-amber-50 text-amber-800 border border-amber-200 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            {isGeneratingMessage ? (
              <span className="animate-spin">⌛</span>
            ) : (
              <SparklesIcon />
            )}
            AIひとこと
          </button>
          
          <button
            onClick={copyShareLink}
            className="col-span-1 bg-sky-50 text-sky-800 border border-sky-200 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-sky-100 transition-colors"
          >
            <ShareIcon />
            リンク共有
          </button>
        </div>
      )}
      
      {!session.isActive && (
         <div className="text-xs text-stone-400 text-center">
            配達を開始すると、共有リンクが発行されます。
         </div>
      )}
    </div>
  );

  const renderTimeline = () => (
    <div className="space-y-4">
      <h3 className="font-bold text-stone-700 border-b border-stone-200 pb-2 mb-4">
        お届け状況 / Updates
      </h3>
      {messages.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-4">まだメッセージはありません</p>
      ) : (
        <ul className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
          {messages.map((msg) => (
            <li key={msg.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full mt-2 ${msg.type === 'ai' ? 'bg-amber-400' : 'bg-stone-300'}`} />
                <div className="w-0.5 h-full bg-stone-100 my-1" />
              </div>
              <div className={`flex-1 p-3 rounded-lg text-sm shadow-sm ${
                msg.type === 'ai' ? 'bg-amber-50 border border-amber-100' : 'bg-white border border-stone-100'
              }`}>
                <p className="text-stone-800 leading-relaxed">{msg.text}</p>
                <p className="text-stone-400 text-xs mt-2 text-right">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fdfbf7] flex flex-col md:flex-row">
      {/* Sidebar / Control Panel */}
      <div className="md:w-[400px] w-full bg-white z-20 shadow-2xl flex flex-col h-[50vh] md:h-screen">
        
        {/* Header */}
        <div className="p-6 bg-red-900 text-white shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold tracking-wider">和菓子トラッカー</h1>
            <div className="bg-red-800 px-2 py-1 rounded text-xs text-red-100">Beta</div>
          </div>
          <p className="text-red-100 text-sm opacity-90">
            {role === UserRole.DRIVER ? '配達員用管理画面' : '現在のお届け状況'}
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {role === UserRole.DRIVER ? (
            renderDriverControls()
          ) : (
            // Customer View Info
            <div className={`border p-6 rounded-2xl text-center transition-colors ${
              session.isActive ? 'bg-green-50 border-green-100' : 'bg-stone-50 border-stone-200'
            }`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl ${
                 session.isActive ? 'bg-green-100 animate-bounce' : 'bg-stone-200'
              }`}>
                🍡
              </div>
              <h2 className={`font-bold text-lg mb-1 ${session.isActive ? 'text-green-900' : 'text-stone-600'}`}>
                {session.isActive ? '現在配達中です' : '接続待機中...'}
              </h2>
              <p className="text-stone-600 text-xs mt-2 font-mono">
                ステータス: {peerStatus}
              </p>
              {errorMsg && (
                 <p className="text-red-500 text-sm mt-2">{errorMsg}</p>
              )}
            </div>
          )}

          {renderTimeline()}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 h-[50vh] md:h-screen bg-stone-200 relative">
        <MapComponent 
          coordinates={coordinates} 
          isTracking={session.isActive || coordinates !== null}
        />
        
        {/* Overlay for Customer if inactive */}
        {!session.isActive && role === UserRole.CUSTOMER && !coordinates && (
          <div className="absolute inset-0 bg-stone-800/20 backdrop-blur-sm z-[1000] flex items-center justify-center">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-xs text-center">
               <p className="text-stone-500 font-bold mb-2">配達情報を待っています</p>
               <p className="text-xs text-stone-400">配達員が開始すると自動的に地図が更新されます</p>
            </div>
          </div>
        )}

        {/* Floating status for aesthetic */}
        {coordinates && (
           <div className="absolute bottom-6 left-6 right-6 md:left-6 md:right-auto md:w-64 bg-white/90 backdrop-blur p-4 rounded-xl shadow-lg border border-stone-200 z-[1000] pointer-events-none">
             <div className="text-xs text-stone-500 uppercase tracking-widest mb-1">Current Location</div>
             <div className="font-mono text-stone-800 font-bold">
               {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
             </div>
             {role === UserRole.CUSTOMER && (
                <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  LIVE CONNECTED
                </div>
             )}
           </div>
        )}
      </div>
    </div>
  );
}