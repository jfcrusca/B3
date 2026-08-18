
// 13_Indicators_RelativeStrength.gs (correção getHistory)

const RelativeStrength = (function(){
  'use strict';

  function calculateRS(ticker, benchmarkTicker, period, dataPeriod, interval){
    benchmarkTicker = benchmarkTicker || 'IBOV';
    period         = period || 21;
    dataPeriod     = dataPeriod || '1y';  // range
    interval       = interval || '1d';

    // Substitui fetchCandles -> getHistory(ticker, interval, range)
    const t = YahooFetcher.getHistory(ticker, interval, dataPeriod);
    if(!t) return null;

    const b = YahooFetcher.getHistory(benchmarkTicker, interval, dataPeriod);
    if(!b) return null;

    const tC = t.map(c => c.close);
    const bC = b.map(c => c.close);
    const min = Math.min(tC.length, bC.length);

    const rs = tC.slice(-min)
      .map((c,i) => (bC[bC.length - min + i] !== 0 ? c / bC[bC.length - min + i] : NaN))
      .filter(v => !isNaN(v));
    if (rs.length === 0) return null;

    const rsE = TechnicalIndicators.calculateEMA(rs, period);
    return {
      rsValues: rs,
      rsEma: rsE,
      currentRS: rs[rs.length - 1],
      currentRSEma: rsE[rsE.length - 1]
    };
  }

  return { calculateRS };
})();
``
