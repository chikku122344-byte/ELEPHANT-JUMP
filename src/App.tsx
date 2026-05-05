/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Game from './components/Game';

export default function App() {
  return (
    <main className="w-full h-screen bg-slate-950 flex items-center justify-center overflow-hidden">
      <div className="w-full h-full max-w-7xl mx-auto flex items-center justify-center">
        <Game />
      </div>
    </main>
  );
}

