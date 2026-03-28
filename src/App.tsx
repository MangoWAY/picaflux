import UpdateElectron from '@/components/update'
import './App.css'

function App() {
  return (
    <div className="App">
      <div className="hero">
        <h1>PicaFlux</h1>
        <p className="tagline">Creative assets, in flow — AI-era open creative hub.</p>
        <p className="hint">
          编辑 <code>src/App.tsx</code> 体验热更新；产品方案见 <code>docs/PRODUCT_PLAN.md</code>。
        </p>
      </div>
      <UpdateElectron />
    </div>
  )
}

export default App
