'use strict';
function analyzeProcurement(input){
  const items = (input.requests||[]).map(r => ({
    label: String(r.label).trim(),
    targetPrice: Number(r.targetPrice),
    qty: Number(r.qty)
  }));
  const currency = input.currency || 'EUR';
  const totalBottles = items.reduce((a,b)=>a+b.qty,0);
  const estCost = items.reduce((a,b)=>a+(b.qty*b.targetPrice),0);
  const avgPrice = totalBottles ? estCost/totalBottles : 0;
  const perItem = items.map(i => ({ label: i.label, qty: i.qty, total: i.qty*i.targetPrice }));
  const overBudget = typeof input.maxPerBottle === 'number'
    ? items.filter(i => i.targetPrice > input.maxPerBottle).map(i => ({ label: i.label, targetPrice: i.targetPrice }))
    : [];
  return { totalBottles, estCost, avgPrice, currency, overBudget, perItem };
}
module.exports = { analyzeProcurement };
