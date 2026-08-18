// SIMULACAO DE REBALANCEAMENTO DE VOLUME - B3-v10
// ✅ PROPOSTA CONFIRMADA v3 (implementada em 22_Core_Analyzers.js):
//    Teto de -20 estendido para a faixa 0.6 <= VR < 0.7 (antes -30).
//    Alta liquidez (Tier 1) com VR < 0.7 agora leva penalidade fixa de -20.
//
'use strict';
// 🔐 Token BRAPI NUNCA em texto plano no código — lido via CONFIG.getSecret/PropertiesService (ver _getBrapiToken).
const TICKERS = ['VALE3','BBAS3','B3SA3','RAIL3','PRIO3','CMIG4','TRPL4','CPLE3'];
const WHITELIST = ['VALE3','PETR4','ITUB4','BBAS3','B3SA3','ABEV3','BBDC4','WEGE3','SUZB3','ELET3','VIVT3','SBSP3','EQTL3','CSAN3','GGBR4','RAIL3','PRIO3','CMIG4','CSNA3','USIM5','BRAP4','RANI3','GOAU4','RECV3','TRPL4','CPLE3','JBSS3','LREN3','RENT3','HAPV3','MGLU3','BOVA11','PETR3','ITSA4','SANB11','BBSE3','EMBR3','RADL3','FLRY3','HYPE3','TOTS3','LAME4','PCAR3','MRFG3','BEEF3','ASAI3','COGN3','RDOR3','NTCO3','VBBR3','UGPA3','RRRP3','VAMO3','MULT3','ALOS3','CRFB3','AAPL34','MSFT34','GOOGL34','AMZN34','NVDA34','TSLA34','META34','NFLX34','KO34','PEPB34','JNJ34','WMT34','DISB34','MCDB34','VISA34','MAST34','BABA34','XOM34','PGCO34','COCA34','ITLC34','GOGL34','AMZO34','MSFT35','AAPL35','NVDA35','TSLA35','META35','GOOGL35','AMZN35','NFLX35','AAPL39','MSFT39','NVDA39','TSLA39','META39'];
/**
 * Obtém o token BRAPI de forma segura (nunca hardcoded no código).
 * Fonte: CONFIG.getSecret (módulo 01) → fallback Script Properties.
 * @returns {string|null}
 */
function _getBrapiToken() {
  try {
    if (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') {
      var viaConfig = CONFIG.getSecret('BRAPI_TOKEN');
      if (viaConfig) return String(viaConfig).trim();
    }
  } catch (e) { /* tenta fallback abaixo */ }
  var viaProps = PropertiesService.getScriptProperties().getProperty('BRAPI_TOKEN');
  return viaProps ? String(viaProps).trim() : null;
}

function getMedian(arr){const a=arr.filter(x=>typeof x==='number'&&!isNaN(x)).sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return(a.length%2)?a[m]:(a[m-1]+a[m])/2;}
function getVolumeRelativo(candles,period){period=period||20;if(!candles||candles.length<period+1)return 1.0;const start=Math.max(0,candles.length-period-1);const vols=[];for(let i=start;i<candles.length-1;i++){const v=Number(candles[i].volume||0);if(v>0)vols.push(v);}if(!vols.length)return 1.0;const median=getMedian(vols);const lastVol=Number(candles[candles.length-1].volume||0);if(median===0)return 1.0;return parseFloat((lastVol/median).toFixed(3));}
function calcPen(volRel,ticker){let s=0;if(volRel>=2.0)s+=25;else if(volRel>=1.5)s+=20;else if(volRel>=1.2)s+=12;else if(volRel>=1.0)s+=5;else if(volRel>=0.7)s-=15;else s-=30;const base=s;let veto=0;const liq=WHITELIST.indexOf(ticker)!==-1;if(volRel<0.6){veto=liq?-5:-30;}return{base,veto,total:base+veto,liq};}
/**
 * Obtém candles históricos do ticker via BRAPI.
 * 🔧 CORREÇÃO: `fetch()` nativo não existe no GAS V8 — usa UrlFetchApp.fetch().
 * Preferência: reutiliza o BrapiFetcher unificado (cache + retry + rate limit);
 * fallback direto garante que a simulação funcione mesmo sem o módulo carregado.
 * @param {string} t ticker (ex.: VALE3)
 * @returns {Array} candles { date, open, high, low, close, volume }
 */
function fetchCandles(t){
  if (typeof BrapiFetcher !== 'undefined' && typeof BrapiFetcher.fetchHistory === 'function') {
    var hist = BrapiFetcher.fetchHistory(t);
    if (hist && hist.length > 0) return hist;
  }
  var token = _getBrapiToken();
  if (!token) throw new Error('BRAPI_TOKEN não configurado nas Script Properties');
  var url = 'https://brapi.dev/api/quote/' + t + '?range=3mo&interval=1d&token=' + encodeURIComponent(token);
  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    connectTimeout: 8000,
    readTimeout: 8000
  });
  if (response.getResponseCode() !== 200) throw new Error('HTTP ' + response.getResponseCode());
  var d = JSON.parse(response.getContentText());
  var r = d.results && d.results[0];
  if (!r || !r.historicalDataPrice) throw new Error('sem dados');
  Utilities.sleep(500); // Respeita rate limit mínimo entre chamadas à BRAPI
  return r.historicalDataPrice;
}
/**
 * Armazena o Volume Relativo de HOJE por ticker (preenchido na análise principal).
 * @type {Object<string, number>}
 */
