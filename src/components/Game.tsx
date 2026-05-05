import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Zap, Settings as SettingsIcon, X, Pause, PlayCircle } from 'lucide-react';
import { GameState, Player, Obstacle, Peanut } from '../types';

interface GameSettings {
  gravity: number;
  jumpForce: number;
  initialSpeed: number;
  spawnInterval: number;
}

const DEFAULT_SETTINGS: GameSettings = {
  gravity: 0.6,
  jumpForce: -12,
  initialSpeed: 5,
  spawnInterval: 1500,
};

export default function Game() {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('elephant-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  const [player, setPlayer] = useState<Player>({
    id: 'player',
    x: 50,
    y: 0,
    width: 60,
    height: 60,
    velocityY: 0,
    isJumping: false,
    type: 'player'
  });

  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [peanuts, setPeanuts] = useState<Peanut[]>([]);
  const [gameSpeed, setGameSpeed] = useState(DEFAULT_SETTINGS.initialSpeed);
  
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const jump = useCallback(() => {
    if (gameState === GameState.PLAYING && !isPaused && !player.isJumping) {
      setPlayer(prev => ({
        ...prev,
        velocityY: settings.jumpForce,
        isJumping: true
      }));
    }
  }, [gameState, isPaused, player.isJumping, settings.jumpForce]);

  const startGame = () => {
    setGameState(GameState.PLAYING);
    setIsPaused(false);
    setScore(0);
    setObstacles([]);
    setPeanuts([]);
    setGameSpeed(settings.initialSpeed);
    setPlayer(prev => ({ ...prev, y: 0, velocityY: 0, isJumping: false }));
    lastTimeRef.current = performance.now();
    spawnTimerRef.current = 0;
  };

  const update = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING || isPaused) {
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(update);
      return;
    }

    const deltaTime = Math.min(time - lastTimeRef.current, 100); // Cap delta to avoid huge jumps
    lastTimeRef.current = time;

    // Update Player
    setPlayer(prev => {
      let nextY = prev.y + prev.velocityY;
      let nextVelocityY = prev.velocityY + settings.gravity;
      let nextIsJumping = prev.isJumping;

      // Ground collision
      if (nextY >= 0) {
        nextY = 0;
        nextVelocityY = 0;
        nextIsJumping = false;
      }

      return {
        ...prev,
        y: nextY,
        velocityY: nextVelocityY,
        isJumping: nextIsJumping
      };
    });

    // Update Obstacles & Peanuts
    setObstacles(prev => prev.map(obs => ({ ...obs, x: obs.x - gameSpeed })).filter(obs => obs.x + obs.width > -100));
    setPeanuts(prev => prev.map(p => ({ ...p, x: p.x - gameSpeed })).filter(p => p.x + p.width > -100 && !p.collected));

    // Spawn Logic
    spawnTimerRef.current += deltaTime;
    if (spawnTimerRef.current > settings.spawnInterval / (gameSpeed / settings.initialSpeed)) {
      spawnTimerRef.current = 0;
      
      const newObs: Obstacle = {
        id: Math.random().toString(),
        x: window.innerWidth,
        y: 0,
        width: 40,
        height: 40,
        speed: gameSpeed,
        type: Math.random() > 0.5 ? 'log' : 'rock'
      };
      setObstacles(prev => [...prev, newObs]);

      if (Math.random() < 0.4) {
        const newPeanut: Peanut = {
          id: Math.random().toString(),
          x: window.innerWidth + 200,
          y: -80 - Math.random() * 100,
          width: 30,
          height: 30,
          collected: false,
          type: 'peanut'
        };
        setPeanuts(prev => [...prev, newPeanut]);
      }
    }

    // Speed up
    setGameSpeed(prev => prev + 0.001);

    requestRef.current = requestAnimationFrame(update);
  }, [gameState, isPaused, gameSpeed, settings]);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, update]);

  // Collision Detection
  useEffect(() => {
    if (gameState !== GameState.PLAYING || isPaused) return;

    // Check Obstacles
    const playerBottom = -player.y;
    const playerTop = playerBottom + player.height;
    const playerLeft = player.x + 15;
    const playerRight = player.x + player.width - 15;

    obstacles.forEach(obs => {
      const obsBottom = 0;
      const obsTop = obs.height;
      const obsLeft = obs.x;
      const obsRight = obs.x + obs.width;

      if (
        playerRight > obsLeft &&
        playerLeft < obsRight &&
        playerTop > obsBottom &&
        playerBottom < obsTop
      ) {
        setGameState(GameState.GAME_OVER);
        if (score > highScore) {
          setHighScore(score);
          localStorage.setItem('elephant-high-score', score.toString());
        }
      }
    });

    // Check Peanuts
    setPeanuts(prev => {
      let changed = false;
      const next = prev.map(p => {
        if (p.collected) return p;
        
        const peanutBottom = -p.y;
        const peanutTop = peanutBottom + p.height;
        const peanutLeft = p.x;
        const peanutRight = p.x + p.width;

        if (
          playerRight > peanutLeft &&
          playerLeft < peanutRight &&
          playerTop > peanutBottom &&
          playerBottom < peanutTop
        ) {
          changed = true;
          setScore(s => s + 50); // Peanuts give more points
          return { ...p, collected: true };
        }
        return p;
      });
      return changed ? next : prev;
    });

    // Distance Score
    const timer = setInterval(() => {
      if (gameState === GameState.PLAYING && !isPaused) {
        setScore(s => s + 1);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [gameState, isPaused, player, obstacles, peanuts, score, highScore]);

  // Input listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    const handleTouch = () => jump();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouch);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, [jump]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-sky-100 flex flex-col items-center justify-center font-sans"
      style={{ minHeight: '600px' }}
    >
      {/* Background Layer */}
      <div 
        className="absolute inset-0 bg-cover bg-bottom opacity-40 transition-opacity"
        style={{ 
          backgroundImage: `url('https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&q=80&w=1920&h=1080')`,
          backgroundPosition: 'center 80%'
        }}
      />

      {/* Clouds Layer */}
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
        <motion.div 
          animate={{ x: [-100, 100], y: [-5, 5] }}
          transition={{ repeat: Infinity, duration: 20, ease: "easeInOut", repeatType: "mirror" }}
          className="absolute top-20 left-[10%] text-6xl"
        >
          ☁️
        </motion.div>
        <motion.div 
          animate={{ x: [100, -100], y: [5, -5] }}
          transition={{ repeat: Infinity, duration: 25, ease: "easeInOut", repeatType: "mirror" }}
          className="absolute top-40 right-[20%] text-7xl"
        >
          ☁️
        </motion.div>
        <motion.div 
          animate={{ x: [-50, 50] }}
          transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
          className="absolute top-10 left-[40%] text-5xl"
        >
          ☁️
        </motion.div>
      </div>
      
      {/* Ground */}
      <div className="absolute bottom-0 w-full h-[200px] bg-amber-800/10 border-t-4 border-amber-900/20 shadow-inner overflow-hidden">
         <motion.div 
           animate={{ x: [-200, 0] }}
           transition={{ 
             repeat: Infinity, 
             duration: isPaused ? 0 : 2 / (gameSpeed / settings.initialSpeed), 
             ease: "linear" 
           }}
           className="absolute top-0 w-[200%] h-full opacity-10 pointer-events-none flex"
         >
           <div className="w-full h-full" style={{ background: 'repeating-linear-gradient(90deg, transparent, transparent 100px, rgba(0,0,0,0.1) 100px, rgba(0,0,0,0.1) 200px)', backgroundSize: '200px 100%' }} />
           <div className="w-full h-full" style={{ background: 'repeating-linear-gradient(90deg, transparent, transparent 100px, rgba(0,0,0,0.1) 100px, rgba(0,0,0,0.1) 200px)', backgroundSize: '200px 100%' }} />
         </motion.div>
      </div>

      {/* Game Content */}
      <div className="relative w-full h-[400px] max-w-4xl mx-auto">
        
        {/* Score Board */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-1">
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-amber-200 shadow-sm">
            <Zap className="w-5 h-5 text-amber-600 fill-amber-600" />
            <span className="text-2xl font-bold text-amber-900 tabular-nums">
              {score}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-3 py-1 rounded-full border border-amber-100 self-start">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-800">
              BEST: {highScore}
            </span>
          </div>
        </div>

        {/* Global Controls */}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          {gameState === GameState.PLAYING && (
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="p-2 bg-white/80 backdrop-blur-sm rounded-full border border-amber-200 text-amber-700 hover:bg-white transition-colors"
            >
              {isPaused ? <PlayCircle className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
            </button>
          )}
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-white/80 backdrop-blur-sm rounded-full border border-amber-200 text-amber-700 hover:bg-white transition-colors"
          >
            <SettingsIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Player */}
        <div 
          className="absolute transition-all duration-75"
          style={{ 
            left: `${player.x}px`, 
            bottom: `${-player.y}px`,
            width: `${player.width}px`,
            height: `${player.height}px`,
            fontSize: '50px',
            lineHeight: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: player.isJumping ? `rotate(${-player.velocityY * 2}deg)` : 'rotate(0deg)'
          }}
        >
          {player.isJumping ? '🐘' : '🐘'}
          {/* Dust effect when not jumping */}
          {!player.isJumping && gameState === GameState.PLAYING && (
            <motion.div 
              animate={{ opacity: [0.2, 0], x: [-10, -30], scale: [1, 1.5] }}
              transition={{ repeat: Infinity, duration: 0.4 }}
              className="absolute -left-4 bottom-2 text-xs"
            >
              💨
            </motion.div>
          )}
        </div>

        {/* Obstacles */}
        {obstacles.map(obs => (
          <div 
            key={obs.id}
            className="absolute flex items-center justify-center"
            style={{ 
              left: `${obs.x}px`, 
              bottom: '0px',
              width: `${obs.width}px`,
              height: `${obs.height}px`,
              fontSize: '32px'
            }}
          >
            {obs.type === 'log' ? '🪵' : '🪨'}
          </div>
        ))}

        {/* Peanuts */}
        {peanuts.map(p => (
          <motion.div 
            key={p.id}
            initial={{ scale: 1 }}
            animate={p.collected ? { scale: 0, opacity: 0, y: -20 } : {}}
            className="absolute flex items-center justify-center z-10"
            style={{ 
              left: `${p.x}px`, 
              bottom: `${-p.y}px`,
              width: `${p.width}px`,
              height: `${p.height}px`,
              fontSize: '24px'
            }}
          >
            🥜
          </motion.div>
        ))}

      </div>

      {/* Overlays */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 p-6 flex flex-col border-l border-amber-100"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-amber-900 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                Settings
              </h2>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-amber-50 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-amber-700" />
              </button>
            </div>

            <div className="flex flex-col gap-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-bold text-amber-800 uppercase tracking-wider">
                  <span>Gravity</span>
                  <span>{settings.gravity.toFixed(1)}</span>
                </div>
                <input 
                  type="range" min="0.1" max="2" step="0.1"
                  value={settings.gravity}
                  onChange={(e) => setSettings(s => ({ ...s, gravity: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-amber-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm font-bold text-amber-800 uppercase tracking-wider">
                  <span>Jump Force</span>
                  <span>{Math.abs(settings.jumpForce)}</span>
                </div>
                <input 
                  type="range" min="5" max="20" step="1"
                  value={Math.abs(settings.jumpForce)}
                  onChange={(e) => setSettings(s => ({ ...s, jumpForce: -parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-amber-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm font-bold text-amber-800 uppercase tracking-wider">
                  <span>Initial Speed</span>
                  <span>{settings.initialSpeed}</span>
                </div>
                <input 
                  type="range" min="2" max="15" step="1"
                  value={settings.initialSpeed}
                  onChange={(e) => setSettings(s => ({ ...s, initialSpeed: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-amber-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm font-bold text-amber-800 uppercase tracking-wider">
                   <span>Spawn Freq</span>
                   <span>{(1000 / settings.spawnInterval).toFixed(1)}/s</span>
                </div>
                <input 
                  type="range" min="500" max="3000" step="100"
                  value={settings.spawnInterval}
                  onChange={(e) => setSettings(s => ({ ...s, spawnInterval: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-amber-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="mt-8 pt-8 border-t border-amber-50 space-y-4">
                <button 
                  onClick={() => setSettings(DEFAULT_SETTINGS)}
                  className="w-full py-2 px-4 rounded-xl border-2 border-amber-100 text-amber-700 font-bold hover:bg-amber-50 transition-colors"
                >
                  Reset Defaults
                </button>
                <button 
                  onClick={() => {
                    localStorage.removeItem('elephant-high-score');
                    setHighScore(0);
                  }}
                  className="w-full py-2 px-4 rounded-xl border-2 border-red-50 text-red-600 font-bold hover:bg-red-50 transition-colors"
                >
                  Clear High Score
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {isPaused && !showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-40 bg-white/20 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <div className="bg-white p-8 rounded-3xl shadow-xl border-4 border-amber-400 text-center">
              <h2 className="text-3xl font-black text-amber-900 mb-6">GAME PAUSED</h2>
              <button 
                onClick={() => setIsPaused(false)}
                className="bg-amber-500 text-white px-8 py-3 rounded-2xl font-bold text-lg hover:bg-amber-600 transition-transform active:scale-95 shadow-lg shadow-amber-200 flex items-center gap-2"
              >
                <PlayCircle className="w-6 h-6" />
                RESUME
              </button>
            </div>
          </motion.div>
        )}

        {gameState === GameState.START && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/10 backdrop-blur-md"
          >
            <div className="bg-white p-8 rounded-3xl shadow-2xl border-4 border-amber-500 text-center max-w-sm">
              <h1 className="text-4xl font-extrabold text-amber-900 mb-2">Elephant Rush</h1>
              <div className="flex justify-center gap-6 my-4 text-3xl">
                <div className="flex flex-col items-center">
                   <span>🐘</span>
                   <span className="text-[10px] font-bold text-amber-600">YOU</span>
                </div>
                <div className="flex flex-col items-center">
                   <span>🥜</span>
                   <span className="text-[10px] font-bold text-amber-600">SCORE</span>
                </div>
                <div className="flex flex-col items-center">
                   <span>🪵</span>
                   <span className="text-[10px] font-bold text-amber-600">DANGER</span>
                </div>
              </div>
              <p className="text-amber-800 mb-6 font-medium">Jump over logs and rocks to help the elephant roam free!</p>
              
              <div className="flex flex-col gap-4">
                 <button 
                  onClick={startGame}
                  className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-2xl font-bold text-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-200"
                >
                  <Play className="w-6 h-6 fill-current" />
                  START GAME
                </button>
                <div className="text-xs text-amber-600 font-semibold uppercase tracking-widest">
                  Press Space or Tap to Jump
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === GameState.GAME_OVER && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-red-500/10 backdrop-blur-md"
          >
            <div className="bg-white p-8 rounded-3xl shadow-2xl border-4 border-red-500 text-center max-w-sm">
              <h1 className="text-4xl font-extrabold text-red-600 mb-2">CRASH!</h1>
              <div className="flex flex-col items-center gap-1 mb-6">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-tighter">Your Score</span>
                <span className="text-6xl font-black text-slate-900">{score}</span>
              </div>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={startGame}
                  className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-2xl font-bold text-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-200"
                >
                  <RotateCcw className="w-6 h-6" />
                  TRY AGAIN
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UI Hints */}
      {gameState === GameState.PLAYING && (
        <div className="absolute bottom-10 text-amber-900/30 font-bold uppercase tracking-widest text-sm pointer-events-none select-none">
          Tap or Space to Jump
        </div>
      )}
    </div>
  );
}
