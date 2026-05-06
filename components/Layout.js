import { useState } from 'react'
import Navigation from './Navigation'

export default function Layout({ children, activePage }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">KENGE14</h1>
              <p className="text-emerald-100 text-sm">Gestion Locative - Congo</p>
            </div>
            <div className="text-right">
              <select className="bg-emerald-800 text-white px-4 py-2 rounded-lg border border-emerald-600">
                <option>USD $</option>
                <option>CDF Fc</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <Navigation activePage={activePage} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            © 2026 KENGE14 - Gestion Locative Professionnelle
          </p>
        </div>
      </footer>
    </div>
  )
}
