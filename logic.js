/* Credit card billing date engine. No bank assumptions are hardcoded. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CardLogic = api;
})(typeof window !== 'undefined' ? window : null, function() {
  const pad = n => String(n).padStart(2, '0');
  const fromISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) throw new Error('无效日期'); const d = new Date(+m[1], +m[2]-1, +m[3]); if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2]-1 || d.getDate() !== +m[3]) throw new Error('无效日期'); return d; };
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const daysInMonth = (y,m) => new Date(y, m, 0).getDate(); // m 1..12
  const clampDay = (y, m, n) => Math.min(daysInMonth(y,m), Math.max(1, Number(n)));
  const dateForMonth = (y, m, day) => new Date(y, m-1, clampDay(y,m,day));
  const shiftMonth = (d, n) => { const f = new Date(d.getFullYear(), d.getMonth()+n, 1); return f; };
  const addDays = (d,n) => { const x = new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()+n); return x; };
  // Calendar-day difference using UTC *date parts*, avoiding DST.
  const dayDiff = (a,b) => Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()) - Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);
  const today = () => { const d = new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); };
  const zh = d => `${d.getMonth()+1}月${d.getDate()}日`;
  const fullZh = d => `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
  const ym = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  const cycleKey = (card, statement) => `${card.id}|${ym(statement)}`;
  const statementFor = (card,year,month) => dateForMonth(year,month,card.billingDay);
  function fixedMonthFor(card, statement) {
    if (card.fixedMonth !== 'auto') return Number(card.fixedMonth || 0);
    const sameMonth = dateForMonth(statement.getFullYear(), statement.getMonth()+1, card.fixedDay);
    return sameMonth > statement ? 0 : 1;
  }
  function repaymentFor(card, statement, actualDue) {
    if (actualDue) return fromISO(actualDue);
    if (card.dueMode === 'fixed') {
      const d = shiftMonth(statement, fixedMonthFor(card, statement));
      return dateForMonth(d.getFullYear(), d.getMonth()+1, card.fixedDay);
    }
    return addDays(statement, Number(card.offsetDays || 20));
  }
  function spend(card, date, overrides) {
    const selected = typeof date === 'string' ? fromISO(date) : date;
    const statementThisMonth = statementFor(card,selected.getFullYear(),selected.getMonth()+1);
    // Billing day is conservatively counted as same statement; clearing may vary.
    const next = (selected <= statementThisMonth) ? statementThisMonth : statementFor(card,shiftMonth(selected,1).getFullYear(),shiftMonth(selected,1).getMonth()+1);
    const key = cycleKey(card,next);
    const due = repaymentFor(card,next,overrides && overrides[key]);
    return {card, statement: next, due, days: dayDiff(selected,due), cycleId:key, ambiguous:iso(selected)===iso(statementThisMonth)};
  }
  function dueCycles(card, start, months, overrides) {
    const result=[];
    for (let n=-3; n<months; n++) {
      const m = new Date(start.getFullYear(),start.getMonth()+n,1);
      const statement = statementFor(card,m.getFullYear(),m.getMonth()+1);
      const key = cycleKey(card,statement);
      result.push({card, statement, due:repaymentFor(card,statement,overrides && overrides[key]), cycleId:key});
    }
    return result;
  }
  function upcoming(cards, date, overrides, paid, daysWindow) {
    const reference = typeof date==='string' ? fromISO(date) : date;
    const rows=[];
    for (const card of cards) {
      const cycles = dueCycles(card, reference, 4, overrides).filter(x => !paid[x.cycleId]).map(x => ({...x,days:dayDiff(reference,x.due)}));
      // Up to 7d overdue is visible for checking; older unconfirmed cycles are archived from dashboard.
      const next = cycles.find(x => x.days >= -7);
      if (next) rows.push(next);
    }
    rows.sort((a,b)=>a.days-b.days);
    return typeof daysWindow==='number' ? rows.filter(x=>x.days<=daysWindow) : rows;
  }
  function projectedReminders(cards, date, overrides, paid) {
    const reference = typeof date==='string' ? fromISO(date) : date;
    const result=[];
    for (const card of cards) for (const entry of dueCycles(card,reference,16,overrides)) {
      const days=dayDiff(reference,entry.due);
      if (days>=0 && days<=430 && !paid[entry.cycleId]) result.push({cycleId:entry.cycleId,cardId:card.id, label: `${card.bank}${card.name && card.name !== card.bank ? ' · '+card.name : ''}`,due:iso(entry.due)});
    }
    return result;
  }
  return {fromISO,iso,daysInMonth,dateForMonth,shiftMonth,addDays,dayDiff,today,zh,fullZh,ym,cycleKey,statementFor,fixedMonthFor,repaymentFor,spend,dueCycles,upcoming,projectedReminders};
});