var _vrAtualPorTicker = {};

/**
 * Monta uma linha comparativa ATUAL vs PROPOSTA para um dado Volume Relativo.
 * @param {string} ticker
 * @param {number} vr volume relativo simulado
 * @returns {string}
 */
function _formatarCenario(ticker, vr) {
  const at = calcPen(vr, ticker);
  const pr = Object.assign({}, at);
  // Proposta CONFIRMADA: alta liquidez com VR < 0.7 recebe penalidade fixa de -20
  if (vr < 0.7 && at.liq) { pr.veto = -20 - at.base; pr.total = -20; }
  const v = pr.total - at.total;
  const recup = v > 0 ? 'SIM' : '-';
  return String(vr).padEnd(10) + ' | ' +
         String(at.total).padStart(5) + ' | ' +
         String(pr.total).padStart(8) + ' | ' +
         String(v).padStart(8) + ' | ' + recup;
}

/**
 * Simula o efeito da proposta em faixas de Volume Relativo. A proposta agora
 * cobre alta liquidez com VR < 0.7 (teto de -20), eliminando a lacuna 0.6–0.7
 * que antes mantinha -30 e criava incentivo invertido vs. a faixa < 0.6.
 */
function simularCenariosProposta() {
  const bandas = [0.3, 0.5, 0.59, 0.65, 0.7, 0.9, 1.0, 1.2, 1.5, 2.0];
  console.log('');
  console.log('='.repeat(90));
  console.log('CENARIOS SIMULADOS - EFEITO DA PROPOSTA POR FAIXA DE VR');
  console.log('='.repeat(90));
  console.log('Proposta CONFIRMADA: alta liquidez com VR < 0.7 => penalidade fixa de -20');
  console.log('          (regra atual: -30 p/ VR<0.7 e -35 p/ VR<0.6 — agora limitados a -20)');
  console.log('-'.repeat(90));

  // A penalidade só depende de VR + whitelist → usa o 1º ticker de alta liquidez
  const ref = WHITELIST.indexOf(TICKERS[0]) !== -1 ? TICKERS[0] : 'VALE3';
  console.log('Faixa VR  | ATUAL | PROPOSTA | Variacao | Recuperado?');
  console.log('----------|-------|----------|----------|------------');
  for (let i = 0; i < bandas.length; i++) {
    const vr = bandas[i];
    const linha = _formatarCenario(ref, vr);
    const marcador = (_vrAtualPorTicker[ref] !== undefined &&
                      Math.abs(vr - _vrAtualPorTicker[ref]) < 0.001) ? '  <- HOJE' : '';
    console.log(linha + marcador);
  }

  console.log('-'.repeat(90));
  console.log('VR de HOJE por ticker analisado:');
  for (let j = 0; j < TICKERS.length; j++) {
    const t = TICKERS[j];
    console.log('  ' + t.padEnd(6) + ' VR=' + (_vrAtualPorTicker[t] !== undefined ? _vrAtualPorTicker[t] : 'n/d'));
  }
  console.log('='.repeat(90));
}

async function SIMULAR_REBALANCEAMENTO_VOLUME(){console.log('='.repeat(90));console.log('SIMULACAO DE REBALANCEAMENTO DE VOLUME - B3-v10');console.log('='.repeat(90));const res=[];for(const t of TICKERS){try{const c=await fetchCandles(t);const vr=getVolumeRelativo(c,20);_vrAtualPorTicker[t]=vr;const at=calcPen(vr,t);let pr={...at};if(vr<0.7&&at.liq){pr.veto=-20-at.base;pr.total=-20;}res.push({t,vr,liq:at.liq,at,pr});console.log('');console.log('['+t+'] ('+(at.liq?'ALTA LIQUIDEZ':'baixa liquidez')+')');console.log('   Volume Relativo: '+vr);console.log('   Penalidade ATUAL: base='+at.base+' + veto='+at.veto+' = '+at.total);console.log('   Penalidade PROPOSTA: '+pr.total);console.log('   Variacao: '+(pr.total-at.total)+' pts');}catch(e){console.log('['+t+']: erro ('+e.message+')');}}
console.log('');console.log('='.repeat(90));console.log('RESUMO - ANTES vs DEPOIS vs VARIACAO');console.log('='.repeat(90));console.log('Ticker   | VolRel | Liquidez | Penal. ATUAL | Penal. PROPOSTA | Variacao | Recuperado?');console.log('-'.repeat(90));let rec=0;for(const r of res){const v=r.pr.total-r.at.total;const recup=v>0?'SIM':'-';if(v>0)rec++;console.log(r.t.padEnd(8)+' | '+String(r.vr).padEnd(6)+' | '+(r.liq?'ALTA':'baixa').padEnd(8)+' | '+String(r.at.total).padEnd(12)+' | '+String(r.pr.total).padEnd(15)+' | '+String(v).padEnd(8)+' | '+recup);}console.log('');console.log('='.repeat(90));console.log('Ativos recuperados com a proposta (-20 p/ alta liquidez VR<0.7): '+rec+'/'+res.length);console.log('='.repeat(90));

  simularCenariosProposta();
}
// ⚠️ Execução automática removida: código top-level roda a cada execução no GAS.
// Para rodar a simulação, execute manualmente a função SIMULAR_REBALANCEAMENTO_VOLUME
// no editor do Apps Script (ou adicione ao menu em 00_Menu_Manager.js).
