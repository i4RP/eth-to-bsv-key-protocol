import { useState, useCallback } from 'react'
import { convertEthToBSV, type ConversionResult } from './lib/converter'
import { Copy, ArrowRight, Shield, Key, AlertCircle, Check } from 'lucide-react'
import './App.css'

function App() {
  const [ethKey, setEthKey] = useState('')
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('mainnet')
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const handleConvert = useCallback(() => {
    setError(null)
    setResult(null)
    if (!ethKey.trim()) {
      setError('Ethereum秘密鍵を入力してください')
      return
    }
    try {
      const conversion = convertEthToBSV(ethKey, network)
      setResult(conversion)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [ethKey, network])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConvert()
  }, [handleConvert])

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // fallback
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Key className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">ETH → BSV Key Converter</h1>
            <p className="text-sm text-gray-400">Ethereum秘密鍵からBitcoin SV秘密鍵を生成</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Protocol Info Banner */}
        <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-1">secp256k1共通プロトコル</p>
            <p className="text-blue-300/80">
              EthereumとBitcoin SVは同じsecp256k1楕円曲線を使用しています。
              生の32バイト秘密鍵は数学的に同一であり、エンコード形式（hex → WIF）とアドレス導出方式のみ異なります。
              変換はすべてブラウザ内で完結し、秘密鍵は外部に送信されません。
            </p>
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Ethereum 秘密鍵 (Hex)
          </label>
          <div className="flex gap-3">
            <input
              type="password"
              value={ethKey}
              onChange={(e) => setEthKey(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
              className="flex-1 bg-gray-900/80 border border-gray-600/50 rounded-lg px-4 py-3 text-sm font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50"
            />
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-400">ネットワーク:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setNetwork('mainnet')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    network === 'mainnet'
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-700'
                  }`}
                >
                  Mainnet
                </button>
                <button
                  onClick={() => setNetwork('testnet')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    network === 'testnet'
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-700'
                  }`}
                >
                  Testnet
                </button>
              </div>
            </div>

            <button
              onClick={handleConvert}
              className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              変換
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Conversion Flow Visual */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ethereum Side */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-300">E</span>
                  </div>
                  <h3 className="font-semibold text-indigo-200">Ethereum</h3>
                </div>
                <div className="p-5 space-y-4">
                  <ResultField
                    label="秘密鍵 (Hex)"
                    value={result.ethPrivateKey}
                    fieldId="ethKey"
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                    masked
                  />
                  <ResultField
                    label="アドレス"
                    value={result.ethAddress}
                    fieldId="ethAddr"
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                  />
                </div>
              </div>

              {/* BSV Side */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-orange-500/10 border-b border-orange-500/20 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-orange-300">B</span>
                  </div>
                  <h3 className="font-semibold text-orange-200">Bitcoin SV</h3>
                </div>
                <div className="p-5 space-y-4">
                  <ResultField
                    label="秘密鍵 (WIF)"
                    value={result.bsvPrivateKeyWIF}
                    fieldId="bsvWif"
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                    masked
                  />
                  <ResultField
                    label="アドレス (P2PKH)"
                    value={result.bsvAddress}
                    fieldId="bsvAddr"
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                  />
                </div>
              </div>
            </div>

            {/* Public Key Section */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-700/30 border-b border-gray-600/30">
                <h3 className="font-semibold text-gray-300">共有公開鍵 (secp256k1)</h3>
              </div>
              <div className="p-5 space-y-4">
                <ResultField
                  label="圧縮公開鍵 (33 bytes)"
                  value={result.compressedPublicKey}
                  fieldId="compPub"
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                />
                <ResultField
                  label="非圧縮公開鍵 (65 bytes)"
                  value={result.uncompressedPublicKey}
                  fieldId="uncompPub"
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                />
              </div>
            </div>

            {/* Network Badge */}
            <div className="text-center">
              <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                result.network === 'mainnet'
                  ? 'bg-green-500/10 text-green-300 border border-green-500/20'
                  : 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20'
              }`}>
                {result.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
              </span>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <footer className="mt-12 pt-6 border-t border-gray-700/30 text-center text-xs text-gray-500">
          <p>すべての変換処理はブラウザ内で完結します。秘密鍵は外部サーバーに送信されません。</p>
          <p className="mt-1">
            Powered by <span className="text-gray-400">@noble/secp256k1</span> &amp; <span className="text-gray-400">@noble/hashes</span> (audited cryptographic libraries)
          </p>
        </footer>
      </main>
    </div>
  )
}

// ============ Sub-components ============

function ResultField({
  label,
  value,
  fieldId,
  copiedField,
  onCopy,
  masked = false,
}: {
  label: string
  value: string
  fieldId: string
  copiedField: string | null
  onCopy: (text: string, field: string) => void
  masked?: boolean
}) {
  const [revealed, setRevealed] = useState(!masked)

  const displayValue = revealed ? value : value.slice(0, 6) + '--------' + value.slice(-4)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <div className="flex items-center gap-1">
          {masked && (
            <button
              onClick={() => setRevealed(!revealed)}
              className="text-xs text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded transition-colors"
            >
              {revealed ? '隠す' : '表示'}
            </button>
          )}
          <button
            onClick={() => onCopy(value, fieldId)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded transition-colors"
          >
            {copiedField === fieldId ? (
              <>
                <Check className="w-3 h-3 text-green-400" />
                <span className="text-green-400">コピー済</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>コピー</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="bg-gray-900/60 rounded-md px-3 py-2 font-mono text-xs text-gray-300 break-all leading-relaxed select-all">
        {displayValue}
      </div>
    </div>
  )
}

export default App
